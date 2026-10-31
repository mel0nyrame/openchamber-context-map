import { describe, expect, test } from "bun:test";

import {
  createPanelModel,
  type ItemLoadResult,
  type PanelView,
} from "../src/panel/model.ts";
import {
  CATEGORIES,
  type CategoryUsage,
  type ItemSummary,
  type SnapshotSummary,
} from "../src/shared/types.ts";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

interface PendingLoad {
  sessionID: string;
  itemId: string;
  result: Deferred<ItemLoadResult>;
}

function loader() {
  const pending: PendingLoad[] = [];
  return {
    pending,
    loadItem(sessionID: string, itemId: string): Promise<ItemLoadResult> {
      const result = deferred<ItemLoadResult>();
      pending.push({ sessionID, itemId, result });
      return result.promise;
    },
  };
}

function categories(systemTokens = 6_000, userTokens = 6_000): CategoryUsage[] {
  return CATEGORIES.map((category) => {
    if (category === "system") {
      return { category, items: 2, chars: 800, tokens: systemTokens };
    }
    if (category === "userMessages") {
      return { category, items: 1, chars: 500, tokens: userTokens };
    }
    return { category, items: 0, chars: 0, tokens: 0 };
  });
}

function items(): ItemSummary[] {
  return [
    { id: "system:0@1", title: "System zero", chars: 400, head: "S".repeat(200) },
    { id: "system:1@1", title: "System one", chars: 300, head: "S".repeat(200) },
    { id: "userMessages:0@1", title: "User zero", chars: 500, head: "U".repeat(200) },
  ];
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
    items: items(),
    ...overrides,
  };
}

function detail(itemId: string, overrides: Partial<{ title: string; chars: number; text: string }> = {}) {
  return {
    kind: "ok" as const,
    detail: {
      id: itemId,
      title: `Detail ${itemId}`,
      chars: 120,
      text: `Text for ${itemId}`,
      ...overrides,
    },
  };
}

function setup(loadItem = loader().loadItem) {
  const missing: number[] = [];
  const model = createPanelModel({
    loadItem,
    onPreviewMissing: () => {
      missing.push(missing.length + 1);
    },
  });
  model.setBooted(true);
  model.setSession("ses_one", false);
  model.setConnection({ connected: true, version: "1.2.3" });
  model.setSummary(summary());
  return { model, missing };
}

function view(model: ReturnType<typeof createPanelModel>): PanelView {
  return model.getView();
}

describe("PanelModel 分类选择与层级", () => {
  test("选择分类进入条目层，清空分类回到总览", () => {
    const { model } = setup();
    model.selectCategory("system");
    let current = view(model);
    expect(current.selectedCategory).toBe("system");
    expect(current.layer).toBe("items");
    expect(current.items.map((item) => item.id)).toEqual(["system:0@1", "system:1@1"]);
    expect(current.focus).toEqual({ itemId: "system:0@1", fallback: 0 });

    model.selectCategory(null);
    current = view(model);
    expect(current.selectedCategory).toBeNull();
    expect(current.layer).toBe("overview");
    expect(current.items).toEqual([]);
  });

  test("再次选择同一分类不重复通知", () => {
    const { model } = setup();
    model.selectCategory("system");
    let calls = 0;
    model.subscribe(() => {
      calls += 1;
    });
    model.selectCategory("system");
    expect(calls).toBe(0);
  });

  test("选择分类会清掉预览、焦点和 notice", async () => {
    const loads = loader();
    const { model } = setup(loads.loadItem);
    model.setNotice("previewCopied");
    model.selectCategory("system");
    const opening = model.openItem("system:0@1");
    loads.pending[0]?.result.resolve(detail("system:0@1"));
    await opening;
    expect(view(model).layer).toBe("preview");

    model.selectCategory(null);
    const current = view(model);
    expect(current.preview).toBeNull();
    expect(current.notice).toBeNull();
    expect(current.focus).toEqual({ itemId: null, fallback: 0 });
  });

  test("刷新 summary 保留仍然有格子的选择", () => {
    const { model } = setup();
    model.selectCategory("system");
    model.setSummary(summary());
    expect(view(model).selectedCategory).toBe("system");
  });

  test("新 summary 里选中分类没有格子时归零", () => {
    const { model } = setup();
    model.selectCategory("system");
    model.setSummary(summary({
      categories: categories(0, 12_000),
      items: items().filter((item) => !item.id.startsWith("system:")),
    }));
    expect(view(model).selectedCategory).toBeNull();
    expect(view(model).layer).toBe("overview");
  });
});

describe("PanelModel 焦点", () => {
  test("焦点按下标移动并夹在列表边界内", () => {
    const { model } = setup();
    model.selectCategory("system");

    model.focusItemAt(99);
    expect(view(model).focus).toEqual({ itemId: "system:1@1", fallback: 1 });
    model.focusItemAt(-5);
    expect(view(model).focus).toEqual({ itemId: "system:0@1", fallback: 0 });
  });

  test("按 id 优先，找不到时退回夹住的旧下标", () => {
    const { model } = setup();
    model.selectCategory("system");

    model.focusItemById("system:1@1", 0);
    expect(view(model).focus).toEqual({ itemId: "system:1@1", fallback: 1 });
    model.focusItemById("system:missing", 99);
    expect(view(model).focus).toEqual({ itemId: "system:1@1", fallback: 1 });
    model.focusItemById("system:missing", 0);
    expect(view(model).focus).toEqual({ itemId: "system:0@1", fallback: 0 });
  });
});

describe("PanelModel 缩放", () => {
  test("window 使用窗口，fit 使用留有余量的分母", () => {
    const { model } = setup();
    expect(view(model).zoom).toBe("window");
    expect(view(model).layout?.denominator).toBe(200_000);

    model.setZoom("fit");
    expect(view(model).zoom).toBe("fit");
    expect(view(model).layout?.denominator).toBe(14_000);
  });

  test("缩放跨刷新保留，切换 session 重置", () => {
    const { model } = setup();
    model.setZoom("fit");
    model.setSummary(summary());
    expect(view(model).zoom).toBe("fit");

    model.setSession("ses_two", false);
    expect(view(model).zoom).toBe("window");
  });
});

describe("PanelModel 预览", () => {
  test("打开条目先 loading，成功后显示正文并标记截断", async () => {
    const loads = loader();
    const { model } = setup(loads.loadItem);
    model.selectCategory("system");

    const opening = model.openItem("system:0@1");
    expect(view(model).layer).toBe("preview");
    expect(view(model).preview).toMatchObject({
      itemId: "system:0@1",
      category: "system",
      title: "System zero",
      chars: 400,
      loading: true,
      error: null,
      truncated: false,
    });

    loads.pending[0]?.result.resolve(detail("system:0@1", {
      title: "Loaded title",
      chars: 9_000,
      text: "x".repeat(9_000),
    }));
    await opening;

    const preview = view(model).preview;
    expect(preview).toMatchObject({
      itemId: "system:0@1",
      title: "Loaded title",
      chars: 9_000,
      loading: false,
      error: null,
      truncated: true,
    });
    expect(preview?.text).toHaveLength(8_000);
  });

  test("切换条目后旧响应被丢弃", async () => {
    const loads = loader();
    const { model } = setup(loads.loadItem);
    model.selectCategory("system");

    const first = model.openItem("system:0@1");
    const second = model.openItem("system:1@1");
    loads.pending[0]?.result.resolve(detail("system:0@1"));
    await first;
    expect(view(model).preview?.itemId).toBe("system:1@1");
    expect(view(model).preview?.loading).toBe(true);

    loads.pending[1]?.result.resolve(detail("system:1@1"));
    await second;
    expect(view(model).preview?.title).toBe("Detail system:1@1");
  });

  test("关闭预览后迟到的响应被丢弃", async () => {
    const loads = loader();
    const { model } = setup(loads.loadItem);
    model.selectCategory("system");

    const opening = model.openItem("system:0@1");
    model.closePreview();
    loads.pending[0]?.result.resolve(detail("system:0@1"));
    await opening;

    expect(view(model).preview).toBeNull();
    expect(view(model).layer).toBe("items");
  });

  test("切换 session 后迟到的响应被丢弃", async () => {
    const loads = loader();
    const { model } = setup(loads.loadItem);
    model.selectCategory("system");

    const opening = model.openItem("system:0@1");
    model.setSession("ses_two", false);
    loads.pending[0]?.result.resolve(detail("system:0@1"));
    await opening;

    expect(view(model).preview).toBeNull();
    expect(view(model).sessionID).toBe("ses_two");
  });

  test("缺失条目清空预览、记录 notice、恢复焦点并请求刷新", async () => {
    const loads = loader();
    const { model, missing } = setup(loads.loadItem);
    model.selectCategory("system");

    const opening = model.openItem("system:0@1");
    loads.pending[0]?.result.resolve({ kind: "missing" });
    await opening;

    const current = view(model);
    expect(current.preview).toBeNull();
    expect(current.layer).toBe("items");
    expect(current.notice).toBe("previewMissingNotice");
    expect(current.focus).toEqual({ itemId: "system:0@1", fallback: 0 });
    expect(missing).toHaveLength(1);
  });

  test("恢复快照的 404 显示不可预览，不请求刷新", async () => {
    const loads = loader();
    const { model, missing } = setup(loads.loadItem);
    model.setSummary(summary({ restored: true }));
    model.selectCategory("system");

    const opening = model.openItem("system:0@1");
    loads.pending[0]?.result.resolve({ kind: "missing" });
    await opening;

    const current = view(model);
    expect(current.preview).toMatchObject({
      itemId: "system:0@1",
      loading: false,
      error: "previewRestoredUnavailable",
    });
    expect(current.notice).toBeNull();
    expect(missing).toHaveLength(0);
  });

  test("loadItem 直接报告 restored 时显示同一文案", async () => {
    const loads = loader();
    const { model, missing } = setup(loads.loadItem);
    model.selectCategory("system");

    const opening = model.openItem("system:0@1");
    loads.pending[0]?.result.resolve({ kind: "restored" });
    await opening;

    expect(view(model).preview?.error).toBe("previewRestoredUnavailable");
    expect(missing).toHaveLength(0);
  });

  test("读取失败、格式错误和异常分别显示对应错误", async () => {
    for (const [result, error] of [
      [{ kind: "read-error" }, "previewReadError"],
      [{ kind: "bad-format" }, "previewBadFormat"],
    ] as const) {
      const loads = loader();
      const { model } = setup(loads.loadItem);
      model.selectCategory("system");

      const opening = model.openItem("system:0@1");
      loads.pending[0]?.result.resolve(result);
      await opening;

      expect(view(model).preview).toMatchObject({
        itemId: "system:0@1",
        loading: false,
        error,
      });
    }

    const failing = createPanelModel({
      loadItem: () => Promise.reject(new Error("network")),
    });
    failing.setBooted(true);
    failing.setSession("ses_one", false);
    failing.setConnection({ connected: true, version: "1.2.3" });
    failing.setSummary(summary());
    failing.selectCategory("system");
    await failing.openItem("system:0@1");
    expect(failing.getView().preview?.error).toBe("previewReadError");
  });

  test("关闭预览回到条目列表，返回再从列表回到总览", async () => {
    const loads = loader();
    const { model } = setup(loads.loadItem);
    model.selectCategory("system");

    const opening = model.openItem("system:0@1");
    loads.pending[0]?.result.resolve(detail("system:0@1"));
    await opening;
    expect(view(model).layer).toBe("preview");

    model.goBack();
    expect(view(model).layer).toBe("items");
    expect(view(model).preview).toBeNull();

    model.goBack();
    expect(view(model).layer).toBe("overview");
    expect(view(model).selectedCategory).toBeNull();

    model.goBack();
    expect(view(model).layer).toBe("overview");
  });
});

describe("PanelModel 通知与复制状态", () => {
  test("setNotice 设置、去重和清除提示", () => {
    const { model } = setup();
    let calls = 0;
    model.subscribe(() => {
      calls += 1;
    });

    model.setNotice("previewCopied");
    expect(view(model).notice).toBe("previewCopied");
    model.setNotice("previewCopied");
    expect(calls).toBe(1);
    model.setNotice(null);
    expect(view(model).notice).toBeNull();
    expect(calls).toBe(2);
  });

  test("打开条目清掉旧的复制提示", async () => {
    const loads = loader();
    const { model } = setup(loads.loadItem);
    model.selectCategory("system");
    model.setNotice("previewCopied");

    const opening = model.openItem("system:0@1");
    expect(view(model).notice).toBeNull();
    loads.pending[0]?.result.resolve(detail("system:0@1"));
    await opening;
  });

  test("切换 session 清空选择、缩放、预览、焦点和 notice", async () => {
    const loads = loader();
    const { model } = setup(loads.loadItem);
    model.selectCategory("system");
    model.setZoom("fit");
    model.setNotice("previewCopied");
    const opening = model.openItem("system:0@1");

    model.setSession("ses_two", false);
    const current = view(model);
    expect(current.selectedCategory).toBeNull();
    expect(current.zoom).toBe("window");
    expect(current.preview).toBeNull();
    expect(current.focus).toEqual({ itemId: null, fallback: 0 });
    expect(current.notice).toBeNull();

    loads.pending[0]?.result.resolve(detail("system:0@1"));
    await opening;
  });
});

describe("PanelModel 派生数据", () => {
  test("summary 生成 layout、breakdown 和条目", () => {
    const { model } = setup();
    const current = view(model);
    expect(current.layout).not.toBeNull();
    expect(current.layout?.denominator).toBe(200_000);
    expect(current.breakdown?.rows.map((row) => row.category)).toEqual([
      "system",
      "userMessages",
    ]);

    model.selectCategory("userMessages");
    expect(view(model).items.map((item) => item.id)).toEqual(["userMessages:0@1"]);
  });

  test("预览打开时刷新 summary 不丢掉预览", async () => {
    const loads = loader();
    const { model } = setup(loads.loadItem);
    model.selectCategory("system");
    const opening = model.openItem("system:0@1");
    loads.pending[0]?.result.resolve(detail("system:0@1"));
    await opening;

    model.setSummary(summary({ collectedAt: "2026-10-31T10:01:00.000Z" }));
    expect(view(model).preview?.itemId).toBe("system:0@1");
    expect(view(model).layer).toBe("preview");
  });
});
