/**
 * 面板视图：唯一构建 DOM、绑定事件、操作焦点与滚动、订阅模型并渲染
 * `PanelView` 的模块。视图只把用户意图翻译成模型命令，不判断内容优先级、
 * 失败分层、选择规则或预览令牌；这些都由模型负责。
 */

import { mountBadge, mountBanner, mountButton, mountProgress } from "@openchamber/sdk/ui";

import {
  CATEGORIES,
  type Category,
  type SnapshotSummary,
} from "../shared/types.ts";
import { COLLECTOR_VERSION } from "../shared/version.ts";
import { CATEGORY_LABEL_KEYS, t, type Locale } from "./i18n.ts";
import {
  COMPACT_COLUMNS,
  MAP_COLUMNS,
  gradientStops,
  windowBar,
  type MapCell,
  type MapLayout,
} from "./map.ts";
import {
  COLLECTOR_INSTALL_PATH,
  type PanelFocus,
  type PanelModel,
  type PanelState,
  type PanelView,
  type PreviewState,
} from "./model.ts";
import { paletteCss } from "./palette.ts";
import { PREVIEW_MAX_CHARS, moveFocus } from "./preview.ts";
import { refreshBanner } from "./refresh.ts";

const STYLE = `
  html, body { margin: 0; background: transparent; color: var(--oc-fg); font: 12px/1.4 var(--oc-font); }
  * { box-sizing: border-box; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  html, body { height: 100%; overflow-y: auto; overflow-x: hidden; }
  #root { display: flex; flex-direction: column; gap: 14px; padding: 12px 12px 20px; }
  .updated { color: var(--oc-muted); font-size: 10.5px; font-variant-numeric: tabular-nums; }
  .usage, .card { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: var(--oc-radius);
    background: color-mix(in srgb, var(--oc-fg) 4%, transparent); }
  .card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-height: 18px; }
  .card-title { flex: none; font-weight: 600; }
  .zoom { appearance: none; -webkit-appearance: none; flex: none; padding: 2px 7px;
    border: 1px solid var(--oc-border); border-radius: 5px; background: transparent;
    color: var(--oc-muted); font: inherit; font-size: 10px; cursor: pointer; }
  .zoom:hover { color: var(--oc-fg); background: color-mix(in srgb, var(--oc-fg) 7%, transparent); }
  .zoom:focus-visible { outline: 2px solid var(--oc-focus, var(--oc-primary)); outline-offset: -2px; }
  .map-wrap { position: relative; }
  .map { display: grid; grid-template-columns: repeat(${MAP_COLUMNS}, minmax(0, 1fr)); gap: 2px; }
  .cell { appearance: none; -webkit-appearance: none; display: block; width: 100%; min-width: 0;
    aspect-ratio: 1; padding: 0; border: 0; border-radius: 2px; background: var(--oc-border);
    cursor: pointer; transition: opacity .12s ease; }
  .cell:hover { outline: 1px solid var(--oc-fg); outline-offset: 1px; }
  .cell.free { background: transparent; box-shadow: inset 0 0 0 1px var(--oc-border); }
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
  .map-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px;
    color: var(--oc-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .legend-item { display: inline-flex; align-items: center; gap: 5px; }
  .legend-swatch { width: 8px; height: 8px; border-radius: 2px; background: var(--oc-primary); }
  .legend-swatch.free { background: transparent; box-shadow: inset 0 0 0 1px var(--oc-border); }
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
  .swatch.free { background: transparent; box-shadow: inset 0 0 0 1px var(--oc-border); }
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
  .usage-actions { display: flex; align-items: center; gap: 6px; }
  .usage-badges { display: flex; flex-wrap: wrap; gap: 4px; }
  .status-inline { display: inline-flex; align-items: center; gap: 4px; color: var(--oc-muted);
    font-size: 10.5px; font-variant-numeric: tabular-nums; }
  .status-inline .dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--oc-muted); }
  .status-inline[data-state="connected"] .dot { background: var(--oc-success); }
  .status-inline[data-state="disconnected"] .dot { background: var(--oc-warning, #d97706); }
  .status-inline[data-state="failed"] .dot { background: var(--oc-error); }
  .refresh-slot { display: inline-flex; }
  .refresh-slot .oc-sdk-btn { min-width: 24px; padding: 2px 6px; }
  .usage-model { color: var(--oc-muted); font-family: var(--oc-mono); font-size: 11px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .usage-meter { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .usage-numbers { font-variant-numeric: tabular-nums; }
  .usage-window { color: var(--oc-muted); }
  .usage-pct { font-weight: 600; font-variant-numeric: tabular-nums; }
  .placeholder { display: flex; flex-direction: column; gap: 4px; padding: 18px 12px;
    border-radius: var(--oc-radius); background: color-mix(in srgb, var(--oc-fg) 3%, transparent); }
  .placeholder-title { font-weight: 600; }
  .placeholder-detail { color: var(--oc-muted); font-size: 11px; }
  .placeholder-actions { margin-top: 6px; }
  [hidden] { display: none !important; }
`;

export interface PanelViewDeps {
  root: HTMLElement;
  model: PanelModel;
  /** 手动刷新意图；入口把它交给 RefreshController。 */
  onManualRefresh: () => void;
  locale?: Locale;
}

export interface PanelViewHandle {
  setLocale(locale: Locale): void;
  dispose(): void;
}

interface CellTarget {
  cell: MapCell;
  element: HTMLButtonElement;
}

export function createPanelView(deps: PanelViewDeps): PanelViewHandle {
  const { root, model, onManualRefresh } = deps;

  let currentLocale: Locale = deps.locale ?? "en";
  let view: PanelView = model.getView();

  const style = document.createElement("style");
  style.textContent = STYLE;
  const palette = document.createElement("style");
  palette.textContent = paletteCss();
  document.head.append(style, palette);

  const bannerSlot = document.createElement("div");
  bannerSlot.hidden = true;
  const banner = mountBanner(bannerSlot, {
    tone: "warning",
    title: t(currentLocale, "refreshFailedTitle"),
    body: "",
    action: { label: t(currentLocale, "retry"), onClick: () => onManualRefresh() },
  });

  const versionSlot = document.createElement("div");
  versionSlot.hidden = true;
  const versionBanner = mountBanner(versionSlot, {
    tone: "warning",
    title: t(currentLocale, "versionOutdatedTitle"),
    body: "",
  });

  const usage = document.createElement("section");
  usage.className = "usage";
  const usageHead = document.createElement("div");
  usageHead.className = "usage-head";
  const usageTitle = document.createElement("div");
  usageTitle.className = "usage-title";
  usageTitle.textContent = t(currentLocale, "usageTitle");
  const usageActions = document.createElement("div");
  usageActions.className = "usage-actions";
  const statusInline = document.createElement("span");
  statusInline.className = "status-inline";
  statusInline.dataset.state = "checking";
  statusInline.setAttribute("role", "status");
  statusInline.setAttribute("aria-live", "polite");
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.setAttribute("aria-hidden", "true");
  const statusVersion = document.createElement("span");
  statusVersion.className = "status-version";
  statusInline.append(dot, statusVersion);
  const refreshSlot = document.createElement("span");
  refreshSlot.className = "refresh-slot";
  const refreshButton = mountButton(refreshSlot, {
    label: "↻",
    variant: "ghost",
    size: "xs",
    onClick: () => onManualRefresh(),
  });
  const refreshNode = refreshSlot.querySelector<HTMLButtonElement>("button");
  refreshNode?.setAttribute("aria-label", t(currentLocale, "refresh"));
  refreshNode?.setAttribute("title", t(currentLocale, "refresh"));
  const usageBadges = document.createElement("div");
  usageBadges.className = "usage-badges";
  const estimatedSlot = document.createElement("span");
  estimatedSlot.hidden = true;
  estimatedSlot.title = t(currentLocale, "estimatedTitle");
  const estimatedBadge = mountBadge(estimatedSlot, {
    label: t(currentLocale, "estimatedBadge"),
    tone: "warning",
  });
  const assumedSlot = document.createElement("span");
  assumedSlot.hidden = true;
  assumedSlot.title = t(currentLocale, "assumedWindowTitle");
  const assumedBadge = mountBadge(assumedSlot, {
    label: t(currentLocale, "assumedWindowBadge"),
    tone: "info",
  });
  const baselineSlot = document.createElement("span");
  baselineSlot.hidden = true;
  baselineSlot.title = t(currentLocale, "baselineTitle");
  const baselineBadge = mountBadge(baselineSlot, {
    label: t(currentLocale, "baselineBadge"),
    tone: "info",
  });
  usageBadges.append(estimatedSlot, assumedSlot, baselineSlot);
  usageActions.append(statusInline, refreshSlot);
  usageHead.append(usageTitle, usageActions);

  const usageModel = document.createElement("div");
  usageModel.className = "usage-model";
  const usageMeter = document.createElement("div");
  usageMeter.className = "usage-meter";
  const usageNumbers = document.createElement("div");
  usageNumbers.className = "usage-numbers";
  const usageUsed = document.createElement("span");
  const usageWindow = document.createElement("span");
  usageWindow.className = "usage-window";
  usageNumbers.append(
    usageUsed,
    document.createTextNode(" / "),
    usageWindow,
    document.createTextNode(` ${t(currentLocale, "tokensUnit")}`),
  );
  const usagePct = document.createElement("div");
  usagePct.className = "usage-pct";
  usageMeter.append(usageNumbers, usagePct);

  const usageProgress = document.createElement("div");
  const progress = mountProgress(usageProgress, {
    value: 0,
    label: t(currentLocale, "usedLabel"),
  });
  const updated = document.createElement("div");
  updated.className = "updated";
  updated.hidden = true;

  usage.append(usageHead, usageModel, usageBadges, usageMeter, usageProgress, updated);

  const mapCard = document.createElement("section");
  mapCard.className = "card map-card";
  mapCard.hidden = true;
  const mapHead = document.createElement("div");
  mapHead.className = "card-head";
  const mapTitle = document.createElement("div");
  mapTitle.className = "card-title";
  mapTitle.textContent = t(currentLocale, "mapTitle");
  const mapHint = document.createElement("div");
  mapHint.className = "sr-only";
  mapHint.setAttribute("aria-live", "polite");
  mapHint.textContent = t(currentLocale, "mapHint");
  const zoomButton = document.createElement("button");
  zoomButton.type = "button";
  zoomButton.className = "zoom";
  zoomButton.title = t(currentLocale, "zoomTitle");
  zoomButton.addEventListener("click", () => toggleZoom());
  mapHead.append(mapTitle, zoomButton, mapHint);

  const mapWrap = document.createElement("div");
  mapWrap.className = "map-wrap";
  const mapGrid = document.createElement("div");
  mapGrid.className = "map";
  mapGrid.setAttribute("role", "group");
  mapGrid.setAttribute("aria-label", t(currentLocale, "mapAria"));
  const mapTip = document.createElement("div");
  mapTip.className = "map-tip";
  mapTip.setAttribute("role", "tooltip");
  mapTip.hidden = true;
  mapWrap.append(mapGrid, mapTip);

  const mapLegend = document.createElement("div");
  mapLegend.className = "map-legend";
  const freeLegend = document.createElement("span");
  freeLegend.className = "legend-item";
  const freeLegendSwatch = document.createElement("span");
  freeLegendSwatch.className = "legend-swatch free";
  const freeLegendText = document.createElement("span");
  freeLegend.append(freeLegendSwatch, freeLegendText);
  const usedLegend = document.createElement("span");
  usedLegend.className = "legend-item";
  const usedLegendSwatch = document.createElement("span");
  usedLegendSwatch.className = "legend-swatch";
  const usedLegendText = document.createElement("span");
  usedLegend.append(usedLegendSwatch, usedLegendText);
  mapLegend.append(freeLegend, usedLegend);

  mapCard.append(mapHead, mapWrap, mapLegend);

  const breakdownCard = document.createElement("section");
  breakdownCard.className = "card breakdown-card";
  breakdownCard.hidden = true;
  const breakdownHead = document.createElement("div");
  breakdownHead.className = "card-head";
  const breakdownTitle = document.createElement("div");
  breakdownTitle.className = "card-title";
  breakdownTitle.textContent = t(currentLocale, "breakdownTitle");
  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "back";
  backButton.textContent = t(currentLocale, "back");
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
  previewPanel.setAttribute("aria-label", t(currentLocale, "previewAria"));
  const previewHead = document.createElement("div");
  previewHead.className = "preview-head";
  const previewTitle = document.createElement("div");
  previewTitle.className = "preview-title";
  const previewCopy = document.createElement("button");
  previewCopy.type = "button";
  previewCopy.className = "preview-copy";
  previewCopy.textContent = t(currentLocale, "previewCopy");
  previewCopy.setAttribute("aria-label", t(currentLocale, "previewCopyAria"));
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
  previewBody.setAttribute("aria-label", t(currentLocale, "previewBodyAria"));
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
    label: t(currentLocale, "retry"),
    variant: "outline",
    size: "xs",
    onClick: () => onManualRefresh(),
  });
  placeholder.append(placeholderTitle, placeholderDetail, placeholderActions);

  root.append(bannerSlot, versionSlot, usage, mapCard, breakdownCard, placeholder);

  let currentFreeTokens = 0;
  let mapSignature: string | null = null;
  let breakdownSignature: string | null = null;
  let cellElements = new Map<number, HTMLButtonElement>();
  let hoveredCell: CellTarget | null = null;
  let pinnedCell: CellTarget | null = null;

  let itemButtons: HTMLButtonElement[] = [];
  let copyTimer: number | null = null;

  function onPointerDown(event: PointerEvent): void {
    if (!pinnedCell) return;
    if (event.target instanceof Node && mapWrap.contains(event.target)) return;
    pinnedCell = null;
    refreshTooltip();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      pinnedCell = null;
      hoveredCell = null;
      refreshTooltip();
      if (view.preview !== null || view.selectedCategory !== null) goBack();
      return;
    }

    const zTarget = event.target;
    const typing = zTarget instanceof HTMLElement
      && (zTarget.isContentEditable || zTarget.tagName === "INPUT" || zTarget.tagName === "TEXTAREA"
        || zTarget.tagName === "SELECT");
    if (
      !typing
      && !event.defaultPrevented
      && !event.metaKey
      && !event.ctrlKey
      && !event.altKey
      && event.key.toLowerCase() === "z"
    ) {
      event.preventDefault();
      toggleZoom();
      return;
    }

    if (view.preview !== null || event.defaultPrevented) return;
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

    if (view.selectedCategory === null) {
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

    const items = view.items;
    if (items.length === 0) return;
    const activeIndex = itemButtons.indexOf(document.activeElement as HTMLButtonElement);
    const currentIndex = activeIndex >= 0
      ? activeIndex
      : itemButtons.findIndex((button) => button.dataset.itemId === view.focus.itemId);
    const next = moveFocus(currentIndex, items.length, delta);
    if (next < 0) return;
    event.preventDefault();
    model.focusItemAt(next);
    itemButtons[next]?.focus();
  }

  function onScrollOrResize(): void {
    if (!hoveredCell && !pinnedCell) return;
    hoveredCell = null;
    pinnedCell = null;
    refreshTooltip();
  }

  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);

  function versionLabel(version: string): string {
    return version.startsWith("v") ? version : `v${version}`;
  }

  function renderView(previous: PanelView | null, next: PanelView): void {
    if (previous !== null && previous.sessionID !== next.sessionID) resetSessionState();
    renderStatus(next.status);
    renderContent(next);
    if (next.body.kind === "summary") renderBreakdown(previous, next);
    syncCopyTimer(next);
    applyFocusTransition(previous, next);
    syncRetryControls();
  }

  function resetSessionState(): void {
    currentFreeTokens = 0;
    mapSignature = null;
    breakdownSignature = null;
    cellElements.clear();
    hoveredCell = null;
    pinnedCell = null;
    itemButtons = [];
    resetCopyFeedback();
    breakdownBody.replaceChildren();
    hideTooltip();
  }

  function renderStatus(state: PanelState): void {
    statusInline.dataset.state = state.kind;
    let title: string;
    let detail: string;
    let version: string;
    if (state.kind === "checking") {
      title = t(currentLocale, "statusCheckingTitle");
      detail = t(currentLocale, "statusCheckingDetail");
      version = "…";
    } else if (state.kind === "connected") {
      title = t(currentLocale, "statusConnectedTitle", {
        version: versionLabel(state.version),
      });
      detail = state.outdated
        ? t(currentLocale, "statusOutdatedDetail", {
          expected: versionLabel(state.expectedVersion ?? COLLECTOR_VERSION),
        })
        : t(currentLocale, "statusConnectedDetail");
      version = versionLabel(state.version);
    } else if (state.kind === "disconnected") {
      if (state.reason === "unreachable") {
        title = t(currentLocale, "collectorUnreachableTitle");
        detail = t(currentLocale, "collectorUnreachableDetail");
      } else {
        title = t(currentLocale, "collectorNotRunning");
        detail = t(currentLocale, "collectorNotRunningDetail", {
          path: COLLECTOR_INSTALL_PATH,
        });
      }
      version = "—";
    } else {
      title = t(currentLocale, state.titleKey);
      detail = t(currentLocale, state.detailKey);
      version = "—";
    }
    statusVersion.textContent = version;
    const full = `${title} · ${detail}`;
    statusInline.title = full;
    statusInline.setAttribute("aria-label", full);
  }

  function renderStaticCopy(): void {
    refreshNode?.setAttribute("aria-label", t(currentLocale, "refresh"));
    refreshNode?.setAttribute("title", t(currentLocale, "refresh"));
    usageTitle.textContent = t(currentLocale, "usageTitle");
    estimatedSlot.title = t(currentLocale, "estimatedTitle");
    estimatedBadge.update({ label: t(currentLocale, "estimatedBadge") });
    assumedSlot.title = t(currentLocale, "assumedWindowTitle");
    assumedBadge.update({ label: t(currentLocale, "assumedWindowBadge") });
    baselineSlot.title = t(currentLocale, "baselineTitle");
    baselineBadge.update({ label: t(currentLocale, "baselineBadge") });
    mapTitle.textContent = t(currentLocale, "mapTitle");
    mapHint.textContent = t(currentLocale, "mapHint");
    mapGrid.setAttribute("aria-label", t(currentLocale, "mapAria"));
    zoomButton.title = t(currentLocale, "zoomTitle");
    breakdownTitle.textContent = t(currentLocale, "breakdownTitle");
    backButton.textContent = t(currentLocale, "back");
    previewPanel.setAttribute("aria-label", t(currentLocale, "previewAria"));
    previewCopy.textContent = t(currentLocale, "previewCopy");
    previewCopy.setAttribute("aria-label", t(currentLocale, "previewCopyAria"));
    previewBody.setAttribute("aria-label", t(currentLocale, "previewBodyAria"));
    renderVersionBanner();
    renderRefreshBanner();
    renderStatus(view.status);
    mapSignature = null;
    breakdownSignature = null;
  }

  function renderVersionBanner(): void {
    const status = view.status;
    const outdated = status.kind === "connected" && status.outdated === true
      ? {
        version: status.version,
        expectedVersion: status.expectedVersion ?? COLLECTOR_VERSION,
      }
      : null;
    versionSlot.hidden = outdated === null;
    if (outdated === null) return;
    versionBanner.update({
      tone: "warning",
      title: t(currentLocale, "versionOutdatedTitle"),
      body: t(currentLocale, "versionOutdatedBody", {
        version: versionLabel(outdated.version),
        expected: versionLabel(outdated.expectedVersion),
      }),
    });
  }

  function showPlaceholder(headline: string, detail: string, retry = false): void {
    usage.hidden = false;
    usageModel.hidden = true;
    usageBadges.hidden = true;
    usageMeter.hidden = true;
    usageProgress.hidden = true;
    updated.hidden = true;
    mapCard.hidden = true;
    breakdownCard.hidden = true;
    mapSignature = null;
    breakdownSignature = null;
    hoveredCell = null;
    pinnedCell = null;
    itemButtons = [];
    resetCopyFeedback();
    hideTooltip();
    breakdownBody.replaceChildren();
    placeholder.hidden = false;
    placeholderTitle.textContent = headline;
    placeholderDetail.textContent = detail;
    placeholderActions.hidden = !retry;
    syncRetryControls();
  }

  function renderContent(next: PanelView): void {
    renderUpdated(next.summary);
    renderVersionBanner();
    const body = next.body;
    if (body.kind === "summary") {
      renderSummary(body.summary, next);
      return;
    }
    showPlaceholder(
      body.args === undefined
        ? t(currentLocale, body.titleKey)
        : t(currentLocale, body.titleKey, body.args),
      body.args === undefined
        ? t(currentLocale, body.detailKey)
        : t(currentLocale, body.detailKey, body.args),
      body.retry,
    );
  }

  function formatNumber(value: number): string {
    return new Intl.NumberFormat(currentLocale === "zh" ? "zh-CN" : "en-US").format(value);
  }

  function itemCountLabel(count: number): string {
    return count === 1
      ? t(currentLocale, "itemCountOne")
      : t(currentLocale, "itemCountMany", { items: formatNumber(count) });
  }

  function formatPercent(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function pad2(value: number): string {
    return String(value).padStart(2, "0");
  }

  /** 「更新于」只显示快照的采集时间，不用本地当前时间冒充。 */
  function renderUpdated(next: SnapshotSummary | null): void {
    const collectedAt = next?.collectedAt ?? null;
    if (collectedAt === null) {
      updated.hidden = true;
      updated.textContent = "";
      updated.removeAttribute("title");
      return;
    }

    const date = new Date(collectedAt);
    if (Number.isNaN(date.getTime())) {
      updated.hidden = false;
      updated.textContent = next?.restored
        ? `${collectedAt}${t(currentLocale, "restoredSuffix")}`
        : collectedAt;
      updated.title = collectedAt;
      return;
    }

    const today = new Date();
    const sameDay = date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
    const clock = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
    updated.hidden = false;
    const label = sameDay
      ? t(currentLocale, "updatedToday", { clock })
      : t(currentLocale, "updatedOtherDay", {
        month: date.getMonth() + 1,
        day: date.getDate(),
        clock,
      });
    updated.textContent = next?.restored
      ? `${label}${t(currentLocale, "restoredSuffix")}`
      : label;
    updated.title = t(currentLocale, "collectedAtTitle", {
      date: date.toLocaleString(currentLocale === "zh" ? "zh-CN" : "en-US", { hour12: false }),
    });
  }

  function snapshotSignature(next: SnapshotSummary, zoom: PanelView["zoom"]): string {
    return [
      next.sessionID,
      next.collectedAt,
      next.used,
      next.window,
      zoom,
      next.categories.map((usage) => `${usage.category}:${usage.items}:${usage.tokens}`).join(","),
      next.items.length,
    ].join("|");
  }

  function compactNumber(value: number): string {
    const safe = Math.max(0, Math.round(value));
    if (safe < 1000) return String(safe);
    const scaled = safe / 1000;
    const digits = scaled >= 10 ? 0 : 1;
    return `${scaled.toFixed(digits).replace(/\.0$/, "")}k`;
  }

  function renderZoomLabel(layout: MapLayout): void {
    const value = compactNumber(layout.denominator);
    zoomButton.textContent = t(
      currentLocale,
      view.zoom === "window" ? "zoomWindow" : "zoomFit",
      { value },
    );
    zoomButton.title = t(currentLocale, "zoomTitle");
  }

  function toggleZoom(): void {
    model.setZoom(view.zoom === "window" ? "fit" : "window");
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

  function categoryLabel(category: Category): string {
    return t(currentLocale, CATEGORY_LABEL_KEYS[category]);
  }

  function cellLabel(cell: MapCell): string {
    return cell.segments
      .map(
        (segment) =>
          `${categoryLabel(segment.category)} ${t(currentLocale, "tokenCount", {
            tokens: formatNumber(Math.round(segment.tokens)),
          })}`,
      )
      .join(t(currentLocale, "listSeparator"));
  }

  function renderMap(next: SnapshotSummary, layout: MapLayout): void {
    renderZoomLabel(layout);
    const denominator = layout.denominator;
    currentFreeTokens = Math.max(0, denominator - next.used);
    freeLegendText.textContent = t(currentLocale, "freeLegend", {
      value: compactNumber(currentFreeTokens),
    });
    usedLegendText.textContent = t(currentLocale, "usedLegend", {
      value: compactNumber(next.used),
    });

    hoveredCell = null;
    pinnedCell = null;
    hideTooltip();
    mapGrid.replaceChildren();
    cellElements = new Map();
    mapHint.textContent = t(currentLocale, "mapHint");

    for (const cell of layout.cells) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = cell.free ? "cell free" : "cell";
      button.tabIndex = -1;
      button.style.background = cell.free ? "" : cellBackground(cell);
      button.setAttribute(
        "aria-label",
        cell.free
          ? t(currentLocale, "freeCellLabel", { tokens: formatNumber(currentFreeTokens) })
          : cellLabel(cell),
      );
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
        if (cell.free) {
          clearMapFocus();
          model.selectCategory(null);
          return;
        }
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
    if (cell.free) {
      const row = document.createElement("div");
      row.className = "tip-row";
      const dot = document.createElement("span");
      dot.className = "swatch free";
      const name = document.createElement("span");
      name.textContent = t(currentLocale, "freeSpace");
      const tokens = document.createElement("span");
      tokens.className = "tip-tokens";
      tokens.textContent = t(currentLocale, "tokenCount", {
        tokens: formatNumber(currentFreeTokens),
      });
      row.append(dot, name, tokens);
      fragment.append(row);
      mapHint.textContent = t(currentLocale, "freeCellLabel", {
        tokens: formatNumber(currentFreeTokens),
      });
    } else {
      for (const segment of cell.segments) {
        const row = document.createElement("div");
        row.className = "tip-row";
        const dot = document.createElement("span");
        dot.className = "swatch";
        dot.style.background = `var(--cat-${segment.category})`;
        const name = document.createElement("span");
        name.textContent = categoryLabel(segment.category);
        const tokens = document.createElement("span");
        tokens.className = "tip-tokens";
        tokens.textContent = t(currentLocale, "tokenCount", {
          tokens: formatNumber(Math.round(segment.tokens)),
        });
        row.append(dot, name, tokens);
        fragment.append(row);
      }
      mapHint.textContent = cell.segments
        .map(
          (segment) =>
            `${categoryLabel(segment.category)} ${t(currentLocale, "tokenCount", {
              tokens: formatNumber(Math.round(segment.tokens)),
            })}`,
        )
        .join(t(currentLocale, "listSeparator"));
    }
    mapTip.replaceChildren(fragment);
    mapTip.hidden = false;
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
      mapHint.textContent = t(currentLocale, "mapHint");
    }
  }

  /** 离开分类时同时清掉悬停与钉住的提示，和旧的 selectCategory 行为一致。 */
  function clearMapFocus(): void {
    hoveredCell = null;
    pinnedCell = null;
    hideTooltip();
  }

  /** `focus` 已由模型按条目列表夹好；视图只按 id 找按钮，找不到才用下标。 */
  function focusItemButton(focus: PanelFocus): void {
    const byId = focus.itemId === null
      ? undefined
      : itemButtons.find((button) => button.dataset.itemId === focus.itemId);
    (byId ?? itemButtons[focus.fallback] ?? backButton).focus();
  }

  function focusFirstItemOrBack(): void {
    if (view.layer === "items" && view.items.length > 0) focusItemButton(view.focus);
    else backButton.focus();
  }

  function focusCategoryRow(category: Category): void {
    for (const row of breakdownBody.querySelectorAll<HTMLButtonElement>("button.row[data-category]")) {
      if (row.dataset.category === category) {
        row.focus();
        return;
      }
    }
  }

  function clearCopyTimer(): void {
    if (copyTimer === null) return;
    window.clearTimeout(copyTimer);
    copyTimer = null;
  }

  function resetCopyFeedback(): void {
    clearCopyTimer();
    previewCopy.textContent = t(currentLocale, "previewCopy");
    previewStatus.textContent = "";
    previewStatus.dataset.tone = "";
  }

  function scheduleCopyClear(): void {
    clearCopyTimer();
    copyTimer = window.setTimeout(() => {
      copyTimer = null;
      if (model.getView().notice === "previewCopied") model.setNotice(null);
    }, 1_500);
  }

  function syncCopyTimer(next: PanelView): void {
    if (next.notice !== "previewCopied") {
      clearCopyTimer();
      return;
    }
    if (copyTimer === null) scheduleCopyClear();
  }

  function goBack(): void {
    const previousCategory = view.selectedCategory;
    const previousLayer = view.layer;
    if (previousLayer === "overview") return;
    model.goBack();
    if (model.getView().layer === "overview") {
      clearMapFocus();
      if (previousLayer === "items" && previousCategory !== null) {
        focusCategoryRow(previousCategory);
      }
    }
  }

  function applySelection(current: PanelView): void {
    const selected = current.selectedCategory;
    const activeCells = selected !== null && current.layout !== null
      ? new Set(current.layout.cellsByCategory[selected])
      : null;
    for (const [index, element] of cellElements) {
      const active = activeCells?.has(index) === true;
      element.classList.toggle("is-active", active);
      element.classList.toggle("is-dim", selected !== null && !active);
    }
  }

  function applyFocusTransition(previous: PanelView | null, next: PanelView): void {
    if (previous === null || next.body.kind !== "summary") return;
    if (previous.preview !== null && next.preview === null) {
      if (next.layer === "items") {
        focusItemButton(next.focus);
        return;
      }
      if (next.layer === "overview" && previous.selectedCategory !== null) {
        focusCategoryRow(previous.selectedCategory);
        return;
      }
    }
    if (previous.layer === "overview" && next.layer === "items" && next.preview === null) {
      focusFirstItemOrBack();
    }
  }

  function breakdownSignatureFor(current: PanelView): string {
    const preview = current.preview;
    if (preview !== null) {
      return [
        "preview",
        preview.itemId,
        preview.category,
        preview.title,
        preview.chars,
        preview.text,
        preview.loading,
        preview.error ?? "",
        preview.truncated,
        current.notice ?? "",
      ].join("|");
    }
    const summary = current.summary;
    return [
      "list",
      summary?.sessionID ?? "",
      summary?.collectedAt ?? "",
      summary?.used ?? 0,
      summary?.window ?? 0,
      summary?.categories.map((usage) => `${usage.category}:${usage.items}:${usage.tokens}`).join(",") ?? "",
      summary?.items.map((item) => `${item.id}:${item.title}:${item.chars}`).join(",") ?? "",
      current.selectedCategory ?? "",
      current.layer,
      current.notice ?? "",
    ].join("|");
  }

  function renderBreakdown(previous: PanelView | null, next: PanelView): void {
    if (next.body.kind !== "summary" || next.summary === null) {
      backButton.hidden = true;
      return;
    }
    const signature = breakdownSignatureFor(next);
    if (signature === breakdownSignature) return;
    breakdownSignature = signature;

    const active = document.activeElement;
    const activeElement = active instanceof HTMLElement && breakdownBody.contains(active) ? active : null;
    const activeItemId = activeElement?.dataset.itemId ?? null;
    const activeCategory = activeElement?.dataset.category ?? null;
    const activePreview = active === previewCopy
      ? previewCopy
      : active === previewBody
        ? previewBody
        : active === previewPanel
          ? previewPanel
          : null;

    breakdownBody.replaceChildren();
    itemButtons = [];
    const current = next.summary;
    backButton.hidden = next.selectedCategory === null && next.preview === null;

    if (next.preview !== null) {
      renderPreview(next.preview, next.notice);
      if (activePreview !== null) activePreview.focus();
      else if (
        previous === null
        || previous.preview === null
        || previous.preview.itemId !== next.preview.itemId
      ) {
        previewPanel.focus();
      }
      return;
    }

    if (next.notice !== null) {
      const note = document.createElement("div");
      note.className = "notice";
      note.setAttribute("role", "status");
      note.textContent = t(currentLocale, next.notice);
      breakdownBody.append(note);
    }

    if (next.selectedCategory !== null) {
      const category = next.selectedCategory;
      const row = next.breakdown?.rows.find((entry) => entry.category === category);
      const items = next.items;

      const drill = document.createElement("div");
      drill.className = "drill-head";
      const drillTitle = document.createElement("div");
      drillTitle.className = "drill-title";
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = `var(--cat-${category})`;
      const name = document.createElement("span");
      name.textContent = categoryLabel(category);
      drillTitle.append(swatch, name);
      const drillMeta = document.createElement("div");
      drillMeta.className = "drill-meta";
      drillMeta.textContent = row
        ? t(currentLocale, "drillMeta", {
          items: itemCountLabel(row.items),
          tokens: formatNumber(row.tokens),
        })
        : itemCountLabel(items.length);
      drill.append(drillTitle, drillMeta);
      breakdownBody.append(drill);

      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "drill-empty";
        empty.textContent = t(currentLocale, "drillEmpty");
        breakdownBody.append(empty);
        return;
      }

      for (const [index, item] of items.entries()) {
        const itemRow = document.createElement("button");
        itemRow.type = "button";
        itemRow.className = "item-row";
        itemRow.dataset.itemId = item.id;
        const itemTitle = document.createElement("div");
        itemTitle.className = "item-title";
        itemTitle.textContent = item.title || t(currentLocale, "unnamedItem");
        itemTitle.title = item.title;
        const itemMeta = document.createElement("div");
        itemMeta.className = "item-meta";
        itemMeta.textContent = t(currentLocale, "itemChars", {
          chars: formatNumber(item.chars),
        });
        itemRow.append(itemTitle, itemMeta);
        itemRow.addEventListener("click", () => { void model.openItem(item.id); });
        itemRow.addEventListener("focus", () => {
          model.focusItemById(item.id, index);
        });
        itemButtons.push(itemRow);
        breakdownBody.append(itemRow);
      }

      if (activeItemId !== null) {
        focusItemButton({ itemId: activeItemId, fallback: next.focus.fallback });
      }
      return;
    }

    backButton.hidden = true;
    const list = document.createElement("div");
    list.className = "breakdown-list";
    for (const entry of next.breakdown?.rows ?? []) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "row";
      row.dataset.category = entry.category;
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = `var(--cat-${entry.category})`;
      const name = document.createElement("span");
      name.className = "row-name";
      name.textContent = categoryLabel(entry.category);
      const meta = document.createElement("span");
      meta.className = "row-meta";
      meta.textContent = t(currentLocale, "drillMeta", {
        items: itemCountLabel(entry.items),
        tokens: formatNumber(entry.tokens),
      });
      row.append(swatch, name, meta);
      row.addEventListener("click", () => {
        clearMapFocus();
        model.selectCategory(entry.category);
      });
      list.append(row);
    }

    const free = document.createElement("div");
    free.className = "row row-free";
    const freeSwatch = document.createElement("span");
    freeSwatch.className = "swatch free";
    const freeName = document.createElement("span");
    freeName.className = "row-name";
    freeName.textContent = t(currentLocale, "freeSpace");
    const freeMeta = document.createElement("span");
    freeMeta.className = "row-meta";
    const bar = windowBar(current.used, current.window);
    const freeTokens = t(currentLocale, "tokenCount", { tokens: formatNumber(bar.free) });
    freeMeta.textContent = bar.over
      ? `${freeTokens} · ${t(currentLocale, "overWindow")}`
      : freeTokens;
    freeMeta.classList.toggle("is-over", bar.over);
    free.append(freeSwatch, freeName, freeMeta);
    list.append(free);
    breakdownBody.append(list);

    const knownCategory = CATEGORIES.find((category) => category === activeCategory);
    if (knownCategory) focusCategoryRow(knownCategory);
  }

  function renderPreview(state: PreviewState, notice: PanelView["notice"]): void {
    previewTitle.textContent = state.title || t(currentLocale, "unnamedItem");
    const suffix = state.truncated
      ? t(currentLocale, "previewTruncated", { chars: formatNumber(PREVIEW_MAX_CHARS) })
      : "";
    previewMeta.textContent =
      `${categoryLabel(state.category)} · ${t(currentLocale, "itemChars", { chars: formatNumber(state.chars) })}${suffix}`;
    previewBody.textContent = state.text;
    previewBody.hidden = state.loading || state.error !== null;
    previewCopy.disabled = state.loading || state.error !== null;
    previewCopy.textContent = notice === "previewCopied"
      ? t(currentLocale, "previewCopiedButton")
      : t(currentLocale, "previewCopy");
    if (state.loading) {
      previewStatus.textContent = t(currentLocale, "previewLoading");
      previewStatus.dataset.tone = "";
    } else if (state.error !== null) {
      previewStatus.textContent = t(currentLocale, state.error);
      previewStatus.dataset.tone = "error";
    } else if (notice === "previewCopied") {
      previewStatus.textContent = t(currentLocale, "previewCopied");
      previewStatus.dataset.tone = "ok";
    } else if (notice === "previewCopyFailed") {
      previewStatus.textContent = t(currentLocale, "previewCopyFailed");
      previewStatus.dataset.tone = "error";
    } else {
      previewStatus.textContent = "";
      previewStatus.dataset.tone = "";
    }
    breakdownBody.append(previewPanel);
  }

  async function copyPreview(): Promise<void> {
    const current = view.preview;
    if (!current || current.loading || current.error !== null) return;
    const itemId = current.itemId;
    const text = current.text;
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
    if (view.preview?.itemId !== itemId) return;

    if (copied) {
      model.setNotice("previewCopied");
      scheduleCopyClear();
      return;
    }

    model.setNotice("previewCopyFailed");
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

  function renderSummary(next: SnapshotSummary, current: PanelView): void {
    placeholder.hidden = true;
    usage.hidden = false;
    usageModel.hidden = false;
    usageMeter.hidden = false;
    usageProgress.hidden = false;
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
      label: t(currentLocale, "usedLabel"),
    });

    estimatedSlot.hidden = !next.estimated;
    assumedSlot.hidden = !next.windowAssumed;
    baselineSlot.hidden = !next.baseline;
    usageBadges.hidden = !(next.estimated || next.windowAssumed || next.baseline);

    const signature = snapshotSignature(next, current.zoom);
    if (signature !== mapSignature) {
      mapSignature = signature;
      if (current.layout !== null) renderMap(next, current.layout);
    }
    applySelection(current);
  }

  function renderRefreshBanner(): void {
    const refresh = view.refresh;
    const next = refreshBanner(refresh.state);
    bannerSlot.hidden = next === null;
    if (next !== null) {
      // 请求在途时收起 banner 的重试入口，避免和顶部/占位区按钮重复触发。
      banner.update({
        tone: next.tone,
        title: t(currentLocale, next.titleKey),
        body: t(currentLocale, next.bodyKey),
        action: refresh.manualLoading || refresh.inFlight
          ? undefined
          : { label: t(currentLocale, "retry"), onClick: () => onManualRefresh() },
      });
    }
  }

  function syncRetryControls(): void {
    const refresh = view.refresh;
    const busy = refresh.manualLoading || refresh.inFlight;
    refreshButton.update({ disabled: busy, loading: refresh.manualLoading });
    placeholderRetry.update({
      disabled: busy,
      loading: refresh.manualLoading,
      label: refresh.manualLoading ? t(currentLocale, "retrying") : t(currentLocale, "retry"),
    });
    renderRefreshBanner();
  }

  const unsubscribe = model.subscribe((next) => {
    const previous = view;
    view = next;
    renderView(previous, next);
  });
  renderView(null, view);

  return {
    setLocale(locale) {
      if (locale === currentLocale) return;
      currentLocale = locale;
      renderStaticCopy();
      renderView(view, view);
    },

    dispose() {
      unsubscribe();
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      clearCopyTimer();
    },
  };
}
