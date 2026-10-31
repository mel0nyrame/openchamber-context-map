import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MAX_SNAPSHOTS,
  MAX_SNAPSHOT_AGE_MS,
  persistenceEnabled,
  readSnapshots,
  resolveSnapshotDir,
  writeSnapshot,
} from "../src/collector/persist.ts";
import { CATEGORIES, type SnapshotSummary } from "../src/shared/types.ts";

let dir: string | undefined;

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

function summary(sessionID: string, collectedAt = new Date().toISOString()): SnapshotSummary {
  return {
    sessionID,
    model: "anthropic/claude-sonnet-4-5",
    used: 12_000,
    window: 200_000,
    windowAssumed: false,
    estimated: false,
    baseline: false,
    restored: false,
    collectedAt,
    categories: CATEGORIES.map((category, index) => ({
      category,
      items: index === 0 ? 1 : 0,
      chars: index === 0 ? 400 : 0,
      tokens: index === 0 ? 100 : 0,
    })),
    items: [{ id: "system:0@1", title: "System", chars: 400, head: "S".repeat(200) }],
  };
}

async function makeDir(): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), "context-map-persist-"));
  return dir;
}

test("写入后读回同一份骨架，目录 0700、文件 0600", async () => {
  const root = await makeDir();
  const input = summary("ses_one");

  await writeSnapshot(root, input);

  expect((await stat(root)).mode & 0o777).toBe(0o700);
  expect((await stat(join(root, "ses_one.json"))).mode & 0o777).toBe(0o600);
  expect(await readSnapshots(root)).toEqual([input]);
});

test("版本不符、损坏与超过 7 天的文件会被删除", async () => {
  const root = await makeDir();
  const old = new Date(Date.now() - MAX_SNAPSHOT_AGE_MS - 60_000).toISOString();

  await writeSnapshot(root, summary("ses_old", old));
  await writeFile(join(root, "ses_bad.json"), "{not json", "utf8");
  await writeFile(
    join(root, "ses_v2.json"),
    JSON.stringify({ schemaVersion: 2, summary: summary("ses_v2") }),
    "utf8",
  );

  expect(await readSnapshots(root)).toEqual([]);
  expect(await readdir(root)).toEqual([]);
});

test("旧文件缺少 restored 时按 false 读回", async () => {
  const root = await makeDir();
  const { restored: _restored, ...legacy } = summary("ses_legacy");
  await writeFile(
    join(root, "ses_legacy.json"),
    JSON.stringify({ schemaVersion: 1, summary: legacy }),
    "utf8",
  );

  const [loaded] = await readSnapshots(root);
  expect(loaded?.restored).toBe(false);
});

test("重复分类的持久化汇总被丢弃", async () => {
  const root = await makeDir();
  const input = summary("ses_duplicate");
  input.categories = input.categories.map(() => input.categories[0]!);
  await writeFile(
    join(root, "ses_duplicate.json"),
    JSON.stringify({ schemaVersion: 1, summary: input }),
    "utf8",
  );

  expect(await readSnapshots(root)).toEqual([]);
  expect(await readdir(root)).toEqual([]);
});

test("分类数不是 8 的汇总文件被丢弃，baseline 的 2 分类不落盘", async () => {
  const root = await makeDir();
  const input = summary("ses_baseline");
  input.baseline = true;
  input.categories = input.categories.slice(0, 2);
  await writeFile(
    join(root, "ses_baseline.json"),
    JSON.stringify({ schemaVersion: 1, summary: input }),
    "utf8",
  );

  expect(await readSnapshots(root)).toEqual([]);
  expect(await readdir(root)).toEqual([]);
});

test("超过 20 份时按采集时间保留最新的", async () => {
  const root = await makeDir();
  const base = Date.now() - 60 * 60 * 1000;
  for (let index = 0; index < MAX_SNAPSHOTS + 5; index += 1) {
    const at = new Date(base + index * 60_000).toISOString();
    await writeSnapshot(root, summary(`ses_${String(index).padStart(2, "0")}`, at));
  }

  const kept = await readSnapshots(root);
  expect(kept).toHaveLength(MAX_SNAPSHOTS);
  expect(kept[0]!.sessionID).toBe(`ses_${String(MAX_SNAPSHOTS + 4).padStart(2, "0")}`);
  expect(await readdir(root)).toHaveLength(MAX_SNAPSHOTS);
});

test("写入的 JSON 带 schemaVersion 与完整 summary", async () => {
  const root = await makeDir();
  const input = summary("ses_shape");
  await writeSnapshot(root, input);

  const parsed = JSON.parse(await readFile(join(root, "ses_shape.json"), "utf8")) as {
    schemaVersion: number;
    summary: SnapshotSummary;
  };
  expect(parsed.schemaVersion).toBe(1);
  expect(parsed.summary).toEqual(input);
});

test("persistenceEnabled 接受 0/false/off 关闭", () => {
  expect(persistenceEnabled({})).toBe(true);
  expect(persistenceEnabled({ CONTEXT_MAP_PERSIST: "1" })).toBe(true);
  for (const value of ["0", "false", "off", " OFF "]) {
    expect(persistenceEnabled({ CONTEXT_MAP_PERSIST: value })).toBe(false);
  }
});

test("resolveSnapshotDir 优先显式目录，其次 discovery 目录", () => {
  expect(resolveSnapshotDir({ CONTEXT_MAP_SNAPSHOT_DIR: "/tmp/snap" })).toBe("/tmp/snap");
  expect(resolveSnapshotDir({ CONTEXT_MAP_DISCOVERY_DIR: "/tmp/collectors" })).toBe(
    "/tmp/collectors/snapshots",
  );
  expect(resolveSnapshotDir({})).toContain(join(".local", "state", "openchamber-context-map", "snapshots"));
});
