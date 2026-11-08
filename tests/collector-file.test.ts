import { describe, expect, test } from "bun:test";

import {
  COLLECTOR_MARKER,
  classifyCollectorContent,
  collectorFileContent,
  collectorHeader,
  collectorInstallPath,
  readCollectorVersion,
} from "../src/shared/collector-file.ts";

describe("Collector 文件", () => {
  test("安装内容以版本标记开头", () => {
    const content = collectorFileContent("console.log('collector');\n", "1.2.3");
    expect(content.startsWith(`${collectorHeader("1.2.3")}\n`)).toBe(true);
    expect(content).toContain(`// ${COLLECTOR_MARKER} v1.2.3`);
    expect(readCollectorVersion(content)).toBe("1.2.3");
  });

  test("只把开头带标记的文件视为本工具生成", () => {
    expect(classifyCollectorContent(null)).toBe("missing");
    expect(classifyCollectorContent(collectorFileContent("", "0.2.0"))).toBe("ours");
    expect(classifyCollectorContent("// user plugin\n")).toBe("conflict");
    expect(classifyCollectorContent("// user plugin\n// @context-map-collector v0.2.0\n"))
      .toBe("conflict");
  });

  test("安装路径遵循 XDG_CONFIG_HOME", () => {
    expect(collectorInstallPath("/home/me", {})).toBe(
      "/home/me/.config/opencode/plugins/context-map.js",
    );
    expect(collectorInstallPath("/home/me", { XDG_CONFIG_HOME: "/tmp/config" })).toBe(
      "/tmp/config/opencode/plugins/context-map.js",
    );
    expect(collectorInstallPath("/home/me", { XDG_CONFIG_HOME: "  " })).toBe(
      "/home/me/.config/opencode/plugins/context-map.js",
    );
  });
});
