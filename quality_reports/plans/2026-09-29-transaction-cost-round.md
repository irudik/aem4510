# Round 3: transaction costs

## Design

- Replay Round 2 trading from its saved starting allocation, auction payment, carry, and realized MAC. No third auction or new shock.
- Charge buyers $3 per permit. Bid limits include the fee; asks specify seller receipts. The fee eliminates trades with $2 gross abatement savings while allowing gains above $3.
- Store fees separately from transfers and deduct them from individual scores. Keep the no-fee abatement benchmark and report a separate minimum of abatement plus transaction costs.
- Require finalized Round 2 scores; clear only Round 3 on replay and invalidate it when earlier rounds restart.
- Update both repositories and slide 50, preserving prior uncommitted work.

## Verification

Engine tests cover price priority, buyer/seller cash conservation with fees, blocked marginal trades, and an integer allocation benchmark checked against enumeration. Integration tests will cover restart state, scoring, closure, and replay. Frontend tests and rendered slides will check labels and layout. Independent review will check the economic comparison and phase transitions.

## Deployment

Migrations 005 and 006 are pending on Supabase. No production data will be changed during testing; no commit, push, or deployment requested in this turn.
