# Coase Online Game: Implementation Report

## Scope Completed

Implemented and integrated an online version of the AEM 4510 Coase theorem game with:

- Player self-registration and session-scoped identity.
- Instructor-only controls for session creation, random pairing, and phase transitions.
- Pair-based round submission workflow for rounds 1-3.
- Economics-based resolution of negotiated outcomes and payoffs.
- Odd-player support through admin proxy pairing.
- Course-site game page updates with online login links and revised instructions.

## Architecture Implemented

### Frontend

- `static/games/coase-online/index.html`
- `static/games/coase-online/student.html`
- `static/games/coase-online/admin.html`
- `static/games/coase-online/student.mjs`
- `static/games/coase-online/admin.mjs`
- `static/games/coase-online/shared.mjs`
- `static/games/coase-online/app.css`

### Backend

- `netlify/functions/_lib/coase.mts`
- `netlify/functions/_lib/coase_game_service.mts`
- `netlify/functions/coase-config.mts`
- `netlify/functions/coase-admin-create-session.mts`
- `netlify/functions/coase-admin-start-game.mts`
- `netlify/functions/coase-admin-set-phase.mts`
- `netlify/functions/coase-admin-state.mts`
- `netlify/functions/coase-player-join.mts`
- `netlify/functions/coase-player-state.mts`
- `netlify/functions/coase-player-submit-round.mts`

### Database

- Migration:
  - `games/coase-online/supabase/001_online_game_schema.sql`
- Core tables:
  - `coase_sessions`
  - `coase_players`
  - `coase_pairs`
  - `coase_round_submissions`
  - `coase_round_outcomes`

## Economic and Game Logic

- Fixed payoff table over emissions levels `0` to `6`.
- Round control rights:
  - `round1`: controller is A.
  - `round2` and `round3`: controller is B.
- Transfer convention:
  - Input transfer is always noncontroller-to-controller.
- Round 3 legal-cost rule:
  - Positive transfer triggers total legal cost of 5.
  - Cost split is submitted as `legal_fee_paid_by_a` with B paying residual.

## Pairing and Resolution Behavior

- Session can start once at least one student is present.
- Random pairing is generated from joined students.
- If student count is odd, an admin proxy player is created/used to complete one pair.
- Round resolution:
  - Regular pairs require matching submissions from both players.
  - Admin-proxy pairs resolve from the single student submission.

## Validation and Testing

### Automated Tests

- `games/coase-online/tests/coase-econ.test.mts`
- `games/coase-online/tests/coase-logic.test.mts`
- Command:
  - `make -C games/coase-online test`
- Latest status:
  - 13 tests passed, 0 failed.

### Additional Checks

- Node syntax checks on Coase function and frontend modules (`node --check`).
- Coase game page render check via `rmarkdown::render`.
- Production deploy verification via Netlify deploy metadata and HTTP smoke checks.

## Production Verification Snapshot

- Deploy commit: `476baabbc71657a7418f0ad03b1049395a0cbe86`
- Deploy state: `ready`
- Verified HTTP 200 for:
  - `/games/coase-online/index.html`
  - `/games/coase-online/admin.html`
  - `/games/coase-online/student.html`
- Verified `/api/coase/config` response and `/api/coase/player/join` behavior when no active session.

## Security Note

No private keys, tokens, passwords, or other secret values are included in this report.
