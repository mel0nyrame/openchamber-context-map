import { createServer, type ServerResponse } from "node:http";

import { readDiscoveryRecords, resolveDiscoveryDir } from "../shared/discovery.ts";
import type { CollectorStatus, DiscoveryRecord } from "../shared/types.ts";
import { SERVICE_PORT_ENV, SERVICE_TOKEN_ENV } from "../shared/version.ts";

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

async function probeCollector(record: DiscoveryRecord): Promise<CollectorStatus | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${record.port}/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { ok?: unknown; version?: unknown };
    if (body.ok !== true) return null;
    return {
      connected: true,
      version: typeof body.version === "string" ? body.version : record.version,
    };
  } catch {
    return null;
  }
}

async function collectorStatus(): Promise<CollectorStatus> {
  const records = await readDiscoveryRecords(resolveDiscoveryDir());
  if (records.length === 0) return { connected: false, reason: "not_found" };

  const probed = await Promise.all(records.map((record) => probeCollector(record)));
  return probed.find((status): status is CollectorStatus => status !== null)
    ?? { connected: false, reason: "unreachable" };
}

let cachedCollector: { record: DiscoveryRecord; expiresAt: number } | null = null;

/** 路由解析结果缓存 2 秒，避免每次面板轮询都重新探测全部 discovery。 */
async function activeCollector(): Promise<DiscoveryRecord | null> {
  if (cachedCollector && cachedCollector.expiresAt > Date.now()) {
    return cachedCollector.record;
  }

  const records = await readDiscoveryRecords(resolveDiscoveryDir());
  const probed = await Promise.all(
    records.map(async (record) => ({ record, status: await probeCollector(record) })),
  );
  const hit = probed.find((entry) => entry.status !== null);
  if (!hit) {
    cachedCollector = null;
    return null;
  }

  cachedCollector = { record: hit.record, expiresAt: Date.now() + ROUTE_CACHE_MS };
  return hit.record;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function forward(
  response: ServerResponse,
  path: "/summary" | "/item",
  params: Record<string, string>,
): Promise<void> {
  try {
    const collector = await activeCollector();
    if (!collector) {
      sendJson(response, 503, { error: "collector_unavailable" });
      return;
    }

    const query = new URLSearchParams(params).toString();
    const upstream = await fetch(`http://127.0.0.1:${collector.port}${path}?${query}`, {
      headers: { Authorization: `Bearer ${collector.token}` },
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
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
      sendJson(response, 404, { error: "no_snapshot" });
      return;
    }
    sendJson(response, 503, { error: "collector_unavailable" });
  } catch (error) {
    if (isTimeout(error)) {
      sendJson(response, 504, { error: "collector_timeout" });
      return;
    }
    sendJson(response, 503, { error: "collector_unavailable" });
  }
}

const server = createServer((request, response) => {
  if (request.headers.authorization !== `Bearer ${token}`) {
    sendJson(response, 401, { error: "unauthorized" });
    return;
  }

  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;

  if (request.method === "GET" && path === "/health") {
    void collectorStatus().then((collector) => {
      sendJson(response, 200, { ok: true, collector });
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

server.listen(port, "127.0.0.1", () => {
  console.log(`[context-map] service listening on 127.0.0.1:${port}`);
});

const shutdown = (): void => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
