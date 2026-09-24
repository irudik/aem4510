# Plan: Teach the uniform-price permit auction

Date: 2026-09-24
Status: COMPLETED
Requested by: Ivan

## Goal

Students do not know what a uniform-price sealed-bid auction is. The lecture
mentions auctions in one line, and the game describes the auction in
auction-theory language ("bid units are stacked", "quantities are not
cumulative"). Make the auction easy to understand and play, and tie it to the
lecture's firm problem: min C(E) + pE gives MAC(E) = p, so the MAC curve is the
firm's demand curve for permits, and the auction is supply (the cap) meeting
demand (the bids).

## Approach

1. Slides (`slides/06-slides-permits.Rmd`): after the "How do we initially
   allocate permits?" slide, add a short auction block: MAC is the permit
   demand curve; the auction is supply meeting demand (reusing the lecture's
   numerical example, which clears at p = 50, the trading equilibrium); the
   auction rules; a whole-permit clearing exercise (three firms, five
   permits, price $7); why bidding MAC is sensible for a small bidder. One
   debrief slide on demand reduction, flagged for use after the game.
2. Student bid form: one price box per permit instead of free-form
   price/quantity rows. Each box is sent as a one-permit bid, so the server
   validation, database constraint, and clearing code do not change. Bids
   are sorted from highest to lowest on submission, since only the set of
   prices matters.
3. Plain-language rules in the auction stage, with the three-firm example in
   a collapsible section.
4. "What if the price were $p?" tool in the auction stage: a price slider that
   uses only the team's own typed bids to show which bids would win, the
   payment, emissions, abatement cost, and the round score before trading.
   The auction stays sealed.
5. After each auction clears, students see it as supply and demand: the
   class's bids stacked into a step demand curve, a vertical supply curve at
   the cap, and the clearing price, with their own bids marked and a table
   of their bids, whether each won, and the price paid. No team names or
   MACs are shown. The chart stays available in later phases (round 2
   bidding, round 2 market, game over). Added at Ivan's request mid-task.
6. Docs: fix stale text on the games page (four-bid limit, value table) and
   update the game README.

The bid-over-MAC overlay on the student's MAC chart is deliberately left
out: it would make "bid your MAC" too obvious for the discovery approach in
MEMORY.md.

## Files

- `slides/06-slides-permits.Rmd`
- `netlify/functions/_lib/permit_market.mts` (anonymized auction report)
- `netlify/functions/permit-team-state.mts` (send the report in market phases)
- `static/games/permit-market-online/auction-guide.mjs` (new: bid form
  conversion, what-if outcome, student charts)
- `static/games/permit-market-online/student.mjs`, `app.css`
- `games/permit-market-online/tests/permit-auction-guide.test.mts` (new)
- `content/games/games-02-permits.Rmd`, `games/permit-market-online/README.md`

## Verification

- `make -C games/permit-market-online test` passes, plus the other games'
  suites.
- `node --check` on changed static modules; import-check on the team state
  function.
- Render the student auction and market stages in a headless browser with
  example state and inspect screenshots.
- Run the new slide chunks in R and inspect the figures. The full deck needs
  Ivan's local `R/video_helpers.R`, so the deck itself is rendered locally.

## Independent Review

One review of the full change. Fixed after review: a debrief line hidden
because it began "Example:" (remark reads a leading `Word:` as a slide
property); the "why bid your MAC" slide overstated truthful bidding under
the lowest-winning-bid rule; the rules slide wrongly implied RGGI charges
the lowest winning bid (it charges the highest losing bid); the example
slide's footnote overlapped the figure; round 2 showed boxes for permits
already covered by banking; unreadable number entries were skipped
silently; the debrief slide moved to an "After the permit game" section at
the end of the deck. Pre-existing and left alone: lines beginning
"Alternatively:", "Solve:", "FOC:", and "Cliffnotes:" elsewhere in the deck
are hidden by the same remark rule.

## Optional Reviews

None requested; domain review and proofreading omitted.
