/**
 * 面板的展示状态与内容优先级。
 *
 * 模型只持有数据，不碰 DOM，也不拥有刷新生命周期；入口把 host、连接和
 * RefreshController 的结果送进来，视图只读取 `getView()` 并负责翻译与绘制。
 */

import { COLLECTOR_VERSION } from "../shared/version.ts";
import type { CollectorStatus, SnapshotSummary } from "../shared/types.ts";
import type { HostFailureCopy } from "./failure.ts";
import type { MessageKey } from "./i18n.ts";
import { initialRefreshState, type RefreshView } from "./refresh.ts";

/** Collector 的安装位置；作为占位文案参数由模型提供。 */
export const COLLECTOR_INSTALL_PATH = "~/.config/opencode/plugins/";

export type SummaryProblem = "timeout" | "other";

export type PanelState =
  | { kind: "checking" }
  | { kind: "connected"; version: string; outdated?: boolean; expectedVersion?: string }
  | { kind: "disconnected"; reason: "not_found" | "unreachable" }
  | { kind: "failed"; titleKey: MessageKey; detailKey: MessageKey };

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

export interface PanelView {
  status: PanelState;
  body: PanelBody;
  sessionID: string | null;
  busy: boolean;
  booted: boolean;
  connection: CollectorStatus | null;
  summary: SnapshotSummary | null;
  summaryProblem: SummaryProblem | null;
  hostProblem: HostFailureCopy | null;
  refresh: RefreshView;
}

export interface HostProblemOptions {
  /**
   * 已有数据时的非阻断 host 错误：只把状态条改为 failed，不替换正文。
   * 这是现有 `noteUnreachable` 的「保留内容」路径。
   */
  keepContent?: boolean;
}

export interface PanelModel {
  setBooted(booted: boolean): void;
  setSession(sessionID: string | null, busy: boolean): void;
  setConnection(status: CollectorStatus | null): void;
  setHostProblem(problem: HostFailureCopy | null, options?: HostProblemOptions): void;
  setSummary(summary: SnapshotSummary | null): void;
  setSummaryProblem(problem: SummaryProblem | null): void;
  setRefresh(view: RefreshView): void;
  getView(): PanelView;
  subscribe(listener: (view: PanelView) => void): () => void;
}

function initialRefresh(): RefreshView {
  const state = initialRefreshState();
  return {
    state,
    inFlight: false,
    manualLoading: false,
    hasLoaded: false,
    banner: null,
  };
}

function sameCopy(a: HostFailureCopy | null, b: HostFailureCopy | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.titleKey === b.titleKey && a.detailKey === b.detailKey;
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

export function createPanelModel(): PanelModel {
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

  function status(): PanelState {
    const failure = hostProblem ?? statusFailure;
    if (failure !== null) {
      return { kind: "failed", titleKey: failure.titleKey, detailKey: failure.detailKey };
    }
    if (!booted || connection === null) return { kind: "checking" };
    if (connection.connected && typeof connection.version === "string" && connection.version !== "") {
      if (connection.outdated === true) {
        return {
          kind: "connected",
          version: connection.version,
          outdated: true,
          expectedVersion: connection.expectedVersion ?? COLLECTOR_VERSION,
        };
      }
      return { kind: "connected", version: connection.version };
    }
    return {
      kind: "disconnected",
      reason: connection.reason === "unreachable" ? "unreachable" : "not_found",
    };
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
      if (connection.reason === "unreachable") {
        return placeholder("collectorUnreachableTitle", "collectorUnreachableDetail", true);
      }
      return placeholder(
        "collectorNotRunning",
        "collectorNotRunningDetail",
        true,
        { path: COLLECTOR_INSTALL_PATH },
      );
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

  function getView(): PanelView {
    return {
      status: status(),
      body: body(),
      sessionID,
      busy,
      booted,
      connection,
      summary,
      summaryProblem,
      hostProblem,
      refresh,
    };
  }

  function notify(): void {
    const view = getView();
    for (const listener of [...listeners]) listener(view);
  }

  return {
    setBooted(next) {
      if (booted === next) return;
      booted = next;
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
      notify();
    },

    setConnection(next) {
      if (sameConnection(connection, next)) return;
      connection = next;
      notify();
    },

    setHostProblem(problem, options = {}) {
      const keepContent = problem !== null && options.keepContent === true;
      const nextHost = keepContent ? null : problem;
      const nextStatus = problem;
      if (sameCopy(hostProblem, nextHost) && sameCopy(statusFailure, nextStatus)) return;
      hostProblem = nextHost;
      statusFailure = nextStatus;
      notify();
    },

    setSummary(next) {
      if (summary === next && summaryProblem === null) return;
      summary = next;
      summaryProblem = null;
      notify();
    },

    setSummaryProblem(problem) {
      if (summaryProblem === problem) return;
      summaryProblem = problem;
      notify();
    },

    setRefresh(view) {
      if (refresh === view) return;
      refresh = view;
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
