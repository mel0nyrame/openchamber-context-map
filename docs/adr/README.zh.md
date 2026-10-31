# 架构决策记录

每条记录说明一个决策、被否决的方案，以及它带来的后果。术语见 [`GLOSSARY.md`](../../GLOSSARY.md)。「触及模块」列给出该决策约束的文件，改动可以从决策开始，不必先搜索。

| 编号 | 决策 | 触及模块 | 状态 |
| --- | --- | --- | --- |
| [0001](0001-two-part-architecture.zh.md) | Collector 在 OpenCode 内，扩展在 OpenChamber 内，两者走 loopback HTTP | `src/collector/main.ts`、`src/service/main.ts`、`src/panel/main.ts` | 有效 |
| [0002](0002-last-request-only.zh.md) | 每个 session 只保留最后一次请求，最多 20 个 | `src/collector/store.ts`、`src/collector/snapshot.ts` | 有效 |
| [0003](0003-token-accounting.zh.md) | 分类 token 按字符估算，再缩放到 provider 的真实总量 | `src/collector/snapshot.ts`、`src/collector/enrich.ts` | 有效 |
| [0004](0004-build-artifacts-committed.zh.md) | 三个构建产物随源码提交 | `scripts/build.ts`、`panel/`、`service/`、`collector/` | 有效 |
| [0005](0005-snapshot-enrichment.zh.md) | 快照先落内存，再按快照 id 异步补齐 | `src/collector/enrich.ts` | 有效 |
| [0006](0006-map-rendering.zh.md) | 地图画已用构成，窗口余量交给 bar | `src/panel/map.ts`、`src/panel/view.ts` | 部分被 0011 取代 |
| [0007](0007-refresh-policy.zh.md) | 只在 busy 时轮询；连续请求失败后停止 | `src/panel/refresh.ts`、`src/panel/refresh-run.ts` | 有效 |
| [0008](0008-degradation-layers.zh.md) | 降级按失败来源分层 | `src/panel/failure.ts`、`src/panel/model.ts` | 有效 |
| [0009](0009-collector-routing.zh.md) | 在多个 Collector 中查找 session | `src/service/main.ts`、`src/shared/discovery.ts` | 有效 |
| [0010](0010-installation.zh.md) | 安装写入宿主清单 | `scripts/install.ts`、`scripts/install-lib.ts` | 有效 |
| [0011](0011-map-denominator.zh.md) | 地图以窗口为分母，空闲格子显式留白 | `src/panel/map.ts`、`src/panel/view.ts` | 有效 |
| [0012](0012-baseline-snapshot.zh.md) | 首请求前复用最近一次真实请求的 system 与工具定义 | `src/collector/baseline.ts`、`src/collector/resolver.ts` | 有效 |
| [0013](0013-panel-localization.zh.md) | 英文是源语言，其余 locale 回退到英文 | `src/panel/i18n.ts` | 有效 |
| [0014](0014-snapshot-persistence.zh.md) | 快照持久化到 state 目录 | `src/collector/persist.ts`、`src/shared/snapshot.ts` | 有效 |

每条记录的中文版与英文版同目录，文件名带 `.zh.md` 后缀。
