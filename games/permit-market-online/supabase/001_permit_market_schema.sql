-- Schema for the AEM 4510 permit market game.
-- Teams bid in a uniform-price permit auction, then trade in a live
-- secondary market with an order book. Round 2 repeats with a tighter cap;
-- banking (optional) carries unused permits from round 1 to round 2.

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

create table if not exists public.permit_sessions (
  id uuid primary key default gen_random_uuid(),
  session_name text not null,
  is_active boolean not null default true,
  expected_team_count integer not null check (expected_team_count > 0),
  current_phase text not null default 'setup'
    check (current_phase in ('setup', 'auction1', 'market1', 'auction2', 'market2', 'complete')),
  -- Caps are set as shares of total baseline emissions and resolved to
  -- integer permit counts when each auction opens.
  cap_share_round1 integer not null default 60 check (cap_share_round1 between 1 and 100),
  cap_share_round2 integer not null default 40 check (cap_share_round2 between 1 and 100),
  cap_round1 integer,
  cap_round2 integer,
  banking_enabled boolean not null default false,
  round_seconds integer not null default 300
    check (round_seconds >= 30 and round_seconds <= 3600),
  phase_deadline_at timestamptz,
  has_started boolean not null default false,
  started_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists permit_sessions_one_active_idx
  on public.permit_sessions (is_active)
  where is_active;

create table if not exists public.permit_teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.permit_sessions(id) on delete cascade,
  team_name text not null,
  team_name_normalized text not null,
  join_token uuid not null default gen_random_uuid(),
  baseline_emissions integer check (baseline_emissions > 0),
  mac_slope integer check (mac_slope > 0),
  created_at timestamptz not null default now(),
  unique (join_token),
  unique (session_id, team_name_normalized)
);

create index if not exists permit_teams_session_idx on public.permit_teams (session_id);

-- Sealed auction bids: up to a fixed number of (price, quantity) pairs per
-- team per auction, revisable until the deadline.
create table if not exists public.permit_auction_bids (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.permit_sessions(id) on delete cascade,
  team_id uuid not null references public.permit_teams(id) on delete cascade,
  round_key text not null check (round_key in ('auction1', 'auction2')),
  bid_index integer not null check (bid_index between 1 and 4),
  bid_price numeric not null check (bid_price >= 0),
  bid_quantity integer not null check (bid_quantity > 0),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, team_id, round_key, bid_index)
);

create index if not exists permit_auction_bids_session_round_idx
  on public.permit_auction_bids (session_id, round_key);

create table if not exists public.permit_auction_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.permit_sessions(id) on delete cascade,
  round_key text not null check (round_key in ('auction1', 'auction2')),
  cap integer not null check (cap >= 0),
  clearing_price numeric,
  total_bid_quantity integer not null default 0,
  cleared_at timestamptz not null default now(),
  unique (session_id, round_key)
);

create table if not exists public.permit_auction_allocations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.permit_sessions(id) on delete cascade,
  round_key text not null check (round_key in ('auction1', 'auction2')),
  team_id uuid not null references public.permit_teams(id) on delete cascade,
  permits_won integer not null check (permits_won >= 0),
  payment numeric not null check (payment >= 0),
  unique (session_id, round_key, team_id)
);

-- Secondary market limit orders. remaining_quantity tracks partial fills.
create table if not exists public.permit_orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.permit_sessions(id) on delete cascade,
  round_key text not null check (round_key in ('market1', 'market2')),
  team_id uuid not null references public.permit_teams(id) on delete cascade,
  side text not null check (side in ('bid', 'ask')),
  price numeric not null check (price >= 0),
  quantity integer not null check (quantity > 0),
  remaining_quantity integer not null check (remaining_quantity >= 0),
  status text not null default 'open'
    check (status in ('open', 'filled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists permit_orders_session_round_idx
  on public.permit_orders (session_id, round_key, status);

create table if not exists public.permit_trades (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.permit_sessions(id) on delete cascade,
  round_key text not null check (round_key in ('market1', 'market2')),
  buyer_team_id uuid not null references public.permit_teams(id) on delete cascade,
  seller_team_id uuid not null references public.permit_teams(id) on delete cascade,
  buy_order_id uuid references public.permit_orders(id) on delete set null,
  sell_order_id uuid references public.permit_orders(id) on delete set null,
  price numeric not null check (price >= 0),
  quantity integer not null check (quantity > 0),
  executed_at timestamptz not null default now()
);

create index if not exists permit_trades_session_round_idx
  on public.permit_trades (session_id, round_key);

-- Final accounting per team per round, written when a market phase closes.
create table if not exists public.permit_round_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.permit_sessions(id) on delete cascade,
  round_key text not null check (round_key in ('round1', 'round2')),
  team_id uuid not null references public.permit_teams(id) on delete cascade,
  permits_from_auction integer not null default 0,
  auction_payment numeric not null default 0,
  permits_banked_in integer not null default 0,
  market_buys integer not null default 0,
  market_sells integer not null default 0,
  market_net_spend numeric not null default 0,
  permits_end integer not null default 0,
  emissions integer not null default 0,
  abatement integer not null default 0,
  abatement_cost numeric not null default 0,
  permits_banked_out integer not null default 0,
  score numeric not null default 0,
  benchmark_price numeric,
  benchmark_permits integer,
  benchmark_score numeric,
  scored_at timestamptz not null default now(),
  unique (session_id, round_key, team_id)
);

create index if not exists permit_round_scores_session_idx
  on public.permit_round_scores (session_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_permit_sessions_updated_at'
      and tgrelid = 'public.permit_sessions'::regclass
  ) then
    create trigger trg_permit_sessions_updated_at
    before update on public.permit_sessions
    for each row execute procedure public.set_row_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_permit_auction_bids_updated_at'
      and tgrelid = 'public.permit_auction_bids'::regclass
  ) then
    create trigger trg_permit_auction_bids_updated_at
    before update on public.permit_auction_bids
    for each row execute procedure public.set_row_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_permit_orders_updated_at'
      and tgrelid = 'public.permit_orders'::regclass
  ) then
    create trigger trg_permit_orders_updated_at
    before update on public.permit_orders
    for each row execute procedure public.set_row_updated_at();
  end if;
end;
$$;

alter table public.permit_sessions enable row level security;
alter table public.permit_teams enable row level security;
alter table public.permit_auction_bids enable row level security;
alter table public.permit_auction_results enable row level security;
alter table public.permit_auction_allocations enable row level security;
alter table public.permit_orders enable row level security;
alter table public.permit_trades enable row level security;
alter table public.permit_round_scores enable row level security;
