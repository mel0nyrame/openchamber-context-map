# Context Map

Context Map 是 OpenChamber 右侧 rail 上的一个面板，展示当前 session 最后一次模型请求的上下文构成。它由两部分组成：运行在 OpenCode 进程内的 Collector，和提供界面与代理的 OpenChamber extension。

## Language

**Snapshot（快照）**:
某一次模型请求在发出前一刻的上下文构成记录，包含分类、条目和 token 统计。
_Avoid_: 报告、dump、trace

**Last request（最后一次请求）**:
当前 session 最近一次即将发给模型提供方的请求，包含同一轮对话中的 tool continuation。
_Avoid_: 当前上下文、latest prompt

**Category（分类）**:
快照的 8 个固定桶之一：System、Tool definitions、User messages、Assistant text、Reasoning、Tool calls、Tool results、Other。
_Avoid_: 分组、类型、section

**Item（条目）**:
分类里的最小可展示单位，即一个 system part、一个 tool definition，或一个 message part。
_Avoid_: entry、行、记录

**Preview（预览）**:
Item 的截断文本，最多 8000 字符，只存在于内存。
_Avoid_: 内容、正文、原文

**Used（已用上下文）**:
最后一次请求实际占用的 token 总量。
_Avoid_: 占用、usage、consumed

**Window（上下文窗口）**:
模型可接受的最大上下文 token 数，取自模型声明的 `limit.context`。
_Avoid_: 上限、capacity

**Free space（空闲空间）**:
Window 减去 Used 的剩余部分。
_Avoid_: 剩余、headroom

**Estimated（估算）**:
由字符数推算、未经 provider 确认的 token 数。
_Avoid_: 近似、approximate

**Collector（采集器）**:
运行在 OpenCode 进程内的插件，负责在请求发出前记录快照。
_Avoid_: 插件、agent、探针

**Discovery file（发现文件）**:
Collector 启动时写下的、供 extension 找到它的本地文件。
_Avoid_: 注册表、config

**Stale discovery（失效发现文件）**:
指向已经退出的 Collector 的发现文件，由 Service 在连接失败时删除。
_Avoid_: 僵尸文件、残留配置

**Service（服务）**:
OpenChamber extension 的 host 侧进程，负责发现 Collector 并把快照转给 Panel。
_Avoid_: 后端、server、proxy

**Panel（面板）**:
运行在沙箱 iframe 里的界面，只负责展示 Service 提供的数据。
_Avoid_: 前端、UI、webview

**Surface**:
OpenChamber 里一个可挂载界面位置的标识；Context Map 使用 `plugin:context-map`。
_Avoid_: tab、view
