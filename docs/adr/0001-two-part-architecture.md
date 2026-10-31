# Two-part architecture: OpenCode Collector + OpenChamber extension

A single OpenChamber extension cannot obtain the assembled `system`, `tools`, and `messages`; a single OpenCode plugin has no UI surface. Context Map therefore splits into two parts: the Collector runs inside the OpenCode process and uses `ctx.session.hook("context")` to capture the assembled request just before it is sent; the extension provides the right rail panel and the host service. The two communicate over loopback HTTP: the Collector binds to a random port on `127.0.0.1` with a random bearer token and writes the port, token, and version to a 0600 discovery file; the Service scans discovery files to find the Collector and proxies `/summary` and `/item`; the Panel reaches the Service only through `serviceRequest` and never receives the Collector's token.

**Considered options**

- Single extension: cannot obtain the assembled request, can only read persisted messages, and misses system and tools.
- Single OpenCode plugin: no mountable interface.
- Shared file or named pipe: no request/response semantics; requires custom polling, framing, and cross-process permissions.
- Reading OpenCode storage directly: returns persisted messages rather than the assembled request, and diverges from the real request after compaction.

**Consequences**

Users must install two things; when the Collector is not loaded, the panel can only degrade to a notice. Discovery files left by a crashed Collector are cleaned up by the Service after a failed connection.
