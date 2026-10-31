import { describe, expect, test } from "bun:test";

import type { PanelView, PanelZoom, PreviewState } from "../src/panel/model.ts";
import { breakdownSignature, snapshotSignature } from "../src/panel/signature.ts";
import type { SnapshotSummary } from "../src/shared/types.ts";
import { panelView, summary } from "./fixtures.ts";

function makeView(overrides: Partial<PanelView> = {}): PanelView {
  const snapshot = overrides.summary ?? summary();
  return panelView({
    body: { kind: "summary", summary: snapshot },
    sessionID: snapshot.sessionID,
    summary: snapshot,
    ...overrides,
  });
}

function categoriesWith(
  key: "items" | "tokens",
  value: number,
): SnapshotSummary["categories"] {
  return summary().categories.map((entry) =>
    entry.category === "system" ? { ...entry, [key]: value } : entry,
  );
}

describe("snapshotSignature", () => {
  const base = summary();
  const baseSignature = snapshotSignature(base, "window");

  test("相同摘要与 zoom 产生稳定签名", () => {
    expect(snapshotSignature(summary(), "window")).toBe(baseSignature);
  });

  const cases: Array<{ name: string; summary: SnapshotSummary; zoom?: PanelZoom }> = [
    {
      name: "sessionID",
      summary: summary({ sessionID: "session-b" }),
    },
    {
      name: "collectedAt",
      summary: summary({ collectedAt: "2026-10-31T11:00:00.000Z" }),
    },
    {
      name: "used",
      summary: summary({ used: 12_001 }),
    },
    {
      name: "window",
      summary: summary({ window: 100_000 }),
    },
    {
      name: "zoom",
      summary: summary(),
      zoom: "fit",
    },
    {
      name: "categories tokens",
      summary: summary({ categories: categoriesWith("tokens", 101) }),
    },
    {
      name: "categories items",
      summary: summary({ categories: categoriesWith("items", 2) }),
    },
    {
      name: "items 数量",
      summary: summary({
        items: [
          ...base.items,
          { id: "system:1", title: "Extra", chars: 10, head: "" },
        ],
      }),
    },
  ];

  for (const { name, summary: snapshot, zoom } of cases) {
    test(`随 ${name} 变化`, () => {
      expect(snapshotSignature(snapshot, zoom ?? "window")).not.toBe(baseSignature);
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
      view: makeView({ summary: summary({ sessionID: "session-b" }) }),
    },
    {
      name: "collectedAt",
      view: makeView({
        summary: summary({ collectedAt: "2026-10-31T11:00:00.000Z" }),
      }),
    },
    {
      name: "used",
      view: makeView({ summary: summary({ used: 12_001 }) }),
    },
    {
      name: "window",
      view: makeView({ summary: summary({ window: 100_000 }) }),
    },
    {
      name: "categories",
      view: makeView({ summary: summary({ categories: categoriesWith("tokens", 101) }) }),
    },
    {
      name: "items",
      view: makeView({
        summary: summary({
          items: [{ id: "system:0", title: "Renamed", chars: 400, head: "" }],
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
    chars: 400,
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

  const previewCases: Array<{
    name: string;
    preview: PreviewState;
    notice?: PanelView["notice"];
  }> = [
    { name: "itemId", preview: { ...preview, itemId: "system:1" } },
    { name: "category", preview: { ...preview, category: "userMessages" } },
    { name: "title", preview: { ...preview, title: "Renamed" } },
    { name: "chars", preview: { ...preview, chars: 401 } },
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
