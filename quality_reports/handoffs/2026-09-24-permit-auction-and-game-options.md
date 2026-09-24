# Handoff: permit auction teaching and game options -> Astra

**Task:** Make the lecture 06 permit auction understandable, and make the permit market game less trivial (cost shocks, free permits, pay-as-bid, banking and borrowing), plus game slides with a QR code.
**Plans:** `quality_reports/plans/2026-09-24-permit-auction-teaching.md`, `quality_reports/plans/2026-09-24-permit-game-options.md`
**Status:** READY. Committed on branch `permit-auction-teaching` on top of `ed790f4`, but **not pushed**: the Claude session had no push credential for `irudik/aem4510` and could not reach Ivan's local clone. Ivan received the same commits as a patch file (`permit-market-all-changes.patch`, apply with `git am`).
**Date:** 2026-09-24

## Background

Ivan reported that students do not know what a uniform-price sealed-bid auction is. After the first round of changes he found the game too easy: with uniform pricing and no shocks, if every team bids its MAC the auction lands on the efficient allocation at the benchmark price, the market has nothing to do, and every team scores exactly its benchmark (verified with the game code). He then chose cost shocks, free permits, pay-as-bid auctions, and unlimited banking and borrowing.

## What Was Done (five commits, oldest first)

1. **Teach the permit auction as supply and demand.**
   - Lecture 06 (`slides/06-slides-permits.Rmd`), after "How do we initially allocate permits?": MAC as the firm's permit demand (from min C(E) + pE); auction as supply (cap) meeting demand, using the lecture's example (clears at p = 50, E1 = 40, E2 = 50, the trading equilibrium); the rules; a three-firm example (A 12/9/6/3, B 10/7/4/1, C 8/5/2, five permits, price 7); why bidding close to MAC is close to optimal with many bidders. Three new ggplot figures, knitted in R with no warnings.
   - Student page: one price box per permit (sent as one-permit bids, so server validation and clearing are unchanged), plain-language rules with the worked example, and a "what if the price were...?" slider using only the team's own typed bids.
   - After each auction clears, students see it as supply and demand: the class's bids as a step demand curve (no team names), a vertical supply line at the cap, the clearing price, their own bids marked, and a table of their bids won or lost. Earlier rounds stay available, collapsed.
   - Fixed stale text on the games page (four-bid limit, value table) and landing page.
2. **Cost shocks, free permits, pay-as-bid, banking with borrowing.** Per-round session settings (Ivan did not choose between per-round settings and a fixed sequence; per-round was assumed):
   - Allocation per round: `uniform` (default), `pay_as_bid` (each winner pays its own bids; EPA's Acid Rain Program auctions worked this way, GAO-10-377), or `free` (grandfathered in proportion to baseline, whole permits by largest remainder).
   - Cost shock per round: MAC slope times 0.5, 1, or 1.5, balanced thirds in random order, drawn at game start, shown to each team only when that round's market opens. Bidding uses the unshocked (expected) MAC.
   - Banking and borrowing, no limits: in the Round 1 market a team sets its Round 1 emissions (new endpoint `permit-team-set-emissions`); less than holdings banks, more borrows. Round 2 holdings start from banked minus owed. Permits still owed at the end pay a per-permit penalty (default $50, above the highest possible shocked MAC of $36; this penalty was Claude's addition so borrowing has to be repaid). With banking or borrowing on, bids are limited only by the permits for sale; Round 1 with banking lets students add extra bid boxes.
   - Scoring and round benchmarks use shocked MACs; free rounds' benchmarks credit the free endowment. Per-round benchmarks ignore banking and borrowing, so the cumulative leaderboard is the meaningful comparison.
   - Admin form, summary, team table (shock factors), score table, and CSV cover the new fields.
   - Migration `games/permit-market-online/supabase/003_game_options.sql`: new session columns, team shock columns, `permit_emission_choices` table, new score columns. All defaults reproduce the earlier game; safe to rerun.
   - Lecture 06 debrief slides: why trade after an auction; pay-as-bid in the Acid Rain Program.
3. **Introduce the permit market game in lecture 06.** A "Let's trade: the permit market game" section after "Banking and borrowing: design lessons", modeled on the Coase deck: how the game works, options we may turn on, predictions to check. The "After the permit game" debrief section follows it.
4. **QR code and short link.** A "Join the permit market game" slide with a QR code (`slides/files/06-permit-game-qr.png`, encodes the full student-login URL; decoded and checked) and the short link `aem4510.ivanrudik.com/permits`, a 302 redirect added to `netlify.toml`. TinyURL was not reachable from the session.
5. **This handoff.**

## Decisions Made

- Per-round session settings rather than a hard-coded sequence; database defaults reproduce the earlier game, but the admin form preselects banking and borrowing On (Ivan asked to "have banking and borrowing").
- Shock draws are balanced thirds, not independent coin flips, so the class's total demand stays near its expected level.
- The QR code points to the full URL, not the short link, so it works even if the redirect fails.
- Slides say bidding MAC is "close to optimal with many bidders", not optimal: under the game's lowest-winning-bid rule, shading pays when a bid sets the price. RGGI charges the highest losing bid; the EU ETS and California-Quebec charge the lowest winning bid (verified from EEX and Maryland MDE pages).
- The debrief section sits after the game section so it is not shown before play.

## Alternatives Rejected

- Switching the game to RGGI's highest-losing-bid rule: makes truthful bidding closer to optimal, which makes the game easier, the opposite of what Ivan wanted.
- An ascending clock auction: more intuitive but a new phase type and further from real allowance auctions.
- Showing the bid curve over the student's MAC chart: gives away "bid your MAC", against the discovery approach in `MEMORY.md`.
- A TinyURL link: blocked; the Netlify redirect is on Ivan's own domain and does not depend on a third party.

## Active Risks

- **Not pushed and not deployed.** Push the branch (or apply the patch) from a machine with credentials.
- **Supabase is ready.** Migration 003 was applied to the class project (`vuporrnrpfuibrtwqxww`) on 2026-09-24 as migration `permit_game_options`; all new columns, the `permit_emission_choices` table (row security on), and service-role access were checked. Migrations 001 and 002 were already in place. Existing sessions (4, one active) are untouched and read as the default settings.
- **Lecture 06 HTML and PDF are not re-rendered**; only the `.Rmd` changed. The deck sources a local `R/video_helpers.R` not in the repo, so rendering must happen on Ivan's machine (render HTML, `chrome_print` PDF, per `MEMORY.md`). The new slides were checked by knitting the new chunks in R and rendering them with remark in a test copy of the deck; no overflow.
- `content/games/games-02-permits.html` was edited by hand to match the `.Rmd` (blogdown was not available); re-render with blogdown if preferred.
- Commit 1 had an independent review and its findings were fixed. Commits 2 to 4 did not get a separate reviewer; they were verified by tests and a full-game run (below).
- Everything was tested against a local Postgres 16 plus PostgREST, not the live Supabase project.
- Pre-existing deck issue, left alone: lines starting with a word and a colon at the start of a slide or increment (`Solve:`, `FOC:`, `Alternatively:`, `Cliffnotes:`) are hidden by remark, which reads them as slide properties.
- The old asset `assets/permits-qr-code.png` still points to the earlier emissions-trading game; nothing uses it now.
- Team state resends each cleared auction's bid curve every 2.5 seconds; equal adjacent bids are merged, so this is small for class sizes up to about 60 teams.

## Verification Done

- `make -C games/permit-market-online test`: 60 tests pass (new: `permit-auction-guide.test.mts`, `permit-game-options.test.mts`); Coase, emissions-trading, and hedonics suites unchanged and passing.
- All three migrations applied to local Postgres; 003 rerun cleanly.
- Two full games played through the actual Netlify functions against PostgREST: every option on (free Round 1 with shock, pay-as-bid Round 2 with shock, banking and borrowing, one team left owing permits and charged the penalty), and default settings (truthful bids scored exactly the benchmark).
- Student and admin pages driven in a headless browser through every new state at desktop and phone widths; no console errors or horizontal overflow.

## Files Touched / Relevant

- `slides/06-slides-permits.Rmd`, `slides/files/06-permit-game-qr.png`, `netlify.toml`
- `netlify/functions/_lib/permit_market.mts` (engine), `permit_phase.mts`, `permit_game_service.mts`
- `netlify/functions/permit-team-state.mts`, `permit-team-submit-bids.mts`, `permit-team-order.mts`, `permit-team-set-emissions.mts` (new), `permit-admin-create-session.mts`, `permit-admin-state.mts`
- `static/games/permit-market-online/auction-guide.mjs` (new), `student.mjs`, `admin.html`, `admin.mjs`, `mac-view.mjs`, `auction-charts.mjs`, `app.css`, `index.html`
- `games/permit-market-online/supabase/003_game_options.sql` (new), `README.md`, tests
- `content/games/games-02-permits.Rmd` and `.html`, `MEMORY.md`, the two plans above

## Next Stage Expectations

1. Push branch `permit-auction-teaching` (or apply `permit-market-all-changes.patch` to `main`) and merge.
2. Deploy (Supabase already has migration 003).
3. Re-render lecture 06 (HTML and PDF) and the games page; check the join slide's QR code scans on a phone and that `aem4510.ivanrudik.com/permits` redirects after deploy.
4. Run a short trial session with a few browser tabs using the suggested "ARP style" setup from the README (Round 1 free with a shock, Round 2 pay-as-bid with a shock, banking and borrowing on).
5. Optional: an independent review of commits 2 to 4, and fixing the hidden `Word:` lines in the deck if Ivan wants.
