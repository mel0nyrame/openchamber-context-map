import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type Subprocess } from "bun";

import { writeDiscovery } from "../src/shared/discovery.ts";
import { COLLECTOR_VERSION } from "../src/shared/version.ts";

const TOKEN = "host-injected-token";
const COLLECTOR_TOKEN = "collector-token";
const ROOT = join(import.meta.dir, "..");

let service: Subprocess | undefined;
let collector: ReturnType<typeof Bun.serve> | undefined;
let discoveryDir: string | undefined;

interface SeenRequest {
  path: string;
  authorization: string | null;
  sessionID: string | null;
  itemId: string | null;
}

let seen: SeenRequest[] = [];

afterEach(async () => {
  if (service) {
    service.kill();
    await service.exited;
    service = undefined;
  }
  collector?.stop(true);
  collector = undefined;
  seen = [];
  if (discoveryDir) {
    await rm(discoveryDir, { recursive: true, force: true });
    discoveryDir = undefined;
  }
});

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function startService(prepare?: (dir: string) => Promise<void>): Promise<{ port: number; base: string }> {
  discoveryDir = await mkdtemp(join(tmpdir(), "context-map-service-"));
  if (prepare) await prepare(discoveryDir);
  const port = await freePort();
  service = spawn(["bun", "src/service/main.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      OPENCHAMBER_SERVICE_PORT: String(port),
      OPENCHAMBER_SERVICE_TOKEN: TOKEN,
      CONTEXT_MAP_DISCOVERY_DIR: discoveryDir,
    },
    stdout: "ignore",
    stderr: "pipe",
  });

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (response.status === 200) return { port, base: `http://127.0.0.1:${port}` };
    } catch {
      // Service 还没开始监听。
    }
    await Bun.sleep(25);
  }

  const stderr = service.stderr;
  const detail = typeof stderr === "number" ? "" : await new Response(stderr).text();
  throw new Error(`Service 未在 5 秒内就绪\n${detail}`);
}

function hostAuth(): { Authorization: string } {
  return { Authorization: `Bearer ${TOKEN}` };
}

function startFakeCollector(options: {
  summary?: unknown;
  item?: unknown;
  summaryStatus?: number;
  itemStatus?: number;
  delaySummaryMs?: number;
} = {}): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      seen.push({
        path: url.pathname,
        authorization: request.headers.get("authorization"),
        sessionID: url.searchParams.get("sessionID"),
        itemId: url.searchParams.get("itemId"),
      });

      if (url.pathname === "/health") {
        return Response.json({ ok: true, version: COLLECTOR_VERSION });
      }
      if (url.pathname === "/summary" && options.delaySummaryMs) {
        await Bun.sleep(options.delaySummaryMs);
      }
      if (url.pathname === "/summary" && options.summaryStatus && options.summaryStatus !== 200) {
        return Response.json({ error: "not_found" }, { status: options.summaryStatus });
      }
      if (url.pathname === "/item" && options.itemStatus && options.itemStatus !== 200) {
        return Response.json({ error: "not_found" }, { status: options.itemStatus });
      }
      if (url.pathname === "/summary") {
        return Response.json(options.summary ?? {});
      }
      if (url.pathname === "/item") {
        return Response.json(options.item ?? {});
      }
      return Response.json({ error: "not_found" }, { status: 404 });
    },
  });
}

async function discover(port: number): Promise<void> {
  await writeDiscovery(discoveryDir!, {
    version: COLLECTOR_VERSION,
    port,
    token: COLLECTOR_TOKEN,
    pid: 4242,
    startedAt: new Date().toISOString(),
  });
}

const SUMMARY = {
  sessionID: "session-1",
  model: "anthropic/claude-sonnet-4-5",
  used: 1230,
  window: 150_000,
  windowAssumed: false,
  estimated: false,
  collectedAt: "2026-10-30T00:00:00.000Z",
  categories: [],
  items: [],
};

test("Service 只绑 127.0.0.1，并校验 host 注入的 bearer", async () => {
  const { port, base } = await startService();

  const unauthorized = await fetch(`${base}/health`);
  expect(unauthorized.status).toBe(401);

  const wrongToken = await fetch(`${base}/health`, {
    headers: { Authorization: "Bearer wrong-token" },
  });
  expect(wrongToken.status).toBe(401);

  const authorized = await fetch(`${base}/health`, {
    headers: hostAuth(),
  });
  expect(authorized.status).toBe(200);
  expect(await authorized.json()).toEqual({
    ok: true,
    collector: { connected: false, reason: "not_found" },
  });

  const otherAddress = await fetch(`http://127.0.0.2:${port}/health`, {
    headers: hostAuth(),
    signal: AbortSignal.timeout(750),
  })
    .then(() => "reachable")
    .catch(() => "blocked");
  expect(otherAddress).toBe("blocked");
});

test("Service 的 /summary 与 /item 校验 bearer 与必填参数", async () => {
  const { base } = await startService();
  const paths = ["/summary?sessionID=session-1", "/item?sessionID=session-1&itemId=system:0"];

  for (const path of paths) {
    const unauthorized = await fetch(`${base}${path}`);
    expect(unauthorized.status).toBe(401);
  }

  const missingSession = await fetch(`${base}/summary`, { headers: hostAuth() });
  expect(missingSession.status).toBe(400);
  expect(await missingSession.json()).toEqual({ error: "bad_request" });

  const missingItem = await fetch(`${base}/item?sessionID=session-1`, { headers: hostAuth() });
  expect(missingItem.status).toBe(400);
});

test("Service 在没有 Collector 时返回 503", async () => {
  const { base } = await startService();

  const response = await fetch(`${base}/summary?sessionID=session-1`, { headers: hostAuth() });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "collector_unavailable" });
});

test("Service 代理 /summary 与 /item，并转发 discovery token", async () => {
  collector = startFakeCollector({
    summary: SUMMARY,
    item: { id: "userMessages:0", title: "你好", chars: 2, text: "你好" },
  });
  const { base } = await startService(async () => {
    await discover(collector!.port!);
  });

  const summary = await fetch(`${base}/summary?sessionID=session-1`, { headers: hostAuth() });
  expect(summary.status).toBe(200);
  expect(await summary.json()).toEqual(SUMMARY);

  const item = await fetch(`${base}/item?sessionID=session-1&itemId=userMessages:0`, {
    headers: hostAuth(),
  });
  expect(item.status).toBe(200);
  expect(await item.json()).toEqual({
    id: "userMessages:0",
    title: "你好",
    chars: 2,
    text: "你好",
  });

  const forwarded = seen.filter((entry) => entry.path === "/summary" || entry.path === "/item");
  expect(forwarded.length).toBeGreaterThanOrEqual(2);
  for (const entry of forwarded) {
    expect(entry.authorization).toBe(`Bearer ${COLLECTOR_TOKEN}`);
    expect(entry.sessionID).toBe("session-1");
  }
});

test("Collector 返回 404 时 Service 映射为 no_snapshot", async () => {
  collector = startFakeCollector({ summaryStatus: 404 });
  const { base } = await startService(async () => {
    await discover(collector!.port!);
  });

  const response = await fetch(`${base}/summary?sessionID=missing`, { headers: hostAuth() });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "no_snapshot" });
});

test("Collector 对 /item 返回 404 时 Service 映射为 no_snapshot", async () => {
  collector = startFakeCollector({ itemStatus: 404 });
  const { base } = await startService(async () => {
    await discover(collector!.port!);
  });

  const response = await fetch(`${base}/item?sessionID=session-1&itemId=missing:0`, {
    headers: hostAuth(),
  });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "no_snapshot" });
});

test("Collector 超时时 Service 返回 504", async () => {
  collector = startFakeCollector({ summary: SUMMARY, delaySummaryMs: 3_500 });
  const { base } = await startService(async () => {
    await discover(collector!.port!);
  });

  const response = await fetch(`${base}/summary?sessionID=session-1`, { headers: hostAuth() });
  expect(response.status).toBe(504);
  expect(await response.json()).toEqual({ error: "collector_timeout" });
}, 10_000);

test("Service 通过 discovery 报告 Collector 已连接及版本", async () => {
  collector = startFakeCollector();
  const { base } = await startService(async () => {
    await discover(collector!.port!);
  });

  const response = await fetch(`${base}/health`, { headers: hostAuth() });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    collector: { connected: true, version: COLLECTOR_VERSION },
  });
});
