# 首请求前用最近一次真实请求的 system 与工具定义作基线

OpenCode 没有预演首请求的接口：`session.context()` 对空 session 返回空数组，`context` hook 只在真实请求发往 provider 前触发，`ModelHooks` 的回调也没有取消通道。因此面板无法在首请求前拿到「这次请求将会组装成什么」。

Collector 在每次真实请求时顺带记住该 `agent + model` 的 system 与工具定义（最多 5 组，按写入顺序淘汰）。当前 session 还没有快照时，`/summary` 用 `session.get()` 得到的 agent 与 model 查模板，返回只含这两个分类的快照，并标 `baseline: true` 与 `estimated: true`。第一次真实请求到达后，正常快照立即替换它。

**Considered Options**

- Silent probe：注入一条 synthetic 消息再立即中断。`session.synthetic()` 只负责投递消息，hook 没有取消通道，异常会变成插件错误，消息也可能留在 session 里。
- 用 `agent.list()`、`skill.list()`、`tool.list()` 静态重建：拿不到内置 system 模板、instruction 拼装顺序与内置插件的改写，结果看起来精确但会悄悄出错。
- 首请求前保持空态：用户明确要求像 pi 的 `/context` 一样先看到初始构成。

**Consequences**

基线可能滞后于配置变更，直到下一次真实请求才更新。基线只分 System 与 Tool definitions 两类，skills 摘要与 AGENTS.md 仍在 System 里，不单列。从未在该 agent + model 下发过请求的新环境仍然显示等待首请求的空态。基线条目的 id 不带快照版本后缀，模板被替换后旧 id 自然失效。
