import { randomBytes } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { homedir } from "node:os";
import { dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyCollectorContent,
  collectorFileContent,
  collectorInstallPath,
} from "../shared/collector-file.ts";
import {
  readDiscoveryEntries,
  removeDiscovery,
  resolveDiscoveryDir,
} from "../shared/discovery.ts";
import type { CollectorStatus, DiscoveryRecord } from "../shared/types.ts";
import {
  COLLECTOR_VERSION,
  collectorVersionOutdated,
  SERVICE_PORT_ENV,
  SERVICE_TOKEN_ENV,
} from "../shared/version.ts";

const PROBE_TIMEOUT_MS = 1_000;
const FORWARD_TIMEOUT_MS = 3_000;
const ROUTE_CACHE_MS = 2_000;

function fail(message: string): never {
  console.error(`[context-map] ${message}`);
  process.exit(1);
}

const portText = process.env[SERVICE_PORT_ENV];
const token = process.env[SERVICE_TOKEN_ENV];
if (!portText) fail(`缺少环境变量 ${SERVICE_PORT_ENV}`);
if (!token) fail(`缺少环境变量 ${SERVICE_TOKEN_ENV}`);

const port = Number.parseInt(portText, 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535) fail(`无效的端口：${portText}`);

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function collectorSourceCandidates(): string[] {
  return [
    fileURLToPath(new URL("../collector/main.js", import.meta.url)),
    fileURLToPath(new URL("../../collector/main.js", import.meta.url)),
  ];
}

/** 读取随扩展发布的 Collector 构建产物；Service 从 `service/` 或 `src/service/` 启动时都能找到。 */
async function readCollectorSource(): Promise<string> {
  const candidates = collectorSourceCandidates();
  for (const candidate of candidates) {
    try {
      const info = await lstat(candidate);
      if (info.isFile()) return await readFile(candidate, "utf8");
    } catch {
      // 继续尝试下一个候选路径。
    }
  }
  throw new Error(`找不到 Collector 构建产物：${candidates.join(", ")}`);
}

/**
 * 把扩展自带的 Collector 写到 OpenCode 插件目录。
 * 只覆盖缺失文件或本工具生成的文件；用户自己的文件一律返回冲突，保持原样。
 */
async function installCollectorFile(response: ServerResponse): Promise<void> {
  const target = collectorInstallPath(homedir(), process.env);
  if (!isAbsolute(target)) {
    sendJson(response, 500, { error: "collector_install_failed" });
    return;
  }

  let existing: string | null = null;
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isFile()) {
      sendJson(response, 409, { error: "collector_conflict", path: target });
      return;
    }
    existing = await readFile(target, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (classifyCollectorContent(existing) === "conflict") {
    sendJson(response, 409, { error: "collector_conflict", path: target });
    return;
  }

  const content = collectorFileContent(await readCollectorSource(), COLLECTOR_VERSION);
  if (existing === content) {
    sendJson(response, 200, {
      ok: true,
      path: target,
      version: COLLECTOR_VERSION,
      changed: false,
    });
    return;
  }

  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
  try {
    await writeFile(temporary, content, { mode: 0o600 });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }

  sendJson(response, 200, {
    ok: true,
    path: target,
    version: COLLECTOR_VERSION,
    changed: true,
  });
}

async function probeCollector(record: DiscoveryRecord): Promise<CollectorStatus | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${record.port}/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { ok?: unknown; version?: unknown };
    if (body.ok !== true) return null;
    const version = typeof body.version === "string" ? body.version : record.version;
    if (collectorVersionOutdated(version)) {
      return {
        connected: true,
        version,
        outdated: true,
        expectedVersion: COLLECTOR_VERSION,
      };
    }
    return { connected: true, version };
  } catch {
    return null;
  }
}

interface ResolvedRoute {
  /** 所有探活通过的 Collector，最新的排在前面。 */
  collectors: DiscoveryRecord[];
  status: CollectorStatus;
}

interface CachedRoute extends ResolvedRoute {
  expiresAt: number;
}

/**
 * 全量扫描 discovery：探活失败的条目是 stale discovery，尽量删掉后跳过。
 * 删除失败只影响 reason 的措辞，不阻塞其它 Collector。
 */
async function resolveRoute(): Promise<ResolvedRoute> {
  const entries = await readDiscoveryEntries(resolveDiscoveryDir());
  if (entries.length === 0) {
    return { collectors: [], status: { connected: false, reason: "not_found" } };
  }

  const probed = await Promise.all(
    entries.map(async (entry) => ({ entry, status: await probeCollector(entry.record) })),
  );

  let undeleted = false;
  const live: Array<{ entry: (typeof entries)[number]; status: CollectorStatus }> = [];
  for (const item of probed) {
    if (item.status !== null) {
      live.push({ entry: item.entry, status: item.status });
      continue;
    }
    try {
      // 只删刚探测过的记录：探活期间同进程的新实例可能已重写该文件。
      await removeDiscovery(item.entry.file, item.entry.record);
    } catch {
      undeleted = true;
    }
  }

  const first = live[0];
  if (!first) {
    return {
      collectors: [],
      status: { connected: false, reason: undeleted ? "unreachable" : "not_found" },
    };
  }
  return { collectors: live.map((item) => item.entry.record), status: first.status };
}

let cachedRoute: CachedRoute | null = null;

/** 路由与健康状态共用 2 秒缓存，避免面板轮询时反复探测全部 discovery。 */
async function route(): Promise<CachedRoute> {
  if (cachedRoute && cachedRoute.expiresAt > Date.now()) return cachedRoute;
  const resolved = await resolveRoute();
  cachedRoute = { ...resolved, expiresAt: Date.now() + ROUTE_CACHE_MS };
  return cachedRoute;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

/**
 * 依次询问探活通过的 Collector，第一个返回 200 的胜出。
 * 同一个 session 只属于一个 Collector，所以 404 要继续找下一个。
 * 总预算 3 秒，多个 Collector 共享，避免面板等待时间随实例数增长。
 */
async function forward(
  response: ServerResponse,
  path: "/summary" | "/item",
  params: Record<string, string>,
): Promise<void> {
  let collectors: DiscoveryRecord[];
  try {
    collectors = (await route()).collectors;
  } catch {
    sendJson(response, 503, { error: "collector_unavailable" });
    return;
  }
  if (collectors.length === 0) {
    sendJson(response, 503, { error: "collector_unavailable" });
    return;
  }

  const query = new URLSearchParams(params).toString();
  const deadline = Date.now() + FORWARD_TIMEOUT_MS;
  let sawNotFound = false;
  let sawTimeout = false;

  for (const collector of collectors) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      sawTimeout = true;
      break;
    }

    try {
      const upstream = await fetch(`http://127.0.0.1:${collector.port}${path}?${query}`, {
        headers: { Authorization: `Bearer ${collector.token}` },
        signal: AbortSignal.timeout(remaining),
      });

      if (upstream.status === 200) {
        const body = await upstream.text();
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        response.end(body);
        return;
      }

      if (upstream.status === 400) {
        sendJson(response, 400, { error: "bad_request" });
        return;
      }
      if (upstream.status === 404) {
        sawNotFound = true;
      }
    } catch (error) {
      if (isTimeout(error)) sawTimeout = true;
    }
  }

  if (sawNotFound && !sawTimeout) {
    sendJson(response, 404, { error: "no_snapshot" });
    return;
  }
  if (sawTimeout) {
    sendJson(response, 504, { error: "collector_timeout" });
    return;
  }
  sendJson(response, 503, { error: "collector_unavailable" });
}

const server = createServer((request, response) => {
  if (request.headers.authorization !== `Bearer ${token}`) {
    sendJson(response, 401, { error: "unauthorized" });
    return;
  }

  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;

  if (request.method === "POST" && path === "/collector/install") {
    void installCollectorFile(response).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[context-map] 安装 Collector 失败：${message}`);
      sendJson(response, 500, { error: "collector_install_failed" });
    });
    return;
  }

  if (request.method === "GET" && path === "/health") {
    void route().then((resolved) => {
      sendJson(response, 200, { ok: true, collector: resolved.status });
    });
    return;
  }

  if (request.method === "GET" && path === "/summary") {
    const sessionID = url.searchParams.get("sessionID")?.trim();
    if (!sessionID) {
      sendJson(response, 400, { error: "bad_request" });
      return;
    }
    void forward(response, "/summary", { sessionID });
    return;
  }

  if (request.method === "GET" && path === "/item") {
    const sessionID = url.searchParams.get("sessionID")?.trim();
    const itemId = url.searchParams.get("itemId")?.trim();
    if (!sessionID || !itemId) {
      sendJson(response, 400, { error: "bad_request" });
      return;
    }
    void forward(response, "/item", { sessionID, itemId });
    return;
  }

  sendJson(response, 404, { error: "not_found" });
});

// 启动时全量扫描一遍：清理 SIGKILL 留下的 stale discovery，并预热路由缓存。
await route();

server.listen(port, "127.0.0.1", () => {
  console.log(`[context-map] service listening on 127.0.0.1:${port}`);
});

const shutdown = (): void => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
