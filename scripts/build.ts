// 构建三个提交到仓库的产物：面板 IIFE、Service ESM、Collector ESM。
// OpenChamber 从 Git 安装扩展时不会执行构建，所以产物必须一并提交。
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const targets = [
  { entry: "src/panel/main.ts", out: "panel/main.js", node: false },
  { entry: "src/service/main.ts", out: "service/main.js", node: true },
  { entry: "src/collector/main.ts", out: "collector/main.js", node: true },
];

for (const target of targets) {
  mkdirSync(dirname(resolve(target.out)), { recursive: true });
  const args = [
    "openchamber-guest-bundle",
    ...(target.node ? ["--node"] : []),
    resolve(target.entry),
    resolve(target.out),
  ];
  const result = spawnSync("bunx", args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`构建失败：${target.entry}`);
    process.exit(result.status ?? 1);
  }
}
