import { describe, expect, test } from "bun:test";

import {
  POLL_INTERVAL_MS,
  createRefreshController,
  refreshBanner,
  type RefreshRunContext,
  type RefreshView,
} from "../src/panel/refresh.ts";

interface PendingRun {
  context: RefreshRunContext;
  resolve(ok: boolean): void;
  reject(error: unknown): void;
}

interface FakeTimers {
  setTimer(callback: () => void, delay: number): number;
  clearTimer(handle: unknown): void;
  pending(): number[];
  advance(ms: number): void;
}

function createFakeTimers(): FakeTimers {
  let nextID = 1;
  let now = 0;
  const scheduled = new Map<number, { callback: () => void; due: number }>();
  return {
    setTimer(callback, delay) {
      const id = nextID;
      nextID += 1;
      scheduled.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimer(handle) {
      scheduled.delete(handle as number);
    },
    pending() {
      return [...scheduled.values()].map((timer) => timer.due - now);
    },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...scheduled]) {
        if (timer.due > now) continue;
        scheduled.delete(id);
        timer.callback();
      }
    },
  };
}

/** 跑完控制器里排队的微任务；不用 sleep，也不启动真实计时器。 */
async function flush(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
}

function setup(options: { visible?: boolean; auto?: boolean } = {}) {
  const timers = createFakeTimers();
  const calls: RefreshRunContext[] = [];
  const pending: PendingRun[] = [];
  const views: RefreshView[] = [];
  const mode = { auto: options.auto ?? false, ok: true };

  const controller = createRefreshController({
    visible: options.visible ?? true,
    run(context) {
      calls.push(context);
      if (!mode.auto) {
        return new Promise<boolean>((resolve, reject) => {
          pending.push({ context, resolve, reject });
        });
      }
      return mode.ok;
    },
    onChange(view) {
      views.push(view);
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  return { controller, calls, pending, views, timers, mode };
}

type Harness = ReturnType<typeof setup>;

function current(harness: Harness): RefreshView {
  return harness.controller.getView();
}

describe("控制器启动", () => {
  test("start() 只请求一次事件刷新，重复调用不再请求", () => {
    const harness = setup();
    harness.controller.setSession("session-a", true);

    harness.controller.start();
    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0]).toMatchObject({
      sessionID: "session-a",
      trigger: "event",
      quiet: false,
    });

    harness.controller.start();
    expect(harness.calls).toHaveLength(1);
  });

  test("没有 session 时 start() 不请求刷新", () => {
    const harness = setup();
    harness.controller.start();
    expect(harness.calls).toHaveLength(0);
  });

  test("start() 之前的 refresh 被忽略", () => {
    const harness = setup();
    harness.controller.setSession("session-a", true);
    harness.controller.refresh("event");
    harness.controller.refresh("manual");
    expect(harness.calls).toHaveLength(0);
    expect(harness.timers.pending()).toEqual([]);
  });

  test("start() 之前 setVisible / setLifecycle 不调度轮询，start() 之后才按忙碌状态调度", async () => {
    const harness = setup({ auto: true });
    harness.controller.setSession("session-a", true);
    harness.controller.setVisible(true);
    harness.controller.setLifecycle("session-a", "started");
    expect(harness.calls).toHaveLength(0);
    expect(harness.timers.pending()).toEqual([]);

    harness.controller.start();
    await flush();
    expect(harness.calls).toHaveLength(1);
    expect(harness.timers.pending()).toEqual([POLL_INTERVAL_MS]);
  });

  test("getView() 反映初始状态", () => {
    const harness = setup();
    expect(current(harness)).toEqual({
      state: {
        sessionID: null,
        busy: false,
        visible: true,
        failures: 0,
        manualFailure: false,
      },
      inFlight: false,
      manualLoading: false,
      hasLoaded: false,
    });
  });
});

describe("控制器会话", () => {
  test("run 的 context 使用开始刷新时的 session", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", true);
    harness.controller.start();
    expect(harness.calls[0]?.sessionID).toBe("session-a");
    harness.pending[0]?.resolve(true);
    await flush();
  });

  test("切换 session 作废在途请求，面板随后的事件刷新针对新 session", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", true);
    harness.controller.start();
    const stale = harness.pending[0];
    expect(stale).toBeDefined();

    harness.controller.setSession("session-b", false);
    expect(current(harness).inFlight).toBe(false);
    expect(current(harness).state.sessionID).toBe("session-b");

    harness.controller.refresh("event");
    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[1]).toMatchObject({ sessionID: "session-b", trigger: "event" });

    // 旧 session 的迟到结果既不计数也不改变视图。
    stale?.resolve(false);
    await flush();
    expect(current(harness).state.failures).toBe(0);
    expect(current(harness).inFlight).toBe(true);
  });

  test("同一个 session 的 busy 变化只更新忙碌状态并重新对账轮询", async () => {
    const harness = setup({ auto: true });
    harness.controller.setSession("session-a", false);
    harness.controller.start();
    await flush();
    expect(harness.calls).toHaveLength(1);
    expect(harness.timers.pending()).toEqual([]);

    harness.controller.setSession("session-a", true);
    expect(current(harness).state.busy).toBe(true);
    expect(harness.calls).toHaveLength(1);
    expect(harness.timers.pending()).toEqual([POLL_INTERVAL_MS]);

    harness.controller.setSession("session-a", false);
    expect(harness.timers.pending()).toEqual([]);
  });
});

describe("控制器首次加载", () => {
  test("markLoaded() 翻转 hasLoaded 并只通知一次", () => {
    const harness = setup();
    harness.controller.setSession("session-a", true);
    harness.controller.start();
    const context = harness.calls[0];
    expect(current(harness).hasLoaded).toBe(false);

    context?.markLoaded();
    expect(current(harness).hasLoaded).toBe(true);
    const notifications = harness.views.length;

    context?.markLoaded();
    expect(harness.views).toHaveLength(notifications);
  });

  test("首次刷新不静默，加载完成后的后台刷新静默", async () => {
    const harness = setup({ auto: true });
    harness.controller.setSession("session-a", true);
    harness.controller.start();
    expect(harness.calls[0]?.quiet).toBe(false);
    harness.calls[0]?.markLoaded();
    await flush();

    harness.timers.advance(POLL_INTERVAL_MS);
    await flush();
    expect(harness.calls[1]?.trigger).toBe("poll");
    expect(harness.calls[1]?.quiet).toBe(true);
  });

  test("手动刷新永远不静默", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", false);
    harness.controller.start();
    harness.calls[0]?.markLoaded();
    harness.pending[0]?.resolve(true);
    await flush();

    harness.controller.refresh("manual");
    expect(harness.calls[1]).toMatchObject({ trigger: "manual", quiet: false });
    harness.pending[1]?.resolve(true);
    await flush();
  });
});

describe("控制器失败提示", () => {
  test("手动失败显示 banner 但不增加轮询失败计数，成功后清除", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", false);
    harness.controller.start();
    harness.calls[0]?.markLoaded();
    harness.pending[0]?.resolve(true);
    await flush();

    harness.controller.refresh("manual");
    harness.pending[1]?.resolve(false);
    await flush();
    expect(current(harness).state.failures).toBe(0);
    expect(current(harness).state.manualFailure).toBe(true);
    expect(refreshBanner(current(harness).state)).toMatchObject({
      titleKey: "refreshFailedTitle",
      bodyKey: "refreshFailedBody",
    });

    harness.controller.refresh("manual");
    harness.pending[2]?.resolve(true);
    await flush();
    expect(current(harness).state.manualFailure).toBe(false);
    expect(refreshBanner(current(harness).state)).toBeNull();
  });

  test("run 抛错按失败处理", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", false);
    harness.controller.start();
    harness.pending[0]?.resolve(true);
    await flush();

    harness.controller.refresh("manual");
    harness.pending[1]?.reject(new Error("boom"));
    await flush();
    expect(current(harness).state.manualFailure).toBe(true);
  });

  test("事件刷新失败保持安静且不计数", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", false);
    harness.controller.start();
    harness.pending[0]?.resolve(false);
    await flush();
    expect(current(harness).state.failures).toBe(0);
    expect(current(harness).state.manualFailure).toBe(false);
    expect(refreshBanner(current(harness).state)).toBeNull();
  });
});

describe("控制器轮询", () => {
  test("忙碌时每次成功后按 2s 链式轮询，空闲后停止", async () => {
    const harness = setup({ auto: true });
    harness.controller.setSession("session-a", true);
    harness.controller.start();
    await flush();
    expect(harness.calls).toHaveLength(1);
    expect(harness.timers.pending()).toEqual([POLL_INTERVAL_MS]);

    harness.timers.advance(POLL_INTERVAL_MS - 1);
    await flush();
    expect(harness.calls).toHaveLength(1);

    harness.timers.advance(1);
    await flush();
    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[1]?.trigger).toBe("poll");
    expect(harness.timers.pending()).toEqual([POLL_INTERVAL_MS]);

    harness.controller.setSession("session-a", false);
    expect(harness.timers.pending()).toEqual([]);
    harness.timers.advance(POLL_INTERVAL_MS * 2);
    await flush();
    expect(harness.calls).toHaveLength(2);
  });

  test("请求在途时不会启动第二次，完成后才安排下一次轮询", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", true);
    harness.controller.start();
    expect(harness.timers.pending()).toEqual([]);

    harness.controller.refresh("poll");
    harness.controller.refresh("event");
    expect(harness.calls).toHaveLength(1);

    harness.pending[0]?.resolve(true);
    await flush();
    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[1]?.trigger).toBe("poll");
    expect(harness.timers.pending()).toEqual([]);

    harness.pending[1]?.resolve(true);
    await flush();
    expect(harness.timers.pending()).toEqual([POLL_INTERVAL_MS]);
  });

  test("隐藏后停止轮询，恢复可见后重新调度", async () => {
    const harness = setup({ auto: true });
    harness.controller.setSession("session-a", true);
    harness.controller.start();
    await flush();
    expect(harness.timers.pending()).toEqual([POLL_INTERVAL_MS]);

    harness.controller.setVisible(false);
    expect(harness.timers.pending()).toEqual([]);
    harness.timers.advance(POLL_INTERVAL_MS * 3);
    await flush();
    expect(harness.calls).toHaveLength(1);

    harness.controller.setVisible(true);
    expect(harness.timers.pending()).toEqual([POLL_INTERVAL_MS]);
    harness.timers.advance(POLL_INTERVAL_MS);
    await flush();
    expect(harness.calls).toHaveLength(2);
  });

  test("在途请求期间隐藏，完成后不再安排轮询", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", true);
    harness.controller.start();
    harness.controller.setVisible(false);
    expect(harness.timers.pending()).toEqual([]);

    harness.pending[0]?.resolve(true);
    await flush();
    expect(harness.timers.pending()).toEqual([]);

    harness.controller.setVisible(true);
    expect(harness.timers.pending()).toEqual([POLL_INTERVAL_MS]);
  });
});

describe("控制器手动刷新与排队", () => {
  test("手动刷新立即开始，manualLoading 反映在视图里，期间忽略第二次手动", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", false);
    harness.controller.start();
    harness.pending[0]?.resolve(true);
    await flush();

    harness.controller.refresh("manual");
    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[1]?.trigger).toBe("manual");
    expect(current(harness).manualLoading).toBe(true);
    expect(current(harness).inFlight).toBe(true);

    harness.controller.refresh("manual");
    expect(harness.calls).toHaveLength(2);

    harness.pending[1]?.resolve(true);
    await flush();
    expect(current(harness).manualLoading).toBe(false);
    expect(current(harness).inFlight).toBe(false);
  });

  test("在途时排队的手动刷新优先，后续事件触发不会覆盖它", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", false);
    harness.controller.start();

    harness.controller.refresh("manual");
    harness.controller.refresh("event");
    harness.controller.refresh("event");
    expect(harness.calls).toHaveLength(1);

    harness.pending[0]?.resolve(true);
    await flush();
    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[1]?.trigger).toBe("manual");

    harness.pending[1]?.resolve(true);
    await flush();
    expect(harness.calls).toHaveLength(2);
  });

  test("排队的轮询在状态转入空闲后被丢弃", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", true);
    harness.controller.start();
    harness.controller.refresh("poll");

    harness.controller.setSession("session-a", false);
    harness.pending[0]?.resolve(true);
    await flush();

    expect(harness.calls).toHaveLength(1);
    expect(harness.timers.pending()).toEqual([]);
  });
});

describe("控制器失败停轮", () => {
  test("连续 3 次轮询失败后停止并显示 banner，手动成功后恢复轮询", async () => {
    const harness = setup({ auto: true });
    harness.controller.setSession("session-a", true);
    harness.controller.start();
    await flush();
    expect(harness.calls).toHaveLength(1);

    harness.mode.ok = false;
    harness.timers.advance(POLL_INTERVAL_MS);
    await flush();
    expect(current(harness).state.failures).toBe(1);
    expect(harness.timers.pending()).toEqual([POLL_INTERVAL_MS]);

    harness.timers.advance(POLL_INTERVAL_MS);
    await flush();
    expect(current(harness).state.failures).toBe(2);

    harness.timers.advance(POLL_INTERVAL_MS);
    await flush();
    expect(current(harness).state.failures).toBe(3);
    expect(harness.timers.pending()).toEqual([]);
    expect(refreshBanner(current(harness).state)).toMatchObject({
      titleKey: "refreshHaltedTitle",
      bodyKey: "refreshHaltedBody",
    });

    harness.mode.ok = true;
    harness.controller.refresh("manual");
    await flush();
    expect(current(harness).state.failures).toBe(0);
    expect(refreshBanner(current(harness).state)).toBeNull();
    expect(harness.timers.pending()).toEqual([POLL_INTERVAL_MS]);
  });
});

describe("控制器生命周期与销毁", () => {
  test("started / completed / failure 改写忙碌状态并各请求一次事件刷新，其他 session 忽略", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", false);
    harness.controller.start();
    harness.pending[0]?.resolve(true);
    await flush();

    harness.controller.setLifecycle("session-b", "started");
    expect(harness.calls).toHaveLength(1);
    expect(current(harness).state.busy).toBe(false);

    harness.controller.setLifecycle("session-a", "started");
    expect(current(harness).state.busy).toBe(true);
    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[1]?.trigger).toBe("event");
    harness.pending[1]?.resolve(true);
    await flush();

    harness.controller.setLifecycle("session-a", "failure");
    expect(current(harness).state.busy).toBe(true);
    expect(harness.calls).toHaveLength(3);
    harness.pending[2]?.resolve(true);
    await flush();

    harness.controller.setLifecycle("session-a", "completed");
    expect(current(harness).state.busy).toBe(false);
    expect(harness.calls).toHaveLength(4);
    harness.pending[3]?.resolve(true);
    await flush();
    expect(harness.timers.pending()).toEqual([]);
  });

  test("切换 session 重置失败计数和手动失败，但保留 hasLoaded", async () => {
    const harness = setup({ auto: true });
    harness.mode.ok = false;
    harness.controller.setSession("session-a", false);
    harness.controller.start();
    harness.calls[0]?.markLoaded();
    await flush();

    harness.controller.refresh("manual");
    await flush();
    expect(current(harness).state.manualFailure).toBe(true);

    harness.controller.setSession("session-b", true);
    expect(current(harness).state).toMatchObject({
      sessionID: "session-b",
      failures: 0,
      manualFailure: false,
    });
    expect(current(harness).hasLoaded).toBe(true);

    harness.mode.ok = true;
    harness.controller.refresh("event");
    expect(harness.calls.at(-1)).toMatchObject({ sessionID: "session-b", quiet: true });
    await flush();
  });

  test("dispose() 清掉计时器并忽略之后完成的结果", async () => {
    const harness = setup();
    harness.controller.setSession("session-a", true);
    harness.controller.start();
    expect(harness.timers.pending()).toEqual([]);

    harness.controller.dispose();
    expect(current(harness).inFlight).toBe(false);

    harness.pending[0]?.resolve(true);
    await flush();
    expect(harness.timers.pending()).toEqual([]);
    expect(current(harness).state.failures).toBe(0);

    harness.controller.refresh("event");
    harness.controller.setSession("session-b", true);
    expect(harness.calls).toHaveLength(1);
  });
});
