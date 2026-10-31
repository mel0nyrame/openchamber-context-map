# Layer degradation by failure source

Panel failures are not one kind. Host service unavailable (not installed, not authorized, paused, or the process exited), Collector unavailable (no discovery file, failed probe, version too old), and a single failed request (timeout, parse failure, unexpected status code) come from different layers, and the user can act differently on each. Collapsing them into one "failed to load" message confuses "install the Collector" with "retry in a moment".

A host failure replaces the whole content area and points to Settings → Extensions. Collector states show a placeholder: with no discovery file, it names `~/.config/opencode/plugins/`; with a discovery file but no record, it explains that sending one request is enough. A single failed request is kept silent when data already exists; only after 3 consecutive failures does the refresh policy take over. With no data, the placeholder appears immediately.

Status codes are also interpreted by source. `503` means the Service cannot find a usable Collector, and the panel treats it as "Collector is not running" rather than "Snapshot is temporarily unavailable"; `504` means waiting for the Collector timed out, and gets its own "Collector did not respond in time" message. Both retry on the next refresh.

An outdated Collector only produces a warning; it is never updated automatically. The Collector is a single file the user copies into the OpenCode plugin directory; the panel has no permission to write there and should not replace a running plugin without the user's knowledge.

**Considered options**

- Share one message for all failures: simple to implement, but users cannot tell whether to install the Collector, restart the Service, or just retry.
- Treat `503` as a normal request error: the panel would show "Snapshot is temporarily unavailable" when the real cause is that the Collector is not running, and retries would never succeed.
- Auto-update an outdated Collector: requires writing to the user's directory and offers no rollback.

**Consequences**

Messages live in `src/panel/failure.ts` (host failures) and in the panel model's body state (`src/panel/model.ts`, Collector and request failures). When adding an error code, change both the Service mapping and the panel's layers; changing only one lets the status code fall into "unexpected result".
