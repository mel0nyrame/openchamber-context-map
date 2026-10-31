import { chmod, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { CATEGORIES, type CategoryUsage, type ItemSummary, type SnapshotSummary } from "../shared/types.ts";
import { DISCOVERY_DIR_ENV } from "../shared/version.ts";

/** 结构变更时加一，旧文件直接丢弃。 */
export const SNAPSHOT_SCHEMA_VERSION = 1;
export const MAX_SNAPSHOTS = 20;
export const MAX_SNAPSHOT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const SNAPSHOT_WRITE_DELAY_MS = 300;
export const PERSIST_ENV = "CONTEXT_MAP_PERSIST";
export const SNAPSHOT_DIR_ENV = "CONTEXT_MAP_SNAPSHOT_DIR";

interface SnapshotFile {
  schemaVersion: number;
  summary: SnapshotSummary;
}

export function persistenceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[PERSIST_ENV]?.trim().toLowerCase();
  return value !== "0" && value !== "false" && value !== "off";
}

/** 默认与 discovery 同级；开发期覆盖 discovery 目录时放在它下面。 */
export function resolveSnapshotDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env[SNAPSHOT_DIR_ENV]?.trim();
  if (override) return override;
  const discovery = env[DISCOVERY_DIR_ENV]?.trim();
  if (discovery) return join(discovery, "snapshots");
  return join(homedir(), ".local", "state", "openchamber-context-map", "snapshots");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isItemSummary(value: unknown): value is ItemSummary {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.title === "string"
    && isFiniteNumber(value.chars)
    && typeof value.head === "string";
}

function isCategoryUsage(value: unknown): value is CategoryUsage {
  if (!isRecord(value)) return false;
  return typeof value.category === "string"
    && (CATEGORIES as readonly string[]).includes(value.category)
    && isFiniteNumber(value.items)
    && isFiniteNumber(value.chars)
    && isFiniteNumber(value.tokens);
}

function isSnapshotSummary(value: unknown): value is SnapshotSummary {
  if (!isRecord(value)) return false;
  return typeof value.sessionID === "string"
    && value.sessionID.length > 0
    && typeof value.model === "string"
    && isFiniteNumber(value.used)
    && isFiniteNumber(value.window)
    && typeof value.windowAssumed === "boolean"
    && typeof value.estimated === "boolean"
    && typeof value.baseline === "boolean"
    && typeof value.collectedAt === "string"
    && Number.isFinite(Date.parse(value.collectedAt))
    && Array.isArray(value.categories)
    && value.categories.length === CATEGORIES.length
    && value.categories.every(isCategoryUsage)
    && Array.isArray(value.items)
    && value.items.every(isItemSummary);
}

function snapshotFileName(sessionID: string): string {
  return `${sessionID.replace(/[^A-Za-z0-9._-]/g, "_")}.json`;
}

async function readSnapshotFile(file: string): Promise<SnapshotSummary | null> {
  try {
    const value: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!isRecord(value) || value.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return null;
    return isSnapshotSummary(value.summary) ? value.summary : null;
  } catch {
    return null;
  }
}

/** 读取并清理：版本不符、损坏、超过 7 天、超出 20 个的文件都会删掉。 */
export async function readSnapshots(dir: string, now = Date.now()): Promise<SnapshotSummary[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  const kept: Array<{ summary: SnapshotSummary; file: string }> = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const file = join(dir, name);
    const summary = await readSnapshotFile(file);
    if (!summary || now - Date.parse(summary.collectedAt) > MAX_SNAPSHOT_AGE_MS) {
      await rm(file, { force: true });
      continue;
    }
    kept.push({ summary, file });
  }

  kept.sort((a, b) => Date.parse(b.summary.collectedAt) - Date.parse(a.summary.collectedAt));
  for (const extra of kept.slice(MAX_SNAPSHOTS)) {
    await rm(extra.file, { force: true });
  }
  return kept.slice(0, MAX_SNAPSHOTS).map((entry) => entry.summary);
}

let tempSequence = 0;

export async function writeSnapshot(dir: string, summary: SnapshotSummary): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);

  const file = join(dir, snapshotFileName(summary.sessionID));
  const body = JSON.stringify({ schemaVersion: SNAPSHOT_SCHEMA_VERSION, summary });
  tempSequence += 1;
  const temp = `${file}.${process.pid}.${tempSequence}.tmp`;
  try {
    await writeFile(temp, body, { mode: 0o600 });
    await chmod(temp, 0o600);
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

/** 按写入时间保留最近 20 个文件。 */
export async function pruneSnapshots(dir: string): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }

  const files: Array<{ file: string; mtime: number }> = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const file = join(dir, name);
    try {
      const info = await stat(file);
      files.push({ file, mtime: info.mtimeMs });
    } catch {
      // 刚被别的写入删掉，忽略。
    }
  }

  files.sort((a, b) => b.mtime - a.mtime);
  for (const extra of files.slice(MAX_SNAPSHOTS)) {
    await rm(extra.file, { force: true });
  }
}

/** 异步补齐之后按 session 去抖写入；hook 里不碰 I/O。 */
export class SnapshotWriter {
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #pending = new Map<string, SnapshotSummary>();

  constructor(private readonly dir: string | null) {}

  schedule(summary: SnapshotSummary): void {
    if (!this.dir) return;
    this.#pending.set(summary.sessionID, summary);
    const existing = this.#timers.get(summary.sessionID);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      void this.#flushOne(summary.sessionID);
    }, SNAPSHOT_WRITE_DELAY_MS);
    timer.unref?.();
    this.#timers.set(summary.sessionID, timer);
  }

  async flush(): Promise<void> {
    await Promise.all([...this.#pending.keys()].map((sessionID) => this.#flushOne(sessionID)));
  }

  async dispose(): Promise<void> {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    await this.flush();
  }

  async #flushOne(sessionID: string): Promise<void> {
    const timer = this.#timers.get(sessionID);
    if (timer) clearTimeout(timer);
    this.#timers.delete(sessionID);
    const summary = this.#pending.get(sessionID);
    this.#pending.delete(sessionID);
    if (!this.dir || !summary) return;
    try {
      await writeSnapshot(this.dir, summary);
      await pruneSnapshots(this.dir);
    } catch {
      // 持久化失败不影响面板；下次写入会再试。
    }
  }
}
