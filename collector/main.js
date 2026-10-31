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
var tempSequence = 0;
async function writeDiscovery(dir, record) {
  await mkdir(dir, { recursive: true, mode: 448 });
  await chmod(dir, 448);
  const file = join(dir, discoveryFileName(record.pid));
  tempSequence += 1;
  const temp = `${file}.${process.pid}.${tempSequence}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(record), { mode: 384 });
    await chmod(temp, 384);
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
  return file;
}
async function removeDiscovery(file) {
  await rm(file, { force: true });
}

// src/collector/opencode.ts
function modelRefID(ref) {
  if (!ref)
    return "";
  if (typeof ref.id === "string" && ref.id)
    return ref.id;
  if (typeof ref.modelID === "string" && ref.modelID)
    return ref.modelID;
  return "";
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
  const model = modelRefID(ref) || "unknown";
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
      modelID: modelRefID(context.model)
    },
    collectedAt,
    items,
    counts,
    chars,
    hasMedia
  };
}
function baselineDraft(draft) {
  const counts = emptyCounts();
  const chars = emptyCounts();
  const items = draft.items.filter((item) => item.category === "system" || item.category === "toolDefinitions");
  for (const item of items) {
    counts[item.category] += 1;
    chars[item.category] += item.chars;
  }
  return { ...draft, items, counts, chars, hasMedia: false };
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
  const tokens = providerUsed === null ? raw : rawTotal === 0 ? raw.map((_, index) => CATEGORIES[index] === "other" ? providerUsed : 0) : distribute(raw, providerUsed);
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
    baseline: false,
    restored: false,
    collectedAt: draft.collectedAt,
    categories,
    items: draft.items.map(({ id, title, chars, head }) => ({ id, title, chars, head }))
  };
}

// src/collector/baseline.ts
var MAX_BASELINES = 5;
var BASELINE_CATEGORIES = ["system", "toolDefinitions"];
function baselineKey(agent, ref) {
  return `${agent}\x00${ref.providerID}/${modelRefID(ref)}`;
}

class BaselineStore {
  #templates = new Map;
  remember(agent, draft) {
    const key = baselineKey(agent, draft.modelRef);
    this.#templates.delete(key);
    this.#templates.set(key, {
      agent,
      model: draft.model,
      modelRef: draft.modelRef,
      collectedAt: draft.collectedAt,
      items: draft.items
    });
    while (this.#templates.size > MAX_BASELINES) {
      const oldest = this.#templates.keys().next().value;
      if (oldest === undefined)
        break;
      this.#templates.delete(oldest);
    }
  }
  get(agent, ref) {
    return this.#templates.get(baselineKey(agent, ref));
  }
  get size() {
    return this.#templates.size;
  }
}
function baselineSummary(template, sessionID, window, windowAssumed) {
  const categories = BASELINE_CATEGORIES.map((category) => {
    const items = template.items.filter((item) => item.category === category);
    const chars = items.reduce((sum, item) => sum + item.chars, 0);
    return {
      category,
      items: items.length,
      chars,
      tokens: Math.ceil(chars / CHARS_PER_TOKEN)
    };
  });
  const used = categories.reduce((sum, category) => sum + category.tokens, 0);
  return {
    sessionID,
    model: template.model,
    used,
    window,
    windowAssumed,
    estimated: true,
    baseline: true,
    restored: false,
    collectedAt: template.collectedAt,
    categories,
    items: template.items.map(({ id, title, chars, head }) => ({ id, title, chars, head }))
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
    const key = `${ref.providerID}/${modelRefID(ref)}`;
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
        if (typeof model.providerID !== "string" || typeof window !== "number" || !Number.isFinite(window) || window <= 0) {
          continue;
        }
        for (const id of new Set([model.id, model.modelID])) {
          if (typeof id === "string" && id) {
            this.#cache.set(`${model.providerID}/${id}`, window);
          }
        }
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
  if (!draft)
    return;
  const [used, window] = await Promise.all([
    readProviderUsed(context, draft.sessionID).catch(() => null),
    windows.resolve(draft.modelRef).catch(() => ({ window: DEFAULT_WINDOW, assumed: true }))
  ]);
  return store.replace(draft.sessionID, id, finalizeSnapshot(draft, used, window.window, window.assumed));
}

// src/collector/persist.ts
import { chmod as chmod2, mkdir as mkdir2, readdir as readdir2, readFile as readFile2, rename as rename2, rm as rm2, stat, writeFile as writeFile2 } from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { join as join2 } from "node:path";

// src/shared/snapshot.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isCategory(value) {
  return typeof value === "string" && CATEGORIES.includes(value);
}
function parseCategoryUsage(value) {
  if (!isRecord(value))
    return null;
  const { category, items, chars, tokens } = value;
  if (!isCategory(category) || !isFiniteNumber(items) || !isFiniteNumber(chars) || !isFiniteNumber(tokens)) {
    return null;
  }
  return { category, items, chars, tokens };
}
function parseItemSummary(value) {
  if (!isRecord(value))
    return null;
  const { id, title, chars, head } = value;
  if (typeof id !== "string" || typeof title !== "string" || !isFiniteNumber(chars) || typeof head !== "string") {
    return null;
  }
  return { id, title, chars, head };
}
function parseSnapshotSummary(value) {
  if (!isRecord(value))
    return null;
  const {
    sessionID,
    model,
    used,
    window,
    windowAssumed,
    estimated,
    baseline,
    collectedAt
  } = value;
  if (typeof sessionID !== "string" || sessionID.length === 0 || typeof model !== "string" || !isFiniteNumber(used) || !isFiniteNumber(window) || typeof windowAssumed !== "boolean" || typeof estimated !== "boolean" || typeof baseline !== "boolean" || typeof collectedAt !== "string" || !Number.isFinite(Date.parse(collectedAt))) {
    return null;
  }
  const rawCategories = value.categories;
  if (!Array.isArray(rawCategories) || rawCategories.length < 1 || rawCategories.length > CATEGORIES.length) {
    return null;
  }
  const categories = [];
  for (const entry of rawCategories) {
    const category = parseCategoryUsage(entry);
    if (!category)
      return null;
    categories.push(category);
  }
  if (new Set(categories.map((entry) => entry.category)).size !== categories.length) {
    return null;
  }
  const rawItems = value.items;
  if (!Array.isArray(rawItems))
    return null;
  const items = [];
  for (const entry of rawItems) {
    const item = parseItemSummary(entry);
    if (!item)
      return null;
    items.push(item);
  }
  return {
    sessionID,
    model,
    used,
    window,
    windowAssumed,
    estimated,
    baseline,
    restored: value.restored === true,
    collectedAt,
    categories,
    items
  };
}

// src/collector/persist.ts
var SNAPSHOT_SCHEMA_VERSION = 1;
var MAX_SNAPSHOTS = 20;
var MAX_SNAPSHOT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
var SNAPSHOT_WRITE_DELAY_MS = 300;
var PERSIST_ENV = "CONTEXT_MAP_PERSIST";
var SNAPSHOT_DIR_ENV = "CONTEXT_MAP_SNAPSHOT_DIR";
function persistenceEnabled(env = process.env) {
  const value = env[PERSIST_ENV]?.trim().toLowerCase();
  return value !== "0" && value !== "false" && value !== "off";
}
function resolveSnapshotDir(env = process.env) {
  const override = env[SNAPSHOT_DIR_ENV]?.trim();
  if (override)
    return override;
  const discovery = env[DISCOVERY_DIR_ENV]?.trim();
  if (discovery)
    return join2(discovery, "snapshots");
  return join2(homedir2(), ".local", "state", "openchamber-context-map", "snapshots");
}
function snapshotFileName(sessionID) {
  return `${sessionID.replace(/[^A-Za-z0-9._-]/g, "_")}.json`;
}
async function readSnapshotFile(file) {
  try {
    const value = JSON.parse(await readFile2(file, "utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value))
      return null;
    const record = value;
    if (record.schemaVersion !== SNAPSHOT_SCHEMA_VERSION)
      return null;
    const summary = parseSnapshotSummary(record.summary);
    if (!summary || summary.categories.length !== CATEGORIES.length)
      return null;
    return summary;
  } catch {
    return null;
  }
}
async function readSnapshots(dir, now = Date.now()) {
  let names;
  try {
    names = await readdir2(dir);
  } catch {
    return [];
  }
  const kept = [];
  for (const name of names) {
    if (!name.endsWith(".json"))
      continue;
    const file = join2(dir, name);
    const summary = await readSnapshotFile(file);
    if (!summary || now - Date.parse(summary.collectedAt) > MAX_SNAPSHOT_AGE_MS) {
      await rm2(file, { force: true });
      continue;
    }
    kept.push({ summary, file });
  }
  kept.sort((a, b) => Date.parse(b.summary.collectedAt) - Date.parse(a.summary.collectedAt));
  for (const extra of kept.slice(MAX_SNAPSHOTS)) {
    await rm2(extra.file, { force: true });
  }
  return kept.slice(0, MAX_SNAPSHOTS).map((entry) => entry.summary);
}
var tempSequence2 = 0;
async function writeSnapshot(dir, summary) {
  await mkdir2(dir, { recursive: true, mode: 448 });
  await chmod2(dir, 448);
  const file = join2(dir, snapshotFileName(summary.sessionID));
  const body = JSON.stringify({ schemaVersion: SNAPSHOT_SCHEMA_VERSION, summary });
  tempSequence2 += 1;
  const temp = `${file}.${process.pid}.${tempSequence2}.tmp`;
  try {
    await writeFile2(temp, body, { mode: 384 });
    await chmod2(temp, 384);
    await rename2(temp, file);
  } catch (error) {
    await rm2(temp, { force: true });
    throw error;
  }
}
async function pruneSnapshots(dir) {
  let names;
  try {
    names = await readdir2(dir);
  } catch {
    return;
  }
  const files = [];
  for (const name of names) {
    if (!name.endsWith(".json"))
      continue;
    const file = join2(dir, name);
    try {
      const info = await stat(file);
      files.push({ file, mtime: info.mtimeMs });
    } catch {}
  }
  files.sort((a, b) => b.mtime - a.mtime);
  for (const extra of files.slice(MAX_SNAPSHOTS)) {
    await rm2(extra.file, { force: true });
  }
}

class SnapshotWriter {
  dir;
  #timers = new Map;
  #pending = new Map;
  constructor(dir) {
    this.dir = dir;
  }
  schedule(summary) {
    if (!this.dir)
      return;
    this.#pending.set(summary.sessionID, summary);
    const existing = this.#timers.get(summary.sessionID);
    if (existing)
      clearTimeout(existing);
    const timer = setTimeout(() => {
      this.#flushOne(summary.sessionID);
    }, SNAPSHOT_WRITE_DELAY_MS);
    timer.unref?.();
    this.#timers.set(summary.sessionID, timer);
  }
  async flush() {
    await Promise.all([...this.#pending.keys()].map((sessionID) => this.#flushOne(sessionID)));
  }
  async dispose() {
    for (const timer of this.#timers.values())
      clearTimeout(timer);
    this.#timers.clear();
    await this.flush();
  }
  async#flushOne(sessionID) {
    const timer = this.#timers.get(sessionID);
    if (timer)
      clearTimeout(timer);
    this.#timers.delete(sessionID);
    const summary = this.#pending.get(sessionID);
    this.#pending.delete(sessionID);
    if (!this.dir || !summary)
      return;
    try {
      await writeSnapshot(this.dir, summary);
      await pruneSnapshots(this.dir);
    } catch {}
  }
}

// src/collector/store.ts
var MAX_SESSIONS = 20;

class SnapshotStore {
  #records = new Map;
  #nextId = 1;
  add(draft) {
    const id = this.#nextId;
    this.#nextId += 1;
    const stamped = {
      ...draft,
      items: draft.items.map((item) => ({ ...item, id: `${item.id}@${id}` }))
    };
    const record = {
      id,
      draft: stamped,
      summary: finalizeSnapshot(stamped, null, DEFAULT_WINDOW, true)
    };
    this.#records.delete(draft.sessionID);
    this.#records.set(draft.sessionID, record);
    this.#trim();
    return record;
  }
  restore(summary) {
    const id = this.#nextId;
    this.#nextId += 1;
    const record = {
      id,
      draft: null,
      summary: { ...summary, restored: true }
    };
    this.#records.delete(summary.sessionID);
    this.#records.set(summary.sessionID, record);
    this.#trim();
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
    return summary;
  }
  get size() {
    return this.#records.size;
  }
  #trim() {
    while (this.#records.size > MAX_SESSIONS) {
      const oldest = this.#records.keys().next();
      if (oldest.done)
        break;
      this.#records.delete(oldest.value);
    }
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
    const baselines = new BaselineStore;
    const windows = new WindowResolver(context);
    const persistDir = persistenceEnabled() ? resolveSnapshotDir() : null;
    const writer = new SnapshotWriter(persistDir);
    if (persistDir) {
      for (const summary of await readSnapshots(persistDir).catch(() => [])) {
        store.restore(summary);
      }
    }
    const hook = context.session?.hook ? await context.session.hook("context", (sessionContext) => {
      const draft = buildDraft(sessionContext, new Date().toISOString());
      if (typeof sessionContext.agent === "string" && sessionContext.agent) {
        baselines.remember(sessionContext.agent, baselineDraft(draft));
      }
      const record = store.add(draft);
      enrichSnapshot(context, store, windows, record).then((summary) => {
        if (summary)
          writer.schedule(summary);
      }).catch(() => {});
    }) : null;
    const resolveBaselineTemplate = async (sessionID) => {
      const get = context.session?.get;
      if (!get)
        return null;
      let info;
      try {
        info = await get.call(context.session, { sessionID });
      } catch {
        return null;
      }
      const agent = typeof info?.agent === "string" ? info.agent : "";
      const ref = info?.model;
      if (!agent || !ref || typeof ref.providerID !== "string" || !modelRefID(ref)) {
        return null;
      }
      return baselines.get(agent, ref) ?? null;
    };
    const server = createServer(async (request, response) => {
      try {
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
          if (path === "/summary") {
            if (record) {
              sendJson(response, 200, record.summary);
              return;
            }
            const template = await resolveBaselineTemplate(sessionID);
            if (!template) {
              sendJson(response, 404, { error: "not_found" });
              return;
            }
            const resolved = await windows.resolve(template.modelRef).catch(() => ({ window: DEFAULT_WINDOW, assumed: true }));
            sendJson(response, 200, baselineSummary(template, sessionID, resolved.window, resolved.assumed));
            return;
          }
          const items = record ? record.draft?.items : (await resolveBaselineTemplate(sessionID))?.items;
          const item = items?.find((candidate) => candidate.id === itemId);
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
      } catch {
        if (!response.headersSent) {
          sendJson(response, 500, { error: "internal" });
        } else {
          response.end();
        }
      }
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
          try {
            await writer.dispose();
          } finally {
            await removeDiscovery(discoveryFile);
          }
        }
      }
    };
  }
};
var main_default = collector;
export {
  main_default as default
};
