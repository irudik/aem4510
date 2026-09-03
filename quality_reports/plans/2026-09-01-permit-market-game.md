# Plan: Interactive permit market game (auction + secondary market)

Date: 2026-09-01
Branch: main
Requested by: Ivan

## Goal

Replace the quiz-style permit game experience with a real market: teams bid
in a uniform-price permit auction, trade in a live secondary market with an
order book, face a cap shock in round 2, and optionally bank permits across
rounds. The admin screen draws the clearing of the auction (bid stack vs.
the cap) and the class leaderboard scores teams against a theoretical
benchmark.

## Approach

Build a new game `games/permit-market-online/` alongside the existing
emissions-trading game rather than rewriting it in place; the earlier game
keeps working and the games page repoints to the new one. Reuse the shared
infrastructure patterns from the Coase rebuild: Supabase via PostgREST from
Netlify functions, join tokens, phase state with a server-side deadline,
polling UIs in static/, node --test suites over pure logic modules.

## Economics

- Each team is a firm with integer baseline emissions e0 and MAC slope c:
  the k-th unit of abatement costs c*k, so the q-th permit held is worth
  c*(e0 - q + 1). Firm types are assigned round-robin from a fixed list.
- Compliance is automatic: emissions = min(e0, permits held); the rest is
  abated. Round score = value of permits used (avoided abatement cost)
  minus auction payments minus net secondary-market spending, computed as
  V - abatement cost - net spend with V = c*e0*(e0+1)/2 so scores start
  at 0 for a team with no permits and no trades.
- Auction: sealed bids, up to 4 (price, quantity) pairs per team, revisable
  until the deadline. Clearing stacks bid units by price (ties by earlier
  submission), fills the cap, and everyone pays the lowest accepted price.
- Secondary market: continuous double auction. Limit orders rest in a book;
  a crossing order executes at the resting order's price, best price first,
  then earlier order. No short sales: asks are capped by free holdings.
  Buying is not cash-constrained; overpaying just hurts the score.
- Benchmark: with the efficient allocation, permits go to the cap highest
  marginal values and the benchmark price p* is the cap-th highest value.
  Benchmark score per team = what it would earn buying its efficient
  quantity at p*. Leaderboard ranks by cumulative (score - benchmark), so
  endowment draws do not decide the ranking; raw scores also shown.
- Round 2 repeats with a tighter cap (the shock, set at session creation)
  and, if banking is enabled, permits unused in round 1 carry forward.

## Phases

setup -> auction1 -> market1 -> auction2 -> market2 -> complete.
Leaving an auction phase clears the auction (writes clearing price and
allocations); leaving a market phase scores the round. Re-entering a phase
replays it after wiping that phase's data, mirroring the Coase game.

## Steps

1. Schema `games/permit-market-online/supabase/001_permit_market_schema.sql`:
   sessions (caps, banking flag, phase deadline), teams (e0, c), auction
   bids, auction results + allocations, orders, trades, round scores.
2. Pure logic `netlify/functions/_lib/permit_market.mts`: firm types,
   value schedules, auction clearing, order matching, scoring, benchmark,
   leaderboard, chart-ready bid-stack series.
3. DB service `netlify/functions/_lib/permit_game_service.mts`.
4. Functions `permit-config`, `permit-admin-create-session`,
   `permit-admin-start-game`, `permit-admin-set-phase`, `permit-admin-state`,
   `permit-team-join`, `permit-team-state`, `permit-team-submit-bids`,
   `permit-team-order`, `permit-team-cancel-order`.
5. Static UI `static/games/permit-market-online/`: student portal (firm
   card with permit value table, bid composer, order book with post/cancel,
   trade ticker, results, leaderboard, countdown) and admin dashboard
   (session setup with caps and banking, phase controls with timer, live
   tables, SVG clearing chart: bid stack vs cap vs true demand).
6. Tests in `games/permit-market-online/tests/` (node --test): clearing
   (price, ties, partial fill), matching (price-time priority, no shorts,
   partial fills), scoring and banking, benchmark and leaderboard.
7. Docs: game README, rewrite `content/games/games-02-permits.Rmd`,
   render the page.
8. Supabase: migration must run in the dashboard SQL editor; Chrome
   extension is not connected in this session, so hand Ivan instructions
   for Codex covering this migration and the Coase 002 migration.

## Verification

- `make -C games/permit-market-online test` passes.
- `node --check` on the static modules; import-check on each function.
- Existing games' suites still pass.
- Games page renders with blogdown.
