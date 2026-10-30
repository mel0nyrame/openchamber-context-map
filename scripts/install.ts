import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readlink,
  realpath,
  rename,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

import {
  classifyCollectorContent,
  collectorFileContent,
  EXTENSION_GUEST_ID,
  extensionLinkState,
  isBunInstallCommand,
  parseExtensionStore,
  readCollectorVersion,
  registerExtension,
  resolveInstallPaths,
  unregisterExtension,
  type ExtensionStore,
} from "./install-lib.ts";
import { COLLECTOR_VERSION } from "../src/shared/version.ts";

function parentCommand(): string | null {
  try {
    const result = Bun.spawnSync(["ps", "-o", "command=", "-p", String(process.ppid)]);
    return result.success ? result.stdout.toString().trim() : null;
  } catch {
    return null;
  }
}

if (isBunInstallCommand(parentCommand())) {
  console.log("检测到这是 bun install 的生命周期调用，已跳过 Context Map 安装。");
  console.log("要安装扩展与 Collector，请运行：bun run install");
  process.exit(0);
}

interface PackageManifest {
  openchamber?: {
    contributes?: {
      panel?: { id?: string; entry?: string };
      service?: {
        entry?: string;
        permissions?: {
          exec?: string[];
          sockets?: Array<{ id?: string }>;
        };
      };
    };
  };
}

interface CollectorTarget {
  state: ReturnType<typeof classifyCollectorContent>;
  content: string | null;
  isSymlink: boolean;
}

const uninstall = process.argv.includes("--uninstall");
const repoRoot = resolve(import.meta.dir, "..");
const repoRootReal = await realpath(repoRoot);
const paths = resolveInstallPaths(homedir(), process.env);

if (!isAbsolute(paths.dataDir)) {
  throw new Error("OPENCHAMBER_DATA_DIR 必须是绝对路径");
}
if (!isAbsolute(paths.opencodeConfigDir)) {
  throw new Error("XDG_CONFIG_HOME 必须是绝对路径");
}

async function lstatOrNull(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readTextOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function probeExtensionLink() {
  const stat = await lstatOrNull(paths.extensionPath);
  if (!stat) {
    return { exists: false, isSymlink: false, resolvedTarget: null, repoRoot: repoRootReal };
  }

  let resolvedTarget: string | null = null;
  if (stat.isSymbolicLink()) {
    try {
      resolvedTarget = await realpath(paths.extensionPath);
    } catch {
      // 断链时 realpath 会失败，退回到 readlink 的解析结果。
      const raw = await readlink(paths.extensionPath);
      resolvedTarget = resolve(dirname(paths.extensionPath), raw);
    }
  }

  return {
    exists: true,
    isSymlink: stat.isSymbolicLink(),
    resolvedTarget,
    repoRoot: repoRootReal,
  };
}

async function probeCollector(): Promise<CollectorTarget> {
  const stat = await lstatOrNull(paths.collectorPath);
  if (!stat) return { state: "missing", content: null, isSymlink: false };
  if (stat.isSymbolicLink()) return { state: "conflict", content: null, isSymlink: true };
  if (!stat.isFile()) return { state: "conflict", content: null, isSymlink: false };

  const content = await readFile(paths.collectorPath, "utf8");
  return { state: classifyCollectorContent(content), content, isSymlink: false };
}

async function readStore(): Promise<ExtensionStore> {
  const raw = await readTextOrNull(paths.extensionsFile);
  if (raw === null) return { paths: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`无法解析 ${paths.extensionsFile}；请先备份并修复该文件，安装未做修改`);
  }

  const store = parseExtensionStore(parsed);
  if (!store) {
    throw new Error(`${paths.extensionsFile} 不是有效的 OpenChamber 扩展清单；安装未做修改`);
  }
  return store;
}

async function writeStore(store: ExtensionStore): Promise<void> {
  await mkdir(dirname(paths.extensionsFile), { recursive: true });
  const tmp = `${paths.extensionsFile}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  await writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, paths.extensionsFile);
}

async function readManifest(): Promise<PackageManifest> {
  const raw = await readFile(join(repoRoot, "package.json"), "utf8");
  return JSON.parse(raw) as PackageManifest;
}

async function requireBuildArtifacts(): Promise<void> {
  for (const relative of ["panel/index.html", "panel/main.js", "service/main.js", "collector/main.js"]) {
    const stat = await lstatOrNull(join(repoRoot, relative));
    if (!stat?.isFile()) {
      throw new Error(`缺少 ${relative}；请先运行 bun run build`);
    }
  }
}

async function guestStillInstalled(store: ExtensionStore, guestId: string, removedPath: string): Promise<boolean> {
  for (const entry of store.paths) {
    if (entry === removedPath) continue;
    try {
      const raw = await readFile(join(entry, "package.json"), "utf8");
      const pkg = JSON.parse(raw) as PackageManifest;
      if (pkg.openchamber?.contributes?.panel?.id === guestId) return true;
    } catch {
      // 另一个安装路径已经失效，不影响卸载当前路径。
    }
  }
  return false;
}

async function install(): Promise<void> {
  const manifest = await readManifest();
  const panel = manifest.openchamber?.contributes?.panel;
  const service = manifest.openchamber?.contributes?.service;

  if (panel?.id !== EXTENSION_GUEST_ID) {
    throw new Error(`package.json 的 panel.id 不是 ${EXTENSION_GUEST_ID}，无法确定扩展标识`);
  }
  if (!service?.entry) {
    throw new Error("package.json 缺少 openchamber.contributes.service.entry");
  }

  await requireBuildArtifacts();

  const linkProbe = await probeExtensionLink();
  const linkState = extensionLinkState(linkProbe);
  const collector = await probeCollector();
  const store = await readStore();

  const conflicts: string[] = [];
  if (linkState === "conflict") {
    conflicts.push(
      `扩展目标已存在，且不是指向本仓库的软链：${paths.extensionPath}\n`
      + "  为避免覆盖用户文件，安装已停止。请先确认并移走该目录或链接。",
    );
  }
  if (collector.state === "conflict") {
    const reason = collector.isSymlink ? "是一个软链" : "不是本工具生成的文件";
    conflicts.push(
      `Collector 目标已存在，且${reason}：${paths.collectorPath}\n`
      + "  为避免覆盖用户插件，安装已停止。请先备份并移走该文件。",
    );
  }
  if (conflicts.length > 0) {
    throw new Error(conflicts.join("\n\n"));
  }

  const serviceScope = {
    exec: service.permissions?.exec ?? [],
    sockets: (service.permissions?.sockets ?? [])
      .map((socket) => socket.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  };

  console.log("Context Map 安装");
  console.log(`  仓库：${repoRootReal}`);
  console.log(`  OpenChamber 数据目录：${paths.dataDir}`);
  console.log(`  OpenCode 配置目录：${paths.opencodeConfigDir}`);
  console.log("");

  let changed = false;

  console.log("[1/3] 扩展");
  if (linkState === "missing") {
    await mkdir(paths.extensionsDir, { recursive: true });
    await symlink(repoRootReal, paths.extensionPath, "dir");
    console.log(`  已创建软链：${paths.extensionPath} -> ${repoRootReal}`);
    changed = true;
  } else {
    console.log(`  软链已存在，跳过：${paths.extensionPath}`);
  }

  console.log("[2/3] Collector");
  const collectorSource = await readFile(join(repoRoot, "collector/main.js"), "utf8");
  const desired = collectorFileContent(collectorSource, COLLECTOR_VERSION);
  if (collector.state === "missing") {
    await mkdir(paths.pluginsDir, { recursive: true });
    await writeFile(paths.collectorPath, desired, "utf8");
    console.log(`  已复制：${paths.collectorPath}（v${COLLECTOR_VERSION}）`);
    changed = true;
  } else if (collector.content === desired) {
    console.log(`  已是最新，跳过：${paths.collectorPath}（v${COLLECTOR_VERSION}）`);
  } else {
    const previous = readCollectorVersion(collector.content ?? "");
    await writeFile(paths.collectorPath, desired, "utf8");
    const versionNote = previous && previous !== COLLECTOR_VERSION
      ? `${previous} -> ${COLLECTOR_VERSION}`
      : "构建产物已更新";
    console.log(`  已更新：${paths.collectorPath}（${versionNote}）`);
    changed = true;
  }

  console.log("[3/3] 扩展清单");
  // storageIds 由 OpenChamber 首次列出扩展时补齐，安装脚本不生成。
  const registration = registerExtension(store, {
    path: paths.extensionPath,
    guestId: EXTENSION_GUEST_ID,
    serviceScope,
  });
  if (registration.changed) {
    await writeStore(registration.store);
    console.log(
      registration.added
        ? `  已登记：${paths.extensionPath}`
        : `  已更新登记：${paths.extensionPath}`,
    );
    if (registration.grantedService) {
      const exec = serviceScope.exec.length > 0 ? serviceScope.exec.join(", ") : "无";
      const sockets = serviceScope.sockets.length > 0 ? serviceScope.sockets.join(", ") : "无";
      console.log(`  已授予 service 权限（exec: ${exec}；sockets: ${sockets}）`);
    } else if (registration.scopeUpdated) {
      console.log("  已同步 service 权限范围");
    }
    changed = true;
  } else {
    console.log(`  已登记，跳过：${paths.extensionPath}`);
  }

  console.log("");
  if (changed) {
    console.log("安装完成。下一步：");
    console.log("  1. 完全退出并重新打开 OpenCode，让 Collector 插件加载。");
    console.log("  2. 完全退出并重新打开 OpenChamber，让扩展出现在 rail。");
    console.log("  3. 打开 Context Map；若提示 Collector 未运行，确认 OpenCode 已完全重启。");
  } else {
    console.log("安装已是最新，没有改动。若面板仍未出现，请完全重启 OpenCode 与 OpenChamber。");
  }
}

async function uninstallExtension(): Promise<void> {
  console.log("Context Map 卸载");
  console.log(`  仓库：${repoRootReal}`);
  console.log("");

  let changed = false;
  let blocked = false;

  console.log("[1/3] 扩展软链");
  const linkProbe = await probeExtensionLink();
  const linkState = extensionLinkState(linkProbe);
  if (linkState === "missing") {
    console.log(`  未安装，跳过：${paths.extensionPath}`);
  } else if (linkState === "ours") {
    await unlink(paths.extensionPath);
    console.log(`  已删除：${paths.extensionPath}`);
    changed = true;
  } else {
    console.log(`  不是本仓库的软链，保留：${paths.extensionPath}`);
    blocked = true;
  }

  console.log("[2/3] Collector");
  const collector = await probeCollector();
  if (collector.state === "missing") {
    console.log(`  未安装，跳过：${paths.collectorPath}`);
  } else if (collector.state === "ours") {
    await unlink(paths.collectorPath);
    console.log(`  已删除：${paths.collectorPath}`);
    changed = true;
  } else {
    console.log(`  不是本工具生成的文件，保留：${paths.collectorPath}`);
    blocked = true;
  }

  console.log("[3/3] 扩展清单");
  const store = await readStore();
  const removal = unregisterExtension(store, {
    path: paths.extensionPath,
    guestId: EXTENSION_GUEST_ID,
    guestStillInstalled: await guestStillInstalled(store, EXTENSION_GUEST_ID, paths.extensionPath),
  });
  if (removal.removedPath || removal.removedGuest) {
    await writeStore(removal.store);
    console.log(`  已移除登记：${paths.extensionPath}`);
    if (removal.removedGuest) console.log(`  已清理 ${EXTENSION_GUEST_ID} 的授权与存储 id`);
    changed = true;
  } else {
    console.log(`  未登记，跳过：${paths.extensionPath}`);
  }

  console.log("");
  if (changed) {
    console.log("卸载完成。请完全退出并重新打开 OpenCode 与 OpenChamber。");
  } else {
    console.log("没有需要卸载的内容。");
  }
  if (blocked) {
    console.log("有目标不是本工具创建的，已保留；请确认后手工处理。");
    process.exitCode = 1;
  }
}

try {
  if (uninstall) {
    await uninstallExtension();
  } else {
    await install();
  }
} catch (error) {
  console.error("");
  console.error(`操作失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
