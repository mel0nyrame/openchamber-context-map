# 快照持久化到 state 目录

Collector 的快照原本只在内存里，OpenCode 一重启就清空，面板要等下一次请求才有内容。现在把 `/summary` 返回的那份骨架按 session 写到 state 目录，启动时读回。保留「只保留最后一次请求」的语义：恢复的是上一次运行的最后一份快照，不是历史。

写盘的内容就是 `SnapshotSummary`：模型、Used、窗口、`windowAssumed`、`estimated`、`baseline`、`collectedAt`、8 类汇总，以及每个条目的 `title`、`chars` 和前 200 字符的 `head`。`/item` 的正文预览（每条最多 8000 字符）不写盘，重启后点条目会拿到 404。

文件默认放在 discovery 目录同级的 `snapshots/` 下（开发期覆盖 discovery 目录时放在它下面的 `snapshots/`），文件名是 `<sessionID>.json`，目录 0700、文件 0600。写入用唯一的临时名加 rename，避免并发 setup 互抢。写入时机在异步补齐完成之后，按 session 去抖；`context` hook 里仍然不碰 I/O。dispose 时尽力 flush 一次，但进程被强杀时以最后一次去抖写入为准。

启动时读取全部文件，按 `collectedAt` 排序，最多保留 20 个 session，超过 7 天的直接丢弃。文件带 `schemaVersion`，版本不符就丢弃而不是尝试迁移。淘汰时同时删除文件。

恢复的快照带 `restored: true`，面板在「更新于」旁标「上次运行」；同一 session 来了新请求、写入新快照后标记清除。默认开启，`CONTEXT_MAP_PERSIST=0` 可以关闭。

**Considered options**

- 连正文预览一起存：tool result、文件内容、环境变量都会落盘，泄露面最大，收益只是省一次重新请求。
- 由 Service 缓存取到过的 `/summary`：插件完全不碰盘，但只有面板打开过的 session 才有缓存，而且 Service 要从无状态变成有状态。
- 只在 dispose 时写：`kill -9` 或崩溃时全部丢失。
- 把基线模板也持久化：要写 system prompt 与 AGENTS.md，收益只是新 session 早一点显示 `Estimated baseline`。
- 不设过期：文件会随着 session 数量长期堆积。

**Consequences**

磁盘上会出现每条 200 字符的 prompt 片段，量级与本机 shell history 相当；同一账号可读。重启后条目预览不可用，面板需要一句单独的提示，不能复用「快照已更新」。恢复的快照是重启前最后一次请求，可能与 session 当前状态不符，所以必须标「上次运行」。以后改 `SnapshotSummary` 结构时要升 `schemaVersion`，旧文件会被丢弃。

ADR 0002 的「不把 prompt 写盘」由本记录取代；「只保留最后一次请求、不做历史回填、不存正文预览」仍然有效。
