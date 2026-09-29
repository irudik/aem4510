-- Round 3 repeats Round 2 trading with a real transaction cost per permit.
-- Existing trades and scores retain zero transaction costs.
begin;

alter table public.permit_sessions
  drop constraint if exists permit_sessions_current_phase_check,
  add constraint permit_sessions_current_phase_check
    check (current_phase in ('setup', 'auction1', 'market1', 'auction2', 'market2', 'market3', 'complete'));

alter table public.permit_orders
  drop constraint if exists permit_orders_round_key_check,
  add constraint permit_orders_round_key_check
    check (round_key in ('market1', 'market2', 'market3'));

alter table public.permit_trades
  drop constraint if exists permit_trades_round_key_check,
  add constraint permit_trades_round_key_check
    check (round_key in ('market1', 'market2', 'market3')),
  add column if not exists transaction_cost_per_permit numeric not null default 0
    check (transaction_cost_per_permit >= 0);

alter table public.permit_round_scores
  drop constraint if exists permit_round_scores_round_key_check,
  add constraint permit_round_scores_round_key_check
    check (round_key in ('round1', 'round2', 'round3')),
  add column if not exists transaction_cost numeric not null default 0
    check (transaction_cost >= 0);

commit;
