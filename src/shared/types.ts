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
  estimated: boolean;
  collectedAt: string;
  categories: CategoryUsage[];
  items: ItemSummary[];
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
}
