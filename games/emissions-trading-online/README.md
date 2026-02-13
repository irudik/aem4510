# Emissions Trading Online Game

Online multiplayer classroom implementation for the AEM 4510 emissions-trading exercise.

## Runtime Architecture

- Static UI pages:
  - `/games/emissions-trading-online/index.html`
  - `/games/emissions-trading-online/student.html`
  - `/games/emissions-trading-online/admin.html`
- API layer: Netlify Functions under `/api/emissions-trading/*`
- State persistence: Supabase tables created by:
  - `games/emissions-trading-online/supabase/001_online_game_schema.sql`

## Required Netlify Environment Variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Admin Login

Admin login uses Supabase email/password auth from the dashboard page and then checks that
the authenticated user id exists in `public.admin_users`.

## Local/CI Test Command

```bash
make -C games/emissions-trading-online test
```
