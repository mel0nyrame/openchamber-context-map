import { join } from "node:path";

/** OpenChamber 用 panel id 作为扩展的 guest id。 */
export const EXTENSION_GUEST_ID = "context-map";

/**
 * `bun install` 会把 package.json 的 `install` 脚本当作生命周期执行。
 * 父进程命令是 `bun install` 时跳过，避免装依赖时误装扩展；
 * `bun run install` 的父进程是 `bun run install`，不受影响。
 */
export function isBunInstallCommand(command: string | null | undefined): boolean {
  if (!command) return false;
  const firstLine = command.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
  return /\bbun(?:\.exe)?\s+install\b/.test(firstLine);
}

/** Collector 复制文件的第一行标记，用来区分本工具生成的文件与用户自己的插件。 */
export const COLLECTOR_MARKER = "@context-map-collector";

export interface InstallPaths {
  /** OpenChamber 数据目录，默认 `~/.config/openchamber`。 */
  dataDir: string;
  extensionsDir: string;
  extensionPath: string;
  extensionsFile: string;
  /** OpenCode 配置目录，默认 `~/.config/opencode`。 */
  opencodeConfigDir: string;
  pluginsDir: string;
  collectorPath: string;
}

/**
 * 解析安装目标。环境变量优先于默认目录，便于测试和在非默认配置下安装。
 * 这里不读文件系统，路径规则可以单独测试。
 */
export function resolveInstallPaths(
  home: string,
  env: Record<string, string | undefined>,
): InstallPaths {
  const dataDir = env.OPENCHAMBER_DATA_DIR?.trim() || join(home, ".config", "openchamber");
  const configHome = env.XDG_CONFIG_HOME?.trim() || join(home, ".config");
  const opencodeConfigDir = join(configHome, "opencode");
  const extensionsDir = join(dataDir, "extensions");
  const pluginsDir = join(opencodeConfigDir, "plugins");

  return {
    dataDir,
    extensionsDir,
    extensionPath: join(extensionsDir, EXTENSION_GUEST_ID),
    extensionsFile: join(dataDir, "extensions.json"),
    opencodeConfigDir,
    pluginsDir,
    collectorPath: join(pluginsDir, "context-map.js"),
  };
}

export type ExtensionLinkState = "missing" | "ours" | "conflict";

export interface ExtensionLinkProbe {
  exists: boolean;
  isSymlink: boolean;
  /** 软链指向的规范化路径；断链时为 null。 */
  resolvedTarget: string | null;
  /** 本仓库根目录的规范化路径。 */
  repoRoot: string;
}

/** 只接受“不存在”或“指向本仓库的软链”，其它情况一律视为冲突。 */
export function extensionLinkState(probe: ExtensionLinkProbe): ExtensionLinkState {
  if (!probe.exists) return "missing";
  if (!probe.isSymlink) return "conflict";
  return probe.resolvedTarget === probe.repoRoot ? "ours" : "conflict";
}

export function collectorHeader(version: string): string {
  return [
    `// ${COLLECTOR_MARKER} v${version}`,
    "// 本文件由 `bun run install` 从 openchamber-context-map 复制；升级请重新运行安装命令。",
  ].join("\n");
}

/** 在 Collector 构建产物前加标记，卸载和升级时据此判断文件归属。 */
export function collectorFileContent(source: string, version: string): string {
  return `${collectorHeader(version)}\n${source}`;
}

/** 读取已安装 Collector 的版本；不是本工具生成的文件返回 null。 */
export function readCollectorVersion(content: string): string | null {
  const match = /^\/\/ @context-map-collector v(\S+)\s*$/m.exec(content);
  return match?.[1] ?? null;
}

export type CollectorFileState = "missing" | "ours" | "conflict";

export function classifyCollectorContent(content: string | null): CollectorFileState {
  if (content === null) return "missing";
  return readCollectorVersion(content) === null ? "conflict" : "ours";
}

export type ExtensionStore = { paths: string[] } & Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every((item) => typeof item === "string")
);

/**
 * 校验 OpenChamber 的 extensions.json。只接受已知字段的基本形状，
 * 避免安装脚本把宿主读不懂的清单写回去。
 */
export function parseExtensionStore(value: unknown): ExtensionStore | null {
  if (!isRecord(value)) return null;
  if (!isStringArray(value.paths) || value.paths.some((entry) => entry.length === 0)) return null;

  for (const key of [
    "sources",
    "gitOrigins",
    "capabilityGrants",
    "capabilityScopes",
    "disabledGuests",
    "serviceSocketOverrides",
    "storageIds",
  ]) {
    const field = value[key];
    if (field !== undefined && !isRecord(field)) return null;
  }

  const grants = value.capabilityGrants;
  if (grants !== undefined) {
    if (!isRecord(grants) || !Object.values(grants).every(isStringArray)) return null;
  }

  return { ...value, paths: [...value.paths] };
}

export interface RegisterExtensionOptions {
  path: string;
  guestId: string;
  serviceScope: { exec: string[]; sockets: string[] };
}

export interface RegisterExtensionResult {
  store: ExtensionStore;
  /** 是否新增了扩展路径。 */
  added: boolean;
  /** 是否新增了 service 授权。 */
  grantedService: boolean;
  /** 是否把 service 权限范围同步成了当前 manifest 的值。 */
  scopeUpdated: boolean;
  /** 清单是否有任何改动；false 时 store 与输入相同。 */
  changed: boolean;
}

const sortedUnique = (values: string[]): string[] => [...new Set(values)].sort();

const sameStrings = (left: string[], right: string[]): boolean => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

/**
 * 把扩展路径登记进 extensions.json，并确保 service 授权与当前 manifest 一致。
 * 重复执行不会产生重复路径或重复授权；已登记但缺授权、或权限范围过期时会补齐。
 */
export function registerExtension(
  store: ExtensionStore,
  options: RegisterExtensionOptions,
): RegisterExtensionResult {
  const added = !store.paths.includes(options.path);
  const next: ExtensionStore = added
    ? { ...store, paths: [...store.paths, options.path] }
    : { ...store };

  const grants = isRecord(store.capabilityGrants) ? { ...store.capabilityGrants } : {};
  const existingGrant = grants[options.guestId];
  const current = isStringArray(existingGrant) ? [...existingGrant] : [];
  let grantedService = false;

  if (!current.includes("service")) {
    grants[options.guestId] = [...current, "service"];
    next.capabilityGrants = grants;
    grantedService = true;
  }

  const desiredScope = {
    exec: sortedUnique(options.serviceScope.exec),
    sockets: sortedUnique(options.serviceScope.sockets),
  };
  const scopes = isRecord(store.capabilityScopes) ? { ...store.capabilityScopes } : {};
  const existingScope = scopes[options.guestId];
  const guestScope = isRecord(existingScope) ? { ...existingScope } : {};
  const currentService = isRecord(guestScope.service) ? guestScope.service : null;
  const scopeMatches = currentService !== null
    && isStringArray(currentService.exec)
    && isStringArray(currentService.sockets)
    && sameStrings(currentService.exec, desiredScope.exec)
    && sameStrings(currentService.sockets, desiredScope.sockets);
  let scopeUpdated = false;

  if (!scopeMatches) {
    guestScope.service = desiredScope;
    scopes[options.guestId] = guestScope;
    next.capabilityScopes = scopes;
    scopeUpdated = true;
  }

  const changed = added || grantedService || scopeUpdated;
  if (!changed) {
    return { store, added: false, grantedService: false, scopeUpdated: false, changed: false };
  }

  return { store: next, added, grantedService, scopeUpdated, changed: true };
}

export interface UnregisterExtensionOptions {
  path: string;
  guestId: string;
  /** 是否还有同一 guest 的另一份安装；有的话保留授权与存储 id。 */
  guestStillInstalled: boolean;
}

export interface UnregisterExtensionResult {
  store: ExtensionStore;
  removedPath: boolean;
  removedGuest: boolean;
}

/** 移除扩展路径；没有同 guest 的其它安装时，一并清掉授权与存储 id。 */
export function unregisterExtension(
  store: ExtensionStore,
  options: UnregisterExtensionOptions,
): UnregisterExtensionResult {
  const removedPath = store.paths.includes(options.path);
  const next: ExtensionStore = { ...store, paths: store.paths.filter((entry) => entry !== options.path) };

  if (removedPath) {
    for (const key of ["sources", "gitOrigins"]) {
      const field = next[key];
      if (isRecord(field) && options.path in field) {
        const copy = { ...field };
        delete copy[options.path];
        next[key] = copy;
      }
    }
  }

  let removedGuest = false;
  if (removedPath && !options.guestStillInstalled) {
    for (const key of ["capabilityGrants", "capabilityScopes", "disabledGuests", "storageIds"]) {
      const field = next[key];
      if (isRecord(field) && options.guestId in field) {
        const copy = { ...field };
        delete copy[options.guestId];
        next[key] = copy;
        removedGuest = true;
      }
    }
  }

  return { store: next, removedPath, removedGuest };
}
