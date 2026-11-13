import { randomBytes } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";

import { removeDiscovery, resolveDiscoveryDir, writeDiscovery } from "../shared/discovery.ts";
import type { DiscoveryRecord } from "../shared/types.ts";
import { COLLECTOR_VERSION } from "../shared/version.ts";
import { BaselineStore } from "./baseline.ts";
import { enrichSnapshot, WindowResolver } from "./enrich.ts";
import type { PluginContext, SessionContext, SessionInfo } from "./opencode.ts";
import { persistenceEnabled, readSnapshots, resolveSnapshotDir, SnapshotWriter } from "./persist.ts";
import { SnapshotResolver } from "./resolver.ts";
import { baselineDraft, buildDraft } from "./snapshot.ts";
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

interface CollectorHandle {
  /** 每个尚未 cleanup 的 setup 持有一张票据；集合大小就是引用数。 */
  open: Set<object>;
  /** 关闭流程只跑一次，并让所有 cleanup 等它结束。 */
  shutdown: Promise<void> | null;
  dispose: () => Promise<void>;
}

/** 一个进程只跑一个 Collector；宿主重载插件时复用，避免多个实例共用 discovery 文件。 */
interface CollectorState {
  active: CollectorHandle | null;
  starting: Promise<CollectorHandle> | null;
}

/**
 * 宿主会在同一个进程里把插件加载成多个模块实例（各有一份模块级变量），
 * 所以复用状态放在 globalThis 上，按 symbol 取，避免和别的插件撞名。
 */
const COLLECTOR_STATE = Symbol.for("openchamber-context-map.collector");

function collectorState(): CollectorState {
  const holder = globalThis as unknown as Record<symbol, CollectorState | undefined>;
  return (holder[COLLECTOR_STATE] ??= { active: null, starting: null });
}

async function ensureCollector(rawContext: unknown): Promise<CollectorHandle> {
  const state = collectorState();
  if (state.active) return state.active;
  state.starting ??= startCollector(rawContext).finally(() => {
    state.starting = null;
  });
  return state.starting;
}

function makeCleanup(handle: CollectorHandle, ticket: object): () => Promise<void> {
  return async () => {
    await releaseCollector(handle, ticket);
  };
}

async function releaseCollector(handle: CollectorHandle, ticket: object): Promise<void> {
  if (!handle.open.delete(ticket)) return;
  if (handle.open.size > 0) return;
  const state = collectorState();
  handle.shutdown ??= (async () => {
    if (state.active === handle) state.active = null;
    await handle.dispose();
  })();
  await handle.shutdown;
}

async function startCollector(rawContext: unknown): Promise<CollectorHandle> {
  const context = (rawContext ?? {}) as PluginContext;
  const token = randomBytes(32).toString("hex");
  const store = new SnapshotStore();
  const baselines = new BaselineStore();
  const windows = new WindowResolver(context);
  const resolver = new SnapshotResolver({
    store,
    baselines,
    loadSession: async (sessionID) => {
      const get = context.session?.get;
      if (!get) return null;
      try {
        const info = (await get.call(context.session, { sessionID })) as
          | SessionInfo
          | null
          | undefined;
        return info ?? null;
      } catch {
        return null;
      }
    },
    resolveWindow: (ref) => windows.resolve(ref),
  });
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

        if (path === "/summary") {
          const summary = await resolver.resolveSummary(sessionID);
          if (!summary) {
            sendJson(response, 404, { error: "not_found" });
            return;
          }
          sendJson(response, 200, summary);
          return;
        }

        const detail = await resolver.resolveItem(sessionID, itemId ?? "");
        if (!detail) {
          sendJson(response, 404, { error: "not_found" });
          return;
        }
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

  const handle: CollectorHandle = {
    open: new Set<object>(),
    shutdown: null,
    dispose: async () => {
      try {
        await hook?.dispose();
      } finally {
        try {
          await close(server);
        } finally {
          try {
            await writer.dispose();
          } finally {
            await removeDiscovery(discoveryFile, record);
          }
        }
      }
    },
  };
  collectorState().active = handle;
  return handle;
}

const collector: CollectorPlugin = {
  id: "context-map-collector",

  async setup(rawContext: unknown): Promise<() => Promise<void>> {
    const handle = await ensureCollector(rawContext);
    const ticket: object = {};
    handle.open.add(ticket);
    return makeCleanup(handle, ticket);
  },
};

export default collector;
