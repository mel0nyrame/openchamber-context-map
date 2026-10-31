// src/service/main.ts
import { createServer } from "node:http";

// src/shared/discovery.ts
import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// src/shared/version.ts
var COLLECTOR_VERSION = "0.2.0";
function normalizeCollectorVersion(value) {
  return value.trim().replace(/^v/i, "");
}
function collectorVersionOutdated(actual, expected = COLLECTOR_VERSION) {
  return normalizeCollectorVersion(actual) !== normalizeCollectorVersion(expected);
}
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
async function removeDiscovery(file) {
  await rm(file, { force: true });
}
function isDiscoveryRecord(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const record = value;
  return typeof record.version === "string" && typeof record.port === "number" && Number.isInteger(record.port) && record.port > 0 && record.port <= 65535 && typeof record.token === "string" && typeof record.pid === "number" && typeof record.startedAt === "string";
}
async function readDiscoveryEntries(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const entries = [];
  for (const name of names) {
    if (!name.endsWith(".json"))
      continue;
    const file = join(dir, name);
    try {
      const value = JSON.parse(await readFile(file, "utf8"));
      if (isDiscoveryRecord(value))
        entries.push({ file, record: value });
    } catch {}
  }
  return entries.sort((a, b) => Date.parse(b.record.startedAt) - Date.parse(a.record.startedAt));
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
    const version = typeof body.version === "string" ? body.version : record.version;
    if (collectorVersionOutdated(version)) {
      return {
        connected: true,
        version,
        outdated: true,
        expectedVersion: COLLECTOR_VERSION
      };
    }
    return { connected: true, version };
  } catch {
    return null;
  }
}
async function resolveRoute() {
  const entries = await readDiscoveryEntries(resolveDiscoveryDir());
  if (entries.length === 0) {
    return { collectors: [], status: { connected: false, reason: "not_found" } };
  }
  const probed = await Promise.all(entries.map(async (entry) => ({ entry, status: await probeCollector(entry.record) })));
  let undeleted = false;
  const live = [];
  for (const item of probed) {
    if (item.status !== null) {
      live.push({ entry: item.entry, status: item.status });
      continue;
    }
    try {
      await removeDiscovery(item.entry.file);
    } catch {
      undeleted = true;
    }
  }
  const first = live[0];
  if (!first) {
    return {
      collectors: [],
      status: { connected: false, reason: undeleted ? "unreachable" : "not_found" }
    };
  }
  return { collectors: live.map((item) => item.entry.record), status: first.status };
}
var cachedRoute = null;
async function route() {
  if (cachedRoute && cachedRoute.expiresAt > Date.now())
    return cachedRoute;
  const resolved = await resolveRoute();
  cachedRoute = { ...resolved, expiresAt: Date.now() + ROUTE_CACHE_MS };
  return cachedRoute;
}
function isTimeout(error) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
async function forward(response, path, params) {
  let collectors;
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
        signal: AbortSignal.timeout(remaining)
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
        sawNotFound = true;
      }
    } catch (error) {
      if (isTimeout(error))
        sawTimeout = true;
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
var server = createServer((request, response) => {
  if (request.headers.authorization !== `Bearer ${token}`) {
    sendJson(response, 401, { error: "unauthorized" });
    return;
  }
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;
  if (request.method === "GET" && path === "/health") {
    route().then((resolved) => {
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
await route();
server.listen(port, "127.0.0.1", () => {
  console.log(`[context-map] service listening on 127.0.0.1:${port}`);
});
var shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
