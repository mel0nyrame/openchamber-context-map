# Context Map

Context Map 是 OpenChamber 的 rail 面板，用来查看当前 session 最后一次请求把上下文花在了哪里。它由两部分组成：

- **OpenChamber 扩展**：提供面板与 host 侧 Service。
- **OpenCode Collector**：OpenCode 进程内插件，在请求发往 provider 前记录组装后的 system、tools 与 messages。

面板只保留每个 session 的最后一次请求，数据在内存里，不落盘；OpenCode 重启后历史清空。token 由字符数估算，最近一次 assistant 的 `input + cache.read + cache.write` 作为总用量校准，详情见 `docs/adr/0003-token-accounting.md`。

## 环境要求

- macOS 或 Linux（当前只在 macOS 上验证过；Windows 未验证）。
- [Bun](https://bun.sh/) 1.3 或更高版本。
- OpenChamber 2.5.2（当前验证版本）。
- OpenCode 2.2.2（当前验证版本），需要 V2 插件接口。
- 仓库放在稳定路径。扩展以软链方式安装，安装后不要移动或删除仓库目录。

## 安装

```bash
git clone <本仓库地址> openchamber-context-map
cd openchamber-context-map
bun run install
```

只需要 Bun；安装脚本不依赖 `node_modules`，也不需要在安装时构建。脚本会依次做三件事：

1. 创建软链 `~/.config/openchamber/extensions/context-map`，指向仓库根目录。
2. 把 `collector/main.js` 复制为 `~/.config/opencode/plugins/context-map.js`，并在文件开头写入版本标记。
3. 把扩展路径登记到 `~/.config/openchamber/extensions.json`；登记时确保 `service` 权限已授予（当前 manifest 没有额外 exec/socket 权限）。

安装完成后，**完全退出** OpenCode 和 OpenChamber，再重新打开：

- OpenCode 要完全退出，不能只关窗口；Collector 只在进程启动时加载。
- OpenChamber 重新打开后，在rail 里打开 **Context Map**。
- 面板状态应显示 `Collector 已连接 · v0.1.0`。如果显示 `Collector 未运行`，先确认 OpenCode 确实已经重启。

默认路径如下：

| 内容 | 路径 |
| --- | --- |
| 扩展软链 | `~/.config/openchamber/extensions/context-map` → 仓库根目录 |
| Collector | `~/.config/opencode/plugins/context-map.js` |
| 扩展清单 | `~/.config/openchamber/extensions.json` |

如果使用非默认目录，可以用环境变量覆盖：

```bash
OPENCHAMBER_DATA_DIR=/path/to/openchamber bun run install
XDG_CONFIG_HOME=/path/to/config bun run install
```

安装脚本是幂等的：重复执行不会产生第二条软链、第二个 Collector 文件或重复的清单条目。它只接受空目标、指向本仓库的软链，或带 `@context-map-collector` 标记的 Collector 文件。目标已存在且不属于本工具时，脚本会停止并保留原文件，不会覆盖用户内容。

安装或卸载前建议先完全退出 OpenChamber，避免运行中的宿主同时改写 `extensions.json`；改动本来也需要重启后才生效。

## 升级

扩展目录是软链，更新仓库文件后 OpenChamber 重新加载即可；Collector 是复制到 OpenCode 插件目录的副本，必须重新运行安装命令才会更新。因此升级统一按下面做：

```bash
cd openchamber-context-map
git pull
bun run install
```

然后完全退出并重新打开 OpenCode 与 OpenChamber。安装输出中出现 `已更新：...（旧版本 -> 新版本）` 或 `构建产物已更新` 都表示 Collector 已替换。

### 面板提示「collector 版本过旧」

这条提示表示正在运行的 Collector 版本与扩展期望的版本不一致。它只提示，不会自动更新（见 `docs/adr/0008-degradation-layers.md`）。

处理步骤：

1. 在仓库里执行 `bun run install`，确认输出显示 Collector 已更新到扩展期望的版本。
2. 完全退出**所有** OpenCode 实例，再重新打开。只关窗口或只重启其中一个实例，旧进程仍可能注册着旧版本。
3. 打开面板，状态应恢复为 `Collector 已连接 · vX.Y.Z`，黄色版本提示消失。

如果仍然提示过旧，检查：

```bash
head -1 ~/.config/opencode/plugins/context-map.js
```

第一行应该是 `// @context-map-collector v<版本>`。如果版本已经是新的，但面板仍旧，通常是还有旧 OpenCode 进程在运行；退出所有实例后重试。也可以用 `pgrep -fl opencode` 检查残留进程。

## 卸载

```bash
cd openchamber-context-map
bun run uninstall
```

卸载只会删除：

- 指向本仓库的 `~/.config/openchamber/extensions/context-map` 软链；
- 带 `@context-map-collector` 标记的 `~/.config/opencode/plugins/context-map.js`；
- `extensions.json` 里对应的路径，以及没有其它同 guest 安装时留下的授权和存储 id。

其它扩展、用户自己的插件和清单字段都会保留。卸载后同样需要完全退出并重新打开 OpenCode 与 OpenChamber。若目标不是本工具创建的，脚本会保留它并以非零状态退出，请先确认再手工处理。

## 常见故障

### Collector 未运行

面板显示 `Collector 未运行`，详情是「没有找到 Discovery file」。

1. 确认文件存在：

   ```bash
   ls -l ~/.config/opencode/plugins/context-map.js
   ```

2. 确认 OpenCode 正在运行，并且 discovery 目录里有当前进程的文件：

   ```bash
   ls -l ~/.local/state/openchamber-context-map/collectors/
   ```

   正常情况下会看到 `collector-<pid>.json`。如果设置了 `CONTEXT_MAP_DISCOVERY_DIR`，以该目录为准。

3. 文件不存在时，重新执行 `bun run install`，然后完全退出并重开 OpenCode。OpenCode 版本过低、插件加载报错，或只关闭了窗口而没有退出进程，都会导致 Collector 没有加载。

`opencode plugin list` 只列出通过包安装的插件，不会列出 `~/.config/opencode/plugins/` 里的本地文件插件；这里显示 `No plugins found` 不代表 Collector 没装。

如果 discovery 文件存在但面板显示 `Collector 没有响应`，通常是旧进程留下的 stale discovery。退出 OpenCode 后删除该目录下的 `collector-*.json`，再重新打开 OpenCode。

### Service 未就绪

面板显示 `Service 未就绪`，或 host 返回 `NO_SERVICE` / `NOT_GRANTED`。

1. 打开 OpenChamber 的 **Settings → Extensions**，确认 Context Map 已启用，并且 Service 权限已授权。
2. 重新执行 `bun run install`，它会补登记并授予 `service`（如果清单里还没有）。
3. 完全退出并重开 OpenChamber。

如果显示 `Service 已停止`（`SERVICE_FAILED`），先重启 OpenChamber；仍然失败时检查是否同时开了多个 OpenChamber 实例，或查看 OpenChamber 日志里的 Service 启动错误。

### 没有请求记录

面板显示 `还没有请求记录`，但状态是 `Collector 已连接`，说明 Collector 正常，只是当前 session 还没有被记录：

- 在当前 session 发一条消息，等请求完成后面板会出现快照。
- 面板只保留最后一次请求；切换 session 后，每个 session 各自显示自己的最后一次。
- OpenCode 重启后内存清空，新 session 在第一次请求前也是空的。
- 空闲时面板停止轮询；如果刚发完请求没有更新，点面板右上角的「刷新」。

### 端口冲突

Service 的端口由 OpenChamber 通过 `OPENCHAMBER_SERVICE_PORT` 分配，Collector 使用随机 loopback 端口，都不需要手工配置。

- 如果 OpenChamber 日志出现 `EADDRINUSE`，通常是重复启动了 OpenChamber，或端口被其它进程占用。完全退出所有 OpenChamber 实例后只开一个。
- Collector 的随机端口冲突很少见；如果 discovery 里的端口被别的进程占用，Service 会探活失败并尝试下一个 Collector。退出 OpenCode 后清理 stale discovery，再重开即可。
- 同时运行多个 OpenCode 实例时，Service 会按 `startedAt` 从新到旧询问，返回第一个有效快照（见 `docs/adr/0009-collector-routing.md`）。如果看到的是另一个实例的数据，先关掉不用的实例。

### 面板不在 rail 里

1. 打开 **Settings → Extensions**，确认 Context Map 没有被禁用。
2. 检查 `~/.config/openchamber/extensions.json` 的 `paths` 是否包含 `.../extensions/context-map`；没有就重新运行 `bun run install`。
3. 完全退出并重开 OpenChamber。安装或修改清单后，运行中的 OpenChamber 不会立即感知外部改动。

### 安装被拒绝

脚本提示「扩展目标已存在」或「Collector 目标已存在」时，它没有覆盖任何文件。先确认目标是什么：

```bash
ls -ld ~/.config/openchamber/extensions/context-map
ls -l ~/.config/opencode/plugins/context-map.js
```

如果确认是旧的用户文件，先备份并移走，再运行 `bun run install`。不要直接删除不确定来源的目录。

## 开发

```bash
bun install
bun run build
bun run dev
```

终端会打印预览地址，例如 `http://127.0.0.1:xxxxx`。`bun run dev` 启动时是空面板，在页面上点「模拟请求」才会注入快照。

`bun install` 会把 `package.json` 里的 `install` 脚本当作生命周期执行；安装脚本会识别这种调用并跳过，不会误装扩展。安装扩展仍然要用 `bun run install`。

如果不想手动点，使用固定快照模式：

```bash
bun run dev:fixture
```

它会在启动时自动注入 `DEV_FIXTURE`，打开终端打印的地址就能看到完整面板，不需要真实 OpenCode 请求。开发链路会启动一个进程内 Collector、一个 Service 子进程和假 host，discovery 使用临时目录，退出时自动清理；不需要安装 OpenChamber 扩展。

预览页顶部的 devbar 可以切换 Session A/B、busy/idle、lifecycle，也可以模拟 Service 停止、Collector 停止、`NO_SERVICE`、`NOT_GRANTED`、`DISABLED`、Collector 卡住和版本过旧等降级状态，便于对照 `docs/adr/0008-degradation-layers.md` 与 `docs/adr/0009-collector-routing.md` 走查。

提交前运行：

```bash
bun test
bun run typecheck
```

### 构建产物为什么提交

`panel/main.js`、`service/main.js`、`collector/main.js` 是提交进仓库的构建产物。OpenChamber 安装扩展时只读取 `package.json` 的 manifest 和入口文件，不执行构建；如果产物不在仓库里，`bun run install` 装出来的扩展就无法加载。因此修改 `src/` 后必须运行：

```bash
bun run build
```

并把三个产物一起提交。不要手工编辑生成文件；构建脚本见 `scripts/build.ts`，理由见 `docs/adr/0004-build-artifacts-committed.md`。

## 目录

```text
src/collector/   OpenCode Collector
src/service/     OpenChamber host Service
src/panel/       面板
src/shared/      协议、discovery、版本
scripts/         install、dev、build
panel/           panel 构建产物
service/         service 构建产物
collector/       collector 构建产物
docs/adr/        架构决策记录
```

## 隐私

- 快照只存在内存里，每个 session 只保留最后一次请求，最多 20 个 session。
- 单条预览最多 8000 字符，只在内存中截取。
- discovery 文件权限为 0600，目录为 0700；bearer token 只在 Collector 与 Service 之间使用，不会进入面板。
