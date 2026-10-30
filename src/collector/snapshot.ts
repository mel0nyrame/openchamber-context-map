import {
  CATEGORIES,
  type Category,
  type CategoryUsage,
  type ItemSummary,
  type SnapshotSummary,
} from "../shared/types.ts";
import { modelRefID, type ContentPart, type ModelRef, type SessionContext } from "./opencode.ts";

/** 单条预览上限；原始 payload 在 hook 返回后即丢弃。 */
export const PREVIEW_LIMIT = 8_000;
/** 条目在 /summary 中的摘要上限。 */
export const HEAD_LIMIT = 200;
/** 模型窗口未知时的默认值。 */
export const DEFAULT_WINDOW = 200_000;

export const CHARS_PER_TOKEN = 4;
const TITLE_LIMIT = 80;
const TITLE_SCAN_LIMIT = 400;

export interface SnapshotItem extends ItemSummary {
  category: Category;
  text: string;
}

export interface SnapshotDraft {
  sessionID: string;
  model: string;
  modelRef: ModelRef;
  collectedAt: string;
  items: SnapshotItem[];
  counts: Record<Category, number>;
  chars: Record<Category, number>;
  hasMedia: boolean;
}

function emptyCounts(): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<Category, number>;
}

function titleFor(text: string, fallback: string): string {
  const line = text
    .slice(0, TITLE_SCAN_LIMIT)
    .split("\n")
    .map((value) => value.trim())
    .find((value) => value.length > 0);
  if (!line) return fallback;
  return line.length > TITLE_LIMIT ? `${line.slice(0, TITLE_LIMIT - 1)}…` : line;
}

function categoryForRole(role: string): Category {
  if (role === "system") return "system";
  if (role === "user") return "userMessages";
  if (role === "assistant") return "assistantText";
  if (role === "tool") return "toolResults";
  return "other";
}

/**
 * 不调用 JSON.stringify 的字符计数与预览收集。
 * 只遍历普通对象和数组，达到预览上限后仍继续计数，但不再复制字符串。
 */
export function measureValue(value: unknown, previewLimit: number): { chars: number; preview: string } {
  let chars = 0;
  let preview = "";

  const append = (text: string): void => {
    chars += text.length;
    if (preview.length < previewLimit) {
      preview += text.slice(0, previewLimit - preview.length);
    }
  };

  const walk = (current: unknown, depth: number): void => {
    if (typeof current === "string") {
      append(current);
      return;
    }
    if (current === null || current === undefined) return;
    if (typeof current !== "object") {
      append(String(current));
      return;
    }
    if (depth >= 8) {
      append("…");
      return;
    }
    if (Array.isArray(current)) {
      for (const item of current) {
        walk(item, depth + 1);
        append("\n");
      }
      return;
    }
    for (const [key, item] of Object.entries(current)) {
      append(key);
      append(": ");
      walk(item, depth + 1);
      append("\n");
    }
  };

  walk(value, 0);
  return { chars, preview: preview.trimEnd() };
}

export function modelLabel(ref: ModelRef): string {
  const provider = typeof ref.providerID === "string" ? ref.providerID : "";
  const model = modelRefID(ref) || "unknown";
  return provider ? `${provider}/${model}` : model;
}

/** 同步构建快照；hook 回调里只做这一件事。 */
export function buildDraft(context: SessionContext, collectedAt: string): SnapshotDraft {
  const counts = emptyCounts();
  const chars = emptyCounts();
  const items: SnapshotItem[] = [];
  let hasMedia = false;

  const add = (category: Category, title: string, itemChars: number, preview: string): void => {
    const index = counts[category];
    counts[category] = index + 1;
    chars[category] = (chars[category] ?? 0) + itemChars;
    const text = preview.length > PREVIEW_LIMIT ? preview.slice(0, PREVIEW_LIMIT) : preview;
    items.push({
      id: `${category}:${index}`,
      category,
      title: title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT - 1)}…` : title,
      chars: itemChars,
      head: text.slice(0, HEAD_LIMIT),
      text,
    });
  };

  for (const [index, part] of (context.system ?? []).entries()) {
    if (!part || part.type !== "text" || typeof part.text !== "string") continue;
    add("system", titleFor(part.text, `System ${index + 1}`), part.text.length, part.text);
  }

  for (const [name, tool] of Object.entries(context.tools ?? {})) {
    if (!tool || typeof tool !== "object") continue;
    const measured = measureValue(tool, PREVIEW_LIMIT);
    add("toolDefinitions", name, measured.chars, measured.preview);
  }

  for (const message of context.messages ?? []) {
    if (!message || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (!part || typeof part.type !== "string") continue;
      addPart(part, message.role);
    }
  }

  function addPart(part: ContentPart, role: string): void {
    switch (part.type) {
      case "text": {
        if (typeof part.text !== "string") return;
        add(categoryForRole(role), titleFor(part.text, "文本"), part.text.length, part.text);
        return;
      }
      case "reasoning": {
        if (typeof part.text !== "string") return;
        add("reasoning", titleFor(part.text, "Reasoning"), part.text.length, part.text);
        return;
      }
      case "tool-call": {
        const measured = measureValue(part.input, PREVIEW_LIMIT);
        const name = typeof part.name === "string" && part.name ? part.name : "Tool call";
        const preview = measured.preview ? `${name}\n${measured.preview}` : name;
        add("toolCalls", name, name.length + 1 + measured.chars, preview);
        return;
      }
      case "tool-result": {
        const measured = measureValue(part.result, PREVIEW_LIMIT);
        const name = typeof part.name === "string" && part.name ? part.name : "Tool result";
        const preview = measured.preview ? `${name}\n${measured.preview}` : name;
        add("toolResults", name, name.length + 1 + measured.chars, preview);
        return;
      }
      case "media": {
        hasMedia = true;
        const filename = typeof part.filename === "string" && part.filename ? part.filename : "";
        add("other", filename ? `媒体 · ${filename}` : "媒体", 0, "");
        return;
      }
      case "compaction": {
        // 加密摘要没有可读明文，按 0 字符计，避免把元数据算进上下文。
        if (part.encrypted === true) {
          add("other", "压缩摘要（加密）", 0, "");
          return;
        }
        const text = typeof part.text === "string" ? part.text : "";
        add("other", "压缩摘要", text.length, text);
        return;
      }
      case "effort": {
        const effort = typeof part.effort === "string" && part.effort ? part.effort : "";
        add("other", effort ? `推理强度 · ${effort}` : "推理强度", 0, "");
        return;
      }
      default: {
        const measured = measureValue(part, PREVIEW_LIMIT);
        add("other", part.type, measured.chars, measured.preview);
      }
    }
  }

  return {
    sessionID: context.sessionID,
    model: modelLabel(context.model),
    modelRef: {
      providerID: context.model.providerID,
      modelID: modelRefID(context.model),
    },
    collectedAt,
    items,
    counts,
    chars,
    hasMedia,
  };
}

/** 只保留 system 与工具定义，作为首请求前的基线模板。 */
export function baselineDraft(draft: SnapshotDraft): SnapshotDraft {
  const counts = emptyCounts();
  const chars = emptyCounts();
  const items = draft.items.filter(
    (item) => item.category === "system" || item.category === "toolDefinitions",
  );
  for (const item of items) {
    counts[item.category] += 1;
    chars[item.category] += item.chars;
  }
  return { ...draft, items, counts, chars, hasMedia: false };
}

function distribute(raw: number[], target: number): number[] {
  const total = raw.reduce((sum, value) => sum + value, 0);
  if (total === 0 || target <= 0) return raw.map(() => 0);

  const exact = raw.map((value) => (value * target) / total);
  const tokens = exact.map((value) => Math.floor(value));
  let remainder = target - tokens.reduce((sum, value) => sum + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .filter(({ index }) => (raw[index] ?? 0) > 0)
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let index = 0; index < order.length && remainder > 0; index += 1) {
    const slot = order[index]!.index;
    tokens[slot] = (tokens[slot] ?? 0) + 1;
    remainder -= 1;
  }
  return tokens;
}

/**
 * 把字符估算缩放到 provider 的 Used；没有 provider 值时直接用估算值。
 * 有 media 时无法估算其 token，整份标记 estimated。
 */
export function finalizeSnapshot(
  draft: SnapshotDraft,
  providerUsed: number | null,
  window: number,
  windowAssumed: boolean,
): SnapshotSummary {
  const raw = CATEGORIES.map((category) => Math.ceil((draft.chars[category] ?? 0) / CHARS_PER_TOKEN));
  const rawTotal = raw.reduce((sum, value) => sum + value, 0);
  const tokens = providerUsed === null
    ? raw
    : rawTotal === 0
      // 全是 media、effort 这类不计字符的内容：把 provider 的用量记到 other，保持分类和等于 Used。
      ? raw.map((_, index) => (CATEGORIES[index] === "other" ? providerUsed : 0))
      : distribute(raw, providerUsed);

  const categories: CategoryUsage[] = CATEGORIES.map((category, index) => ({
    category,
    items: draft.counts[category] ?? 0,
    chars: draft.chars[category] ?? 0,
    tokens: tokens[index] ?? 0,
  }));

  return {
    sessionID: draft.sessionID,
    model: draft.model,
    used: providerUsed === null ? rawTotal : providerUsed,
    window,
    windowAssumed,
    estimated: providerUsed === null || draft.hasMedia || rawTotal === 0,
    baseline: false,
    collectedAt: draft.collectedAt,
    categories,
    items: draft.items.map(({ id, title, chars, head }) => ({ id, title, chars, head })),
  };
}
