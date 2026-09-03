# Plan: Data centers in the Coase lecture and an interactive bargaining game

Date: 2026-09-01
Branch: main
Requested by: Ivan

## Goal

Expand `slides/03-slides-coase.Rmd` and the Coase online game around a data
center theme:

1. Add news videos on data centers and use data centers as a running example
   of when private bargaining over externalities works or fails depending on
   transaction costs.
2. Make the existing Supabase Coase game interactive: students bargain inside
   the app through offers and counteroffers instead of typing pre-agreed
   numbers, with a round timer and a leaderboard.
3. Add a numeric "Your turn" data center bargaining exercise in the style of
   the levee example in the 02 slides.

## Existing pieces to build on

- `games/coase-online/` already holds a working Supabase + Netlify game:
  players join, are randomly paired, and both submit matching round terms.
  The payoff engine is `netlify/functions/_lib/coase.mts` (emissions 0-6,
  fixed A/B payoffs, controller by round, round 3 legal cost 5 on positive
  transfers). Ivan wants this more interactive and fun, so the submission
  step is replaced by in-app bargaining; the payoff engine and pairing stay.
- Videos flow through `slides/video_manifest.csv` and
  `slides/scripts/download_videos.sh` (yt-dlp), embedded with `local_video()`.
  Video files are gitignored.
- The levee example in `slides/02-slides-market-failures.Rmd` (chunks `levee`,
  `levee-agg`, `levee-optim`) sets the format for the "Your turn" exercise:
  named ggplot chunks with `fig.show = 'hide'`, reused via
  `knitr::fig_chunk()`, a `.hi[Your turn:]` prompt slide, then staged answer
  slides.

## Design decisions

- Theme: Player A is a data center operator, Player B is the neighboring
  resident. The existing emissions index 0-6 is presented as backup generator
  hours per week. Payoff table, controllers, and legal cost rule are
  unchanged, so the tested economics engine stays valid.
- Interactive flow per round: either player sends an offer (hours, payment,
  and in round 3 the legal fee split). One pending offer per pair at a time;
  the partner can accept, counter (supersedes the pending offer), or reject.
  Accepting resolves the round through the existing `computeRoundOutcome`.
  Either player can walk away, which locks in the status quo (controller's
  preferred hours, no payment). A countdown timer runs each round; when the
  instructor closes a round, unresolved pairs get the status quo outcome.
- Admin proxy pairs (odd student count): the student's offers are accepted
  automatically so the class never stalls.
- Students see a live payoff preview for both sides while composing an offer,
  a chat-style offer feed, and a class leaderboard of cumulative payoffs.
- Round 3 keeps the fixed legal cost 5. With B in control the status quo is
  0 hours (total payoff 12) and the efficient deal at 1 hour gains only 2,
  so the transaction cost makes not dealing the smart play. The debrief slide
  makes that the punchline.

## Steps

1. Supabase migration `games/coase-online/supabase/002_interactive_offers.sql`:
   `coase_offers` table (pair, round, proposer, terms, status pending /
   accepted / rejected / superseded / withdrawn), `no_deal` flag on
   `coase_round_outcomes`, and `round_seconds` + `phase_deadline_at` on
   `coase_sessions`.
2. Pure logic in `netlify/functions/_lib/coase.mts` (status quo outcome per
   round) and offer helpers in `_lib/coase_game_service.mts`.
3. New Netlify functions `coase-player-offer.mts` and
   `coase-player-respond.mts`; extend `coase-player-state.mts` (offers,
   deadline, leaderboard), `coase-admin-set-phase.mts` (set deadline on round
   open, finalize unresolved pairs on round close), and
   `coase-admin-state.mts` (live pair board and summary stats).
4. Rebuild `static/games/coase-online/student.mjs` and `student.html` around
   the bargaining panel; update `admin.mjs`/`admin.html` with round length,
   live offer activity, and class results.
5. Tests in `games/coase-online/tests/` (node --test) for offer state
   transitions, acceptance resolution, status quo finalization, deadline
   rules, and leaderboard math. Keep existing econ tests passing.
6. Videos: verify candidates found by the research agent, add rows to
   `slides/video_manifest.csv`, download with yt-dlp.
7. Slides: new data center section in `slides/03-slides-coase.Rmd` woven
   around the transaction cost material (videos, when bargaining works vs
   fails), a numeric "Your turn" exercise (operator MB = 20 - 2G, resident
   MC = 4, endowments 0 or 10 hours, transaction cost comparisons), and a
   game intro slide linking the student portal.
8. Update `content/games/games-01-coase.Rmd` and
   `games/coase-online/README.md` for the new flow; render slides and games
   page; run game tests.

## Verification

- `make -C games/coase-online test` passes with new tests.
- `Rscript -e "rmarkdown::render('slides/03-slides-coase.Rmd')"` builds clean.
- Blogdown page for games renders.
- Manual note for Ivan: apply migration 002 in Supabase before the next class;
  netlify dev spot-check of the student/admin flow.

## Out of scope

- Changing the payoff schedule or number of rounds.
- Supabase Realtime (the game keeps short-interval polling).
- Live instructor play against the odd student (auto-accept instead).
