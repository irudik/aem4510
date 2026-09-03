# Permit Market Online Game

Online multiplayer classroom permit market for AEM 4510. Teams run firms
with heterogeneous abatement costs, buy permits in a uniform-price
sealed-bid auction, trade them in a live secondary market with an order
book, face a tighter cap in round 2, and can bank permits across rounds if
the instructor turns banking on.

## What Is Included

- Student portal: `/games/permit-market-online/student.html`
- Admin dashboard: `/games/permit-market-online/admin.html`
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
- Benchmark: clearing the auction on true value schedules gives the
  efficient allocation and price p*; each team's benchmark score is what it
  would earn buying its efficient quantity at p*. The leaderboard ranks by
  cumulative (score - benchmark), so no firm type has a built-in advantage.
  The round-2 benchmark ignores banking, so banked permits make the
  benchmark easier to beat there; that is a debrief point, not a bug.

## Market Rules

- Auction (sealed, uniform price): up to 4 (price, quantity) bids per team,
  revisable until the deadline; total quantity at most the baseline. Bid
  units are stacked by price (ties to the earlier submission); the top cap
  units win and all winners pay the lowest accepted price.
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
2. Apply `games/permit-market-online/supabase/001_permit_market_schema.sql`.
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
5. Move phases forward in order: auction1 -> market1 -> auction2 ->
   market2 -> complete. Leaving an auction clears it (students then see
   the clearing price and their allocations); leaving a market scores the
   round and updates the leaderboard.
6. Do not skip phases moving forward; only the phase being left is closed.
   Re-selecting the current phase replays it with a fresh timer and wipes
   that phase's data.
7. `Download Scores CSV` exports the per-team accounting.

## Debrief Pointers

- Auction chart: submitted bids (blue) against true values (grey) shows
  whether the class bid near its true demand; the uniform price makes
  truthful bidding roughly optimal, which is why real allowance auctions
  (RGGI, the EU ETS) use this design.
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
