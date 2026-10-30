# Context Map 手工验收清单

对应 ticket #8 的六项验收标准。标有「由用户执行」的步骤需要在真实 OpenCode / OpenChamber 中完成；实现者不会代替用户重启正在使用的应用，也不会把未实际执行的步骤勾成通过。

验收环境：

- 日期：
- macOS 版本：
- OpenChamber 版本：
- OpenCode 版本：
- 面板宽度（默认 / 390px）：

## 1. 安装后 rail 出现面板

- [ ] 由用户执行：在仓库根目录运行 `bun run install`，确认输出包含 `[1/3] 扩展`、`[2/3] Collector`、`[3/3] 扩展清单`，且没有冲突提示。
- [ ] 由用户执行：完全退出 OpenCode（不是只关窗口），再重新打开。
- [ ] 由用户执行：完全退出 OpenChamber，再重新打开。
- [ ] 由用户执行：左侧 rail 中出现 **Context Map**，打开后能看到面板，而不是空白或一直停在连接中。
- [ ] 面板状态显示 `Collector 已连接 · v0.1.0`；没有出现 `Collector 未运行`。
- [ ] 全程没有手工复制扩展目录或 Collector 文件。

结果 / 备注：

## 2. 安装脚本幂等

- [ ] 连续执行两次 `bun run install`。
- [ ] 第二次输出为「软链已存在，跳过」「已是最新，跳过」「已登记，跳过」，最后是「安装已是最新，没有改动」。
- [ ] `ls -l ~/.config/openchamber/extensions/` 中只有一个 `context-map` 软链。
- [ ] `ls -l ~/.config/opencode/plugins/` 中只有一个 `context-map.js`。
- [ ] `~/.config/openchamber/extensions.json` 的 `paths` 中只有一条 `context-map`，`capabilityGrants["context-map"]` 中没有重复的 `service`。
- [ ] 再执行 `bun run uninstall`，软链、Collector 文件和清单条目都被移除；再次执行 `bun run uninstall` 输出「没有需要卸载的内容」。

结果 / 备注：

实现者预检（2026-10-30）：已在真实路径连续执行两次安装，第二次全部跳过；检查到一条软链、一个 Collector 文件、一条清单路径。随后执行卸载，`extensions.json` 的 SHA-256 恢复到安装前的 `00d2e5647cb42d626bfcc21d09a1d6a4158fa1ce2bca4e6687a34ef0a78586f0`。当前真实环境已卸载，第 1 项需要用户重新安装后验证。

## 3. README 覆盖安装、升级、卸载和常见故障

- [ ] README 有「安装」章节，命令为 `bun run install`，并说明重启 OpenCode 与 OpenChamber。
- [ ] README 有「升级」章节，说明 Collector 是复制文件、需要重新安装，并覆盖「collector 版本过旧」提示的处理。
- [ ] README 有「卸载」章节，命令为 `bun run uninstall`，说明只删除本工具创建的内容。
- [ ] README 覆盖至少四类故障：Collector 未运行、Service 未就绪、没有请求记录、端口冲突。
- [ ] README 有「开发」章节，说明 `bun run dev`、`bun run dev:fixture`，以及构建产物为什么提交。
- [ ] 按 README 中的命令逐条执行，没有与当前实现不一致的路径或命令。

结果 / 备注：

## 4. `bun run dev:fixture` 注入固定快照

- [ ] 在仓库根目录运行 `bun run dev:fixture`。
- [ ] 终端打印预览地址，例如 `http://127.0.0.1:xxxxx`；打开该地址。
- [ ] 不点击「模拟请求」，面板已经显示固定快照：`Context usage` 为 `85,300 / 200,000 tokens`、`42.7%`。
- [ ] 地图为固定 200 格，Breakdown 至少显示系统提示、工具定义、用户消息、助手文本、推理、工具调用、工具结果、其他中的多项。
- [ ] 点击 Session B，面板数字和分类随之变化；点击「无 session」，显示「没有打开的 session」。
- [ ] 按 `Ctrl+C` 退出后，预览端口、Service 和临时 discovery 目录都被清理，没有残留进程。

结果 / 备注：

实现者预检（2026-10-30）：`bun run dev:fixture` 正常启动，终端打印 `已注入固定快照 DEV_FIXTURE；无需真实 OpenCode 请求。`；预览页渲染出 `85,300 / 200,000 tokens`、`42.7%` 和 200 格地图。当前开发服务器已停止。

## 5. 真实环境手工清单

以下步骤全部标为「由用户执行」，需要在安装完成、两个应用都重启过之后进行。

### 5.1 带工具调用的消息

- [ ] 由用户执行：打开一个 session，在 Context Map 面板可见的情况下，发送一条需要使用工具的消息，例如「读取 `README.md` 并总结要点」。
- [ ] 请求进行中，面板在 2 秒内更新；请求结束后仍保留最后一次快照。
- [ ] Breakdown 中「工具定义」「工具调用」「工具结果」有非零用量，地图上能看到对应颜色。
- [ ] 点击地图格子或 Breakdown 行，能进入分类明细；点击一条工具调用或工具结果，能看到预览。
- [ ] 预览内容不超过 8000 字符，超出时有截断提示；「复制」按钮可用。
- [ ] 如果 provider 没有返回完整 token 用量，面板显示 `estimated` 徽标；这是预期降级，不是失败。

结果 / 备注：

### 5.2 切换 session

- [ ] 由用户执行：打开两个 session，各发一条请求，确保两次请求的上下文规模不同。
- [ ] 在 session A 与 session B 之间切换，面板在切换后显示对应 session 的快照，不残留上一个 session 的数字。
- [ ] 新建一个还没有请求的 session，面板显示「还没有请求记录」，不是上一个 session 的数据。
- [ ] 切回有数据的 session，快照恢复；不需要重启面板。

结果 / 备注：

### 5.3 杀掉 OpenCode 看降级

- [ ] 由用户执行：保持 OpenChamber 和 Context Map 面板打开，完全退出 OpenCode。
- [ ] 几秒内面板显示 `Collector 未运行` 或 `Collector 没有响应`，并给出重启 OpenCode 的提示；面板不崩溃，OpenChamber 其它功能正常。
- [ ] 重新打开 OpenCode，再发一条请求；面板恢复为 `Collector 已连接` 并显示新快照。
- [ ] 如果 OpenChamber 自身也被一起退出，本项不算通过；本项只退出 OpenCode。

结果 / 备注：

### 5.4 浅色与深色

- [ ] 由用户执行：在 OpenChamber 设置中切换浅色与深色主题（不是只改系统外观）。
- [ ] 面板无需刷新即可跟随主题；背景、文字、边框和 8 个分类颜色都随主题变化。
- [ ] 两种主题下分类颜色仍可区分，文字对比度足够，没有硬编码的白色/黑色块。
- [ ] 地图格子、进度条、warning/error 状态在两种主题下都清晰。

结果 / 备注：

### 5.5 390px 宽

- [ ] 由用户执行：把 OpenChamber 窗口或面板宽度调整到 390px 左右。
- [ ] 地图切换为窄屏布局（20 列 × 10 行），没有横向滚动条。
- [ ] Breakdown 的行名、token 数字不重叠；长文本用省略号或换行处理。
- [ ] 悬停/点击格子的提示框保持在面板边界内，不被裁掉。
- [ ] 预览区域可以纵向滚动，长行自动换行；刷新、返回、复制等按钮仍可点击。

结果 / 备注：

## 6. 升级 Collector 后「版本过旧」提示消失

先确认面板正常、Collector 版本为 `v0.1.0`。真实升级可以用一个旧版本文件模拟；这只是验收手段，`bun run install` 会把它覆盖回当前版本。

- [ ] 由用户执行：备份当前 Collector：

  ```bash
  cp ~/.config/opencode/plugins/context-map.js /tmp/context-map.current.js
  ```

- [ ] 由用户执行：生成一个旧版本副本，把标记和代码里的 `0.1.0` 都改成 `0.0.9`：

  ```bash
  sed 's/0\.1\.0/0.0.9/g' /tmp/context-map.current.js > /tmp/context-map.old.js
  cp /tmp/context-map.old.js ~/.config/opencode/plugins/context-map.js
  ```

- [ ] 由用户执行：完全退出并重新打开 OpenCode。
- [ ] 面板出现黄色 `collector 版本过旧` 提示，说明运行的是 `v0.0.9`、扩展期望 `v0.1.0`；面板仍能显示已有数据或给出明确降级状态。
- [ ] 在仓库根目录执行 `bun run install`，输出包含 `已更新：...（0.0.9 -> 0.1.0）`。
- [ ] 由用户执行：再次完全退出并重新打开 OpenCode。
- [ ] 黄色版本提示消失，状态恢复为 `Collector 已连接 · v0.1.0`。
- [ ] 删除临时备份 `/tmp/context-map.current.js` 和 `/tmp/context-map.old.js`。

结果 / 备注：

## 汇总

- [ ] 六项验收全部通过。
- [ ] 失败项已记录现象、复现步骤和对应日志；没有把未执行的步骤标记为通过。

失败项记录：
