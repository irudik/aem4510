-- Add per-phase attempt limits for team submissions.
-- Teams may submit incorrect answers up to 3 times per phase; after that,
-- the submission row is marked locked and expected answers are revealed.

alter table public.uniform_submissions
  add column if not exists incorrect_attempts integer not null default 0 check (incorrect_attempts >= 0 and incorrect_attempts <= 3);

alter table public.uniform_submissions
  add column if not exists is_locked boolean not null default false;

alter table public.called_price_submissions
  add column if not exists incorrect_attempts integer not null default 0 check (incorrect_attempts >= 0 and incorrect_attempts <= 3);

alter table public.called_price_submissions
  add column if not exists is_locked boolean not null default false;

alter table public.md_submissions
  add column if not exists incorrect_attempts integer not null default 0 check (incorrect_attempts >= 0 and incorrect_attempts <= 3);

alter table public.md_submissions
  add column if not exists is_locked boolean not null default false;

update public.uniform_submissions
set incorrect_attempts = least(
  3,
  greatest(
    coalesce(incorrect_attempts, 0),
    case when is_correct then 0 else 1 end
  )
);

update public.uniform_submissions
set is_locked = (not is_correct) and incorrect_attempts >= 3;

update public.called_price_submissions
set incorrect_attempts = least(
  3,
  greatest(
    coalesce(incorrect_attempts, 0),
    case when is_correct then 0 else 1 end
  )
);

update public.called_price_submissions
set is_locked = (not is_correct) and incorrect_attempts >= 3;

update public.md_submissions
set incorrect_attempts = least(
  3,
  greatest(
    coalesce(incorrect_attempts, 0),
    case when is_correct then 0 else 1 end
  )
);

update public.md_submissions
set is_locked = (not is_correct) and incorrect_attempts >= 3;
