import type { Category, ItemSummary } from "../shared/types.ts";

/** Preview 最多展示的字符数；Collector 已截断，面板再防御一次。 */
export const PREVIEW_MAX_CHARS = 8_000;

/** 面板当前的钻取层级。 */
export type PanelLayer = "overview" | "items" | "preview";

/**
 * 由选中的分类和打开的条目推导层级。
 * 分类是条目列表的上下文，条目存在时一定处于 Preview。
 */
export function layerOf(category: Category | null, itemId: string | null): PanelLayer {
  if (itemId !== null) return "preview";
  return category === null ? "overview" : "items";
}

/** Esc 每次退一层：Preview → 条目列表，条目列表 → 分类总览。 */
export function escapeTarget(layer: PanelLayer): PanelLayer {
  return layer === "preview" ? "items" : "overview";
}

/**
 * 在当前列表内移动焦点。越界时停在首尾，不循环；
 * 没有当前焦点时，向下从第一条开始，向上从最后一条开始。
 */
export function moveFocus(current: number, count: number, delta: number): number {
  if (count <= 0) return -1;
  if (current < 0) return delta < 0 ? count - 1 : 0;
  return Math.min(count - 1, Math.max(0, current + delta));
}

/**
 * 重新渲染列表后决定焦点落在哪一条：优先保留同一个 itemId，
 * 条目已被替换时退回原来的下标（越界则夹到边界）。
 */
export function focusIndexFor(
  items: readonly Pick<ItemSummary, "id">[],
  itemId: string | null,
  fallbackIndex: number,
): number {
  if (items.length === 0) return -1;
  if (itemId !== null) {
    const found = items.findIndex((item) => item.id === itemId);
    if (found >= 0) return found;
  }
  return Math.min(items.length - 1, Math.max(0, fallbackIndex));
}

/** 面板侧截断，保证即使 Service 返回超长文本也不会撑爆预览。 */
export function clipPreviewText(text: string): string {
  return text.length > PREVIEW_MAX_CHARS ? text.slice(0, PREVIEW_MAX_CHARS) : text;
}

/**
 * 只有原始字符数超过上限、且实际展示到了上限时才算截断。
 * 服务端的 chars 与实际文本长度可能因换行等细节略有出入，不能直接比较两者。
 */
export function previewTruncated(chars: number, shownChars: number): boolean {
  return Number.isFinite(chars)
    && chars > PREVIEW_MAX_CHARS
    && shownChars >= PREVIEW_MAX_CHARS
    && chars > shownChars;
}
