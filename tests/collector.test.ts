import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import collector from "../src/collector/main.ts";
import type { SessionContext } from "../src/collector/opencode.ts";
import { CATEGORIES, type Category, type SnapshotSummary } from "../src/shared/types.ts";

type HookCallback = (context: SessionContext) => void | Promise<void>;

interface FakeSession {
  hook: (
    name: string,
    callback: HookCallback,
    options?: unknown,
  ) => Promise<{ dispose: () => Promise<void> }>;
  context: (input: { sessionID: string }) => Promise<unknown>;
}

interface FakeOptions {
  models?: Array<{ providerID: string; modelID: string; limit: { context: number } }>;
  history?: Record<string, unknown[]>;
}

function fakeContext(options: FakeOptions = {}) {
  let callback: HookCallback | null = null;
  let disposed = false;
  const history = new Map(Object.entries(options.history ?? {}));

  const session: FakeSession = {
    hook: async (_name, next) => {
      callback = next;
      return {
        dispose: async () => {
          disposed = true;
        },
      };
    },
    context: async ({ sessionID }) => history.get(sessionID) ?? [],
  };

  const model = {
    list: async () => ({ data: options.models ?? [] }),
  };

  return {
    ctx: { session, model },
    get disposed(): boolean {
      return disposed;
    },
    async fire(context: SessionContext): Promise<void> {
      if (!callback) throw new Error("context hook 未注册");
      await callback(context);
    },
    setContext(next: FakeSession["context"]): void {
      session.context = next;
    },
  };
}

let discoveryDir: string | undefined;
let dispose: (() => Promise<void> | void) | undefined;

afterEach(async () => {
  await dispose?.();
  dispose = undefined;
  if (discoveryDir) await rm(discoveryDir, { recursive: true, force: true });
  discoveryDir = undefined;
  delete process.env.CONTEXT_MAP_DISCOVERY_DIR;
});

async function startCollector(
  options: FakeOptions = {},
): Promise<{
  port: number;
  token: string;
  file: string;
  fake: ReturnType<typeof fakeContext>;
}> {
  discoveryDir = await mkdtemp(join(tmpdir(), "context-map-collector-"));
  process.env.CONTEXT_MAP_DISCOVERY_DIR = discoveryDir;
  const fake = fakeContext(options);
  dispose = await collector.setup(fake.ctx);

  const files = (await readdir(discoveryDir)).filter((name) => name.endsWith(".json"));
  expect(files).toHaveLength(1);
  const file = join(discoveryDir, files[0]!);
  const record = JSON.parse(await readFile(file, "utf8")) as { port: number; token: string };
  return { port: record.port, token: record.token, file, fake };
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function getSummary(
  port: number,
  token: string,
  sessionID: string,
): Promise<SnapshotSummary | null> {
  const response = await fetch(
    `http://127.0.0.1:${port}/summary?sessionID=${encodeURIComponent(sessionID)}`,
    { headers: auth(token) },
  );
  if (response.status !== 200) return null;
  return (await response.json()) as SnapshotSummary;
}

async function waitForSummary(
  port: number,
  token: string,
  sessionID: string,
  predicate: (summary: SnapshotSummary) => boolean,
): Promise<SnapshotSummary> {
  const deadline = Date.now() + 2_000;
  let last: SnapshotSummary | null = null;
  while (Date.now() < deadline) {
    last = await getSummary(port, token, sessionID);
    if (last && predicate(last)) return last;
    await Bun.sleep(10);
  }
  throw new Error(`等待快照超时：${JSON.stringify(last)}`);
}

function baseContext(sessionID = "session-1"): SessionContext {
  return {
    sessionID,
    model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" },
    system: [{ type: "text", text: "S".repeat(400) }],
    tools: {},
    messages: [],
  };
}

function assistantUsage(input: number, cacheRead = 0, cacheWrite = 0): unknown {
  return {
    type: "assistant",
    id: "assistant-1",
    content: [],
    tokens: {
      input,
      output: 50,
      reasoning: 10,
      cache: { read: cacheRead, write: cacheWrite },
    },
  };
}

function categoryOf(summary: SnapshotSummary, category: Category) {
  const found = summary.categories.find((entry) => entry.category === category);
  if (!found) throw new Error(`缺少分类 ${category}`);
  return found;
}

const MODELS = [
  { providerID: "anthropic", modelID: "claude-sonnet-4-5", limit: { context: 150_000 } },
];

test("Collector 启动后提供无需鉴权的 /health，并写入 0600 的 discovery 文件", async () => {
  const { port, file } = await startCollector();

  expect((await stat(file)).mode & 0o777).toBe(0o600);

  const response = await fetch(`http://127.0.0.1:${port}/health`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, version: "0.1.0" });
});

test("快照按 8 分类统计，并把字符估算缩放到 provider 的 Used", async () => {
  const { port, token, fake } = await startCollector({
    models: MODELS,
    history: { "session-1": [assistantUsage(1000, 200, 30)] },
  });

  const context = baseContext();
  context.tools = {
    read: { description: "D".repeat(100), input: { type: "object" } },
  };
  context.messages = [
    { role: "user", content: [{ type: "text", text: "U".repeat(80) }] },
    {
      role: "assistant",
      content: [
        { type: "text", text: "A".repeat(40) },
        { type: "reasoning", text: "R".repeat(20) },
        { type: "tool-call", id: "call-1", name: "read", input: { path: "x".repeat(60) } },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          id: "call-1",
          name: "read",
          result: { type: "text", value: "V".repeat(100) },
        },
      ],
    },
    {
      role: "user",
      content: [
        { type: "compaction", provider: "anthropic", text: "C".repeat(30) },
        { type: "effort", effort: "high" },
      ],
    },
  ];

  await fake.fire(context);
  const summary = await waitForSummary(port, token, "session-1", (value) => value.used === 1230);

  expect(summary.model).toBe("anthropic/claude-sonnet-4-5");
  expect(summary.used).toBe(1230);
  expect(summary.window).toBe(150_000);
  expect(summary.windowAssumed).toBe(false);
  expect(summary.estimated).toBe(false);
  expect(summary.categories.map((entry) => entry.category)).toEqual([...CATEGORIES]);
  expect(summary.categories.reduce((sum, entry) => sum + entry.tokens, 0)).toBe(1230);

  expect(categoryOf(summary, "system").chars).toBe(400);
  expect(categoryOf(summary, "userMessages").chars).toBe(80);
  expect(categoryOf(summary, "assistantText").chars).toBe(40);
  expect(categoryOf(summary, "reasoning").chars).toBe(20);
  expect(categoryOf(summary, "other").chars).toBe(30);
  expect(categoryOf(summary, "other").items).toBe(2);
  expect(categoryOf(summary, "toolDefinitions").chars).toBeGreaterThan(100);
  expect(categoryOf(summary, "toolCalls").chars).toBeGreaterThan(60);
  expect(categoryOf(summary, "toolResults").chars).toBeGreaterThan(100);

  const raw = summary.categories.map((entry) => Math.ceil(entry.chars / 4));
  const totalRaw = raw.reduce((sum, value) => sum + value, 0);
  summary.categories.forEach((entry, index) => {
    expect(Math.abs(entry.tokens - (raw[index]! / totalRaw) * 1230)).toBeLessThanOrEqual(1);
  });

  expect(summary.items).toHaveLength(9);
  expect(summary.items.find((item) => item.id === "toolCalls:0")?.title).toBe("read");
  for (const item of summary.items) {
    expect(item.head.length).toBeLessThanOrEqual(200);
  }
});

test("没有 provider token 时整份标 estimated，分类 token 等于 ceil(chars/4)", async () => {
  const { port, token, fake } = await startCollector({ models: MODELS });

  const context = baseContext();
  context.system = [{ type: "text", text: "S".repeat(10) }];
  context.messages = [{ role: "user", content: [{ type: "text", text: "12345678" }] }];

  await fake.fire(context);
  const summary = await waitForSummary(port, token, "session-1", (value) => value.used === 5);

  expect(summary.estimated).toBe(true);
  expect(summary.used).toBe(5);
  expect(summary.categories.reduce((sum, entry) => sum + entry.tokens, 0)).toBe(5);
  for (const entry of summary.categories) {
    expect(entry.tokens).toBe(Math.ceil(entry.chars / 4));
  }
});

test("快照含 media 时整份标 estimated，media 本身不产生字符和 token", async () => {
  const { port, token, fake } = await startCollector({
    models: MODELS,
    history: { "session-1": [assistantUsage(500)] },
  });

  const context = baseContext();
  context.system = [];
  context.messages = [
    {
      role: "user",
      content: [
        { type: "text", text: "look" },
        {
          type: "media",
          filename: "shot.png",
          media: { source: { type: "base64", data: "x".repeat(100_000) } },
        },
      ],
    },
  ];

  await fake.fire(context);
  const summary = await waitForSummary(port, token, "session-1", (value) => value.used === 500);

  expect(summary.estimated).toBe(true);
  expect(categoryOf(summary, "other").chars).toBe(0);
  expect(categoryOf(summary, "other").tokens).toBe(0);
  expect(categoryOf(summary, "other").items).toBe(1);
  expect(summary.categories.reduce((sum, entry) => sum + entry.tokens, 0)).toBe(500);
});

test("只有 media 时把 provider Used 记到 other，分类和仍等于 Used", async () => {
  const { port, token, fake } = await startCollector({
    models: MODELS,
    history: { "session-1": [assistantUsage(1000, 200, 30)] },
  });

  const context = baseContext();
  context.system = [];
  context.messages = [
    {
      role: "user",
      content: [
        {
          type: "media",
          filename: "shot.png",
          media: { source: { type: "base64", data: "x".repeat(100_000) } },
        },
      ],
    },
  ];

  await fake.fire(context);
  const summary = await waitForSummary(port, token, "session-1", (value) => value.used === 1230);

  expect(summary.categories.reduce((sum, entry) => sum + entry.tokens, 0)).toBe(1230);
  expect(categoryOf(summary, "other").tokens).toBe(1230);
  expect(summary.estimated).toBe(true);
});

test("模型窗口取不到时使用 200000 并标 assumed window", async () => {
  const { port, token, fake } = await startCollector({
    models: [],
    history: { "session-1": [assistantUsage(1000)] },
  });

  const context = baseContext();
  context.system = [{ type: "text", text: "S".repeat(40) }];

  await fake.fire(context);
  const summary = await waitForSummary(port, token, "session-1", (value) => value.used === 1000);

  expect(summary.window).toBe(200_000);
  expect(summary.windowAssumed).toBe(true);
  expect(summary.estimated).toBe(false);
});

test("同一 session 只保留最后一次请求", async () => {
  const { port, token, fake } = await startCollector({ models: MODELS });

  await fake.fire({
    ...baseContext(),
    messages: [{ role: "user", content: [{ type: "text", text: "first" }] }],
  });
  await fake.fire({
    ...baseContext(),
    messages: [{ role: "user", content: [{ type: "text", text: "second" }] }],
  });

  const summary = await waitForSummary(
    port,
    token,
    "session-1",
    (value) => value.items.some((item) => item.head === "second"),
  );
  expect(summary.items.find((item) => item.id === "userMessages:0")?.chars).toBe(6);
  expect(summary.items.some((item) => item.head === "first")).toBe(false);
});

test("最多保留 20 个 session，淘汰最久未更新的", async () => {
  const { port, token, fake } = await startCollector({ models: MODELS });

  for (let index = 1; index <= 21; index += 1) {
    await fake.fire({
      ...baseContext(`session-${index}`),
      system: [],
      messages: [{ role: "user", content: [{ type: "text", text: `request ${index}` }] }],
    });
  }

  expect(await getSummary(port, token, "session-1")).toBeNull();
  expect(await getSummary(port, token, "session-2")).not.toBeNull();
  expect(await getSummary(port, token, "session-21")).not.toBeNull();
});

test("每条预览最多 8000 字符，head 最多 200 字符", async () => {
  const { port, token, fake } = await startCollector({ models: MODELS });

  await fake.fire({
    ...baseContext(),
    system: [],
    messages: [{ role: "user", content: [{ type: "text", text: "a".repeat(9_000) }] }],
  });

  const summary = await waitForSummary(
    port,
    token,
    "session-1",
    (value) => value.items.some((item) => item.chars === 9_000),
  );
  const item = summary.items.find((entry) => entry.id === "userMessages:0");
  expect(item?.head).toHaveLength(200);

  const detailResponse = await fetch(
    `http://127.0.0.1:${port}/item?sessionID=session-1&itemId=userMessages:0`,
    { headers: auth(token) },
  );
  expect(detailResponse.status).toBe(200);
  const detail = (await detailResponse.json()) as { chars: number; text: string };
  expect(detail.chars).toBe(9_000);
  expect(detail.text).toHaveLength(8_000);
});

test("迟到的异步补齐不会覆盖更新的快照", async () => {
  const { port, token, fake } = await startCollector({ models: MODELS });

  const resolvers: Array<(value: unknown) => void> = [];
  fake.setContext(() => new Promise((resolve) => { resolvers.push(resolve); }));

  await fake.fire({
    ...baseContext(),
    messages: [{ role: "user", content: [{ type: "text", text: "first" }] }],
  });
  await fake.fire({
    ...baseContext(),
    messages: [{ role: "user", content: [{ type: "text", text: "second" }] }],
  });
  expect(resolvers).toHaveLength(2);

  resolvers[1]!([assistantUsage(111)]);
  await waitForSummary(port, token, "session-1", (value) => value.used === 111);

  resolvers[0]!([assistantUsage(222)]);
  await Bun.sleep(30);
  const summary = await getSummary(port, token, "session-1");
  expect(summary?.used).toBe(111);
});

test("Collector 的 /summary 与 /item 校验 bearer，并区分缺参数与未知 session", async () => {
  const { port, token } = await startCollector({ models: MODELS });

  for (const path of ["/summary?sessionID=session-1", "/item?sessionID=session-1&itemId=system:0"]) {
    const unauthorized = await fetch(`http://127.0.0.1:${port}${path}`);
    expect(unauthorized.status).toBe(401);

    const wrongToken = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(wrongToken.status).toBe(401);
  }

  const unknown = await fetch(`http://127.0.0.1:${port}/summary?sessionID=unknown`, {
    headers: auth(token),
  });
  expect(unknown.status).toBe(404);
  expect(await unknown.json()).toEqual({ error: "not_found" });

  const missingSession = await fetch(`http://127.0.0.1:${port}/summary`, {
    headers: auth(token),
  });
  expect(missingSession.status).toBe(400);
  expect(await missingSession.json()).toEqual({ error: "bad_request" });

  const missingItem = await fetch(`http://127.0.0.1:${port}/item?sessionID=session-1`, {
    headers: auth(token),
  });
  expect(missingItem.status).toBe(400);
});

test("Collector 对未知 itemId 返回 404", async () => {
  const { port, token, fake } = await startCollector({ models: MODELS });

  await fake.fire({
    ...baseContext(),
    messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
  });
  await waitForSummary(port, token, "session-1", (value) => value.items.length > 0);

  const unknownItem = await fetch(
    `http://127.0.0.1:${port}/item?sessionID=session-1&itemId=userMessages:999`,
    { headers: auth(token) },
  );
  expect(unknownItem.status).toBe(404);
  expect(await unknownItem.json()).toEqual({ error: "not_found" });
});

test("Collector dispose 关闭服务、删除 discovery 文件并释放 hook", async () => {
  const { port, file, fake } = await startCollector();
  const cleanup = dispose!;
  dispose = undefined;

  await cleanup();

  expect(fake.disposed).toBe(true);
  await expect(stat(file)).rejects.toThrow();
  await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
});
