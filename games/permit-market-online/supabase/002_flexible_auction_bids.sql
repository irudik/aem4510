-- Allow a separate bid for every unit of baseline emissions.
-- The API still limits total bid quantity to the firm's baseline.
-- No existing bids change; all previously valid bid indices remain valid.
begin;

alter table public.permit_auction_bids
  drop constraint if exists permit_auction_bids_bid_index_check;
alter table public.permit_auction_bids
  add constraint permit_auction_bids_bid_index_check check (bid_index > 0);

commit;
