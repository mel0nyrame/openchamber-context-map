# 模块分工

先在这里定位文件，不要用 `rg "function|export|interface"` 重建全仓库地图。「主要导出」列回答「某个名字定义在哪个文件」，「职责」列回答「这段逻辑归谁」。

## 一次请求经过的文件

```text
OpenCode 组装请求
  src/collector/main.ts        插件入口，注册 context hook，写 discovery 并起 HTTP
    snapshot.ts                分类、字符计数、切片，生成 draft
    store.ts                   写入内存，每个 session 只留最后一条
    enrich.ts                  异步补齐 provider Used 与模型窗口
    persist.ts                 写 state 目录，重启后读回
    baseline.ts                首请求前复用上次的 system 与工具定义
    resolver.ts                /summary 与 /item 的只读查找
  src/service/main.ts          host service，发现 Collector 并代理两个路由
  src/panel/main.ts            面板接线
    refresh.ts                 何时刷新
    refresh-run.ts             一次刷新的请求与结果映射
    model.ts                   状态、层级、焦点、内容优先级
    view.ts                    DOM 渲染
    format.ts                  纯数字与版本格式化
    signature.ts               视图重建签名
```

## Collector（src/collector）

| 文件 | 主要导出 | 职责 |
| --- | --- | --- |
| `src/collector/main.ts` | 默认导出插件对象 | 注册 `context` hook，接线 store、enrich、persist、resolver；绑定 loopback HTTP 并写 discovery 文件 |
| `src/collector/opencode.ts` | `SessionContext`、`SessionMessage`、`ModelRef`、`modelRefID` | OpenCode V2 插件接口的本地类型镜像，避免每个文件重复声明 |
| `src/collector/snapshot.ts` | `buildDraft`、`baselineDraft`、`finalizeSnapshot`、`PREVIEW_LIMIT`、`HEAD_LIMIT` | 把 `SessionContext` 分成 `CATEGORIES` 里的七类并计数、切片，生成 draft 与最终快照 |
| `src/collector/store.ts` | `SnapshotStore`、`MAX_SESSIONS` | 内存表：每个 session 只留最后一条，最多 20 个，按访问顺序淘汰 |
| `src/collector/enrich.ts` | `readProviderUsed`、`WindowResolver`、`enrichSnapshot` | hook 返回后异步补齐：读最近一条 assistant 的 tokens，查并缓存模型窗口，按 id 匹配合并 |
| `src/collector/baseline.ts` | `BaselineStore`、`baselineKey`、`MAX_BASELINES` | 按 agent + model 保存上次真实请求的 system 与工具定义，供首请求前使用 |
| `src/collector/resolver.ts` | `SnapshotResolver`、`ResolvedWindow` | `/summary` 与 `/item` 的只读查找：当前记录优先，其次 baseline；不碰 HTTP 与持久化 |
| `src/collector/persist.ts` | `SnapshotWriter`、`readSnapshots`、`SNAPSHOT_SCHEMA_VERSION`、`MAX_SNAPSHOTS` | 快照骨架按 session 写入 state 目录并读回；版本不匹配时丢弃旧文件 |

## Service（src/service）

| 文件 | 主要导出 | 职责 |
| --- | --- | --- |
| `src/service/main.ts` | 无（启动即监听） | host service：扫描 discovery、探活 Collector、缓存路由，代理 `/summary` 与 `/item` |

## Panel（src/panel）

| 文件 | 主要导出 | 职责 |
| --- | --- | --- |
| `src/panel/main.ts` | 无（模块副作用） | 入口接线：`connectHost` → `createPanelModel` → `createRefreshRun` → `createRefreshController` → `createPanelView`；注册 session、lifecycle、ready 回调与页面可见性监听 |
| `src/panel/model.ts` | `createPanelModel`、`PanelModel`、`PanelState`、`PanelStatusCopy`、`ItemLoadResult` | 面板状态机：placeholder 与 summary 两类 body、内容优先级、钻取层级、焦点、条目加载；决定状态条与占位区的文案键和参数 |
| `src/panel/view.ts` | `createPanelView`、`PanelViewHandle` | 把 model 状态渲染成 DOM，处理键盘、点击与滚动 |
| `src/panel/format.ts` | `formatNumber`、`formatPercent`、`compactNumber`、`roundPercent`、`pad2`、`versionLabel`、`intlLocale` | 纯格式化：数字、百分比、紧凑数字、版本标签与 Intl locale 映射；不碰 DOM、时间、文案或视图状态 |
| `src/panel/signature.ts` | `snapshotSignature`、`breakdownSignature` | 视图重建签名：地图与明细缓存的纯键，只读取 model 类型，不碰 DOM |
| `src/panel/refresh.ts` | `createRefreshController`、`busyChanged`、`refreshFailed`、`POLL_INTERVAL_MS`、`FAILURE_LIMIT` | 刷新控制器：busy 时每 2 秒轮询、idle 停表、连续失败 3 次停自动刷新、版本横幅；状态转移是纯函数 |
| `src/panel/refresh-run.ts` | `createRefreshRun` | 一次刷新的请求构造、超时与结果到 model 的映射 |
| `src/panel/session.ts` | `applySessionSnapshot` | 把 host 的 session 快照同步给 model 与 controller；只有真正换 session 才请求事件刷新 |
| `src/panel/failure.ts` | `describeHostFailure`、`HostFailureCopy` | host service 失败码到文案与动作的映射 |
| `src/panel/i18n.ts` | `t`、`MESSAGES`、`resolveLocale`、`MessageKey` | 文案字典；`en` 是源语言，`zh` 是翻译，其余 locale 回退 `en` |
| `src/panel/map.ts` | `layoutMap`、`Breakdown`、`MAP_COLUMNS`、`MAP_ROWS` | 地图纯函数：格子布局、分类段、Free space、渐变与 Breakdown 行 |
| `src/panel/palette.ts` | `PALETTES`、`paletteCss`、`contrastRatio` | 明暗两套分类色与背景色，输出主题 CSS，附对比度工具 |
| `src/panel/preview.ts` | `layerOf`、`moveFocus`、`clipPreviewText`、`PanelLayer` | 钻取层级（overview / items / preview）、焦点移动、预览截断判断 |

## Shared（src/shared）

| 文件 | 主要导出 | 职责 |
| --- | --- | --- |
| `src/shared/types.ts` | `SnapshotSummary`、`SnapshotItemDetail`、`DiscoveryRecord`、`CollectorStatus`、`CATEGORIES` | 面板、Service、Collector 之间的线协议类型 |
| `src/shared/snapshot.ts` | `parseSnapshotSummary`、`parseSnapshotItemDetail` | 线协议校验：字段类型、取值范围、未知字段一律拒绝 |
| `src/shared/discovery.ts` | `writeDiscovery`、`readDiscoveryEntries`、`resolveDiscoveryDir` | discovery 文件的读写与扫描，权限 0600 / 0700 |
| `src/shared/version.ts` | `COLLECTOR_VERSION`、`collectorVersionOutdated`、`SERVICE_PORT_ENV` | 版本常量、版本比较、环境变量名 |

## Scripts

| 文件 | 主要导出 | 职责 |
| --- | --- | --- |
| `scripts/build.ts` | 无（命令行） | 用 `openchamber-guest-bundle` 生成 `panel/`、`service/`、`collector/` 三个产物 |
| `scripts/install.ts` | 无（命令行） | 安装与卸载：软链扩展、复制 Collector、改 `extensions.json` |
| `scripts/install-lib.ts` | `EXTENSION_GUEST_ID` 等 | 安装的纯逻辑与文件操作，供 `install.ts` 与测试复用 |
| `scripts/dev.ts` | 无（命令行） | 不装 OpenChamber 的开发链路：进程内 Collector、Service 子进程、最小 host 桥；`--fixture` 启动即注入固定快照 |
| `scripts/check-docs.ts` | 无（命令行） | 校验本文件的覆盖范围：`src/` 与 `scripts/` 下每个 `.ts` 都有一行，且没有指向已删除文件的条目 |

## 测试

`tests/` 按 `<area>-<module>.test.ts` 命名，例如 `tests/panel-refresh-controller.test.ts` 对应 `src/panel/refresh.ts`，`tests/snapshot-codec.test.ts` 对应 `src/shared/snapshot.ts`。找某个模块的测试先看同名文件，再 `rg` 模块里的导出名。
