# openchamber-context-map

## Docs map

- `docs/modules.md` maps every file under `src/` and `scripts/` to its exports and job; read it before grepping the tree.
- `docs/adr/README.md` indexes the decisions by topic and by the module each one constrains; read the records for the area you are about to change.
- `GLOSSARY.md` defines the domain terms; use them in code, tests, and issues.
- `docs/opencode-plugin.md` records the verified OpenCode V2 plugin interface; read it before changing the Collector's integration.

## Engineering conventions

`ADR-nnnn` points to the record in `docs/adr/` that explains the rule; read it before changing that behaviour.

- After changing `src/`, run `bun run build` and commit `panel/`, `service/`, and `collector/` with the source; installation does not run a build. ADR-0004
- Before delivery, `bun test`, `bun run typecheck`, and `bun run check:docs` must pass.
- Keep panel geometry, rounding, and colors in pure functions (`src/panel/map.ts`, `src/panel/palette.ts`).
- Keep refresh timing in the pure state functions of `src/panel/refresh.ts`; `createRefreshController` owns the timer, and `src/panel/refresh-run.ts` performs one request. ADR-0007
- Read the theme from the `data-oc-theme` selector, never from the system preference.
- Layer failure states by source: host failure, Collector unavailable, and a single failed request each get their own state and copy. Never merge them into one generic error. ADR-0008
- The installer and the panel's Collector install accept only a missing target or a target this tool generated, and stop on conflict with the original file intact. ADR-0010, ADR-0015
- When rewriting `extensions.json`, preserve unknown fields. ADR-0010
- Panel copy lives only in `src/panel/i18n.ts`, and rendering code reads it through `t(locale, key)`; `en` is the source language, `zh` is a translation, and other locales fall back to `en`. ADR-0013
- Install, upgrade, and uninstall docs: read ADR-0015 and `src/panel/i18n.ts` first; for a feature still in a PR, read that PR's branch. The one-click flow is the panel's **Install Collector** and needs only the **Service** capability.
- One Collector per process: `setup()` joins the live one and the last released ticket closes it, while a `closing` promise blocks new starts until the shutdown ends; `removeDiscovery(file, owner)` deletes only a record that still describes the caller. The registry lives on `globalThis`, because OpenCode evaluates the plugin module more than once per process. ADR-0016
- Persistence stores only `SnapshotSummary` (including item heads), not previews; changing its fields requires bumping `SNAPSHOT_SCHEMA_VERSION`, and old files are discarded on a version mismatch. ADR-0014
- README and ADRs are English, with a `.zh.md` twin (`README.zh.md`, `docs/adr/0001-….zh.md`); change both together. `docs/agents/` is English; other docs under `docs/` are Chinese.
- When a ticket settles a decision or a convention, add the ADR and update `AGENTS.md` in the same commit.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues, managed with `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five canonical roles. See `docs/agents/triage-labels.md`.

### Domain docs

Single context: `GLOSSARY.md` and `docs/adr/` at the root. See `docs/agents/domain.md`.
