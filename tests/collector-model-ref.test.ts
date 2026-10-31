import { expect, test } from "bun:test";

import { BaselineStore, baselineKey } from "../src/collector/baseline.ts";
import { WindowResolver } from "../src/collector/enrich.ts";
import type { PluginContext, SessionContext } from "../src/collector/opencode.ts";
import { buildDraft } from "../src/collector/snapshot.ts";

// OpenCode 2.2 的 Model.Ref 是 { id, providerID, variant }，没有 modelID。
const realRef = { id: "claude-sonnet-4-5", providerID: "anthropic" };

function requestContext(): SessionContext {
  return {
    sessionID: "ses_model_ref",
    agent: "build",
    model: realRef as unknown as SessionContext["model"],
    system: [{ type: "text", text: "you are helpful" }],
  };
}

test("Model.Ref 用 id 时模型标签仍能显示模型名", () => {
  const draft = buildDraft(requestContext(), "2026-10-30T00:00:00.000Z");
  expect(draft.model).toBe("anthropic/claude-sonnet-4-5");
  expect(draft.modelRef.modelID).toBe("claude-sonnet-4-5");
});

test("Model.Ref 用 id 时窗口取自 model.list，而不是假定 200k", async () => {
  const context = {
    model: {
      list: async () => ({
        data: [
          {
            id: "claude-sonnet-4-5",
            modelID: "claude-sonnet-4-5",
            providerID: "anthropic",
            name: "Claude Sonnet 4.5",
            limit: { context: 1_000_000 },
          },
        ],
      }),
    },
  } as unknown as PluginContext;

  const resolver = new WindowResolver(context);
  const result = await resolver.resolve(realRef as unknown as Parameters<WindowResolver["resolve"]>[0]);
  expect(result).toEqual({ window: 1_000_000, assumed: false });
});

test("session.get 返回的 id 形状能命中基线模板", () => {
  const store = new BaselineStore();
  store.remember("build", buildDraft(requestContext(), "2026-10-30T00:00:00.000Z"));
  expect(baselineKey("build", realRef as never)).toBe("build\u0000anthropic/claude-sonnet-4-5");
  expect(store.get("build", realRef as never)).toBeDefined();
});
