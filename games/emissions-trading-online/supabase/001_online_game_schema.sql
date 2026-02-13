-- Schema for the online AEM 4510 emissions-trading classroom game.
-- Economic state is stored at the session/team/submission level so each stage
-- can be validated and summarized on the instructor dashboard.

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

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  session_name text not null,
  is_active boolean not null default true,
  expected_team_count integer not null check (expected_team_count > 0),
  common_permit_allocation numeric not null check (common_permit_allocation >= 0),
  current_phase text not null default 'setup'
    check (current_phase in ('setup', 'uniform', 'called_price', 'md', 'complete')),
  called_price numeric check (called_price is null or called_price >= 0),
  called_price_excess_demand numeric,
  called_price_revealed_at timestamptz,
  md_constant numeric check (md_constant is null or md_constant >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists game_sessions_one_active_idx
  on public.game_sessions (is_active)
  where is_active;

create table if not exists public.game_teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  team_name text not null,
  team_name_normalized text not null,
  team_letter text not null,
  mac_intercept numeric not null check (mac_intercept >= 0),
  mac_slope numeric not null check (mac_slope > 0),
  permit_allocation numeric not null check (permit_allocation >= 0),
  initial_emissions numeric not null check (initial_emissions >= 0),
  join_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (join_token),
  unique (session_id, team_name_normalized),
  unique (session_id, team_letter)
);

create index if not exists game_teams_session_idx on public.game_teams (session_id);

create table if not exists public.uniform_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  team_id uuid not null references public.game_teams(id) on delete cascade,
  submitted_emissions numeric not null check (submitted_emissions >= 0),
  submitted_abatement numeric not null check (submitted_abatement >= 0),
  submitted_abatement_cost numeric not null check (submitted_abatement_cost >= 0),
  expected_emissions numeric not null check (expected_emissions >= 0),
  expected_abatement numeric not null check (expected_abatement >= 0),
  expected_abatement_cost numeric not null check (expected_abatement_cost >= 0),
  emissions_correct boolean not null,
  abatement_correct boolean not null,
  cost_correct boolean not null,
  is_correct boolean not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, team_id)
);

create index if not exists uniform_submissions_session_idx
  on public.uniform_submissions (session_id);

create table if not exists called_price_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  team_id uuid not null references public.game_teams(id) on delete cascade,
  called_price numeric not null check (called_price >= 0),
  submitted_abatement numeric not null check (submitted_abatement >= 0),
  expected_abatement numeric not null check (expected_abatement >= 0),
  abatement_correct boolean not null,
  is_correct boolean not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, team_id, called_price)
);

create index if not exists called_price_submissions_session_idx
  on called_price_submissions (session_id);

create table if not exists md_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  team_id uuid not null references public.game_teams(id) on delete cascade,
  md_constant numeric not null check (md_constant >= 0),
  submitted_efficient_emissions numeric not null check (submitted_efficient_emissions >= 0),
  submitted_industry_cap numeric not null check (submitted_industry_cap >= 0),
  expected_efficient_emissions numeric not null check (expected_efficient_emissions >= 0),
  expected_industry_cap numeric not null check (expected_industry_cap >= 0),
  efficient_emissions_correct boolean not null,
  industry_cap_correct boolean not null,
  is_correct boolean not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, team_id, md_constant)
);

create index if not exists md_submissions_session_idx
  on md_submissions (session_id);

create trigger trg_game_sessions_updated_at
before update on public.game_sessions
for each row execute procedure public.set_row_updated_at();

create trigger trg_uniform_submissions_updated_at
before update on public.uniform_submissions
for each row execute procedure public.set_row_updated_at();

create trigger trg_called_price_submissions_updated_at
before update on public.called_price_submissions
for each row execute procedure public.set_row_updated_at();

create trigger trg_md_submissions_updated_at
before update on public.md_submissions
for each row execute procedure public.set_row_updated_at();

alter table public.game_sessions enable row level security;
alter table public.game_teams enable row level security;
alter table public.uniform_submissions enable row level security;
alter table public.called_price_submissions enable row level security;
alter table public.md_submissions enable row level security;
