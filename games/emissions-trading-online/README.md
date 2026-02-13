# Emissions Trading Online Game

Online multiplayer classroom implementation of the AEM 4510 emissions-trading game.

## What Is Included

- Student portal:
  - `/games/emissions-trading-online/student.html`
- Admin dashboard:
  - `/games/emissions-trading-online/admin.html`
- Landing page:
  - `/games/emissions-trading-online/index.html`
- Backend API:
  - Netlify Functions under `/api/emissions-trading/*`
- Database schema:
  - `games/emissions-trading-online/supabase/001_online_game_schema.sql`
  - `games/emissions-trading-online/supabase/002_submission_attempt_caps.sql`

## One-Time Setup Checklist

1. Create Supabase project and enable email/password auth.
2. Apply migrations in order:
   - `games/emissions-trading-online/supabase/001_online_game_schema.sql`
   - `games/emissions-trading-online/supabase/002_submission_attempt_caps.sql`
3. Add your instructor auth user id to `public.admin_users`.
4. Set Netlify environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy site from repo root.

## Instructor Runbook (Per Class)

1. Open admin dashboard and log in.
2. Click `Create New Active Session` with:
   - Session name
   - Expected team count
   - Common permit allocation
3. Share student URL with class.
4. Students join with team names and receive assigned MAC/intercept-slope.
5. Drive phases from admin dashboard:
   - `setup`: teams can join, no submissions yet.
   - `uniform`: teams submit emissions, abatement, abatement cost.
   - `called_price`: enter called price; teams submit abatement.
   - `md`: enter constant MD; teams submit efficient emissions + industry cap.
   - `complete`: freeze class activity.

## Important Reveal Rule (Called Price)

The app reveals market excess demand only when:
- Number of joined teams equals `expected_team_count`, and
- Every joined team is resolved for the active called price
  (`is_correct = true` or max incorrect attempts reached).

If excess demand does not reveal, first check team count and correctness in admin tables.

## Student Flow

1. Open student page.
2. Enter team name and join.
3. Keep page open; it polls stage updates.
4. Submit answers when stage is open.
5. Each phase allows up to 3 incorrect submissions.
6. After 3 incorrect submissions in a phase, submissions lock and the app reveals the correct answers for that phase.

## Data Export

Admin dashboard `Download CSV Snapshot` exports per-team state and submission status for the active session.

## Local Development

Run tests:

```bash
make -C games/emissions-trading-online test
```

Run local site + functions with Netlify:

```bash
cd /Users/ir229/Desktop/git/aem4510
netlify dev
```

The local run requires the same three Supabase environment variables.

## Troubleshooting

- `No active game session exists yet.`:
  - Create a session in admin first.
- `This game is full.`:
  - Increase expected team count by creating a new session.
- Admin login succeeds but API returns unauthorized:
  - Confirm authenticated user id exists in `public.admin_users`.
- Students cannot submit:
  - Confirm the current phase is set to the matching stage in admin.
