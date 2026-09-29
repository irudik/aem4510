-- Parallel MAC shifts preserve earlier games' zero intercepts.
alter table public.permit_teams
  add column if not exists mac_intercept numeric not null default 0,
  add column if not exists mac_shift_round1 numeric not null default 0,
  add column if not exists mac_shift_round2 numeric not null default 0;

alter table public.permit_round_scores
  add column if not exists mac_intercept numeric not null default 0;
