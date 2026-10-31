# Domain docs

How engineering skills consume this repository's domain docs while exploring the codebase.

## Read these before exploring

- **`GLOSSARY.md`** at the repository root, or
- **`GLOSSARY-MAP.md`** at the repository root (if present): it points to one `GLOSSARY.md` per context. Read every one relevant to the current topic.
- **`docs/adr/`**: read the ADRs that touch the area you are about to change. Multi-context repositories should also check context-level decisions in `src/<context>/docs/adr/`.

If these files do not exist, **continue silently**. Do not point out the absence and do not suggest creating them. The `/domain-modeling` skill (reached through `/grill-with-docs` and `/improve-codebase-architecture`) creates them on demand when terminology or decisions actually become settled.

## File structure

Single-context repository (most repositories):

```text
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context repository (`GLOSSARY-MAP.md` exists at the root):

```text
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← system-level decisions
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← context-level decisions
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## Use glossary vocabulary

When naming domain concepts in output (issue titles, refactoring proposals, hypotheses, test names), use the terms defined in `GLOSSARY.md`. Do not drift to synonyms the glossary explicitly avoids.

A concept you need that is not yet in the glossary is a signal: either you are inventing language the project does not use (reconsider), or there is a real gap (record it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly instead of silently overriding it:

> _Contradicts ADR-0007 (event-sourced orders), but worth revisiting because…_
