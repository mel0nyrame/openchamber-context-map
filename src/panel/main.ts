import { connectHost, type SessionSnapshot } from "@openchamber/sdk";
import { applyHostReady } from "@openchamber/sdk/ui";

import {
  type SnapshotItemDetail,
} from "../shared/types.ts";
import { parseSnapshotItemDetail } from "../shared/snapshot.ts";
import { resolveLocale } from "./i18n.ts";
import {
  createPanelModel,
  type ItemLoadResult,
} from "./model.ts";
import {
  createRefreshController,
  type RefreshController,
} from "./refresh.ts";
import { createRefreshRun } from "./refresh-run.ts";
import { applySessionSnapshot } from "./session.ts";
import { createPanelView } from "./view.ts";

const host = connectHost();
const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("Missing #root");

let currentSessionID: string | null = null;
let refreshController: RefreshController;

const model = createPanelModel({
  loadItem: loadItemDetail,
  onPreviewMissing: () => refreshController.refresh("event"),
});
const runRefresh = createRefreshRun({
  request: (request) => host.serviceRequest(request),
  model,
});
refreshController = createRefreshController({
  visible: document.visibilityState !== "hidden",
  run: runRefresh,
  onChange: (next) => model.setRefresh(next),
});
const panelView = createPanelView({
  root,
  model,
  onManualRefresh: () => refreshController.refresh("manual"),
});

function parseItemDetail(body: string): SnapshotItemDetail | null {
  try {
    return parseSnapshotItemDetail(JSON.parse(body) as unknown);
  } catch {
    return null;
  }
}

async function loadItemDetail(sessionID: string, itemId: string): Promise<ItemLoadResult> {
  try {
    const result = await host.serviceRequest({
      method: "GET",
      path: "/item",
      query: { sessionID, itemId },
    });
    if (result.status === 404) return { kind: "missing" };
    if (result.status !== 200) return { kind: "read-error" };
    const detail = parseItemDetail(result.body);
    return detail === null ? { kind: "bad-format" } : { kind: "ok", detail };
  } catch {
    return { kind: "read-error" };
  }
}

function applySession(next: SessionSnapshot | null): void {
  currentSessionID = applySessionSnapshot(
    { model, controller: refreshController },
    currentSessionID,
    next,
  );
}

// SDK 2.5.3 没有面板可见性或卸载回调。iframe 被移除时计时器随文档销毁；
// 顶层页面隐藏/恢复用 visibilitychange，bfcache 用 pagehide/pageshow。
document.addEventListener("visibilitychange", () => {
  refreshController.setVisible(document.visibilityState !== "hidden");
});
window.addEventListener("pagehide", () => {
  refreshController.setVisible(false);
});
window.addEventListener("pageshow", () => {
  refreshController.setVisible(document.visibilityState !== "hidden");
});

host.onSession((next) => {
  applySession(next);
});

host.onSessionLifecycle((event) => {
  // 控制器负责忙碌状态、空闲时停表，以及为当前 session 请求事件刷新。
  refreshController.setLifecycle(event.sessionId, event.phase);
});

host.onReady((context) => {
  applyHostReady(context, document.documentElement);
  panelView.setLocale(resolveLocale(context.locale));
  model.setBooted(true);
  applySession(context.session);
  refreshController.start();
});
