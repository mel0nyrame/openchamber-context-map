# 面板按需安装缺失的 Collector

OpenChamber 可以从 Git URL 安装扩展。这条路径把扩展包复制到 `~/.config/openchamber/extensions/context-map`，不执行仓库里的脚本。此时扩展已有面板和 Service，但 Collector 是 OpenCode 插件，必须位于 `~/.config/opencode/plugins/context-map.js`；文件缺失时，面板显示「Collector 未运行」，也没有数据。

Service 的扩展包内带有构建好的 `collector/main.js`。当 `/health` 报告没有已注册的 Collector（`reason: "not_found"`）时，面板显示 **安装 Collector** 按钮。点击后，面板调用 Service 的 `POST /collector/install`。Service 读取自带的 `collector/main.js`，加上 `// @context-map-collector v<版本>` 文件头，再用临时文件加 `rename` 写入 OpenCode 插件目录，权限 0600。只有目标缺失或带有标记时才写入；用户自己的文件、软链或目录返回 409，并保持原样。写入后面板提示完全退出 OpenCode 再重新打开，因为 OpenCode 只在进程启动时加载插件。

面板不会静默安装 Collector。文件缺失是可见状态，写入用户的 OpenCode 配置也由用户主动触发。安装脚本与面板安装使用同一套标记和冲突规则，两条路径不会覆盖对方的文件。

**Considered options**

- 让链接安装的用户克隆仓库再运行 `bun run install`：链接安装的目的就是免去本地仓库，而且安装脚本会拒绝 OpenChamber 创建的扩展目录。
- 让面板直接写文件：面板运行在沙箱 iframe 中，没有文件系统访问权限。
- 首次打开面板时自动安装 Collector：这会隐藏一次对用户 OpenCode 配置的写入，用户没有拒绝的机会。
- 覆盖任意已存在的文件：会破坏用户自己的插件。
- 把 Collector 做成软链：OpenCode 加载的是副本，标记与版本检查也按普通文件设计。

**Consequences**

Service 需要对 `~/.config/opencode/plugins/` 有写权限；它以当前用户身份运行，没有沙箱。面板只安装到默认路径：host 不会把 `XDG_CONFIG_HOME` 传给 Service，所以把 OpenCode 配置目录移到别处的用户仍需在本地仓库运行 `bun run install`。新写入的 Collector 要等 OpenCode 重启后才加载。面板只安装缺失的 Collector；已存在但版本过旧的 Collector 仍需安装脚本，而安装脚本也会同时更新扩展。如果没有授予 `service` 能力，面板无法调用该接口，会显示 host 失败而不是安装按钮。
