# Issue tracker: GitHub

This repository's issues and specs live in GitHub Issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, adding `--label` and `--state` filters as needed.
- **Make an issue a child of a parent issue**: `gh issue create --parent <parent> ...`, or afterwards run `gh issue edit <parent> --add-sub-issue <child>` (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (use the database id; see "Blocking" below). If sub-issues are unavailable, put `Part of #<parent>` at the top of the child issue body.
- **Blocking**: use GitHub's native issue dependencies; this is the canonical, visible-in-the-UI representation. Add a dependency edge: `gh issue create --blocked-by <n>,<n> ...` or `gh issue edit <child> --add-blocked-by <blocker>` (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric database id (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, not `#number`, and not `node_id`). If the dependency feature is unavailable, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child issue body. A ticket is unblocked only after all blockers are closed.
- **Count open blockers**: `gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by` (counts only open blockers; 0 means it can start). `gh issue view <n> --json blockedBy` also lists closed blockers, so filter them: `--jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'`.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Add / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: first publish an explanation with `gh issue comment <number> --body "..."`, then run `gh issue close <number>`. For an already closed issue, `gh issue close --comment` discards the comment but still exits 0.

The repository is inferred from `git remote -v`; `gh` infers it automatically when run inside the clone.

Submit issues only to the user's own repository. Do not submit to `mattpocock/skills` (the source repository of these skills) unless the user owns it. In a fork, `gh` may default to the upstream parent repository, so before the first `gh issue create` in each session, check the target repository with `gh repo view --json nameWithOwner`; if it is not the user's repository, confirm with the user.

## Pull requests as a triage entry point

**PRs as a request surface: no.** (If this repository treats external PRs as feature requests, change this to `yes`; `/triage` reads this switch.)

When set to `yes`, PRs use the same labels and states as issues, with the corresponding `gh pr` commands:

- **Read a PR**: `gh pr view <number>`, then `gh pr view <number> --comments` (under a non-TTY, `--comments` prints only comments, not the body); use `gh pr diff <number>` for the diff.
- **List external PRs awaiting triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / add labels / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub issues and PRs share one number space, so a bare `#42` may refer to either: resolve it with `gh pr view 42` first, then fall back to `gh issue view 42` if that fails.

## When a skill asks to "publish to the issue tracker"

Create a GitHub issue.

## When a skill asks to "fetch the relevant ticket"

Follow "Read an issue" above.

## Wayfinding operations

For `/wayfinder`. A **map** is an issue, and a **child** issue is a ticket.

- **Map**: an issue with the `wayfinder:map` label whose body contains Notes / Decisions-so-far / Fog. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see "Make an issue a child of a parent issue"). When sub-issues are unavailable, add the child to the map body's task list and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the developer responsible for moving it forward.
- **Blocking**: see "Blocking" under "Conventions".
- **Frontier query**: list the map's open child issues (`gh issue list --state open`, scoped to the map's sub-issues / task list), exclude those with open blockers (see "Count open blockers", or open issues in the `Blocked by` line) or an existing assignee, and take the first one in map order.
- **Claim**: `gh issue edit <n> --add-assignee @me`; this is the session's first write operation.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append the context pointer (key points + links) to the map's Decisions-so-far.
