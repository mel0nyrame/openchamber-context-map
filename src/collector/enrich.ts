import type { ModelInfo, ModelRef, PluginContext, SessionMessageInfo } from "./opencode.ts";
import { DEFAULT_WINDOW, finalizeSnapshot } from "./snapshot.ts";
import type { SnapshotStore, StoredSnapshot } from "./store.ts";

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Used 取同 session 最近一条 assistant 的 input + cache.read + cache.write。
 * output 与 reasoning 不计入。
 */
export async function readProviderUsed(
  context: PluginContext,
  sessionID: string,
): Promise<number | null> {
  const read = context.session?.context;
  if (!read) return null;

  const messages = await read.call(context.session, { sessionID });
  if (!Array.isArray(messages)) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as SessionMessageInfo | undefined;
    if (!message || message.type !== "assistant") continue;
    const tokens = message.tokens;
    if (!tokens) continue;
    return count(tokens.input) + count(tokens.cache?.read) + count(tokens.cache?.write);
  }
  return null;
}

/** 模型窗口按 model.list() 缓存；查询失败不缓存，退回 200000 并标记 assumed。 */
export class WindowResolver {
  readonly #cache = new Map<string, number>();
  #loading: Promise<void> | null = null;

  constructor(private readonly context: PluginContext) {}

  async resolve(ref: ModelRef): Promise<{ window: number; assumed: boolean }> {
    const key = `${ref.providerID}/${ref.modelID}`;
    const cached = this.#cache.get(key);
    if (cached !== undefined) return { window: cached, assumed: false };

    await this.#load();
    const loaded = this.#cache.get(key);
    if (loaded !== undefined) return { window: loaded, assumed: false };
    return { window: DEFAULT_WINDOW, assumed: true };
  }

  #load(): Promise<void> {
    if (this.#loading) return this.#loading;

    const loading = (async () => {
      const list = this.context.model?.list;
      if (!list) return;
      const output = await list.call(this.context.model);
      const models = Array.isArray(output)
        ? output
        : (output as { data?: unknown } | null | undefined)?.data;
      if (!Array.isArray(models)) return;

      for (const value of models) {
        if (!value || typeof value !== "object") continue;
        const model = value as ModelInfo;
        const window = model.limit?.context;
        if (
          typeof model.providerID !== "string"
          || typeof model.modelID !== "string"
          || typeof window !== "number"
          || !Number.isFinite(window)
          || window <= 0
        ) {
          continue;
        }
        this.#cache.set(`${model.providerID}/${model.modelID}`, window);
      }
    })().then(
      () => { this.#loading = null; },
      () => { this.#loading = null; },
    );

    this.#loading = loading;
    return loading;
  }
}

/** 快照先落内存，这里只做异步补齐；迟到的结果不会覆盖更新的快照。 */
export async function enrichSnapshot(
  context: PluginContext,
  store: SnapshotStore,
  windows: WindowResolver,
  record: StoredSnapshot,
): Promise<void> {
  const { draft, id } = record;
  const [used, window] = await Promise.all([
    readProviderUsed(context, draft.sessionID).catch(() => null),
    windows.resolve(draft.modelRef).catch(() => ({ window: DEFAULT_WINDOW, assumed: true })),
  ]);

  store.replace(
    draft.sessionID,
    id,
    finalizeSnapshot(draft, used, window.window, window.assumed),
  );
}
