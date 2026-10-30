# 安装写入宿主清单，扩展用软链、Collector 用副本

OpenChamber 不会扫描扩展目录来发现扩展。只把目录放进 `~/.config/openchamber/extensions/` 不会出现在 rail，必须在 `~/.config/openchamber/extensions.json` 的 `paths` 里登记；不登记 `capabilityGrants["context-map"]` 里的 `service`，面板能打开但所有 host 请求都会得到 `NOT_GRANTED`。因此安装必须改宿主的配置文件，`bun run install` 不是单纯的复制脚本。

扩展用软链指向仓库根目录，仓库始终是唯一来源，`git pull` 后重启 OpenChamber 就能生效。Collector 是复制到 `~/.config/opencode/plugins/context-map.js` 的单文件，文件头带 `// @context-map-collector v<版本>` 标记：OpenCode 从插件目录加载文件，复制比软链更接近它实际运行的形态，标记则让安装与卸载能区分本工具生成的文件和用户自己的插件。

写 `extensions.json` 时先解析、校验已知字段的形状，再整体写回，未知字段原样保留；写入用临时文件加 `rename`，权限 0600。`storageIds` 不生成，宿主首次列出扩展时会自己补。安装只接受空目标、指向本仓库的软链、或带标记的 Collector 文件；其它情况一律停止并保留原文件，以非零状态退出。

**Considered Options**

- 复制扩展目录而不是软链：升级要重新安装，且两份副本容易漂移。
- 自动生成 `storageIds`：格式由宿主决定，猜错会污染存储映射。
- 直接覆盖已存在的目标：会把用户自己的插件或扩展目录当成自己的文件删掉。
- 把 Collector 也做成软链：升级更省事，但文件归属与版本检测都要依赖链接目标，且与 OpenCode 的插件加载方式不一致。

**Consequences**

仓库必须留在稳定路径，移动或删除仓库会让扩展软链断开。安装与卸载会改写 `extensions.json`，运行中的 OpenChamber 可能同时写同一文件，所以 README 要求在操作前完全退出宿主。宿主升级若改变清单结构，`parseExtensionStore` 的校验会让安装直接失败，而不是写出一份宿主读不懂的文件。
