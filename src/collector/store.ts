import type { SnapshotSummary } from "../shared/types.ts";
import { DEFAULT_WINDOW, finalizeSnapshot, type SnapshotDraft } from "./snapshot.ts";

export const MAX_SESSIONS = 20;

export interface StoredSnapshot {
  /** 单调递增，用来丢弃迟到的异步补齐结果。 */
  id: number;
  draft: SnapshotDraft;
  summary: SnapshotSummary;
}

/**
 * 每个 session 只保留最后一份快照，最多 20 个。
 * 读取不改变顺序；写入才把 session 移到最新，淘汰最久未更新的。
 */
export class SnapshotStore {
  readonly #records = new Map<string, StoredSnapshot>();
  #nextId = 1;

  add(draft: SnapshotDraft): StoredSnapshot {
    const record: StoredSnapshot = {
      id: this.#nextId,
      draft,
      summary: finalizeSnapshot(draft, null, DEFAULT_WINDOW, true),
    };
    this.#nextId += 1;

    this.#records.delete(draft.sessionID);
    this.#records.set(draft.sessionID, record);
    while (this.#records.size > MAX_SESSIONS) {
      const oldest = this.#records.keys().next();
      if (oldest.done) break;
      this.#records.delete(oldest.value);
    }
    return record;
  }

  get(sessionID: string): StoredSnapshot | undefined {
    return this.#records.get(sessionID);
  }

  /** 只有当前记录仍是发起补齐的那一份时才替换。 */
  replace(sessionID: string, id: number, summary: SnapshotSummary): void {
    const current = this.#records.get(sessionID);
    if (!current || current.id !== id) return;
    this.#records.set(sessionID, { ...current, summary });
  }

  get size(): number {
    return this.#records.size;
  }
}
