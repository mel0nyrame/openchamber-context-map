import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { HostFailureCopy } from "../src/panel/failure.ts";
import { resolveLocale, type MessageKey } from "../src/panel/i18n.ts";
import type {
  PanelModel,
  PanelState,
  PanelView,
  PanelZoom,
  PreviewState,
  SummaryProblem,
} from "../src/panel/model.ts";
import type { RefreshView } from "../src/panel/refresh.ts";
import type { PanelViewHandle } from "../src/panel/view.ts";
import type {
  Category,
  CollectorStatus,
  ItemSummary,
  SnapshotSummary,
} from "../src/shared/types.ts";
import { buildBreakdown, fitDenominator, layoutMap } from "../src/panel/map.ts";
import { panelView, summary } from "./fixtures.ts";

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

type TimerHandler = string | (() => void);

const realSetTimeout = happyWindow.setTimeout.bind(happyWindow);
const realClearTimeout = happyWindow.clearTimeout.bind(happyWindow);
let nextTimerID = 1;
const pendingTimers = new Map<number, () => void>();

function installFakeTimers(): void {
  pendingTimers.clear();
  nextTimerID = 1;
  (happyWindow as unknown as {
    setTimeout: (handler: TimerHandler, timeout?: number) => number;
  }).setTimeout = (handler) => {
    const id = nextTimerID;
    nextTimerID += 1;
    pendingTimers.set(id, () => {
      if (typeof handler === "function") handler();
    });
    return id;
  };
  (happyWindow as unknown as {
    clearTimeout: (id?: number) => void;
  }).clearTimeout = (id) => {
    if (id !== undefined) pendingTimers.delete(id);
  };
}

function restoreFakeTimers(): void {
  (happyWindow as unknown as { setTimeout: typeof realSetTimeout }).setTimeout =
    realSetTimeout;
  (happyWindow as unknown as { clearTimeout: typeof realClearTimeout }).clearTimeout =
    realClearTimeout;
  pendingTimers.clear();
}

function runTimers(): void {
  const callbacks = [...pendingTimers.values()];
  pendingTimers.clear();
  for (const callback of callbacks) callback();
}

const realClipboard = happyWindow.navigator.clipboard;
const clipboardWrites: string[] = [];

function stubClipboard(write: (text: string) => Promise<void>): void {
  clipboardWrites.length = 0;
  Object.defineProperty(happyWindow.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string): Promise<void> => {
        clipboardWrites.push(text);
        await write(text);
      },
    },
  });
}

function restoreClipboard(): void {
  Object.defineProperty(happyWindow.navigator, "clipboard", {
    configurable: true,
    value: realClipboard,
  });
}

type ExecCommand = (command: string) => boolean;

const documentWithExecCommand = document as unknown as {
  execCommand?: ExecCommand;
};
const realExecCommand = documentWithExecCommand.execCommand;

function stubExecCommand(result: boolean): void {
  documentWithExecCommand.execCommand = () => result;
}

function restoreExecCommand(): void {
  if (realExecCommand === undefined) {
    Reflect.deleteProperty(documentWithExecCommand, "execCommand");
  } else {
    documentWithExecCommand.execCommand = realExecCommand;
  }
}

installFakeTimers();

const { createPanelView } = await import("../src/panel/view.ts");

afterAll(() => {
  restoreFakeTimers();
  restoreClipboard();
  restoreExecCommand();
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

const CONNECTED_STATUS: PanelState = {
  kind: "connected",
  versionText: "v1.2.3",
  titleKey: "statusConnectedTitle",
  titleArgs: { version: "v1.2.3" },
  detailKey: "statusConnectedDetail",
};

function mapSummary(): SnapshotSummary {
  return summary({
    used: 12_000,
    window: 200_000,
    categories: [
      { category: "system", items: 1, chars: 6_000, tokens: 6_000 },
      { category: "userMessages", items: 2, chars: 5_000, tokens: 4_000 },
      { category: "assistantText", items: 1, chars: 2_000, tokens: 2_000 },
    ],
    items: [
      { id: "system:0", title: "System", chars: 6_000, head: "S" },
      { id: "userMessages:0", title: "First question", chars: 2_000, head: "F" },
      { id: "userMessages:1", title: "Second question", chars: 3_000, head: "S" },
      { id: "assistantText:0", title: "Answer", chars: 2_000, head: "A" },
    ],
  });
}

function itemsOfSnapshot(
  snapshot: SnapshotSummary,
  category: Category,
): ItemSummary[] {
  return snapshot.items.filter((item) => item.id.startsWith(`${category}:`));
}

function itemsOf(category: Category): ItemSummary[] {
  return itemsOfSnapshot(mapSummary(), category);
}

function summaryView(overrides: Partial<PanelView> = {}): PanelView {
  const snapshot = overrides.summary ?? mapSummary();
  const zoom = overrides.zoom ?? "window";
  const denominator = zoom === "fit"
    ? Math.min(snapshot.window, fitDenominator(snapshot.used))
    : snapshot.window;
  return panelView({
    status: CONNECTED_STATUS,
    body: { kind: "summary", summary: snapshot },
    sessionID: snapshot.sessionID,
    summary: snapshot,
    zoom,
    layout: layoutMap(snapshot.categories, denominator),
    breakdown: buildBreakdown(snapshot.categories, snapshot.used, snapshot.window),
    ...overrides,
  });
}

function itemsView(
  category: Category,
  overrides: Partial<PanelView> = {},
): PanelView {
  const items = itemsOf(category);
  return summaryView({
    selectedCategory: category,
    layer: "items",
    items,
    focus: { itemId: items[0]?.id ?? null, fallback: 0 },
    ...overrides,
  });
}

function previewState(overrides: Partial<PreviewState> = {}): PreviewState {
  return {
    itemId: "system:0",
    category: "system",
    title: "System",
    chars: 6_000,
    text: "You are a helpful assistant.",
    loading: false,
    error: null,
    truncated: false,
    ...overrides,
  };
}

function previewView(
  overrides: Partial<PanelView> = {},
  previewOverrides: Partial<PreviewState> = {},
): PanelView {
  const items = itemsOf("system");
  return summaryView({
    selectedCategory: "system",
    layer: "preview",
    items,
    focus: { itemId: "system:0", fallback: 0 },
    preview: previewState(previewOverrides),
    ...overrides,
  });
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

function pressKey(key: string, target: EventTarget = document): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

function pressEnter(target: HTMLElement): KeyboardEvent {
  return pressKey("Enter", target);
}

afterEach(() => {
  mounted?.handle.dispose();
  mounted?.root.remove();
  mounted = null;
  pendingTimers.clear();
  restoreClipboard();
  restoreExecCommand();
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
        versionText: "…",
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
        versionText: "v1.2.3",
        titleKey: "statusConnectedTitle",
        titleArgs: { version: "v1.2.3" },
        detailKey: "statusConnectedDetail",
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
        versionText: "v1.2.3",
        outdated: true,
        expectedText: "v2.0.0",
        titleKey: "statusConnectedTitle",
        titleArgs: { version: "v1.2.3" },
        detailKey: "statusOutdatedDetail",
        detailArgs: { expected: "v2.0.0" },
      },
      version: "v1.2.3",
      title: "Collector connected · v1.2.3",
      detail: "Collector is outdated; this extension expects v2.0.0.",
    },
    {
      label: "未找到 Collector",
      status: {
        kind: "disconnected",
        versionText: "—",
        reason: "not_found",
        titleKey: "collectorNotRunning",
        detailKey: "collectorNotRunningDetail",
        detailArgs: { path: "~/.config/opencode/plugins/" },
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
        versionText: "—",
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
        versionText: "—",
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
      const { root } = mount(panelView({ status: item.status }));
      const inline = query(root, ".status-inline");
      expect(inline.dataset.state).toBe(item.status.kind);
      expect(query(root, ".status-version").textContent).toBe(item.version);
      const full = `${item.title} · ${item.detail}`;
      expect(inline.title).toBe(full);
      expect(inline.getAttribute("aria-label")).toBe(full);
    });
  }

  test("状态条只渲染模型给的 copy，不按 reason 重新判断", () => {
    const { root } = mount(panelView({
      status: {
        kind: "disconnected",
        versionText: "—",
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
    const { root } = mount(panelView({
      status: {
        kind: "failed",
        versionText: "—",
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
  test("版本横幅使用模型给出的格式化期望版本", () => {
    const { root } = mount(panelView({
      status: {
        kind: "connected",
        versionText: "v1.2.3",
        outdated: true,
        expectedText: "v9.9.9",
        titleKey: "statusConnectedTitle",
        titleArgs: { version: "v1.2.3" },
        detailKey: "statusOutdatedDetail",
        detailArgs: { expected: "v9.9.9" },
      },
    }));
    const slot = query(root, "[data-version-banner]");
    expect(slot.hidden).toBe(false);
    expect(query(root, ".status-version").textContent).toBe("v1.2.3");
    expect(slot.querySelector(".oc-sdk-banner-title")?.textContent)
      .toBe("Collector version is outdated");
    expect(slot.querySelector(".oc-sdk-banner-body")?.textContent)
      .toBe(
        "Collector is running v1.2.3; this extension expects v9.9.9. Update the Collector manually; it will not update automatically.",
      );
  });

  test("版本一致时隐藏横幅", () => {
    const { root } = mount(panelView({
      status: {
        kind: "connected",
        versionText: "v1.2.3",
        titleKey: "statusConnectedTitle",
        titleArgs: { version: "v1.2.3" },
        detailKey: "statusConnectedDetail",
      },
    }));
    const slot = query(root, "[data-version-banner]");
    expect(slot.hidden).toBe(true);
  });
});

describe("占位区", () => {
  test("连接中显示标题和详情，不显示重试", () => {
    const { root } = mount(panelView());
    expect(query(root, ".placeholder").hidden).toBe(false);
    expect(query(root, ".placeholder-title").textContent)
      .toBe("Connecting to Collector…");
    expect(query(root, ".placeholder-detail").textContent)
      .toBe("The local Service may take a moment to start the first time.");
    expect(query(root, ".placeholder-actions").hidden).toBe(true);
  });

  test("没有 session 时显示重试，点击触发手动刷新", () => {
    const { root, manualRefreshes } = mount(panelView({
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
    const { root } = mount(panelView({
      status: {
        kind: "disconnected",
        versionText: "—",
        reason: "not_found",
        titleKey: "collectorNotRunning",
        detailKey: "collectorNotRunningDetail",
        detailArgs: { path: "~/.config/opencode/plugins/" },
      },
      body: {
        kind: "placeholder",
        titleKey: "collectorNotRunning",
        detailKey: "collectorNotRunningDetail",
        detailArgs: { path: "~/.config/opencode/plugins/" },
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
    const { root } = mount(panelView({
      status: {
        kind: "failed",
        versionText: "—",
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
    const { root } = mount(panelView({
      status: {
        kind: "connected",
        versionText: "v1.2.3",
        titleKey: "statusConnectedTitle",
        titleArgs: { version: "v1.2.3" },
        detailKey: "statusConnectedDetail",
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
    const { root, model } = mount(panelView({
      status: {
        kind: "connected",
        versionText: "v1.2.3",
        titleKey: "statusConnectedTitle",
        titleArgs: { version: "v1.2.3" },
        detailKey: "statusConnectedDetail",
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
    const { root, model } = mount(panelView({
      status: {
        kind: "connected",
        versionText: "v1.2.3",
        titleKey: "statusConnectedTitle",
        titleArgs: { version: "v1.2.3" },
        detailKey: "statusConnectedDetail",
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

describe("地图、图例与缩放", () => {
  test("地图按已用 token 绘制格子，图例和缩放标签显示当前口径", () => {
    const { root } = mount(summaryView());

    expect(query(root, ".map-card").hidden).toBe(false);
    const cells = root.querySelectorAll<HTMLButtonElement>(".cell");
    expect(cells).toHaveLength(200);
    expect(root.querySelectorAll(".cell.free")).toHaveLength(188);
    expect(cells[0]?.getAttribute("aria-label"))
      .toBe("System prompt 1,000 tokens");
    expect(cells[6]?.getAttribute("aria-label"))
      .toBe("User messages 1,000 tokens");
    expect(cells[10]?.getAttribute("aria-label"))
      .toBe("Assistant text 1,000 tokens");

    const firstFree = root.querySelector<HTMLButtonElement>(".cell.free");
    expect(firstFree?.getAttribute("aria-label"))
      .toBe("Free space · 188,000 tokens");

    const legend = Array.from(root.querySelectorAll(".legend-item"))
      .map((item) => item.textContent);
    expect(legend).toEqual(["Free 188k", "Used 12k"]);
    expect(query(root, ".zoom").textContent).toBe("Zoom Window 200k");
    expect(query(root, ".map").getAttribute("aria-label"))
      .toBe("Context map, drawn by used tokens");
  });

  test("悬停和点击格子显示 tooltip，点击空格回到总览", () => {
    const { root, model } = mount(summaryView());
    const cells = root.querySelectorAll<HTMLButtonElement>(".cell");
    const used = cells[0];
    if (used === undefined) throw new Error("missing used cell");

    used.dispatchEvent(new PointerEvent("pointerenter"));
    const tip = query(root, ".map-tip");
    expect(tip.hidden).toBe(false);
    expect(tip.querySelector(".tip-row")?.textContent)
      .toBe("System prompt1,000 tokens");

    used.dispatchEvent(new PointerEvent("pointerleave"));
    expect(tip.hidden).toBe(true);

    used.click();
    expect(tip.hidden).toBe(false);
    used.click();
    expect(tip.hidden).toBe(true);
    expect(model.commands).toEqual([]);

    const free = root.querySelector<HTMLButtonElement>(".cell.free");
    if (free === null) throw new Error("missing free cell");
    free.click();
    expect(model.commands).toEqual([{ type: "selectCategory", category: null }]);
    expect(tip.hidden).toBe(true);
  });

  test("缩放按钮发出 setZoom，并按新档位重画", () => {
    const { root, model } = mount(summaryView());
    query(root, ".zoom").click();
    expect(model.commands).toEqual([{ type: "setZoom", zoom: "fit" }]);

    const fit = layoutMap(mapSummary().categories, fitDenominator(12_000));
    model.emit({ zoom: "fit", layout: fit });
    expect(query(root, ".zoom").textContent).toBe("Zoom Fit 14k");
    expect(Array.from(root.querySelectorAll(".legend-item"))
      .map((item) => item.textContent)).toEqual(["Free 2k", "Used 12k"]);

    query(root, ".zoom").click();
    expect(model.commands.at(-1)).toEqual({ type: "setZoom", zoom: "window" });
  });
});

describe("分类与条目选择", () => {
  test("分类行显示条目数和 token，点击发出 selectCategory", () => {
    const { root, model } = mount(summaryView());
    const rows = Array.from(
      root.querySelectorAll<HTMLButtonElement>("button.row[data-category]"),
    );
    expect(rows.map((row) => row.dataset.category))
      .toEqual(["system", "userMessages", "assistantText"]);
    expect(rows[0]?.querySelector(".row-name")?.textContent).toBe("System prompt");
    expect(rows[0]?.querySelector(".row-meta")?.textContent)
      .toBe("1 item · 6,000 tokens");
    expect(rows[1]?.querySelector(".row-name")?.textContent).toBe("User messages");
    expect(rows[1]?.querySelector(".row-meta")?.textContent)
      .toBe("2 items · 4,000 tokens");

    const free = root.querySelector(".row-free");
    expect(free?.tagName).toBe("DIV");
    expect(free?.querySelector(".row-name")?.textContent).toBe("Free space");
    expect(free?.querySelector(".row-meta")?.textContent).toBe("188,000 tokens");

    rows[1]?.click();
    expect(model.commands)
      .toEqual([{ type: "selectCategory", category: "userMessages" }]);
  });

  test("选中分类后高亮地图、显示条目列表并发出 openItem", () => {
    const { root, model } = mount(summaryView());
    const items = itemsOf("userMessages");
    model.emit({
      selectedCategory: "userMessages",
      layer: "items",
      items,
      focus: { itemId: items[0]?.id ?? null, fallback: 0 },
    });

    const cells = root.querySelectorAll(".cell");
    expect(root.querySelectorAll(".cell.is-active")).toHaveLength(4);
    expect(root.querySelectorAll(".cell.is-dim")).toHaveLength(196);
    expect(cells[6]?.classList.contains("is-active")).toBe(true);
    expect(cells[5]?.classList.contains("is-dim")).toBe(true);

    expect(query(root, ".drill-title").textContent).toBe("User messages");
    expect(query(root, ".drill-meta").textContent).toBe("2 items · 4,000 tokens");
    const itemRows = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".item-row"),
    );
    expect(itemRows).toHaveLength(2);
    expect(itemRows[0]?.querySelector(".item-title")?.textContent)
      .toBe("First question");
    expect(itemRows[0]?.querySelector(".item-meta")?.textContent)
      .toBe("2,000 chars");
    expect(itemRows[0]?.classList.contains("is-selected")).toBe(true);
    expect(itemRows[0]?.getAttribute("aria-current")).toBe("true");
    expect(itemRows[1]?.classList.contains("is-selected")).toBe(false);
    expect(itemRows[1]?.getAttribute("aria-current")).toBeNull();
    expect(query(root, ".back").hidden).toBe(false);

    itemRows[1]?.click();
    expect(model.commands.at(-1))
      .toEqual({ type: "openItem", itemId: "userMessages:1" });
  });

  test("返回按钮在钻取时出现并发出 goBack", () => {
    const { root, model } = mount(itemsView("system"));
    const back = query(root, ".back");
    expect(back.hidden).toBe(false);
    expect(back.textContent).toBe("Back");

    back.click();
    expect(model.commands).toEqual([{ type: "goBack" }]);
  });

  test("没有条目的分类显示空态", () => {
    const { root, model } = mount(summaryView());
    model.emit({
      selectedCategory: "reasoning",
      layer: "items",
      items: [],
      focus: { itemId: null, fallback: 0 },
    });

    expect(query(root, ".drill-empty").textContent)
      .toBe("No items in this category.");
    expect(query(root, ".drill-meta").textContent).toBe("0 items");
  });
});

describe("预览、复制与截断", () => {
  test("预览显示标题、分类、字符数和正文", () => {
    const { root } = mount(previewView());

    expect(query(root, ".preview-title").textContent).toBe("System");
    expect(query(root, ".preview-meta").textContent)
      .toBe("System prompt · 6,000 chars");
    expect(query(root, ".preview-body").textContent)
      .toBe("You are a helpful assistant.");
    expect(query(root, ".preview-body").hidden).toBe(false);
    expect(query(root, ".preview-status").textContent).toBe("");
    expect(query(root, ".preview-copy").textContent).toBe("Copy");
    expect((query(root, ".preview-copy") as HTMLButtonElement).disabled).toBe(false);
    expect(query(root, ".back").hidden).toBe(false);
  });

  test("加载中显示状态并禁用复制", async () => {
    const { root, model } = mount(
      previewView({}, { loading: true, text: "" }),
    );

    expect(query(root, ".preview-status").textContent).toBe("Loading preview…");
    expect(query(root, ".preview-status").dataset.tone).toBe("");
    expect(query(root, ".preview-body").hidden).toBe(true);
    const copy = query(root, ".preview-copy") as HTMLButtonElement;
    expect(copy.disabled).toBe(true);

    copy.click();
    await flushPromises();
    expect(model.commands).toEqual([]);
  });

  test("读取错误显示错误文案并禁用复制", () => {
    const { root } = mount(
      previewView({}, { error: "previewReadError" }),
    );

    expect(query(root, ".preview-status").textContent)
      .toBe("Could not load this item's preview. Try again later.");
    expect(query(root, ".preview-status").dataset.tone).toBe("error");
    expect(query(root, ".preview-body").hidden).toBe(true);
    expect((query(root, ".preview-copy") as HTMLButtonElement).disabled).toBe(true);
  });

  test("截断的预览显示正文和截断提示", () => {
    const text = "x".repeat(8_000);
    const { root } = mount(
      previewView({}, { chars: 9_000, text, truncated: true }),
    );

    expect(query(root, ".preview-meta").textContent)
      .toBe("System prompt · 9,000 chars · showing first 8,000 chars");
    expect(query(root, ".preview-body").textContent).toHaveLength(8_000);
    expect((query(root, ".preview-copy") as HTMLButtonElement).disabled).toBe(false);
  });

  test("复制成功写入正文、发出 setNotice，并在计时结束后清除反馈", async () => {
    stubClipboard(async () => {});
    const { root, model } = mount(previewView());
    (query(root, ".preview-copy") as HTMLButtonElement).click();
    await flushPromises();

    expect(clipboardWrites).toEqual(["You are a helpful assistant."]);
    expect(model.commands).toEqual([{ type: "setNotice", notice: "previewCopied" }]);

    model.emit({ notice: "previewCopied" });
    expect(query(root, ".preview-copy").textContent).toBe("Copied");
    expect(query(root, ".preview-status").textContent).toBe("Preview text copied.");
    expect(query(root, ".preview-status").dataset.tone).toBe("ok");

    runTimers();
    expect(model.commands.at(-1)).toEqual({ type: "setNotice", notice: null });

    model.emit({ notice: null });
    expect(query(root, ".preview-copy").textContent).toBe("Copy");
    expect(query(root, ".preview-status").textContent).toBe("");
  });

  test("复制失败且 execCommand 失败时提示手动复制", async () => {
    stubClipboard(async () => {
      throw new Error("denied");
    });
    stubExecCommand(false);
    const { root, model } = mount(previewView());
    (query(root, ".preview-copy") as HTMLButtonElement).click();
    await flushPromises();

    expect(clipboardWrites).toEqual(["You are a helpful assistant."]);
    expect(model.commands)
      .toEqual([{ type: "setNotice", notice: "previewCopyFailed" }]);
    expect(document.querySelector("textarea")).toBeNull();

    model.emit({ notice: "previewCopyFailed" });
    expect(query(root, ".preview-status").textContent)
      .toBe("Copy failed. Select the preview text manually.");
    expect(query(root, ".preview-status").dataset.tone).toBe("error");
  });

  test("剪贴板不可用时用 execCommand 回退", async () => {
    stubClipboard(async () => {
      throw new Error("denied");
    });
    stubExecCommand(true);
    const { root, model } = mount(previewView());
    (query(root, ".preview-copy") as HTMLButtonElement).click();
    await flushPromises();

    expect(model.commands).toEqual([{ type: "setNotice", notice: "previewCopied" }]);
  });

  test("dispose 清理复制计时器", async () => {
    stubClipboard(async () => {});
    const { root, model, handle } = mount(previewView());
    (query(root, ".preview-copy") as HTMLButtonElement).click();
    await flushPromises();

    handle.dispose();
    runTimers();
    expect(model.commands)
      .not.toContainEqual({ type: "setNotice", notice: null });
  });
});

describe("键盘与焦点恢复", () => {
  test("方向键在分类行之间移动焦点", () => {
    const { root, model } = mount(summaryView());
    const rows = Array.from(
      root.querySelectorAll<HTMLButtonElement>("button.row[data-category]"),
    );
    rows[0]?.focus();

    const down = pressKey("ArrowDown");
    expect(down.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(rows[1] ?? null);

    pressKey("ArrowDown");
    expect(document.activeElement).toBe(rows[2] ?? null);

    pressKey("ArrowUp");
    expect(document.activeElement).toBe(rows[1] ?? null);
    expect(model.commands).toEqual([]);
  });

  test("方向键在条目之间移动并通知模型", () => {
    const { root, model } = mount(itemsView("userMessages"));
    const rows = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".item-row"),
    );
    rows[0]?.focus();
    expect(model.commands.at(-1))
      .toEqual({ type: "focusItemById", itemId: "userMessages:0", fallback: 0 });

    pressKey("ArrowDown");
    expect(model.commands).toContainEqual({ type: "focusItemAt", index: 1 });
    expect(document.activeElement).toBe(rows[1] ?? null);

    pressKey("ArrowUp");
    expect(model.commands).toContainEqual({ type: "focusItemAt", index: 0 });
    expect(document.activeElement).toBe(rows[0] ?? null);
  });

  test("Enter 打开当前条目", () => {
    const { root, model } = mount(itemsView("system"));
    const row = query(root, ".item-row");
    row.focus();

    const event = pressEnter(row);
    expect(event.defaultPrevented).toBe(true);
    expect(model.commands.filter((command) => command.type === "openItem"))
      .toEqual([{ type: "openItem", itemId: "system:0" }]);
  });

  test("Escape 关闭预览", () => {
    const { model } = mount(previewView());
    pressKey("Escape");
    expect(model.commands).toEqual([{ type: "goBack" }]);
  });

  test("Escape 退出分类列表", () => {
    const { model } = mount(itemsView("system"));
    pressKey("Escape");
    expect(model.commands).toEqual([{ type: "goBack" }]);
  });

  test("总览时 Escape 不发命令", () => {
    const { model } = mount(summaryView());
    pressKey("Escape");
    expect(model.commands).toEqual([]);
  });

  test("关闭预览后焦点回到条目", () => {
    const { root, model } = mount(previewView());
    query(root, ".preview-body").focus();

    model.emit({ preview: null, layer: "items" });
    const active = document.activeElement;
    expect(active instanceof HTMLElement ? active.dataset.itemId : null)
      .toBe("system:0");
  });

  test("关闭预览并退出分类后焦点回到分类行", () => {
    const { root, model } = mount(previewView());
    query(root, ".preview-body").focus();

    model.emit({
      preview: null,
      selectedCategory: null,
      layer: "overview",
      items: [],
      focus: { itemId: null, fallback: 0 },
    });
    const active = document.activeElement;
    expect(active instanceof HTMLElement ? active.dataset.category : null)
      .toBe("system");
  });

  test("选中分类后焦点落在第一条条目", () => {
    const { model } = mount(summaryView());
    const items = itemsOf("userMessages");
    model.emit({
      selectedCategory: "userMessages",
      layer: "items",
      items,
      focus: { itemId: items[0]?.id ?? null, fallback: 0 },
    });

    const active = document.activeElement;
    expect(active instanceof HTMLElement ? active.dataset.itemId : null)
      .toBe("userMessages:0");
  });

  test("条目列表重渲染后焦点回到同一个条目", () => {
    const { root, model } = mount(itemsView("userMessages"));
    const rows = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".item-row"),
    );
    rows[1]?.focus();

    const snapshot = mapSummary();
    const renamed: SnapshotSummary = {
      ...snapshot,
      items: snapshot.items.map((item) => item.id === "userMessages:1"
        ? { ...item, title: "Second question, renamed" }
        : item),
    };
    model.emit({
      summary: renamed,
      body: { kind: "summary", summary: renamed },
      items: itemsOfSnapshot(renamed, "userMessages"),
    });

    expect(query(root, '[data-item-id="userMessages:1"] .item-title').textContent)
      .toBe("Second question, renamed");
    const active = document.activeElement;
    expect(active instanceof HTMLElement ? active.dataset.itemId : null)
      .toBe("userMessages:1");
  });
});

describe("语言切换", () => {
  test("setLocale 切换全部可见文案，en 与 fallback 回到英文", () => {
    const { root, handle } = mount(summaryView());

    expect(query(root, ".usage-title").textContent).toBe("Context usage");
    expect(query(root, ".zoom").textContent).toBe("Zoom Window 200k");
    expect(query(root, ".status-inline").title)
      .toBe("Collector connected · v1.2.3 · Snapshots are read through the local Service; the bearer never enters the panel.");
    expect(Array.from(root.querySelectorAll(".row-name"))
      .map((node) => node.textContent))
      .toEqual(["System prompt", "User messages", "Assistant text", "Free space"]);

    handle.setLocale("zh");
    expect(query(root, ".usage-title").textContent).toBe("上下文用量");
    expect(query(root, ".zoom").textContent).toBe("缩放 Window 200k");
    expect(query(root, ".status-inline").title)
      .toBe("Collector 已连接 · v1.2.3 · 快照会通过本地 Service 读取，bearer 不会进入面板。");
    expect(Array.from(root.querySelectorAll(".legend-item"))
      .map((node) => node.textContent)).toEqual(["空闲 188k", "已用 12k"]);
    expect(Array.from(root.querySelectorAll(".row-name"))
      .map((node) => node.textContent))
      .toEqual(["系统提示", "用户消息", "助手文本", "空闲空间"]);
    expect(query(root, ".back").textContent).toBe("返回");

    handle.setLocale("en");
    expect(query(root, ".usage-title").textContent).toBe("Context usage");
    expect(query(root, ".row-name").textContent).toBe("System prompt");

    handle.setLocale("zh");
    handle.setLocale(resolveLocale("fr"));
    expect(query(root, ".usage-title").textContent).toBe("Context usage");
  });
});

describe("dispose", () => {
  test("取消订阅后 emit 不再更新 DOM，键盘监听也已移除", () => {
    const { root, model, handle } = mount(summaryView());
    const before = query(root, ".usage-model").textContent;

    handle.dispose();

    const rows = Array.from(
      root.querySelectorAll<HTMLButtonElement>("button.row[data-category]"),
    );
    rows[0]?.focus();
    pressKey("ArrowDown");
    expect(document.activeElement).toBe(rows[0] ?? null);

    const next = summary({ model: "someone/else", used: 1, window: 2 });
    model.emit({ summary: next, body: { kind: "summary", summary: next } });
    expect(query(root, ".usage-model").textContent).toBe(before);
  });
});
