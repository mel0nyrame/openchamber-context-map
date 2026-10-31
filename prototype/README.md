# UI prototype

Throwaway design references, not product code. The panel itself lives in `src/panel/`; these files only answer "which layout did we compare".

| File | What it is |
| --- | --- |
| `context-map.html` | Three panel variants, switchable at runtime with `?variant=A`, `B`, or `C` |
| `context-map-v2.html` | Layout comparison with toggles for header, status, grid (25×8 or 16×16), and theme |
| `server.ts` | Serves `context-map.html` on port 4173 (`bun prototype/server.ts`) |

## `context-map.html` structure

| Lines | Content |
| --- | --- |
| 14–854 | CSS, including the three variant layouts |
| 856–956 | Static markup and the chat shell around the panel |
| 957–1330 | Fixture data: `MODEL`, `CATS`, token counts, items |
| 1331–1363 | Totals, the `VARIANTS` map, helpers, `state` |
| 1364–1474 | Shared render helpers: map cells, category list, detail list, inline preview |
| 1475–1599 | Variant A (composition + inspector) and B (treemap) |
| 1600–1695 | Variant C (ledger table) |
| 1696–1828 | Variant switching, keyboard handling, initial render |

Read the fixture block before the renderers; every renderer reads `CATS`, so a search for a label starts there rather than in the 900 lines of CSS.
