# Find a session across multiple Collectors

Each OpenCode instance runs one Collector, and each writes its own discovery file. When the user has several instances open, a given session belongs to only one of them. A Service that asks only the newest instance reports 404 when the session belongs to an older instance, and the panel shows "Waiting for first request" even though the record exists.

When resolving a route, the Service enumerates all discovery files, probes each one (1 second timeout), and sorts the instances that pass by `startedAt`, newest first. It then forwards the request to each in turn under a shared 3 second budget: `400` returns immediately, because the request itself is wrong and another instance will not help; `404` moves on to the next instance; `200` returns immediately. Only when all instances return 404 does it return 404; if an instance timed out and no 200 arrived, it returns 504; any other failure returns 503.

**Considered options**

- Ask only the newest instance: simple, but reports an empty record when multiple instances coexist.
- Choose by discovery file mtime: mtime only reflects write time, not whether the instance is still alive.
- Parallel fan-out: lowest latency, but every request hits every instance and multiple results create races.

**Consequences**

In the worst case the Service asks N instances serially, bounded by the 3 second budget, and one slow instance eats into the time available to later instances. Unrelated files in the discovery directory are skipped during parsing and never enter the candidate list.
