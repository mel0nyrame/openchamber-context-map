import { expect, test } from "bun:test";

import {
  classifyCollectorContent,
  collectorFileContent,
  collectorHeader,
  EXTENSION_GUEST_ID,
  extensionLinkState,
  isBunInstallCommand,
  parseExtensionStore,
  readCollectorVersion,
  registerExtension,
  resolveInstallPaths,
  unregisterExtension,
} from "../scripts/install-lib.ts";

test("只跳过父进程为 bun install 的调用，不跳过 bun run install", () => {
  expect(isBunInstallCommand("bun install")).toBe(true);
  expect(isBunInstallCommand("/opt/homebrew/bin/bun install --frozen-lockfile")).toBe(true);
  expect(isBunInstallCommand("bun run install")).toBe(false);
  expect(isBunInstallCommand("/opt/homebrew/bin/bun run install")).toBe(false);
  expect(isBunInstallCommand("bun --cwd . install")).toBe(true);
  expect(isBunInstallCommand("bun install && bun run build")).toBe(true);
  expect(isBunInstallCommand("npm install")).toBe(false);
  expect(isBunInstallCommand(null)).toBe(false);
  expect(isBunInstallCommand("")).toBe(false);
});

test("安装路径默认落在 OpenChamber 与 OpenCode 的配置目录", () => {
  const paths = resolveInstallPaths("/Users/test", {});

  expect(paths.dataDir).toBe("/Users/test/.config/openchamber");
  expect(paths.extensionsDir).toBe("/Users/test/.config/openchamber/extensions");
  expect(paths.extensionPath).toBe("/Users/test/.config/openchamber/extensions/context-map");
  expect(paths.extensionsFile).toBe("/Users/test/.config/openchamber/extensions.json");
  expect(paths.opencodeConfigDir).toBe("/Users/test/.config/opencode");
  expect(paths.collectorPath).toBe("/Users/test/.config/opencode/plugins/context-map.js");
});

test("安装路径支持 OPENCHAMBER_DATA_DIR 与 XDG_CONFIG_HOME", () => {
  const paths = resolveInstallPaths("/Users/test", {
    OPENCHAMBER_DATA_DIR: "/Volumes/data/openchamber",
    XDG_CONFIG_HOME: "/Volumes/data/config",
  });

  expect(paths.dataDir).toBe("/Volumes/data/openchamber");
  expect(paths.extensionPath).toBe("/Volumes/data/openchamber/extensions/context-map");
  expect(paths.extensionsFile).toBe("/Volumes/data/openchamber/extensions.json");
  expect(paths.opencodeConfigDir).toBe("/Volumes/data/config/opencode");
  expect(paths.collectorPath).toBe("/Volumes/data/config/opencode/plugins/context-map.js");
});

test("扩展软链只在缺失或指向本仓库时继续", () => {
  const repoRoot = "/repo/context-map";

  expect(extensionLinkState({
    exists: false,
    isSymlink: false,
    resolvedTarget: null,
    repoRoot,
  })).toBe("missing");

  expect(extensionLinkState({
    exists: true,
    isSymlink: true,
    resolvedTarget: repoRoot,
    repoRoot,
  })).toBe("ours");

  expect(extensionLinkState({
    exists: true,
    isSymlink: true,
    resolvedTarget: "/repo/another-extension",
    repoRoot,
  })).toBe("conflict");

  expect(extensionLinkState({
    exists: true,
    isSymlink: false,
    resolvedTarget: null,
    repoRoot,
  })).toBe("conflict");

  expect(extensionLinkState({
    exists: true,
    isSymlink: true,
    resolvedTarget: null,
    repoRoot,
  })).toBe("conflict");
});

test("Collector 文件用首行标记区分归属与版本", () => {
  const content = collectorFileContent("export default {};\n", "0.1.0");

  expect(content.startsWith(collectorHeader("0.1.0"))).toBe(true);
  expect(content.endsWith("export default {};\n")).toBe(true);
  expect(readCollectorVersion(content)).toBe("0.1.0");
  expect(classifyCollectorContent(content)).toBe("ours");
  expect(classifyCollectorContent(null)).toBe("missing");
  expect(classifyCollectorContent("export default {};\n")).toBe("conflict");
});

test("Collector 标记只在文件开头生效", () => {
  expect(readCollectorVersion("// @context-map-collector v0.1.0\nexport default {};\n")).toBe("0.1.0");
  expect(readCollectorVersion("export default {};\n// @context-map-collector v0.1.0\n")).toBeNull();
  expect(readCollectorVersion("const note = \"// @context-map-collector v0.1.0\";\n")).toBeNull();
});

test("extensions.json 只接受宿主认识的字段形状", () => {
  expect(parseExtensionStore({ paths: [] })).toEqual({ paths: [] });
  expect(parseExtensionStore({
    paths: ["/extensions/a"],
    sources: { "/extensions/a": "path" },
    capabilityGrants: { a: ["service"] },
    capabilityScopes: { a: { service: { exec: [], sockets: [] } } },
  })).not.toBeNull();

  expect(parseExtensionStore(null)).toBeNull();
  expect(parseExtensionStore({})).toBeNull();
  expect(parseExtensionStore({ paths: ["/extensions/a", ""] })).toBeNull();
  expect(parseExtensionStore({ paths: [], sources: [] })).toBeNull();
  expect(parseExtensionStore({ paths: [], capabilityGrants: { a: "service" } })).toBeNull();
});

test("首次登记扩展时写入路径、service 授权与空权限范围", () => {
  const store = { paths: ["/extensions/existing"] };
  const result = registerExtension(store, {
    path: "/extensions/context-map",
    guestId: EXTENSION_GUEST_ID,
    serviceScope: { exec: [], sockets: [] },
  });

  expect(result.added).toBe(true);
  expect(result.grantedService).toBe(true);
  expect(result.scopeUpdated).toBe(true);
  expect(result.changed).toBe(true);
  expect(result.store.paths).toEqual(["/extensions/existing", "/extensions/context-map"]);
  expect(result.store.capabilityGrants).toEqual({ [EXTENSION_GUEST_ID]: ["service"] });
  expect(result.store.capabilityScopes).toEqual({
    [EXTENSION_GUEST_ID]: { service: { exec: [], sockets: [] } },
  });
  expect(store.paths).toEqual(["/extensions/existing"]);
});

test("重复登记同一路径不会产生重复条目或重复授权", () => {
  const first = registerExtension({ paths: [] }, {
    path: "/extensions/context-map",
    guestId: EXTENSION_GUEST_ID,
    serviceScope: { exec: [], sockets: [] },
  });
  const second = registerExtension(first.store, {
    path: "/extensions/context-map",
    guestId: EXTENSION_GUEST_ID,
    serviceScope: { exec: [], sockets: [] },
  });

  expect(second.added).toBe(false);
  expect(second.grantedService).toBe(false);
  expect(second.scopeUpdated).toBe(false);
  expect(second.changed).toBe(false);
  expect(second.store).toBe(first.store);
  expect(second.store.paths).toEqual(["/extensions/context-map"]);
  expect(second.store.capabilityGrants).toEqual({ [EXTENSION_GUEST_ID]: ["service"] });
});

test("已授权 service 时新增路径会同步权限范围", () => {
  const store = {
    paths: ["/extensions/old"],
    capabilityGrants: { [EXTENSION_GUEST_ID]: ["service"] },
    capabilityScopes: { [EXTENSION_GUEST_ID]: { service: { exec: ["ps"], sockets: [] } } },
  };
  const result = registerExtension(store, {
    path: "/extensions/new",
    guestId: EXTENSION_GUEST_ID,
    serviceScope: { exec: [], sockets: [] },
  });

  expect(result.added).toBe(true);
  expect(result.grantedService).toBe(false);
  expect(result.scopeUpdated).toBe(true);
  expect(result.changed).toBe(true);
  expect(result.store.paths).toEqual(["/extensions/old", "/extensions/new"]);
  expect(result.store.capabilityScopes).toEqual({
    [EXTENSION_GUEST_ID]: { service: { exec: [], sockets: [] } },
  });
});

test("同步 service 权限范围时保留未知子字段", () => {
  const store = {
    paths: ["/extensions/context-map"],
    capabilityGrants: { [EXTENSION_GUEST_ID]: ["service"] },
    capabilityScopes: {
      [EXTENSION_GUEST_ID]: { service: { exec: ["ps"], sockets: [], note: "keep" } },
    },
  };
  const result = registerExtension(store, {
    path: "/extensions/context-map",
    guestId: EXTENSION_GUEST_ID,
    serviceScope: { exec: ["lsof"], sockets: ["s1"] },
  });

  expect(result.scopeUpdated).toBe(true);
  expect(result.store.capabilityScopes).toEqual({
    [EXTENSION_GUEST_ID]: { service: { exec: ["lsof"], sockets: ["s1"], note: "keep" } },
  });
});

test("已登记但缺少 service 授权时会补授并写入范围", () => {
  const store = { paths: ["/extensions/context-map"] };
  const result = registerExtension(store, {
    path: "/extensions/context-map",
    guestId: EXTENSION_GUEST_ID,
    serviceScope: { exec: [], sockets: [] },
  });

  expect(result.added).toBe(false);
  expect(result.grantedService).toBe(true);
  expect(result.scopeUpdated).toBe(true);
  expect(result.changed).toBe(true);
  expect(result.store.paths).toEqual(["/extensions/context-map"]);
  expect(result.store.capabilityGrants).toEqual({ [EXTENSION_GUEST_ID]: ["service"] });
  expect(result.store.capabilityScopes).toEqual({
    [EXTENSION_GUEST_ID]: { service: { exec: [], sockets: [] } },
  });
});

test("已登记且权限范围过期时会同步为当前 manifest 的值", () => {
  const store = {
    paths: ["/extensions/context-map"],
    capabilityGrants: { [EXTENSION_GUEST_ID]: ["service"] },
    capabilityScopes: { [EXTENSION_GUEST_ID]: { service: { exec: ["ps"], sockets: [] } } },
  };
  const result = registerExtension(store, {
    path: "/extensions/context-map",
    guestId: EXTENSION_GUEST_ID,
    serviceScope: { exec: [], sockets: [] },
  });

  expect(result.added).toBe(false);
  expect(result.grantedService).toBe(false);
  expect(result.scopeUpdated).toBe(true);
  expect(result.changed).toBe(true);
  expect(result.store.capabilityScopes).toEqual({
    [EXTENSION_GUEST_ID]: { service: { exec: [], sockets: [] } },
  });
});

test("权限范围按 host 的排序去重口径比较", () => {
  const store = {
    paths: ["/extensions/context-map"],
    capabilityGrants: { [EXTENSION_GUEST_ID]: ["service"] },
    capabilityScopes: {
      [EXTENSION_GUEST_ID]: { service: { exec: ["lsof", "ps"], sockets: ["a", "b"] } },
    },
  };
  const result = registerExtension(store, {
    path: "/extensions/context-map",
    guestId: EXTENSION_GUEST_ID,
    serviceScope: { exec: ["ps", "ps", "lsof"], sockets: ["a", "b"] },
  });

  expect(result.changed).toBe(false);
  expect(result.scopeUpdated).toBe(false);
});

test("卸载移除路径与来源，并在没有其它安装时清理 guest 数据", () => {
  const store = {
    paths: ["/extensions/context-map", "/extensions/other"],
    sources: { "/extensions/context-map": "path", "/extensions/other": "git" },
    gitOrigins: { "/extensions/context-map": { url: "x" }, "/extensions/other": { url: "y" } },
    capabilityGrants: { [EXTENSION_GUEST_ID]: ["service"], other: ["service"] },
    capabilityScopes: { [EXTENSION_GUEST_ID]: { service: { exec: [], sockets: [] } }, other: {} },
    disabledGuests: { [EXTENSION_GUEST_ID]: true },
    storageIds: { [EXTENSION_GUEST_ID]: "id", other: "id" },
  };
  const result = unregisterExtension(store, {
    path: "/extensions/context-map",
    guestId: EXTENSION_GUEST_ID,
    guestStillInstalled: false,
  });

  expect(result.removedPath).toBe(true);
  expect(result.removedGuest).toBe(true);
  expect(result.store.paths).toEqual(["/extensions/other"]);
  expect(result.store.sources).toEqual({ "/extensions/other": "git" });
  expect(result.store.gitOrigins).toEqual({ "/extensions/other": { url: "y" } });
  expect(result.store.capabilityGrants).toEqual({ other: ["service"] });
  expect(result.store.capabilityScopes).toEqual({ other: {} });
  expect(result.store.disabledGuests).toEqual({});
  expect(result.store.storageIds).toEqual({ other: "id" });
});

test("同一 guest 还有其它安装时保留授权与存储 id", () => {
  const store = {
    paths: ["/extensions/context-map", "/extensions/context-map-copy"],
    capabilityGrants: { [EXTENSION_GUEST_ID]: ["service"] },
    capabilityScopes: { [EXTENSION_GUEST_ID]: { service: { exec: [], sockets: [] } } },
    storageIds: { [EXTENSION_GUEST_ID]: "id" },
  };
  const result = unregisterExtension(store, {
    path: "/extensions/context-map",
    guestId: EXTENSION_GUEST_ID,
    guestStillInstalled: true,
  });

  expect(result.removedPath).toBe(true);
  expect(result.removedGuest).toBe(false);
  expect(result.store.paths).toEqual(["/extensions/context-map-copy"]);
  expect(result.store.capabilityGrants).toEqual({ [EXTENSION_GUEST_ID]: ["service"] });
  expect(result.store.capabilityScopes).toEqual({ [EXTENSION_GUEST_ID]: { service: { exec: [], sockets: [] } } });
  expect(result.store.storageIds).toEqual({ [EXTENSION_GUEST_ID]: "id" });
});
