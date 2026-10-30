# Issue tracker：GitHub

本仓库的 issue 与 spec 存放在 GitHub Issues。所有操作使用 `gh` CLI。

## 约定

- **创建 issue**：`gh issue create --title "..." --body "..."`。多行正文使用 heredoc。
- **读取 issue**：`gh issue view <number> --json number,title,body,labels,comments`。
- **列出 issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，按需加上 `--label` 与 `--state` 过滤。
- **把 issue 设为某个父 issue 的子 issue**：`gh issue create --parent <parent> ...`，或事后执行 `gh issue edit <parent> --add-sub-issue <child>`（`gh` 2.94+）。旧版 `gh`：`gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`（使用数据库 id，见下方「阻塞」）。若无法使用 sub-issue，在子 issue 正文顶部写 `Part of #<parent>`。
- **阻塞**：使用 GitHub 原生 issue 依赖，这是规范且界面可见的表达。添加依赖边：`gh issue create --blocked-by <n>,<n> ...` 或 `gh issue edit <child> --add-blocked-by <blocker>`（`gh` 2.94+）。旧版 `gh`：`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`，其中 `<blocker-db-id>` 是阻塞者的数字数据库 id（`gh api repos/<owner>/<repo>/issues/<n> --jq .id`，不是 `#number`，也不是 `node_id`）。若依赖功能不可用，退回到子 issue 正文顶部的 `Blocked by: #<n>, #<n>` 行。所有阻塞者关闭后，该 ticket 才算解除阻塞。
- **统计未关闭的阻塞者**：`gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by`（只计未关闭的阻塞者；为 0 表示可以开始）。`gh issue view <n> --json blockedBy` 也会列出已关闭的阻塞者，需要过滤：`--jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'`。
- **评论 issue**：`gh issue comment <number> --body "..."`
- **添加 / 移除标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**：先用 `gh issue comment <number> --body "..."` 发布说明，再执行 `gh issue close <number>`。对已关闭的 issue，`gh issue close --comment` 会丢弃评论但仍以 0 退出。

仓库由 `git remote -v` 推断；在克隆目录内运行 `gh` 时会自动推断。

只向用户自己的仓库提交 issue。除非用户拥有 `mattpocock/skills`（这些技能的来源仓库），否则不要向它提交。在 fork 中，`gh` 可能默认指向 upstream 父仓库，因此每次会话第一次执行 `gh issue create` 前，先用 `gh repo view --json nameWithOwner` 检查目标仓库；如果不是用户的仓库，与用户确认。

## 把 Pull Request 作为 triage 入口

**PRs as a request surface: no。**（如果本仓库把外部 PR 当作功能请求，改为 `yes`；`/triage` 会读取这个开关。）

设为 `yes` 时，PR 与 issue 走相同的标签和状态，使用对应的 `gh pr` 命令：

- **读取 PR**：`gh pr view <number>`，再执行 `gh pr view <number> --comments`（非 TTY 下 `--comments` 只打印评论，不打印正文），diff 用 `gh pr diff <number>`。
- **列出待 triage 的外部 PR**：`gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`。
- **评论 / 加标签 / 关闭**：`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 的 issue 与 PR 共用一套编号，因此裸 `#42` 可能指向任一者：先用 `gh pr view 42` 解析，失败再退回 `gh issue view 42`。

## 技能要求「发布到 issue tracker」时

创建一个 GitHub issue。

## 技能要求「获取相关 ticket」时

按上文「读取 issue」操作。

## Wayfinding 操作

供 `/wayfinder` 使用。**map** 是一个 issue，**child** issue 是 ticket。

- **Map**：一个带 `wayfinder:map` 标签的 issue，正文包含 Notes / Decisions-so-far / Fog。`gh issue create --label wayfinder:map`。
- **Child ticket**：作为 GitHub sub-issue 链接到 map 的 issue（见「把 issue 设为某个父 issue 的子 issue」）。无法使用 sub-issue 时，把 child 加入 map 正文的任务列表，并在 child 正文顶部写 `Part of #<map>`。标签：`wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）。被认领后，ticket 指派给负责推进的开发者。
- **阻塞**：见「约定」中的「阻塞」。
- **Frontier 查询**：列出 map 的未关闭子 issue（`gh issue list --state open`，范围限定为 map 的 sub-issue / 任务列表），剔除存在未关闭阻塞者的（见「统计未关闭的阻塞者」，或 `Blocked by` 行中的未关闭 issue）或已有 assignee 的；按 map 中的顺序取第一个。
- **认领**：`gh issue edit <n> --add-assignee @me`，这是会话的第一次写操作。
- **解决**：`gh issue comment <n> --body "<answer>"`，然后 `gh issue close <n>`，最后把上下文指针（要点 + 链接）追加到 map 的 Decisions-so-far。
