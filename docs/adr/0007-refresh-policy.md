# Poll only while busy; layer failures by source

The panel does not poll continuously. While a session is busy it refreshes every 2 seconds; when the session turns idle it stops immediately, and it also stops when the session changes or the panel is hidden. It uses a `setTimeout` chain rather than `setInterval`: the next wait starts after the previous request finishes, requests never overlap, and stopping or resetting is simpler.

Failures fall into two classes. A failed host or Service request counts toward consecutive failures; after 3 in a row the panel stops automatic refresh and shows a banner, and a successful manual refresh restores it. A disconnected Collector does not count: `/health` still succeeds, only `collector.connected` is false, so the panel enters the "Collector is not running" state and keeps polling. Counting a disconnected Collector as a failure would prevent polling from resuming automatically when the Collector comes back.

SDK 2.5.3 has no panel visibility or close callback, so hidden detection uses `document.visibilitychange` and `pagehide` / `pageshow`. A session's `failure` lifecycle only means the state is unknown; it does not rewrite busy.

**Considered options**

- Poll every 2 seconds continuously: sends requests while idle, and "Updated" would keep moving with each request.
- `setInterval`: requests overlap when one is slow, and stopping or resetting is hard to align.
- Count a disconnected Collector as a failure: duplicates the existing connection state, and once polling stops it cannot resume when the Collector recovers.
- Use `focus` / `blur` to detect visibility: misjudges when the panel is visible but not focused.

**Consequences**

If the host hides the panel with CSS without changing document visibility, the panel still polls while busy; covering that case exactly requires a host API. When `failure` is set and busy is true, if the host never sends `busy=false` afterwards, the panel keeps polling until the session changes or the panel is hidden.
