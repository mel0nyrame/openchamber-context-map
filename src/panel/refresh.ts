/**
 * 刷新生命周期：启动、轮询、手动重试、会话切换、可见性、失败停轮和旧响应丢弃。
 * 纯状态函数描述单步转换；`createRefreshController` 把它们和计时器、在途请求、
 * 排队、代次令牌组合起来。模块不碰 DOM；计时器和初始可见性都由外部注入。
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

/** 控制器交给面板 `run` 的上下文；面板每个 await 之后都用它检查结果是否过期。 */
export interface RefreshRunContext {
  sessionID: string;
  trigger: RefreshTrigger;
  /** 首次加载和手动刷新为 false，之后的后台刷新为 true。 */
  quiet: boolean;
  /** 这次刷新是否仍属于当前 session 和代次。 */
  isCurrent(): boolean;
  /** 面板第一次渲染结果前调用；跨 session 保留。 */
  markLoaded(): void;
}

/** 面板渲染所需的完整视图。 */
export interface RefreshView {
  state: RefreshState;
  inFlight: boolean;
  manualLoading: boolean;
  hasLoaded: boolean;
}

export interface RefreshControllerDeps {
  /** 执行一次刷新；返回 true 表示成功，false 或抛错表示失败。 */
  run(context: RefreshRunContext): boolean | Promise<boolean>;
  /** 视图变化时调用，面板只通过它更新刷新相关界面。 */
  onChange(view: RefreshView): void;
  setTimer?(callback: () => void, delay: number): unknown;
  clearTimer?(handle: unknown): void;
  /** 初始可见性；由入口读取宿主文档后注入。 */
  visible: boolean;
}

export interface RefreshController {
  start(): void;
  dispose(): void;
  setSession(sessionID: string | null, busy: boolean): void;
  setLifecycle(sessionID: string, phase: SessionPhase): void;
  setVisible(visible: boolean): void;
  refresh(trigger: RefreshTrigger): void;
  getView(): RefreshView;
}

export function createRefreshController(deps: RefreshControllerDeps): RefreshController {
  const setTimer = deps.setTimer
    ?? ((callback: () => void, delay: number): unknown => setTimeout(callback, delay));
  const clearTimer = deps.clearTimer
    ?? ((handle: unknown): void => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let state = initialRefreshState(deps.visible);
  let started = false;
  let disposed = false;
  let inFlight = false;
  let manualLoading = false;
  let hasLoaded = false;
  /** 每次开始刷新或切换 session 都递增，旧请求凭它判断自己是否过期。 */
  let generation = 0;
  let queued: RefreshTrigger | null = null;
  let timer: unknown = null;

  function snapshot(): RefreshView {
    return { state, inFlight, manualLoading, hasLoaded };
  }

  function notify(): void {
    deps.onChange(snapshot());
  }

  function stopTimer(): void {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  }

  function reconcile(): void {
    const delay = pollDelay(state);
    if (!started || disposed || delay === null) {
      stopTimer();
      return;
    }
    if (inFlight || timer !== null) return;
    timer = setTimer(() => {
      timer = null;
      request("poll");
    }, delay);
  }

  function request(trigger: RefreshTrigger): void {
    if (!started || disposed || state.sessionID === null) return;
    if (trigger === "manual" && manualLoading) return;
    if (inFlight) {
      if (trigger === "manual" || queued === null) queued = trigger;
      return;
    }
    void startRun(trigger);
  }

  async function startRun(trigger: RefreshTrigger): Promise<void> {
    if (!started || disposed || state.sessionID === null || inFlight) return;
    const sessionID = state.sessionID;
    const token = generation + 1;
    generation = token;
    const quiet = trigger !== "manual" && hasLoaded;

    stopTimer();
    inFlight = true;
    if (trigger === "manual") manualLoading = true;
    notify();

    let ok = false;
    try {
      ok = await deps.run({
        sessionID,
        trigger,
        quiet,
        isCurrent: () => !disposed && token === generation,
        markLoaded: () => {
          if (disposed || hasLoaded) return;
          hasLoaded = true;
          notify();
        },
      });
    } catch {
      ok = false;
    }

    if (disposed || token !== generation) return;

    inFlight = false;
    if (trigger === "manual") manualLoading = false;
    state = ok ? refreshSucceeded(state) : refreshFailed(state, trigger);
    notify();

    const next = queued;
    queued = null;
    if (next !== null && !(next === "poll" && pollDelay(state) === null)) {
      void startRun(next);
      return;
    }
    reconcile();
  }

  function setSession(sessionID: string | null, busy: boolean): void {
    if (disposed) return;
    if (sessionID !== state.sessionID) {
      generation += 1;
      inFlight = false;
      manualLoading = false;
      queued = null;
      stopTimer();
      state = sessionChanged(state, sessionID, busy);
      notify();
      reconcile();
      return;
    }
    const next = busyChanged(state, busy);
    if (next !== state) {
      state = next;
      notify();
    }
    reconcile();
  }

  function setLifecycle(sessionID: string, phase: SessionPhase): void {
    if (disposed || sessionID !== state.sessionID) return;
    const next = sessionPhaseChanged(state, sessionID, phase);
    if (next !== state) {
      state = next;
      notify();
    }
    if (started) request("event");
    reconcile();
  }

  function setVisible(visible: boolean): void {
    if (disposed) return;
    const next = visibilityChanged(state, visible);
    if (next === state) return;
    state = next;
    notify();
    reconcile();
  }

  function start(): void {
    if (disposed || started) return;
    started = true;
    request("event");
    reconcile();
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    generation += 1;
    inFlight = false;
    manualLoading = false;
    queued = null;
    stopTimer();
    notify();
  }

  return {
    start,
    dispose,
    setSession,
    setLifecycle,
    setVisible,
    refresh: request,
    getView: snapshot,
  };
}
