# Coase Online Game (Data Center Bargaining)

Online multiplayer classroom implementation of the AEM 4510 Coase theorem
game. Player A runs a data center whose backup generators bother Player B,
the resident next door. Pairs bargain in real time inside the app: offers,
counteroffers, accept/reject buttons, a round timer, and a live leaderboard.

## What Is Included

- Student portal:
  - `/games/coase-online/student.html`
- Admin dashboard:
  - `/games/coase-online/admin.html`
- Landing page:
  - `/games/coase-online/index.html`
- Backend API:
  - Netlify Functions under `/api/coase/*`
- Database schema:
  - `games/coase-online/supabase/001_online_game_schema.sql`
  - `games/coase-online/supabase/002_interactive_offers.sql`

## One-Time Setup Checklist

1. Create or reuse a Supabase project with email/password auth enabled.
2. Apply migrations in order:
   - `games/coase-online/supabase/001_online_game_schema.sql`
   - `games/coase-online/supabase/002_interactive_offers.sql`
3. Add your instructor auth user id to `public.admin_users`.
4. Set Netlify environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy site from repo root.

## Instructor Runbook (Per Class)

1. Open admin dashboard and log in.
2. Create a new active session with a session name and expected player count.
3. Share the student URL with the class.
4. Students join with player names.
5. Click `Start Game and Random Pairing` (this opens Round 1).
6. Pick a round length in seconds (default 300) and move phases through
   `round1`, `round2`, `round3`, `complete`. Entering a round resets that
   round's offers and starts its countdown; leaving a round locks in the
   status quo for any pair without a deal.

## Bargaining Rules Encoded

- Payoff schedule: generator hours in `{0,...,6}` with fixed operator (A) and
  resident (B) payoffs; total surplus peaks at 1 hour.
- Controller by round:
  - Round 1: A holds the property right; status quo is 6 hours.
  - Round 2: B holds the property right; status quo is 0 hours.
  - Round 3: B holds the property right and legal cost rules apply.
- Payment is always from the noncontroller to the controller.
- Offers: either player can put an offer on the table (hours, payment, and in
  Round 3 the legal fee split). A new offer from either side replaces the
  pending one. The partner can accept (round resolves through the payoff
  engine), reject, or counter.
- Walk away: either player can unilaterally end the round at the status quo
  (no deal). The student page asks for a second click to confirm.
- Timer: offers and responses are blocked once the round deadline passes;
  unresolved pairs are finalized at the status quo when the instructor moves
  the phase forward. Rewinding to an earlier round replays it without
  finalizing anything.
- Round 3 legal agreement rule: an accepted deal with a positive payment
  costs 5 in legal fees, split between A and B as specified in the offer.
  With B in control, the status quo already yields the class total of 12 and
  the best deal gains only 2, so the transaction cost makes no-deal the smart
  play. That is the debrief punchline.

## Pairing Rule

- Admin can start the game whenever at least one student has joined.
- Players are randomly paired once and keep the same partner and role all
  three rounds.
- If the student count is odd, one student is paired with an admin proxy
  player, and any offer that student sends is accepted immediately so the
  class never waits on the instructor.

## Student Flow

1. Open the student page and join with a player name.
2. Wait for pairing; your role (operator or resident) shows in the
   assignment card.
3. In each round: read the payoff table (the highlighted row is the status
   quo), then send offers or respond to your partner's. The preview line
   shows both payoffs before you commit.
4. Watch the countdown; no deal by the deadline means status quo payoffs.
5. Track your standing on the leaderboard between rounds.

## Local Development

Run tests:

```bash
make -C games/coase-online test
```

Run local site + functions:

```bash
netlify dev
```

## Troubleshooting

- `No active game session exists yet.`:
  - Create a session in admin first.
- `Need at least one student player before starting the game`:
  - Have at least one student join before clicking start.
- Admin login succeeds but API returns unauthorized:
  - Confirm authenticated user id exists in `public.admin_users`.
- `Time is up for this round`:
  - The countdown expired; advance the phase to finalize and move on, or
    re-enter the same round to replay it with a fresh timer.
- A pair reports no way to respond:
  - Only the non-proposer can accept or reject; the proposer can send a
    revised offer or walk away.
