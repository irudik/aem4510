# Plan: Draw the Edgeworth box figures in R (slides 02)

Date: 2026-09-01
Branch: main
Requested by: Ivan

## Goal

Replace the three Edgeworth box screenshots in
`slides/02-slides-market-failures.Rmd` — `files/02-edgeworth1.png`,
`files/02-edgeworth2.png`, `files/02-edgeworth3.png` — with figures drawn in R
inside the deck, so they are reproducible and match the deck's visual style.

## Deck conventions to follow

The deck draws every other figure in a named chunk with
`echo = FALSE, fig.show = 'hide', warning = F`, then places it on slides with
`![alt text](` `r knitr::fig_chunk("chunk-name", "png")` `)`. A figure drawn
once can be reused on many slides by repeating the `fig_chunk` reference. See
the `pmb-pmb` chunk near line 152 and the `neg-ext` chunk near line 554 for the
house style:

- ggplot2, `theme_minimal()`, all four gridline sets removed, white plot and
  panel background, black axis lines, `legend.position = "none"`.
- Curves drawn with `stat_function` or `geom_function`/`geom_line`,
  `size = 1.5`; A-related curves in `"#ca5670"` (red), B-related in
  `"#638ccc"` (blue); dashed reference lines in `"grey50"`.
- Labels placed with `annotate("text", ..., size = 6)` to `size = 8`;
  mathematical labels via `expression()`.
- The setup chunk sets `cache = TRUE` deck-wide; new chunks inherit that.

Use exact geometry rather than freehand curves: give A and B Cobb-Douglas
utility over (x, y) measured from their own origins, so indifference curves,
the contract curve, and tangency points can be computed analytically. Color
the two agents' curves red (A) and blue (B) — an improvement over the
black-and-white screenshots and consistent with the rest of the deck.

## Figure content requirements

The R figures must reproduce the pedagogical content of the screenshots; exact
pixel layout does not matter. The slides that reference each figure are listed
so label sizes can be checked at the rendered size.

### edgeworth1 — standard Edgeworth box (5 slides, lines ~1320–1387)

- Rectangular box. A's origin bottom-left (labeled A) with axis labels X
  (horizontal) and Y (vertical); B's origin top-right (labeled B).
- Endowment point marked with an open circle, right of center and low in the
  box. Dashed vertical and horizontal lines through it spanning the box. Edge
  labels: `w(x,A)` on the bottom edge, `w(x,B)` on the top edge, `w(y,A)` on
  the left edge, `w(y,B)` on the right edge (positioned on the segments the
  endowment splits, as in the screenshot).
- Indifference curves for A and B through the endowment, labeled `UA(0)` and
  `UB(0)`, forming a lens.
- A Pareto-optimal allocation inside the lens marked with a filled circle,
  where two higher indifference curves labeled `UA*` and `UB*` are tangent.
  Compute the tangency exactly (a point on the contract curve strictly inside
  the lens).

### edgeworth2 — contract curve and the core (1 slide, line ~1423)

- Box with origins labeled at bottom-left and top-right (the screenshot uses
  O1/O2; keep A/B for consistency with the other two figures).
- The contract curve from one origin to the other, with three or four tangency
  points along it, each showing a short pair of tangent indifference-curve
  arcs. Asymmetric Cobb-Douglas shares give a bowed contract curve like the
  screenshot; symmetric shares give the diagonal. Either is acceptable.
- An endowment point labeled `c` with a straight budget line through it,
  labeled "budget line, slope = " `expression(-p[1]/p[2])`.
- The segment of the contract curve lying inside the lens through `c` drawn
  noticeably thicker (the core), plus text labels "Contract curve" and
  "Pareto set".

### edgeworth3 — public good/bad version (9 slides, lines ~1458–1626)

- Box wider than tall. A's origin bottom-left (labeled A), B's label
  top-right (labeled B), X on the horizontal axis. Y is a public good/bad:
  both consume the same vertical level. Edge labels `w(x,A)` on the bottom
  edge and `w(x,B)` on the top edge.
- `W1`: open circle at the middle of the bottom edge (B holds property
  rights). `W2`: open circle at the same x on the top edge (A holds property
  rights). A dotted vertical line connecting W1 and W2.
- From W1, a straight price line with negative slope running up and to the
  left to a filled point `Z1` in the lower-left region, where one A
  indifference curve and one B indifference curve are tangent to the line.
- From W2, the analogous price line running down and to the right to a filled
  point `Z2` in the upper-right region, again with two tangent indifference
  curves.
- Labels: `W1`, `W2`, `Z1`, `Z2`.

## Codex Handoff

Saved plan path: `quality_reports/plans/2026-09-01-edgeworth-r-figures.md`

Codex-owned steps:

1. In `slides/02-slides-market-failures.Rmd`, add three named figure chunks
   (`edgeworth1`, `edgeworth2`, `edgeworth3`) following the deck conventions
   above, each placed at the first slide that uses the figure. Choose
   `fig.width`/`fig.height` per chunk so the rendered size on each slide is
   comparable to the current screenshots (the current references use
   `out.width` of 80%, 100% in `.pull-left`, and 50%; the deck's
   `mmr-coverage-trend` chunk shows the sizing pattern, `fig.width = 11,
   fig.height = 5.6`).
2. Replace every `knitr::include_graphics("files/02-edgeworthN.png")` block
   (15 references across the slides listed above) with the corresponding
   `![...](` `r knitr::fig_chunk("edgeworthN", "png")` `)` reference,
   preserving the surrounding `<center>`/`.pull-left` structure used by
   neighboring figure slides.
3. Leave `slides/files/02-edgeworth1.png`, `02-edgeworth2.png`, and
   `02-edgeworth3.png` in place; do not delete them.
4. Render the deck from the `slides/` directory:
   `Rscript -e "rmarkdown::render('02-slides-market-failures.Rmd')"`.
   Chunk caching is on; clear the deck's cache directory for these chunks if
   stale results interfere.
5. Self-review: open the three generated PNGs and confirm every element in
   the content requirements is present and legible at slide size; confirm no
   label overlaps a curve badly; fix and re-render as needed before handing
   back.

Acceptance criteria:

- `grep -c 'include_graphics("files/02-edgeworth'
  slides/02-slides-market-failures.Rmd` returns 0.
- The deck renders end-to-end with exit status 0 and no new warnings
  attributable to the new chunks.
- Three PNGs generated by the new chunks exist under
  `slides/02-slides-market-failures_files/figure-html/`.
- Each figure contains all elements in its content-requirements list, in the
  deck's visual style (white background, no gridlines, black axis lines, red
  A curves, blue B curves).
- Every slide that previously showed a screenshot now shows the R figure.

Expected verification commands:

```
cd slides && Rscript -e "rmarkdown::render('02-slides-market-failures.Rmd')"
grep -c 'include_graphics("files/02-edgeworth' slides/02-slides-market-failures.Rmd
ls slides/02-slides-market-failures_files/figure-html/ | grep edgeworth
```

No-commit default: Codex does not commit, stage, or push; the working tree is
left for Claude and Ivan to review.

Cautions: `problem-sets` at the repo root is a symlink into Box cloud storage
— do not read, write, or traverse it. Do not modify anything outside
`slides/02-slides-market-failures.Rmd` and its render outputs.

Review: Claude reviews the diff, the rendered figures, and the reported
verification output against the acceptance criteria; one Codex fix round and
one Claude re-review by default.
