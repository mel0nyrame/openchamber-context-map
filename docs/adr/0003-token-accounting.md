# Token accounting: estimated shares calibrated against provider usage

The event from `hook("context")` has no usage fields, only the assembled content, so category tokens can only be estimated as `ceil(characters / 4)`. Used is not taken directly from the estimate: the Collector reads the `tokens` of the most recent assistant message in the same session, uses `input + cache.read + cache.write` as the real input total, and scales each category's estimated tokens proportionally to that total. `input` itself excludes cache (`@opencode/schema/dist/token-usage.js:12-14`), so reading only `input` underestimates. When there is no provider value, or the snapshot contains `media`, the whole snapshot is marked estimated.

**Considered options**

- Pure estimation: simplest to implement, but the error drifts with content type and users cannot judge confidence.
- `await ctx.session.context()` inside the hook to get usage: the hook is awaited one by one before provider dispatch, so it adds disk-read latency to every model request, and the value returned is still from the previous turn.

**Consequences**

For tool continuations, Used lags one turn; the error is roughly the previous turn's assistant output plus one tool result. Images count as 0 tokens, and with multiple images the whole snapshot is marked estimated. See `docs/adr/0005-snapshot-enrichment.md` for when enrichment runs and how rounding works.
