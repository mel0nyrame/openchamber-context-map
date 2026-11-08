import { describe, expect, test } from "bun:test";

import { docPairPath, missingDocPairs } from "../scripts/check-docs.ts";

describe("文档中英文配对", () => {
  test("英文与中文路径互相对应", () => {
    expect(docPairPath("README.md")).toBe("README.zh.md");
    expect(docPairPath("README.zh.md")).toBe("README.md");
    expect(docPairPath("docs/adr/0015-panel-collector-install.md")).toBe(
      "docs/adr/0015-panel-collector-install.zh.md",
    );
    expect(docPairPath("docs/adr/0015-panel-collector-install.zh.md")).toBe(
      "docs/adr/0015-panel-collector-install.md",
    );
    expect(docPairPath("notes.txt")).toBeNull();
  });

  test("列出缺失的另一半", () => {
    const existing = new Set(["README.md", "README.zh.md", "docs/adr/0001-a.md"]);

    expect(missingDocPairs([...existing], (file) => existing.has(file))).toEqual([
      "docs/adr/0001-a.zh.md",
    ]);
  });

  test("列出自身缺失的文件", () => {
    expect(missingDocPairs(["README.md"], () => false)).toEqual(["README.md"]);
  });
});
