# 两部分架构：OpenCode Collector + OpenChamber Extension

单个 OpenChamber extension 拿不到组装后的 `system`、`tools`、`messages`；单个 OpenCode 插件没有 UI surface。所以 Context Map 拆成两部分：Collector 在 OpenCode 进程内用 `ctx.session.hook("context")` 抓请求发出前一刻的组装结果，Extension 提供右侧 rail 面板和 host service。两者走 loopback HTTP：Collector 绑定 `127.0.0.1` 随机端口和随机 bearer，把端口、token、版本写进 0600 的 discovery 文件；Service 遍历 discovery 发现 Collector，代理 `/summary` 和 `/item`；Panel 只通过 `serviceRequest` 访问 Service，始终拿不到 Collector 的 token。

**Considered Options**

- 单一 extension：拿不到请求组装结果，只能读持久化消息，缺 system 和 tools。
- 单一 OpenCode 插件：没有可挂载的界面。
- 共享文件或命名管道：没有请求/响应语义，要自己轮询和分片，还要处理跨进程权限。
- 直接读 OpenCode 存储：拿到的是持久化消息，不是组装后的请求，且 compaction 之后与真实请求不一致。

**Consequences**

用户要装两样东西；Collector 未加载时面板只能降级成提示。Collector 崩溃留下的 discovery 文件由 Service 按连接失败清理。
