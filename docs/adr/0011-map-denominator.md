# The map uses the window as denominator and leaves free cells visibly blank

Each cell of the map represents 1/200 of the window. The used portion fills the first cells by category, and the remaining cells are drawn as empty cells with a 1px outline to represent Free space. The default denominator is the model window; clicking Zoom next to the map title or pressing `Z` switches to Fit, where the denominator becomes `min(window, ceil2sig(used × 1.15))`, with a floor of 10,000. The legend shows both Free space and the used token count.

The map thus answers both "what is inside" and "how much is left", without cross-checking the bar, Breakdown, and map. With the window as the default denominator, cell positions stay stable within a session, so usage growth is directly comparable across consecutive requests; Fit is only a way to inspect composition up close.

**Considered options**

- Keep ADR 0006's "draw only used": at low usage the remaining space is invisible, and users explicitly reported that they could not tell how much space was left.
- Default to Fit: the denominator changes after every request, cells rearrange, and two requests cannot be compared.
- Add a third zoom level or a true zoomed view: there are only 200 cells now, and two levels already cover "see the total" and "see the composition".
- Draw free cells as a dot pattern or a separate Free bar: dots are noisy on 5px cells, and a separate bar duplicates the bar's role.

**Consequences**

The part of ADR 0006 stating that cells express only the used composition is superseded by this record; the fixed palette, `data-oc-theme`, and hard-stop gradients still apply. The used cell count is rounded as `round(used / denominator × 200)`, with a minimum of 1 cell; usage below one cell still fills one cell, and exact numbers are in the usage card and Breakdown. Fit's `ceil2sig` matches pi-context-view, and the label shows the rounded denominator (for example 99k), not the raw value.
