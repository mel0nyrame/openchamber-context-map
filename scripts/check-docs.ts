// 校验 docs/modules.md 覆盖 src/ 与 scripts/ 下每个 .ts，且没有指向已删除文件的条目。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DOC = "docs/modules.md";
const ROOTS = ["src", "scripts"];

function listTypeScriptFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join(root, name).replaceAll("\\", "/"))
    .sort();
}

const expected = ROOTS.flatMap(listTypeScriptFiles);
const doc = readFileSync(DOC, "utf8");
const documented = new Set(
  [...doc.matchAll(/`((?:src|scripts)\/[^`\s]+\.ts)`/g)].map((match) => match[1] ?? ""),
);

const missing = expected.filter((file) => !documented.has(file));
const stale = [...documented].filter((file) => !expected.includes(file)).sort();

if (missing.length > 0) {
  console.error(`${DOC} 缺少这些文件：`);
  for (const file of missing) console.error(`  ${file}`);
}
if (stale.length > 0) {
  console.error(`${DOC} 引用了不存在的文件：`);
  for (const file of stale) console.error(`  ${file}`);
}
if (missing.length > 0 || stale.length > 0) process.exit(1);

console.log(`${DOC} 覆盖 ${expected.length} 个文件`);
