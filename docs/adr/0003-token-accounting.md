# Token 口径：估算占比 + provider 校准

`hook("context")` 的事件里没有任何 usage 字段，只有组装后的内容，所以分类 token 只能按 `ceil(characters / 4)` 估算。Used 不用估算值直接当结论：取同一 session 最近一条 assistant 的 `tokens`，用 `input + cache.read + cache.write` 作为真实输入总量，再把各分类的估算 token 按比例缩放到这个总量。`input` 本身不含 cache（`@opencode/schema/dist/token-usage.js:12-14`），只读 `input` 会低估。没有 provider 值、或快照里含 `media` 时，整个快照标为 estimated。

**Considered Options**

- 纯估算：实现最简单，但误差随内容类型漂移，用户无法判断可信度。
- 在 hook 里 `await ctx.session.context()` 取 usage：hook 在 provider dispatch 前被逐个 await，会把磁盘读取的延迟加到每次模型请求上，且拿到的仍是上一轮的值。

**Consequences**

tool continuation 场景下 Used 滞后一轮，误差约为上一轮的 assistant 输出加一条 tool result。图片按 0 token 计，多图时整体标 estimated。补齐时机与取整方式见 `docs/adr/0005-snapshot-enrichment.md`。
