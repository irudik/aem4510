-- Interactive bargaining upgrade for the Coase online game.
-- Students now bargain inside the app: offers and counteroffers replace the
-- old matched-submission flow. Rounds run against a countdown; pairs that do
-- not reach a deal are finalized at the status quo when the round closes.

-- Round timing lives on the session: round_seconds is the default round
-- length, phase_deadline_at is the wall-clock cutoff for the current round.
alter table public.coase_sessions
  add column if not exists round_seconds integer not null default 300
    check (round_seconds >= 30 and round_seconds <= 3600);

alter table public.coase_sessions
  add column if not exists phase_deadline_at timestamptz;

-- Bargaining offers. At most one pending offer per pair per round; a new
-- offer supersedes the pending one, acceptance resolves the round.
create table if not exists public.coase_offers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coase_sessions(id) on delete cascade,
  pair_id uuid not null references public.coase_pairs(id) on delete cascade,
  round_key text not null check (round_key in ('round1', 'round2', 'round3')),
  offer_index integer not null check (offer_index > 0),
  proposer_player_id uuid not null references public.coase_players(id) on delete cascade,
  offered_emissions integer not null check (offered_emissions >= 0 and offered_emissions <= 6),
  offered_payment_noncontroller_to_controller numeric not null
    check (offered_payment_noncontroller_to_controller >= 0),
  offered_legal_fee_paid_by_a numeric not null default 0
    check (offered_legal_fee_paid_by_a >= 0 and offered_legal_fee_paid_by_a <= 5),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'superseded')),
  responded_by_player_id uuid references public.coase_players(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists coase_offers_session_idx
  on public.coase_offers (session_id);

create index if not exists coase_offers_pair_round_idx
  on public.coase_offers (session_id, pair_id, round_key);

create unique index if not exists coase_offers_one_pending_idx
  on public.coase_offers (pair_id, round_key)
  where status = 'pending';

-- Outcomes gain a no-deal marker: true when a pair walked away or timed out
-- and the round finalized at the status quo allocation.
alter table public.coase_round_outcomes
  add column if not exists no_deal boolean not null default false;

alter table public.coase_offers enable row level security;
