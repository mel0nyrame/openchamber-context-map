import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeDiscovery } from "../src/shared/discovery.ts";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "context-map-discovery-"));
  dirs.push(dir);
  return dir;
}

test("同一进程并发写 discovery 不会互相抢临时文件", async () => {
  const dir = await tempDir();
  const record = {
    version: "0.1.0",
    port: 45123,
    token: "token",
    pid: 4321,
    startedAt: "2026-10-30T00:00:00.000Z",
  };

  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () => writeDiscovery(dir, record)),
  );
  const rejected = results.filter((result) => result.status === "rejected");
  expect(rejected).toEqual([]);

  const names = await readdir(dir);
  expect(names).toEqual(["collector-4321.json"]);
  expect(JSON.parse(await readFile(join(dir, "collector-4321.json"), "utf8"))).toEqual(record);
});
