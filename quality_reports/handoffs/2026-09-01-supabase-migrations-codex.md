# Handoff: apply two Supabase migrations for the class games

Date: 2026-09-01
From: Claude session (Coase + permit market game builds)
To: Codex (browser-capable), dispatched by Ivan

## Goal

Run two SQL migration files against the class Supabase project so the two
new games work in class:

1. `games/coase-online/supabase/002_interactive_offers.sql`
   (interactive bargaining upgrade for the Coase game)
2. `games/permit-market-online/supabase/001_permit_market_schema.sql`
   (full schema for the new permit market game)

Both files are in this repo. Both are safe to re-run: every statement uses
`if not exists` or `create or replace`, and nothing drops or modifies
existing data. Run file 1 first, then file 2, each as one script.

## Where

Supabase dashboard, the existing class project (the one already hosting the
`coase_*`, `emissions_*`/game, and `hedonics_*` tables). Project reference:
`vuporrnrpfuibrtwqxww` (URL https://vuporrnrpfuibrtwqxww.supabase.co).
Direct link to the SQL editor:
https://supabase.com/dashboard/project/vuporrnrpfuibrtwqxww/sql/new

## Steps

1. Open the SQL editor link above (log in with Ivan's Supabase account if
   prompted).
2. Paste the full contents of
   `games/coase-online/supabase/002_interactive_offers.sql` and run it.
   Expect "Success. No rows returned."
3. Open a fresh query, paste the full contents of
   `games/permit-market-online/supabase/001_permit_market_schema.sql`, and
   run it. Same expectation.
4. Verify with this query:

   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public'
     and table_name in (
       'coase_offers',
       'permit_sessions', 'permit_teams', 'permit_auction_bids',
       'permit_auction_results', 'permit_auction_allocations',
       'permit_orders', 'permit_trades', 'permit_round_scores'
     )
   order by table_name;
   ```

   All nine tables should be listed. Also confirm the Coase timer columns:

   ```sql
   select column_name from information_schema.columns
   where table_name = 'coase_sessions'
     and column_name in ('round_seconds', 'phase_deadline_at');
   ```

   Both columns should be listed.

## Acceptance criteria

- Both scripts run without errors.
- The two verification queries return 9 rows and 2 rows respectively.
- No other tables were altered or dropped.

## Cautions

- Do not run any other SQL, and do not touch the table editor.
- If a statement errors, stop and report the exact error text instead of
  improvising a fix.
- No repo files need editing and nothing should be committed.
