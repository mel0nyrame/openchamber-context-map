# AGENTS.md

## Agent skills

### Issue tracker

Issue 与 spec 存放在本仓库的 GitHub Issues（`mel0nyrame/openchamber-context-map`），通过 `gh` CLI 操作。见 `docs/agents/issue-tracker.md`。

### Triage labels

默认五角色词汇：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文：仓库根目录的 `GLOSSARY.md`，ADR 位于 `docs/adr/`。见 `docs/agents/domain.md`。

## 工程约定

- 改 `src/` 后跑 `bun run build`，把三个构建产物一起提交；扩展安装时不执行构建。理由见 `docs/adr/0004-build-artifacts-committed.md`。
- 交付前 `bun test` 与 `bun run typecheck` 通过。
- 面板的几何、取整与配色放纯函数模块（`src/panel/map.ts`、`src/panel/palette.ts`）并单测；主题用 `data-oc-theme` 选择器切换，不读系统偏好。
- OpenCode V2 插件接口与已核实的事实见 `docs/opencode-plugin.md`。
