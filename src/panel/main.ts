import { connectHost, HostRequestError, type SessionSnapshot } from "@openchamber/sdk";
import { applyHostReady, mountBadge, mountBanner, mountButton, mountProgress } from "@openchamber/sdk/ui";

import {
  CATEGORIES,
  type Category,
  type CategoryUsage,
  type ItemSummary,
  type SnapshotItemDetail,
  type SnapshotSummary,
} from "../shared/types.ts";
import { COLLECTOR_VERSION } from "../shared/version.ts";
import { describeHostFailure, type HostFailureCopy } from "./failure.ts";
import { CATEGORY_LABELS } from "./labels.ts";
import {
  COMPACT_COLUMNS,
  MAP_COLUMNS,
  buildBreakdown,
  categoryOfItem,
  gradientStops,
  itemsForCategory,
  layoutMap,
  windowBar,
  type MapCell,
  type MapLayout,
} from "./map.ts";
import { paletteCss } from "./palette.ts";
import {
  PREVIEW_MAX_CHARS,
  clipPreviewText,
  escapeTarget,
  focusIndexFor,
  layerOf,
  moveFocus,
  previewTruncated,
} from "./preview.ts";
import {
  busyChanged,
  initialRefreshState,
  pollDelay,
  refreshBanner,
  refreshFailed,
  refreshSucceeded,
  sessionChanged,
  sessionPhaseChanged,
  visibilityChanged,
  type RefreshState,
  type RefreshTrigger,
} from "./refresh.ts";

const STYLE = `
  html, body { margin: 0; background: transparent; color: var(--oc-fg); font: 12px/1.4 var(--oc-font); }
  * { box-sizing: border-box; }
  html, body { height: 100%; overflow-y: auto; overflow-x: hidden; }
  #root { display: flex; flex-direction: column; gap: 14px; padding: 12px 12px 20px; }
  .head { display: flex; flex-direction: column; gap: 2px; }
  .head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .head-actions { flex: none; display: flex; align-items: center; gap: 6px; }
  .title { font-size: 13px; font-weight: 600; }
  .subtitle { color: var(--oc-muted); font-size: 11px; }
  .updated { color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .usage, .card { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: var(--oc-radius);
    background: color-mix(in srgb, var(--oc-fg) 4%, transparent); }
  .card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-height: 18px; }
  .card-title { flex: none; font-weight: 600; }
  .map-hint { min-width: 0; max-width: 58%; color: var(--oc-muted); font-size: 11px; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; }
  .map-wrap { position: relative; }
  .map { display: grid; grid-template-columns: repeat(${MAP_COLUMNS}, minmax(0, 1fr)); gap: 2px; }
  .cell { appearance: none; -webkit-appearance: none; display: block; width: 100%; min-width: 0;
    aspect-ratio: 1; padding: 0; border: 0; border-radius: 2px; background: var(--oc-border);
    cursor: pointer; transition: opacity .12s ease; }
  .cell:hover { outline: 1px solid var(--oc-fg); outline-offset: 1px; }
  .cell.is-active { outline: 2px solid var(--oc-fg); outline-offset: 1px; }
  .cell.is-dim { opacity: .32; }
  .map-tip { position: absolute; z-index: 3; left: 0; top: 0; max-width: 100%; padding: 6px 8px;
    border: 1px solid var(--oc-border); border-radius: 6px; background: var(--oc-elevated);
    color: var(--oc-fg); box-shadow: 0 6px 18px rgba(0, 0, 0, .22); font-size: 11px; line-height: 1.45;
    pointer-events: none; transform: translate(-50%, -100%); }
  .map-tip.is-below { transform: translate(-50%, 0); }
  .tip-row { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
  .tip-row + .tip-row { margin-top: 2px; }
  .tip-tokens { margin-left: auto; color: var(--oc-muted); font-variant-numeric: tabular-nums; }
  .map-empty { padding: 12px 4px; color: var(--oc-muted); font-size: 11px; }
  .window-track { height: 5px; border-radius: 3px; overflow: hidden;
    background: color-mix(in srgb, var(--oc-fg) 12%, transparent); }
  .window-used { height: 100%; width: 0; border-radius: 3px; background: var(--oc-primary);
    transition: width .2s ease; }
  .window-used[data-over="true"] { background: var(--oc-error); }
  .window-caption { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 8px;
    color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .window-caption .is-over { color: var(--oc-fg); font-weight: 600; }
  .breakdown-list { display: flex; flex-direction: column; gap: 1px; }
  .row { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; align-items: center; gap: 8px;
    width: 100%; padding: 6px; border: 0; border-radius: 6px; background: transparent; color: inherit;
    font: inherit; text-align: left; }
  button.row { cursor: pointer; }
  button.row:hover { background: color-mix(in srgb, var(--oc-fg) 7%, transparent); }
  button.row:focus-visible { background: color-mix(in srgb, var(--oc-fg) 7%, transparent);
    outline: 2px solid var(--oc-focus, var(--oc-primary)); outline-offset: -2px; }
  .row-free { cursor: default; }
  .swatch { width: 8px; height: 8px; border-radius: 2px; }
  .row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-meta { color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums;
    white-space: nowrap; }
  .row-meta.is-over { color: var(--oc-fg); font-weight: 600; }
  .back { appearance: none; border: 0; padding: 2px 5px; border-radius: 4px; background: transparent;
    color: var(--oc-primary); font: inherit; cursor: pointer; }
  .back:hover { background: color-mix(in srgb, var(--oc-fg) 7%, transparent); }
  .back:focus-visible { background: color-mix(in srgb, var(--oc-fg) 7%, transparent);
    outline: 2px solid var(--oc-focus, var(--oc-primary)); outline-offset: -2px; }
  .drill-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
    padding: 2px 6px 6px; }
  .drill-title { display: flex; align-items: center; gap: 6px; min-width: 0; font-weight: 600; }
  .drill-meta { color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums;
    white-space: nowrap; }
  .breakdown-body { min-width: 0; }
  .item-row { appearance: none; -webkit-appearance: none; display: flex; flex-direction: column; gap: 1px;
    width: 100%; padding: 6px; border: 0; border-top: 1px solid color-mix(in srgb, var(--oc-fg) 8%, transparent);
    border-radius: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .item-row:hover { background: color-mix(in srgb, var(--oc-fg) 7%, transparent); }
  .item-row:focus-visible { background: color-mix(in srgb, var(--oc-fg) 7%, transparent);
    outline: 2px solid var(--oc-focus, var(--oc-primary)); outline-offset: -2px; }
  .item-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item-meta { color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .drill-empty { padding: 8px 6px; color: var(--oc-muted); font-size: 11px; }
  .notice { padding: 6px 8px; border: 1px solid color-mix(in srgb, var(--oc-warning, #d97706) 35%, transparent);
    border-radius: 6px; background: color-mix(in srgb, var(--oc-warning, #d97706) 12%, transparent);
    font-size: 11px; }
  .preview { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 2px 6px 6px; }
  .preview-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .preview-title { min-width: 0; font-weight: 600; overflow-wrap: anywhere; }
  .preview-copy { appearance: none; -webkit-appearance: none; flex: none; padding: 2px 8px;
    border: 1px solid var(--oc-border); border-radius: 4px; background: transparent; color: var(--oc-primary);
    font: inherit; cursor: pointer; }
  .preview-copy:hover:not(:disabled) { background: color-mix(in srgb, var(--oc-fg) 7%, transparent); }
  .preview-copy:focus-visible { outline: 2px solid var(--oc-focus, var(--oc-primary)); outline-offset: -2px; }
  .preview-copy:disabled { opacity: .5; cursor: default; }
  .preview-meta { color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .preview-status { min-height: 0; color: var(--oc-muted); font-size: 11px; overflow-wrap: anywhere; }
  .preview-status[data-tone="error"] { color: var(--oc-error); }
  .preview-status[data-tone="ok"] { color: var(--oc-success); }
  .preview-body { margin: 0; padding: 8px; max-width: 100%; max-height: 360px; overflow: auto;
    border: 1px solid color-mix(in srgb, var(--oc-fg) 10%, transparent); border-radius: 6px;
    background: color-mix(in srgb, var(--oc-fg) 3%, transparent); font-family: var(--oc-mono);
    font-size: 11px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
  .preview-body:focus-visible { outline: 2px solid var(--oc-focus, var(--oc-primary)); outline-offset: -2px; }
  @media (max-width: 520px) {
    .map { grid-template-columns: repeat(${COMPACT_COLUMNS}, minmax(0, 1fr)); }
    .row-meta { font-size: 10px; }
  }
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
  .placeholder-actions { margin-top: 6px; }
  [hidden] { display: none !important; }
`;

const COLLECTOR_INSTALL_PATH = "~/.config/opencode/plugins/";

type PanelState =
  | { kind: "checking" }
  | { kind: "connected"; version: string; outdated?: boolean; expectedVersion?: string }
  | { kind: "disconnected"; reason: "not_found" | "unreachable" }
  | { kind: "failed"; title: string; detail: string };

interface HealthBody {
  collector?: {
    connected?: unknown;
    version?: unknown;
    reason?: unknown;
    outdated?: unknown;
    expectedVersion?: unknown;
  };
}

const host = connectHost();
const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("Missing #root");

const style = document.createElement("style");
style.textContent = STYLE;
const palette = document.createElement("style");
palette.textContent = paletteCss();
document.head.append(style, palette);

const head = document.createElement("div");
head.className = "head";
const headRow = document.createElement("div");
headRow.className = "head-row";
const title = document.createElement("div");
title.className = "title";
title.textContent = "Context Map";
const headActions = document.createElement("div");
headActions.className = "head-actions";
const refreshButton = mountButton(headActions, {
  label: "刷新",
  variant: "outline",
  size: "xs",
  onClick: () => manualRefresh(),
});
const subtitle = document.createElement("div");
subtitle.className = "subtitle";
subtitle.textContent = "最后一次请求的上下文构成";
const updated = document.createElement("div");
updated.className = "updated";
updated.hidden = true;
headRow.append(title, headActions);
head.append(headRow, subtitle, updated);

const bannerSlot = document.createElement("div");
bannerSlot.hidden = true;
const banner = mountBanner(bannerSlot, {
  tone: "warning",
  title: "刷新失败",
  body: "",
  action: { label: "重试", onClick: () => manualRefresh() },
});

const versionSlot = document.createElement("div");
versionSlot.hidden = true;
const versionBanner = mountBanner(versionSlot, {
  tone: "warning",
  title: "collector 版本过旧",
  body: "",
});

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

const mapCard = document.createElement("section");
mapCard.className = "card map-card";
mapCard.hidden = true;
const mapHead = document.createElement("div");
mapHead.className = "card-head";
const mapTitle = document.createElement("div");
mapTitle.className = "card-title";
mapTitle.textContent = "Context map";
const mapHint = document.createElement("div");
mapHint.className = "map-hint";
mapHint.setAttribute("aria-live", "polite");
mapHint.textContent = "悬停或点击格子查看分类";
mapHead.append(mapTitle, mapHint);

const mapWrap = document.createElement("div");
mapWrap.className = "map-wrap";
const mapGrid = document.createElement("div");
mapGrid.className = "map";
mapGrid.setAttribute("role", "group");
mapGrid.setAttribute("aria-label", "Context map，按已用 token 绘制");
const mapTip = document.createElement("div");
mapTip.className = "map-tip";
mapTip.setAttribute("role", "tooltip");
mapTip.hidden = true;
const mapEmpty = document.createElement("div");
mapEmpty.className = "map-empty";
mapEmpty.textContent = "这次请求还没有可绘制的上下文。";
mapEmpty.hidden = true;
mapWrap.append(mapGrid, mapTip, mapEmpty);

const windowTrack = document.createElement("div");
windowTrack.className = "window-track";
windowTrack.setAttribute("role", "progressbar");
windowTrack.setAttribute("aria-label", "Used / Window");
windowTrack.setAttribute("aria-valuemin", "0");
windowTrack.setAttribute("aria-valuemax", "100");
const windowUsedBar = document.createElement("div");
windowUsedBar.className = "window-used";
windowTrack.append(windowUsedBar);
const windowCaption = document.createElement("div");
windowCaption.className = "window-caption";
const windowCaptionUsed = document.createElement("span");
const windowCaptionFree = document.createElement("span");
windowCaption.append(windowCaptionUsed, windowCaptionFree);

mapCard.append(mapHead, mapWrap, windowTrack, windowCaption);

const breakdownCard = document.createElement("section");
breakdownCard.className = "card breakdown-card";
breakdownCard.hidden = true;
const breakdownHead = document.createElement("div");
breakdownHead.className = "card-head";
const breakdownTitle = document.createElement("div");
breakdownTitle.className = "card-title";
breakdownTitle.textContent = "Breakdown";
const backButton = document.createElement("button");
backButton.type = "button";
backButton.className = "back";
backButton.textContent = "返回";
backButton.hidden = true;
backButton.addEventListener("click", () => goBack());
breakdownHead.append(breakdownTitle, backButton);
const breakdownBody = document.createElement("div");
breakdownBody.className = "breakdown-body";
breakdownCard.append(breakdownHead, breakdownBody);

const previewPanel = document.createElement("div");
previewPanel.className = "preview";
previewPanel.tabIndex = -1;
previewPanel.setAttribute("role", "group");
previewPanel.setAttribute("aria-label", "条目预览");
const previewHead = document.createElement("div");
previewHead.className = "preview-head";
const previewTitle = document.createElement("div");
previewTitle.className = "preview-title";
const previewCopy = document.createElement("button");
previewCopy.type = "button";
previewCopy.className = "preview-copy";
previewCopy.textContent = "复制";
previewCopy.setAttribute("aria-label", "复制 Preview 正文");
previewCopy.addEventListener("click", () => { void copyPreview(); });
previewHead.append(previewTitle, previewCopy);
const previewMeta = document.createElement("div");
previewMeta.className = "preview-meta";
const previewStatus = document.createElement("div");
previewStatus.className = "preview-status";
previewStatus.setAttribute("role", "status");
previewStatus.setAttribute("aria-live", "polite");
const previewBody = document.createElement("pre");
previewBody.className = "preview-body";
previewBody.tabIndex = 0;
previewBody.setAttribute("aria-label", "Preview 正文");
previewPanel.append(previewHead, previewMeta, previewStatus, previewBody);

const placeholder = document.createElement("div");
placeholder.className = "placeholder";
const placeholderTitle = document.createElement("div");
placeholderTitle.className = "placeholder-title";
const placeholderDetail = document.createElement("div");
placeholderDetail.className = "placeholder-detail";
const placeholderActions = document.createElement("div");
placeholderActions.className = "placeholder-actions";
placeholderActions.hidden = true;
const placeholderRetry = mountButton(placeholderActions, {
  label: "重试",
  variant: "outline",
  size: "xs",
  onClick: () => manualRefresh(),
});
placeholder.append(placeholderTitle, placeholderDetail, placeholderActions);

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

root.append(head, bannerSlot, versionSlot, usage, mapCard, breakdownCard, placeholder, status);

let session: SessionSnapshot | null = null;
let connected = false;
let booted = false;
let summary: SnapshotSummary | null = null;
type SummaryProblem = "timeout" | "other";
let summaryProblem: SummaryProblem | null = null;
let hostProblem: HostFailureCopy | null = null;
let collectorReason: "not_found" | "unreachable" | null = null;
let collectorOutdated: { version: string; expectedVersion: string } | null = null;
let refreshState: RefreshState = initialRefreshState(document.visibilityState !== "hidden");
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight = false;
let refreshToken = 0;
let queuedRefresh: RefreshTrigger | null = null;
let manualLoading = false;
let started = false;

interface CellTarget {
  cell: MapCell;
  element: HTMLButtonElement;
}

let selectedCategory: Category | null = null;
let mapSignature: string | null = null;
let currentLayout: MapLayout | null = null;
let cellElements = new Map<number, HTMLButtonElement>();
let hoveredCell: CellTarget | null = null;
let pinnedCell: CellTarget | null = null;

interface PreviewState {
  itemId: string;
  category: Category;
  title: string;
  chars: number;
  text: string;
  loading: boolean;
  error: string | null;
  truncated: boolean;
}

let preview: PreviewState | null = null;
let previewRequest = 0;
let focusedItemId: string | null = null;
let focusedItemFallback = 0;
let itemButtons: HTMLButtonElement[] = [];
let notice: string | null = null;
let copyTimer: number | null = null;

document.addEventListener("pointerdown", (event) => {
  if (!pinnedCell) return;
  if (event.target instanceof Node && mapWrap.contains(event.target)) return;
  pinnedCell = null;
  refreshTooltip();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    pinnedCell = null;
    hoveredCell = null;
    refreshTooltip();
    if (preview || selectedCategory) goBack();
    return;
  }

  if (preview || event.defaultPrevented) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (
    target instanceof HTMLElement
    && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA"
      || target.tagName === "SELECT")
  ) {
    return;
  }

  const key = event.key.toLowerCase();
  const delta = key === "arrowdown" || key === "j" ? 1 : key === "arrowup" || key === "k" ? -1 : 0;
  if (delta === 0) return;

  if (!selectedCategory) {
    // 分类列表：焦点在分类行上时，方向键在行之间移动；Enter 由按钮自己处理。
    const row = document.activeElement;
    if (!(row instanceof HTMLButtonElement) || !row.matches("button.row[data-category]")) return;
    const rows = Array.from(
      breakdownBody.querySelectorAll<HTMLButtonElement>("button.row[data-category]"),
    );
    const next = moveFocus(rows.indexOf(row), rows.length, delta);
    if (next < 0) return;
    event.preventDefault();
    rows[next]?.focus();
    return;
  }

  const items = currentItems();
  if (items.length === 0) return;
  const activeIndex = itemButtons.indexOf(document.activeElement as HTMLButtonElement);
  const currentIndex = activeIndex >= 0
    ? activeIndex
    : itemButtons.findIndex((button) => button.dataset.itemId === focusedItemId);
  const next = moveFocus(currentIndex, items.length, delta);
  if (next < 0) return;
  event.preventDefault();
  focusItemAt(next);
});

window.addEventListener("scroll", () => {
  if (!hoveredCell && !pinnedCell) return;
  hoveredCell = null;
  pinnedCell = null;
  refreshTooltip();
}, true);

window.addEventListener("resize", () => {
  if (!hoveredCell && !pinnedCell) return;
  hoveredCell = null;
  pinnedCell = null;
  refreshTooltip();
});

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
    statusDetail.textContent = state.outdated
      ? `Collector 版本过旧，扩展期望 ${versionLabel(state.expectedVersion ?? COLLECTOR_VERSION)}。`
      : "快照会通过本地 Service 读取，bearer 不会进入面板。";
    return;
  }
  if (state.kind === "disconnected") {
    if (state.reason === "unreachable") {
      statusTitle.textContent = "Collector 没有响应";
      statusDetail.textContent = "发现文件存在，但 Collector 没有响应。重启 OpenCode 后再试。";
    } else {
      statusTitle.textContent = "Collector 未运行";
      statusDetail.textContent = `没有找到 Discovery file。把 Collector 安装到 ${COLLECTOR_INSTALL_PATH} 后重启 OpenCode。`;
    }
    return;
  }
  statusTitle.textContent = state.title;
  statusDetail.textContent = state.detail;
}

function failureOf(error: unknown): HostFailureCopy {
  return describeHostFailure(error instanceof HostRequestError ? error.code : null);
}

/** 这些 host 错误会改变面板的可用性，即使有旧数据也要直接显示。 */
function isBlockingHostFailure(error: unknown): boolean {
  return error instanceof HostRequestError
    && (error.code === "NO_SERVICE"
      || error.code === "NOT_GRANTED"
      || error.code === "DISABLED"
      || error.code === "SERVICE_FAILED");
}

function renderVersionBanner(): void {
  versionSlot.hidden = collectorOutdated === null;
  if (collectorOutdated === null) return;
  versionBanner.update({
    tone: "warning",
    title: "collector 版本过旧",
    body: `Collector 运行 ${versionLabel(collectorOutdated.version)}，扩展期望 ${versionLabel(collectorOutdated.expectedVersion)}。请手动更新 Collector；不会自动更新。`,
  });
}

function showPlaceholder(headline: string, detail: string, retry = false): void {
  usage.hidden = true;
  mapCard.hidden = true;
  breakdownCard.hidden = true;
  mapSignature = null;
  hoveredCell = null;
  pinnedCell = null;
  preview = null;
  previewRequest += 1;
  focusedItemId = null;
  focusedItemFallback = 0;
  itemButtons = [];
  notice = null;
  resetCopyFeedback();
  hideTooltip();
  breakdownBody.replaceChildren();
  placeholder.hidden = false;
  placeholderTitle.textContent = headline;
  placeholderDetail.textContent = detail;
  placeholderActions.hidden = !retry;
  syncRetryControls();
}

function renderContent(): void {
  renderUpdated();
  renderVersionBanner();
  if (!booted) {
    showPlaceholder("正在连接 Collector…", "首次打开面板时，本地 Service 可能需要一点时间启动。");
    return;
  }
  if (!session) {
    showPlaceholder("没有打开的 session", "打开一个 session 后，这里会显示它的上下文占用。", true);
    return;
  }
  if (hostProblem !== null) {
    showPlaceholder(hostProblem.title, hostProblem.detail, true);
    return;
  }
  if (!connected) {
    if (collectorReason === "unreachable") {
      showPlaceholder(
        "Collector 没有响应",
        "发现文件存在，但 Collector 没有响应。重启 OpenCode 后再试。",
        true,
      );
    } else {
      showPlaceholder(
        "Collector 未运行",
        `没有找到 Discovery file。把 Collector 安装到 ${COLLECTOR_INSTALL_PATH} 后重启 OpenCode。`,
        true,
      );
    }
    return;
  }
  if (summaryProblem !== null) {
    showPlaceholder(
      summaryProblem === "timeout" ? "Collector 没有及时响应" : "快照暂时不可用",
      summaryProblem === "timeout"
        ? "Service 等待 Collector 超时，稍后会自动重试。"
        : "Collector 返回了意外结果，稍后会自动重试。",
      true,
    );
    return;
  }
  if (!summary || summary.sessionID !== session.id) {
    showPlaceholder(
      "还没有请求记录",
      "Collector 已连接。在当前 session 发起一次请求后，这里会显示最后一次请求的构成。",
      true,
    );
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

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** 「更新于」只显示快照的采集时间，不用本地当前时间冒充。 */
function renderUpdated(): void {
  const collectedAt = summary?.collectedAt ?? null;
  if (collectedAt === null) {
    updated.hidden = true;
    updated.textContent = "";
    updated.removeAttribute("title");
    return;
  }

  const date = new Date(collectedAt);
  if (Number.isNaN(date.getTime())) {
    updated.hidden = false;
    updated.textContent = `更新于 ${collectedAt}`;
    updated.title = collectedAt;
    return;
  }

  const today = new Date();
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
  const clock = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  updated.hidden = false;
  updated.textContent = sameDay
    ? `更新于 ${clock}`
    : `更新于 ${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
  updated.title = `采集于 ${date.toLocaleString("zh-CN", { hour12: false })}`;
}

function snapshotSignature(next: SnapshotSummary): string {
  return [
    next.sessionID,
    next.collectedAt,
    next.used,
    next.window,
    next.categories.map((entry) => `${entry.category}:${entry.items}:${entry.tokens}`).join(","),
    next.items.length,
  ].join("|");
}

function roundPercent(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function cellBackground(cell: MapCell): string {
  if (cell.segments.length <= 1) return `var(--cat-${cell.primary})`;
  const stops = gradientStops(cell).map(
    (stop) => `var(--cat-${stop.category}) ${roundPercent(stop.start)}% ${roundPercent(stop.end)}%`,
  );
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}

function cellLabel(cell: MapCell): string {
  return cell.segments
    .map(
      (segment) =>
        `${CATEGORY_LABELS[segment.category]} ${formatNumber(Math.round(segment.tokens))} tokens`,
    )
    .join("；");
}

function renderMap(next: SnapshotSummary): void {
  const layout = layoutMap(next.categories);
  currentLayout = layout;

  const bar = windowBar(next.used, next.window);
  windowUsedBar.style.width = `${bar.fraction * 100}%`;
  windowUsedBar.dataset.over = bar.over ? "true" : "false";
  windowTrack.setAttribute("aria-valuenow", String(Math.round(bar.fraction * 100)));
  windowTrack.setAttribute("aria-valuetext", `${formatPercent(bar.fraction * 100)}%`);
  windowCaptionUsed.textContent =
    `已用 ${formatNumber(bar.used)} / ${formatNumber(bar.window)} tokens`;
  windowCaptionFree.textContent = bar.over
    ? `Free space ${formatNumber(bar.free)} tokens · 已超出窗口`
    : `Free space ${formatNumber(bar.free)} tokens`;
  windowCaptionFree.classList.toggle("is-over", bar.over);

  hoveredCell = null;
  pinnedCell = null;
  hideTooltip();
  mapGrid.replaceChildren();
  cellElements = new Map();

  const hasCells = layout.cells.length > 0;
  mapGrid.hidden = !hasCells;
  mapEmpty.hidden = hasCells;
  mapHint.textContent = hasCells ? "悬停或点击格子查看分类" : "没有可绘制的已用上下文";

  for (const cell of layout.cells) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.tabIndex = -1;
    button.style.background = cellBackground(cell);
    button.setAttribute("aria-label", cellLabel(cell));
    button.dataset.index = String(cell.index);

    button.addEventListener("pointerenter", () => {
      hoveredCell = { cell, element: button };
      refreshTooltip();
    });
    button.addEventListener("pointerleave", () => {
      if (hoveredCell?.element === button) hoveredCell = null;
      refreshTooltip();
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      pinnedCell = pinnedCell?.element === button ? null : { cell, element: button };
      refreshTooltip();
    });

    cellElements.set(cell.index, button);
    mapGrid.append(button);
  }
}

function refreshTooltip(): void {
  const target = hoveredCell ?? pinnedCell;
  if (!target || !target.element.isConnected || mapCard.hidden) {
    hideTooltip();
    return;
  }
  showTooltip(target.cell, target.element);
}

function showTooltip(cell: MapCell, element: HTMLButtonElement): void {
  const fragment = document.createDocumentFragment();
  for (const segment of cell.segments) {
    const row = document.createElement("div");
    row.className = "tip-row";
    const dot = document.createElement("span");
    dot.className = "swatch";
    dot.style.background = `var(--cat-${segment.category})`;
    const name = document.createElement("span");
    name.textContent = CATEGORY_LABELS[segment.category];
    const tokens = document.createElement("span");
    tokens.className = "tip-tokens";
    tokens.textContent = `${formatNumber(Math.round(segment.tokens))} tokens`;
    row.append(dot, name, tokens);
    fragment.append(row);
  }
  mapTip.replaceChildren(fragment);
  mapTip.hidden = false;
  mapHint.textContent = cell.segments
    .map(
      (segment) =>
        `${CATEGORY_LABELS[segment.category]} ${formatNumber(Math.round(segment.tokens))}`,
    )
    .join(" · ");
  positionTooltip(element);
}

function positionTooltip(element: HTMLButtonElement): void {
  const wrapRect = mapWrap.getBoundingClientRect();
  const cellRect = element.getBoundingClientRect();
  const tipRect = mapTip.getBoundingClientRect();
  const half = tipRect.width / 2;
  const center = cellRect.left - wrapRect.left + cellRect.width / 2;
  const left = Math.max(half + 2, Math.min(wrapRect.width - half - 2, center));
  const above = cellRect.top - wrapRect.top >= tipRect.height + 8;
  mapTip.classList.toggle("is-below", !above);
  mapTip.style.left = `${left}px`;
  mapTip.style.top = above
    ? `${cellRect.top - wrapRect.top - 6}px`
    : `${cellRect.bottom - wrapRect.top + 6}px`;
}

function hideTooltip(): void {
  mapTip.hidden = true;
  mapTip.replaceChildren();
  if (!mapCard.hidden) {
    mapHint.textContent = currentLayout && currentLayout.cells.length > 0
      ? "悬停或点击格子查看分类"
      : "没有可绘制的已用上下文";
  }
}

function currentItems(): ItemSummary[] {
  if (!summary || !selectedCategory) return [];
  return itemsForCategory(summary.items, selectedCategory);
}

function focusItemAt(index: number): void {
  const button = itemButtons[index];
  if (!button) return;
  button.focus();
  focusedItemId = button.dataset.itemId ?? null;
  focusedItemFallback = index;
}

function focusItemById(itemId: string | null, fallback = 0): void {
  const index = focusIndexFor(currentItems(), itemId, fallback);
  if (index >= 0) focusItemAt(index);
}

function focusCategoryRow(category: Category): void {
  for (const row of breakdownBody.querySelectorAll<HTMLButtonElement>("button.row[data-category]")) {
    if (row.dataset.category === category) {
      row.focus();
      return;
    }
  }
}

function resetCopyFeedback(): void {
  if (copyTimer !== null) {
    window.clearTimeout(copyTimer);
    copyTimer = null;
  }
  previewCopy.textContent = "复制";
  previewStatus.textContent = "";
  previewStatus.dataset.tone = "";
}

function selectCategory(category: Category | null): void {
  selectedCategory = category;
  preview = null;
  previewRequest += 1;
  focusedItemId = null;
  focusedItemFallback = 0;
  notice = null;
  resetCopyFeedback();
  hoveredCell = null;
  pinnedCell = null;
  refreshTooltip();
  applySelection();
  renderBreakdown();
  if (category) {
    if (currentItems().length > 0) focusItemAt(0);
    else backButton.focus();
  }
}

function closePreview(): void {
  if (!preview) return;
  const category = selectedCategory;
  preview = null;
  previewRequest += 1;
  resetCopyFeedback();
  renderBreakdown();
  if (category && currentItems().length > 0) {
    focusItemById(focusedItemId, focusedItemFallback);
    return;
  }
  if (category) {
    selectCategory(null);
    focusCategoryRow(category);
  }
}

function goBack(): void {
  const layer = layerOf(selectedCategory, preview?.itemId ?? null);
  if (layer === "overview") return;
  if (escapeTarget(layer) === "items") {
    closePreview();
    return;
  }
  const previous = selectedCategory;
  if (!previous) return;
  selectCategory(null);
  focusCategoryRow(previous);
}

function applySelection(): void {
  const selected = selectedCategory;
  const activeCells = selected && currentLayout
    ? new Set(currentLayout.cellsByCategory[selected])
    : null;
  for (const [index, element] of cellElements) {
    const active = activeCells?.has(index) === true;
    element.classList.toggle("is-active", active);
    element.classList.toggle("is-dim", selected !== null && !active);
  }
}

function renderBreakdown(): void {
  const active = document.activeElement;
  const activeElement = active instanceof HTMLElement && breakdownBody.contains(active) ? active : null;
  const activeItemId = activeElement?.dataset.itemId ?? null;
  const activeCategory = activeElement?.dataset.category ?? null;

  breakdownBody.replaceChildren();
  itemButtons = [];
  if (!summary || !currentLayout) {
    backButton.hidden = true;
    return;
  }
  const breakdown = buildBreakdown(summary.categories, summary.used, summary.window);
  backButton.hidden = !selectedCategory && !preview;

  if (preview) {
    renderPreview(preview);
    previewPanel.focus();
    return;
  }

  if (notice) {
    const note = document.createElement("div");
    note.className = "notice";
    note.setAttribute("role", "status");
    note.textContent = notice;
    breakdownBody.append(note);
  }

  if (selectedCategory) {
    const category = selectedCategory;
    const row = breakdown.rows.find((entry) => entry.category === category);
    const items = itemsForCategory(summary.items, category);

    const drill = document.createElement("div");
    drill.className = "drill-head";
    const drillTitle = document.createElement("div");
    drillTitle.className = "drill-title";
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = `var(--cat-${category})`;
    const name = document.createElement("span");
    name.textContent = CATEGORY_LABELS[category];
    drillTitle.append(swatch, name);
    const drillMeta = document.createElement("div");
    drillMeta.className = "drill-meta";
    drillMeta.textContent = row
      ? `${formatNumber(row.items)} 条 · ${formatNumber(row.tokens)} tokens`
      : `${formatNumber(items.length)} 条`;
    drill.append(drillTitle, drillMeta);
    breakdownBody.append(drill);

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "drill-empty";
      empty.textContent = "这个分类没有可列出的条目。";
      breakdownBody.append(empty);
      return;
    }

    for (const [index, entry] of items.entries()) {
      const itemRow = document.createElement("button");
      itemRow.type = "button";
      itemRow.className = "item-row";
      itemRow.dataset.itemId = entry.id;
      const itemTitle = document.createElement("div");
      itemTitle.className = "item-title";
      itemTitle.textContent = entry.title || "未命名条目";
      itemTitle.title = entry.title;
      const itemMeta = document.createElement("div");
      itemMeta.className = "item-meta";
      itemMeta.textContent = `${formatNumber(entry.chars)} 字符`;
      itemRow.append(itemTitle, itemMeta);
      itemRow.addEventListener("click", () => { void openPreview(entry); });
      itemRow.addEventListener("focus", () => {
        focusedItemId = entry.id;
        focusedItemFallback = index;
      });
      itemButtons.push(itemRow);
      breakdownBody.append(itemRow);
    }

    if (activeItemId) focusItemById(activeItemId, focusedItemFallback);
    return;
  }

  backButton.hidden = true;
  const list = document.createElement("div");
  list.className = "breakdown-list";
  for (const entry of breakdown.rows) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "row";
    row.dataset.category = entry.category;
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = `var(--cat-${entry.category})`;
    const name = document.createElement("span");
    name.className = "row-name";
    name.textContent = CATEGORY_LABELS[entry.category];
    const meta = document.createElement("span");
    meta.className = "row-meta";
    meta.textContent = `${formatNumber(entry.items)} 条 · ${formatNumber(entry.tokens)} tokens`;
    row.append(swatch, name, meta);
    row.addEventListener("click", () => selectCategory(entry.category));
    list.append(row);
  }

  const free = document.createElement("div");
  free.className = "row row-free";
  const freeSwatch = document.createElement("span");
  freeSwatch.className = "swatch";
  freeSwatch.style.background = "var(--cat-free)";
  const freeName = document.createElement("span");
  freeName.className = "row-name";
  freeName.textContent = "Free space";
  const freeMeta = document.createElement("span");
  freeMeta.className = "row-meta";
  const bar = windowBar(summary.used, summary.window);
  freeMeta.textContent = bar.over
    ? `${formatNumber(bar.free)} tokens · 已超出窗口`
    : `${formatNumber(bar.free)} tokens`;
  freeMeta.classList.toggle("is-over", bar.over);
  free.append(freeSwatch, freeName, freeMeta);
  list.append(free);
  breakdownBody.append(list);

  if (activeCategory && isCategory(activeCategory)) focusCategoryRow(activeCategory);
}

function renderPreview(state: PreviewState): void {
  previewTitle.textContent = state.title || "未命名条目";
  const suffix = state.truncated ? ` · 仅显示前 ${formatNumber(PREVIEW_MAX_CHARS)} 字符` : "";
  previewMeta.textContent =
    `${CATEGORY_LABELS[state.category]} · ${formatNumber(state.chars)} 字符${suffix}`;
  previewBody.textContent = state.text;
  previewBody.hidden = state.loading || state.error !== null;
  previewCopy.disabled = state.loading || state.error !== null;
  previewCopy.textContent = "复制";
  if (state.loading) {
    previewStatus.textContent = "正在读取 Preview…";
    previewStatus.dataset.tone = "";
  } else if (state.error) {
    previewStatus.textContent = state.error;
    previewStatus.dataset.tone = "error";
  } else {
    previewStatus.textContent = "";
    previewStatus.dataset.tone = "";
  }
  breakdownBody.append(previewPanel);
}

async function openPreview(entry: ItemSummary): Promise<void> {
  const category = categoryOfItem(entry.id) ?? selectedCategory;
  const current = session;
  if (!category || !current) return;

  const request = ++previewRequest;
  focusedItemId = entry.id;
  const index = itemButtons.findIndex((button) => button.dataset.itemId === entry.id);
  if (index >= 0) focusedItemFallback = index;
  notice = null;
  preview = {
    itemId: entry.id,
    category,
    title: entry.title,
    chars: entry.chars,
    text: "",
    loading: true,
    error: null,
    truncated: false,
  };
  renderBreakdown();

  try {
    const result = await host.serviceRequest({
      method: "GET",
      path: "/item",
      query: { sessionID: current.id, itemId: entry.id },
    });
    if (request !== previewRequest || preview?.itemId !== entry.id) return;
    if (session?.id !== current.id) return;

    if (result.status === 404) {
      await handlePreviewMissing(request);
      return;
    }
    if (result.status !== 200) {
      preview = {
        ...preview,
        loading: false,
        error: "无法读取这条 Item 的 Preview，请稍后重试。",
      };
      renderBreakdown();
      return;
    }

    const detail = parseItemDetail(result.body);
    if (!detail) {
      preview = { ...preview, loading: false, error: "Preview 数据格式不正确。" };
      renderBreakdown();
      return;
    }

    const text = clipPreviewText(detail.text);
    preview = {
      itemId: entry.id,
      category,
      title: detail.title || entry.title,
      chars: detail.chars,
      text,
      loading: false,
      error: null,
      truncated: previewTruncated(detail.chars, text.length),
    };
    renderBreakdown();
  } catch {
    if (request !== previewRequest || preview?.itemId !== entry.id) return;
    preview = {
      ...preview,
      loading: false,
      error: "无法读取这条 Item 的 Preview，请稍后重试。",
    };
    renderBreakdown();
  }
}

async function handlePreviewMissing(request: number): Promise<void> {
  if (request !== previewRequest) return;
  preview = null;
  previewRequest += 1;
  notice = "快照已更新，已刷新";
  resetCopyFeedback();
  const fallback = focusedItemFallback;
  renderBreakdown();
  if (selectedCategory) focusItemById(focusedItemId, fallback);

  await runRefresh("event");
  renderContent();
  if (selectedCategory) focusItemById(focusedItemId, fallback);
}

async function copyPreview(): Promise<void> {
  if (!preview || preview.loading || preview.error !== null) return;
  const itemId = preview.itemId;
  const text = preview.text;
  let copied = false;

  try {
    if (typeof navigator.clipboard?.writeText === "function") {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) copied = copyWithExecCommand(text);
  if (preview?.itemId !== itemId) return;

  if (copied) {
    previewStatus.textContent = "已复制 Preview 正文。";
    previewStatus.dataset.tone = "ok";
    previewCopy.textContent = "已复制";
    if (copyTimer !== null) window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => {
      previewCopy.textContent = "复制";
      copyTimer = null;
    }, 1_500);
    return;
  }

  previewStatus.textContent = "复制失败，请手动选择 Preview 正文。";
  previewStatus.dataset.tone = "error";
}

function copyWithExecCommand(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "-9999px";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

function parseItemDetail(body: string): SnapshotItemDetail | null {
  try {
    const value = JSON.parse(body) as unknown;
    if (
      !isRecord(value)
      || typeof value.id !== "string"
      || typeof value.title !== "string"
      || typeof value.text !== "string"
      || !isFiniteNumber(value.chars)
    ) {
      return null;
    }
    return value as unknown as SnapshotItemDetail;
  } catch {
    return null;
  }
}

function renderSummary(next: SnapshotSummary): void {
  placeholder.hidden = true;
  usage.hidden = false;
  mapCard.hidden = false;
  breakdownCard.hidden = false;

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

  const signature = snapshotSignature(next);
  if (signature === mapSignature) return;
  mapSignature = signature;
  renderMap(next);
  if (
    !preview
    && selectedCategory
    && (!currentLayout || currentLayout.cellsByCategory[selectedCategory].length === 0)
  ) {
    selectedCategory = null;
  }
  if (!preview) renderBreakdown();
  applySelection();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

function isCategoryUsage(value: unknown): value is CategoryUsage {
  if (!isRecord(value)) return false;
  return isCategory(value.category)
    && isFiniteNumber(value.items)
    && isFiniteNumber(value.chars)
    && isFiniteNumber(value.tokens);
}

function isItemSummary(value: unknown): value is ItemSummary {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.head === "string"
    && isFiniteNumber(value.chars);
}

function parseSummary(body: string): SnapshotSummary | null {
  try {
    const value = JSON.parse(body) as unknown;
    if (
      !isRecord(value)
      || typeof value.sessionID !== "string"
      || typeof value.model !== "string"
      || !isFiniteNumber(value.used)
      || !isFiniteNumber(value.window)
      || typeof value.windowAssumed !== "boolean"
      || typeof value.estimated !== "boolean"
      || typeof value.collectedAt !== "string"
      || !Array.isArray(value.categories)
      || !value.categories.every(isCategoryUsage)
      || !Array.isArray(value.items)
      || !value.items.every(isItemSummary)
    ) {
      return null;
    }
    return value as unknown as SnapshotSummary;
  } catch {
    return null;
  }
}

function setSession(next: SessionSnapshot | null): void {
  const previous = session?.id ?? null;
  session = next;
  const nextID = next?.id ?? null;

  if (nextID === previous) {
    refreshState = busyChanged(refreshState, next?.busy ?? false);
    reconcilePolling();
    return;
  }

  refreshState = sessionChanged(refreshState, nextID, next?.busy ?? false);
  // 旧 session 的请求已经没用了：作废它，立刻为新 session 拉一次。
  refreshToken += 1;
  refreshInFlight = false;
  queuedRefresh = null;
  setManualLoading(false);
  stopPollTimer();
  summary = null;
  summaryProblem = null;
  selectedCategory = null;
  mapSignature = null;
  currentLayout = null;
  cellElements.clear();
  hoveredCell = null;
  pinnedCell = null;
  preview = null;
  previewRequest += 1;
  focusedItemId = null;
  focusedItemFallback = 0;
  itemButtons = [];
  notice = null;
  resetCopyFeedback();
  breakdownBody.replaceChildren();
  hideTooltip();
  renderContent();
  renderRefreshBanner();

  if (started && nextID !== null) requestRefresh("event", true);
}

function stopPollTimer(): void {
  if (refreshTimer === null) return;
  clearTimeout(refreshTimer);
  refreshTimer = null;
}

function renderRefreshBanner(): void {
  const next = refreshBanner(refreshState);
  bannerSlot.hidden = next === null;
  if (next !== null) {
    // 请求在途时收起 banner 的重试入口，避免和顶部/占位区按钮重复触发。
    banner.update({
      ...next,
      action: manualLoading || refreshInFlight
        ? undefined
        : { label: "重试", onClick: () => manualRefresh() },
    });
  }
}

function syncRetryControls(): void {
  const busy = manualLoading || refreshInFlight;
  refreshButton.update({ disabled: busy, loading: manualLoading });
  placeholderRetry.update({
    disabled: busy,
    loading: manualLoading,
    label: manualLoading ? "重试中…" : "重试",
  });
  renderRefreshBanner();
}

function setManualLoading(loading: boolean): void {
  if (manualLoading === loading) return;
  manualLoading = loading;
  syncRetryControls();
}

/**
 * 只保留一个计时器：每次轮询结束后再按策略挂下一次。
 * 切换 session、转入 idle、连续失败或面板隐藏都会走到这里清掉它。
 */
function reconcilePolling(): void {
  renderRefreshBanner();
  if (refreshInFlight) return;

  const delay = pollDelay(refreshState);
  if (delay === null) {
    stopPollTimer();
    return;
  }
  if (refreshTimer !== null) return;

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    requestRefresh("poll");
  }, delay);
}

function manualRefresh(): void {
  if (!started || manualLoading) return;
  // 在途时排队而不是叠加：连续点击只会留下一次手动刷新。
  requestRefresh("manual");
}

function requestRefresh(trigger: RefreshTrigger, supersede = false): void {
  if (refreshInFlight && !supersede) {
    if (trigger === "manual" || queuedRefresh === null) queuedRefresh = trigger;
    return;
  }
  void runRefresh(trigger);
}

async function runRefresh(trigger: RefreshTrigger): Promise<void> {
  const token = ++refreshToken;
  const sessionAtStart = refreshState.sessionID;
  // 首次加载和手动刷新要显示失败；之后的单次轮询/事件失败静默保留旧内容。
  const quiet = trigger !== "manual" && booted;
  refreshInFlight = true;
  if (trigger === "manual") {
    setManualLoading(true);
  } else {
    syncRetryControls();
  }

  let ok = false;
  try {
    ok = await refreshOnce(token, quiet);
  } catch {
    ok = false;
  } finally {
    // 已被更新的请求（切 session 或手动刷新）取代：结果和 loading 都交给新请求。
    if (token !== refreshToken) return;

    refreshInFlight = false;
    if (trigger === "manual") {
      setManualLoading(false);
    } else {
      syncRetryControls();
    }
    // 请求期间切走了 session：这次结果属于上一个 session，不计数也不清计数。
    if (refreshState.sessionID === sessionAtStart) {
      refreshState = ok ? refreshSucceeded(refreshState) : refreshFailed(refreshState, trigger);
    }
    renderRefreshBanner();

    const next = queuedRefresh;
    queuedRefresh = null;
    if (next !== null && !(next === "poll" && pollDelay(refreshState) === null)) {
      void runRefresh(next);
      return;
    }
    reconcilePolling();
  }
}

function noteUnreachable(error: unknown, unexpected = false): void {
  booted = true;
  // 已经有数据时静默保留，连续失败由 banner 统一提示；
  // 但 host 明确不可用（未授权、暂停、Service 停止）时直接替换内容。
  if (!isBlockingHostFailure(error) && (summary !== null || connected)) return;

  connected = false;
  summaryProblem = null;
  collectorReason = null;
  collectorOutdated = null;
  hostProblem = unexpected
    ? { title: "Service 返回了意外结果", detail: "请稍后重试，或重新加载面板。" }
    : failureOf(error);
  renderStatus({ kind: "failed", ...hostProblem });
  renderContent();
}

/** 拉一次 /health 和当前 session 的 /summary；返回这次刷新是否成功。 */
async function refreshOnce(token: number, quiet: boolean): Promise<boolean> {
  let health: { status: number; body: string };
  try {
    health = await host.serviceRequest({ method: "GET", path: "/health" });
  } catch (error) {
    if (token !== refreshToken) return true;
    noteUnreachable(error);
    return false;
  }
  if (token !== refreshToken) return true;

  let body: HealthBody | null = null;
  try {
    body = JSON.parse(health.body) as HealthBody;
  } catch {
    body = null;
  }

  if (health.status !== 200 || !body?.collector) {
    noteUnreachable(null, true);
    return false;
  }

  const collector = body.collector;
  hostProblem = null;
  if (collector.connected !== true || typeof collector.version !== "string") {
    connected = false;
    summary = null;
    summaryProblem = null;
    collectorOutdated = null;
    collectorReason = collector.reason === "unreachable" ? "unreachable" : "not_found";
    booted = true;
    renderStatus({ kind: "disconnected", reason: collectorReason });
    renderContent();
    return true;
  }

  connected = true;
  collectorReason = null;
  const expectedVersion = typeof collector.expectedVersion === "string"
    ? collector.expectedVersion
    : COLLECTOR_VERSION;
  collectorOutdated = collector.outdated === true
    ? { version: collector.version, expectedVersion }
    : null;
  renderStatus({
    kind: "connected",
    version: collector.version,
    outdated: collectorOutdated !== null,
    expectedVersion: collectorOutdated?.expectedVersion,
  });

  const current = session;
  if (!current) {
    summary = null;
    summaryProblem = null;
    booted = true;
    renderContent();
    return true;
  }

  const requestedSession = current.id;
  try {
    const result = await host.serviceRequest({
      method: "GET",
      path: "/summary",
      query: { sessionID: requestedSession },
    });
    // 请求期间切走了 session 或被新请求取代：旧结果直接丢弃，不算失败。
    if (token !== refreshToken) return true;
    if (session?.id !== requestedSession) return true;

    if (result.status === 200) {
      const parsed = parseSummary(result.body);
      if (parsed === null) {
        if (!quiet) {
          summaryProblem = summary === null ? "other" : null;
          booted = true;
          renderContent();
        }
        return false;
      }
      summary = parsed;
      summaryProblem = null;
    } else if (result.status === 404) {
      summary = null;
      summaryProblem = null;
    } else if (result.status === 503) {
      // 503 只表示没有可用的 Collector：按连接状态处理，而不是超时。
      connected = false;
      summary = null;
      summaryProblem = null;
      collectorReason = "not_found";
      booted = true;
      renderStatus({ kind: "disconnected", reason: "not_found" });
      renderContent();
      return false;
    } else {
      if (!quiet) {
        summaryProblem = result.status === 504
          ? "timeout"
          : summary === null
            ? "other"
            : null;
        booted = true;
        renderContent();
      }
      return false;
    }
  } catch {
    if (token !== refreshToken) return true;
    if (session?.id !== requestedSession) return true;
    if (!quiet) {
      summaryProblem = summary === null ? "other" : null;
      booted = true;
      renderContent();
    }
    return false;
  }

  booted = true;
  renderContent();
  return true;
}

function applyVisibility(visible: boolean): void {
  refreshState = visibilityChanged(refreshState, visible);
  reconcilePolling();
}

// SDK 2.5.3 没有面板可见性或卸载回调。iframe 被移除时计时器随文档销毁；
// 顶层页面隐藏/恢复用 visibilitychange，bfcache 用 pagehide/pageshow。
document.addEventListener("visibilitychange", () => {
  applyVisibility(document.visibilityState !== "hidden");
});
window.addEventListener("pagehide", () => {
  stopPollTimer();
});
window.addEventListener("pageshow", () => {
  applyVisibility(document.visibilityState !== "hidden");
});

host.onSession((next) => {
  setSession(next);
});

host.onSessionLifecycle((event) => {
  const previous = refreshState;
  refreshState = sessionPhaseChanged(refreshState, event.sessionId, event.phase);
  if (refreshState !== previous) {
    if (!refreshState.busy) stopPollTimer();
    renderRefreshBanner();
  }

  if (!started || event.sessionId !== session?.id) return;
  // started 立刻拉一次并进入 2 秒轮询；completed/failure 拉完最后一份就停。
  requestRefresh("event");
});

host.onReady((context) => {
  applyHostReady(context, document.documentElement);
  setSession(context.session);
  if (started) {
    reconcilePolling();
    return;
  }
  started = true;
  requestRefresh("event");
});

