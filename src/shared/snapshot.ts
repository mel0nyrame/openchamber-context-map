import {
  CATEGORIES,
  type Category,
  type CategoryUsage,
  type ItemSummary,
  type SnapshotItemDetail,
  type SnapshotSummary,
} from "./types.ts";

/** 面板与 Collector 共用的 Snapshot 解析入口；坏数据统一返回 null。 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

function parseCategoryUsage(value: unknown): CategoryUsage | null {
  if (!isRecord(value)) return null;
  const { category, items, chars, tokens } = value;
  if (
    !isCategory(category)
    || !isFiniteNumber(items)
    || !isFiniteNumber(chars)
    || !isFiniteNumber(tokens)
  ) {
    return null;
  }
  return { category, items, chars, tokens };
}

function parseItemSummary(value: unknown): ItemSummary | null {
  if (!isRecord(value)) return null;
  const { id, title, chars, head } = value;
  if (
    typeof id !== "string"
    || typeof title !== "string"
    || !isFiniteNumber(chars)
    || typeof head !== "string"
  ) {
    return null;
  }
  return { id, title, chars, head };
}

/**
 * 解析一份快照汇总。分类允许 1–8 个（baseline 只有 system 与 toolDefinitions），
 * 但必须互不重复；未知字段被忽略，restored 缺失或不是 true 时规范化为 false。
 */
export function parseSnapshotSummary(value: unknown): SnapshotSummary | null {
  if (!isRecord(value)) return null;
  const {
    sessionID,
    model,
    used,
    window,
    windowAssumed,
    estimated,
    baseline,
    collectedAt,
  } = value;

  if (
    typeof sessionID !== "string"
    || sessionID.length === 0
    || typeof model !== "string"
    || !isFiniteNumber(used)
    || !isFiniteNumber(window)
    || typeof windowAssumed !== "boolean"
    || typeof estimated !== "boolean"
    || typeof baseline !== "boolean"
    || typeof collectedAt !== "string"
    || !Number.isFinite(Date.parse(collectedAt))
  ) {
    return null;
  }

  const rawCategories = value.categories;
  if (
    !Array.isArray(rawCategories)
    || rawCategories.length < 1
    || rawCategories.length > CATEGORIES.length
  ) {
    return null;
  }
  const categories: CategoryUsage[] = [];
  for (const entry of rawCategories) {
    const category = parseCategoryUsage(entry);
    if (!category) return null;
    categories.push(category);
  }
  if (new Set(categories.map((entry) => entry.category)).size !== categories.length) {
    return null;
  }

  const rawItems = value.items;
  if (!Array.isArray(rawItems)) return null;
  const items: ItemSummary[] = [];
  for (const entry of rawItems) {
    const item = parseItemSummary(entry);
    if (!item) return null;
    items.push(item);
  }

  return {
    sessionID,
    model,
    used,
    window,
    windowAssumed,
    estimated,
    baseline,
    restored: value.restored === true,
    collectedAt,
    categories,
    items,
  };
}

/** 解析 /item 的完整预览；空 id/title/text 视为坏数据。 */
export function parseSnapshotItemDetail(value: unknown): SnapshotItemDetail | null {
  if (!isRecord(value)) return null;
  const { id, title, chars, text } = value;
  if (
    typeof id !== "string"
    || id.length === 0
    || typeof title !== "string"
    || title.length === 0
    || !isFiniteNumber(chars)
    || typeof text !== "string"
    || text.length === 0
  ) {
    return null;
  }
  return { id, title, chars, text };
}
