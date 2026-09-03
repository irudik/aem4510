import test from "node:test";
import assert from "node:assert/strict";

import {
  benchmarkForRound,
  clearAuction,
  matchIncomingOrder,
  scoreTeamRound,
} from "../../../netlify/functions/_lib/permit_market.mts";

/**
 * Simulate a full round at the engine level: auction, a sequence of orders
 * through the matching logic with a maintained book, then scoring. Checks
 * the accounting identities that must hold for any play.
 */
test("full round simulation conserves permits and cash", () => {
  const teams = [
    { id: "T1", baseline_emissions: 10, mac_slope: 1 },
    { id: "T2", baseline_emissions: 8, mac_slope: 3 },
    { id: "T3", baseline_emissions: 12, mac_slope: 2 },
    { id: "T4", baseline_emissions: 6, mac_slope: 4 },
  ];
  const totalBaseline = teams.reduce((sum, team) => sum + team.baseline_emissions, 0);
  const cap = Math.round(totalBaseline * 0.6);

  // Auction: teams bid roughly around their value schedules.
  const clearing = clearAuction(cap, [
    { team_id: "T1", bid_price: 8, bid_quantity: 4, submitted_at: "t1" },
    { team_id: "T1", bid_price: 4, bid_quantity: 4, submitted_at: "t1" },
    { team_id: "T2", bid_price: 20, bid_quantity: 4, submitted_at: "t2" },
    { team_id: "T2", bid_price: 9, bid_quantity: 3, submitted_at: "t2" },
    { team_id: "T3", bid_price: 18, bid_quantity: 6, submitted_at: "t3" },
    { team_id: "T3", bid_price: 6, bid_quantity: 4, submitted_at: "t3" },
    { team_id: "T4", bid_price: 15, bid_quantity: 4, submitted_at: "t4" },
  ]);

  const permitsSold = clearing.allocations.reduce((sum, row) => sum + row.permits_won, 0);
  assert.equal(permitsSold, Math.min(cap, clearing.total_bid_quantity));
  assert.ok(clearing.clearing_price > 0);

  // Everyone pays the same price per permit.
  for (const allocation of clearing.allocations) {
    assert.equal(
      allocation.payment,
      Math.round(allocation.permits_won * clearing.clearing_price * 100) / 100,
    );
  }

  // Secondary market: a sequence of orders arriving one at a time.
  const book = [];
  const executed = [];
  let orderCounter = 0;

  const submitOrder = (teamId, side, price, quantity, timestamp) => {
    orderCounter += 1;
    const result = matchIncomingOrder(
      { team_id: teamId, side, price, quantity },
      book.filter((order) => order.remaining_quantity > 0),
    );

    for (const update of result.resting_updates) {
      const resting = book.find((order) => order.id === update.id);
      resting.remaining_quantity = update.remaining_quantity;
    }
    for (const trade of result.trades) {
      executed.push(trade);
    }
    if (result.remaining_quantity > 0) {
      book.push({
        id: `o${orderCounter}`,
        team_id: teamId,
        side,
        price,
        remaining_quantity: result.remaining_quantity,
        created_at: timestamp,
      });
    }
  };

  // T2 (expensive abater) wants more permits; T1 (cheap abater) sells.
  submitOrder("T1", "ask", 7, 3, "m1");
  submitOrder("T2", "bid", 8, 2, "m2");
  submitOrder("T4", "bid", 6, 2, "m3");
  submitOrder("T3", "ask", 6, 3, "m4");
  submitOrder("T2", "bid", 7, 2, "m5");

  assert.ok(executed.length >= 2);

  // Score the round for every team.
  const allocationByTeam = new Map(clearing.allocations.map((row) => [row.team_id, row]));
  const scores = teams.map((team) => scoreTeamRound(team, {
    permits_from_auction: allocationByTeam.get(team.id)?.permits_won ?? 0,
    auction_payment: allocationByTeam.get(team.id)?.payment ?? 0,
    permits_banked_in: 0,
    trades: executed,
    banking_enabled: false,
    is_final_round: false,
  }));

  // Permit conservation: end holdings across teams equal permits sold.
  const totalPermitsEnd = scores.reduce((sum, row) => sum + row.permits_end, 0);
  assert.equal(totalPermitsEnd, permitsSold);

  // Emissions never exceed the cap.
  const totalEmissions = scores.reduce((sum, row) => sum + row.emissions, 0);
  assert.ok(totalEmissions <= cap);

  // Market cash flows are zero-sum across teams.
  const totalNetSpend = scores.reduce((sum, row) => sum + row.market_net_spend, 0);
  assert.ok(Math.abs(totalNetSpend) < 1e-9);

  // No team holds negative permits.
  for (const row of scores) {
    assert.ok(row.permits_end >= 0);
  }

  // Benchmark exists and total benchmark permits equal the cap.
  const benchmark = benchmarkForRound(teams, cap);
  const benchmarkPermits = benchmark.per_team.reduce(
    (sum, row) => sum + row.benchmark_permits,
    0,
  );
  assert.equal(benchmarkPermits, cap);
  assert.ok(benchmark.benchmark_price > 0);
});
