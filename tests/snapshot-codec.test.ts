import { describe, expect, test } from "bun:test";

import { parseSnapshotItemDetail, parseSnapshotSummary } from "../src/shared/snapshot.ts";
import { CATEGORIES, type CategoryUsage, type SnapshotSummary } from "../src/shared/types.ts";

function categories(count: number): CategoryUsage[] {
  return CATEGORIES.slice(0, count).map((category, index) => ({
    category,
    items: index === 0 ? 2 : 0,
    chars: index === 0 ? 400 : 0,
    tokens: index === 0 ? 100 : 0,
  }));
}

function summary(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
    categories: categories(8),
    items: [{ id: "system:0@1", title: "System", chars: 400, head: "S".repeat(200) }],
    ...overrides,
  };
}

function parsed(input: Record<string, unknown>): SnapshotSummary {
  const result = parseSnapshotSummary(input);
  if (!result) throw new Error("expected summary to parse");
  return result;
}

describe("parseSnapshotSummary", () => {
  test("接受 1 到 8 个分类，baseline 的 2 分类汇总也能通过", () => {
    for (let count = 1; count <= CATEGORIES.length; count += 1) {
      const result = parsed(summary({ baseline: count === 2, categories: categories(count) }));
      expect(result.categories.map((entry) => entry.category)).toEqual(CATEGORIES.slice(0, count));
      expect(result.baseline).toBe(count === 2);
    }
  });

  test("拒绝 0 个分类、超过 8 个分类和重复分类", () => {
    expect(parseSnapshotSummary(summary({ categories: [] }))).toBeNull();
    expect(parseSnapshotSummary(summary({
      categories: [...categories(8), categories(1)[0]],
    }))).toBeNull();
    expect(parseSnapshotSummary(summary({
      categories: [categories(1)[0], categories(1)[0]],
    }))).toBeNull();
  });

  test("拒绝缺少 baseline 或 baseline 不是布尔值", () => {
    const { baseline: _baseline, ...missing } = summary();
    expect(parseSnapshotSummary(missing)).toBeNull();
    expect(parseSnapshotSummary(summary({ baseline: "false" }))).toBeNull();
    expect(parseSnapshotSummary(summary({ baseline: 0 }))).toBeNull();
  });

  test("拒绝无法解析的 collectedAt", () => {
    for (const collectedAt of ["not a date", "", 123, undefined]) {
      expect(parseSnapshotSummary(summary({ collectedAt }))).toBeNull();
    }
  });

  test("拒绝空 sessionID 与非字符串 model", () => {
    expect(parseSnapshotSummary(summary({ sessionID: "" }))).toBeNull();
    expect(parseSnapshotSummary(summary({ sessionID: 42 }))).toBeNull();
    expect(parseSnapshotSummary(summary({ model: null }))).toBeNull();
  });

  test("拒绝非有限数字的 used/window", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, "12000", undefined]) {
      expect(parseSnapshotSummary(summary({ used: value }))).toBeNull();
      expect(parseSnapshotSummary(summary({ window: value }))).toBeNull();
    }
  });

  test("拒绝非布尔 windowAssumed/estimated", () => {
    expect(parseSnapshotSummary(summary({ windowAssumed: "no" }))).toBeNull();
    expect(parseSnapshotSummary(summary({ estimated: 1 }))).toBeNull();
  });

  test("拒绝非法分类名和坏分类条目", () => {
    expect(parseSnapshotSummary(summary({
      categories: [{ category: "unknown", items: 0, chars: 0, tokens: 0 }],
    }))).toBeNull();
    expect(parseSnapshotSummary(summary({
      categories: [{ category: "system", items: 0, chars: 0 }],
    }))).toBeNull();
    expect(parseSnapshotSummary(summary({
      categories: [{ category: "system", items: 0, chars: 0, tokens: Number.NaN }],
    }))).toBeNull();
    expect(parseSnapshotSummary(summary({ categories: ["system"] }))).toBeNull();
  });

  test("拒绝坏条目", () => {
    expect(parseSnapshotSummary(summary({ items: "nope" }))).toBeNull();
    expect(parseSnapshotSummary(summary({ items: [null] }))).toBeNull();
    expect(parseSnapshotSummary(summary({
      items: [{ id: "system:0@1", title: "System", chars: Number.NaN, head: "" }],
    }))).toBeNull();
    expect(parseSnapshotSummary(summary({
      items: [{ id: "system:0@1", title: "System", chars: 1 }],
    }))).toBeNull();
    expect(parseSnapshotSummary(summary({
      items: [{ id: 1, title: "System", chars: 1, head: "" }],
    }))).toBeNull();
  });

  test("允许空的 items 数组", () => {
    expect(parsed(summary({ items: [] })).items).toEqual([]);
  });

  test("restored 缺失时规范化为 false，只有 true 才保留", () => {
    const { restored: _restored, ...missing } = summary();
    expect(parsed(missing).restored).toBe(false);
    expect(parsed(summary({ restored: true })).restored).toBe(true);
    expect(parsed(summary({ restored: "true" })).restored).toBe(false);
    expect(parsed(summary({ restored: false })).restored).toBe(false);
  });

  test("忽略未知字段并返回只含已知字段的新对象", () => {
    const input = summary({
      extra: "ignored",
      categories: [{ category: "system", items: 1, chars: 400, tokens: 100, extra: true }],
      items: [{ id: "system:0@1", title: "System", chars: 400, head: "S", extra: true }],
    });

    const result = parsed(input);
    const rawCategories = input.categories as unknown[];
    const rawItems = input.items as unknown[];
    expect(Object.keys(result).sort()).toEqual([
      "baseline",
      "categories",
      "collectedAt",
      "estimated",
      "items",
      "model",
      "restored",
      "sessionID",
      "used",
      "window",
      "windowAssumed",
    ]);
    expect(Object.keys(result.categories[0]!).sort()).toEqual(["category", "chars", "items", "tokens"]);
    expect(Object.keys(result.items[0]!).sort()).toEqual(["chars", "head", "id", "title"]);
    expect(result).not.toBe(input);
    expect(result.categories[0]).not.toBe(rawCategories[0]);
    expect(result.items[0]).not.toBe(rawItems[0]);
  });
});

describe("parseSnapshotItemDetail", () => {
  const detail = {
    id: "system:0@1",
    title: "System",
    chars: 400,
    text: "You are OpenCode.",
  };

  test("接受合法条目详情并忽略未知字段", () => {
    const result = parseSnapshotItemDetail({ ...detail, extra: true });
    expect(result).toEqual(detail);
    expect(Object.keys(result!).sort()).toEqual(["chars", "id", "text", "title"]);
  });

  test("拒绝空的 id/title/text", () => {
    for (const field of ["id", "title", "text"]) {
      expect(parseSnapshotItemDetail({ ...detail, [field]: "" })).toBeNull();
    }
  });

  test("拒绝非有限 chars 和缺失字段", () => {
    expect(parseSnapshotItemDetail({ ...detail, chars: Number.NaN })).toBeNull();
    expect(parseSnapshotItemDetail({ ...detail, chars: "400" })).toBeNull();
    expect(parseSnapshotItemDetail({ id: "a", title: "b", chars: 1 })).toBeNull();
    expect(parseSnapshotItemDetail(null)).toBeNull();
    expect(parseSnapshotItemDetail([])).toBeNull();
  });
});
