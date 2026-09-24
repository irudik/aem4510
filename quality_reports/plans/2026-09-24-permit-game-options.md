# Plan: Cost shocks, free allocation, banking and borrowing, pay-as-bid

Date: 2026-09-24
Status: COMPLETED
Requested by: Ivan

## Goal

If every team bids its MAC, the uniform-price auction lands on the efficient
allocation at the benchmark price, the market has nothing to do, and every
team scores its benchmark. Add options that make both the auction and the
market matter:

1. Cost shock: when a round's market opens, each firm learns that its MAC
   slope is multiplied by 0.5, 1, or 1.5 (one third of firms each, assigned at
   random and kept private). Students know the odds when they bid.
2. Free allocation: a round can give permits away in proportion to baseline
   emissions (grandfathering, as in the Acid Rain Program) instead of
   auctioning them.
3. Banking and borrowing without limits: in Round 1 a team chooses its
   emissions. Emitting less than its permits banks the rest; emitting more
   borrows from Round 2. Borrowed permits must be covered in Round 2, and any
   shortfall pays a per-permit penalty. When banking or borrowing is on,
   auction bids are limited only by the permits for sale.
4. Pay-as-bid auctions: a round can charge each winner its own bid, as in the
   Acid Rain Program's EPA auctions (GAO-10-377: "successful bidders pay as
   they bid").

## Approach

Ivan did not choose between per-round settings and a fixed sequence, so the
session gets per-round settings: allocation method (uniform, pay-as-bid,
free) and cost shock on or off for each round, plus banking, borrowing, and
the shortfall penalty. Database defaults reproduce today's game.

Economics:

- Shock: effective slope in round r is `mac_slope * mac_shock_round{r}`. The
  factors are drawn when the game starts and revealed to each team when that
  round's market opens. Bidding uses the unshocked (expected) MAC, since the
  factors average one. Scoring and the round benchmark use realized slopes.
- Free allocation: permits = cap share of each firm's baseline, whole permits
  by largest remainder. Benchmark for a free round: the efficient allocation
  reached by trading from the endowment at the efficient price, so
  benchmark = gross value - abatement cost - p* x (efficient permits -
  endowment).
- Pay-as-bid: same ranking and quantities as the uniform auction; each
  winning permit costs its own bid. Benchmark unchanged (efficient permits
  bought at p*), so bidding MAC now scores below the benchmark.
- Bank and borrow: Round 1 emissions E1 = the team's choice (default: all
  permits up to baseline, today's behavior), limited to [0, baseline] and,
  without borrowing, to permits held. Banked = held - E1 when positive (only
  with banking); borrowed = E1 - held when positive. Round 2 net permits =
  allocation + net trades + banked - owed; emissions = min(baseline, max(0,
  net)); shortfall = max(0, -net) pays the penalty per permit (default $50,
  above the highest possible shocked MAC of $36). The per-round benchmarks
  ignore banking and borrowing; the leaderboard is cumulative.

## Files

- `games/permit-market-online/supabase/003_game_options.sql` (new)
- `netlify/functions/_lib/permit_market.mts`, `permit_phase.mts`,
  `permit_game_service.mts`
- `netlify/functions/permit-admin-create-session.mts`,
  `permit-team-submit-bids.mts`, `permit-team-order.mts`,
  `permit-team-state.mts`, `permit-admin-state.mts`,
  `permit-team-set-emissions.mts` (new)
- `static/games/permit-market-online/` student, admin, auction guide, MAC
  view, CSS
- Tests in `games/permit-market-online/tests/`
- README, games page, lecture 06 debrief slide on pay-as-bid

## Verification

- Unit tests for each option; a simulated two-round game with all options on
  that conserves permits and cash and checks scores against hand
  calculations.
- All game suites pass; import checks on every permit function.
- Screenshots of the student page in each new state.
- One independent review.

## Verification Done

- 60 unit tests pass, plus the other games' suites.
- All three migrations applied to a local Postgres 16 database (003 twice,
  to check it can be rerun). Two complete games were played through the
  actual server functions against PostgREST: one with every option on
  (free Round 1 with a shock, pay-as-bid Round 2 with a shock, banking and
  borrowing, a team left short at the end), and one with default settings,
  where truthful bids scored exactly the benchmark.
- The student and admin pages were driven in a browser through every new
  state and checked for layout at desktop and phone widths.
- No separate reviewer agent was run this time.

## Optional Reviews

None requested.
