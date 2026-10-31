import type { SessionSnapshot } from "@openchamber/sdk";

import type { PanelModel } from "./model.ts";
import type { RefreshController } from "./refresh.ts";

export interface SessionWiring {
  model: Pick<PanelModel, "setSession">;
  controller: Pick<RefreshController, "setSession" | "refresh">;
}

/**
 * 把 host 的 session 快照同步给模型和刷新控制器。只有 session 真正变化时
 * 才请求事件刷新；同一 session 的忙碌变化只更新状态并重新对账轮询。
 */
export function applySessionSnapshot(
  wiring: SessionWiring,
  previous: string | null,
  next: SessionSnapshot | null,
): string | null {
  const nextID = next?.id ?? null;
  const busy = next?.busy ?? false;

  wiring.model.setSession(nextID, busy);
  wiring.controller.setSession(nextID, busy);
  if (nextID !== previous && nextID !== null) wiring.controller.refresh("event");
  return nextID;
}
