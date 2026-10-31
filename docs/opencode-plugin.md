# OpenCode V2 插件接口

Collector 以 OpenCode V2 插件形式运行。这里记录实现依赖的接口事实，避免每个 ticket 重新翻类型声明。

核对日期：2026-10-31。类型来源是 `@opencode/plugin@2.2.5`、`@opencode/schema@2.2.5`、`@opencode/ai@2.2.5`，行为来源是本机 `opencode v2.2.5`。本机没有 OpenCode 源码 checkout，CLI 是编译后的二进制，所以接口事实以发布到 npm 的类型声明为准。

下文每条来源写成 `包@版本/路径:行号`；在前面加 `https://unpkg.com/` 就能打开原文，例如 `https://unpkg.com/@opencode/plugin@2.2.5/dist/promise/plugin.d.ts`。行号对应该版本，升级 OpenCode 后需要重新核对。

## 插件对象

```ts
interface Plugin {
  readonly id: string;
  readonly setup: (context: Context) => Promise<Cleanup | void> | Cleanup | void;
}
```

默认导出 `{ id, setup }`。`setup()` 返回的 cleanup 在插件卸载时调用，hook 注册要在那里 dispose。来源：`@opencode/plugin@2.2.5/dist/promise/plugin.d.ts:61-63`。

## hook 注册

```ts
ctx.session.hook(name, callback, options?) => Promise<{ dispose(): Promise<void> }>
```

`"context"` 在请求发往 provider 之前触发，回调被逐个 await，位于请求路径上，回调里做 I/O 会把延迟加到每次模型请求。`options.providerID` 把 hook 限定到单个 provider。来源：`@opencode/plugin@2.2.5/dist/promise/session.d.ts:33-41`、`registration.d.ts:1-9`。

`SessionContext` 字段：`sessionID`、`model`（`Model.Ref`）、`system`（`SystemPart[]`）、`messages`（`Message[]`）、`options`、`agent`、`tools`（`Record<string, { description, input }>`）。没有 usage 字段。

## 内容与 token

- `ContentPart` 七种：`text`、`media`、`tool-call`、`tool-result`、`reasoning`、`compaction`、`effort`。`@opencode/ai@2.2.5/dist/schema/messages.d.ts:286-426`。
- `SessionMessage.Assistant.tokens` 可选：`{ input, output, reasoning, cache: { read, write } }`。`@opencode/schema@2.2.5/dist/session-message.d.ts:1104-1114`。
- `total(tokens) = input + output + reasoning + cache.read + cache.write`，且 `input` 不含 cache。`@opencode/schema@2.2.5/dist/token-usage.js:12-13`。
- `ctx.session.context({ sessionID })` 返回 `SessionMessageInfo[]`，assistant 与 compaction 带 `tokens`。这是异步调用，不要放进 `context` hook。

## 模型与窗口

- `SessionContext.model` 是 `Model.Ref`：`{ id, providerID, variant? }`。`modelID` 只出现在 `Model.Info` 与旧夹具里；读取时用 `modelRefID()`（`src/collector/opencode.ts`），它先取 `id` 再回退 `modelID`。来源：`@opencode/schema@2.2.5/dist/model.d.ts:95-103`。
- `ctx.model.list()` 是异步调用，返回 `{ data: ModelInfo[] }`；`Model.Info.limit.context` 必填。窗口值在 hook 之外取并缓存。来源：`@opencode/schema@2.2.5/dist/model.d.ts:413-417`。
