import test from "node:test";
import assert from "node:assert/strict";
import { FIRM_TYPES, abatementCost, scoreTeamRound } from "../../../netlify/functions/_lib/permit_market.mts";
import { macModel, macPanel } from "../../../static/games/permit-market-online/mac-view.mjs";

/** A team and its observed position, without contacting the class database. */
function stateFor(team, holdings = null) {
  return {
    team: { id: "A", ...team },
    session: { current_phase: holdings === null ? "auction1" : "market1", banking_enabled: false },
    market: holdings === null ? null : { holdings, recent_trades: [] },
    own_scores: [],
  };
}

test("the area under MAC to the right of emissions matches every firm's scored cost", () => {
  for (const team of FIRM_TYPES) {
    for (let holdings = 0; holdings <= team.baseline_emissions + 2; holdings += 1) {
      const state = stateFor(team, holdings);
      const model = macModel(state);
      const score = scoreTeamRound(state.team, { permits_from_auction: holdings });
      assert.equal(model.emissions, score.emissions);
      assert.equal(model.emissions + model.abatement, team.baseline_emissions);
      assert.equal(model.cost, score.abatement_cost);
      const area = model.steps.filter((step) => step.from >= model.emissions)
        .reduce((total, step) => total + step.cost * (step.to - step.from), 0);
      assert.equal(area, score.abatement_cost);
      for (const step of model.steps) {
        const abatement = team.baseline_emissions - step.from;
        assert.equal(step.cost, abatementCost(team.mac_slope, abatement)
          - abatementCost(team.mac_slope, abatement - 1));
      }
    }
  }
});

test("an interior price between whole-unit abatement costs eliminates gains from one-unit trades", () => {
  const team = { baseline_emissions: 8, mac_slope: 3 };
  const model = macModel(stateFor(team, 5));
  const buySavings = model.cost - macModel(stateFor(team, 6)).cost;
  const sellCost = macModel(stateFor(team, 4)).cost - model.cost;
  assert.equal(buySavings, 7.5);
  assert.equal(sellCost, 10.5);
  assert.ok(buySavings - 10 <= 0);
  assert.ok(10 - sellCost <= 0);
});

test("setup and auctions show no invented holdings or market price", () => {
  const setup = stateFor({ baseline_emissions: null, mac_slope: null });
  assert.equal(macModel(setup), null);
  assert.match(macPanel(setup), /instructor starts/);
  const auction = stateFor(FIRM_TYPES[0]);
  assert.equal(macModel(auction).emissions, null);
  assert.equal(macModel(auction).price, null);
  assert.match(macPanel(auction), /after permits are allocated/);
});

test("latest trades never add or change a price line on the MAC chart", () => {
  const state = stateFor(FIRM_TYPES[0], 5);
  for (const price of [0, 5, 100]) {
    state.market.recent_trades = [{ price }];
    assert.equal(macModel(state).price, null);
    assert.doesNotMatch(macPanel(state), /Latest trade price|class="mac-price-line"/);
    assert.match(macPanel(state), /class="mac-current-line"/);
  }
  state.auction_result = { clearing_price: 7 };
  assert.equal(macModel(state).price, 7);
  assert.equal(macModel(state).priceLabel, "Auction clearing price");
  state.market.recent_trades = [{ price: 0 }];
  assert.equal(macModel(state).price, 7);
  assert.equal(macModel(state).priceLabel, "Auction clearing price");
  assert.doesNotMatch(macPanel(state), /Latest trade price/);
});

test("banked permits do not extend emissions past baseline or imply negative costs", () => {
  const state = stateFor(FIRM_TYPES[0], 13);
  state.session.banking_enabled = true;
  assert.equal(macModel(state).emissions, 10);
  assert.equal(macModel(state).abatement, 0);
  assert.equal(macModel(state).cost, 0);
  assert.match(macPanel(state), /does not include the future use/);
});

test("the final graph uses the Round 2 outcome and does not substitute a benchmark for an observed price", () => {
  const state = stateFor(FIRM_TYPES[0]);
  state.session.current_phase = "complete";
  state.own_scores = [{ round_key: "round1", permits_end: 7 },
    { round_key: "round2", permits_end: 3, benchmark_price: 12 }];
  assert.equal(macModel(state).emissions, 3);
  assert.equal(macModel(state).price, null);
  assert.match(macPanel(state), /Final Round 2 emissions/);
});

test("smooth chart and five bullets show point MAC and whole-unit cost changes", () => {
  const state = stateFor(FIRM_TYPES[0], 6);
  const model = macModel(state);
  assert.equal(model.currentMac, 4);
  assert.equal(model.cost, 8);
  assert.equal(model.nextAbatementCost, 4.5);
  assert.equal(model.moreEmissionsSavings, 3.5);
  const html = macPanel(state);
  assert.match(html, /class="mac-curve" d="M 58 78 L 588 278"/);
  assert.match(html, /class="mac-current-line"[^>]*y1="198" y2="198"/);
  assert.match(html, /class="mac-cost-area"[^>]*d="M 376 278 L 376 198 L 588 278 Z"/);
  assert.equal((html.match(/<li>/g) ?? []).length, 5);
  assert.match(html, /Total abatement cost: <strong>\$8\.00<\/strong>/);
  assert.match(html, /Total abatement cost is the cost of all required abatement/);
  assert.match(html, /next unit of abatement: <strong>\$4\.50<\/strong>/);
  assert.match(html, /emitting one more unit: <strong>\$3\.50<\/strong>/);
  assert.doesNotMatch(html, /<p class="mac-position">|Each step/);
});

test("whole-unit cost bullets respect emissions limits, cost shocks and emissions choices", () => {
  for (const firm of FIRM_TYPES) {
    for (const shock of [0.5, 1, 1.5]) {
      const slope = firm.mac_slope * shock;
      for (let emissions = 0; emissions <= firm.baseline_emissions; emissions++) {
        const state = stateFor({ ...firm, display_mac_slope: slope }, 5);
        state.market.score_preview = { emissions };
        const model = macModel(state);
        const abatement = firm.baseline_emissions - emissions;
        assert.equal(model.currentMac, slope * abatement);
        assert.equal(model.cost, slope * abatement ** 2 / 2);
        assert.equal(model.nextAbatementCost, emissions === 0 ? null
          : abatementCost(slope, abatement + 1) - model.cost);
        assert.equal(model.moreEmissionsSavings, abatement === 0 ? null
          : model.cost - abatementCost(slope, abatement - 1));
        assert.doesNotMatch(macPanel(state), /NaN|Infinity/);
      }
    }
  }
  assert.match(macPanel(stateFor(FIRM_TYPES[0], 0)), /Not available \(zero emissions\)/);
  assert.match(macPanel(stateFor(FIRM_TYPES[0], 12)), /Not available \(at baseline emissions\)/);
});
