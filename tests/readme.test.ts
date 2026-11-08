import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { t } from "../src/panel/i18n.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FILES = ["README.md", "README.zh.md"] as const;

const readmes = FILES.map((file) => ({
  file,
  text: readFileSync(join(ROOT, file), "utf8"),
}));

describe("README 安装文案", () => {
  test("使用面板的安装标签", () => {
    const expected = {
      "README.md": [
        t("en", "installCollector"),
        t("en", "collectorNotRunning"),
        t("en", "collectorConflictTitle"),
      ],
      "README.zh.md": [
        t("zh", "installCollector"),
        t("zh", "collectorNotRunning"),
        t("zh", "collectorConflictTitle"),
      ],
    } as const;

    for (const { file, text } of readmes) {
      for (const label of expected[file]) {
        expect(text).toContain(label);
      }
    }
  });

  test("不再使用旧的权限、升级与卸载说法", () => {
    const stale = [
      "permission to run its OpenCode plugin",
      "extension and its bundled Collector update together",
      "removes the extension and its bundled Collector",
      "no separate install step",
      "loads the extension and its OpenCode plugin automatically",
      "与 **OpenCode 插件**权限",
      "扩展和随扩展安装的 Collector 会一起更新",
      "扩展和随扩展安装的 Collector 会一起删除",
      "不需要单独安装",
      "自动加载扩展及其 OpenCode 插件",
      "检查 OpenCode 插件权限",
    ];

    for (const { text } of readmes) {
      for (const phrase of stale) {
        expect(text).not.toContain(phrase);
      }
    }
  });

  test("引用的本地图片存在", () => {
    const imageSources = (text: string) => {
      const sources = new Set<string>();
      for (const match of text.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
        const src = match[1];
        if (src) sources.add(src);
      }
      for (const match of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
        const src = match[1];
        if (src) sources.add(src);
      }
      return [...sources];
    };

    for (const { file, text } of readmes) {
      const local = imageSources(text).filter(
        (src) => !/^(https?:)?\/\//.test(src) && !src.startsWith("data:"),
      );
      expect(local.length).toBeGreaterThan(0);
      for (const src of local) {
        if (!existsSync(join(ROOT, src))) {
          throw new Error(`${file} 引用的图片不存在：${src}`);
        }
      }
    }
  });
});
