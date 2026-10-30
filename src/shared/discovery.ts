import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { DiscoveryRecord } from "./types.ts";
import { DISCOVERY_DIR_ENV } from "./version.ts";

export function resolveDiscoveryDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env[DISCOVERY_DIR_ENV]?.trim();
  if (override) return override;
  return join(homedir(), ".local", "state", "openchamber-context-map", "collectors");
}

export function discoveryFileName(pid: number): string {
  return `collector-${pid}.json`;
}

let tempSequence = 0;

export async function writeDiscovery(dir: string, record: DiscoveryRecord): Promise<string> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);

  const file = join(dir, discoveryFileName(record.pid));
  // 同一进程可能并发 setup（宿主重载），临时名必须唯一，否则 rename 会抢文件。
  tempSequence += 1;
  const temp = `${file}.${process.pid}.${tempSequence}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(record), { mode: 0o600 });
    await chmod(temp, 0o600);
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
  return file;
}

export async function removeDiscovery(file: string): Promise<void> {
  await rm(file, { force: true });
}

function isDiscoveryRecord(value: unknown): value is DiscoveryRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.version === "string"
    && typeof record.port === "number"
    && Number.isInteger(record.port)
    && record.port > 0
    && record.port <= 65_535
    && typeof record.token === "string"
    && typeof record.pid === "number"
    && typeof record.startedAt === "string";
}

export interface DiscoveryEntry {
  file: string;
  record: DiscoveryRecord;
}

/** 读取目录里所有可解析的 discovery 条目，最新的排在前面。 */
export async function readDiscoveryEntries(dir: string): Promise<DiscoveryEntry[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  const entries: DiscoveryEntry[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const file = join(dir, name);
    try {
      const value: unknown = JSON.parse(await readFile(file, "utf8"));
      if (isDiscoveryRecord(value)) entries.push({ file, record: value });
    } catch {
      // 写了一半或损坏的记录直接忽略。
    }
  }

  return entries.sort(
    (a, b) => Date.parse(b.record.startedAt) - Date.parse(a.record.startedAt),
  );
}

/** 读取目录里所有可解析的 discovery 记录，最新的排在前面。 */
export async function readDiscoveryRecords(dir: string): Promise<DiscoveryRecord[]> {
  return (await readDiscoveryEntries(dir)).map((entry) => entry.record);
}
