# 只在 busy 时轮询，失败按来源分层

面板不常驻轮询。session busy 时每 2 秒刷新一次，转入 idle 立即停止，切 session 或面板隐藏也停止。用一条 `setTimeout` 链而不是 `setInterval`：上一次请求结束再等 2 秒，请求不会重叠，停止与重置也更简单。

失败分两类。host 或 Service 请求失败计入连续失败，连续 3 次停止自动刷新并显示 banner，手动刷新成功后恢复。Collector 断开不计入：`/health` 仍然成功，只是 `collector.connected` 为 false，面板走「Collector 未连接」状态并继续轮询。把 Collector 断开算作失败，Collector 恢复后就无法自动回到轮询。

SDK 2.5.3 没有面板可见性或关闭回调，隐藏检测用 `document.visibilitychange` 与 `pagehide` / `pageshow`。session 的 `failure` 生命周期只表示状态未知，不改写 busy。

**Considered Options**

- 常驻 2 秒轮询：idle 时也发请求，「更新于」还会随请求跳动。
- `setInterval`：请求慢时会重叠，停止与重置难以对齐。
- 把 Collector 断开计入失败：与既有的连接状态重复，且停止轮询后 Collector 恢复也回不来。
- 用 `focus` / `blur` 判断可见：面板可见但未聚焦时会误判。

**Consequences**

宿主若用 CSS 隐藏面板而不改变文档可见性，busy 时仍会轮询；要精确覆盖需要宿主补 API。`failure` 且 busy 为 true 时，若宿主之后不再发 `busy=false`，会一直轮询到切 session 或隐藏。
