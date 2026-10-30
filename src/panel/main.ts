import { connectHost, HostRequestError } from "@openchamber/sdk";
import { applyHostReady } from "@openchamber/sdk/ui";

const POLL_MS = 2_000;

const STYLE = `
  html, body { margin: 0; background: transparent; color: var(--oc-fg); font: 12px/1.4 var(--oc-font); }
  * { box-sizing: border-box; }
  html, body { height: 100%; overflow-y: auto; overflow-x: hidden; }
  #root { display: flex; flex-direction: column; gap: 14px; padding: 12px 12px 20px; }
  .head { display: flex; flex-direction: column; gap: 2px; }
  .title { font-size: 13px; font-weight: 600; }
  .subtitle { color: var(--oc-muted); font-size: 11px; }
  .status { display: flex; align-items: flex-start; gap: 8px; padding: 12px; border-radius: var(--oc-radius);
    background: color-mix(in srgb, var(--oc-fg) 4%, transparent); }
  .dot { flex: none; width: 7px; height: 7px; margin-top: 5px; border-radius: 50%; background: var(--oc-muted); }
  .status[data-state="connected"] .dot { background: var(--oc-success); }
  .status[data-state="disconnected"] .dot { background: var(--oc-warning, #d97706); }
  .status[data-state="failed"] .dot { background: var(--oc-error); }
  .status-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .status-title { font-weight: 600; }
  .status-detail { color: var(--oc-muted); font-size: 11px; }
  .placeholder { display: flex; flex-direction: column; gap: 4px; padding: 18px 12px;
    border-radius: var(--oc-radius); background: color-mix(in srgb, var(--oc-fg) 3%, transparent); }
  .placeholder-title { font-weight: 600; }
  .placeholder-detail { color: var(--oc-muted); font-size: 11px; }
  [hidden] { display: none !important; }
`;

type PanelState =
  | { kind: "checking" }
  | { kind: "connected"; version: string }
  | { kind: "disconnected"; reason: "not_found" | "unreachable" }
  | { kind: "failed"; title: string; detail: string };

interface HealthBody {
  collector?: {
    connected?: unknown;
    version?: unknown;
    reason?: unknown;
  };
}

const host = connectHost();
const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("Missing #root");

const style = document.createElement("style");
style.textContent = STYLE;
document.head.append(style);

const head = document.createElement("div");
head.className = "head";
const title = document.createElement("div");
title.className = "title";
title.textContent = "Context Map";
const subtitle = document.createElement("div");
subtitle.className = "subtitle";
subtitle.textContent = "最后一次请求的上下文构成";
head.append(title, subtitle);

const status = document.createElement("div");
status.className = "status";
status.dataset.state = "checking";
const dot = document.createElement("span");
dot.className = "dot";
const statusText = document.createElement("div");
statusText.className = "status-text";
const statusTitle = document.createElement("div");
statusTitle.className = "status-title";
const statusDetail = document.createElement("div");
statusDetail.className = "status-detail";
statusText.append(statusTitle, statusDetail);
status.append(dot, statusText);

const placeholder = document.createElement("div");
placeholder.className = "placeholder";
const placeholderTitle = document.createElement("div");
placeholderTitle.className = "placeholder-title";
placeholderTitle.textContent = "还没有上下文快照";
const placeholderDetail = document.createElement("div");
placeholderDetail.className = "placeholder-detail";
placeholderDetail.textContent = "发起一次请求后，这里会显示最后一次请求的构成。";
placeholder.append(placeholderTitle, placeholderDetail);

root.append(head, status, placeholder);

render({ kind: "checking" });

function versionLabel(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

function render(state: PanelState): void {
  status.dataset.state = state.kind;
  if (state.kind === "checking") {
    statusTitle.textContent = "正在连接本地 Service…";
    statusDetail.textContent = "首次打开面板时，Service 可能需要一点时间启动。";
    return;
  }
  if (state.kind === "connected") {
    statusTitle.textContent = `Collector 已连接 · ${versionLabel(state.version)}`;
    statusDetail.textContent = "快照会通过本地 Service 读取，bearer 不会进入面板。";
    return;
  }
  if (state.kind === "disconnected") {
    statusTitle.textContent = "Collector 未连接";
    statusDetail.textContent = state.reason === "not_found"
      ? "未找到采集器。启动 OpenCode 后会自动连接。"
      : "采集器没有响应。重启 OpenCode 后再试。";
    return;
  }
  statusTitle.textContent = state.title;
  statusDetail.textContent = state.detail;
}

function failureOf(error: unknown): { title: string; detail: string } {
  if (error instanceof HostRequestError) {
    if (error.code === "NO_SERVICE" || error.code === "NOT_GRANTED") {
      return {
        title: "本地 Service 未连接",
        detail: "在设置 → 扩展中允许 Context Map 的本地服务。",
      };
    }
    if (error.code === "DISABLED") {
      return { title: "Context Map 已暂停", detail: "在设置 → 扩展中重新启用。" };
    }
    if (error.code === "SERVICE_FAILED") {
      return { title: "本地 Service 已停止", detail: "它会在下次刷新时自动重启。" };
    }
  }
  return { title: "无法连接本地 Service", detail: "请确认 OpenChamber 正在运行。" };
}

let inflight = false;

async function poll(): Promise<void> {
  if (inflight) return;
  inflight = true;
  try {
    const result = await host.serviceRequest({ method: "GET", path: "/health" });
    let body: HealthBody | null = null;
    try {
      body = JSON.parse(result.body) as HealthBody;
    } catch {
      body = null;
    }

    if (result.status !== 200 || !body?.collector) {
      render({ kind: "failed", title: "本地 Service 返回了意外结果", detail: "请稍后重试，或重新加载面板。" });
      return;
    }

    const collector = body.collector;
    if (collector.connected === true && typeof collector.version === "string") {
      render({ kind: "connected", version: collector.version });
      return;
    }

    render({
      kind: "disconnected",
      reason: collector.reason === "unreachable" ? "unreachable" : "not_found",
    });
  } catch (error) {
    const failure = failureOf(error);
    render({ kind: "failed", ...failure });
  } finally {
    inflight = false;
  }
}

let started = false;

host.onReady((context) => {
  applyHostReady(context, document.documentElement);
  if (started) return;
  started = true;
  void poll();
  setInterval(() => { void poll(); }, POLL_MS);
});
