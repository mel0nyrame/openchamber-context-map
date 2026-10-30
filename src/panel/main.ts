import { connectHost, HostRequestError, type SessionSnapshot } from "@openchamber/sdk";
import { applyHostReady, mountBadge, mountProgress } from "@openchamber/sdk/ui";

import {
  CATEGORIES,
  type Category,
  type CategoryUsage,
  type ItemSummary,
  type SnapshotSummary,
} from "../shared/types.ts";
import { CATEGORY_LABELS } from "./labels.ts";
import {
  buildBreakdown,
  gradientStops,
  itemsForCategory,
  layoutMap,
  windowBar,
  type MapCell,
  type MapLayout,
} from "./map.ts";
import { paletteCss } from "./palette.ts";

const POLL_MS = 2_000;

const STYLE = `
  html, body { margin: 0; background: transparent; color: var(--oc-fg); font: 12px/1.4 var(--oc-font); }
  * { box-sizing: border-box; }
  html, body { height: 100%; overflow-y: auto; overflow-x: hidden; }
  #root { display: flex; flex-direction: column; gap: 14px; padding: 12px 12px 20px; }
  .head { display: flex; flex-direction: column; gap: 2px; }
  .title { font-size: 13px; font-weight: 600; }
  .subtitle { color: var(--oc-muted); font-size: 11px; }
  .usage, .card { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: var(--oc-radius);
    background: color-mix(in srgb, var(--oc-fg) 4%, transparent); }
  .card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-height: 18px; }
  .card-title { flex: none; font-weight: 600; }
  .map-hint { min-width: 0; max-width: 58%; color: var(--oc-muted); font-size: 11px; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; }
  .map-wrap { position: relative; }
  .map { display: grid; grid-template-columns: repeat(25, minmax(0, 1fr)); gap: 2px; }
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
  .item-row { display: flex; flex-direction: column; gap: 1px; padding: 6px;
    border-top: 1px solid color-mix(in srgb, var(--oc-fg) 8%, transparent); }
  .item-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item-meta { color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .drill-empty { padding: 8px 6px; color: var(--oc-muted); font-size: 11px; }
  @media (max-width: 520px) {
    .map { grid-template-columns: repeat(20, minmax(0, 1fr)); }
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
const palette = document.createElement("style");
palette.textContent = paletteCss();
document.head.append(style, palette);

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
backButton.addEventListener("click", () => selectCategory(null));
breakdownHead.append(breakdownTitle, backButton);
const breakdownBody = document.createElement("div");
breakdownBody.className = "breakdown-body";
breakdownCard.append(breakdownHead, breakdownBody);

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

root.append(head, usage, mapCard, breakdownCard, placeholder, status);

let session: SessionSnapshot | null = null;
let connected = false;
let booted = false;
let summary: SnapshotSummary | null = null;
let summaryProblem = false;

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

document.addEventListener("pointerdown", (event) => {
  if (!pinnedCell) return;
  if (event.target instanceof Node && mapWrap.contains(event.target)) return;
  pinnedCell = null;
  refreshTooltip();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  pinnedCell = null;
  hoveredCell = null;
  refreshTooltip();
  if (selectedCategory) selectCategory(null);
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
  mapCard.hidden = true;
  breakdownCard.hidden = true;
  mapSignature = null;
  hoveredCell = null;
  pinnedCell = null;
  hideTooltip();
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

function selectCategory(category: Category | null): void {
  selectedCategory = category;
  hoveredCell = null;
  pinnedCell = null;
  refreshTooltip();
  applySelection();
  renderBreakdown();
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
  breakdownBody.replaceChildren();
  if (!summary || !currentLayout) return;
  const breakdown = buildBreakdown(summary.categories, summary.used, summary.window);

  if (selectedCategory) {
    backButton.hidden = false;
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

    for (const entry of items) {
      const itemRow = document.createElement("div");
      itemRow.className = "item-row";
      const itemTitle = document.createElement("div");
      itemTitle.className = "item-title";
      itemTitle.textContent = entry.title || "未命名条目";
      itemTitle.title = entry.title;
      const itemMeta = document.createElement("div");
      itemMeta.className = "item-meta";
      itemMeta.textContent = `${formatNumber(entry.chars)} 字符`;
      itemRow.append(itemTitle, itemMeta);
      breakdownBody.append(itemRow);
    }
    return;
  }

  backButton.hidden = true;
  const list = document.createElement("div");
  list.className = "breakdown-list";
  for (const entry of breakdown.rows) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "row";
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
    selectedCategory
    && (!currentLayout || currentLayout.cellsByCategory[selectedCategory].length === 0)
  ) {
    selectedCategory = null;
  }
  renderBreakdown();
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
  if ((next?.id ?? null) === previous) return;
  summary = null;
  summaryProblem = false;
  selectedCategory = null;
  mapSignature = null;
  currentLayout = null;
  cellElements.clear();
  hoveredCell = null;
  pinnedCell = null;
  hideTooltip();
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
