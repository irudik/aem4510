import test from "node:test";
import assert from "node:assert/strict";

import {
  FIRM_TYPES,
  abatementCost,
  benchmarkForRound,
  clearAuction,
  firmTypeForIndex,
  grossValue,
  permitValue,
  roundForPhase,
  truthfulUnitBids,
  validateBidSet,
  valueSchedule,
} from "../../../netlify/functions/_lib/permit_market.mts";

test("firm types cycle with team index", () => {
  assert.deepEqual(firmTypeForIndex(0), FIRM_TYPES[0]);
  assert.deepEqual(firmTypeForIndex(FIRM_TYPES.length), FIRM_TYPES[0]);
  assert.deepEqual(firmTypeForIndex(FIRM_TYPES.length + 2), FIRM_TYPES[2]);
});

test("abatement costs and permit values follow the integer MAC schedule", () => {
  // MAC slope 2: abating 3 units costs 2 + 4 + 6 = 12.
  assert.equal(abatementCost(2, 3), 12);
  assert.equal(abatementCost(2, 0), 0);

  // e0 = 4, c = 2: permit values are 8, 6, 4, 2.
  assert.equal(permitValue(4, 2, 1), 8);
  assert.equal(permitValue(4, 2, 4), 2);
  assert.equal(permitValue(4, 2, 5), 0);

  const schedule = valueSchedule(4, 2);
  assert.equal(schedule.length, 4);
  assert.deepEqual(schedule.map((step) => step.value), [8, 6, 4, 2]);

  // Gross value equals the cost of abating everything.
  assert.equal(grossValue(4, 2), 20);
  assert.equal(grossValue(10, 1), 55);
});

test("phase-to-round mapping", () => {
  assert.equal(roundForPhase("auction1"), "round1");
  assert.equal(roundForPhase("market1"), "round1");
  assert.equal(roundForPhase("auction2"), "round2");
  assert.equal(roundForPhase("market2"), "round2");
  assert.equal(roundForPhase("setup"), null);
});

test("bid sets are validated against the baseline", () => {
  const team = { baseline_emissions: 8 };

  const bids = validateBidSet(team, [
    { bid_price: 5.129, bid_quantity: 3 },
    { bid_price: 3, bid_quantity: 5 },
  ]);
  assert.equal(bids.length, 2);
  assert.equal(bids[0].bid_price, 5.13);
  assert.equal(bids[0].bid_index, 1);

  assert.throws(() => validateBidSet(team, []), /at least one bid/);
  assert.throws(() => validateBidSet(team, [
    { bid_price: 5, bid_quantity: 6 },
    { bid_price: 4, bid_quantity: 3 },
  ]), /cannot exceed your baseline/);
  assert.throws(() => validateBidSet(team, [
    { bid_price: -1, bid_quantity: 1 },
  ]), /nonnegative/);
  assert.throws(() => validateBidSet(team, [
    { bid_price: 1, bid_quantity: 1.5 },
  ]), /positive integer/);
});

test("uniform-price clearing fills from the top and prices at the lowest accepted bid", () => {
  const result = clearAuction(5, [
    { team_id: "A", bid_price: 10, bid_quantity: 3, submitted_at: "t1" },
    { team_id: "B", bid_price: 8, bid_quantity: 3, submitted_at: "t2" },
  ]);

  assert.equal(result.clearing_price, 8);
  assert.equal(result.total_bid_quantity, 6);

  const byTeam = new Map(result.allocations.map((row) => [row.team_id, row]));
  assert.equal(byTeam.get("A").permits_won, 3);
  assert.equal(byTeam.get("A").payment, 24);
  assert.equal(byTeam.get("B").permits_won, 2);
  assert.equal(byTeam.get("B").payment, 16);
});

test("clearing handles undersubscription, ties, and empty books", () => {
  const undersubscribed = clearAuction(10, [
    { team_id: "A", bid_price: 7, bid_quantity: 2, submitted_at: "t1" },
    { team_id: "B", bid_price: 4, bid_quantity: 2, submitted_at: "t2" },
  ]);
  assert.equal(undersubscribed.clearing_price, 4);
  assert.equal(
    undersubscribed.allocations.reduce((sum, row) => sum + row.permits_won, 0),
    4,
  );

  // Tie at the margin: the earlier submission wins the last unit.
  const tied = clearAuction(3, [
    { team_id: "late", bid_price: 5, bid_quantity: 2, submitted_at: "2026-01-01T10:05:00Z" },
    { team_id: "early", bid_price: 5, bid_quantity: 2, submitted_at: "2026-01-01T10:00:00Z" },
  ]);
  const tiedByTeam = new Map(tied.allocations.map((row) => [row.team_id, row.permits_won]));
  assert.equal(tiedByTeam.get("early"), 2);
  assert.equal(tiedByTeam.get("late"), 1);

  const empty = clearAuction(5, []);
  assert.equal(empty.clearing_price, null);
  assert.deepEqual(empty.allocations, []);
});

test("benchmark clears truthful bids and scores the efficient allocation", () => {
  const teams = [
    { id: "A", baseline_emissions: 4, mac_slope: 1 },
    { id: "B", baseline_emissions: 4, mac_slope: 2 },
  ];

  assert.equal(truthfulUnitBids(teams).length, 8);

  const benchmark = benchmarkForRound(teams, 4);
  assert.equal(benchmark.benchmark_price, 4);

  const byTeam = new Map(benchmark.per_team.map((row) => [row.team_id, row]));
  // Top four values are B's 8, 6, 4 and one of the two 4s; A holds the other.
  assert.equal(byTeam.get("A").benchmark_permits + byTeam.get("B").benchmark_permits, 4);
  assert.equal(byTeam.get("B").benchmark_permits, 3);

  // A: V = 10, abates 3 (cost 6), pays 4 for 1 permit: score 0.
  assert.equal(byTeam.get("A").benchmark_score, 0);
  // B: V = 20, abates 1 (cost 2), pays 12 for 3 permits: score 6.
  assert.equal(byTeam.get("B").benchmark_score, 6);
});
