import { HostRequestError } from "@openchamber/sdk";

import { parseSnapshotSummary } from "../shared/snapshot.ts";
import type { SnapshotSummary } from "../shared/types.ts";
import { COLLECTOR_VERSION } from "../shared/version.ts";
import { describeHostFailure } from "./failure.ts";
import type { PanelModel } from "./model.ts";
import type { RefreshRunContext } from "./refresh.ts";

export interface ServiceResponse {
  status: number;
  body: string;
}

export interface ServiceRequest {
  (request: {
    method: "GET";
    path: string;
    query?: Record<string, string>;
  }): Promise<ServiceResponse>;
}

interface HealthBody {
  collector?: {
    connected?: unknown;
    version?: unknown;
    reason?: unknown;
    outdated?: unknown;
    expectedVersion?: unknown;
  };
}

export interface RefreshRunDeps {
  request: ServiceRequest;
  model: PanelModel;
}

function failureOf(error: unknown) {
  return describeHostFailure(error instanceof HostRequestError ? error.code : null);
}

function parseSummary(body: string): SnapshotSummary | null {
  try {
    return parseSnapshotSummary(JSON.parse(body) as unknown);
  } catch {
    return null;
  }
}

/**
 * 组合 `/health` 与 `/summary` 的一次刷新。返回值只表示请求是否成功；
 * 503 表示 Collector 不可用，请求本身已完成，因此按成功返回，不累计失败。
 */
export function createRefreshRun(
  deps: RefreshRunDeps,
): (context: RefreshRunContext) => Promise<boolean> {
  const { request, model } = deps;

  function noteUnreachable(
    context: RefreshRunContext,
    error: unknown,
    unexpected = false,
  ): void {
    const copy = unexpected
      ? {
        titleKey: "unexpectedServiceTitle" as const,
        detailKey: "unexpectedServiceDetail" as const,
        blocking: false,
      }
      : failureOf(error);

    // 阻断错误由模型清空连接与摘要；非阻断错误只改状态条，已有内容继续保留。
    const blocked = model.setHostProblem(copy);
    if (blocked) context.markLoaded();
  }

  /** 摘要请求失败时只提示一次；已有摘要则静默保留内容。 */
  function noteSummaryProblem(
    context: RefreshRunContext,
    problem: "timeout" | "other",
  ): void {
    if (context.quiet) return;
    model.setSummaryProblem(
      problem === "timeout"
        ? "timeout"
        : model.getView().summary === null
          ? "other"
          : null,
    );
    context.markLoaded();
  }

  return async function refreshOnce(context: RefreshRunContext): Promise<boolean> {
    const quiet = context.quiet;
    let health: ServiceResponse;
    try {
      health = await request({ method: "GET", path: "/health" });
    } catch (error) {
      if (!context.isCurrent()) return true;
      noteUnreachable(context, error);
      return false;
    }
    if (!context.isCurrent()) return true;

    let body: HealthBody | null = null;
    try {
      body = JSON.parse(health.body) as HealthBody;
    } catch {
      body = null;
    }

    if (health.status !== 200 || !body?.collector) {
      noteUnreachable(context, null, true);
      return false;
    }

    const collector = body.collector;
    model.setHostProblem(null);
    if (collector.connected !== true || typeof collector.version !== "string") {
      const reason = collector.reason === "unreachable" ? "unreachable" : "not_found";
      model.setConnection({ connected: false, reason });
      model.setSummary(null);
      context.markLoaded();
      return true;
    }

    const expectedVersion = typeof collector.expectedVersion === "string"
      ? collector.expectedVersion
      : COLLECTOR_VERSION;
    const outdated = collector.outdated === true;
    model.setConnection({
      connected: true,
      version: collector.version,
      outdated,
      expectedVersion: outdated ? expectedVersion : undefined,
    });

    try {
      const result = await request({
        method: "GET",
        path: "/summary",
        query: { sessionID: context.sessionID },
      });
      // 请求期间切走了 session：旧结果直接丢弃，不算失败。
      if (!context.isCurrent()) return true;

      if (result.status === 200) {
        const parsed = parseSummary(result.body);
        if (parsed === null) {
          noteSummaryProblem(context, "other");
          return false;
        }
        model.setSummary(parsed);
      } else if (result.status === 404) {
        model.setSummary(null);
      } else if (result.status === 503) {
        // 503 表示没有可用的 Collector：请求本身完成了，按连接状态处理，
        // 不累计失败次数，也不停止轮询。
        model.setConnection({ connected: false, reason: "not_found" });
        model.setSummary(null);
        context.markLoaded();
        return true;
      } else {
        noteSummaryProblem(context, result.status === 504 ? "timeout" : "other");
        return false;
      }
    } catch {
      if (!context.isCurrent()) return true;
      noteSummaryProblem(context, "other");
      return false;
    }

    context.markLoaded();
    return true;
  };
}
