import type { SnapshotItemDetail, SnapshotSummary } from "../shared/types.ts";
import { baselineSummary, type BaselineStore, type BaselineTemplate } from "./baseline.ts";
import { modelRefID, type ModelRef, type SessionInfo } from "./opencode.ts";
import { DEFAULT_WINDOW, type SnapshotItem } from "./snapshot.ts";
import type { SnapshotStore } from "./store.ts";

/** 窗口查询结果；异常时由 Resolver 回退到 DEFAULT_WINDOW / assumed。 */
export interface ResolvedWindow {
  window: number;
  assumed: boolean;
}

export interface SnapshotResolverDeps {
  store: Pick<SnapshotStore, "get">;
  baselines: Pick<BaselineStore, "get">;
  /** 入口包装 context.session.get；没有 API 或抛错时返回 null。 */
  loadSession: (sessionID: string) => Promise<SessionInfo | null>;
  /** 入口包装 WindowResolver.resolve。 */
  resolveWindow: (ref: ModelRef) => Promise<ResolvedWindow>;
}

function itemDetail(item: SnapshotItem): SnapshotItemDetail {
  return { id: item.id, title: item.title, chars: item.chars, text: item.text };
}

/**
 * Collector 的只读查找规则：当前记录优先，没有当前记录时才查 baseline 模板。
 * 不碰 HTTP、鉴权、discovery 或持久化；null 统一表示「没有找到」。
 */
export class SnapshotResolver {
  readonly #store: Pick<SnapshotStore, "get">;
  readonly #baselines: Pick<BaselineStore, "get">;
  readonly #loadSession: (sessionID: string) => Promise<SessionInfo | null>;
  readonly #resolveWindow: (ref: ModelRef) => Promise<ResolvedWindow>;

  constructor(deps: SnapshotResolverDeps) {
    this.#store = deps.store;
    this.#baselines = deps.baselines;
    this.#loadSession = deps.loadSession;
    this.#resolveWindow = deps.resolveWindow;
  }

  async resolveSummary(sessionID: string): Promise<SnapshotSummary | null> {
    if (!sessionID) return null;
    const record = this.#store.get(sessionID);
    if (record) return record.summary;

    const template = await this.#baselineTemplate(sessionID);
    if (!template) return null;

    const resolved = await this.#resolveWindow(template.modelRef).catch(() => ({
      window: DEFAULT_WINDOW,
      assumed: true,
    }));
    return baselineSummary(template, sessionID, resolved.window, resolved.assumed);
  }

  async resolveItem(sessionID: string, itemID: string): Promise<SnapshotItemDetail | null> {
    if (!sessionID || !itemID) return null;

    const record = this.#store.get(sessionID);
    if (record) {
      // 恢复的记录没有 draft：正文没有落盘，不回退 baseline。
      if (!record.draft) return null;
      const item = record.draft.items.find((candidate) => candidate.id === itemID);
      return item ? itemDetail(item) : null;
    }

    const template = await this.#baselineTemplate(sessionID);
    const item = template?.items.find((candidate) => candidate.id === itemID);
    return item ? itemDetail(item) : null;
  }

  /** 当前会话的 agent + model 决定模板；缺一不可，查询失败按没有 baseline 处理。 */
  async #baselineTemplate(sessionID: string): Promise<BaselineTemplate | null> {
    const info = await this.#loadSession(sessionID).catch(() => null);
    const agent = typeof info?.agent === "string" ? info.agent : "";
    const ref = info?.model;
    if (!agent || !ref || typeof ref.providerID !== "string" || !modelRefID(ref)) {
      return null;
    }
    return this.#baselines.get(agent, ref) ?? null;
  }
}
