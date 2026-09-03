# Project Memory

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
