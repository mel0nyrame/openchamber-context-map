# Architecture decision records

Each record states one decision, the options it rejected, and what follows from it. Terms are defined in [`GLOSSARY.md`](../../GLOSSARY.md). The module column names the files the decision constrains, so a change can start from the record instead of from a search.

| # | Decision | Modules | Status |
| --- | --- | --- | --- |
| [0001](0001-two-part-architecture.md) | Collector inside OpenCode, extension inside OpenChamber, loopback HTTP between them | `src/collector/main.ts`, `src/service/main.ts`, `src/panel/main.ts` | Active |
| [0002](0002-last-request-only.md) | Keep only each session's last request, up to 20 sessions | `src/collector/store.ts`, `src/collector/snapshot.ts` | Active |
| [0003](0003-token-accounting.md) | Estimate category tokens by characters, then scale to the provider's total | `src/collector/snapshot.ts`, `src/collector/enrich.ts` | Active |
| [0004](0004-build-artifacts-committed.md) | Commit the three build artifacts with the source | `scripts/build.ts`, `panel/`, `service/`, `collector/` | Active |
| [0005](0005-snapshot-enrichment.md) | Snapshots land in memory first, then enrich asynchronously under a snapshot id | `src/collector/enrich.ts` | Active |
| [0006](0006-map-rendering.md) | The map draws the used composition; the bar carries the window remainder | `src/panel/map.ts`, `src/panel/view.ts` | Partly superseded by 0011 |
| [0007](0007-refresh-policy.md) | Poll only while busy; stop after repeated request failures | `src/panel/refresh.ts`, `src/panel/refresh-run.ts` | Active |
| [0008](0008-degradation-layers.md) | Layer degradation by failure source | `src/panel/failure.ts`, `src/panel/model.ts` | Active |
| [0009](0009-collector-routing.md) | Find a session across multiple Collectors | `src/service/main.ts`, `src/shared/discovery.ts` | Active |
| [0010](0010-installation.md) | Installation writes the host registry | `scripts/install.ts`, `scripts/install-lib.ts` | Active |
| [0011](0011-map-denominator.md) | The map uses the window as denominator and leaves free cells blank | `src/panel/map.ts`, `src/panel/view.ts` | Active |
| [0012](0012-baseline-snapshot.md) | Before the first request, reuse the most recent real request's system and tools | `src/collector/baseline.ts`, `src/collector/resolver.ts` | Active |
| [0013](0013-panel-localization.md) | English is the source language; other locales fall back to it | `src/panel/i18n.ts` | Active |
| [0014](0014-snapshot-persistence.md) | Persist snapshots to the state directory | `src/collector/persist.ts`, `src/shared/snapshot.ts` | Active |

Chinese translations sit next to each record with a `.zh.md` suffix.
