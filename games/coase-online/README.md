# Coase Online Game

Online multiplayer classroom implementation of the AEM 4510 Coase theorem game.

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

## One-Time Setup Checklist

1. Create or reuse a Supabase project with email/password auth enabled.
2. Apply migration:
   - `games/coase-online/supabase/001_online_game_schema.sql`
3. Add your instructor auth user id to `public.admin_users`.
4. Set Netlify environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy site from repo root.

## Instructor Runbook (Per Class)

1. Open admin dashboard and log in.
2. Create a new active session with:
   - Session name
   - Expected player count
3. Share student URL with class.
4. Students join with player names.
5. Click `Start Game and Random Pairing`.
6. Move phases through:
   - `setup`
   - `round1`
   - `round2`
   - `round3`
   - `complete`

## Gameplay Rules Encoded

- Payoff schedule:
  - Emissions in `{0,1,2,3,4,5,6}` with fixed Player A and Player B payoffs.
- Controller by round:
  - Round 1: Player A controls property rights.
  - Round 2: Player B controls property rights.
  - Round 3: Player B controls and legal cost rules apply.
- Transfer input is always interpreted as:
  - Payment from noncontroller to controller.
- Round 3 legal agreement rule:
  - If payment is positive, legal agreement cost is 5 total.
  - Teams submit legal fee share paid by Player A (0 to 5), and Player B pays the remainder.

## Pairing Rule

- Admin can start the game whenever at least one student has joined.
- Players are randomly paired.
- If student count is odd, one student is paired with an admin proxy player.
- For admin-proxy pairs, only the student submission is required to resolve a round.

## Resolution Rule

- Regular pairs resolve a round only when both players submit matching values.
- Resolved rounds produce and store agreed emissions, transfer, legal-fee split, and payoffs.

## Student Flow

1. Open student page.
2. Join with player name.
3. Wait for pairing and phase changes.
4. In active rounds, submit:
   - Agreed emissions
   - Payment (noncontroller to controller)
   - Round 3 only: legal fee paid by Player A
5. Keep page open; it polls updates every 5 seconds.

## Local Development

Run tests:

```bash
make -C games/coase-online test
```

Run local site + functions:

```bash
cd /Users/ir229/Desktop/git/aem4510
netlify dev
```

## Troubleshooting

- `No active game session exists yet.`:
  - Create a session in admin first.
- `Need at least one student player before starting the game`:
  - Have at least one student join before clicking start.
- Admin login succeeds but API returns unauthorized:
  - Confirm authenticated user id exists in `public.admin_users`.
- Pair does not resolve:
  - For regular pairs, both players must submit identical round terms.
  - For admin-proxy pairs, only student submission is needed.
