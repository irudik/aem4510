# Permit Market Online Game

Online multiplayer classroom permit market for AEM 4510. Teams run firms
with heterogeneous abatement costs, buy permits in a uniform-price
sealed-bid auction, trade them in a live secondary market with an order
book, face a tighter cap in round 2, and can bank permits across rounds if
the instructor turns banking on.

## What Is Included

- Student portal: `/games/permit-market-online/student.html`
- Admin dashboard: `/games/permit-market-online/admin.html`
- Instructor MAC pop-out: `/games/permit-market-online/auction-view.html`
- Landing page: `/games/permit-market-online/index.html`
- Backend API: Netlify Functions under `/api/permit-market/*`
- Database schema: `games/permit-market-online/supabase/001_permit_market_schema.sql`

The earlier quiz-style emissions-trading game remains available at
`/games/emissions-trading-online/` and is untouched.

## Economics Encoded

- Each team is a firm with baseline emissions e0 and MAC slope c: the k-th
  unit of abatement costs c*k, so the q-th permit held is worth
  c*(e0 - q + 1). Firm types cycle through a fixed list as teams join.
- Compliance is automatic: emissions = min(e0, permits held), the rest is
  abated at quadratic total cost.
- Round score = avoided abatement cost - auction payment - net market
  spending. A team that never gets a permit and never trades scores 0.
- Benchmark: clearing the auction on true value schedules (after any cost
  shock) gives the efficient allocation and price p*; each team's benchmark
  score is what it would earn buying its efficient quantity at p*, or, in a
  free round, trading from its free permits to that quantity at p*. The
  leaderboard ranks by cumulative (score - benchmark), so no firm type has a
  built-in advantage. Per-round benchmarks ignore banking and borrowing, so
  a borrower beats the Round 1 benchmark and falls behind in Round 2; the
  cumulative comparison is the meaningful one. If every team bids its MAC
  in a uniform auction with no shock, every team scores exactly its
  benchmark and the market has nothing to do; under pay-as-bid, bidding MAC
  scores below the benchmark.

## Game Options (set per session)

- Allocation per round: uniform-price auction (default), pay-as-bid
  auction (each winner pays its own bids, as in EPA's Acid Rain Program
  auctions), or free allocation in proportion to baseline emissions
  (grandfathering; whole permits by largest remainder). In a free round the
  auction phase shows each team its permits; there is nothing to bid on.
- Cost shock per round: when the round's market opens, each firm learns
  whether its MAC slope is multiplied by 0.5, 1, or 1.5. A third of firms get
  each (balanced draw at game start, random order); each team sees only its
  own. Students know the odds when they bid. Costs, scores, and the round's
  benchmark use the shocked slope; the instructor auction charts show
  unshocked MACs, which is what bidders knew.
- Banking and borrowing (each on or off): during the Round 1 market a team
  chooses its Round 1 emissions (default: use the permits it holds, up to
  baseline). Emitting less banks the rest; emitting more borrows from Round
  2. There are no limits beyond emissions between zero and baseline. Round 2
  holdings start from banked minus owed permits (negative for a borrower);
  any permit still owed at the end pays the penalty (default $50, above the
  highest possible shocked MAC of $36). With banking or borrowing on,
  auction bids are limited only by the permits for sale, and in Round 1 with
  banking students can add extra bid boxes for permits to bank.
- Suggested classroom setups: "ARP style" = Round 1 free with a shock,
  Round 2 pay-as-bid with a shock, banking and borrowing on. "Auction
  formats" = Round 1 uniform, Round 2 pay-as-bid, no shocks. The default
  (uniform both rounds, no shocks) is the earlier game.

## Market Rules

- Auction (sealed, uniform price): students enter the most they would pay
  for each permit, one box per permit up to their baseline; blank boxes are
  not bids. Each box is sent as a one-permit (price, quantity) bid, sorted
  from highest to lowest, so the server rules are unchanged: total quantity
  at most the baseline, revisable until the deadline. Bid units are stacked
  by price (ties to the earlier submission); the top cap units win and all
  winners pay the lowest accepted price. The API still accepts rows covering
  several permits; the student form shows those as separate boxes.
- Auction help on the student page: plain-language rules with a worked
  three-firm example, and a "what if the price were...?" slider that uses
  only the team's own typed bids to show permits won, payment, emissions,
  abatement cost, and the round score before trading.
- After each auction clears, students see it as supply and demand: the
  class's bids stacked into a step demand curve (no team names or MACs), a
  vertical supply curve at the cap, and the clearing price, with their own
  bids marked, plus a table of their bids, which won, and the price paid.
  The newest auction's chart is open during its market and at the end of
  the game; earlier rounds stay available as collapsed sections, including
  while students bid in round 2.
- In round 2 with banking on, the bid form shows one box per unit of
  emissions not already covered by banked permits, since any permit beyond
  that is worth nothing in the final round.
- Secondary market (continuous double auction): limit orders rest in a
  book; an incoming order trades against the best crossing resting orders
  at the resting price, ties to the earlier order. Partial fills rest.
  Orders can be cancelled. Asks are capped at free holdings (no shorts);
  buys are not cash-constrained, overpaying just lowers the score.
- Caps are set as shares of total baseline emissions (defaults 60% and
  40%) and resolved to integers when each auction opens, so class size
  does not matter.
- Timers: each auction and market phase runs against a countdown; bids and
  orders are rejected after the deadline.

## One-Time Setup Checklist

1. Reuse the class Supabase project (email/password auth already on).
2. Apply `games/permit-market-online/supabase/001_permit_market_schema.sql`,
   then `002_flexible_auction_bids.sql` and `003_game_options.sql` in the
   same folder, before deploying the matching site code. Rerunning `001`
   alone does not remove an existing four-row limit. `003` only adds columns
   with defaults and one table, so earlier sessions keep working; it can be
   rerun safely.
3. The instructor auth user id must be in `public.admin_users` (already
   true if the other games run).
4. Netlify environment variables are shared with the other games.
5. Deploy site from repo root.

## Instructor Runbook (Per Class)

1. Log into the admin dashboard.
2. Create a session: name, expected team count, round 1 and round 2 cap
   shares, phase length in seconds, banking on/off.
3. Students join with team names (join closes once the game starts, since
   firm types are assigned at the start; rejoining is always fine).
4. Click `Start Game`: firm types are assigned and auction 1 opens with
   its countdown. The clearing chart shows the live bid stack.
   Under `Auction Clearing`, use `Pop out MAC charts` for a larger view
   with aggregate MAC and all firms' individual MACs side by side. The
   window shares the dashboard login, updates every 4 seconds, and has
   a round selector. It contains no game controls. Project it only when
   you intend to reveal MACs and bids. Identical firm curves coincide;
   the legend lists every team sharing each curve.
5. Move phases forward in order: auction1 -> market1 -> auction2 ->
   market2 -> complete. Leaving an auction clears it (students then see
   the clearing price and their allocations); leaving a market scores the
   round and updates the leaderboard.
6. Do not skip phases moving forward; only the phase being left is closed.
   Re-selecting the current phase replays it with a fresh timer and wipes
   that phase's data.
7. `Download Scores CSV` exports the per-team accounting.

## Debrief Pointers

Lecture 06 introduces the game in a "Let's trade: the permit market game"
section after the banking and borrowing slides: how the game works, the
options that may be on, the join path, and predictions to check against the
class results. It is followed by an "After the permit game" debrief section:
demand reduction, why trading after an auction matters (cost shocks,
banking and borrowing), and pay-as-bid auctions in the Acid Rain Program.

Lecture 06 has an auction block after the permit-allocation slide: MAC
as permit demand, the auction as supply meeting demand, the game's rules,
the three-firm clearing example the student page also uses, and why bidding
close to MAC is close to optimal when no single bid is likely to set the
price. The lecture's rule slide notes
that RGGI charges the highest losing bid, while the game, the EU ETS, and
California-Quebec charge the lowest winning bid.

The student page shows a descending MAC curve against emissions, matching
lecture 06. Whole-unit steps match the game's exact abatement costs. During
trading, the graph marks current emissions and shades total abatement cost;
an observed trade price (or the auction price before any trades) provides a
comparison. The auction and market prompts ask students to reason through
one more permit. The student page itself leaves the MAC = P explanation to
the end of the game, with the whole-unit qualification; the lecture covers
the firm's MAC = p condition and bidding before play. Students are not shown a permit-value table.

- Auction charts: submitted bids (blue) against aggregate MAC (rose) show
  how bids differ from avoided abatement costs. The adjacent graph puts
  every firm's MAC on the same emissions axis, without adding quantities.
  Both graphs use the same price scale and show the auction and efficient
  benchmark prices. With multiple units, uniform-price auctions can induce
  demand reduction; bidding the full MAC schedule is not always optimal.
- Market trades should flow from low-MAC to high-MAC firms and prices
  should converge toward the efficient price.
- Round 2's tighter cap raises the clearing price; with banking on, round 1
  permits become an asset and bids react.

## Local Development

Run tests:

```bash
make -C games/permit-market-online test
```

Run local site + functions:

```bash
netlify dev
```

## Troubleshooting

- `The game has already started; new teams cannot join.`: create latecomer
  teams before starting, or restart with a new session.
- `You can offer at most N permit(s)`: the team is trying to sell permits
  it does not hold or has already offered; cancel an open ask first.
- A resting order "moved" while matching: the incoming order keeps the
  fills that succeeded and the rest rests in the book; students just try
  again.
- Auction chart missing: it appears once an auction has opened (cap set)
  and firm types are assigned.
