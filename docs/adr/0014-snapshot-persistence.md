# Persist snapshots to the state directory

Collector snapshots used to live only in memory and were cleared whenever OpenCode restarted, so the panel had no content until the next request. Now the skeleton returned by `/summary` is written per session to the state directory and read back at startup. The "keep only the last request" semantics still holds: what is restored is the last snapshot from the previous run, not history.

What is written is exactly `SnapshotSummary`: model, Used, window, `windowAssumed`, `estimated`, `baseline`, `collectedAt`, the eight category totals, and each item's `title`, `chars`, and first 200 characters of `head`. The item previews served by `/item` (up to 8000 characters each) are not written; after a restart, clicking an item returns 404.

By default, files live in `snapshots/` next to the discovery directory (when the discovery directory is overridden during development, in `snapshots/` under it), named `<sessionID>.json`, with a 0700 directory and 0600 files. Writes use a unique temporary name plus rename so concurrent setups do not race. Writes happen after asynchronous enrichment completes and are debounced per session; the `context` hook still performs no I/O. On dispose the Collector flushes once on a best-effort basis, but if the process is killed, the last debounced write is what remains.

At startup the Collector reads all files, sorts them by `collectedAt`, keeps at most 20 sessions, and discards anything older than 7 days. Files carry `schemaVersion`; a mismatched version is discarded rather than migrated. Eviction also deletes the file.

A restored snapshot carries `restored: true`, and the panel adds " · last run" next to "Updated"; the mark clears when a new request arrives for the same session and a new snapshot is written. Persistence is on by default; `CONTEXT_MAP_PERSIST=0` turns it off.

**Considered options**

- Store item previews too: tool results, file contents, and environment variables would reach disk, maximizing exposure for the sole benefit of avoiding one new request.
- Have the Service cache `/summary` responses it has fetched: the plugin would never touch disk, but only sessions whose panel was opened would be cached, and the Service would go from stateless to stateful.
- Write only on dispose: `kill -9` or a crash loses everything.
- Persist the baseline template too: would write the system prompt and AGENTS.md, for the sole benefit of showing `Estimated baseline` a little earlier in a new session.
- No expiry: files would accumulate with the number of sessions over time.

**Consequences**

Disk now holds 200-character prompt fragments per item, comparable in scale to local shell history, readable by the same account. Item previews are unavailable after a restart, and the panel needs a separate notice instead of reusing "Snapshot updated". A restored snapshot is the last request before the restart and may not match the session's current state, so it must be marked "last run". Changing the `SnapshotSummary` structure later requires bumping `schemaVersion`; old files are discarded.

ADR 0002's rule "do not write prompts to disk" is superseded by this record; "keep only the last request, do not backfill history, and do not store item previews" still holds.
