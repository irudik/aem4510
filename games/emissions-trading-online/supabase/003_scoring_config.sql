-- Add session-level scoring configuration for speed-based leaderboard points.

alter table public.game_sessions
  add column if not exists scoring_rank_points text not null default '10,7,5,3,1';

alter table public.game_sessions
  add column if not exists scoring_wrong_deduction numeric not null default 1
  check (scoring_wrong_deduction >= 0);

update public.game_sessions
set scoring_rank_points = '10,7,5,3,1'
where scoring_rank_points is null or btrim(scoring_rank_points) = '';

update public.game_sessions
set scoring_wrong_deduction = 1
where scoring_wrong_deduction is null or scoring_wrong_deduction < 0;
