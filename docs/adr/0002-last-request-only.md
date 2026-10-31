# Snapshots keep only the last request

The panel answers "what is in this session's context now", not "how did history change". The Collector keeps a snapshot only for each session's last request, up to 20 sessions in memory (LRU). It does not backfill history, build a subagent tree, or write prompts to disk; it keeps character counts, category totals, and a preview truncated to 8000 characters per item. Backfilling history would multiply memory use and the privacy surface, and it does not serve the panel's purpose.

**Consequences**

After OpenCode restarts there is no data until the next request. A tool continuation replaces the previous snapshot for the same turn, so the panel may jump while busy.

The rule "do not write prompts to disk" is superseded by ADR 0014: the snapshot skeleton is now persisted to the state directory. "Keep only the last request, do not backfill history, and do not store item previews" still holds.
