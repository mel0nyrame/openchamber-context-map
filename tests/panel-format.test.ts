import { describe, expect, test } from "bun:test";

import {
  breakdownSignature,
  compactNumber,
  formatNumber,
  formatPercent,
  pad2,
  roundPercent,
  snapshotSignature,
  versionLabel,
} from "../src/panel/format.ts";
import type { PanelView, PanelZoom, PreviewState } from "../src/panel/model.ts";
import { initialRefreshState } from "../src/panel/refresh.ts";
import type { SnapshotSummary } from "../src/shared/types.ts";

function makeSummary(overrides: Partial<SnapshotSummary> = {}): SnapshotSummary {
  return {
    sessionID: "session-a",
    model: "claude-sonnet",
    used: 12_345,
    window: 200_000,
    windowAssumed: false,
    estimated: false,
    baseline: false,
    restored: false,
    collectedAt: "2026-10-31T10:20:30.000Z",
    categories: [
      { category: "system", items: 2, chars: 900, tokens: 8_000 },
      { category: "userMessages", items: 3, chars: 1_200, tokens: 4_345 },
    ],
    items: [
      { id: "system:0", title: "System prompt", chars: 500, head: "" },
      { id: "userMessages:0", title: "Hello", chars: 400, head: "" },
    ],
    ...overrides,
  };
}

function makeView(overrides: Partial<PanelView> = {}): PanelView {
  const summary = makeSummary();
  return {
    status: { kind: "checking" },
    body: { kind: "summary", summary },
    sessionID: summary.sessionID,
    summary,
    refresh: {
      state: initialRefreshState(),
      inFlight: false,
      manualLoading: false,
      hasLoaded: false,
    },
    selectedCategory: null,
    layer: "overview",
    items: [],
    layout: null,
    breakdown: null,
    zoom: "window",
    preview: null,
    focus: { itemId: null, fallback: 0 },
    notice: null,
    ...overrides,
  };
}

function categoriesWith(
  key: "items" | "tokens",
  value: number,
): SnapshotSummary["categories"] {
  return [
    {
      category: "system",
      items: key === "items" ? value : 2,
      chars: 900,
      tokens: key === "tokens" ? value : 8_000,
    },
    { category: "userMessages", items: 3, chars: 1_200, tokens: 4_345 },
  ];
}

describe("formatNumber", () => {
  const cases: Array<{ locale: "en" | "zh"; value: number; expected: string }> = [
    { locale: "en", value: 0, expected: "0" },
    { locale: "en", value: 999, expected: "999" },
    { locale: "en", value: 1_234, expected: "1,234" },
    { locale: "en", value: 1_234_567, expected: "1,234,567" },
    { locale: "zh", value: 0, expected: "0" },
    { locale: "zh", value: 999, expected: "999" },
    { locale: "zh", value: 1_234, expected: "1,234" },
    { locale: "zh", value: 1_234_567, expected: "1,234,567" },
  ];

  for (const { locale, value, expected } of cases) {
    test(`${locale} 把 ${value} 格式化为 ${expected}`, () => {
      expect(formatNumber(value, locale)).toBe(expected);
    });
  }
});

describe("formatPercent", () => {
  const cases: Array<{ value: number; expected: string }> = [
    { value: 0, expected: "0" },
    { value: 42, expected: "42" },
    { value: 42.04, expected: "42" },
    { value: 42.05, expected: "42.1" },
    { value: 42.44, expected: "42.4" },
    { value: 42.45, expected: "42.5" },
    { value: 99.99, expected: "100" },
    { value: 100, expected: "100" },
    { value: 0.04, expected: "0" },
    { value: 0.05, expected: "0.1" },
  ];

  for (const { value, expected } of cases) {
    test(`把 ${value} 舍入为 ${expected}`, () => {
      expect(formatPercent(value)).toBe(expected);
    });
  }
});

describe("compactNumber", () => {
  const cases: Array<{ value: number; expected: string }> = [
    { value: 0, expected: "0" },
    { value: 999, expected: "999" },
    { value: 999.6, expected: "1k" },
    { value: 1_000, expected: "1k" },
    { value: 1_500, expected: "1.5k" },
    { value: 9_999, expected: "10k" },
    { value: 10_000, expected: "10k" },
    { value: 10_400, expected: "10k" },
    { value: 10_500, expected: "11k" },
    { value: 12_345, expected: "12k" },
    { value: 999_999, expected: "1000k" },
    { value: -5, expected: "0" },
  ];

  for (const { value, expected } of cases) {
    test(`把 ${value} 压缩为 ${expected}`, () => {
      expect(compactNumber(value)).toBe(expected);
    });
  }
});

describe("roundPercent", () => {
  const cases: Array<{ value: number; expected: string }> = [
    { value: 0, expected: "0" },
    { value: 50, expected: "50" },
    { value: 12.3456, expected: "12.346" },
    { value: 33.3333, expected: "33.333" },
    { value: 99.9999, expected: "100" },
    { value: 0.0004, expected: "0" },
    { value: 12.0004, expected: "12" },
  ];

  for (const { value, expected } of cases) {
    test(`把 ${value} 保留三位小数得到 ${expected}`, () => {
      expect(roundPercent(value)).toBe(expected);
    });
  }
});

describe("pad2", () => {
  const cases: Array<{ value: number; expected: string }> = [
    { value: 0, expected: "00" },
    { value: 5, expected: "05" },
    { value: 9, expected: "09" },
    { value: 10, expected: "10" },
    { value: 59, expected: "59" },
    { value: 100, expected: "100" },
  ];

  for (const { value, expected } of cases) {
    test(`把 ${value} 补齐为 ${expected}`, () => {
      expect(pad2(value)).toBe(expected);
    });
  }
});

describe("versionLabel", () => {
  const cases: Array<{ value: string; expected: string }> = [
    { value: "1.2.3", expected: "v1.2.3" },
    { value: "v1.2.3", expected: "v1.2.3" },
    { value: "0.2.0", expected: "v0.2.0" },
  ];

  for (const { value, expected } of cases) {
    test(`把 ${value} 显示为 ${expected}`, () => {
      expect(versionLabel(value)).toBe(expected);
    });
  }
});

describe("snapshotSignature", () => {
  const base = makeSummary();
  const baseSignature = snapshotSignature(base, "window");

  test("相同摘要与 zoom 产生稳定签名", () => {
    expect(snapshotSignature(makeSummary(), "window")).toBe(baseSignature);
  });

  const cases: Array<{ name: string; summary: SnapshotSummary; zoom?: PanelZoom }> = [
    {
      name: "sessionID",
      summary: makeSummary({ sessionID: "session-b" }),
    },
    {
      name: "collectedAt",
      summary: makeSummary({ collectedAt: "2026-10-31T11:00:00.000Z" }),
    },
    {
      name: "used",
      summary: makeSummary({ used: 12_346 }),
    },
    {
      name: "window",
      summary: makeSummary({ window: 100_000 }),
    },
    {
      name: "zoom",
      summary: makeSummary(),
      zoom: "fit",
    },
    {
      name: "categories tokens",
      summary: makeSummary({ categories: categoriesWith("tokens", 8_001) }),
    },
    {
      name: "categories items",
      summary: makeSummary({ categories: categoriesWith("items", 4) }),
    },
    {
      name: "items 数量",
      summary: makeSummary({
        items: [
          ...base.items,
          { id: "system:1", title: "Extra", chars: 10, head: "" },
        ],
      }),
    },
  ];

  for (const { name, summary, zoom } of cases) {
    test(`随 ${name} 变化`, () => {
      expect(snapshotSignature(summary, zoom ?? "window")).not.toBe(baseSignature);
    });
  }
});

describe("breakdownSignature", () => {
  const baseView = makeView();
  const baseSignature = breakdownSignature(baseView);

  test("相同视图产生稳定签名", () => {
    expect(breakdownSignature(makeView())).toBe(baseSignature);
  });

  const listCases: Array<{ name: string; view: PanelView }> = [
    {
      name: "sessionID",
      view: makeView({ summary: makeSummary({ sessionID: "session-b" }) }),
    },
    {
      name: "collectedAt",
      view: makeView({
        summary: makeSummary({ collectedAt: "2026-10-31T11:00:00.000Z" }),
      }),
    },
    {
      name: "used",
      view: makeView({ summary: makeSummary({ used: 12_346 }) }),
    },
    {
      name: "window",
      view: makeView({ summary: makeSummary({ window: 100_000 }) }),
    },
    {
      name: "categories",
      view: makeView({ summary: makeSummary({ categories: categoriesWith("tokens", 8_001) }) }),
    },
    {
      name: "items",
      view: makeView({
        summary: makeSummary({
          items: [{ id: "system:0", title: "Renamed", chars: 500, head: "" }],
        }),
      }),
    },
    {
      name: "selection",
      view: makeView({ selectedCategory: "system" }),
    },
    {
      name: "layer",
      view: makeView({ layer: "items" }),
    },
    {
      name: "notice",
      view: makeView({ notice: "previewCopied" }),
    },
  ];

  for (const { name, view } of listCases) {
    test(`列表模式随 ${name} 变化`, () => {
      expect(breakdownSignature(view)).not.toBe(baseSignature);
    });
  }

  const preview: PreviewState = {
    itemId: "system:0",
    category: "system",
    title: "System prompt",
    chars: 500,
    text: "hello",
    loading: false,
    error: null,
    truncated: false,
  };
  const previewView = makeView({
    preview,
    selectedCategory: "system",
    layer: "preview",
  });
  const previewSignature = breakdownSignature(previewView);

  test("预览模式与列表模式签名不同", () => {
    expect(previewSignature).not.toBe(baseSignature);
  });

  const previewCases: Array<{ name: string; preview: PreviewState; notice?: PanelView["notice"] }> = [
    { name: "itemId", preview: { ...preview, itemId: "system:1" } },
    { name: "category", preview: { ...preview, category: "userMessages" } },
    { name: "title", preview: { ...preview, title: "Renamed" } },
    { name: "chars", preview: { ...preview, chars: 501 } },
    { name: "text", preview: { ...preview, text: "hello!" } },
    { name: "loading", preview: { ...preview, loading: true } },
    { name: "error", preview: { ...preview, error: "previewReadError" } },
    { name: "truncated", preview: { ...preview, truncated: true } },
    { name: "notice", preview, notice: "previewCopied" },
  ];

  for (const item of previewCases) {
    test(`预览模式随 ${item.name} 变化`, () => {
      const view = makeView({
        preview: item.preview,
        selectedCategory: "system",
        layer: "preview",
        notice: item.notice ?? null,
      });
      expect(breakdownSignature(view)).not.toBe(previewSignature);
    });
  }
});
