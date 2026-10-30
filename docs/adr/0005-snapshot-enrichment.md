# 快照先落内存，异步补齐并保序缩放

`context` hook 在请求路径上被 await，所以 Collector 在回调里只做同步工作：分类、字符计数、切片，写一份 draft 快照。provider 的 Used 与模型窗口都要异步查询（`ctx.session.context()`、`ctx.model.list()`），放在 hook 返回之后补齐。每条快照带单调递增 id，补齐结果只在当前记录 id 匹配时替换，迟到的旧结果不会覆盖新快照。计入 Used 的字段口径见 ADR 0003；这里只记录补齐时机与取整方式。

分类 token 先按 `ceil(chars / 4)` 得到权重，再用最大余数法缩放到 provider 的 Used：每类取整数份额，剩下的差值按小数部分从大到小补齐。8 类之和因此精确等于 Used，地图、分类账与卡片上的数字不会互相打架。全是 media、effort 这类不计字符的内容时，把 Used 记到 other，保持同一个不变量。

**Considered Options**

- 在 hook 里 await 查询：把磁盘读取与模型列表查询的延迟加到每次模型请求上。
- 异步结果直接覆盖：上一个请求的补齐结果会覆盖刚写入的新快照。
- 每类四舍五入：8 类之和会偏离 Used，地图与卡片对不上。
- 先算总占比再逐类取整：仍需处理余数，步骤更多而结果与最大余数法相同。

**Consequences**

Used 滞后一轮，tool continuation 时误差约为上一轮的 assistant 输出加一条 tool result。窗口查询失败时退回 200000 并标 `windowAssumed`；它是显式字段，不用 `window === 200000` 推断，真实 200k 窗口不会被误标。纯 media 请求的用量全部落在 other。
