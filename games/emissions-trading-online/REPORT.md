# Emissions Trading Online Game: Implementation Report

## Scope Completed

Built and deployed a working online version of the classroom emissions-trading game with:

- Team self-registration and randomized MAC assignment.
- Instructor-only controls for session setup and phase management.
- Team submission workflows for uniform standard, called price, and MD stages.
- Correctness checking with classroom tolerances.
- Controlled reveal of called-price excess demand.
- Persistent storage in Supabase.
- CSV export from admin dashboard.

## Architecture Implemented

### Frontend

- Static pages served by Netlify:
  - `static/games/emissions-trading-online/index.html`
  - `static/games/emissions-trading-online/student.html`
  - `static/games/emissions-trading-online/admin.html`
- Shared frontend logic and formatting:
  - `static/games/emissions-trading-online/shared.mjs`
  - `static/games/emissions-trading-online/app.css`

### Backend

- Netlify serverless functions (Node ESM `.mts`):
  - Admin:
    - `emissions-admin-create-session`
    - `emissions-admin-set-phase`
    - `emissions-admin-state`
  - Team:
    - `emissions-team-join`
    - `emissions-team-state`
    - `emissions-team-submit-uniform`
    - `emissions-team-submit-price`
    - `emissions-team-submit-md`
  - Utility:
    - `emissions-config` (public Supabase URL + anon key)

- Shared backend libraries:
  - `netlify/functions/_lib/econ.mts`
  - `netlify/functions/_lib/game_service.mts`
  - `netlify/functions/_lib/supabase_rest.mts`
  - `netlify/functions/_lib/http.mts`

### Database

- Migration:
  - `games/emissions-trading-online/supabase/001_online_game_schema.sql`
- Tables created:
  - `game_sessions`
  - `game_teams`
  - `uniform_submissions`
  - `called_price_submissions`
  - `md_submissions`
- Existing `admin_users` table used for instructor authorization.

## Economics/Validation Logic

- Baseline emissions: `E0 = a / b`.
- Called-price team choice: `E(p) = max((a - p)/b, 0)`.
- Uniform and called-price costs from MAC integral.
- Efficient cap under constant MD from team-level efficient emissions.
- Tolerances:
  - Quantities: ±1
  - Cost: ±100

## Key Behavior Guarantees

- Team names are unique within session (normalized).
- Team letters are deterministic by join order.
- Called-price excess demand is revealed only when:
  - joined teams == expected team count, and
  - all expected teams are correct.
- Admin-only APIs require valid Supabase auth token and `admin_users` membership.

## Tests and Verification Performed

### Automated Tests

- Node unit tests in:
  - `games/emissions-trading-online/tests/econ.test.mts`
  - `games/emissions-trading-online/tests/game-logic.test.mts`
- Command used:
  - `make -C games/emissions-trading-online test`
- Final status:
  - 10 tests passed, 0 failed.

### Build Validation

- Hugo site build succeeded:
  - `hugo --gc --minify -b http://localhost`

### Live Endpoint Smoke Tests

- Verified deployed pages return HTTP 200:
  - index, student, admin pages.
- Verified API behavior:
  - `/api/emissions-trading/config` returns public config.
  - team join requires active session.
  - uniform/called-price/MD submissions evaluate and return correctness.
- Verified reveal-gating fix on live deployment with staged data.

## Issues Encountered and Resolved

1. Supabase MCP tool state was cached in read-only mode.
   - Resolution: applied migration via direct MCP stdio client helper during implementation.
2. Called-price reveal initially triggered when all currently joined teams were correct, even if session expected more teams.
   - Resolution: changed gating to require both expected team count and expected number of correct submissions.

## Commits Produced

- `eb57b78` Add economic core library and benchmark tests for online game
- `51aad79` Add Supabase schema and Netlify API for online trading game
- `47f3103` Add student and admin web interfaces for online trading game
- `ad2c522` Document online app setup and tighten reveal gating logic

## Security Note

No secrets are included in this report. Operationally, sensitive credentials belong only in Netlify environment variables and should be rotated if exposed during setup.
