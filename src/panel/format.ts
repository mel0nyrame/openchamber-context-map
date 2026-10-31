/**
 * 面板的纯格式化与重建签名。
 *
 * 这里不碰 DOM、不读当前时间、不调用 `t`；`formatNumber` 只按传入的
 * locale 选择数字格式。视图负责把结果拼进 DOM。
 */

import type { SnapshotSummary } from "../shared/types.ts";
import type { Locale } from "./i18n.ts";
import type { PanelView, PanelZoom } from "./model.ts";

/** 按 locale 格式化整数。 */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US").format(value);
}

/** 百分比最多保留一位小数，整数不带 `.0`。 */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** 1k/10k 两档紧凑数字：1k–9.9k 保留一位，10k 起取整。 */
export function compactNumber(value: number): string {
  const safe = Math.max(0, Math.round(value));
  if (safe < 1000) return String(safe);
  const scaled = safe / 1000;
  const digits = scaled >= 10 ? 0 : 1;
  return `${scaled.toFixed(digits).replace(/\.0$/, "")}k`;
}

/** CSS 渐变停靠点用的百分比，最多三位小数。 */
export function roundPercent(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** 版本标签统一带 `v` 前缀。 */
export function versionLabel(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

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
