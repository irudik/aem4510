-- Game options for the permit market: per-round allocation method and cost
-- shock, banking with borrowing, and each team's Round 1 emissions choice.
-- Every new column has a default that reproduces the earlier game, so
-- existing sessions and rows keep working. Apply before deploying the
-- matching site code.
begin;

-- Session settings.
alter table public.permit_sessions
  add column if not exists allocation_round1 text not null default 'uniform',
  add column if not exists allocation_round2 text not null default 'uniform',
  add column if not exists shock_round1 boolean not null default false,
  add column if not exists shock_round2 boolean not null default false,
  add column if not exists borrowing_enabled boolean not null default false,
  add column if not exists shortfall_penalty numeric not null default 50;

alter table public.permit_sessions
  drop constraint if exists permit_sessions_allocation_round1_check;
alter table public.permit_sessions
  add constraint permit_sessions_allocation_round1_check
  check (allocation_round1 in ('uniform', 'pay_as_bid', 'free'));
alter table public.permit_sessions
  drop constraint if exists permit_sessions_allocation_round2_check;
alter table public.permit_sessions
  add constraint permit_sessions_allocation_round2_check
  check (allocation_round2 in ('uniform', 'pay_as_bid', 'free'));
alter table public.permit_sessions
  drop constraint if exists permit_sessions_shortfall_penalty_check;
alter table public.permit_sessions
  add constraint permit_sessions_shortfall_penalty_check
  check (shortfall_penalty >= 0);

-- Each firm's MAC slope multiplier in each round (1 means no shock).
alter table public.permit_teams
  add column if not exists mac_shock_round1 numeric not null default 1,
  add column if not exists mac_shock_round2 numeric not null default 1;

-- Round 1 emissions chosen by a team during the market. Emitting less than
-- the permits it holds banks the rest; emitting more borrows from Round 2.
create table if not exists public.permit_emission_choices (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.permit_sessions(id) on delete cascade,
  team_id uuid not null references public.permit_teams(id) on delete cascade,
  round_key text not null check (round_key in ('round1')),
  emissions integer not null check (emissions >= 0),
  updated_at timestamptz not null default now(),
  unique (session_id, team_id, round_key)
);

alter table public.permit_emission_choices enable row level security;

-- Round accounting for borrowing, shortfalls, and shocks.
alter table public.permit_round_scores
  add column if not exists permits_borrowed_out integer not null default 0,
  add column if not exists permits_owed_in integer not null default 0,
  add column if not exists shortfall integer not null default 0,
  add column if not exists shortfall_penalty numeric not null default 0,
  add column if not exists mac_shock numeric not null default 1;

commit;
