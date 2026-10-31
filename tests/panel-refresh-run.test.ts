import { describe, expect, test } from "bun:test";

import { createPanelModel } from "../src/panel/model.ts";
import { createRefreshController, type RefreshView } from "../src/panel/refresh.ts";
import { createRefreshRun } from "../src/panel/refresh-run.ts";

/** 跑完控制器和刷新流程里排队的微任务；不用真实计时器。 */
async function flush(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

describe("刷新流程", () => {
  test("503 表示 Collector 不可用，按成功处理且不累计失败、不停止轮询", async () => {
    const model = createPanelModel();
    model.setBooted(true);
    model.setSession("ses_one", true);
    model.setConnection({ connected: true, version: "1.2.3" });

    const run = createRefreshRun({
      model,
      request: async ({ path }) =>
        path === "/health"
          ? {
            status: 200,
            body: JSON.stringify({ collector: { connected: true, version: "1.2.3" } }),
          }
          : { status: 503, body: "" },
    });

    const timers = new Map<number, { callback: () => void; delay: number }>();
    let timerId = 0;
    const views: RefreshView[] = [];
    const controller = createRefreshController({
      visible: true,
      run,
      onChange: (view) => views.push(view),
      setTimer(callback, delay) {
        timerId += 1;
        timers.set(timerId, { callback, delay });
        return timerId;
      },
      clearTimer(handle) {
        timers.delete(handle as number);
      },
    });

    controller.setSession("ses_one", true);
    controller.start();

    for (let round = 0; round < 3; round += 1) {
      await flush();
      expect(controller.getView().state.failures).toBe(0);
      expect(controller.getView().inFlight).toBe(false);
      expect(timers.size).toBe(1);
      expect([...timers.values()][0]?.delay).toBe(2_000);

      const timer = [...timers.entries()][0];
      if (timer === undefined) throw new Error("expected a scheduled poll");
      timers.delete(timer[0]);
      timer[1].callback();
    }

    await flush();
    expect(controller.getView().state.failures).toBe(0);
    expect(controller.getView().state.manualFailure).toBe(false);
    expect(model.getView().status).toEqual({
      kind: "disconnected",
      versionText: "—",
      reason: "not_found",
      titleKey: "collectorNotRunning",
      detailKey: "collectorNotRunningDetail",
      detailArgs: { path: "~/.config/opencode/plugins/" },
    });
    expect(model.getView().body.kind).toBe("placeholder");
    expect(views.at(-1)?.state.failures).toBe(0);
  });
});
