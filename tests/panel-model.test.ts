import { describe, expect, test } from "bun:test";

import { COLLECTOR_VERSION } from "../src/shared/version.ts";
import { describeHostFailure } from "../src/panel/failure.ts";
import {
  COLLECTOR_INSTALL_PATH,
  createPanelModel,
  type PanelBody,
  type PanelView,
} from "../src/panel/model.ts";
import type { RefreshView } from "../src/panel/refresh.ts";
import { connected, summary } from "./fixtures.ts";

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
    expect(view.status).toEqual({
      kind: "checking",
      versionText: "…",
      titleKey: "statusCheckingTitle",
      detailKey: "statusCheckingDetail",
    });
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
    expect(view.status).toEqual({
      kind: "checking",
      versionText: "…",
      titleKey: "statusCheckingTitle",
      detailKey: "statusCheckingDetail",
    });
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
    model.setHostProblem({
      titleKey: "hostNoServiceTitle",
      detailKey: "hostNoServiceDetail",
      blocking: true,
    });
    const view = model.getView();
    expect(view.status).toEqual({
      kind: "failed",
      versionText: "—",
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
    const next = summary();
    model.setSummary(next);
    expect(model.setHostProblem({
      titleKey: "hostUnavailableTitle",
      detailKey: "hostUnavailableDetail",
      blocking: false,
    })).toBe(false);
    const view = model.getView();
    expect(view.status.kind).toBe("failed");
    expect(view.body).toEqual({ kind: "summary", summary: next });
  });

  test("没有内容可保留时非阻断宿主错误也阻断正文", () => {
    const model = readyModel();
    expect(model.setHostProblem({
      titleKey: "hostUnavailableTitle",
      detailKey: "hostUnavailableDetail",
      blocking: false,
    })).toBe(true);
    const view = model.getView();
    expect(view.status.kind).toBe("failed");
    expect(placeholder(view)).toMatchObject({
      titleKey: "hostUnavailableTitle",
      detailKey: "hostUnavailableDetail",
      retry: true,
    });
  });

  test("阻断宿主错误清空已有连接与摘要", () => {
    const model = readyModel();
    model.setConnection(connected);
    model.setSummary(summary());
    expect(model.setHostProblem({
      titleKey: "hostNoServiceTitle",
      detailKey: "hostNoServiceDetail",
      blocking: true,
    })).toBe(true);
    const view = model.getView();
    expect(view.status.kind).toBe("failed");
    expect(view.summary).toBeNull();
    expect(placeholder(view)).toMatchObject({
      titleKey: "hostNoServiceTitle",
      detailKey: "hostNoServiceDetail",
      retry: true,
    });

    model.setHostProblem(null);
    expect(model.getView().status).toEqual({
      kind: "checking",
      versionText: "…",
      titleKey: "statusCheckingTitle",
      detailKey: "statusCheckingDetail",
    });
  });

  test("Collector unreachable 显示 unreachable 占位", () => {
    const model = readyModel();
    model.setConnection({ connected: false, reason: "unreachable" });
    const view = model.getView();
    expect(view.status).toEqual({
      kind: "disconnected",
      versionText: "—",
      reason: "unreachable",
      titleKey: "collectorUnreachableTitle",
      detailKey: "collectorUnreachableDetail",
    });
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
    expect(view.status).toEqual({
      kind: "disconnected",
      versionText: "—",
      reason: "not_found",
      titleKey: "collectorNotRunning",
      detailKey: "collectorNotRunningDetail",
      detailArgs: { path: COLLECTOR_INSTALL_PATH },
    });
    expect(placeholder(view)).toMatchObject({
      titleKey: "collectorNotRunning",
      detailKey: "collectorNotRunningDetail",
      detailArgs: { path: COLLECTOR_INSTALL_PATH },
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
  test("connected 状态带格式化版本、outdated 和期望版本", () => {
    const model = readyModel();
    model.setConnection({
      connected: true,
      version: "1.2.3",
      outdated: true,
      expectedVersion: "2.0.0",
    });
    expect(model.getView().status).toEqual({
      kind: "connected",
      versionText: "v1.2.3",
      outdated: true,
      expectedText: "v2.0.0",
      titleKey: "statusConnectedTitle",
      titleArgs: { version: "v1.2.3" },
      detailKey: "statusOutdatedDetail",
      detailArgs: { expected: "v2.0.0" },
    });
  });

  test("outdated 的期望版本和文案参数来自模型", () => {
    const model = readyModel();
    model.setConnection({
      connected: true,
      version: "1.2.3",
      outdated: true,
      expectedVersion: "9.9.9",
    });
    expect(model.getView().status).toEqual({
      kind: "connected",
      versionText: "v1.2.3",
      outdated: true,
      expectedText: "v9.9.9",
      titleKey: "statusConnectedTitle",
      titleArgs: { version: "v1.2.3" },
      detailKey: "statusOutdatedDetail",
      detailArgs: { expected: "v9.9.9" },
    });
  });

  test("outdated 但没有 expectedVersion 时回退到当前扩展版本", () => {
    const model = readyModel();
    model.setConnection({ connected: true, version: "1.2.3", outdated: true });
    expect(model.getView().status).toEqual({
      kind: "connected",
      versionText: "v1.2.3",
      outdated: true,
      expectedText: `v${COLLECTOR_VERSION}`,
      titleKey: "statusConnectedTitle",
      titleArgs: { version: "v1.2.3" },
      detailKey: "statusOutdatedDetail",
      detailArgs: { expected: `v${COLLECTOR_VERSION}` },
    });
  });

  test("状态条与占位区对 Collector 故障共用同一套文案", () => {
    for (const reason of ["not_found", "unreachable"] as const) {
      const model = readyModel();
      model.setConnection({ connected: false, reason });
      const view = model.getView();
      if (view.status.kind !== "disconnected") throw new Error("expected disconnected");
      const body = placeholder(view);
      expect({
        titleKey: view.status.titleKey,
        titleArgs: view.status.titleArgs,
        detailKey: view.status.detailKey,
        detailArgs: view.status.detailArgs,
      }).toEqual({
        titleKey: body.titleKey,
        titleArgs: body.titleArgs,
        detailKey: body.detailKey,
        detailArgs: body.detailArgs,
      });
    }
  });

  test("failed 状态使用宿主 copy", () => {
    const model = readyModel();
    model.setHostProblem(describeHostFailure("DISABLED"));
    const view = model.getView();
    expect(view.status).toEqual({
      kind: "failed",
      versionText: "—",
      titleKey: "hostDisabledTitle",
      detailKey: "hostDisabledDetail",
    });
    expect(placeholder(view)).toMatchObject({
      titleKey: "hostDisabledTitle",
      detailKey: "hostDisabledDetail",
      retry: true,
    });
  });

  test("连接状态变化会更新状态条", () => {
    const model = readyModel();
    model.setConnection(connected);
    expect(model.getView().status.kind).toBe("connected");
    model.setConnection({ connected: false, reason: "unreachable" });
    expect(model.getView().status).toEqual({
      kind: "disconnected",
      versionText: "—",
      reason: "unreachable",
      titleKey: "collectorUnreachableTitle",
      detailKey: "collectorUnreachableDetail",
    });
    model.setConnection(null);
    expect(model.getView().status).toEqual({
      kind: "checking",
      versionText: "…",
      titleKey: "statusCheckingTitle",
      detailKey: "statusCheckingDetail",
    });
  });

  test("setSummary 清除已有的 summary problem", () => {
    const model = readyModel();
    model.setConnection(connected);
    model.setSummaryProblem("timeout");
    const next = summary();
    model.setSummary(next);
    expect(model.getView().body).toEqual({ kind: "summary", summary: next });
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
    };
    model.setRefresh(refresh);
    expect(model.getView().refresh).toBe(refresh);
  });

  test("公开视图只暴露渲染所需字段", () => {
    const view = readyModel().getView();
    expect(Object.keys(view).sort()).toEqual([
      "body",
      "breakdown",
      "focus",
      "items",
      "layer",
      "layout",
      "notice",
      "preview",
      "refresh",
      "selectedCategory",
      "sessionID",
      "status",
      "summary",
      "zoom",
    ]);
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
    expect(placeholder(view)).toMatchObject({ titleKey: "waitingForFirstRequestTitle" });
  });

  test("同一 session 只更新 busy，保留 summary", () => {
    const model = readyModel();
    model.setConnection(connected);
    const next = summary();
    model.setSummary(next);
    model.setSession("ses_one", true);
    const view = model.getView();
    expect(view.sessionID).toBe("ses_one");
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
