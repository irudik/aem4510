# Project Memory

[LEARN:permit-game-teaching]
- Date: 2026-09-24
- Trigger: User found the student permit-value table confusing and wanted the game to match the slides.
- Wrong: Presenting a schedule of what successive permits are worth as the main student reference.
- Right: Show MAC against emissions, as in lecture 06. Let students discover the price comparison through bidding, trading, and changes in required abatement. Explain MAC = P after play, allowing for whole permits.
- Scope: Permit-market student interface.
- Evidence: User instruction on 2026-09-24; slides/06-slides-permits.Rmd.
- Action: Use MAC and emissions language in student guidance and verify any displayed costs against the game’s scoring rules.

[LEARN:permit-game-bid-limit]
- Date: 2026-09-24
- Trigger: User noted that four bid rows cannot express more than four steps of a firm's MAC schedule.
- Right: Allow a separate bid for every unit of baseline emissions, while keeping total bid quantity at most baseline. Both API validation and the database constraint must allow this.
- Scope: Permit-market auction bidding and instructor MAC comparisons.
- Evidence: Migration 002_flexible_auction_bids.sql applied to class project vuporrnrpfuibrtwqxww; the validated constraint is bid_index > 0 and all eight pre-existing bid records remained. Full-schedule bids for all firm types pass tests.
- Action: Keep instructor charts on the lecture's emissions axis: aggregate MAC beside individual firm MACs on a common axis, with identical firms explicitly listed together. Apply database migrations before deploying the corresponding website changes.

[LEARN:permit-auction-teaching]
- Date: 2026-09-24
- Trigger: User reported that students do not know what a uniform-price sealed-bid auction is.
- Wrong: Describing the auction in auction-theory terms ("bid units are stacked", "quantities are not cumulative") with free-form price/quantity rows.
- Right: Present the auction as supply (the cap) meeting demand (the bids), with the MAC curve as the firm's permit demand from min C(E) + pE. Students enter one price per permit; a what-if price slider uses only their own bids; after each auction clears they see the class's bids as a step demand curve against a vertical supply curve at the cap, with the clearing price. The three-firm example (A 12/9/6/3, B 10/7/4/1, C 8/5/2, five permits, price 7) is shared by lecture 06 and the student page; tests check its numbers, not the slide text. Under the game's lowest-winning-bid rule, shading pays whenever a bid may set the price, so slides say bidding close to MAC is close to optimal with many bidders, not that it is always optimal. RGGI charges the highest losing bid; the EU ETS and California-Quebec charge the lowest winning bid.
- Scope: Permit-market student auction and lecture 06 slides.
- Evidence: games/permit-market-online/tests/permit-auction-guide.test.mts.
- Action: In xaringan decks, do not put `--` increments inside `.pull-left[]`/`.pull-right[]`; repeat the slide and reuse the figure with `knitr::fig_chunk`, as the existing decks do. Do not start a slide or an increment with `Word:` (for example "Example:" or "Solve:"): remark reads it as a slide property and hides the line.

[LEARN:permit-game-options]
- Date: 2026-09-24
- Trigger: User found the game too easy: with a uniform-price auction and truthful bids, the auction lands on the efficient allocation, the market has nothing to do, and every team scores its benchmark.
- Right: Per-round session options: allocation (uniform, pay-as-bid, free by baseline), cost shock (MAC slope x0.5/x1/x1.5, balanced thirds, revealed when the market opens), banking and borrowing without limits via a Round 1 emissions choice, and a per-permit penalty for permits still owed at the end.
- Evidence: EPA Acid Rain Program auctions were pay-as-bid (GAO-10-377); about 2.8% of allowances were auctioned. Migration 003_game_options.sql; games/permit-market-online/tests/permit-game-options.test.mts.
- Action: Apply migration 003 before deploying. Keep the default settings reproducing the earlier game. Per-round benchmarks ignore banking and borrowing; compare cumulative scores.

<!-- Claude Code stores [LEARN] entries here. Prefer structured entries:
[LEARN:category]
- Date: YYYY-MM-DD
- Trigger:
- Wrong:
- Right:
- Scope:
- Evidence:
- Action:
Do not edit manually unless you are intentionally maintaining the template. -->

[LEARN:xaringan-figures]
- Date: 2026-09-01
- Trigger: R-drawn Edgeworth figures rendered fine as PNGs but did not appear on the slides.
- Wrong: Placing a markdown image reference (![...](path), including the knitr::fig_chunk pattern) inside an HTML block such as <center>...</center>. remark.js renders the markdown client-side and passes HTML blocks through raw, so the image line stays literal text and no image appears.
- Right: Inside <center> wrappers, use an R chunk with knitr::include_graphics (pointing at knitr::fig_chunk("label", "png") for chunk-generated figures) and out.width — knitr emits a real <img> tag server-side, which remark passes through. Bare markdown image lines are fine only outside HTML blocks, which is how this deck's other figures are placed.
- Scope: All xaringan decks in slides/.
- Evidence: slides/02-slides-market-failures.Rmd Edgeworth slides, 2026-09-01; verified by chrome_print of the rendered html.
- Action: When adding figures to slides, either use bare markdown references or include_graphics chunks; never markdown image syntax inside HTML tags.

[LEARN:codex-dispatch]
- Date: 2026-09-01
- Trigger: First Codex handoff for the Edgeworth figures died silently; job state sat at "running" for an hour with no live process.
- Wrong: Dispatching via codex-companion in foreground/--wait mode from the rescue subagent. The subagent's 2-minute Bash timeout kills the local companion process, which also kills the Codex run and leaves a stale "running" job record. Merely omitting --wait still streams and blocks, with the same failure. Stale records then block later resume dispatches with "task is still running".
- Right: Pass --background explicitly for fire-and-forget dispatch (returns a job ID in seconds, Codex runs detached). Watch completion from the main thread by polling `codex-companion.mjs status <jobId>` in a loop; `status --wait` returns a snapshot rather than blocking. If a job record is stuck at "running", verify no codex process is alive (ps) and the job log mtime is stale, then `codex-companion.mjs cancel <jobId>` before redispatching.
- Scope: Any Codex handoff in this repo (and the CLAUDE.md handoff section's foreground/--wait advice, which this contradicts).
- Evidence: Jobs task-mtinopja-unfav7 and task-mtiq30kd-ti1vym (timeout-killed, stale "running"); task-mtiqnpo9-69j3ez (failed on stale-record guard); task-mtiq61nm-a4v6bk and task-mtiqqs7m-5mhs5g (succeeded with --background).
- Action: Use --background plus a main-thread status-polling watcher for all Codex dispatches; consider updating the Explicit Codex Handoff section in CLAUDE.md.

[LEARN:codex-verification]
- Date: 2026-09-01
- Trigger: Asked Codex to verify slide layout with pagedown::chrome_print; its sandbox denied the local TCP port, aborted headless Chrome (exit 134), and Codex escalated to driving the user's real browser via its computer-use plugin, producing visible Chrome errors until the job was cancelled.
- Wrong: Assigning browser-based verification (chrome_print, headless Chrome, any local server or port) to a Codex job.
- Right: Codex verifies renders and PNGs only; Claude runs chrome_print or any browser-dependent check from the main session, where it works.
- Scope: All Codex handoffs in this repo involving slide or html output.
- Evidence: Job task-mtit9saj-o16cc3 log, 2026-09-01.
- Action: Keep browser-based checks out of Codex task specs; state in the plan that Claude owns layout verification.

[LEARN:site-build]
- Date: 2026-09-01
- Trigger: Rebuilding lecture 03 required rediscovering each build step, since none are written down in one place.
- Wrong: Assuming a single make target builds the course site; there is none for slides or content pages.
- Right: Slides html: Rscript -e "rmarkdown::render('slides/NN-*.Rmd')" from repo root. Slides PDF: pagedown::chrome_print on the rendered html (renderthis/decktape are not installed). Content pages (content/**/*.Rmd): blogdown::build_site(build_rmd = 'path') renders the committed .html fragment hugo needs; blogdown may need install.packages first. Videos: add id/filename rows to slides/video_manifest.csv, then slides/scripts/download_videos.sh (yt-dlp); mp4 files are gitignored, html+pdf+figure PNGs are committed. Slides are served from the repo via raw.githack (layouts/shortcodes/slide-buttons.html), so committed slides/*.html and *.pdf are the published artifacts.
- Scope: All slide decks and content pages in this repo.
- Evidence: Lecture 03 data center rebuild, 2026-09-01.
- Action: Follow this build order after editing any deck: render html, chrome_print pdf, re-render affected content pages.

[LEARN:equimarginal-slides]
- Date: 2026-09-22
- Trigger: User corrected the figures following slide 45 of lecture 05.
- Right: Preserve the existing common emissions axis and MAC curves; omit MD when illustrating cost minimization at fixed total emissions. Use the two red triangles, as in lecture 06 permits, to show excess abatement cost. The user wants no grey rectangles or rectangle-cancellation discussion, concise text, and no numerical emissions values. Keep math outside xaringan color/bold wrappers and constrain plotted MAC domains to avoid missing-value warnings.
- Scope: Equimarginal-principle figures in course slides.

[LEARN:permit-terminology]
- Date: 2026-09-24
- Trigger: User corrected slide 5 of the permits lecture.
- Wrong: Calling the firm's cost "compliance/abatement cost" and the regulator's optimization "Planner problem."
- Right: Use "abatement cost" and "Regulator problem" for this formulation. Describe the decentralized permit market as achieving the target condition, not decentralizing the condition itself.
- Scope: The regulator's emissions-allocation problem in the permits lecture.
- Evidence: User wording corrections to slides/06-slides-permits.Rmd.
- Action: Preserve these terms in later revisions of this material.

[LEARN:permit-admin-controls]
- Date: 2026-09-24
- Trigger: The phase selector reverted to the current phase during dashboard refreshes.
- Wrong: Copying session values into instructor controls on every refresh, or protecting an input only while focused.
- Right: Preserve unapplied phase and timer edits across refreshes and blur; resume synchronization after a successful apply or a different session.
- Scope: Permit-game instructor controls.
- Evidence: games/permit-market-online/tests/phase-controls.test.mts.
- Action: Test pending edits across multiple refreshes before changing dashboard controls.

[LEARN:slide-punctuation]
- Date: 2026-10-06
- Trigger: User repeated the instruction to omit periods from slide sentences
- Right: Use concise slide prose without sentence periods, including within paragraphs; preserve punctuation needed for math, code, paths, and Markdown lists
- Scope: Course slide decks
- Action: Check newly written slide prose for sentence periods before rendering

[LEARN:intensity-standard-diagram]
- Date: 2026-10-06
- Trigger: User identified the lecture 08 diagram as Holland, Hughes, and Knittel, AEJ: Economic Policy (2009)
- Right: Figure 2 uses iso-private-surplus curves (consumer plus producer surplus before emissions damages), not firm iso-profit curves; A and C are competitive equilibria
- Scope: Lecture 08 slides 54–58; retain the lecture term "intensity standards"
- Evidence: Section 3.2 and Figure 2, https://jonathan-e-hughes.github.io/publications/JHughes_LowCarbonFuelStandards.pdf; published DOI 10.1257/pol.1.1.106
- Lecture wording (2026-10-08): User explicitly requests "iso-profit curves"; describe the lecture illustration at given output prices and use profit consistently for A, C, and the contours

[LEARN:replacement-slide-reveals]
- Date: 2026-10-06
- Trigger: Lecture 08 walkthrough accumulated earlier diagrams and text at each pause
- Right: For a reveal that replaces the entire layout, use a new slide (`---`) with `count: false`; `--` always inherits earlier content even with `template: false`
- Action: Verify the interpreted slides each contain one heading, one pair of columns, and one diagram; reserve quantity-label space to keep axes fixed across reveals
- Evidence: Remark parser test reproduced up to three inherited figures; corrected lecture 08 has ten separate layouts numbered 54–58

[LEARN:slide-font-consistency]
- Date: 2026-10-08
- Trigger: User asked that lecture 08 slides 54–58 match the other slides and omit the visible HHK adaptation credit
- Right: Use the shared slide typography (32px body text); shorten prose to fit rather than adding a smaller font override
- Scope: Lecture slide editing; no visible HHK adaptation credit on this walkthrough

[LEARN:intensity-market-slides]
- Date: 2026-10-08
- Trigger: User asked to simplify lecture 08 slides 47–50 and walk through the graphs more slowly
- Right: Show beta_i MD as the vertical distance from MC to SMC on the y-axis, without a dotted horizontal damage line; introduce social costs, efficient quantities, policy curves, quantities, and DWL in separate reveals with one short caption
- Scope: Intensity-standard market diagrams; retain the shared 32px slide text and existing slide numbering

[LEARN:welfare-slide-formatting]
- Date: 2026-10-08
- Trigger: User caught small text and broken colored math in lecture 08's welfare walkthrough
- Wrong: The perfect-competition class overrode the shared 32px font with 26px and nested equations in Remark color wrappers
- Right: Inherit the shared body font; keep equations outside colored prose labels; shorten repeated prose and adjust paragraph spacing to fit
- Action: Run the typography and color-wrapper checks in slides/R/08-test-intensity-slides.R after editing lecture 08

[LEARN:slide-figure-layout]
- Date: 2026-10-22
- Trigger: Staggering quantity labels compressed lecture 09 figures and changed their dimensions between pauses
- Wrong: Use multiple rows of axis labels to avoid overlap
- Right: Keep quantity labels on one row and preserve uniform figure dimensions and plot areas across every reveal; reduce quantity label size uniformly when needed
- Scope: Lecture graph sequences, especially lecture 09 slide 12
- Evidence: User explicitly requested the original size, no staggered labels, and uniform graphs
- Action: Reserve axis space before labels appear and test equal plot dimensions across the complete sequence

[LEARN:slide-currency-and-video]
- Date: 2026-10-27
- Trigger: Lecture 09's CCA charge rendered as broken math and its YouTube player failed
- Right: Escape currency dollar signs in Rmd prose and inspect the generated HTML for unintended math delimiters
- Right: Use local_video with a local H.264/AAC MP4 for lecture playback, and verify decoding before claiming the video works
- Action: Keep background and policy detail on separate replacement frames when the shared 32px text would otherwise crowd the slide
- Scope: User presents lecture HTML in Safari, prefer a fresh filename and constrained baseline H.264/AAC MP4 when replacing a video that plays audio without a picture
- Check: A successful ffmpeg decode does not confirm Safari playback, distinguish the file checks from a browser playback check
