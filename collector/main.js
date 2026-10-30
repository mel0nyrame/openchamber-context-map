// src/collector/main.ts
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

// src/shared/discovery.ts
import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// src/shared/version.ts
var COLLECTOR_VERSION = "0.1.0";
var DISCOVERY_DIR_ENV = "CONTEXT_MAP_DISCOVERY_DIR";

// src/shared/discovery.ts
function resolveDiscoveryDir(env = process.env) {
  const override = env[DISCOVERY_DIR_ENV]?.trim();
  if (override)
    return override;
  return join(homedir(), ".local", "state", "openchamber-context-map", "collectors");
}
function discoveryFileName(pid) {
  return `collector-${pid}.json`;
}
async function writeDiscovery(dir, record) {
  await mkdir(dir, { recursive: true, mode: 448 });
  await chmod(dir, 448);
  const file = join(dir, discoveryFileName(record.pid));
  const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify(record), { mode: 384 });
  await chmod(temp, 384);
  await rename(temp, file);
  return file;
}
async function removeDiscovery(file) {
  await rm(file, { force: true });
}

// src/shared/types.ts
var CATEGORIES = [
  "system",
  "toolDefinitions",
  "userMessages",
  "assistantText",
  "reasoning",
  "toolCalls",
  "toolResults",
  "other"
];

// src/collector/snapshot.ts
var PREVIEW_LIMIT = 8000;
var HEAD_LIMIT = 200;
var DEFAULT_WINDOW = 200000;
var CHARS_PER_TOKEN = 4;
var TITLE_LIMIT = 80;
var TITLE_SCAN_LIMIT = 400;
function emptyCounts() {
  return Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
}
function titleFor(text, fallback) {
  const line = text.slice(0, TITLE_SCAN_LIMIT).split(`
`).map((value) => value.trim()).find((value) => value.length > 0);
  if (!line)
    return fallback;
  return line.length > TITLE_LIMIT ? `${line.slice(0, TITLE_LIMIT - 1)}…` : line;
}
function categoryForRole(role) {
  if (role === "system")
    return "system";
  if (role === "user")
    return "userMessages";
  if (role === "assistant")
    return "assistantText";
  if (role === "tool")
    return "toolResults";
  return "other";
}
function measureValue(value, previewLimit) {
  let chars = 0;
  let preview = "";
  const append = (text) => {
    chars += text.length;
    if (preview.length < previewLimit) {
      preview += text.slice(0, previewLimit - preview.length);
    }
  };
  const walk = (current, depth) => {
    if (typeof current === "string") {
      append(current);
      return;
    }
    if (current === null || current === undefined)
      return;
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
        append(`
`);
      }
      return;
    }
    for (const [key, item] of Object.entries(current)) {
      append(key);
      append(": ");
      walk(item, depth + 1);
      append(`
`);
    }
  };
  walk(value, 0);
  return { chars, preview: preview.trimEnd() };
}
function modelLabel(ref) {
  const provider = typeof ref.providerID === "string" ? ref.providerID : "";
  const model = typeof ref.modelID === "string" && ref.modelID ? ref.modelID : "unknown";
  return provider ? `${provider}/${model}` : model;
}
function buildDraft(context, collectedAt) {
  const counts = emptyCounts();
  const chars = emptyCounts();
  const items = [];
  let hasMedia = false;
  const add = (category, title, itemChars, preview) => {
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
      text
    });
  };
  for (const [index, part] of (context.system ?? []).entries()) {
    if (!part || part.type !== "text" || typeof part.text !== "string")
      continue;
    add("system", titleFor(part.text, `System ${index + 1}`), part.text.length, part.text);
  }
  for (const [name, tool] of Object.entries(context.tools ?? {})) {
    if (!tool || typeof tool !== "object")
      continue;
    const measured = measureValue(tool, PREVIEW_LIMIT);
    add("toolDefinitions", name, measured.chars, measured.preview);
  }
  for (const message of context.messages ?? []) {
    if (!message || !Array.isArray(message.content))
      continue;
    for (const part of message.content) {
      if (!part || typeof part.type !== "string")
        continue;
      addPart(part, message.role);
    }
  }
  function addPart(part, role) {
    switch (part.type) {
      case "text": {
        if (typeof part.text !== "string")
          return;
        add(categoryForRole(role), titleFor(part.text, "文本"), part.text.length, part.text);
        return;
      }
      case "reasoning": {
        if (typeof part.text !== "string")
          return;
        add("reasoning", titleFor(part.text, "Reasoning"), part.text.length, part.text);
        return;
      }
      case "tool-call": {
        const measured = measureValue(part.input, PREVIEW_LIMIT);
        const name = typeof part.name === "string" && part.name ? part.name : "Tool call";
        const preview = measured.preview ? `${name}
${measured.preview}` : name;
        add("toolCalls", name, name.length + 1 + measured.chars, preview);
        return;
      }
      case "tool-result": {
        const measured = measureValue(part.result, PREVIEW_LIMIT);
        const name = typeof part.name === "string" && part.name ? part.name : "Tool result";
        const preview = measured.preview ? `${name}
${measured.preview}` : name;
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
      modelID: context.model.modelID
    },
    collectedAt,
    items,
    counts,
    chars,
    hasMedia
  };
}
function distribute(raw, target) {
  const total = raw.reduce((sum, value) => sum + value, 0);
  if (total === 0 || target <= 0)
    return raw.map(() => 0);
  const exact = raw.map((value) => value * target / total);
  const tokens = exact.map((value) => Math.floor(value));
  let remainder = target - tokens.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) })).filter(({ index }) => (raw[index] ?? 0) > 0).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0;index < order.length && remainder > 0; index += 1) {
    const slot = order[index].index;
    tokens[slot] = (tokens[slot] ?? 0) + 1;
    remainder -= 1;
  }
  return tokens;
}
function finalizeSnapshot(draft, providerUsed, window, windowAssumed) {
  const raw = CATEGORIES.map((category) => Math.ceil((draft.chars[category] ?? 0) / CHARS_PER_TOKEN));
  const rawTotal = raw.reduce((sum, value) => sum + value, 0);
  const tokens = providerUsed === null ? raw : distribute(raw, providerUsed);
  const categories = CATEGORIES.map((category, index) => ({
    category,
    items: draft.counts[category] ?? 0,
    chars: draft.chars[category] ?? 0,
    tokens: tokens[index] ?? 0
  }));
  return {
    sessionID: draft.sessionID,
    model: draft.model,
    used: providerUsed === null ? rawTotal : providerUsed,
    window,
    windowAssumed,
    estimated: providerUsed === null || draft.hasMedia || rawTotal === 0,
    collectedAt: draft.collectedAt,
    categories,
    items: draft.items.map(({ id, title, chars, head }) => ({ id, title, chars, head }))
  };
}

// src/collector/enrich.ts
function count(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
async function readProviderUsed(context, sessionID) {
  const read = context.session?.context;
  if (!read)
    return null;
  const messages = await read.call(context.session, { sessionID });
  if (!Array.isArray(messages))
    return null;
  for (let index = messages.length - 1;index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.type !== "assistant")
      continue;
    const tokens = message.tokens;
    if (!tokens)
      continue;
    return count(tokens.input) + count(tokens.cache?.read) + count(tokens.cache?.write);
  }
  return null;
}

class WindowResolver {
  context;
  #cache = new Map;
  #loading = null;
  constructor(context) {
    this.context = context;
  }
  async resolve(ref) {
    const key = `${ref.providerID}/${ref.modelID}`;
    const cached = this.#cache.get(key);
    if (cached !== undefined)
      return { window: cached, assumed: false };
    await this.#load();
    const loaded = this.#cache.get(key);
    if (loaded !== undefined)
      return { window: loaded, assumed: false };
    return { window: DEFAULT_WINDOW, assumed: true };
  }
  #load() {
    if (this.#loading)
      return this.#loading;
    const loading = (async () => {
      const list = this.context.model?.list;
      if (!list)
        return;
      const output = await list.call(this.context.model);
      const models = Array.isArray(output) ? output : output?.data;
      if (!Array.isArray(models))
        return;
      for (const value of models) {
        if (!value || typeof value !== "object")
          continue;
        const model = value;
        const window = model.limit?.context;
        if (typeof model.providerID !== "string" || typeof model.modelID !== "string" || typeof window !== "number" || !Number.isFinite(window) || window <= 0) {
          continue;
        }
        this.#cache.set(`${model.providerID}/${model.modelID}`, window);
      }
    })().then(() => {
      this.#loading = null;
    }, () => {
      this.#loading = null;
    });
    this.#loading = loading;
    return loading;
  }
}
async function enrichSnapshot(context, store, windows, record) {
  const { draft, id } = record;
  const [used, window] = await Promise.all([
    readProviderUsed(context, draft.sessionID).catch(() => null),
    windows.resolve(draft.modelRef).catch(() => ({ window: DEFAULT_WINDOW, assumed: true }))
  ]);
  store.replace(draft.sessionID, id, finalizeSnapshot(draft, used, window.window, window.assumed));
}

// src/collector/store.ts
var MAX_SESSIONS = 20;

class SnapshotStore {
  #records = new Map;
  #nextId = 1;
  add(draft) {
    const record = {
      id: this.#nextId,
      draft,
      summary: finalizeSnapshot(draft, null, DEFAULT_WINDOW, true)
    };
    this.#nextId += 1;
    this.#records.delete(draft.sessionID);
    this.#records.set(draft.sessionID, record);
    while (this.#records.size > MAX_SESSIONS) {
      const oldest = this.#records.keys().next();
      if (oldest.done)
        break;
      this.#records.delete(oldest.value);
    }
    return record;
  }
  get(sessionID) {
    return this.#records.get(sessionID);
  }
  replace(sessionID, id, summary) {
    const current = this.#records.get(sessionID);
    if (!current || current.id !== id)
      return;
    this.#records.set(sessionID, { ...current, summary });
  }
  get size() {
    return this.#records.size;
  }
}

// src/collector/main.ts
function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}
function listen(server) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Collector 未能取得监听端口"));
        return;
      }
      resolve(address.port);
    });
  });
}
function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
var collector = {
  id: "context-map-collector",
  async setup(rawContext) {
    const context = rawContext ?? {};
    const token = randomBytes(32).toString("hex");
    const store = new SnapshotStore;
    const windows = new WindowResolver(context);
    const hook = context.session?.hook ? await context.session.hook("context", (sessionContext) => {
      const record = store.add(buildDraft(sessionContext, new Date().toISOString()));
      enrichSnapshot(context, store, windows, record).catch(() => {});
    }) : null;
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const path = url.pathname;
      if (request.method === "GET" && path === "/health") {
        sendJson(response, 200, { ok: true, version: COLLECTOR_VERSION });
        return;
      }
      if (request.method === "GET" && (path === "/summary" || path === "/item")) {
        if (request.headers.authorization !== `Bearer ${token}`) {
          sendJson(response, 401, { error: "unauthorized" });
          return;
        }
        const sessionID = url.searchParams.get("sessionID");
        if (!sessionID) {
          sendJson(response, 400, { error: "bad_request" });
          return;
        }
        const itemId = path === "/item" ? url.searchParams.get("itemId") : null;
        if (path === "/item" && !itemId) {
          sendJson(response, 400, { error: "bad_request" });
          return;
        }
        const record = store.get(sessionID);
        if (!record) {
          sendJson(response, 404, { error: "not_found" });
          return;
        }
        if (path === "/summary") {
          sendJson(response, 200, record.summary);
          return;
        }
        const item = record.draft.items.find((candidate) => candidate.id === itemId);
        if (!item) {
          sendJson(response, 404, { error: "not_found" });
          return;
        }
        const detail = {
          id: item.id,
          title: item.title,
          chars: item.chars,
          text: item.text
        };
        sendJson(response, 200, detail);
        return;
      }
      sendJson(response, 404, { error: "not_found" });
    });
    let port;
    try {
      port = await listen(server);
    } catch (error) {
      await hook?.dispose();
      throw error;
    }
    const record = {
      version: COLLECTOR_VERSION,
      port,
      token,
      pid: process.pid,
      startedAt: new Date().toISOString()
    };
    let discoveryFile;
    try {
      discoveryFile = await writeDiscovery(resolveDiscoveryDir(), record);
    } catch (error) {
      await hook?.dispose();
      await close(server);
      throw error;
    }
    return async () => {
      try {
        await hook?.dispose();
      } finally {
        try {
          await close(server);
        } finally {
          await removeDiscovery(discoveryFile);
        }
      }
    };
  }
};
var main_default = collector;
export {
  main_default as default
};
