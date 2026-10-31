/**
 * 面板的纯格式化。
 *
 * 这里不碰 DOM、不读当前时间、不调用 `t`，也不依赖模型或视图类型；
 * `intlLocale` 把面板的两种 locale 映射成 Intl 标签。
 */

import type { Locale } from "./i18n.ts";

/** 面板 locale 对应的 Intl 标签；数字和日期格式化共用。 */
export function intlLocale(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en-US";
}

/** 按 locale 格式化整数。 */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
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
