-- Schema for the online AEM 4510 hedonics classroom game.
-- Teams represent household types and submit round-level market outcomes.

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

create table if not exists public.hedonics_sessions (
  id uuid primary key default gen_random_uuid(),
  session_name text not null,
  is_active boolean not null default true,
  expected_team_count integer not null check (expected_team_count > 0 and expected_team_count <= 6),
  current_phase text not null default 'setup'
    check (current_phase in ('setup', 'round1', 'round2', 'round3', 'round4a', 'round4b', 'round5', 'complete')),
  scoring_rank_points text not null default '10,7,5,3,1',
  scoring_wrong_deduction numeric not null default 1 check (scoring_wrong_deduction >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hedonics_sessions_one_active_idx
  on public.hedonics_sessions (is_active)
  where is_active;

create table if not exists public.hedonics_teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.hedonics_sessions(id) on delete cascade,
  team_name text not null,
  team_name_normalized text not null,
  team_letter text not null,
  household_type_key text not null
    check (household_type_key in ('black', 'red', 'orange', 'yellow', 'green', 'blue')),
  household_type_label text not null,
  household_count integer not null check (household_count > 0),
  alpha_eq numeric not null,
  beta_sq numeric not null,
  join_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (join_token),
  unique (session_id, team_name_normalized),
  unique (session_id, team_letter),
  unique (session_id, household_type_key)
);

create index if not exists hedonics_teams_session_idx on public.hedonics_teams (session_id);

create table if not exists public.hedonics_round_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.hedonics_sessions(id) on delete cascade,
  team_id uuid not null references public.hedonics_teams(id) on delete cascade,
  round_key text not null check (round_key in ('round1', 'round2', 'round3', 'round4a', 'round4b', 'round5')),
  submitted_houses jsonb not null,
  submitted_best_location text not null check (submitted_best_location in ('A', 'B', 'C', 'D', 'E', 'F')),
  submitted_best_utility numeric not null,
  expected_houses jsonb not null,
  expected_prices jsonb not null,
  expected_best_locations text[] not null,
  expected_best_utility numeric not null,
  expected_wtp jsonb not null,
  expected_utility jsonb not null,
  houses_correct boolean not null,
  best_location_correct boolean not null,
  best_utility_correct boolean not null,
  is_correct boolean not null,
  incorrect_attempts integer not null default 0 check (incorrect_attempts >= 0 and incorrect_attempts <= 3),
  is_locked boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, team_id, round_key)
);

create index if not exists hedonics_round_submissions_session_idx
  on public.hedonics_round_submissions (session_id);

create index if not exists hedonics_round_submissions_round_idx
  on public.hedonics_round_submissions (session_id, round_key);

create trigger trg_hedonics_sessions_updated_at
before update on public.hedonics_sessions
for each row execute procedure public.set_row_updated_at();

create trigger trg_hedonics_round_submissions_updated_at
before update on public.hedonics_round_submissions
for each row execute procedure public.set_row_updated_at();

alter table public.hedonics_sessions enable row level security;
alter table public.hedonics_teams enable row level security;
alter table public.hedonics_round_submissions enable row level security;
