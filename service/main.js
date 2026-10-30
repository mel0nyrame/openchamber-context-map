// src/service/main.ts
import { createServer } from "node:http";

// src/shared/discovery.ts
import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// src/shared/version.ts
var DISCOVERY_DIR_ENV = "CONTEXT_MAP_DISCOVERY_DIR";
var SERVICE_PORT_ENV = "OPENCHAMBER_SERVICE_PORT";
var SERVICE_TOKEN_ENV = "OPENCHAMBER_SERVICE_TOKEN";

// src/shared/discovery.ts
function resolveDiscoveryDir(env = process.env) {
  const override = env[DISCOVERY_DIR_ENV]?.trim();
  if (override)
    return override;
  return join(homedir(), ".local", "state", "openchamber-context-map", "collectors");
}
function isDiscoveryRecord(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const record = value;
  return typeof record.version === "string" && typeof record.port === "number" && Number.isInteger(record.port) && record.port > 0 && record.port <= 65535 && typeof record.token === "string" && typeof record.pid === "number" && typeof record.startedAt === "string";
}
async function readDiscoveryRecords(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const records = [];
  for (const name of names) {
    if (!name.endsWith(".json"))
      continue;
    try {
      const value = JSON.parse(await readFile(join(dir, name), "utf8"));
      if (isDiscoveryRecord(value))
        records.push(value);
    } catch {}
  }
  return records.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

// src/service/main.ts
var PROBE_TIMEOUT_MS = 1000;
var FORWARD_TIMEOUT_MS = 3000;
var ROUTE_CACHE_MS = 2000;
function fail(message) {
  console.error(`[context-map] ${message}`);
  process.exit(1);
}
var portText = process.env[SERVICE_PORT_ENV];
var token = process.env[SERVICE_TOKEN_ENV];
if (!portText)
  fail(`缺少环境变量 ${SERVICE_PORT_ENV}`);
if (!token)
  fail(`缺少环境变量 ${SERVICE_TOKEN_ENV}`);
var port = Number.parseInt(portText, 10);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  fail(`无效的端口：${portText}`);
function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}
async function probeCollector(record) {
  try {
    const response = await fetch(`http://127.0.0.1:${record.port}/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });
    if (!response.ok)
      return null;
    const body = await response.json();
    if (body.ok !== true)
      return null;
    return {
      connected: true,
      version: typeof body.version === "string" ? body.version : record.version
    };
  } catch {
    return null;
  }
}
async function collectorStatus() {
  const records = await readDiscoveryRecords(resolveDiscoveryDir());
  if (records.length === 0)
    return { connected: false, reason: "not_found" };
  const probed = await Promise.all(records.map((record) => probeCollector(record)));
  return probed.find((status) => status !== null) ?? { connected: false, reason: "unreachable" };
}
var cachedCollector = null;
async function activeCollector() {
  if (cachedCollector && cachedCollector.expiresAt > Date.now()) {
    return cachedCollector.record;
  }
  const records = await readDiscoveryRecords(resolveDiscoveryDir());
  const probed = await Promise.all(records.map(async (record) => ({ record, status: await probeCollector(record) })));
  const hit = probed.find((entry) => entry.status !== null);
  if (!hit) {
    cachedCollector = null;
    return null;
  }
  cachedCollector = { record: hit.record, expiresAt: Date.now() + ROUTE_CACHE_MS };
  return hit.record;
}
function isTimeout(error) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
async function forward(response, path, params) {
  try {
    const collector = await activeCollector();
    if (!collector) {
      sendJson(response, 503, { error: "collector_unavailable" });
      return;
    }
    const query = new URLSearchParams(params).toString();
    const upstream = await fetch(`http://127.0.0.1:${collector.port}${path}?${query}`, {
      headers: { Authorization: `Bearer ${collector.token}` },
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS)
    });
    if (upstream.status === 200) {
      const body = await upstream.text();
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
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
var server = createServer((request, response) => {
  if (request.headers.authorization !== `Bearer ${token}`) {
    sendJson(response, 401, { error: "unauthorized" });
    return;
  }
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;
  if (request.method === "GET" && path === "/health") {
    collectorStatus().then((collector) => {
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
    forward(response, "/summary", { sessionID });
    return;
  }
  if (request.method === "GET" && path === "/item") {
    const sessionID = url.searchParams.get("sessionID")?.trim();
    const itemId = url.searchParams.get("itemId")?.trim();
    if (!sessionID || !itemId) {
      sendJson(response, 400, { error: "bad_request" });
      return;
    }
    forward(response, "/item", { sessionID, itemId });
    return;
  }
  sendJson(response, 404, { error: "not_found" });
});
server.listen(port, "127.0.0.1", () => {
  console.log(`[context-map] service listening on 127.0.0.1:${port}`);
});
var shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
