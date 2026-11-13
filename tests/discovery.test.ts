import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { removeDiscovery, writeDiscovery } from "../src/shared/discovery.ts";

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

test("removeDiscovery 只删除仍属于该实例的记录", async () => {
  const dir = await tempDir();
  const mine = {
    version: "0.2.0",
    port: 45123,
    token: "mine",
    pid: 4321,
    startedAt: "2026-10-30T00:00:00.000Z",
  };
  const file = await writeDiscovery(dir, mine);

  // 同进程的新实例接管了同一个路径：旧实例退出时不能删掉它。
  const newer = { ...mine, port: 45124, token: "newer", startedAt: "2026-10-30T00:00:05.000Z" };
  await writeFile(file, JSON.stringify(newer));

  await removeDiscovery(file, mine);
  expect(JSON.parse(await readFile(file, "utf8"))).toEqual(newer);

  await removeDiscovery(file, newer);
  await expect(readFile(file, "utf8")).rejects.toThrow();

  // 文件已不存在时不报错。
  await removeDiscovery(file, newer);
});
