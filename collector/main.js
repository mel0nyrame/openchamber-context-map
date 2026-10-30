// src/collector/main.ts
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

// src/shared/discovery.ts
import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// src/shared/version.ts
var COLLECTOR_VERSION = "0.1.0";
var DISCOVERY_DIR_ENV = "CONTEXT_MAP_DISCOVERY_DIR";

// src/shared/discovery.ts
function resolveDiscoveryDir(env = process.env) {
  const override = env[DISCOVERY_DIR_ENV]?.trim();
  if (override)
    return override;
  return join(homedir(), ".local", "state", "openchamber-context-map", "collectors");
}
function discoveryFileName(pid) {
  return `collector-${pid}.json`;
}
async function writeDiscovery(dir, record) {
  await mkdir(dir, { recursive: true, mode: 448 });
  await chmod(dir, 448);
  const file = join(dir, discoveryFileName(record.pid));
  const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify(record), { mode: 384 });
  await chmod(temp, 384);
  await rename(temp, file);
  return file;
}
async function removeDiscovery(file) {
  await rm(file, { force: true });
}

// src/collector/main.ts
function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}
function listen(server) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Collector 未能取得监听端口"));
        return;
      }
      resolve(address.port);
    });
  });
}
function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
var collector = {
  id: "context-map-collector",
  async setup() {
    const token = randomBytes(32).toString("hex");
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      if (request.method === "GET" && path === "/health") {
        sendJson(response, 200, { ok: true, version: COLLECTOR_VERSION });
        return;
      }
      if (request.method === "GET" && (path === "/summary" || path === "/item")) {
        if (request.headers.authorization !== `Bearer ${token}`) {
          sendJson(response, 401, { error: "unauthorized" });
          return;
        }
        sendJson(response, 404, { error: "not_found" });
        return;
      }
      sendJson(response, 404, { error: "not_found" });
    });
    const port = await listen(server);
    const record = {
      version: COLLECTOR_VERSION,
      port,
      token,
      pid: process.pid,
      startedAt: new Date().toISOString()
    };
    let discoveryFile;
    try {
      discoveryFile = await writeDiscovery(resolveDiscoveryDir(), record);
    } catch (error) {
      await close(server);
      throw error;
    }
    return async () => {
      try {
        await close(server);
      } finally {
        await removeDiscovery(discoveryFile);
      }
    };
  }
};
var main_default = collector;
export {
  main_default as default
};
