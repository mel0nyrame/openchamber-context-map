import type { PanelView } from "../src/panel/model.ts";
import { initialRefreshState } from "../src/panel/refresh.ts";
import {
  CATEGORIES,
  type CategoryUsage,
  type SnapshotSummary,
} from "../src/shared/types.ts";

export function categories(): CategoryUsage[] {
  return CATEGORIES.map((category, index) => ({
    category,
    items: index === 0 ? 1 : 0,
    chars: index === 0 ? 400 : 0,
    tokens: index === 0 ? 100 : 0,
  }));
}

export function summary(overrides: Partial<SnapshotSummary> = {}): SnapshotSummary {
  return {
    sessionID: "ses_one",
    model: "anthropic/claude-sonnet-4-5",
    used: 12_000,
    window: 200_000,
    windowAssumed: false,
    estimated: false,
    baseline: false,
    restored: false,
    collectedAt: "2026-10-31T10:00:00.000Z",
    categories: categories(),
    items: [{ id: "system:0@1", title: "System", chars: 400, head: "S".repeat(200) }],
    ...overrides,
  };
}

export const connected = {
  connected: true,
  version: "1.2.3",
} as const;

/** 面板视图的最小可用默认值；各测试只覆盖自己关心的字段。 */
export function panelView(overrides: Partial<PanelView> = {}): PanelView {
  return {
    status: {
      kind: "checking",
      versionText: "…",
      titleKey: "statusCheckingTitle",
      detailKey: "statusCheckingDetail",
    },
    body: {
      kind: "placeholder",
      titleKey: "connectingTitle",
      detailKey: "connectingDetail",
      retry: false,
    },
    sessionID: null,
    summary: null,
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
