import { randomBytes } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";

import { removeDiscovery, resolveDiscoveryDir, writeDiscovery } from "../shared/discovery.ts";
import type { DiscoveryRecord, SnapshotItemDetail } from "../shared/types.ts";
import { COLLECTOR_VERSION } from "../shared/version.ts";
import { enrichSnapshot, WindowResolver } from "./enrich.ts";
import type { PluginContext, SessionContext } from "./opencode.ts";
import { buildDraft } from "./snapshot.ts";
import { SnapshotStore } from "./store.ts";

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

  async setup(rawContext: unknown): Promise<() => Promise<void>> {
    const context = (rawContext ?? {}) as PluginContext;
    const token = randomBytes(32).toString("hex");
    const store = new SnapshotStore();
    const windows = new WindowResolver(context);

    const hook = context.session?.hook
      ? await context.session.hook("context", (sessionContext: SessionContext) => {
          // 请求路径上只做同步计数、切片和内存写入；异步补齐放到 hook 之外。
          const record = store.add(buildDraft(sessionContext, new Date().toISOString()));
          void enrichSnapshot(context, store, windows, record).catch(() => {});
        })
      : null;

    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const path = url.pathname;

      if (request.method === "GET" && path === "/health") {
        sendJson(response, 200, { ok: true, version: COLLECTOR_VERSION });
        return;
      }

      if (request.method === "GET" && (path === "/summary" || path === "/item")) {
        if (request.headers.authorization !== `Bearer ${token}`) {
          sendJson(response, 401, { error: "unauthorized" });
          return;
        }

        const sessionID = url.searchParams.get("sessionID");
        if (!sessionID) {
          sendJson(response, 400, { error: "bad_request" });
          return;
        }

        const itemId = path === "/item" ? url.searchParams.get("itemId") : null;
        if (path === "/item" && !itemId) {
          sendJson(response, 400, { error: "bad_request" });
          return;
        }

        const record = store.get(sessionID);
        if (!record) {
          sendJson(response, 404, { error: "not_found" });
          return;
        }

        if (path === "/summary") {
          sendJson(response, 200, record.summary);
          return;
        }

        const item = record.draft.items.find((candidate) => candidate.id === itemId);
        if (!item) {
          sendJson(response, 404, { error: "not_found" });
          return;
        }
        const detail: SnapshotItemDetail = {
          id: item.id,
          title: item.title,
          chars: item.chars,
          text: item.text,
        };
        sendJson(response, 200, detail);
        return;
      }

      sendJson(response, 404, { error: "not_found" });
    });

    let port: number;
    try {
      port = await listen(server);
    } catch (error) {
      await hook?.dispose();
      throw error;
    }
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
      await hook?.dispose();
      await close(server);
      throw error;
    }

    return async () => {
      try {
        await hook?.dispose();
      } finally {
        try {
          await close(server);
        } finally {
          await removeDiscovery(discoveryFile);
        }
      }
    };
  },
};

export default collector;
