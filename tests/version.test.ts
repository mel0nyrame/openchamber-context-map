import { expect, test } from "bun:test";

import {
  COLLECTOR_VERSION,
  collectorVersionOutdated,
  normalizeCollectorVersion,
} from "../src/shared/version.ts";

test("Collector 版本比较忽略空白和 v 前缀", () => {
  expect(normalizeCollectorVersion(" v0.1.0 ")).toBe("0.1.0");
  expect(collectorVersionOutdated("v0.1.0")).toBe(false);
  expect(collectorVersionOutdated(` ${COLLECTOR_VERSION} `)).toBe(false);
});

test("Collector 版本不一致时报告过旧", () => {
  expect(collectorVersionOutdated("0.0.9")).toBe(true);
  expect(collectorVersionOutdated("")).toBe(true);
  expect(collectorVersionOutdated("0.2.0", "0.1.0")).toBe(true);
  expect(collectorVersionOutdated("0.1.0", "0.1.0")).toBe(false);
});
