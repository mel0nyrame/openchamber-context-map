import { describe, expect, test } from "bun:test";

import {
  COMPACT_COLUMNS,
  COMPACT_ROWS,
  MAP_CELLS,
  MAP_COLUMNS,
  MAP_ROWS,
  buildBreakdown,
  categoryOfItem,
  gradientStops,
  itemsForCategory,
  layoutMap,
  windowBar,
} from "../src/panel/map.ts";
import {
  BACKGROUNDS,
  FREE_COLORS,
  PALETTES,
  contrastRatio,
} from "../src/panel/palette.ts";
import { CATEGORIES, type Category, type CategoryUsage, type ItemSummary } from "../src/shared/types.ts";

type UsageInput = number | { tokens: number; items?: number; chars?: number };

function usage(values: Partial<Record<Category, UsageInput>>): CategoryUsage[] {
  return CATEGORIES.map((category) => {
    const value = values[category];
    const spec = typeof value === "number" ? { tokens: value } : value;
    const tokens = spec?.tokens ?? 0;
    return {
      category,
      tokens,
      items: spec?.items ?? (tokens > 0 ? 1 : 0),
      chars: spec?.chars ?? 0,
    };
  });
}

function item(id: string, title = id): ItemSummary {
  return { id, title, chars: 100, head: "" };
}

describe("地图几何", () => {
  test("两套断点都是 200 格", () => {
    expect(MAP_COLUMNS * MAP_ROWS).toBe(MAP_CELLS);
    expect(COMPACT_COLUMNS * COMPACT_ROWS).toBe(MAP_CELLS);
    expect(MAP_CELLS).toBe(200);
  });

  test("格子总数固定，不随 token 分布变化", () => {
    const distributions = [
      usage({ system: 1 }),
      usage({ system: 1_000 }),
      usage({ system: 100, toolDefinitions: 200, userMessages: 300 }),
      usage({ reasoning: 7, toolCalls: 11, toolResults: 13, other: 17 }),
    ];

    for (const categories of distributions) {
      const layout = layoutMap(categories);
      expect(layout.cells).toHaveLength(MAP_CELLS);
      expect(layout.cells.map((cell) => cell.index)).toEqual(
        Array.from({ length: MAP_CELLS }, (_, index) => index),
      );
    }
  });

  test("没有已用 token 时不铺格", () => {
    const layout = layoutMap(usage({}));
    expect(layout.cells).toHaveLength(0);
    expect(layout.total).toBe(0);
    for (const category of CATEGORIES) {
      expect(layout.cellsByCategory[category]).toHaveLength(0);
    }
  });

  test("单分类占满全部格子", () => {
    const layout = layoutMap(usage({ system: 1_000 }));
    expect(layout.total).toBe(1_000);
    expect(layout.cellsByCategory.system).toHaveLength(MAP_CELLS);

    for (const cell of layout.cells) {
      expect(cell.segments).toHaveLength(1);
      const segment = cell.segments[0];
      expect(segment?.category).toBe("system");
      expect(segment?.from).toBe(0);
      expect(segment?.to).toBe(1);
      expect(cell.primary).toBe("system");
    }
  });

  test("跨分类边界的格子产生两段渐变", () => {
    const layout = layoutMap(
      usage({ system: 100, toolDefinitions: 100, userMessages: 100 }),
    );

    const firstBoundary = layout.cells[66];
    const secondBoundary = layout.cells[133];
    expect(firstBoundary?.segments.map((segment) => segment.category)).toEqual([
      "system",
      "toolDefinitions",
    ]);
    expect(secondBoundary?.segments.map((segment) => segment.category)).toEqual([
      "toolDefinitions",
      "userMessages",
    ]);

    const stops = gradientStops(firstBoundary!);
    expect(stops[0]?.start).toBe(0);
    expect(stops[stops.length - 1]?.end).toBe(100);
    expect(stops[0]?.end).toBeCloseTo(stops[1]?.start ?? -1, 9);
  });

  test("渐变停靠点连续覆盖 0% 到 100%", () => {
    const layout = layoutMap(
      usage({ system: 37, toolDefinitions: 41, userMessages: 43, reasoning: 47 }),
    );

    for (const cell of layout.cells) {
      const stops = gradientStops(cell);
      expect(stops.length).toBeGreaterThan(0);
      expect(stops[0]?.start).toBe(0);
      expect(stops[stops.length - 1]?.end).toBe(100);
      for (let index = 0; index < stops.length; index += 1) {
        const stop = stops[index]!;
        expect(stop.end).toBeGreaterThanOrEqual(stop.start);
        if (index > 0) {
          expect(stop.start).toBeCloseTo(stops[index - 1]!.end, 9);
        }
      }
    }
  });

  test("空分类不占格", () => {
    const layout = layoutMap(
      usage({ system: 1_000, toolDefinitions: 0, userMessages: 0 }),
    );
    const categories = new Set(
      layout.cells.flatMap((cell) => cell.segments.map((segment) => segment.category)),
    );
    expect([...categories]).toEqual(["system"]);
    expect(layout.cellsByCategory.toolDefinitions).toHaveLength(0);
    expect(layout.cellsByCategory.userMessages).toHaveLength(0);
  });

  test("分类顺序固定，与输入顺序无关", () => {
    const shuffled: CategoryUsage[] = [
      { category: "other", items: 1, chars: 4, tokens: 1 },
      { category: "userMessages", items: 1, chars: 4, tokens: 1 },
      { category: "system", items: 1, chars: 4, tokens: 1 },
    ];
    const layout = layoutMap(shuffled, 1);
    expect(layout.cells[0]?.segments.map((segment) => segment.category)).toEqual([
      "system",
      "userMessages",
      "other",
    ]);
  });

  test("按 token 比例分配格子", () => {
    const layout = layoutMap(usage({ system: 750, other: 250 }));
    expect(layout.cellsByCategory.system).toHaveLength(150);
    expect(layout.cellsByCategory.other).toHaveLength(50);
    expect(layout.cells[149]?.primary).toBe("system");
    expect(layout.cells[150]?.primary).toBe("other");
  });

  test("每格 token 之和等于分类总量", () => {
    const layout = layoutMap(
      usage({ system: 123, toolDefinitions: 456, toolResults: 789 }),
    );
    const cellTotal = layout.cells.reduce(
      (sum, cell) => sum + cell.segments.reduce((inner, segment) => inner + segment.tokens, 0),
      0,
    );
    expect(cellTotal).toBeCloseTo(layout.total, 6);
    expect(layout.total).toBe(123 + 456 + 789);
    for (const cell of layout.cells) {
      expect(
        cell.segments.reduce((sum, segment) => sum + segment.tokens, 0),
      ).toBeCloseTo(layout.total / MAP_CELLS, 6);
    }
  });
});

describe("window bar 与 Breakdown", () => {
  test("used 为 0 时地图为空，Free space 等于窗口", () => {
    const bar = windowBar(0, 200_000);
    expect(bar.fraction).toBe(0);
    expect(bar.free).toBe(200_000);
    expect(bar.over).toBe(false);

    const breakdown = buildBreakdown(usage({}), 0, 200_000);
    expect(breakdown.rows).toHaveLength(0);
    expect(breakdown.free.tokens).toBe(200_000);
  });

  test("used 超过 window 时封顶且 Free space 为 0", () => {
    const bar = windowBar(250_000, 200_000);
    expect(bar.fraction).toBe(1);
    expect(bar.free).toBe(0);
    expect(bar.over).toBe(true);

    const breakdown = buildBreakdown(usage({ system: 250_000 }), 250_000, 200_000);
    expect(breakdown.free.tokens).toBe(0);
    expect(breakdown.rows[0]?.tokens).toBe(250_000);
  });

  test("window 为 0 时不产生除零结果", () => {
    const bar = windowBar(100, 0);
    expect(bar.fraction).toBe(0);
    expect(bar.free).toBe(0);
    expect(bar.over).toBe(true);
  });

  test("Breakdown 只列非空分类，并保留 Free space", () => {
    const breakdown = buildBreakdown(
      usage({
        system: { tokens: 300, items: 2 },
        userMessages: { tokens: 100, items: 1 },
        reasoning: { tokens: 0, items: 0 },
      }),
      400,
      1_000,
    );

    expect(breakdown.rows.map((row) => row.category)).toEqual(["system", "userMessages"]);
    expect(breakdown.rows[0]).toMatchObject({ items: 2, tokens: 300 });
    expect(breakdown.rows[1]).toMatchObject({ items: 1, tokens: 100 });
    expect(breakdown.free.tokens).toBe(600);
  });
  test("0 token 但有条目的分类仍然列出", () => {
    const breakdown = buildBreakdown(usage({ other: { tokens: 0, items: 2 } }), 100, 1_000);
    expect(breakdown.rows.map((row) => row.category)).toEqual(["other"]);
    expect(breakdown.rows[0]).toMatchObject({ items: 2, tokens: 0 });
  });
});

describe("条目筛选", () => {
  test("按 id 前缀筛选分类条目", () => {
    const items = [
      item("system:0"),
      item("toolCalls:0"),
      item("system:1"),
      item("bogus:0"),
      item("system"),
      item("unknown:1"),
    ];

    expect(itemsForCategory(items, "system").map((entry) => entry.id)).toEqual([
      "system:0",
      "system:1",
    ]);
    expect(itemsForCategory(items, "toolCalls").map((entry) => entry.id)).toEqual([
      "toolCalls:0",
    ]);
    expect(categoryOfItem("system:0")).toBe("system");
    expect(categoryOfItem("bogus:0")).toBeNull();
    expect(categoryOfItem("system")).toBeNull();
    expect(categoryOfItem(":0")).toBeNull();
  });
});

describe("分类色板", () => {
  test("浅色与深色色板都达到 3:1 图形对比度", () => {
    for (const mode of ["light", "dark"] as const) {
      const backgrounds = BACKGROUNDS[mode];
      for (const category of CATEGORIES) {
        const color = PALETTES[mode][category];
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
        expect(contrastRatio(color, backgrounds.page)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(color, backgrounds.surface)).toBeGreaterThanOrEqual(3);
      }
      expect(contrastRatio(FREE_COLORS[mode], backgrounds.page)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(FREE_COLORS[mode], backgrounds.surface)).toBeGreaterThanOrEqual(3);
    }
  });

  test("两套色板不同", () => {
    for (const category of CATEGORIES) {
      expect(PALETTES.light[category]).not.toBe(PALETTES.dark[category]);
    }
  });
});
