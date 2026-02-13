# Emissions Trading Online Game: Implementation Report

## Scope Completed

Implemented and deployed an online classroom version of the AEM 4510 emissions-trading game with:

- Team self-registration and randomized MAC assignment.
- Instructor-only controls for session creation and phase management.
- Team submission workflows for uniform standard, called price, and MD stages.
- Economics-based correctness checks with classroom tolerances.
- Called-price excess-demand reveal logic.
- Attempt caps with automatic answer reveal after repeated incorrect submissions.
- Configurable speed scoring and live leaderboards for admin and students.
- CSV export from the admin dashboard.

## Architecture Implemented

### Frontend

- Static pages:
  - `static/games/emissions-trading-online/index.html`
  - `static/games/emissions-trading-online/student.html`
  - `static/games/emissions-trading-online/admin.html`
- Shared UI code:
  - `static/games/emissions-trading-online/shared.mjs`
  - `static/games/emissions-trading-online/app.css`

### Backend

- Netlify serverless functions:
  - Admin:
    - `netlify/functions/emissions-admin-create-session.mts`
    - `netlify/functions/emissions-admin-set-phase.mts`
    - `netlify/functions/emissions-admin-state.mts`
  - Team:
    - `netlify/functions/emissions-team-join.mts`
    - `netlify/functions/emissions-team-state.mts`
    - `netlify/functions/emissions-team-submit-uniform.mts`
    - `netlify/functions/emissions-team-submit-price.mts`
    - `netlify/functions/emissions-team-submit-md.mts`
  - Utility:
    - `netlify/functions/emissions-config.mts`
- Shared backend libraries:
  - `netlify/functions/_lib/econ.mts`
  - `netlify/functions/_lib/game_service.mts`
  - `netlify/functions/_lib/supabase_rest.mts`
  - `netlify/functions/_lib/http.mts`

### Database

- Migrations:
  - `games/emissions-trading-online/supabase/001_online_game_schema.sql`
  - `games/emissions-trading-online/supabase/002_submission_attempt_caps.sql`
  - `games/emissions-trading-online/supabase/003_scoring_config.sql`
- Core tables:
  - `game_sessions`
  - `game_teams`
  - `uniform_submissions`
  - `called_price_submissions`
  - `md_submissions`
- Authorization table:
  - `admin_users` (existing; used for instructor access control)

## Economics and Validation Logic

- Baseline emissions:
  - `E0 = a / b`
- Called-price emissions choice:
  - `E(p) = max((a - p)/b, 0)`
- Abatement costs computed from the MAC integral.
- Efficient cap under constant MD from team-level efficient emissions.
- Tolerances:
  - Quantity checks: ±1
  - Cost checks: ±100

## Key Gameplay Behavior

- Team names are unique within a session after normalization.
- Team letters are deterministic by join order.
- Called-price excess demand is revealed when every currently joined team has resolved the active called-price round (`is_correct` or `is_locked`).
- Each phase allows up to 3 incorrect submissions per team.
  - On the 3rd incorrect attempt, that phase is locked for that team and correct values are shown.
- Leaderboard scoring:
  - Speed points by finishing order among correct submissions (configurable vector).
  - Deduction per incorrect attempt (configurable scalar).
- Student UX:
  - Called price displayed as a large callout (`Permit Price: $...`).
  - Draft answers persist locally during 5-second polling refreshes.
- Admin UX:
  - Table headers rendered in title case.

## Tests and Verification

### Automated Tests

- Test suites:
  - `games/emissions-trading-online/tests/econ.test.mts`
  - `games/emissions-trading-online/tests/game-logic.test.mts`
- Command:
  - `make -C games/emissions-trading-online test`
- Current status:
  - 16 tests passed, 0 failed.

### Build Validation

- Hugo build:
  - `hugo --gc --minify -b http://localhost`
- Netlify function module checks were run during implementation using Node import checks and `node --check` for updated frontend scripts.

## Recent Commit Sequence

- `3c6dadd` Show per-team MAC equation on admin and student views
- `84c74df` Cap each phase at three incorrect submissions
- `ff5b24d` Add configurable speed scoring and live leaderboards
- `3a3f517` Hide spinner arrows on numeric game inputs
- `3fb3152` Persist student form drafts across live refresh
- `9f6c0b8` Format admin table headers in title case
- `160387c` Reveal called-price excess demand for all joined teams
- `d690585` Remove team letter column from leaderboards
- `d606f3e` Make student called-price display a large callout
- `5387369` Rename student called price label to permit price

## Security Note

No secrets are stored in this report. Credentials should remain in Netlify environment variables and local secure configuration only.
