import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { HostFailureCopy } from "../src/panel/failure.ts";
import type { MessageKey } from "../src/panel/i18n.ts";
import type {
  PanelModel,
  PanelState,
  PanelView,
  PanelZoom,
  SummaryProblem,
} from "../src/panel/model.ts";
import type { RefreshView } from "../src/panel/refresh.ts";
import type { PanelViewHandle } from "../src/panel/view.ts";
import type {
  Category,
  CollectorStatus,
  SnapshotSummary,
} from "../src/shared/types.ts";
import { initialRefreshState } from "../src/panel/refresh.ts";
import { summary } from "./fixtures.ts";

// The view and the SDK resolve these globals at call time. Install them before
// importing the view so this test file is the only one that needs a DOM.
const DOM_GLOBALS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLStyleElement",
  "Element",
  "Node",
  "Event",
  "KeyboardEvent",
  "MouseEvent",
  "PointerEvent",
  "FocusEvent",
  "CustomEvent",
] as const;

const happyWindow = new Window({ url: "http://localhost/" });
const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
for (const key of DOM_GLOBALS) {
  savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
}

Object.assign(globalThis, {
  window: happyWindow,
  document: happyWindow.document,
  navigator: happyWindow.navigator,
  HTMLElement: happyWindow.HTMLElement,
  HTMLButtonElement: happyWindow.HTMLButtonElement,
  HTMLStyleElement: happyWindow.HTMLStyleElement,
  Element: happyWindow.Element,
  Node: happyWindow.Node,
  Event: happyWindow.Event,
  KeyboardEvent: happyWindow.KeyboardEvent,
  MouseEvent: happyWindow.MouseEvent,
  PointerEvent: happyWindow.PointerEvent,
  FocusEvent: happyWindow.FocusEvent,
  CustomEvent: happyWindow.CustomEvent,
});

const { createPanelView } = await import("../src/panel/view.ts");

afterAll(() => {
  for (const key of DOM_GLOBALS) {
    const descriptor = savedGlobals.get(key);
    if (descriptor === undefined) {
      Reflect.deleteProperty(globalThis, key);
    } else {
      Object.defineProperty(globalThis, key, descriptor);
    }
  }
  happyWindow.close();
});

type Command =
  | { readonly type: "setZoom"; readonly zoom: PanelZoom }
  | { readonly type: "selectCategory"; readonly category: Category | null }
  | { readonly type: "openItem"; readonly itemId: string }
  | { readonly type: "closePreview" }
  | { readonly type: "goBack" }
  | { readonly type: "focusItemAt"; readonly index: number }
  | {
    readonly type: "focusItemById";
    readonly itemId: string | null;
    readonly fallback: number | undefined;
  }
  | { readonly type: "setNotice"; readonly notice: MessageKey | null };

/**
 * View-only fake: it owns a PanelView and broadcasts it, but never talks to a
 * host, Service, or Collector. Command methods only append to `commands`.
 */
class FakePanelModel implements PanelModel {
  private current: PanelView;
  private readonly listeners = new Set<(view: PanelView) => void>();
  readonly commands: Command[] = [];

  constructor(view: PanelView) {
    this.current = view;
  }

  getView(): PanelView {
    return this.current;
  }

  subscribe(listener: (view: PanelView) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(next: Partial<PanelView>): void {
    this.current = { ...this.current, ...next };
    for (const listener of this.listeners) listener(this.current);
  }

  setBooted(_booted: boolean): void {}

  setSession(_sessionID: string | null, _busy: boolean): void {}

  setConnection(_status: CollectorStatus | null): void {}

  setHostProblem(_problem: HostFailureCopy | null): boolean {
    return false;
  }

  setSummary(_summary: SnapshotSummary | null): void {}

  setSummaryProblem(_problem: SummaryProblem | null): void {}

  setRefresh(_view: RefreshView): void {}

  selectCategory(category: Category | null): void {
    this.commands.push({ type: "selectCategory", category });
  }

  async openItem(itemId: string): Promise<void> {
    this.commands.push({ type: "openItem", itemId });
  }

  closePreview(): void {
    this.commands.push({ type: "closePreview" });
  }

  goBack(): void {
    this.commands.push({ type: "goBack" });
  }

  setZoom(zoom: PanelZoom): void {
    this.commands.push({ type: "setZoom", zoom });
  }

  focusItemAt(index: number): void {
    this.commands.push({ type: "focusItemAt", index });
  }

  focusItemById(itemId: string | null, fallback?: number): void {
    this.commands.push({ type: "focusItemById", itemId, fallback });
  }

  setNotice(notice: MessageKey | null): void {
    this.commands.push({ type: "setNotice", notice });
  }
}

function baseView(overrides: Partial<PanelView> = {}): PanelView {
  const base: PanelView = {
    status: {
      kind: "checking",
      titleKey: "statusCheckingTitle",
      detailKey: "statusCheckingDetail",
    },
    body: {
      kind: "placeholder",
      titleKey: "connectingTitle",
      detailKey: "connectingDetail",
      retry: false,
    },
    sessionID: null,
    summary: null,
    refresh: {
      state: initialRefreshState(),
      inFlight: false,
      manualLoading: false,
      hasLoaded: false,
    },
    selectedCategory: null,
    layer: "overview",
    items: [],
    layout: null,
    breakdown: null,
    zoom: "window",
    preview: null,
    focus: { itemId: null, fallback: 0 },
    notice: null,
  };
  return { ...base, ...overrides };
}

interface Mounted {
  readonly root: HTMLDivElement;
  readonly model: FakePanelModel;
  readonly handle: PanelViewHandle;
  readonly manualRefreshes: () => number;
}

let mounted: Mounted | null = null;

function mount(view: PanelView): Mounted {
  const root = document.createElement("div");
  document.body.append(root);
  const model = new FakePanelModel(view);
  let manualRefreshes = 0;
  const handle = createPanelView({
    root,
    model,
    onManualRefresh: () => {
      manualRefreshes += 1;
    },
  });
  mounted = {
    root,
    model,
    handle,
    manualRefreshes: () => manualRefreshes,
  };
  return mounted;
}

function query(root: HTMLElement, selector: string): HTMLElement {
  const node = root.querySelector(selector);
  if (!(node instanceof HTMLElement)) {
    throw new Error(`missing element: ${selector}`);
  }
  return node;
}

afterEach(() => {
  mounted?.handle.dispose();
  mounted?.root.remove();
  mounted = null;
  document.body.replaceChildren();
  document.head.replaceChildren();
});

describe("状态条", () => {
  const cases: ReadonlyArray<{
    readonly label: string;
    readonly status: PanelState;
    readonly version: string;
    readonly title: string;
    readonly detail: string;
  }> = [
    {
      label: "连接中",
      status: {
        kind: "checking",
        titleKey: "statusCheckingTitle",
        detailKey: "statusCheckingDetail",
      },
      version: "…",
      title: "Connecting to the local Service…",
      detail: "The Service may take a moment to start the first time.",
    },
    {
      label: "已连接",
      status: {
        kind: "connected",
        version: "1.2.3",
        titleKey: "statusConnectedTitle",
        detailKey: "statusConnectedDetail",
        args: { version: "v1.2.3" },
      },
      version: "v1.2.3",
      title: "Collector connected · v1.2.3",
      detail:
        "Snapshots are read through the local Service; the bearer never enters the panel.",
    },
    {
      label: "版本过期",
      status: {
        kind: "connected",
        version: "1.2.3",
        outdated: true,
        expectedVersion: "2.0.0",
        titleKey: "statusConnectedTitle",
        detailKey: "statusOutdatedDetail",
        args: { version: "v1.2.3", expected: "v2.0.0" },
      },
      version: "v1.2.3",
      title: "Collector connected · v1.2.3",
      detail: "Collector is outdated; this extension expects v2.0.0.",
    },
    {
      label: "未找到 Collector",
      status: {
        kind: "disconnected",
        reason: "not_found",
        titleKey: "collectorNotRunning",
        detailKey: "collectorNotRunningDetail",
        args: { path: "~/.config/opencode/plugins/" },
      },
      version: "—",
      title: "Collector is not running",
      detail:
        "No discovery file was found. Install the Collector to ~/.config/opencode/plugins/ and restart OpenCode.",
    },
    {
      label: "Collector 无响应",
      status: {
        kind: "disconnected",
        reason: "unreachable",
        titleKey: "collectorUnreachableTitle",
        detailKey: "collectorUnreachableDetail",
      },
      version: "—",
      title: "Collector is not responding",
      detail:
        "The discovery file exists, but the Collector is not responding. Restart OpenCode and try again.",
    },
    {
      label: "Host 失败",
      status: {
        kind: "failed",
        titleKey: "hostNoServiceTitle",
        detailKey: "hostNoServiceDetail",
      },
      version: "—",
      title: "Service is not ready",
      detail: "Authorize and enable the Context Map Service in Settings → Extensions.",
    },
  ];

  for (const item of cases) {
    test(`显示${item.label}的文案和版本`, () => {
      const { root } = mount(baseView({ status: item.status }));
      const inline = query(root, ".status-inline");
      expect(inline.dataset.state).toBe(item.status.kind);
      expect(query(root, ".status-version").textContent).toBe(item.version);
      const full = `${item.title} · ${item.detail}`;
      expect(inline.title).toBe(full);
      expect(inline.getAttribute("aria-label")).toBe(full);
    });
  }

  test("状态条只渲染模型给的 copy，不按 reason 重新判断", () => {
    const { root } = mount(baseView({
      status: {
        kind: "disconnected",
        reason: "not_found",
        titleKey: "collectorUnreachableTitle",
        detailKey: "collectorUnreachableDetail",
      },
    }));
    const inline = query(root, ".status-inline");
    expect(inline.title).toBe(
      "Collector is not responding · The discovery file exists, but the Collector is not responding. Restart OpenCode and try again.",
    );
    expect(query(root, ".status-version").textContent).toBe("—");
  });

  test("Host 失败的状态条使用模型给的宿主 copy", () => {
    const { root } = mount(baseView({
      status: {
        kind: "failed",
        titleKey: "hostDisabledTitle",
        detailKey: "hostDisabledDetail",
      },
    }));
    const inline = query(root, ".status-inline");
    expect(inline.dataset.state).toBe("failed");
    expect(inline.title).toBe("Context Map is paused · Re-enable it in Settings → Extensions.");
    expect(inline.getAttribute("aria-label")).toBe(inline.title);
    expect(query(root, ".status-version").textContent).toBe("—");
  });
});

describe("版本横幅", () => {
  test("版本横幅使用模型给出的 expectedVersion", () => {
    const { root } = mount(baseView({
      status: {
        kind: "connected",
        version: "1.2.3",
        outdated: true,
        expectedVersion: "9.9.9",
        titleKey: "statusConnectedTitle",
        detailKey: "statusOutdatedDetail",
        args: { version: "v1.2.3", expected: "v9.9.9" },
      },
    }));
    const slot = root.children[1];
    if (!(slot instanceof HTMLElement)) throw new Error("missing version slot");
    expect(slot.hidden).toBe(false);
    expect(slot.querySelector(".oc-sdk-banner-title")?.textContent)
      .toBe("Collector version is outdated");
    expect(slot.querySelector(".oc-sdk-banner-body")?.textContent)
      .toBe(
        "Collector is running v1.2.3; this extension expects v9.9.9. Update the Collector manually; it will not update automatically.",
      );
  });

  test("版本一致时隐藏横幅", () => {
    const { root } = mount(baseView({
      status: {
        kind: "connected",
        version: "1.2.3",
        titleKey: "statusConnectedTitle",
        detailKey: "statusConnectedDetail",
        args: { version: "v1.2.3" },
      },
    }));
    const slot = root.children[1];
    if (!(slot instanceof HTMLElement)) throw new Error("missing version slot");
    expect(slot.hidden).toBe(true);
  });
});

describe("占位区", () => {
  test("连接中显示标题和详情，不显示重试", () => {
    const { root } = mount(baseView());
    expect(query(root, ".placeholder").hidden).toBe(false);
    expect(query(root, ".placeholder-title").textContent)
      .toBe("Connecting to Collector…");
    expect(query(root, ".placeholder-detail").textContent)
      .toBe("The local Service may take a moment to start the first time.");
    expect(query(root, ".placeholder-actions").hidden).toBe(true);
  });

  test("没有 session 时显示重试，点击触发手动刷新", () => {
    const { root, manualRefreshes } = mount(baseView({
      body: {
        kind: "placeholder",
        titleKey: "noSessionTitle",
        detailKey: "noSessionDetail",
        retry: true,
      },
    }));
    expect(query(root, ".placeholder-title").textContent).toBe("No open session");
    expect(query(root, ".placeholder-detail").textContent)
      .toBe("Open a session to see its context usage.");
    const actions = query(root, ".placeholder-actions");
    expect(actions.hidden).toBe(false);
    const retry = actions.querySelector("button");
    if (retry === null) throw new Error("missing retry button");
    expect(retry.textContent).toBe("Retry");
    retry.click();
    expect(manualRefreshes()).toBe(1);
  });

  test("未安装 Collector 时在详情里给出安装路径", () => {
    const { root } = mount(baseView({
      status: {
        kind: "disconnected",
        reason: "not_found",
        titleKey: "collectorNotRunning",
        detailKey: "collectorNotRunningDetail",
        args: { path: "~/.config/opencode/plugins/" },
      },
      body: {
        kind: "placeholder",
        titleKey: "collectorNotRunning",
        detailKey: "collectorNotRunningDetail",
        args: { path: "~/.config/opencode/plugins/" },
        retry: true,
      },
    }));
    expect(query(root, ".placeholder-title").textContent)
      .toBe("Collector is not running");
    expect(query(root, ".placeholder-detail").textContent)
      .toBe(
        "No discovery file was found. Install the Collector to ~/.config/opencode/plugins/ and restart OpenCode.",
      );
    expect(query(root, ".placeholder-actions").hidden).toBe(false);
  });

  test("Host 失败时显示标题、详情和重试", () => {
    const { root } = mount(baseView({
      status: {
        kind: "failed",
        titleKey: "hostNoServiceTitle",
        detailKey: "hostNoServiceDetail",
      },
      body: {
        kind: "placeholder",
        titleKey: "hostNoServiceTitle",
        detailKey: "hostNoServiceDetail",
        retry: true,
      },
    }));
    expect(query(root, ".placeholder-title").textContent)
      .toBe("Service is not ready");
    expect(query(root, ".placeholder-detail").textContent)
      .toBe("Authorize and enable the Context Map Service in Settings → Extensions.");
    expect(query(root, ".placeholder-actions").hidden).toBe(false);
  });
});

describe("摘要", () => {
  test("显示模型、Used / Window、百分比和三个标记", () => {
    const snapshot = summary({
      estimated: true,
      windowAssumed: true,
      baseline: true,
    });
    const { root } = mount(baseView({
      status: {
        kind: "connected",
        version: "1.2.3",
        titleKey: "statusConnectedTitle",
        detailKey: "statusConnectedDetail",
        args: { version: "v1.2.3" },
      },
      body: { kind: "summary", summary: snapshot },
      sessionID: snapshot.sessionID,
      summary: snapshot,
    }));

    expect(query(root, ".placeholder").hidden).toBe(true);
    expect(query(root, ".usage-model").textContent)
      .toBe("anthropic/claude-sonnet-4-5");
    expect(query(root, ".usage-numbers").textContent)
      .toBe("12,000 / 200,000 tokens");
    expect(query(root, ".usage-pct").textContent).toBe("6%");
    expect(query(root, ".oc-sdk-progress-track").getAttribute("aria-valuenow"))
      .toBe("6");

    const badges = query(root, ".usage-badges");
    expect(badges.hidden).toBe(false);
    const [estimated, assumed, baseline] = Array.from(badges.children);
    if (!(estimated instanceof HTMLElement)
      || !(assumed instanceof HTMLElement)
      || !(baseline instanceof HTMLElement)) {
      throw new Error("missing badge slots");
    }
    expect(estimated.hidden).toBe(false);
    expect(estimated.textContent).toBe("estimated");
    expect(assumed.hidden).toBe(false);
    expect(assumed.textContent).toBe("assumed window");
    expect(baseline.hidden).toBe(false);
    expect(baseline.textContent).toBe("baseline");
  });

  test("三个标记都为 false 时隐藏标记区", () => {
    const snapshot = summary();
    const { root, model } = mount(baseView({
      status: {
        kind: "connected",
        version: "1.2.3",
        titleKey: "statusConnectedTitle",
        detailKey: "statusConnectedDetail",
        args: { version: "v1.2.3" },
      },
      body: { kind: "summary", summary: snapshot },
      sessionID: snapshot.sessionID,
      summary: snapshot,
    }));

    const next = summary({
      estimated: false,
      windowAssumed: false,
      baseline: false,
    });
    model.emit({
      body: { kind: "summary", summary: next },
      summary: next,
    });

    const badges = query(root, ".usage-badges");
    expect(badges.hidden).toBe(true);
    for (const child of Array.from(badges.children)) {
      expect((child as HTMLElement).hidden).toBe(true);
    }
  });
});

describe("命令日志", () => {
  test("点击缩放按钮把意图交给假模型", () => {
    const snapshot = summary();
    const { root, model } = mount(baseView({
      status: {
        kind: "connected",
        version: "1.2.3",
        titleKey: "statusConnectedTitle",
        detailKey: "statusConnectedDetail",
        args: { version: "v1.2.3" },
      },
      body: { kind: "summary", summary: snapshot },
      sessionID: snapshot.sessionID,
      summary: snapshot,
    }));

    expect(model.commands).toEqual([]);
    query(root, ".zoom").click();
    expect(model.commands).toEqual([{ type: "setZoom", zoom: "fit" }]);
  });
});
