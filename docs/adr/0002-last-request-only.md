# 快照只保留最后一次请求

面板回答的是「这个 session 现在的上下文里有什么」，不是「历史怎么变」。Collector 只为每个 session 保留最后一次请求的快照，内存里最多 20 个 session（LRU），不做历史回填，不做 subagent 树，不把 prompt 写盘，只保留字符数、分类统计和每条截断到 8000 字符的预览。历史回填会让内存和隐私面成倍变大，而它并不服务这个面板的用途。

**Consequences**

OpenCode 重启后没有数据，要等下一次请求。tool continuation 会用新快照覆盖同一轮的旧快照，所以面板在 busy 期间可能跳变。
