import { randomBytes } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";

import { removeDiscovery, resolveDiscoveryDir, writeDiscovery } from "../shared/discovery.ts";
import type { DiscoveryRecord, SnapshotItemDetail } from "../shared/types.ts";
import { COLLECTOR_VERSION } from "../shared/version.ts";
import { BaselineStore, baselineSummary, type BaselineTemplate } from "./baseline.ts";
import { enrichSnapshot, WindowResolver } from "./enrich.ts";
import { modelRefID, type PluginContext, type SessionContext, type SessionInfo } from "./opencode.ts";
import { persistenceEnabled, readSnapshots, resolveSnapshotDir, SnapshotWriter } from "./persist.ts";
import { baselineDraft, buildDraft, DEFAULT_WINDOW } from "./snapshot.ts";
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
    const baselines = new BaselineStore();
    const windows = new WindowResolver(context);
    const persistDir = persistenceEnabled() ? resolveSnapshotDir() : null;
    const writer = new SnapshotWriter(persistDir);
    if (persistDir) {
      // 只恢复骨架；正文预览没有落盘，/item 会返回 404。
      for (const summary of await readSnapshots(persistDir).catch(() => [])) {
        store.restore(summary);
      }
    }

    const hook = context.session?.hook
      ? await context.session.hook("context", (sessionContext: SessionContext) => {
          // 请求路径上只做同步计数、切片和内存写入；异步补齐放到 hook 之外。
          const draft = buildDraft(sessionContext, new Date().toISOString());
          if (typeof sessionContext.agent === "string" && sessionContext.agent) {
            baselines.remember(sessionContext.agent, baselineDraft(draft));
          }
          const record = store.add(draft);
          void enrichSnapshot(context, store, windows, record)
            .then((summary) => {
              if (summary) writer.schedule(summary);
            })
            .catch(() => {});
        })
      : null;

    /** 真实快照出现前，用当前 session 的 agent + model 找最近一次请求的模板。 */
    const resolveBaselineTemplate = async (sessionID: string): Promise<BaselineTemplate | null> => {
      const get = context.session?.get;
      if (!get) return null;
      let info: SessionInfo | null | undefined;
      try {
        info = (await get.call(context.session, { sessionID })) as SessionInfo | null | undefined;
      } catch {
        return null;
      }
      const agent = typeof info?.agent === "string" ? info.agent : "";
      const ref = info?.model;
      if (!agent || !ref || typeof ref.providerID !== "string" || !modelRefID(ref)) {
        return null;
      }
      return baselines.get(agent, ref) ?? null;
    };

    const server = createServer(async (request, response) => {
      try {
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

          if (path === "/summary") {
            if (record) {
              sendJson(response, 200, record.summary);
              return;
            }
            const template = await resolveBaselineTemplate(sessionID);
            if (!template) {
              sendJson(response, 404, { error: "not_found" });
              return;
            }
            const resolved = await windows
              .resolve(template.modelRef)
              .catch(() => ({ window: DEFAULT_WINDOW, assumed: true }));
            sendJson(
              response,
              200,
              baselineSummary(template, sessionID, resolved.window, resolved.assumed),
            );
            return;
          }

          const items = record
            ? record.draft?.items
            : (await resolveBaselineTemplate(sessionID))?.items;
          const item = items?.find((candidate) => candidate.id === itemId);
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
      } catch {
        if (!response.headersSent) {
          sendJson(response, 500, { error: "internal" });
        } else {
          response.end();
        }
      }
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
          try {
            await writer.dispose();
          } finally {
            await removeDiscovery(discoveryFile);
          }
        }
      }
    };
  },
};

export default collector;
