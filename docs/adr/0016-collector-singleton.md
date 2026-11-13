# Run one Collector per process and delete only your own discovery record

OpenCode loads a plugin again whenever a workspace or location opens. One `opencode serve` process therefore called `setup()` eleven times in a single run, and five Collector instances were alive at once on five ports. Every instance used the same discovery path, `discoveryFileName(process.pid)`, so each write replaced the previous record. Any cleanup then removed the shared file, including the cleanup of an instance that had already been replaced. The Service found no discovery entry, answered `not_found`, and the panel stayed on "Waiting for first request" until OpenChamber restarted, because the file is written once per Collector lifetime and never rebuilt.

The Service had a second way to lose a live record: `resolveRoute` removed every discovery file whose 1 second probe failed, with no check of what the file described at that moment.

**Decision**

- `setup()` joins the process's single Collector. Each call holds one ticket in `open`; the Collector shuts down only when the last ticket is released, and every cleanup waits for the shared shutdown. A re-load therefore reuses one port, one token, and one discovery file, and registers the `context` hook once.
- The registry of that Collector lives on `globalThis` under `Symbol.for("openchamber-context-map.collector")`, not in module scope. OpenCode evaluated the plugin module more than once in the same process: after a restart, one process ran 24 loads and still held two Collectors that two module instances had started. Module-scope state cannot see the other module instance; `globalThis` can.
- `removeDiscovery(file, owner)` deletes the file only when it still describes the same Collector (`pid`, `port`, `token`). The Collector passes its own record, and the Service passes the record it just probed, so a record a newer instance wrote during the probe survives.

**Considered options**

- Give each instance a unique file name (`collector-<pid>-<random>.json`): removes the overwrite, but several live Collectors in one process then hold separate stores, separate tokens, and a duplicate hook, so one request is counted several times and the Service polls dead entries.
- Refuse the second `setup()`: a reload would leave the panel without a handle to the Collector, and the first load's cleanup could still arrive later and stop it.
- Keep removing unconditionally and rely on a single write: after a reload the directory keeps a record of a Collector that no longer exists, and every request probes it until the process exits.
- Stop removing failed records in the Service: dead records accumulate and every request pays their probe timeout.

**Consequences**

`collector-<pid>.json` still names one file per process, which is now accurate. A record can describe a Collector that has stopped only when the process died without cleanup; the Service drops it after a failed probe, and the owner check keeps the drop from hitting a fresher record. The first `setup()` call after start decides the plugin context; later calls in the same process reuse it.

A later module instance only adds a ticket to the shared handle; it registers no hook and opens no port. Its cleanup therefore stops the Collector through the owning module's `dispose`, which is the only code that holds the server, the hook, and the writer.
