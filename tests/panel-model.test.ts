import { describe, expect, test } from "bun:test";

import { COLLECTOR_VERSION } from "../src/shared/version.ts";
import {
  COLLECTOR_INSTALL_PATH,
  createPanelModel,
  type PanelBody,
  type PanelView,
} from "../src/panel/model.ts";
import type { RefreshView } from "../src/panel/refresh.ts";
import {
  CATEGORIES,
  type CategoryUsage,
  type SnapshotSummary,
} from "../src/shared/types.ts";

function categories(): CategoryUsage[] {
  return CATEGORIES.map((category, index) => ({
    category,
    items: index === 0 ? 1 : 0,
    chars: index === 0 ? 400 : 0,
    tokens: index === 0 ? 100 : 0,
  }));
}

function summary(overrides: Partial<SnapshotSummary> = {}): SnapshotSummary {
  return {
    sessionID: "ses_one",
    model: "anthropic/claude-sonnet-4-5",
    used: 12_000,
    window: 200_000,
    windowAssumed: false,
    estimated: false,
    baseline: false,
    restored: false,
    collectedAt: "2026-10-31T10:00:00.000Z",
    categories: categories(),
    items: [{ id: "system:0@1", title: "System", chars: 400, head: "S".repeat(200) }],
    ...overrides,
  };
}

const connected = {
  connected: true,
  version: "1.2.3",
} as const;

function placeholder(view: PanelView): Extract<PanelBody, { kind: "placeholder" }> {
  if (view.body.kind !== "placeholder") throw new Error("expected a placeholder body");
  return view.body;
}

function readyModel() {
  const model = createPanelModel();
  model.setBooted(true);
  model.setSession("ses_one", false);
  return model;
}

describe("PanelModel 内容优先级", () => {
  test("未 booted 时显示 checking 和 connecting 占位", () => {
    const view = createPanelModel().getView();
    expect(view.status).toEqual({ kind: "checking" });
    expect(placeholder(view)).toEqual({
      kind: "placeholder",
      titleKey: "connectingTitle",
      detailKey: "connectingDetail",
      retry: false,
    });
  });

  test("booted 后没有 session 时显示 no session", () => {
    const model = createPanelModel();
    model.setBooted(true);
    const view = model.getView();
    expect(view.status).toEqual({ kind: "checking" });
    expect(placeholder(view)).toMatchObject({
      titleKey: "noSessionTitle",
      detailKey: "noSessionDetail",
      retry: true,
    });
  });

  test("booted 且有 session、还没有 summary 时显示 waiting", () => {
    const view = readyModel().getView();
    expect(placeholder(view)).toMatchObject({
      titleKey: "waitingForFirstRequestTitle",
      detailKey: "waitingForFirstRequestDetail",
      retry: true,
    });
  });

  test("宿主错误优先于连接状态，即使 Collector 已连接", () => {
    const model = readyModel();
    model.setConnection(connected);
    model.setHostProblem({ titleKey: "hostNoServiceTitle", detailKey: "hostNoServiceDetail" });
    const view = model.getView();
    expect(view.status).toEqual({
      kind: "failed",
      titleKey: "hostNoServiceTitle",
      detailKey: "hostNoServiceDetail",
    });
    expect(placeholder(view)).toMatchObject({
      titleKey: "hostNoServiceTitle",
      detailKey: "hostNoServiceDetail",
      retry: true,
    });
  });

  test("已有内容时非阻断宿主错误只改变状态条，保留 summary", () => {
    const model = readyModel();
    model.setConnection(connected);
    model.setSummary(summary());
    model.setHostProblem(
      { titleKey: "hostUnavailableTitle", detailKey: "hostUnavailableDetail" },
      { keepContent: true },
    );
    const view = model.getView();
    expect(view.status.kind).toBe("failed");
    expect(view.hostProblem).toBeNull();
    expect(view.body.kind).toBe("summary");
  });

  test("Collector unreachable 显示 unreachable 占位", () => {
    const model = readyModel();
    model.setConnection({ connected: false, reason: "unreachable" });
    const view = model.getView();
    expect(view.status).toEqual({ kind: "disconnected", reason: "unreachable" });
    expect(placeholder(view)).toMatchObject({
      titleKey: "collectorUnreachableTitle",
      detailKey: "collectorUnreachableDetail",
      retry: true,
    });
  });

  test("Collector 未运行显示安装路径参数", () => {
    const model = readyModel();
    model.setConnection({ connected: false, reason: "not_found" });
    const view = model.getView();
    expect(view.status).toEqual({ kind: "disconnected", reason: "not_found" });
    expect(placeholder(view)).toMatchObject({
      titleKey: "collectorNotRunning",
      detailKey: "collectorNotRunningDetail",
      args: { path: COLLECTOR_INSTALL_PATH },
      retry: true,
    });
  });

  test("summary timeout 与 other 各自显示对应文案", () => {
    for (const [problem, titleKey, detailKey] of [
      ["timeout", "summaryTimeoutTitle", "summaryTimeoutDetail"],
      ["other", "summaryUnavailableTitle", "summaryUnavailableDetail"],
    ] as const) {
      const model = readyModel();
      model.setConnection(connected);
      model.setSummaryProblem(problem);
      expect(placeholder(model.getView())).toMatchObject({
        titleKey,
        detailKey,
        retry: true,
      });
    }
  });

  test("summary 的 sessionID 与当前 session 不一致时显示 waiting", () => {
    const model = readyModel();
    model.setConnection(connected);
    model.setSummary(summary({ sessionID: "ses_other" }));
    expect(placeholder(model.getView())).toMatchObject({
      titleKey: "waitingForFirstRequestTitle",
      detailKey: "waitingForFirstRequestDetail",
    });
  });

  test("匹配的 summary 成为 body", () => {
    const model = readyModel();
    model.setConnection(connected);
    const next = summary();
    model.setSummary(next);
    const view = model.getView();
    expect(view.body).toEqual({ kind: "summary", summary: next });
  });
});

describe("PanelModel 状态", () => {
  test("connected 状态带版本、outdated 和期望版本", () => {
    const model = readyModel();
    model.setConnection({
      connected: true,
      version: "1.2.3",
      outdated: true,
      expectedVersion: "2.0.0",
    });
    expect(model.getView().status).toEqual({
      kind: "connected",
      version: "1.2.3",
      outdated: true,
      expectedVersion: "2.0.0",
    });
  });

  test("outdated 但没有 expectedVersion 时回退到当前扩展版本", () => {
    const model = readyModel();
    model.setConnection({ connected: true, version: "1.2.3", outdated: true });
    expect(model.getView().status).toEqual({
      kind: "connected",
      version: "1.2.3",
      outdated: true,
      expectedVersion: COLLECTOR_VERSION,
    });
  });

  test("连接状态变化会更新状态条", () => {
    const model = readyModel();
    model.setConnection(connected);
    expect(model.getView().status.kind).toBe("connected");
    model.setConnection({ connected: false, reason: "unreachable" });
    expect(model.getView().status).toEqual({ kind: "disconnected", reason: "unreachable" });
    model.setConnection(null);
    expect(model.getView().status).toEqual({ kind: "checking" });
  });

  test("setSummary 清除已有的 summary problem", () => {
    const model = readyModel();
    model.setConnection(connected);
    model.setSummaryProblem("timeout");
    model.setSummary(summary());
    expect(model.getView().summaryProblem).toBeNull();
  });

  test("setRefresh 透传控制器视图", () => {
    const model = createPanelModel();
    const refresh: RefreshView = {
      state: {
        sessionID: "ses_one",
        busy: true,
        visible: true,
        failures: 0,
        manualFailure: false,
      },
      inFlight: true,
      manualLoading: false,
      hasLoaded: true,
      banner: null,
    };
    model.setRefresh(refresh);
    expect(model.getView().refresh).toBe(refresh);
  });
});

describe("PanelModel 会话切换", () => {
  test("切换 session 清空 summary 与 summary problem", () => {
    const model = readyModel();
    model.setConnection(connected);
    model.setSummary(summary());
    model.setSummaryProblem("timeout");
    model.setSession("ses_two", true);
    const view = model.getView();
    expect(view.sessionID).toBe("ses_two");
    expect(view.summary).toBeNull();
    expect(view.summaryProblem).toBeNull();
    expect(placeholder(view)).toMatchObject({ titleKey: "waitingForFirstRequestTitle" });
  });

  test("同一 session 只更新 busy，保留 summary", () => {
    const model = readyModel();
    model.setConnection(connected);
    const next = summary();
    model.setSummary(next);
    model.setSession("ses_one", true);
    const view = model.getView();
    expect(view.busy).toBe(true);
    expect(view.summary).toBe(next);
  });
});

describe("PanelModel 订阅", () => {
  test("状态变化通知一次，取消订阅后不再通知", () => {
    const model = createPanelModel();
    let calls = 0;
    const unsubscribe = model.subscribe(() => {
      calls += 1;
    });

    model.setBooted(true);
    expect(calls).toBe(1);
    model.setSession("ses_one", false);
    expect(calls).toBe(2);
    model.setSummary(summary());
    expect(calls).toBe(3);

    unsubscribe();
    model.setSummary(null);
    expect(calls).toBe(3);
  });

  test("相同值不重复通知", () => {
    const model = createPanelModel();
    let calls = 0;
    model.subscribe(() => {
      calls += 1;
    });
    model.setBooted(true);
    model.setBooted(true);
    expect(calls).toBe(1);
    model.setSession("ses_one", false);
    model.setSession("ses_one", false);
    expect(calls).toBe(2);
  });
});
