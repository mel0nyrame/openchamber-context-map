/**
 * 刷新策略：什么时候轮询、失败几次后停、成功后怎么恢复。
 * 这里不碰 DOM 和计时器，只维护状态，面板按 `pollDelay` 决定是否挂计时器。
 */

import type { MessageKey } from "./i18n.ts";

/** busy 时的轮询间隔。 */
export const POLL_INTERVAL_MS = 2_000;

/** 连续失败达到这个次数后停止自动轮询，并显示 banner。 */
export const FAILURE_LIMIT = 3;

/** 一次刷新的来源：自动轮询、手动刷新、session 事件。 */
export type RefreshTrigger = "poll" | "manual" | "event";

/** host 的 session 生命周期阶段。 */
export type SessionPhase = "started" | "completed" | "failure";

export interface RefreshState {
  sessionID: string | null;
  busy: boolean;
  visible: boolean;
  /** 连续自动轮询失败次数。 */
  failures: number;
  /** 手动刷新失败，等待下一次成功。 */
  manualFailure: boolean;
}

export interface RefreshBanner {
  tone: "warning";
  titleKey: MessageKey;
  bodyKey: MessageKey;
}

export function initialRefreshState(visible = true): RefreshState {
  return {
    sessionID: null,
    busy: false,
    visible,
    failures: 0,
    manualFailure: false,
  };
}

/** 切换 session 会清空失败计数；同一 session 的 busy 变化只更新 busy。 */
export function sessionChanged(
  state: RefreshState,
  sessionID: string | null,
  busy: boolean,
): RefreshState {
  if (sessionID === state.sessionID) return busyChanged(state, busy);
  return {
    ...state,
    sessionID,
    busy,
    failures: 0,
    manualFailure: false,
  };
}

export function busyChanged(state: RefreshState, busy: boolean): RefreshState {
  if (state.busy === busy) return state;
  return { ...state, busy };
}

/** `started` 是 busy/retry，`completed` 是 idle；`failure` 只表示状态未知，不改写 busy。 */
export function sessionPhaseChanged(
  state: RefreshState,
  sessionID: string,
  phase: SessionPhase,
): RefreshState {
  if (sessionID !== state.sessionID) return state;
  if (phase === "started") return busyChanged(state, true);
  if (phase === "completed") return busyChanged(state, false);
  return state;
}

export function visibilityChanged(state: RefreshState, visible: boolean): RefreshState {
  if (state.visible === visible) return state;
  return { ...state, visible };
}

/** 任何一次成功刷新都证明链路恢复，清空失败计数与手动失败提示。 */
export function refreshSucceeded(state: RefreshState): RefreshState {
  if (state.failures === 0 && !state.manualFailure) return state;
  return { ...state, failures: 0, manualFailure: false };
}

/**
 * 自动轮询失败才计入连续失败；手动刷新失败立即提示但不影响轮询计数；
 * session 事件触发的那一次刷新失败保持静默，交给后续轮询判断。
 */
export function refreshFailed(state: RefreshState, trigger: RefreshTrigger): RefreshState {
  if (trigger === "event") return state;
  if (trigger === "manual") {
    return state.manualFailure ? state : { ...state, manualFailure: true };
  }
  if (state.failures >= FAILURE_LIMIT) return state;
  return { ...state, failures: state.failures + 1 };
}

export function pollingHalted(state: RefreshState): boolean {
  return state.failures >= FAILURE_LIMIT;
}

export function shouldPoll(state: RefreshState): boolean {
  return state.visible
    && state.sessionID !== null
    && state.busy
    && !pollingHalted(state);
}

/** 返回下一次轮询的延迟；`null` 表示不该挂计时器。 */
export function pollDelay(state: RefreshState): number | null {
  return shouldPoll(state) ? POLL_INTERVAL_MS : null;
}

export function refreshBanner(state: RefreshState): RefreshBanner | null {
  if (pollingHalted(state)) {
    return {
      tone: "warning",
      titleKey: "refreshHaltedTitle",
      bodyKey: "refreshHaltedBody",
    };
  }
  if (state.manualFailure) {
    return {
      tone: "warning",
      titleKey: "refreshFailedTitle",
      bodyKey: "refreshFailedBody",
    };
  }
  return null;
}
