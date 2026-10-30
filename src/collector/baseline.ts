import type { Category, CategoryUsage, SnapshotSummary } from "../shared/types.ts";
import { modelRefID, type ModelRef } from "./opencode.ts";
import { CHARS_PER_TOKEN, type SnapshotDraft, type SnapshotItem } from "./snapshot.ts";

/** 最多保留 5 个 agent + model 组合的模板。 */
export const MAX_BASELINES = 5;

const BASELINE_CATEGORIES: Category[] = ["system", "toolDefinitions"];

export interface BaselineTemplate {
  agent: string;
  model: string;
  modelRef: ModelRef;
  collectedAt: string;
  items: SnapshotItem[];
}

/** agent 与 model 共同决定请求装配；缺一不可。 */
export function baselineKey(agent: string, ref: ModelRef): string {
  return `${agent}\u0000${ref.providerID}/${modelRefID(ref)}`;
}

export class BaselineStore {
  readonly #templates = new Map<string, BaselineTemplate>();

  /** 按写入顺序淘汰；重复写入会刷新 LRU 位置。 */
  remember(agent: string, draft: SnapshotDraft): void {
    const key = baselineKey(agent, draft.modelRef);
    this.#templates.delete(key);
    this.#templates.set(key, {
      agent,
      model: draft.model,
      modelRef: draft.modelRef,
      collectedAt: draft.collectedAt,
      items: draft.items,
    });
    while (this.#templates.size > MAX_BASELINES) {
      const oldest = this.#templates.keys().next().value;
      if (oldest === undefined) break;
      this.#templates.delete(oldest);
    }
  }

  get(agent: string, ref: ModelRef): BaselineTemplate | undefined {
    return this.#templates.get(baselineKey(agent, ref));
  }

  get size(): number {
    return this.#templates.size;
  }
}

/** 基线只有 system 与工具定义两类，token 由字符数估算。 */
export function baselineSummary(
  template: BaselineTemplate,
  sessionID: string,
  window: number,
  windowAssumed: boolean,
): SnapshotSummary {
  const categories: CategoryUsage[] = BASELINE_CATEGORIES.map((category) => {
    const items = template.items.filter((item) => item.category === category);
    const chars = items.reduce((sum, item) => sum + item.chars, 0);
    return {
      category,
      items: items.length,
      chars,
      tokens: Math.ceil(chars / CHARS_PER_TOKEN),
    };
  });
  const used = categories.reduce((sum, category) => sum + category.tokens, 0);

  return {
    sessionID,
    model: template.model,
    used,
    window,
    windowAssumed,
    estimated: true,
    baseline: true,
    collectedAt: template.collectedAt,
    categories,
    items: template.items.map(({ id, title, chars, head }) => ({ id, title, chars, head })),
  };
}
