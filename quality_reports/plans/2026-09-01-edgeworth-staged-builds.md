# Plan: Staged Edgeworth box builds (slides 02)

Date: 2026-09-01
Branch: main
Requested by: Ivan
Builds on: quality_reports/plans/2026-09-01-edgeworth-r-figures.md (executed; three
single-version R figures now in the deck and confirmed rendering)

## Goal

Replace each single-version Edgeworth figure in
`slides/02-slides-market-failures.Rmd` with a step-by-step build: a sequence of
slides, each showing one stage of the figure, aligned with the existing
narrative text. Three families: the standard box, the contract curve, and the
public-good box.

## Shared requirements

- One drawing function per family, defined in that family's first chunk,
  taking stage toggles (e.g. `draw_edgeworth_box(show_lens = TRUE,
  show_optimum = FALSE, ...)`), so each stage chunk is a short call. Keep the
  existing Cobb-Douglas parameterization from the current `edgeworth1` chunk so
  every stage is geometrically consistent, with tangencies computed exactly.
- Named chunks with `echo = FALSE, fig.show = 'hide', warning = F` and the
  existing fig.width/fig.height per family. Display each figure on its slide
  with the `<center>` + `knitr::include_graphics(knitr::fig_chunk("label",
  "png"))` + `out.width` pattern now in the deck. NEVER a markdown image
  reference inside an HTML block — remark leaves it as literal text (see
  `MEMORY.md` `[LEARN:xaringan-figures]`).
- House style as before: theme_minimal base, no gridlines, white background,
  `"#ca5670"` red for A, `"#638ccc"` blue for B, grey50 dashed reference
  lines, annotate labels in clear whitespace.
- Remove the outer X-Y axes on ALL box figures (all three families): no axis
  lines, no ticks, no axis titles; the box border is the only frame. Keep
  small "X" and "Y" text annotations just outside the box (bottom-right and
  upper-left, as in the original screenshots). The two-panel figure in stage
  1 of family 1 is the exception: each separate panel keeps its own axes,
  since the point is that they are ordinary individual diagrams.
- Slide mechanics: consecutive repeated slides, one stage per slide (the
  deck's existing pattern), preserving the current `.pull-left`/full-width
  layouts and `out.width` values of the slides being replaced. Keep existing
  slide text; add the small amounts of new text specified below, written in
  the deck's plain, terse slide voice.

## Family 1: standard Edgeworth box (five figures)

1. `edgeworth1-panels` (NEW slide, inserted before the first box slide):
   two separate side-by-side diagrams (patchwork is already loaded): A's
   ordinary consumption diagram (origin bottom-left, X and Y axes, endowment
   point, initial indifference curve, red) and B's ordinary diagram (origin
   bottom-left, its own endowment and initial indifference curve, blue), both
   using the same endowment/utility numbers as the box. Slide text (2-4
   lines): each person has an ordinary diagram; rotate B's diagram 180
   degrees and set it on top of A's so the endowment points coincide — the
   result is a box whose width is the total endowment W_X and height W_Y.
2. `edgeworth1-box`: box + endowment open circle + dashed reference lines +
   UA(0) and UB(0) + edge labels w(x,A), w(x,B), w(y,A), w(y,B) + A, B corner
   labels. No lens shading, no optimum. Used on: the current full-width
   slide (out.width 80%), the "Total vertical distance..." slide, and the
   "Is there a possible Pareto improvement?" slide.
3. `edgeworth1-lens`: stage 2 plus the lens between UA(0) and UB(0) shaded
   (low-alpha fill computed from the true indifference curves, not freehand).
   Used on the first "Yes!" slide; add one text line naming the shaded lens
   as the set of Pareto improvements.
4. `edgeworth1-optimum`: stage 3 plus the filled tangency point and the
   tangent higher curves UA*, UB* (the content of the current figure, with
   the lens still shaded). Used on the "Yes! If we move anywhere in the
   lens..." slide.
5. `edgeworth1-paretoset` (NEW slide, after stage 4): stage 4 plus the
   segment of the contract curve lying inside the lens, drawn thick and dark
   and labeled "Pareto set". Compute it as the locus where MRS_A = MRS_B
   between the two initial indifference curves. Slide text: this segment is
   the set of Pareto-efficient allocations actually reachable by voluntary
   trade from the endowment. It leads into the existing "contract curve"
   text slide that follows.

## Family 2: contract curve (three figures; budget line REMOVED)

Ivan's call: the budget line in the old figure served no purpose in this
narrative and is dropped. The sequence instead shows how different initial
allocations lead to different achievable Pareto sets on the same contract
curve. Replace the single edgeworth2 slide with three full-width slides
(similar out.width to the current 50% slide, adjust up slightly if labels
need the room):

- `edgeworth2-curve`: box + full contract curve from A's origin to B's
  origin + three or four tangency points, each with a short pair of tangent
  red/blue arcs. Text: the contract curve collects every allocation where
  the indifference curves are tangent — all the Pareto-efficient allocations.
- `edgeworth2-core1`: stage 1 plus an endowment c (open circle, off the
  curve) + A's and B's indifference curves through c forming a lens + the
  contract-curve segment inside that lens drawn thick. Text: starting from
  c, voluntary trade reaches only this segment — the achievable Pareto set
  for that endowment.
- `edgeworth2-core2`: stage 2 plus a second endowment c' in a clearly
  different region of the box, with its own lens and its own thick segment
  on the same contract curve (first endowment's elements kept but faded to
  grey so the contrast reads). Text: a different initial allocation gives a
  different achievable Pareto set on the same contract curve.

## Family 3: public-good box (staged to follow the existing slide text)

The nine existing edgeworth3 slides keep their right-column text; each now
shows the stage matching its text. W1's completed story fades to grey when
the W2 story starts.

- `edgeworth3-endowments`: box + W1 and W2 open circles + dotted vertical
  connector + labels only (no indifference curves, price lines, or Z
  points). Slides: "Depending on who has property rights..." and "Suppose we
  start at W1, what happens?"
- `edgeworth3-w1-conflict`: plus A's (red) and B's (blue) indifference
  curves through W1, showing A gains from more Y while B loses. Slide: "A
  wants to have more Y, but this imposes a cost on B".
- `edgeworth3-w1-pay`: plus the price line from W1 running up-left. Slide:
  "Therefore, A has to pay B to get more Y".
- `edgeworth3-w1-opt`: plus the filled Z1 tangency with the two tangent
  curves. Slide: "A pays B in units of X, move to Z1, Pareto optimum".
- `edgeworth3-w2-start`: W1 story faded to grey; W2 emphasized. Slide:
  "Suppose we start at W2, what happens?"
- `edgeworth3-w2-conflict`: plus curves through W2 (B wants less Y, A loses).
  Slide: "B wants to have less Y, but this imposes a cost on A".
- `edgeworth3-w2-pay`: plus the price line from W2 running down-right.
  Slide: "Therefore, B has to pay A to get less Y".
- `edgeworth3-w2-opt`: plus the filled Z2 tangency. Slide: "B pays A in
  units of X, move to Z2, Pareto optimum".

## Addendum (2026-09-01, after Ivan reviewed the staged build)

1. Panels slide: draw both panels over identical axis ranges [0, W_X] and
   [0, W_Y] and label the axis extents W_X and W_Y on both panels, so it is
   visually clear the two diagrams are the same size. Title the axes X_A/Y_A
   on A's panel and X_B/Y_B on B's panel.
2. Dual-label the box axes on every box-form figure: X_A along the bottom
   edge, X_B along the top edge, Y_A along the left edge, Y_B along the right
   edge (replacing the single X and Y annotations). Family 3 keeps a single
   shared Y label on the left (Y is the same public good for both) with
   X_A/X_B dual labels.
3. No trailing periods on slide text lines — the deck's style. Strip them
   from every line added in this project (panels, lens, Pareto-set,
   contract-curve, and endowment slides).
4. Move "If we move anywhere in the lens of their initial indifference
   curves we have a Pareto improvement" from the optimum slide up to the
   lens slide (with "Yes!" and the shaded-lens line).
5. Replace the single optimum stage with a traced build of the Pareto set:
   first tangency (current optimum figure, text saying only a subset of the
   lens is Pareto efficient — allocations where no further Pareto
   improvement is possible, i.e. where the indifference curves are tangent,
   like the filled-in point); then one or two more slides each adding
   another tangency point with its own tangent indifference-curve pair at a
   different spot inside the lens (points on y = 0.8x within x in
   [4.38, 4.98]); then the full thick segment connecting them — the Pareto
   set — leading into the existing final Pareto-set slide. Each stage is a
   separate figure/slide in the deck's repeated-slide pause style.

## Codex Handoff

Saved plan path: `quality_reports/plans/2026-09-01-edgeworth-staged-builds.md`

Codex-owned steps:

1. Implement the three families above in
   `slides/02-slides-market-failures.Rmd`, replacing the current
   `edgeworth1`/`edgeworth2`/`edgeworth3` chunks and their display chunks
   with the staged versions and inserting the two new slides (family 1
   stages 1 and 5) and the two extra family-2 slides.
2. Render from `slides/`:
   `Rscript -e "rmarkdown::render('02-slides-market-failures.Rmd')"` with the
   established process-local pacman::p_load workaround that skips the missing
   `tweetrmd` package (do not modify the setup chunk or install packages).
3. Self-review every generated stage PNG against its spec: correct elements
   for the stage, no outer axes on box figures, no label collisions, lens
   shading bounded by the true curves, faded elements clearly secondary.
   Check that each slide displays the right stage. Fix and re-render before
   handing back.
4. Report: render exit status, list of generated stage PNGs, the
   slide-to-stage mapping as implemented, and any text lines added.

Acceptance criteria:

- Deck renders end-to-end with exit 0; all stage figures generated.
- Every Edgeworth slide shows the stage assigned above; the two new family-1
  slides and two extra family-2 slides exist with brief text in deck voice.
- No outer axis lines, ticks, or axis titles on any box figure; X/Y remain as
  small annotations; the panels figure keeps per-panel axes.
- No budget line anywhere in family 2.
- Geometry exact (tangencies satisfy MRS equality; Pareto-set segments lie on
  the true contract curve); labels in clear whitespace.
- No commits, staging, or pushes; only this Rmd and its render outputs
  modified; `problem-sets` symlink untouched; original screenshot PNGs left
  in place.

Review: Claude re-renders nothing itself except a chrome_print check of the
final html, reviews the diff and every stage PNG against this plan, and runs
one fix round with Codex if needed.
