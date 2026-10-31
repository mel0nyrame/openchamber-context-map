# Context Map

Context Map is a panel on the right rail of OpenChamber that shows the context composition of the current session's last model request. It has two parts: the Collector, which runs inside the OpenCode process, and the OpenChamber extension, which provides the interface and the proxy.

## Language

**Snapshot**:
A record of the context composition of a model request at the moment before it is sent, including categories, items, and token statistics.
_Avoid_: report, dump, trace

**Last request**:
The most recent request the current session is about to send to the model provider, including tool continuations in the same turn.
_Avoid_: current context, latest prompt

**Category**:
One of the snapshot's eight fixed buckets: System, Tool definitions, User messages, Assistant text, Reasoning, Tool calls, Tool results, Other.
_Avoid_: grouping, type, section

**Item**:
The smallest displayable unit within a category: one system part, one tool definition, or one message part.
_Avoid_: entry, row, record

**Preview**:
The truncated text of an Item, at most 8000 characters, held only in memory.
_Avoid_: content, body, source text

**Used**:
The total number of tokens actually used by the last request.
_Avoid_: occupancy, usage, consumed

**Window**:
The maximum number of context tokens the model accepts, taken from the model's declared `limit.context`.
_Avoid_: limit, capacity

**Free space**:
The part of Window left after subtracting Used.
_Avoid_: remainder, headroom

**Estimated**:
A token count derived from character counts and not confirmed by the provider.
_Avoid_: approximation, approximate

**Collector**:
The plugin that runs inside the OpenCode process and records snapshots before requests are sent.
_Avoid_: plugin, agent, probe

**Discovery file**:
The local file the Collector writes at startup so the extension can find it.
_Avoid_: registry, config

**Stale discovery**:
A discovery file that points to a Collector that has exited; the Service deletes it after a failed connection.
_Avoid_: zombie file, leftover config

**Service**:
The host-side process of the OpenChamber extension; it discovers Collectors and passes snapshots to the Panel.
_Avoid_: backend, server, proxy

**Panel**:
The interface running in a sandboxed iframe; it only displays data provided by the Service.
_Avoid_: frontend, UI, webview

**Surface**:
An identifier for a mountable interface location in OpenChamber; Context Map uses `plugin:context-map`.
_Avoid_: tab, view
