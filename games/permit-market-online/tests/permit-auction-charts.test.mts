import test from "node:test";
import assert from "node:assert/strict";
import { FIRM_TYPES, benchmarkForRound, clearAuction, truthfulUnitBids }
  from "../../../netlify/functions/_lib/permit_market.mts";
import { auctionComparisonHtml, auctionComparisonModel, firmMacCurves, groupFirmCurves }
  from "../../../static/games/permit-market-online/auction-charts.mjs";

const teams = [...FIRM_TYPES, FIRM_TYPES[0]].map((firm, index) => ({
  ...firm, id: `team-${index}`, team_name: `Firm ${index + 1}`,
}));

/** Build chart inputs using the same auction functions as the admin API. */
function exampleState(bids = truthfulUnitBids(teams)) {
  const cap = 30;
  const clearing = clearAuction(cap, bids);
  const benchmark = benchmarkForRound(teams, cap);
  return { teams, session: { banking_enabled: false }, auction_charts: {
    auction1: { ...clearing, ...benchmark, is_live: true },
  } };
}

test("aggregate MAC horizontally sums every firm's individual MAC at each price", () => {
  const model = auctionComparisonModel(exampleState(), "auction1");
  assert.equal(model.curves.length, teams.length);
  const totalBaseline = teams.reduce((sum, team) => sum + team.baseline_emissions, 0);
  assert.equal(model.aggregate.at(-1).to, totalBaseline);
  for (let price = 0; price <= 30; price += 0.5) {
    const individualQuantity = model.curves.reduce((total, firm) => total
      + firm.steps.filter((step) => step.cost > price).reduce((sum, step) => sum + step.to - step.from, 0), 0);
    const aggregateQuantity = model.aggregate.filter((step) => step.cost > price)
      .reduce((sum, step) => sum + step.to - step.from, 0);
    assert.equal(aggregateQuantity, individualQuantity);
  }
  assert.equal(model.firmMax, 12);
  assert.equal(model.aggregateMax, totalBaseline);
});

test("each individual MAC starts at zero and ends at its own baseline", () => {
  const curves = firmMacCurves(teams);
  for (const curve of curves) {
    const team = teams.find((row) => row.id === curve.id);
    assert.equal(curve.name, team.team_name);
    assert.equal(curve.steps[0].from, 0);
    assert.equal(curve.steps.at(-1).to, team.baseline_emissions);
    assert.equal(curve.steps.length, team.baseline_emissions);
    assert.equal(curve.steps[0].cost, team.mac_slope * team.baseline_emissions);
    assert.equal(curve.steps.at(-1).cost, team.mac_slope);
  }
  assert.deepEqual(firmMacCurves([{ id: "waiting", baseline_emissions: null, mac_slope: null }]), []);
});

test("identical firms share a curve without summing or dropping teams", () => {
  const grouped = groupFirmCurves(firmMacCurves(teams));
  assert.equal(grouped.length, FIRM_TYPES.length);
  const repeated = grouped.find((curve) => curve.baseline === 10 && curve.slope === 1);
  assert.deepEqual(repeated.teamIds, ["team-0", "team-6"]);
  assert.deepEqual(repeated.names, ["Firm 1", "Firm 7"]);
  assert.equal(repeated.steps.length, 10);
  assert.deepEqual(grouped.flatMap((curve) => curve.teamIds).sort(), teams.map((team) => team.id).sort());
});

test("both panels share a cost scale, including unusually high submitted bids", () => {
  const model = auctionComparisonModel(exampleState([{ team_id: "team-0", bid_price: 100, bid_quantity: 1 }]), "auction1");
  assert.ok(model.maxCost > 100);
  const html = auctionComparisonHtml(exampleState(), "auction1");
  assert.equal((html.match(/class="auction-mac-chart"/g) ?? []).length, 2);
  assert.match(html, /Total emissions \/ permits/);
  assert.match(html, /Firm emissions, Eᵢ/);
  assert.match(html, /Clearing price if closed now/);
  assert.match(html, /auction-view.html\?round=auction1/);
  assert.doesNotMatch(auctionComparisonHtml(exampleState(), "auction1", { popoutLink: false }), /chart-popout-link/);
});

test("empty, zero-price, closed, and round-2 charts remain distinct", () => {
  assert.equal(auctionComparisonModel({}, "auction1"), null);
  assert.doesNotMatch(auctionComparisonHtml({}, "auction1"), /<svg/);
  const empty = exampleState([]);
  assert.equal(auctionComparisonModel(empty, "auction1").clearingPrice, null);
  assert.match(auctionComparisonHtml(empty, "auction1"), /No bids yet/);
  const zero = exampleState([{ team_id: "team-0", bid_price: 0, bid_quantity: 1 }]);
  assert.equal(auctionComparisonModel(zero, "auction1").clearingPrice, 0);
  assert.match(auctionComparisonHtml(zero, "auction1"), /\$0\.00/);
  const second = { ...zero, session: { banking_enabled: true }, auction_charts: {
    auction2: { ...zero.auction_charts.auction1, is_live: false },
  } };
  const html = auctionComparisonHtml(second, "auction2");
  assert.match(html, /Round 2 auction/);
  assert.match(html, /Auction clearing price/);
  assert.match(html, /excludes the future value of banked permits/);
  assert.doesNotMatch(html, /if closed now|NaN|Infinity/);
});

test("team names remain labels in chart legends", () => {
  const state = exampleState();
  state.teams = [{ ...teams[0], team_name: 'Energy & <Power> "A"' }];
  const html = auctionComparisonHtml(state, "auction1");
  assert.match(html, /Energy &amp; &lt;Power&gt; &quot;A&quot;/);
  assert.doesNotMatch(html, /<Power>/);
});
