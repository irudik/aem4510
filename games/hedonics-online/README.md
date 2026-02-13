# Hedonics Online Game

Online multiplayer classroom implementation of the AEM 4510 hedonics sorting game.

## What Is Included

- Student portal:
  - `/games/hedonics-online/student.html`
- Admin dashboard:
  - `/games/hedonics-online/admin.html`
- Landing page:
  - `/games/hedonics-online/index.html`
- Backend API:
  - Netlify Functions under `/api/hedonics/*`
- Database schema:
  - `games/hedonics-online/supabase/001_online_game_schema.sql`

## One-Time Setup Checklist

1. Create or reuse a Supabase project with email/password auth enabled.
2. Apply migration:
   - `games/hedonics-online/supabase/001_online_game_schema.sql`
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
   - Expected team count (1-6)
   - Correct-order points vector
   - Wrong-answer deduction
3. Share student URL with class.
4. Students join with team names and receive assigned household types.
5. Move the class through phases:
   - `setup`
   - `round1`
   - `round2`
   - `round3`
   - `round4a`
   - `round4b`
   - `round5`
   - `complete`

## Core Classroom Rules Encoded

- Utility model for team household type:
  - `U = alpha * EQ + beta * SQ - P`
- Supply rule by location:
  - Location A has fixed price `P = 0`
  - Locations B-F have `P = number of houses`
- Team assignments are deterministic by join order:
  - Black, Red, Orange, Yellow, Green, Blue
- Each round allows up to 3 incorrect submissions per team.
- On the 3rd incorrect submission, that team is locked for the round and correct answers are revealed to that team.

## Reveal Rule

Round market outcomes are revealed only after all joined teams are resolved for that round (`is_correct = true` or locked after max attempts).

## Scoring

- Points are awarded by speed among correct teams within each round.
- Wrong-answer deductions apply per incorrect submission.
- Leaderboards are visible on both admin and student pages.

## Security and Visibility

- Admin endpoints require a valid Supabase bearer token and membership in `public.admin_users`.
- Student team-state payloads hide expected answers until that team is resolved (correct or locked).
- Admin dashboard shows full expected-answer diagnostics.

## Local Development

Run hedonics checks:

```bash
make -C games/hedonics-online check
```

Run local site + functions:

```bash
cd /Users/ir229/Desktop/git/aem4510
netlify dev
```

## Troubleshooting

- `No active game session exists yet.`:
  - Create a session in admin first.
- `This game is full.`:
  - Create a new session with a larger expected team count (up to 6).
- Admin login succeeds but API returns unauthorized:
  - Confirm authenticated user id is in `public.admin_users`.
- Teams cannot submit:
  - Confirm the current phase is one of the active round phases.
- Round reveal does not appear:
  - Confirm all joined teams are resolved for that round.
