# Hedonics Online Game: Implementation Report

## Scope Completed

Implemented and integrated an online version of the AEM 4510 hedonics sorting game with:

- Team self-registration and deterministic household-type assignment.
- Instructor-only controls for session creation and phase transitions.
- Round submission workflow for rounds 1, 2, 3, 4a, 4b, and 5.
- Economics-based validation of market houses and team best-response calculations.
- Attempt caps with answer reveal after repeated incorrect submissions.
- Configurable speed scoring and live leaderboards for admin and students.
- Course site game-page links and run instructions.

## Architecture Implemented

### Frontend

- `static/games/hedonics-online/index.html`
- `static/games/hedonics-online/student.html`
- `static/games/hedonics-online/admin.html`
- `static/games/hedonics-online/student.mjs`
- `static/games/hedonics-online/admin.mjs`
- `static/games/hedonics-online/shared.mjs`
- `static/games/hedonics-online/app.css`

### Backend

- `netlify/functions/_lib/hedonics.mts`
- `netlify/functions/_lib/hedonics_game_service.mts`
- `netlify/functions/hedonics-config.mts`
- `netlify/functions/hedonics-admin-create-session.mts`
- `netlify/functions/hedonics-admin-set-phase.mts`
- `netlify/functions/hedonics-admin-state.mts`
- `netlify/functions/hedonics-team-join.mts`
- `netlify/functions/hedonics-team-state.mts`
- `netlify/functions/hedonics-team-submit-round.mts`

### Database

- Migration:
  - `games/hedonics-online/supabase/001_online_game_schema.sql`
- Core tables:
  - `hedonics_sessions`
  - `hedonics_teams`
  - `hedonics_round_submissions`

## Economics and Validation Logic

- Utility model:
  - `U = alpha * EQ + beta * SQ - P`
- Supply rule:
  - `P_A = 0`
  - `P_j = houses_j` for `j in {B, C, D, E, F}`
- Round definitions encoded for `round1`, `round2`, `round3`, `round4a`, `round4b`, `round5`.
- Team assignments map to household types Black/Red/Orange/Yellow/Green/Blue.

Submission checks per round:

- Market houses vector across locations A-F.
- Best location for the team type.
- Best utility value for the team type.

## Key Gameplay Behavior

- Max six teams per session.
- Team names unique within a session after normalization.
- Team letters deterministic by join order.
- Team-state API hides expected answers until submission is resolved (correct or locked).
- Each round allows up to 3 incorrect submissions per team.
- Leaderboard scoring:
  - Position points by round-specific submission speed.
  - Penalty points from incorrect attempts.
- Round reveal condition:
  - All joined teams resolved for the current round.

## Tests and Verification

### Automated Tests

- `games/hedonics-online/tests/hedonics-econ.test.mts`
- `games/hedonics-online/tests/hedonics-game-logic.test.mts`
- Command:
  - `make -C games/hedonics-online test`
- Latest status:
  - 16 tests passed, 0 failed.

### Additional Checks

- Node syntax checks:
  - `node --check` across new hedonics frontend and function modules.
- Hugo build:
  - `hugo -b http://localhost`

## Site Wiring

- Added game page:
  - `content/games/games-03-hedonics.Rmd`
  - `content/games/games-03-hedonics.html`
- Added game index links:
  - `content/games/_index.Rmd`
  - `content/games/_index.html`

## Notes on Data Inputs

Legacy teaching materials contained internal inconsistencies in round-level house totals for rounds 1-2 relative to the stated total population. The implementation normalizes to a consistent 75-household market while preserving the intended gradients and classroom mechanics.

## Security Note

No private tokens, keys, or credentials are included in this report.
