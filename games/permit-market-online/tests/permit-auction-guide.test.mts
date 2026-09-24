import test from "node:test";
import assert from "node:assert/strict";
import {
  FIRM_TYPES,
  abatementCost,
  clearAuction,
  scoreTeamRound,
  studentAuctionReport,
  validateBidSet,
  valueSchedule,
} from "../../../netlify/functions/_lib/permit_market.mts";
import {
  auctionReportChartSvg,
  auctionReportHtml,
  auctionRulesHtml,
  biddablePermits,
  bidsFromPermitPrices,
  clearedAuctionsHtml,
  outcomeAtPrice,
  permitBidInputsHtml,
  permitPricesFromBids,
  typedPermitPrices,
  whatIfChartSvg,
} from "../../../static/games/permit-market-online/auction-guide.mjs";

/** One-permit bids for each team, in the order given. */
function unitBids(pricesByTeam) {
  return Object.entries(pricesByTeam).flatMap(([teamId, prices]) => prices.map((price, index) => ({
    team_id: teamId,
    bid_price: price,
    bid_quantity: 1,
    submitted_at: `2026-09-24T10:00:0${index}Z`,
  })));
}

/** The three-firm, five-permit example used on the slides and the student page. */
const exampleBids = { A: [12, 9, 6, 3], B: [10, 7, 4, 1], C: [8, 5, 2] };

/** Surplus of each firm in the example: value of permits won minus payment. */
function exampleSurplus(submittedBids) {
  const cleared = clearAuction(5, unitBids(submittedBids));
  const surplus = {};
  for (const [teamId, values] of Object.entries(exampleBids)) {
    const won = cleared.allocations.find((row) => row.team_id === teamId)?.permits_won ?? 0;
    const value = values.slice(0, won).reduce((sum, price) => sum + price, 0);
    surplus[teamId] = { won, surplus: value - won * cleared.clearing_price };
  }
  return { price: cleared.clearing_price, surplus };
}

test("the worked example clears at $7 with A, B, C winning 2, 2, 1", () => {
  const cleared = clearAuction(5, unitBids(exampleBids));
  assert.equal(cleared.clearing_price, 7);
  const won = Object.fromEntries(cleared.allocations.map((row) => [row.team_id, row.permits_won]));
  assert.deepEqual(won, { A: 2, B: 2, C: 1 });
  const rules = auctionRulesHtml(5);
  assert.match(rules, /lowest winning bid, <strong>\$7<\/strong>/);
  assert.match(rules, /A wins 2 permits and pays \$14, B wins 2 and pays \$14,\s+C wins 1 and pays \$7/);
});

test("slide examples: underbidding and overbidding hurt C; shading helps A when it sets the price", () => {
  const truthful = exampleSurplus(exampleBids);
  assert.deepEqual(truthful.surplus, { A: { won: 2, surplus: 7 }, B: { won: 2, surplus: 3 }, C: { won: 1, surplus: 1 } });

  const underbid = exampleSurplus({ ...exampleBids, C: [5, 5, 2] });
  assert.equal(underbid.price, 6);
  assert.deepEqual(underbid.surplus.C, { won: 0, surplus: 0 });

  // C bids 7.5 on a second permit that saves it only 5.
  const overbid = exampleSurplus({ ...exampleBids, C: [8, 7.5, 2] });
  assert.equal(overbid.price, 7.5);
  assert.deepEqual(overbid.surplus.C, { won: 2, surplus: -2 });

  // A shades its second bid from 9 to 6: same allocation, lower price.
  const shaded = exampleSurplus({ ...exampleBids, A: [12, 6, 6, 3] });
  assert.equal(shaded.price, 6);
  assert.deepEqual(shaded.surplus.A, { won: 2, surplus: 9 });
  assert.equal(shaded.surplus.B.won, 2);
  assert.equal(shaded.surplus.C.won, 1);
});

test("the student report hides teams, fills exactly the cap, and matches the clearing", () => {
  const bids = unitBids(exampleBids);
  const cleared = clearAuction(5, bids);
  for (const teamId of Object.keys(exampleBids)) {
    const report = studentAuctionReport(5, bids, teamId);
    assert.equal(report.clearing_price, cleared.clearing_price);
    assert.equal(report.stack.reduce((sum, step) => sum + step.accepted_quantity, 0), 5);
    for (const step of report.stack) {
      assert.deepEqual(Object.keys(step).sort(), ["accepted_quantity", "from_quantity", "own", "price", "to_quantity"]);
    }
    const allocation = cleared.allocations.find((row) => row.team_id === teamId);
    assert.equal(report.permits_won, allocation.permits_won);
    assert.equal(report.payment, allocation.payment);
    assert.equal(report.own_bids.filter((bid) => bid.won).length, allocation.permits_won);
    assert.equal(report.stack.filter((step) => step.own).length, exampleBids[teamId].length);
  }

  const reportA = studentAuctionReport(5, bids, "A");
  assert.deepEqual(reportA.own_bids.map((bid) => [bid.bid_price, bid.won, bid.price_paid]),
    [[12, true, 7], [9, true, 7], [6, false, null], [3, false, null]]);
  const html = auctionReportHtml(reportA, "Round 1");
  assert.match(html, /you bid \$12\.00 for permit 1 and paid \$7\.00/);
  assert.doesNotMatch(JSON.stringify(reportA), /team_id|submitted_at/);
});

test("the student report handles several permits per bid row and a bid split by the cap", () => {
  const bids = [
    { team_id: "X", bid_price: 10, bid_quantity: 3, submitted_at: "1" },
    { team_id: "Y", bid_price: 8, bid_quantity: 4, submitted_at: "2" },
    { team_id: "X", bid_price: 5, bid_quantity: 2, submitted_at: "3" },
  ];
  const report = studentAuctionReport(5, bids, "Y");
  assert.equal(report.clearing_price, 8);
  assert.deepEqual(report.stack.map((step) => step.accepted_quantity), [3, 2, 0]);
  assert.equal(report.permits_won, 2);
  assert.deepEqual(report.own_bids.map((bid) => bid.won), [true, true, false, false]);
  assert.equal(report.payment, 16);
});

test("an auction with no bids reports no price and no permits", () => {
  const report = studentAuctionReport(5, [], "A");
  assert.equal(report.clearing_price, null);
  assert.equal(report.permits_won, 0);
  assert.deepEqual(report.own_bids, []);
  assert.match(auctionReportHtml(report, "Round 1"), /No bids arrived/);
});

test("per-permit boxes become one-permit bids, highest first, that the server accepts", () => {
  const converted = bidsFromPermitPrices(["5", "", "12", " 8 "]);
  assert.deepEqual(converted.prices, [12, 8, 5]);
  assert.ok(converted.reordered);
  assert.ok(converted.bids.every((bid) => bid.bid_quantity === 1));
  assert.equal(validateBidSet({ baseline_emissions: 4 }, converted.bids).length, 3);

  assert.equal(bidsFromPermitPrices(["12", "8", "8", ""]).reordered, false);
  assert.throws(() => bidsFromPermitPrices(["4", "-1"]), /Permit 2/);
  assert.throws(() => bidsFromPermitPrices(["abc"]), /Permit 1/);
  assert.deepEqual(typedPermitPrices(["4", "abc", "", "-2", "9"]), [9, 4]);

  for (const firm of FIRM_TYPES) {
    const fullSchedule = valueSchedule(firm.baseline_emissions, firm.mac_slope).map((step) => String(step.value));
    const { bids } = bidsFromPermitPrices(fullSchedule);
    assert.equal(validateBidSet(firm, bids).length, firm.baseline_emissions);
  }
});

test("stored bids with several permits per row fill the boxes one permit each", () => {
  const prices = permitPricesFromBids([
    { bid_price: 4, bid_quantity: 2 },
    { bid_price: 9, bid_quantity: 1 },
  ]);
  assert.deepEqual(prices, [9, 4, 4]);
  const html = permitBidInputsHtml(5, prices);
  assert.equal((html.match(/class="permit-bid-price"/g) ?? []).length, 5);
});

test("banked permits leave boxes only for the units they do not already cover", () => {
  assert.equal(biddablePermits(5, 2), 3);
  const withBank = permitBidInputsHtml(5, [9, 4, 4], { bankedIn: 2 });
  assert.equal((withBank.match(/class="permit-bid-price"/g) ?? []).length, 3);
  assert.match(withBank, /permit 1 here covers your 3rd unit/);
  assert.equal(biddablePermits(6, 8), 0);
  const covered = permitBidInputsHtml(6, [], { bankedIn: 8 });
  assert.doesNotMatch(covered, /permit-bid-price/);
  assert.match(covered, /worth \$0 to you/);
});

test("the what-if score equals the game's score for the same permits and payment", () => {
  for (const firm of FIRM_TYPES) {
    const prices = [20, 14, 14, 9, 3, 0].slice(0, firm.baseline_emissions);
    for (const bankedIn of [0, 2]) {
      for (let price = 0; price <= 25; price += 0.5) {
        const outcome = outcomeAtPrice(
          { baseline: firm.baseline_emissions, slope: firm.mac_slope, bankedIn },
          prices,
          price,
        );
        const scored = scoreTeamRound({ id: "T", ...firm }, {
          permits_from_auction: outcome.permitsWon,
          auction_payment: outcome.payment,
          permits_banked_in: bankedIn,
          trades: [],
          banking_enabled: bankedIn > 0,
          is_final_round: true,
        });
        assert.equal(outcome.score, scored.score);
        assert.equal(outcome.emissions, scored.emissions);
        assert.equal(outcome.abatementCost, scored.abatement_cost);
      }
    }
  }
});

test("at any price, bidding the MAC schedule wins the permit count a price taker wants", () => {
  for (const firm of FIRM_TYPES) {
    const baseline = firm.baseline_emissions;
    const slope = firm.mac_slope;
    const macBids = valueSchedule(baseline, slope).map((step) => step.value);
    for (let price = 0.25; price <= 30; price += 0.5) {
      const outcome = outcomeAtPrice({ baseline, slope }, macBids, price);
      const bestScore = Math.max(...Array.from({ length: baseline + 1 }, (_, permits) => (
        abatementCost(slope, baseline) - abatementCost(slope, baseline - permits) - price * permits
      )));
      assert.ok(Math.abs(outcome.score - bestScore) < 1e-9, `${JSON.stringify(firm)} at ${price}`);
    }
  }
});

test("the what-if chart marks bids at or above the price as winning", () => {
  const svg = whatIfChartSvg(4, [12, 9, 6, 3], 7, 20);
  assert.equal((svg.match(/whatif-bar-win/g) ?? []).length, 2);
  assert.equal((svg.match(/whatif-bar-lose/g) ?? []).length, 2);
  assert.match(svg, /At a price of \$7\.00, 2 of them win/);
});

test("the report merges adjacent equal bids without changing the demand curve", () => {
  const bids = unitBids({ X: [9, 9, 9, 4], Y: [9, 9, 2], Z: [4, 4] });
  const report = studentAuctionReport(6, bids, "Z");
  // Other teams' 9s are adjacent and merge; Z's own 4s stay separate from X's 4.
  const nineSteps = report.stack.filter((step) => step.price === 9);
  assert.equal(nineSteps.length, 1);
  assert.equal(nineSteps[0].to_quantity - nineSteps[0].from_quantity, 5);
  assert.equal(report.stack.at(-1).to_quantity, 9);
  assert.equal(report.stack.reduce((sum, step) => sum + step.accepted_quantity, 0), 6);
  const unitsAtOrAbove = (price) => report.stack.filter((step) => step.price >= price)
    .reduce((sum, step) => sum + step.to_quantity - step.from_quantity, 0);
  assert.equal(unitsAtOrAbove(9), 5);
  assert.equal(unitsAtOrAbove(4), 8);
  assert.equal(report.clearing_price, 4);
});

test("the supply-and-demand chart draws demand, supply at the cap, and the price", () => {
  const report = studentAuctionReport(5, unitBids(exampleBids), "C");
  const svg = auctionReportChartSvg(report);
  assert.match(svg, /class="report-demand"/);
  assert.match(svg, /Supply: 5 permits/);
  assert.match(svg, /Price \$7\.00/);
  assert.equal((svg.match(/class="report-own-bid"/g) ?? []).length, 3);
  assert.match(auctionReportHtml(report, "Round 1"), /Demand meets supply at the 5th permit/);
});

test("when fewer permits are bid for than are for sale, every bid wins and the rest go unsold", () => {
  const report = studentAuctionReport(10, unitBids({ A: [6, 3], B: [5] }), "A");
  assert.equal(report.clearing_price, 3);
  assert.equal(report.permits_won, 2);
  assert.match(auctionReportHtml(report, "Round 1"), /every bid won and\s+7 permits went unsold/);
});

test("cleared auctions list the newest round first and open only that one", () => {
  const bids = unitBids(exampleBids);
  const reports = { auction1: studentAuctionReport(5, bids, "A"), auction2: studentAuctionReport(4, bids, "A") };
  const html = clearedAuctionsHtml(reports);
  assert.ok(html.indexOf("Round 2 auction") < html.indexOf("Round 1 auction"));
  assert.equal((html.match(/<details class="auction-report" open>/g) ?? []).length, 1);
  assert.equal((clearedAuctionsHtml(reports, { openNewest: false }).match(/ open>/g) ?? []).length, 0);
  assert.equal(clearedAuctionsHtml({ auction1: null, auction2: null }), "");
  assert.notEqual(html.indexOf('id="report-round-1-title"'), -1);
  assert.notEqual(html.indexOf('id="report-round-2-title"'), -1);
});
