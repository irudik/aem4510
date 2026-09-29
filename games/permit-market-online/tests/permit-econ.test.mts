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

test("smooth MAC integrates to total cost and whole-permit savings", () => {
  // MAC slope 2: the triangle under MAC through 3 units has area 9.
  assert.equal(abatementCost(2, 3), 9);
  assert.equal(abatementCost(2, 2.5), 6.25);
  assert.equal(abatementCost(2, 0), 0);

  // Each whole permit saves the area under MAC across one unit.
  assert.equal(permitValue(4, 2, 1), 7);
  assert.equal(permitValue(4, 2, 4), 1);
  assert.equal(permitValue(4, 2, 5), 0);

  const schedule = valueSchedule(4, 2);
  assert.equal(schedule.length, 4);
  assert.deepEqual(schedule.map((step) => step.value), [7, 5, 3, 1]);

  // Gross value equals the cost of abating everything.
  assert.equal(grossValue(4, 2), 16);
  assert.equal(grossValue(10, 1), 50);
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

test("every firm can bid its entire MAC schedule one permit at a time", () => {
  for (const firm of FIRM_TYPES) {
    const bids = valueSchedule(firm.baseline_emissions, firm.mac_slope)
      .map((step) => ({ bid_price: step.value, bid_quantity: 1 }));
    const accepted = validateBidSet(firm, bids);
    assert.equal(accepted.length, firm.baseline_emissions);
    assert.deepEqual(accepted.map((bid) => bid.bid_index), bids.map((_, index) => index + 1));
    assert.equal(accepted.reduce((sum, bid) => sum + bid.bid_quantity, 0), firm.baseline_emissions);
    assert.throws(() => validateBidSet(firm, [...bids, { bid_price: 0, bid_quantity: 1 }]), /cannot exceed your baseline/);
    const cleared = clearAuction(firm.baseline_emissions, accepted.map((bid) => ({ ...bid, team_id: "A" })));
    assert.equal(cleared.allocations[0].permits_won, firm.baseline_emissions);
    assert.equal(cleared.clearing_price, firm.mac_slope / 2);
  }
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
  assert.equal(benchmark.benchmark_price, 3);

  const byTeam = new Map(benchmark.per_team.map((row) => [row.team_id, row]));
  // Top four whole-permit savings are B's 7, 5, 3 and A's 3.5.
  assert.equal(byTeam.get("A").benchmark_permits + byTeam.get("B").benchmark_permits, 4);
  assert.equal(byTeam.get("B").benchmark_permits, 3);

  // A: V = 8, abates 3 (cost 4.5), pays 3 for 1 permit: score 0.5.
  assert.equal(byTeam.get("A").benchmark_score, 0.5);
  // B: V = 16, abates 1 (cost 1), pays 9 for 3 permits: score 6.
  assert.equal(byTeam.get("B").benchmark_score, 6);
});

test("whole-permit values equal finite cost savings for every firm and shock", () => {
  for (const firm of FIRM_TYPES) {
    for (const shock of [0.5, 1, 1.5]) {
      const slope = firm.mac_slope * shock;
      const baseline = firm.baseline_emissions;
      let totalSavings = 0;
      for (let permits = 1; permits <= baseline; permits += 1) {
        const abatement = baseline - permits;
        const savings = abatementCost(slope, abatement + 1) - abatementCost(slope, abatement);
        assert.equal(permitValue(baseline, slope, permits), savings);
        totalSavings += savings;
      }
      assert.equal(totalSavings, grossValue(baseline, slope));
    }
  }
});

test("benchmark minimizes smooth abatement costs over all small whole-permit allocations", () => {
  const teams = [
    { id: "A", baseline_emissions: 3, mac_slope: 1 },
    { id: "B", baseline_emissions: 4, mac_slope: 2 },
    { id: "C", baseline_emissions: 2, mac_slope: 3 },
  ];
  for (const shockA of [0.5, 1, 1.5]) {
    for (const shockB of [0.5, 1, 1.5]) {
      const slopes = { A: shockA, B: 2 * shockB, C: 3 };
      const cost = (permits) => teams.reduce((total, firm) => total
        + slopes[firm.id] * (firm.baseline_emissions - permits[firm.id]) ** 2 / 2, 0);
      for (let cap = 0; cap <= 9; cap += 1) {
        let minimumCost = Infinity;
        for (let A = 0; A <= 3; A += 1) {
          for (let B = 0; B <= 4; B += 1) {
            for (let C = 0; C <= 2; C += 1) {
              if (A + B + C === cap) minimumCost = Math.min(minimumCost, cost({ A, B, C }));
            }
          }
        }
        const benchmark = benchmarkForRound(teams, cap, { slopeFor: (firm) => slopes[firm.id] });
        const permits = Object.fromEntries(benchmark.per_team.map((row) => [row.team_id, row.benchmark_permits]));
        assert.equal(Object.keys(permits).length, teams.length);
        assert.equal(Object.values(permits).reduce((sum, value) => sum + value, 0), cap);
        assert.equal(cost(permits), minimumCost, `cap=${cap}, slopes=${JSON.stringify(slopes)}`);
      }
    }
  }
});
