import { CATEGORIES, type Category } from "../shared/types.ts";

export type ThemeMode = "light" | "dark";

/**
 * 降饱和分类色板。浅色用于 `data-oc-theme="light"`，深色用于 `dark`；
 * 颜色只出现在色块、圆点和地图格子上，分类名称仍用正文色。
 */
export const PALETTES: Record<ThemeMode, Record<Category, string>> = {
  light: {
    system: "#4a6588",
    toolDefinitions: "#3d7a6e",
    userMessages: "#96683c",
    assistantText: "#4b7a4b",
    reasoning: "#705d8c",
    toolCalls: "#96536a",
    toolResults: "#3f7484",
    other: "#6b7280",
  },
  dark: {
    system: "#8fa8c8",
    toolDefinitions: "#7fb8a8",
    userMessages: "#c8a878",
    assistantText: "#8fbf8f",
    reasoning: "#a898c8",
    toolCalls: "#c88fa0",
    toolResults: "#88b8c8",
    other: "#9aa3ad",
  },
};

/** Free space 不是分类，用中性色；同样需要满足 3:1 的图形对比度。 */
export const FREE_COLORS: Record<ThemeMode, string> = {
  light: "#7a828c",
  dark: "#6b7785",
};

/**
 * 对比度校验用的保守背景近似：页面底色，以及卡片 4% 前景叠加后的底色。
 * 实际 host 主题可能略有差异，取更接近中灰的一侧留出余量。
 */
export const BACKGROUNDS: Record<ThemeMode, { page: string; surface: string }> = {
  light: { page: "#ffffff", surface: "#f0f1f3" },
  dark: { page: "#0f1216", surface: "#1c2026" },
};

function channel(hex: string, offset: number): number {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG 相对亮度；只接受 `#rrggbb`。 */
export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  return 0.2126 * channel(value, 0) + 0.7152 * channel(value, 2) + 0.0722 * channel(value, 4);
}

/** WCAG 对比度，返回 1..21。 */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function paletteVariables(mode: ThemeMode): string {
  const palette = PALETTES[mode];
  const values = CATEGORIES.map((category) => `--cat-${category}: ${palette[category]};`);
  return `${values.join(" ")} --cat-free: ${FREE_COLORS[mode]};`;
}

/**
 * 色板写成静态 CSS，由 `data-oc-theme` 选择器切换；面板不读系统偏好。
 * 没有属性时按浅色处理，方便 host 之外的预览。
 */
export function paletteCss(): string {
  return `
:root, :root[data-oc-theme="light"] { ${paletteVariables("light")} }
:root[data-oc-theme="dark"] { ${paletteVariables("dark")} }
`;
}
