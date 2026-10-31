import type { SnapshotSummary } from "../shared/types.ts";
import { DEFAULT_WINDOW, finalizeSnapshot, type SnapshotDraft } from "./snapshot.ts";

export const MAX_SESSIONS = 20;

export interface StoredSnapshot {
  /** 单调递增，用来丢弃迟到的异步补齐结果。 */
  id: number;
  /** 从磁盘恢复的快照没有 draft：正文预览没有持久化。 */
  draft: SnapshotDraft | null;
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
    const id = this.#nextId;
    this.#nextId += 1;
    // 条目 id 带上快照版本：旧 id 在新快照里一定找不到，Service 会返回 404。
    const stamped: SnapshotDraft = {
      ...draft,
      items: draft.items.map((item) => ({ ...item, id: `${item.id}@${id}` })),
    };
    const record: StoredSnapshot = {
      id,
      draft: stamped,
      summary: finalizeSnapshot(stamped, null, DEFAULT_WINDOW, true),
    };

    this.#records.delete(draft.sessionID);
    this.#records.set(draft.sessionID, record);
    this.#trim();
    return record;
  }

  /** 启动时读回上一份快照；没有 draft，/item 自然返回 404。 */
  restore(summary: SnapshotSummary): StoredSnapshot {
    const id = this.#nextId;
    this.#nextId += 1;
    const record: StoredSnapshot = {
      id,
      draft: null,
      summary: { ...summary, restored: true },
    };
    this.#records.delete(summary.sessionID);
    this.#records.set(summary.sessionID, record);
    this.#trim();
    return record;
  }

  get(sessionID: string): StoredSnapshot | undefined {
    return this.#records.get(sessionID);
  }

  /** 只有当前记录仍是发起补齐的那一份时才替换。 */
  replace(sessionID: string, id: number, summary: SnapshotSummary): SnapshotSummary | undefined {
    const current = this.#records.get(sessionID);
    if (!current || current.id !== id) return undefined;
    this.#records.set(sessionID, { ...current, summary });
    return summary;
  }

  get size(): number {
    return this.#records.size;
  }

  #trim(): void {
    while (this.#records.size > MAX_SESSIONS) {
      const oldest = this.#records.keys().next();
      if (oldest.done) break;
      this.#records.delete(oldest.value);
    }
  }
}
