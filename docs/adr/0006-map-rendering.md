# The map draws only the used composition; the bar and Breakdown carry the window remainder

> The part of this document stating that cells express only used content is superseded by `docs/adr/0011-map-denominator.md`; the fixed palette, theme switching, and gradient rules still apply.

The context map has a fixed 200 cells (25×8 on desktop, 20×10 on narrow screens). Cells express only the composition of the used portion, and the total cell count does not change with usage. The window remainder is shown by the 5px bar below the map and the Free space row in Breakdown. The map answers "what is inside"; the bar answers "how much is used".

The category palette is a fixed set of eight colors plus a neutral color for Free space, one set for light theme and one for dark, switched by the `data-oc-theme` selector. A boundary cell uses a hard-stop gradient based on the two categories' shares within the cell, with stop points computed by pure functions.

**Considered options**

- Lay out cells by Window and leave free cells blank: at low usage the category cells shrink until they are unreadable, and this duplicates the bar's role.
- Derive eight category colors from the host primary color: the host provides only one primary color, the derived colors lack separation, and contrast cannot be checked in one pass.
- Color a boundary cell with the dominant category: it misreports the presence of the other category.
- Draw gradients with canvas or per-cell clipping: pure functions plus CSS gradients are sufficient and add no extra complexity.

**Consequences**

Category order is fixed to the order of `CATEGORIES`; map position does not follow size sorting. Adding a category requires adding both palettes and rechecking contrast. Contrast is computed against an approximate background, so a real host theme may differ. Cells represent composition only; usage cannot be read from the cell count, so readers must look at the bar or the usage card.
