import { describe, expect, test } from "bun:test";

import {
  FAILURE_LIMIT,
  POLL_INTERVAL_MS,
  initialRefreshState,
  pollDelay,
  pollingHalted,
  refreshBanner,
  refreshFailed,
  refreshSucceeded,
  sessionChanged,
  sessionPhaseChanged,
  shouldPoll,
  visibilityChanged,
  type RefreshState,
} from "../src/panel/refresh.ts";

function busySession(sessionID = "session-a"): RefreshState {
  return sessionChanged(initialRefreshState(), sessionID, true);
}

describe("轮询开关", () => {
  test("没有 session 或 session 不 busy 时不轮询", () => {
    const idle = sessionChanged(initialRefreshState(), "session-a", false);
    expect(shouldPoll(initialRefreshState())).toBe(false);
    expect(pollDelay(initialRefreshState())).toBeNull();
    expect(shouldPoll(idle)).toBe(false);
    expect(pollDelay(idle)).toBeNull();
  });

  test("busy 开始后每 2 秒轮询，转入 idle 立即停止", () => {
    const busy = busySession();
    expect(shouldPoll(busy)).toBe(true);
    expect(pollDelay(busy)).toBe(POLL_INTERVAL_MS);
    expect(POLL_INTERVAL_MS).toBe(2_000);

    const idle = sessionChanged(busy, "session-a", false);
    expect(shouldPoll(idle)).toBe(false);
    expect(pollDelay(idle)).toBeNull();
  });

  test("面板不可见时暂停，恢复可见后继续", () => {
    const busy = busySession();
    const hidden = visibilityChanged(busy, false);
    expect(shouldPoll(hidden)).toBe(false);
    expect(pollDelay(hidden)).toBeNull();

    const visible = visibilityChanged(hidden, true);
    expect(shouldPoll(visible)).toBe(true);
    expect(pollDelay(visible)).toBe(POLL_INTERVAL_MS);
  });
});

describe("失败计数", () => {
  test("单次轮询失败静默保留轮询，不显示 banner", () => {
    const state = refreshFailed(busySession(), "poll");
    expect(state.failures).toBe(1);
    expect(pollingHalted(state)).toBe(false);
    expect(shouldPoll(state)).toBe(true);
    expect(refreshBanner(state)).toBeNull();
  });

  test("连续 3 次轮询失败后停止轮询并显示 banner", () => {
    let state = busySession();
    for (let attempt = 0; attempt < FAILURE_LIMIT; attempt += 1) {
      state = refreshFailed(state, "poll");
    }

    expect(FAILURE_LIMIT).toBe(3);
    expect(state.failures).toBe(3);
    expect(pollingHalted(state)).toBe(true);
    expect(shouldPoll(state)).toBe(false);
    expect(pollDelay(state)).toBeNull();
    expect(refreshBanner(state)).toMatchObject({
      tone: "warning",
      title: "自动刷新已暂停",
    });
  });

  test("失败后再成功会清零计数，恢复轮询", () => {
    let state = busySession();
    state = refreshFailed(state, "poll");
    state = refreshFailed(state, "poll");
    expect(shouldPoll(state)).toBe(true);

    state = refreshSucceeded(state);
    expect(state.failures).toBe(0);
    expect(shouldPoll(state)).toBe(true);
    expect(refreshBanner(state)).toBeNull();
  });

  test("停止轮询后手动刷新成功可恢复", () => {
    let state = busySession();
    for (let attempt = 0; attempt < FAILURE_LIMIT; attempt += 1) {
      state = refreshFailed(state, "poll");
    }
    expect(shouldPoll(state)).toBe(false);

    state = refreshSucceeded(state);
    expect(state.failures).toBe(0);
    expect(shouldPoll(state)).toBe(true);
    expect(pollDelay(state)).toBe(POLL_INTERVAL_MS);
    expect(refreshBanner(state)).toBeNull();
  });

  test("手动刷新失败立即显示 banner，但不增加轮询失败计数", () => {
    const state = refreshFailed(busySession(), "manual");
    expect(state.failures).toBe(0);
    expect(state.manualFailure).toBe(true);
    expect(shouldPoll(state)).toBe(true);
    expect(refreshBanner(state)).toMatchObject({
      title: "刷新失败",
      body: "显示的是上次采集的快照。点「刷新」重试。",
    });

    const recovered = refreshSucceeded(state);
    expect(recovered.manualFailure).toBe(false);
    expect(refreshBanner(recovered)).toBeNull();
  });

  test("session 事件触发的刷新失败不计入轮询失败", () => {
    const state = refreshFailed(busySession(), "event");
    expect(state.failures).toBe(0);
    expect(state.manualFailure).toBe(false);
    expect(refreshBanner(state)).toBeNull();
  });
});

describe("session 跟随", () => {
  test("切换 session 重置失败计数与手动失败提示", () => {
    let state = busySession("session-a");
    state = refreshFailed(state, "poll");
    state = refreshFailed(state, "poll");
    state = refreshFailed(state, "poll");
    state = refreshFailed(state, "manual");
    expect(pollingHalted(state)).toBe(true);
    expect(refreshBanner(state)).not.toBeNull();

    const switched = sessionChanged(state, "session-b", true);
    expect(switched.sessionID).toBe("session-b");
    expect(switched.failures).toBe(0);
    expect(switched.manualFailure).toBe(false);
    expect(shouldPoll(switched)).toBe(true);
    expect(refreshBanner(switched)).toBeNull();
  });

  test("切到 idle session 后不轮询，切到 busy session 后恢复", () => {
    const state = busySession("session-a");
    const idle = sessionChanged(state, "session-b", false);
    expect(shouldPoll(idle)).toBe(false);

    const busy = sessionChanged(idle, "session-c", true);
    expect(shouldPoll(busy)).toBe(true);
  });

  test("同一个 session 的 busy 变化只更新 busy", () => {
    let state = busySession("session-a");
    state = refreshFailed(state, "poll");
    const idle = sessionChanged(state, "session-a", false);
    expect(idle.failures).toBe(1);
    expect(idle.busy).toBe(false);
    expect(shouldPoll(idle)).toBe(false);

    const busyAgain = sessionChanged(idle, "session-a", true);
    expect(busyAgain.failures).toBe(1);
    expect(shouldPoll(busyAgain)).toBe(true);
  });

  test("started 视为 busy，completed 停止轮询，failure 不改写 busy", () => {
    const idle = sessionChanged(initialRefreshState(), "session-a", false);

    const started = sessionPhaseChanged(idle, "session-a", "started");
    expect(started.busy).toBe(true);
    expect(shouldPoll(started)).toBe(true);

    const completed = sessionPhaseChanged(started, "session-a", "completed");
    expect(completed.busy).toBe(false);
    expect(shouldPoll(completed)).toBe(false);

    const failedWhileBusy = sessionPhaseChanged(started, "session-a", "failure");
    expect(failedWhileBusy.busy).toBe(true);
    expect(shouldPoll(failedWhileBusy)).toBe(true);

    const failedWhileIdle = sessionPhaseChanged(idle, "session-a", "failure");
    expect(failedWhileIdle.busy).toBe(false);
    expect(shouldPoll(failedWhileIdle)).toBe(false);
  });

  test("其他 session 的生命周期事件不影响当前状态", () => {
    const state = busySession("session-a");
    const untouched = sessionPhaseChanged(state, "session-b", "completed");
    expect(untouched).toBe(state);
  });

  test("关闭 session 后清空 session 并停止轮询", () => {
    const state = busySession("session-a");
    const closed = sessionChanged(state, null, false);
    expect(closed.sessionID).toBeNull();
    expect(closed.failures).toBe(0);
    expect(shouldPoll(closed)).toBe(false);
  });
});
