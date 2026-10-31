import { expect, test } from "bun:test";

import { BaselineStore } from "../src/collector/baseline.ts";
import type { ModelRef, SessionInfo } from "../src/collector/opencode.ts";
import { SnapshotResolver } from "../src/collector/resolver.ts";
import { baselineDraft, buildDraft, DEFAULT_WINDOW } from "../src/collector/snapshot.ts";
import { SnapshotStore } from "../src/collector/store.ts";

const REF: ModelRef = { providerID: "anthropic", modelID: "claude-sonnet-4-5" };

function draftFor(sessionID = "session-1") {
  return buildDraft(
    {
      sessionID,
      agent: "build",
      model: REF,
      system: [{ type: "text", text: "S".repeat(400) }],
      tools: { read: { description: "D".repeat(100), input: { type: "object" } } },
      messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    },
    "2026-01-01T00:00:00.000Z",
  );
}

interface HarnessOptions {
  store?: SnapshotStore;
  baselines?: BaselineStore;
  session?: SessionInfo | null;
  sessionError?: boolean;
  window?: { window: number; assumed: boolean } | Error;
}

/** 只依赖内存 store 和假查询；不启动 HTTP、不写 discovery、不带 token。 */
function harness(options: HarnessOptions = {}) {
  const store = options.store ?? new SnapshotStore();
  const baselines = options.baselines ?? new BaselineStore();
  const sessionCalls: string[] = [];
  const windowCalls: ModelRef[] = [];

  const resolver = new SnapshotResolver({
    store,
    baselines,
    loadSession: async (sessionID) => {
      sessionCalls.push(sessionID);
      if (options.sessionError) throw new Error("session.get 失败");
      return options.session ?? null;
    },
    resolveWindow: async (ref) => {
      windowCalls.push(ref);
      const value = options.window ?? { window: DEFAULT_WINDOW, assumed: true };
      if (value instanceof Error) throw value;
      return value;
    },
  });

  return { resolver, store, baselines, sessionCalls, windowCalls };
}

test("当前记录优先：resolveSummary 直接返回快照，不查 session、baseline 或窗口", async () => {
  const store = new SnapshotStore();
  const record = store.add(draftFor());
  const { resolver, sessionCalls, windowCalls } = harness({ store });

  const summary = await resolver.resolveSummary("session-1");

  expect(summary).toEqual(record.summary);
  expect(summary?.baseline).toBe(false);
  expect(sessionCalls).toEqual([]);
  expect(windowCalls).toEqual([]);
});

test("没有当前记录时按 agent + model 返回两分类 baseline，窗口来自模型", async () => {
  const baselines = new BaselineStore();
  const template = baselineDraft(draftFor());
  baselines.remember("build", template);
  const { resolver, sessionCalls, windowCalls } = harness({
    baselines,
    session: { agent: "build", model: REF },
    window: { window: 150_000, assumed: false },
  });

  const summary = await resolver.resolveSummary("session-new");

  expect(summary).not.toBeNull();
  expect(summary!.sessionID).toBe("session-new");
  expect(summary!.baseline).toBe(true);
  expect(summary!.estimated).toBe(true);
  expect(summary!.restored).toBe(false);
  expect(summary!.window).toBe(150_000);
  expect(summary!.windowAssumed).toBe(false);
  expect(summary!.categories.map((entry) => entry.category)).toEqual(["system", "toolDefinitions"]);
  expect(summary!.used).toBe(summary!.categories.reduce((sum, entry) => sum + entry.tokens, 0));
  expect(summary!.items.every((item) => !item.id.includes("@"))).toBe(true);
  expect(sessionCalls).toEqual(["session-new"]);
  expect(windowCalls).toEqual([template.modelRef]);
});

test("baseline 按 agent 与 model 匹配，不会跨 agent 或跨模型泄漏", async () => {
  const baselines = new BaselineStore();
  baselines.remember("build", baselineDraft(draftFor()));

  const wrongAgent = harness({
    baselines,
    session: { agent: "plan", model: REF },
  });
  expect(await wrongAgent.resolver.resolveSummary("session-new")).toBeNull();
  expect(wrongAgent.windowCalls).toEqual([]);

  const wrongModel = harness({
    baselines,
    session: { agent: "build", model: { providerID: "anthropic", modelID: "other" } },
  });
  expect(await wrongModel.resolver.resolveSummary("session-new")).toBeNull();
  expect(wrongModel.windowCalls).toEqual([]);
});

test("session 查询失败、缺 agent、缺 model ref 或 ref 为空时没有 baseline", async () => {
  const baselines = new BaselineStore();
  baselines.remember("build", baselineDraft(draftFor()));

  const cases: HarnessOptions[] = [
    { baselines, sessionError: true },
    { baselines, session: null },
    { baselines, session: { agent: "", model: REF } },
    { baselines, session: { agent: "build" } },
    { baselines, session: { agent: "build", model: { providerID: "anthropic", modelID: "" } } },
    {
      baselines,
      session: { agent: "build", model: { providerID: 42, modelID: "x" } as unknown as ModelRef },
    },
  ];

  for (const options of cases) {
    const { resolver, windowCalls } = harness(options);
    expect(await resolver.resolveSummary("session-new")).toBeNull();
    expect(await resolver.resolveItem("session-new", "system:0")).toBeNull();
    expect(windowCalls).toEqual([]);
  }
});

test("窗口解析失败时 baseline 仍返回，窗口回退到 200000 assumed", async () => {
  const baselines = new BaselineStore();
  baselines.remember("build", baselineDraft(draftFor()));
  const { resolver } = harness({
    baselines,
    session: { agent: "build", model: REF },
    window: new Error("model.list 失败"),
  });

  const summary = await resolver.resolveSummary("session-new");

  expect(summary).not.toBeNull();
  expect(summary!.baseline).toBe(true);
  expect(summary!.window).toBe(DEFAULT_WINDOW);
  expect(summary!.windowAssumed).toBe(true);
});

test("当前记录有 draft 时条目只来自 draft，不回退 baseline", async () => {
  const baselines = new BaselineStore();
  baselines.remember("build", baselineDraft(draftFor()));
  const store = new SnapshotStore();
  const record = store.add(draftFor());
  const item = record.draft!.items.find((candidate) => candidate.id.startsWith("userMessages:0"))!;
  const { resolver, sessionCalls } = harness({ store, baselines });

  const detail = await resolver.resolveItem("session-1", item.id);

  expect(detail).toEqual({
    id: item.id,
    title: item.title,
    chars: item.chars,
    text: item.text,
  });
  expect(detail!.id).toContain("@");
  expect(sessionCalls).toEqual([]);
});

test("当前记录有 draft 但条目不存在时返回 null，不回退 baseline", async () => {
  const baselines = new BaselineStore();
  baselines.remember("build", baselineDraft(draftFor()));
  const store = new SnapshotStore();
  store.add(draftFor());
  const { resolver, sessionCalls } = harness({ store, baselines });

  // baseline 里有 system:0；当前 draft 的 id 带 @ 后缀，所以这里必须 404 而不是回退模板。
  expect(await resolver.resolveItem("session-1", "system:0")).toBeNull();
  expect(sessionCalls).toEqual([]);
});

test("恢复记录仍返回 summary，但条目返回 null，即使存在 baseline", async () => {
  const seeded = new SnapshotStore();
  const live = seeded.add(draftFor());
  const store = new SnapshotStore();
  const restored = store.restore(live.summary);

  const baselines = new BaselineStore();
  baselines.remember("build", baselineDraft(draftFor()));
  const { resolver, sessionCalls } = harness({ store, baselines });

  const summary = await resolver.resolveSummary("session-1");
  expect(summary).toEqual(restored.summary);
  expect(summary!.restored).toBe(true);

  expect(await resolver.resolveItem("session-1", restored.summary.items[0]!.id)).toBeNull();
  expect(await resolver.resolveItem("session-1", "system:0")).toBeNull();
  expect(sessionCalls).toEqual([]);
});

test("没有当前记录时 baseline 条目保持模板 id，未知条目返回 null", async () => {
  const baselines = new BaselineStore();
  const template = baselineDraft(draftFor());
  baselines.remember("build", template);
  const expected = template.items.find((item) => item.id === "system:0")!;
  const { resolver, sessionCalls, windowCalls } = harness({
    baselines,
    session: { agent: "build", model: REF },
  });

  const detail = await resolver.resolveItem("session-new", "system:0");
  expect(detail).toEqual({
    id: "system:0",
    title: expected.title,
    chars: 400,
    text: "S".repeat(400),
  });

  expect(await resolver.resolveItem("session-new", "userMessages:0")).toBeNull();
  expect(sessionCalls).toEqual(["session-new", "session-new"]);
  expect(windowCalls).toEqual([]);
});

test("空 sessionID 或空 itemID 防御性返回 null", async () => {
  const { resolver, sessionCalls } = harness();

  expect(await resolver.resolveSummary("")).toBeNull();
  expect(await resolver.resolveItem("", "system:0")).toBeNull();
  expect(await resolver.resolveItem("session-1", "")).toBeNull();
  expect(sessionCalls).toEqual([]);
});
