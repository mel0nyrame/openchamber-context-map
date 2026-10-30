import { describe, expect, test } from "bun:test";

import {
  PREVIEW_MAX_CHARS,
  clipPreviewText,
  escapeTarget,
  focusIndexFor,
  layerOf,
  moveFocus,
  previewTruncated,
} from "../src/panel/preview.ts";
import type { ItemSummary } from "../src/shared/types.ts";

function item(id: string): Pick<ItemSummary, "id"> {
  return { id };
}

describe("钻取层级", () => {
  test("分类决定条目列表，条目决定 Preview", () => {
    expect(layerOf(null, null)).toBe("overview");
    expect(layerOf("system", null)).toBe("items");
    expect(layerOf("system", "system:0")).toBe("preview");
    expect(layerOf(null, "system:0")).toBe("preview");
  });

  test("Esc 逐层后退，总览不再后退", () => {
    expect(escapeTarget("preview")).toBe("items");
    expect(escapeTarget("items")).toBe("overview");
    expect(escapeTarget("overview")).toBe("overview");
  });
});

describe("列表焦点", () => {
  test("没有条目时没有焦点", () => {
    expect(moveFocus(0, 0, 1)).toBe(-1);
    expect(moveFocus(-1, 0, -1)).toBe(-1);
  });

  test("上下移动并停在首尾", () => {
    expect(moveFocus(0, 3, 1)).toBe(1);
    expect(moveFocus(1, 3, 1)).toBe(2);
    expect(moveFocus(2, 3, 1)).toBe(2);
    expect(moveFocus(1, 3, -1)).toBe(0);
    expect(moveFocus(0, 3, -1)).toBe(0);
    expect(moveFocus(1, 3, 10)).toBe(2);
  });

  test("没有当前焦点时按方向落到首条或末条", () => {
    expect(moveFocus(-1, 3, 1)).toBe(0);
    expect(moveFocus(-1, 3, -1)).toBe(2);
  });

  test("重新渲染后优先保留同一个条目，否则夹住旧下标", () => {
    const items = [item("system:0"), item("system:1"), item("system:2")];
    expect(focusIndexFor(items, "system:1", 0)).toBe(1);
    expect(focusIndexFor(items, "system:9", 1)).toBe(1);
    expect(focusIndexFor(items, "system:9", 99)).toBe(2);
    expect(focusIndexFor(items, null, -5)).toBe(0);
    expect(focusIndexFor([], "system:0", 3)).toBe(-1);
  });
});

describe("预览正文", () => {
  test("短文本原样保留", () => {
    expect(clipPreviewText("你好")).toBe("你好");
    expect(clipPreviewText("")).toBe("");
  });

  test("超过 8000 字符时在面板侧截断", () => {
    expect(PREVIEW_MAX_CHARS).toBe(8_000);
    expect(clipPreviewText("a".repeat(8_000))).toHaveLength(8_000);
    expect(clipPreviewText("a".repeat(9_000))).toHaveLength(8_000);
  });

  test("原始字符数超过上限且展示到上限时标记截断", () => {
    expect(previewTruncated(9_000, 8_000)).toBe(true);
    expect(previewTruncated(8_001, 8_000)).toBe(true);
    expect(previewTruncated(8_000, 8_000)).toBe(false);
    expect(previewTruncated(9_000, 9_000)).toBe(false);
    expect(previewTruncated(171, 168)).toBe(false);
    expect(previewTruncated(100, 100)).toBe(false);
    expect(previewTruncated(Number.NaN, 0)).toBe(false);
  });
});
