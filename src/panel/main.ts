import { connectHost, HostRequestError, type SessionSnapshot } from "@openchamber/sdk";
import { applyHostReady, mountBadge, mountProgress } from "@openchamber/sdk/ui";

import type { SnapshotSummary } from "../shared/types.ts";

const POLL_MS = 2_000;

const STYLE = `
  html, body { margin: 0; background: transparent; color: var(--oc-fg); font: 12px/1.4 var(--oc-font); }
  * { box-sizing: border-box; }
  html, body { height: 100%; overflow-y: auto; overflow-x: hidden; }
  #root { display: flex; flex-direction: column; gap: 14px; padding: 12px 12px 20px; }
  .head { display: flex; flex-direction: column; gap: 2px; }
  .title { font-size: 13px; font-weight: 600; }
  .subtitle { color: var(--oc-muted); font-size: 11px; }
  .usage { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: var(--oc-radius);
    background: color-mix(in srgb, var(--oc-fg) 4%, transparent); }
  .usage-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .usage-title { font-weight: 600; }
  .usage-badges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
  .usage-model { color: var(--oc-muted); font-family: var(--oc-mono); font-size: 11px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .usage-meter { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .usage-numbers { font-variant-numeric: tabular-nums; }
  .usage-window { color: var(--oc-muted); }
  .usage-pct { font-weight: 600; font-variant-numeric: tabular-nums; }
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

const usage = document.createElement("section");
usage.className = "usage";
usage.hidden = true;
const usageHead = document.createElement("div");
usageHead.className = "usage-head";
const usageTitle = document.createElement("div");
usageTitle.className = "usage-title";
usageTitle.textContent = "Context usage";
const usageBadges = document.createElement("div");
usageBadges.className = "usage-badges";
const estimatedSlot = document.createElement("span");
estimatedSlot.hidden = true;
estimatedSlot.title = "部分数字由字符估算，provider 未提供完整 token 用量。";
mountBadge(estimatedSlot, { label: "estimated", tone: "warning" });
const assumedSlot = document.createElement("span");
assumedSlot.hidden = true;
assumedSlot.title = "没有取得模型窗口，按 200,000 tokens 估算。";
mountBadge(assumedSlot, { label: "assumed window", tone: "info" });
usageBadges.append(estimatedSlot, assumedSlot);
usageHead.append(usageTitle, usageBadges);

const usageModel = document.createElement("div");
usageModel.className = "usage-model";
const usageMeter = document.createElement("div");
usageMeter.className = "usage-meter";
const usageNumbers = document.createElement("div");
usageNumbers.className = "usage-numbers";
const usageUsed = document.createElement("span");
const usageWindow = document.createElement("span");
usageWindow.className = "usage-window";
usageNumbers.append(usageUsed, document.createTextNode(" / "), usageWindow, document.createTextNode(" tokens"));
const usagePct = document.createElement("div");
usagePct.className = "usage-pct";
usageMeter.append(usageNumbers, usagePct);

const usageProgress = document.createElement("div");
const progress = mountProgress(usageProgress, { value: 0, label: "已用" });

usage.append(usageHead, usageModel, usageMeter, usageProgress);

const placeholder = document.createElement("div");
placeholder.className = "placeholder";
const placeholderTitle = document.createElement("div");
placeholderTitle.className = "placeholder-title";
const placeholderDetail = document.createElement("div");
placeholderDetail.className = "placeholder-detail";
placeholder.append(placeholderTitle, placeholderDetail);

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

root.append(head, usage, placeholder, status);

let session: SessionSnapshot | null = null;
let connected = false;
let booted = false;
let summary: SnapshotSummary | null = null;
let summaryProblem = false;

renderStatus({ kind: "checking" });
showPlaceholder("正在连接 Collector…", "首次打开面板时，本地 Service 可能需要一点时间启动。");

function versionLabel(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

function renderStatus(state: PanelState): void {
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

function showPlaceholder(headline: string, detail: string): void {
  usage.hidden = true;
  placeholder.hidden = false;
  placeholderTitle.textContent = headline;
  placeholderDetail.textContent = detail;
}

function renderContent(): void {
  if (!booted) {
    showPlaceholder("正在连接 Collector…", "首次打开面板时，本地 Service 可能需要一点时间启动。");
    return;
  }
  if (!session) {
    showPlaceholder("未打开 session", "打开一个 session 后，这里会显示它的上下文占用。");
    return;
  }
  if (!connected) {
    showPlaceholder("快照暂不可用", "Collector 连接后会自动显示上下文占用。");
    return;
  }
  if (summaryProblem) {
    showPlaceholder("快照暂时不可用", "Collector 没有及时响应，稍后会自动重试。");
    return;
  }
  if (!summary || summary.sessionID !== session.id) {
    showPlaceholder("还没有上下文快照", "发起一次请求后，这里会显示最后一次请求的构成。");
    return;
  }
  renderSummary(summary);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function renderSummary(next: SnapshotSummary): void {
  placeholder.hidden = true;
  usage.hidden = false;

  usageModel.textContent = next.model;
  usageModel.title = next.model;
  usageUsed.textContent = formatNumber(next.used);
  usageWindow.textContent = formatNumber(next.window);
  const percent = next.window > 0 ? (next.used / next.window) * 100 : 0;
  usagePct.textContent = `${formatPercent(percent)}%`;

  progress.update({
    value: percent,
    tone: percent >= 85 ? "error" : percent >= 60 ? "warning" : "primary",
    label: "已用",
  });

  estimatedSlot.hidden = !next.estimated;
  assumedSlot.hidden = !next.windowAssumed;
}

function parseSummary(body: string): SnapshotSummary | null {
  try {
    const value = JSON.parse(body) as Partial<SnapshotSummary>;
    if (
      typeof value.sessionID !== "string"
      || typeof value.model !== "string"
      || typeof value.used !== "number"
      || typeof value.window !== "number"
      || typeof value.windowAssumed !== "boolean"
      || typeof value.estimated !== "boolean"
      || typeof value.collectedAt !== "string"
      || !Array.isArray(value.categories)
      || !Array.isArray(value.items)
    ) {
      return null;
    }
    return value as SnapshotSummary;
  } catch {
    return null;
  }
}

function setSession(next: SessionSnapshot | null): void {
  const previous = session?.id ?? null;
  session = next;
  if ((next?.id ?? null) === previous) return;
  summary = null;
  summaryProblem = false;
  renderContent();
}

async function refreshSummary(): Promise<void> {
  const current = session;
  if (!current) {
    summary = null;
    summaryProblem = false;
    return;
  }

  const requestedSession = current.id;
  try {
    const result = await host.serviceRequest({
      method: "GET",
      path: "/summary",
      query: { sessionID: requestedSession },
    });
    if (session?.id !== requestedSession) return;

    if (result.status === 200) {
      const parsed = parseSummary(result.body);
      summary = parsed;
      summaryProblem = parsed === null;
      return;
    }

    summary = null;
    summaryProblem = result.status !== 404;
  } catch {
    if (session?.id !== requestedSession) return;
    summary = null;
    summaryProblem = true;
  }
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
      connected = false;
      summary = null;
      summaryProblem = false;
      renderStatus({ kind: "failed", title: "本地 Service 返回了意外结果", detail: "请稍后重试，或重新加载面板。" });
      renderContent();
      return;
    }

    const collector = body.collector;
    if (collector.connected === true && typeof collector.version === "string") {
      connected = true;
      renderStatus({ kind: "connected", version: collector.version });
    } else {
      connected = false;
      summary = null;
      summaryProblem = false;
      renderStatus({
        kind: "disconnected",
        reason: collector.reason === "unreachable" ? "unreachable" : "not_found",
      });
    }

    if (connected) await refreshSummary();
    booted = true;
    renderContent();
  } catch (error) {
    connected = false;
    summary = null;
    summaryProblem = false;
    booted = true;
    renderStatus({ kind: "failed", ...failureOf(error) });
    renderContent();
  } finally {
    inflight = false;
  }
}

let started = false;

host.onSession((next) => {
  const previous = session?.id ?? null;
  setSession(next);
  if (started && (next?.id ?? null) !== previous) void poll();
});

host.onReady((context) => {
  applyHostReady(context, document.documentElement);
  setSession(context.session);
  if (started) return;
  started = true;
  void poll();
  setInterval(() => { void poll(); }, POLL_MS);
});
