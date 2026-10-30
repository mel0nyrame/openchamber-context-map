import { expect, test } from "bun:test";

import { describeHostFailure } from "../src/panel/failure.ts";
import { t } from "../src/panel/i18n.ts";

test("NO_SERVICE 与 NOT_GRANTED 指向 Settings → Extensions", () => {
  for (const code of ["NO_SERVICE", "NOT_GRANTED"]) {
    const copy = describeHostFailure(code);
    expect(t("zh", copy.titleKey)).toBe("Service 未就绪");
    expect(t("en", copy.detailKey)).toContain("Settings → Extensions");
  }
});

test("DISABLED 显示已暂停", () => {
  const copy = describeHostFailure("DISABLED");
  expect(t("zh", copy.titleKey)).toBe("Context Map 已暂停");
  expect(t("en", copy.detailKey)).toContain("Settings → Extensions");
});

test("SERVICE_FAILED 显示 Service 已停止", () => {
  const copy = describeHostFailure("SERVICE_FAILED");
  expect(t("zh", copy.titleKey)).toBe("Service 已停止");
  expect(t("en", copy.detailKey)).toContain("Settings → Extensions");
});

test("未知错误回退到 Service 连接提示", () => {
  const copy = describeHostFailure(null);
  expect(t("zh", copy.titleKey)).toBe("无法连接 Service");
  expect(t("en", copy.detailKey)).toContain("Settings → Extensions");
});
