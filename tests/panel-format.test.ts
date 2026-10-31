import { describe, expect, test } from "bun:test";

import {
  compactNumber,
  formatNumber,
  formatPercent,
  intlLocale,
  pad2,
  roundPercent,
  versionLabel,
} from "../src/panel/format.ts";

describe("intlLocale", () => {
  test("把面板 locale 映射为 Intl 标签", () => {
    expect(intlLocale("en")).toBe("en-US");
    expect(intlLocale("zh")).toBe("zh-CN");
  });
});

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
