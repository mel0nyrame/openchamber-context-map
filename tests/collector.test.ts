import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import collector from "../src/collector/main.ts";

let discoveryDir: string | undefined;
let dispose: (() => Promise<void> | void) | undefined;

afterEach(async () => {
  await dispose?.();
  dispose = undefined;
  if (discoveryDir) await rm(discoveryDir, { recursive: true, force: true });
  discoveryDir = undefined;
  delete process.env.CONTEXT_MAP_DISCOVERY_DIR;
});

async function startCollector(): Promise<{ port: number; token: string; file: string }> {
  discoveryDir = await mkdtemp(join(tmpdir(), "context-map-collector-"));
  process.env.CONTEXT_MAP_DISCOVERY_DIR = discoveryDir;
  dispose = await collector.setup({});

  const files = (await readdir(discoveryDir)).filter((name) => name.endsWith(".json"));
  expect(files).toHaveLength(1);
  const file = join(discoveryDir, files[0]!);
  const record = JSON.parse(await readFile(file, "utf8")) as { port: number; token: string };
  return { port: record.port, token: record.token, file };
}

test("Collector 启动后提供无需鉴权的 /health，并写入 0600 的 discovery 文件", async () => {
  const { port, file } = await startCollector();

  expect((await stat(file)).mode & 0o777).toBe(0o600);

  const response = await fetch(`http://127.0.0.1:${port}/health`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, version: "0.1.0" });
});

test("Collector 的 /summary 与 /item 拒绝缺失 bearer，合法 bearer 下无快照返回 404", async () => {
  const { port, token } = await startCollector();
  const paths = ["/summary?sessionID=session-1", "/item?sessionID=session-1&itemId=system:0"];

  for (const path of paths) {
    const unauthorized = await fetch(`http://127.0.0.1:${port}${path}`);
    expect(unauthorized.status).toBe(401);

    const wrongToken = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(wrongToken.status).toBe(401);

    const authorized = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(authorized.status).toBe(404);
  }
});

test("Collector dispose 关闭服务并删除 discovery 文件", async () => {
  const { port, file } = await startCollector();
  const cleanup = dispose!;
  dispose = undefined;

  await cleanup();

  await expect(stat(file)).rejects.toThrow();
  await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
});
