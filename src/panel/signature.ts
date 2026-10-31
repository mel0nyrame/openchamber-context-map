/**
 * 视图缓存的重建签名。
 *
 * 签名只根据模型数据生成字符串，视图拿它判断地图或明细区是否需要重建；
 * 这里不碰 DOM，也不读时间。
 */

import type { SnapshotSummary } from "../shared/types.ts";
import type { PanelView, PanelZoom } from "./model.ts";

/** 地图重建签名：只覆盖地图绘制需要的字段。 */
export function snapshotSignature(summary: SnapshotSummary, zoom: PanelZoom): string {
  return [
    summary.sessionID,
    summary.collectedAt,
    summary.used,
    summary.window,
    zoom,
    summary.categories.map((usage) => `${usage.category}:${usage.items}:${usage.tokens}`).join(","),
    summary.items.length,
  ].join("|");
}

/** 明细区重建签名：预览只看预览字段，列表看列表、选择、层级与提示。 */
export function breakdownSignature(view: PanelView): string {
  const preview = view.preview;
  if (preview !== null) {
    return [
      "preview",
      preview.itemId,
      preview.category,
      preview.title,
      preview.chars,
      preview.text,
      preview.loading,
      preview.error ?? "",
      preview.truncated,
      view.notice ?? "",
    ].join("|");
  }
  const summary = view.summary;
  return [
    "list",
    summary?.sessionID ?? "",
    summary?.collectedAt ?? "",
    summary?.used ?? 0,
    summary?.window ?? 0,
    summary?.categories.map((usage) => `${usage.category}:${usage.items}:${usage.tokens}`).join(",") ?? "",
    summary?.items.map((item) => `${item.id}:${item.title}:${item.chars}`).join(",") ?? "",
    view.selectedCategory ?? "",
    view.layer,
    view.notice ?? "",
  ].join("|");
}
