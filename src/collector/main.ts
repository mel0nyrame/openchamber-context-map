import { randomBytes } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";

import { removeDiscovery, resolveDiscoveryDir, writeDiscovery } from "../shared/discovery.ts";
import type { DiscoveryRecord } from "../shared/types.ts";
import { COLLECTOR_VERSION } from "../shared/version.ts";

interface CollectorPlugin {
  id: string;
  setup: (context: unknown) => Promise<() => Promise<void>>;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error);
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

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

const collector: CollectorPlugin = {
  id: "context-map-collector",

  async setup(): Promise<() => Promise<void>> {
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
    const record: DiscoveryRecord = {
      version: COLLECTOR_VERSION,
      port,
      token,
      pid: process.pid,
      startedAt: new Date().toISOString(),
    };

    let discoveryFile: string;
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
  },
};

export default collector;
