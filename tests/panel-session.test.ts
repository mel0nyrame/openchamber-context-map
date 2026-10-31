import { describe, expect, test } from "bun:test";
import type { SessionSnapshot } from "@openchamber/sdk";

import { applySessionSnapshot, type SessionWiring } from "../src/panel/session.ts";

function session(id: string, busy = false): SessionSnapshot {
  return { id, title: id, busy };
}

function setup(): { calls: string[]; wiring: SessionWiring } {
  const calls: string[] = [];
  return {
    calls,
    wiring: {
      model: {
        setSession(sessionID, busy) {
          calls.push(`model:${sessionID}:${busy}`);
        },
      },
      controller: {
        setSession(sessionID, busy) {
          calls.push(`controller:${sessionID}:${busy}`);
        },
        refresh(trigger) {
          calls.push(`refresh:${trigger}`);
        },
      },
    },
  };
}

describe("session 同步", () => {
  test("首次拿到 session 时请求一次事件刷新", () => {
    const { calls, wiring } = setup();
    expect(applySessionSnapshot(wiring, null, session("ses_one"))).toBe("ses_one");
    expect(calls).toEqual([
      "model:ses_one:false",
      "controller:ses_one:false",
      "refresh:event",
    ]);
  });

  test("同一 session 的忙碌变化只更新状态，不触发事件刷新", () => {
    const { calls, wiring } = setup();
    expect(applySessionSnapshot(wiring, "ses_one", session("ses_one", true))).toBe("ses_one");
    expect(calls).toEqual([
      "model:ses_one:true",
      "controller:ses_one:true",
    ]);
  });

  test("切换到另一个 session 时请求一次事件刷新", () => {
    const { calls, wiring } = setup();
    expect(applySessionSnapshot(wiring, "ses_one", session("ses_two"))).toBe("ses_two");
    expect(calls).toEqual([
      "model:ses_two:false",
      "controller:ses_two:false",
      "refresh:event",
    ]);
  });

  test("session 关闭时同步为空，不请求刷新", () => {
    const { calls, wiring } = setup();
    expect(applySessionSnapshot(wiring, "ses_one", null)).toBeNull();
    expect(calls).toEqual([
      "model:null:false",
      "controller:null:false",
    ]);
  });
});
