/** 8 个分类，顺序与面板分类账一致。 */
export const CATEGORIES = [
  "system",
  "toolDefinitions",
  "userMessages",
  "assistantText",
  "reasoning",
  "toolCalls",
  "toolResults",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** 分类的汇总数字，供分类账和地图使用。 */
export interface CategoryUsage {
  category: Category;
  items: number;
  chars: number;
  tokens: number;
}

/** 条目的轻量描述；head 最多 200 字符，完整预览只走 /item。 */
export interface ItemSummary {
  id: string;
  title: string;
  chars: number;
  head: string;
}

/** 一份快照的汇总骨架，T02 起填充真实数据。 */
export interface SnapshotSummary {
  sessionID: string;
  model: string;
  used: number;
  window: number;
  /** 窗口不是来自模型信息，而是按默认值估算。 */
  windowAssumed: boolean;
  estimated: boolean;
  /** 该 session 尚无真实快照，内容取自最近一次请求的 system + 工具定义模板。 */
  baseline: boolean;
  collectedAt: string;
  categories: CategoryUsage[];
  items: ItemSummary[];
}

/** /item 返回的单条完整预览。 */
export interface SnapshotItemDetail {
  id: string;
  title: string;
  chars: number;
  text: string;
}

/** Collector 写入 discovery 文件的记录。 */
export interface DiscoveryRecord {
  version: string;
  port: number;
  token: string;
  pid: number;
  startedAt: string;
}

/** Service 向面板报告的 Collector 连接状态。 */
export interface CollectorStatus {
  connected: boolean;
  version?: string;
  reason?: "not_found" | "unreachable";
  /** Collector 报告的版本与扩展期望不一致。 */
  outdated?: boolean;
  expectedVersion?: string;
}
