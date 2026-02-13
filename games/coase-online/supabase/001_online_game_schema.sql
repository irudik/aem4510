-- Schema for the online AEM 4510 Coase theorem classroom game.
-- Players join, are randomly paired by admin, and submit pair-level round agreements.

create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.coase_sessions (
  id uuid primary key default gen_random_uuid(),
  session_name text not null,
  is_active boolean not null default true,
  expected_player_count integer not null check (expected_player_count > 0),
  current_phase text not null default 'setup'
    check (current_phase in ('setup', 'round1', 'round2', 'round3', 'complete')),
  has_started boolean not null default false,
  started_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists coase_sessions_one_active_idx
  on public.coase_sessions (is_active)
  where is_active;

create table if not exists public.coase_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coase_sessions(id) on delete cascade,
  player_name text not null,
  player_name_normalized text not null,
  is_admin_proxy boolean not null default false,
  join_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (join_token),
  unique (session_id, player_name_normalized)
);

alter table public.coase_players
  add column if not exists is_admin_proxy boolean not null default false;

create index if not exists coase_players_session_idx on public.coase_players (session_id);

create table if not exists public.coase_pairs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coase_sessions(id) on delete cascade,
  pair_number integer not null check (pair_number > 0),
  player_a_id uuid not null references public.coase_players(id) on delete cascade,
  player_b_id uuid not null references public.coase_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, pair_number),
  unique (session_id, player_a_id),
  unique (session_id, player_b_id),
  check (player_a_id <> player_b_id)
);

create index if not exists coase_pairs_session_idx on public.coase_pairs (session_id);

create table if not exists public.coase_round_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coase_sessions(id) on delete cascade,
  pair_id uuid not null references public.coase_pairs(id) on delete cascade,
  player_id uuid not null references public.coase_players(id) on delete cascade,
  round_key text not null check (round_key in ('round1', 'round2', 'round3')),
  submitted_emissions integer not null check (submitted_emissions >= 0 and submitted_emissions <= 6),
  submitted_payment_noncontroller_to_controller numeric not null check (submitted_payment_noncontroller_to_controller >= 0),
  submitted_legal_fee_paid_by_a numeric not null default 0 check (submitted_legal_fee_paid_by_a >= 0 and submitted_legal_fee_paid_by_a <= 5),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, pair_id, player_id, round_key)
);

create index if not exists coase_round_submissions_session_idx
  on public.coase_round_submissions (session_id);

create index if not exists coase_round_submissions_pair_round_idx
  on public.coase_round_submissions (session_id, pair_id, round_key);

create table if not exists public.coase_round_outcomes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coase_sessions(id) on delete cascade,
  pair_id uuid not null references public.coase_pairs(id) on delete cascade,
  round_key text not null check (round_key in ('round1', 'round2', 'round3')),
  agreed_emissions integer not null check (agreed_emissions >= 0 and agreed_emissions <= 6),
  payment_noncontroller_to_controller numeric not null check (payment_noncontroller_to_controller >= 0),
  legal_fee_paid_by_a numeric not null check (legal_fee_paid_by_a >= 0 and legal_fee_paid_by_a <= 5),
  legal_fee_paid_by_b numeric not null check (legal_fee_paid_by_b >= 0 and legal_fee_paid_by_b <= 5),
  player_a_payoff numeric not null,
  player_b_payoff numeric not null,
  resolved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, pair_id, round_key)
);

create index if not exists coase_round_outcomes_session_idx
  on public.coase_round_outcomes (session_id);

create trigger trg_coase_sessions_updated_at
before update on public.coase_sessions
for each row execute procedure public.set_row_updated_at();

create trigger trg_coase_round_submissions_updated_at
before update on public.coase_round_submissions
for each row execute procedure public.set_row_updated_at();

create trigger trg_coase_round_outcomes_updated_at
before update on public.coase_round_outcomes
for each row execute procedure public.set_row_updated_at();

alter table public.coase_sessions enable row level security;
alter table public.coase_players enable row level security;
alter table public.coase_pairs enable row level security;
alter table public.coase_round_submissions enable row level security;
alter table public.coase_round_outcomes enable row level security;
