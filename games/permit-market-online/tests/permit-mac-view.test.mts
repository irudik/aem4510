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

test("an interior price between adjacent MAC steps eliminates gains from one-unit trades", () => {
  const team = { baseline_emissions: 8, mac_slope: 3 };
  const model = macModel(stateFor(team, 5));
  const buySavings = model.cost - macModel(stateFor(team, 6)).cost;
  const sellCost = macModel(stateFor(team, 4)).cost - model.cost;
  assert.equal(buySavings, 9);
  assert.equal(sellCost, 12);
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
  assert.match(macPanel(auction), /after the auction clears/);
});

test("the latest trade replaces the labelled auction price, including a zero price", () => {
  const state = stateFor(FIRM_TYPES[0], 5);
  state.auction_result = { clearing_price: 7 };
  assert.equal(macModel(state).price, 7);
  assert.equal(macModel(state).priceLabel, "Auction clearing price");
  state.market.recent_trades = [{ price: 0 }];
  assert.equal(macModel(state).price, 0);
  assert.equal(macModel(state).priceLabel, "Latest trade price");
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
