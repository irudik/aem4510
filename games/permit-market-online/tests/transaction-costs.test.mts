import test from "node:test";
import assert from "node:assert/strict";
import { matchIncomingOrder, scoreTeamRound, leaderboardRows, roundForPhase,
  auctionPhaseForRound, marketPhaseForRound, effectiveSlope, effectiveIntercept,
  allocationMethodForRound, shockEnabledForRound, PHASE_ORDER, abatementCost }
  from "../../../netlify/functions/_lib/permit_market.mts";
import { roundTransactionCost, transactionCostBenchmark }
  from "../../../netlify/functions/_lib/permit_transaction_costs.mts";

const order = (id, side, price, quantity = 1, team = id) => ({
  id, side, price, remaining_quantity: quantity, team_id: team, created_at: id,
});

test("third round reuses second-round allocation and shocks", () => {
  assert.equal(roundForPhase("market3"), "round3");
  assert.equal(auctionPhaseForRound("round3"), "auction2");
  assert.equal(marketPhaseForRound("round3"), "market3");
  assert.equal(PHASE_ORDER[PHASE_ORDER.indexOf("market2") + 1], "market3");
  const firm = { mac_slope: 2, mac_intercept: 4, mac_shift_round2: 2, mac_shock_round2: 1.5 };
  assert.equal(effectiveSlope(firm, "round3"), 3);
  assert.equal(effectiveIntercept(firm, "round3"), 6);
  assert.equal(allocationMethodForRound({ allocation_round2: "pay_as_bid" }, "round3"), "pay_as_bid");
  assert.equal(shockEnabledForRound({ shock_round2: true }, "round3"), true);
  assert.deepEqual(["round1", "round2", "round3"].map(roundTransactionCost), [0, 0, 3]);
});

test("buyer fee preserves resting-order price with either arrival order", () => {
  const bought = matchIncomingOrder({ team_id: "buyer", side: "bid", price: 10, quantity: 1 },
    [order("seller", "ask", 5)], { transactionCost: 3 }).trades[0];
  assert.equal(bought.price, 5);
  assert.equal(bought.price + bought.transaction_cost_per_permit, 8);
  const sold = matchIncomingOrder({ team_id: "seller", side: "ask", price: 5, quantity: 1 },
    [order("buyer", "bid", 10)], { transactionCost: 3 }).trades[0];
  assert.equal(sold.price, 7);
  assert.equal(sold.price + sold.transaction_cost_per_permit, 10);
  assert.equal(matchIncomingOrder({ team_id: "buyer", side: "bid", price: 8, quantity: 1 },
    [order("seller", "ask", 5)], { transactionCost: 3 }).trades.length, 1);
});

test("fee blocks a two-dollar surplus but permits a four-dollar surplus", () => {
  for (const incomingSide of ["bid", "ask"]) {
    for (const gain of [2, 4]) {
      const incoming = { team_id: "incoming", side: incomingSide, price: incomingSide === "bid" ? 5 + gain : 5, quantity: 1 };
      const resting = order("resting", incomingSide === "bid" ? "ask" : "bid", incomingSide === "bid" ? 5 : 5 + gain);
      assert.equal(matchIncomingOrder(incoming, [resting], { transactionCost: 3 }).trades.length, gain === 4 ? 1 : 0);
    }
  }
});

test("fee matching keeps price-time priority, partial fills, and excludes own orders", () => {
  const match = matchIncomingOrder({ team_id: "buyer", side: "bid", price: 9, quantity: 4 },
    [order("late", "ask", 6, 4), order("early", "ask", 6, 2), order("cheap", "ask", 5),
      order("own", "ask", 1, 10, "buyer")], { transactionCost: 3 });
  assert.deepEqual(match.trades.map(row => [row.resting_order_id, row.quantity]), [["cheap", 1], ["early", 2], ["late", 1]]);
  assert.equal(match.remaining_quantity, 0);
  assert.equal(match.resting_updates[2].remaining_quantity, 3);
  assert.throws(() => matchIncomingOrder({}, [], { transactionCost: -1 }));
});

test("permit payments cancel across firms and buyer fees reduce aggregate scores", () => {
  const trade = { buyer_team_id: "buyer", seller_team_id: "seller", price: 5, quantity: 2, transaction_cost_per_permit: 3 };
  const teams = ["buyer", "seller"].map(id => ({ id, baseline_emissions: 10, mac_slope: 2, mac_intercept: 4 }));
  const scores = teams.map(team => scoreTeamRound(team, { permits_from_auction: 5, trades: [trade], is_final_round: true }));
  assert.equal(scores[0].market_net_spend, 10);
  assert.equal(scores[1].market_net_spend, -10);
  assert.equal(scores[0].transaction_cost, 6);
  assert.equal(scores[1].transaction_cost, 0);
  assert.equal(scores.reduce((sum, row) => sum + row.permits_end, 0), 10);
  for (let index = 0; index < teams.length; index++) {
    const freeTrade = scoreTeamRound(teams[index], { permits_from_auction: 5,
      trades: [{ ...trade, transaction_cost_per_permit: 0 }], is_final_round: true });
    assert.equal(freeTrade.score - scores[index].score, index === 0 ? 6 : 0);
  }
  const rows = leaderboardRows(teams, scores.map(score => ({ ...score, round_key: "round3", benchmark_score: 0 })));
  assert.ok(rows.every(row => row.round3 !== null && row.rounds_scored === 1));
});

test("resource-cost allocation keeps small gains unexploited and uses larger gains", () => {
  for (const gain of [2, 4]) {
    const firms = [{ id: "seller", baseline_emissions: 2, mac_slope: 2, mac_intercept: 4 },
      { id: "buyer", baseline_emissions: 2, mac_slope: 2, mac_intercept: 6 + gain }];
    const initial = new Map([["seller", 1], ["buyer", 1]]);
    // Seller abates one more unit at cost 7; buyer saves 7 + gain.
    const result = transactionCostBenchmark(firms, initial);
    assert.equal(result.transaction_cost, gain === 4 ? 3 : 0);
    assert.deepEqual(result.allocations.map(row => row.permits), gain === 4 ? [0, 2] : [1, 1]);
    const noFee = transactionCostBenchmark(firms, initial, { transactionCost: 0 });
    assert.ok(noFee.minimum_resource_cost <= result.minimum_resource_cost);
  }
});

test("integer resource-cost minimum matches exhaustive allocations and respects team IDs", () => {
  for (const fee of [0, 3, 7]) {
    const teams = [{ id: "a", baseline_emissions: 3, mac_slope: 2, mac_intercept: 0 },
      { id: "b", baseline_emissions: 4, mac_slope: 4, mac_intercept: 2 },
      { id: "c", baseline_emissions: 2, mac_slope: 2, mac_intercept: 4 }];
    const initial = new Map([["c", 1], ["b", 1], ["a", 2]]);
    const result = transactionCostBenchmark(teams, initial, { transactionCost: fee });
    let best = Infinity;
    for (let a = 0; a <= 3; a++) for (let b = 0; b <= 4; b++) for (let c = 0; c <= 2; c++) {
      if (a + b + c !== 4) continue;
      const total = [a, b, c].reduce((sum, emissions, index) => sum
        + abatementCost(teams[index].mac_slope, teams[index].baseline_emissions - emissions, teams[index].mac_intercept)
        + fee * Math.max(0, emissions - initial.get(teams[index].id)), 0);
      best = Math.min(best, total);
    }
    assert.equal(result.minimum_resource_cost, best);
    assert.equal(result.allocations.reduce((sum, row) => sum + row.permits, 0), 4);
    assert.equal(transactionCostBenchmark([...teams].reverse(), initial, { transactionCost: fee }).minimum_resource_cost, best);
  }
  assert.equal(transactionCostBenchmark([{ id: "a", baseline_emissions: 2, mac_slope: 2 }], new Map()), null);
});
