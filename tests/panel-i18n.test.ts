import { expect, test } from "bun:test";

import { MESSAGES, resolveLocale, t } from "../src/panel/i18n.ts";

test("zh 变体都落到 zh", () => {
  expect(resolveLocale("zh-CN")).toBe("zh");
  expect(resolveLocale("zh-TW")).toBe("zh");
  expect(resolveLocale("zh")).toBe("zh");
  expect(resolveLocale("ZH-hans")).toBe("zh");
});

test("非中文与缺失的 locale 回到英文", () => {
  expect(resolveLocale("en-US")).toBe("en");
  expect(resolveLocale("fr")).toBe("en");
  expect(resolveLocale("")).toBe("en");
  expect(resolveLocale(undefined)).toBe("en");
});

test("两种语言的字典键完全一致", () => {
  expect(Object.keys(MESSAGES.zh).sort()).toEqual(Object.keys(MESSAGES.en).sort());
});

test("t 替换命名变量并保留未知占位符", () => {
  expect(t("en", "updatedToday", { clock: "21:12:41" })).toBe("Updated 21:12:41");
  expect(t("zh", "updatedOtherDay", { month: 3, day: 8, clock: "09:05:00" }))
    .toBe("更新于 3月8日 09:05:00");
  expect(t("en", "freeCellLabel", { tokens: "115,000" })).toBe("Free space · 115,000 tokens");
});
