/**
 * 面板的展示状态、内容优先级与交互状态。
 *
 * 模型只持有数据，不碰 DOM，也不拥有刷新生命周期；入口把 host、连接和
 * RefreshController 的结果送进来。状态条和占位区的文案也在这里决定，
 * 视图只读取 `getView()` 并负责翻译与绘制。
 */

import { COLLECTOR_VERSION } from "../shared/version.ts";
import type {
  Category,
  CollectorStatus,
  ItemSummary,
  SnapshotItemDetail,
  SnapshotSummary,
} from "../shared/types.ts";
import type { HostFailureCopy } from "./failure.ts";
import { versionLabel } from "./format.ts";
import type { MessageKey } from "./i18n.ts";
import {
  buildBreakdown,
  categoryOfItem,
  fitDenominator,
  itemsForCategory,
  layoutMap,
  type Breakdown,
  type MapLayout,
} from "./map.ts";
import {
  clipPreviewText,
  focusIndexFor,
  layerOf,
  previewTruncated,
  type PanelLayer,
} from "./preview.ts";
import { initialRefreshState, type RefreshView } from "./refresh.ts";

/** Collector 的安装位置；作为占位文案参数由模型提供。 */
export const COLLECTOR_INSTALL_PATH = "~/.config/opencode/plugins/";

export type SummaryProblem = "timeout" | "other";

/** 状态条文案：模型决定 key 和参数，视图只负责按 locale 翻译。 */
export type PanelStatusCopy = {
  titleKey: MessageKey;
  detailKey: MessageKey;
  args?: Record<string, string | number>;
};

export type PanelState =
  | ({ kind: "checking" } & PanelStatusCopy)
  | ({ kind: "connected"; version: string } & PanelStatusCopy & (
    | { outdated?: false; expectedVersion?: undefined }
    | { outdated: true; expectedVersion: string }
  ))
  | ({ kind: "disconnected"; reason: "not_found" | "unreachable" } & PanelStatusCopy)
  | ({ kind: "failed" } & PanelStatusCopy);

export interface PlaceholderBody {
  kind: "placeholder";
  titleKey: MessageKey;
  detailKey: MessageKey;
  args?: Record<string, string | number>;
  retry: boolean;
}

export interface SummaryBody {
  kind: "summary";
  summary: SnapshotSummary;
}

export type PanelBody = PlaceholderBody | SummaryBody;

/** 地图分母的两种口径：真实窗口，或按已用量留余量的 fit。 */
export type PanelZoom = "window" | "fit";

export interface PreviewState {
  itemId: string;
  category: Category;
  title: string;
  chars: number;
  text: string;
  loading: boolean;
  error: MessageKey | null;
  truncated: boolean;
}

export interface PanelFocus {
  itemId: string | null;
  fallback: number;
}

export interface PanelView {
  status: PanelState;
  body: PanelBody;
  sessionID: string | null;
  summary: SnapshotSummary | null;
  refresh: RefreshView;
  selectedCategory: Category | null;
  layer: PanelLayer;
  items: ItemSummary[];
  layout: MapLayout | null;
  breakdown: Breakdown | null;
  zoom: PanelZoom;
  preview: PreviewState | null;
  focus: PanelFocus;
  notice: MessageKey | null;
}

/** `loadItem` 的判别结果；模型只认识这五种情况，不接触 HTTP。 */
export type ItemLoadResult =
  | { kind: "ok"; detail: SnapshotItemDetail }
  | { kind: "missing" }
  | { kind: "restored" }
  | { kind: "read-error" }
  | { kind: "bad-format" };

export interface PanelModelDeps {
  /** 读取单个条目；入口负责 HTTP 与格式解析。 */
  loadItem?: (sessionID: string, itemId: string) => Promise<ItemLoadResult>;
  /** 非恢复快照的 404：由入口触发一次事件刷新。 */
  onPreviewMissing?: () => void;
}

export interface PanelModel {
  setBooted(booted: boolean): void;
  setSession(sessionID: string | null, busy: boolean): void;
  setConnection(status: CollectorStatus | null): void;
  /** 返回这次错误是否阻断了正文，供刷新流程决定是否标记已加载。 */
  setHostProblem(problem: HostFailureCopy | null): boolean;
  setSummary(summary: SnapshotSummary | null): void;
  setSummaryProblem(problem: SummaryProblem | null): void;
  setRefresh(view: RefreshView): void;
  selectCategory(category: Category | null): void;
  openItem(itemId: string): Promise<void>;
  closePreview(): void;
  goBack(): void;
  setZoom(zoom: PanelZoom): void;
  focusItemAt(index: number): void;
  focusItemById(itemId: string | null, fallback?: number): void;
  setNotice(notice: MessageKey | null): void;
  getView(): PanelView;
  subscribe(listener: (view: PanelView) => void): () => void;
}

function initialRefresh(): RefreshView {
  return {
    state: initialRefreshState(),
    inFlight: false,
    manualLoading: false,
    hasLoaded: false,
  };
}

function sameCopy(a: HostFailureCopy | null, b: HostFailureCopy | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.titleKey === b.titleKey
    && a.detailKey === b.detailKey
    && a.blocking === b.blocking;
}

function sameConnection(a: CollectorStatus | null, b: CollectorStatus | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.connected === b.connected
    && a.version === b.version
    && a.reason === b.reason
    && a.outdated === b.outdated
    && a.expectedVersion === b.expectedVersion;
}

export function createPanelModel(deps: PanelModelDeps = {}): PanelModel {
  let booted = false;
  let sessionID: string | null = null;
  let busy = false;
  let connection: CollectorStatus | null = null;
  /** 阻断正文的 host 错误。 */
  let hostProblem: HostFailureCopy | null = null;
  /** 只改变状态条的 host 错误；正文继续按连接/摘要渲染。 */
  let statusFailure: HostFailureCopy | null = null;
  let summary: SnapshotSummary | null = null;
  let summaryProblem: SummaryProblem | null = null;
  let refresh = initialRefresh();
  const listeners = new Set<(view: PanelView) => void>();

  let selectedCategory: Category | null = null;
  let zoom: PanelZoom = "window";
  let preview: PreviewState | null = null;
  /** 每次打开、关闭或切换 session 都递增，迟到的响应据此丢弃。 */
  let previewToken = 0;
  let focusItemId: string | null = null;
  let focusItemFallback = 0;
  let notice: MessageKey | null = null;

  const loadItem = deps.loadItem
    ?? (() => Promise.resolve<ItemLoadResult>({ kind: "read-error" }));
  const onPreviewMissing = deps.onPreviewMissing ?? (() => {});

  /**
   * 状态条与占位区共用的 Collector 故障文案；只在这里决定 key 和参数，
   * 避免两处对同一个故障给出不同诊断。
   */
  function collectorCopy(reason: "not_found" | "unreachable"): PanelStatusCopy {
    if (reason === "unreachable") {
      return {
        titleKey: "collectorUnreachableTitle",
        detailKey: "collectorUnreachableDetail",
      };
    }
    return {
      titleKey: "collectorNotRunning",
      detailKey: "collectorNotRunningDetail",
      args: { path: COLLECTOR_INSTALL_PATH },
    };
  }

  function status(): PanelState {
    const failure = hostProblem ?? statusFailure;
    if (failure !== null) {
      return { kind: "failed", titleKey: failure.titleKey, detailKey: failure.detailKey };
    }
    if (!booted || connection === null) {
      return {
        kind: "checking",
        titleKey: "statusCheckingTitle",
        detailKey: "statusCheckingDetail",
      };
    }
    if (connection.connected && typeof connection.version === "string" && connection.version !== "") {
      if (connection.outdated === true) {
        const expectedVersion = connection.expectedVersion ?? COLLECTOR_VERSION;
        return {
          kind: "connected",
          version: connection.version,
          outdated: true,
          expectedVersion,
          titleKey: "statusConnectedTitle",
          detailKey: "statusOutdatedDetail",
          args: {
            version: versionLabel(connection.version),
            expected: versionLabel(expectedVersion),
          },
        };
      }
      return {
        kind: "connected",
        version: connection.version,
        titleKey: "statusConnectedTitle",
        detailKey: "statusConnectedDetail",
        args: { version: versionLabel(connection.version) },
      };
    }
    const reason = connection.reason === "unreachable" ? "unreachable" : "not_found";
    return { kind: "disconnected", reason, ...collectorCopy(reason) };
  }

  function placeholder(
    titleKey: MessageKey,
    detailKey: MessageKey,
    retry: boolean,
    args?: Record<string, string | number>,
  ): PlaceholderBody {
    return args === undefined
      ? { kind: "placeholder", titleKey, detailKey, retry }
      : { kind: "placeholder", titleKey, detailKey, args, retry };
  }

  function body(): PanelBody {
    if (!booted) {
      return placeholder("connectingTitle", "connectingDetail", false);
    }
    if (sessionID === null) {
      return placeholder("noSessionTitle", "noSessionDetail", true);
    }
    if (hostProblem !== null) {
      return placeholder(hostProblem.titleKey, hostProblem.detailKey, true);
    }
    if (connection !== null && !connection.connected) {
      const copy = collectorCopy(
        connection.reason === "unreachable" ? "unreachable" : "not_found",
      );
      return placeholder(copy.titleKey, copy.detailKey, true, copy.args);
    }
    if (summaryProblem !== null) {
      return summaryProblem === "timeout"
        ? placeholder("summaryTimeoutTitle", "summaryTimeoutDetail", true)
        : placeholder("summaryUnavailableTitle", "summaryUnavailableDetail", true);
    }
    if (summary === null || summary.sessionID !== sessionID) {
      return placeholder("waitingForFirstRequestTitle", "waitingForFirstRequestDetail", true);
    }
    return { kind: "summary", summary };
  }

  /** 当前 session 下可用于渲染的摘要；session 不匹配时视为没有数据。 */
  function activeSummary(): SnapshotSummary | null {
    return summary !== null && sessionID !== null && summary.sessionID === sessionID
      ? summary
      : null;
  }

  function currentItems(): ItemSummary[] {
    const current = activeSummary();
    if (current === null || selectedCategory === null) return [];
    return itemsForCategory(current.items, selectedCategory);
  }

  /** fit 口径按已用量留出余量，并且不超过真实窗口。 */
  function denominatorFor(current: SnapshotSummary): number {
    const fit = Math.min(
      current.window > 0 ? current.window : Number.POSITIVE_INFINITY,
      fitDenominator(current.used),
    );
    return Math.max(1, zoom === "window" ? current.window : fit);
  }

  function layoutFor(current: SnapshotSummary): MapLayout {
    return layoutMap(current.categories, denominatorFor(current));
  }

  function dropInteraction(): void {
    if (preview !== null) previewToken += 1;
    preview = null;
    focusItemId = null;
    focusItemFallback = 0;
    notice = null;
  }

  /**
   * 正文不再是摘要时，交互层没有可依附的条目：清掉预览、焦点和提示，
   * 但保留分类选择和缩放，等数据回来后继续使用。
   */
  function reconcileContent(): void {
    if (body().kind === "summary") return;
    dropInteraction();
  }

  function validateSelection(next: SnapshotSummary | null): void {
    if (preview !== null || selectedCategory === null) return;
    if (next === null || next.sessionID !== sessionID) return;
    if (layoutFor(next).cellsByCategory[selectedCategory].length === 0) {
      selectedCategory = null;
      focusItemId = null;
      focusItemFallback = 0;
    }
  }

  function effectiveFocus(): PanelFocus {
    const list = currentItems();
    const index = focusIndexFor(list, focusItemId, focusItemFallback);
    const item = index >= 0 ? list[index] : undefined;
    return item === undefined
      ? { itemId: null, fallback: 0 }
      : { itemId: item.id, fallback: index };
  }

  function getView(): PanelView {
    const current = activeSummary();
    const list = currentItems();
    const layout = current === null ? null : layoutFor(current);
    return {
      status: status(),
      body: body(),
      sessionID,
      summary,
      refresh,
      selectedCategory,
      layer: layerOf(selectedCategory, preview?.itemId ?? null),
      items: list,
      layout,
      breakdown: current === null
        ? null
        : buildBreakdown(current.categories, current.used, current.window),
      zoom,
      preview,
      focus: effectiveFocus(),
      notice,
    };
  }

  function notify(): void {
    const view = getView();
    for (const listener of [...listeners]) listener(view);
  }

  function setPreviewError(error: MessageKey): void {
    if (preview === null) return;
    preview = { ...preview, loading: false, error };
    notify();
  }

  function closePreview(): void {
    if (preview === null) return;
    preview = null;
    previewToken += 1;
    notice = null;
    if (selectedCategory !== null && currentItems().length === 0) {
      selectedCategory = null;
      focusItemId = null;
      focusItemFallback = 0;
    }
    notify();
  }

  return {
    setBooted(next) {
      if (booted === next) return;
      booted = next;
      reconcileContent();
      notify();
    },

    setSession(nextSessionID, nextBusy) {
      if (sessionID === nextSessionID) {
        if (busy === nextBusy) return;
        busy = nextBusy;
        notify();
        return;
      }
      sessionID = nextSessionID;
      busy = nextBusy;
      summary = null;
      summaryProblem = null;
      selectedCategory = null;
      zoom = "window";
      dropInteraction();
      previewToken += 1;
      notify();
    },

    setConnection(next) {
      if (sameConnection(connection, next)) return;
      connection = next;
      reconcileContent();
      notify();
    },

    setHostProblem(problem) {
      // 非阻断错误只在已有内容时保留正文；没有内容可保留时仍按阻断处理。
      const keepContent = problem !== null
        && !problem.blocking
        && (summary !== null || connection?.connected === true);
      const nextHost = problem !== null && !keepContent ? problem : null;
      const nextStatus = problem;
      if (sameCopy(hostProblem, nextHost) && sameCopy(statusFailure, nextStatus)) {
        return hostProblem !== null;
      }
      hostProblem = nextHost;
      statusFailure = nextStatus;
      if (nextHost !== null) {
        // 阻断性 host 错误已经让连接与摘要不可信，正文只保留错误本身。
        connection = null;
        summary = null;
        summaryProblem = null;
      }
      reconcileContent();
      notify();
      return hostProblem !== null;
    },

    setSummary(next) {
      if (summary === next && summaryProblem === null) return;
      summary = next;
      summaryProblem = null;
      validateSelection(next);
      reconcileContent();
      notify();
    },

    setSummaryProblem(problem) {
      if (summaryProblem === problem) return;
      summaryProblem = problem;
      reconcileContent();
      notify();
    },

    setRefresh(view) {
      if (refresh === view) return;
      refresh = view;
      notify();
    },

    selectCategory(category) {
      if (selectedCategory === category && preview === null) return;
      selectedCategory = category;
      preview = null;
      previewToken += 1;
      focusItemId = null;
      focusItemFallback = 0;
      notice = null;
      if (category !== null) {
        const first = currentItems()[0];
        if (first !== undefined) {
          focusItemId = first.id;
          focusItemFallback = 0;
        }
      }
      notify();
    },

    async openItem(itemId) {
      const current = activeSummary();
      const requestSession = sessionID;
      if (current === null || requestSession === null) return;
      const item = current.items.find((candidate) => candidate.id === itemId);
      if (item === undefined) return;
      const category = categoryOfItem(item.id) ?? selectedCategory;
      if (category === null) return;

      const request = ++previewToken;
      const index = currentItems().findIndex((candidate) => candidate.id === item.id);
      focusItemId = item.id;
      focusItemFallback = index >= 0 ? index : 0;
      notice = null;
      preview = {
        itemId: item.id,
        category,
        title: item.title,
        chars: item.chars,
        text: "",
        loading: true,
        error: null,
        truncated: false,
      };
      notify();

      let result: ItemLoadResult;
      try {
        result = await loadItem(requestSession, item.id);
      } catch {
        if (request !== previewToken || sessionID !== requestSession || preview?.itemId !== item.id) {
          return;
        }
        setPreviewError("previewReadError");
        return;
      }

      if (request !== previewToken || sessionID !== requestSession || preview?.itemId !== item.id) {
        return;
      }

      if (result.kind === "ok") {
        const text = clipPreviewText(result.detail.text);
        preview = {
          itemId: item.id,
          category,
          title: result.detail.title || item.title,
          chars: result.detail.chars,
          text,
          loading: false,
          error: null,
          truncated: previewTruncated(result.detail.chars, text.length),
        };
        notify();
        return;
      }

      if (result.kind === "missing") {
        if (activeSummary()?.restored === true) {
          setPreviewError("previewRestoredUnavailable");
          return;
        }
        preview = null;
        previewToken += 1;
        notice = "previewMissingNotice";
        focusItemId = item.id;
        focusItemFallback = index >= 0 ? index : 0;
        notify();
        onPreviewMissing();
        return;
      }

      if (result.kind === "restored") {
        setPreviewError("previewRestoredUnavailable");
        return;
      }

      setPreviewError(result.kind === "bad-format" ? "previewBadFormat" : "previewReadError");
    },

    closePreview,

    goBack() {
      const layer = layerOf(selectedCategory, preview?.itemId ?? null);
      if (layer === "overview") return;
      if (layer === "preview") {
        closePreview();
        return;
      }
      selectedCategory = null;
      focusItemId = null;
      focusItemFallback = 0;
      notice = null;
      notify();
    },

    setZoom(next) {
      if (zoom === next) return;
      zoom = next;
      const current = activeSummary();
      if (current !== null) validateSelection(current);
      notify();
    },

    focusItemAt(index) {
      const list = currentItems();
      if (list.length === 0 || !Number.isFinite(index)) return;
      const clamped = Math.min(list.length - 1, Math.max(0, Math.trunc(index)));
      const item = list[clamped];
      if (item === undefined) return;
      if (focusItemId === item.id && focusItemFallback === clamped) return;
      focusItemId = item.id;
      focusItemFallback = clamped;
      notify();
    },

    focusItemById(itemId, fallback = 0) {
      const list = currentItems();
      const index = focusIndexFor(list, itemId, fallback);
      const item = index >= 0 ? list[index] : undefined;
      if (item === undefined) return;
      if (focusItemId === item.id && focusItemFallback === index) return;
      focusItemId = item.id;
      focusItemFallback = index;
      notify();
    },

    setNotice(next) {
      if (notice === next) return;
      notice = next;
      notify();
    },

    getView,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
