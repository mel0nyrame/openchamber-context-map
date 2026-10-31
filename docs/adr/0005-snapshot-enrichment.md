# Snapshots land in memory first, then enrich asynchronously with order-preserving scaling

The `context` hook is awaited on the request path, so the Collector does only synchronous work in the callback: categorize, count characters, slice, and write a draft snapshot. The provider's Used and the model window both require asynchronous queries (`ctx.session.context()`, `ctx.model.list()`), so they are filled in after the hook returns. Each snapshot carries a monotonically increasing id; an enrichment result replaces the record only when the current id matches, so a late result from an older request cannot overwrite a newer snapshot. ADR 0003 defines which fields count toward Used; this record covers only when enrichment runs and how rounding works.

Category tokens first get a weight of `ceil(chars / 4)`, then scale to the provider's Used with the largest remainder method: each category takes its integer share, and the remaining difference is distributed by fractional part from largest to smallest. The eight categories therefore sum exactly to Used, so the map, the breakdown, and the usage card never disagree. When everything is uncounted content such as media or effort, Used goes to other, preserving the same invariant.

**Considered options**

- Await the queries inside the hook: adds disk-read and model-list latency to every model request.
- Let asynchronous results overwrite directly: the previous request's enrichment would overwrite the newly written snapshot.
- Round each category: the eight categories would no longer sum to Used, and the map and card would disagree.
- Compute total shares first and round category by category: still needs remainder handling, has more steps, and produces the same result as the largest remainder method.

**Consequences**

Used lags one turn; for tool continuations the error is roughly the previous turn's assistant output plus one tool result. If the window query fails, the Collector falls back to 200000 and sets `windowAssumed`; this is an explicit field, not inferred from `window === 200000`, so a real 200k window is not mislabeled. Usage for a pure media request all falls under other.
