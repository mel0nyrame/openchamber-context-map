import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type Subprocess } from "bun";

import { writeDiscovery } from "../src/shared/discovery.ts";
import { COLLECTOR_VERSION } from "../src/shared/version.ts";

const TOKEN = "host-injected-token";
const ROOT = join(import.meta.dir, "..");

let service: Subprocess | undefined;
let collector: ReturnType<typeof Bun.serve> | undefined;
let discoveryDir: string | undefined;

afterEach(async () => {
  if (service) {
    service.kill();
    await service.exited;
    service = undefined;
  }
  collector?.stop(true);
  collector = undefined;
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

test("Service 只绑 127.0.0.1，并校验 host 注入的 bearer", async () => {
  const { port, base } = await startService();

  const unauthorized = await fetch(`${base}/health`);
  expect(unauthorized.status).toBe(401);

  const wrongToken = await fetch(`${base}/health`, {
    headers: { Authorization: "Bearer wrong-token" },
  });
  expect(wrongToken.status).toBe(401);

  const authorized = await fetch(`${base}/health`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  expect(authorized.status).toBe(200);
  expect(await authorized.json()).toEqual({
    ok: true,
    collector: { connected: false, reason: "not_found" },
  });

  const otherAddress = await fetch(`http://127.0.0.2:${port}/health`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    signal: AbortSignal.timeout(750),
  })
    .then(() => "reachable")
    .catch(() => "blocked");
  expect(otherAddress).toBe("blocked");
});

test("Service 的 /summary 与 /item 校验 bearer，无快照时返回 404", async () => {
  const { base } = await startService();
  const paths = ["/summary?sessionID=session-1", "/item?sessionID=session-1&itemId=system:0"];

  for (const path of paths) {
    const unauthorized = await fetch(`${base}${path}`);
    expect(unauthorized.status).toBe(401);

    const authorized = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(authorized.status).toBe(404);
    expect(await authorized.json()).toEqual({ error: "no_snapshot" });
  }
});

test("Service 通过 discovery 报告 Collector 已连接及版本", async () => {
  collector = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/health") {
        return Response.json({ ok: true, version: COLLECTOR_VERSION });
      }
      return Response.json({ error: "not_found" }, { status: 404 });
    },
  });

  const { base } = await startService(async (dir) => {
    await writeDiscovery(dir, {
      version: COLLECTOR_VERSION,
      port: collector!.port!,
      token: "collector-token",
      pid: 4242,
      startedAt: new Date().toISOString(),
    });
  });

  const response = await fetch(`${base}/health`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    collector: { connected: true, version: COLLECTOR_VERSION },
  });
});
