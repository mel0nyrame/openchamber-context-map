# Before the first request, use the most recent real request's system and tool definitions as a baseline

OpenCode has no interface to preview the first request: `session.context()` returns an empty array for an empty session, the `context` hook fires only before a real request goes to the provider, and the `ModelHooks` callbacks have no cancellation channel. The panel therefore cannot know what the first request will assemble before it happens.

On every real request, the Collector also records the system prompt and tool definitions for that `agent + model` (up to 5 entries, evicted in write order). When the current session has no snapshot yet, `/summary` looks up the template with the agent and model from `session.get()` and returns a snapshot containing only these two categories, marked `baseline: true` and `estimated: true`. The first real request replaces it immediately.

**Considered options**

- Silent probe: inject a synthetic message and interrupt immediately. `session.synthetic()` only delivers the message, the hook has no cancellation channel, the exception becomes a plugin error, and the message may remain in the session.
- Rebuild statically from `agent.list()`, `skill.list()`, and `tool.list()`: cannot obtain the built-in system template, the instruction assembly order, or rewrites by built-in plugins; the result looks precise but is quietly wrong.
- Stay empty before the first request: users explicitly asked to see the initial composition first, as pi's `/context` does.

**Consequences**

The baseline may lag behind configuration changes until the next real request updates it. The baseline has only System and Tool definitions; the skills summary and AGENTS.md remain inside System and are not listed separately. A new environment that has never sent a request for that agent + model still shows the empty state waiting for the first request. Baseline item ids carry no snapshot version suffix, so old ids become invalid naturally when the template is replaced.
