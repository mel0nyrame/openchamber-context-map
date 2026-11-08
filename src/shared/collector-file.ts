import { join } from "node:path";

/** Collector 复制文件的第一行标记，用来区分本工具生成的文件与用户自己的插件。 */
export const COLLECTOR_MARKER = "@context-map-collector";

export function collectorHeader(version: string): string {
  return [
    `// ${COLLECTOR_MARKER} v${version}`,
    "// 本文件由 openchamber-context-map 安装；升级请重新运行安装命令。",
  ].join("\n");
}

/** 在 Collector 构建产物前加标记，卸载和升级时据此判断文件归属。 */
export function collectorFileContent(source: string, version: string): string {
  return `${collectorHeader(version)}\n${source}`;
}

/** 读取已安装 Collector 的版本；标记必须在文件开头，避免把正文提到该字符串的用户插件当成自己的。 */
export function readCollectorVersion(content: string): string | null {
  const match = /^\/\/ @context-map-collector v(\S+)[^\n]*/.exec(content);
  return match?.[1] ?? null;
}

export type CollectorFileState = "missing" | "ours" | "conflict";

export function classifyCollectorContent(content: string | null): CollectorFileState {
  if (content === null) return "missing";
  return readCollectorVersion(content) === null ? "conflict" : "ours";
}

/** OpenCode 读取的 Collector 插件路径；与安装脚本使用同一套 XDG 规则。 */
export function collectorInstallPath(
  home: string,
  env: Record<string, string | undefined>,
): string {
  const configHome = env.XDG_CONFIG_HOME?.trim() || join(home, ".config");
  return join(configHome, "opencode", "plugins", "context-map.js");
}
