# 降级按失败来源分层

面板的失败不是一种。host service 不可用（未安装、未授权、被暂停、进程退出）、Collector 不可用（没有 discovery、探活失败、版本过旧）、单次请求失败（超时、解析失败、意外状态码）来自不同层，用户能做的处理也不同。统一成一句「加载失败」会把「去装 Collector」和「等一会儿重试」混为一谈。

host 失败替换整块内容，并给出 Settings → Extensions 的路径。Collector 状态显示占位：没有 discovery 时给出 `~/.config/opencode/plugins/`，有 discovery 但没有记录时说明发起一次请求即可。单次请求失败在已有数据时静默保留，连续 3 次才由刷新策略接管；没有数据时才显示占位。

状态码也按来源解释。`503` 表示 Service 找不到可用的 Collector，面板当作「Collector 未运行」，而不是「快照暂时不可用」；`504` 表示等待 Collector 超时，单独提示「Collector 没有及时响应」。两者都会在下一次刷新时重试。

Collector 版本过旧只提示，不自动更新。Collector 是用户复制进 OpenCode 插件目录的单文件，面板没有写该目录的权限，也不应该在用户不知情时替换正在运行的插件。

**Considered Options**

- 所有失败共用一条文案：实现简单，但用户无法判断该装 Collector、该重启 Service，还是只需重试。
- 把 `503` 当普通请求错误：面板会显示「快照暂时不可用」，而实际原因是 Collector 没在跑，重试永远不会成功。
- 自动更新过旧的 Collector：需要写用户目录，且无法回滚到旧版本。

**Consequences**

文案分散在 `src/panel/failure.ts`（host 失败）与 `src/panel/main.ts` 的状态分支（Collector 与请求失败）。新增错误码时，Service 的映射与面板的分层要一起改；只改一处会让状态码落到「意外结果」。
