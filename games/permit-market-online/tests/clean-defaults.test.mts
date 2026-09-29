import test from "node:test";
import assert from "node:assert/strict";
import { FIRM_TYPES, firmTypeForIndex, resolveRoundCap, benchmarkForRound,
  abatementCost, permitValue, freeAllocation, clearAuction, truthfulUnitBids }
  from "../../../netlify/functions/_lib/permit_market.mts";
import { currentCostEffectivePrice } from "../../../netlify/functions/_lib/permit_benchmark.mts";

const defaults = { cap_share_round1: 60, cap_share_round2: 40 };
const makeTeams = count => Array.from({ length: count }, (_, index) => ({
  id: String(index), team_name: "Firm " + index, ...firmTypeForIndex(index),
}));

test("default firms have even intercepts and slopes and whole-dollar costs", () => {
  for (const firm of FIRM_TYPES) {
    const { baseline_emissions: baseline, mac_slope: slope } = firm;
    assert.equal(baseline % 2, 0);
    assert.equal(slope % 2, 0);
    assert.equal((slope * baseline) % 2, 0);
    for (let emissions = 0; emissions <= baseline; emissions++) {
      assert.ok(Number.isInteger(abatementCost(slope, baseline - emissions)));
      assert.ok(Number.isInteger(permitValue(baseline, slope, emissions)));
    }
  }
});

test("both default rounds equalize MACs with integer allocations for 2 to 100 teams", () => {
  for (let count = 2; count <= 100; count++) {
    const teams = makeTeams(count);
    let previousCap = Infinity;
    for (const round of ["round1", "round2"]) {
      const cap = resolveRoundCap(teams, defaults, round);
      assert.ok(Number.isInteger(cap) && cap > 0 && cap < previousCap);
      previousCap = cap;
      const initial = freeAllocation(teams, cap);
      const endowments = new Map(initial.map(row => [row.team_id, row.permits_won]));
      const benchmark = benchmarkForRound(teams, cap, { endowments });
      const permitsById = new Map(benchmark.per_team.map(row => [row.team_id, row.benchmark_permits]));
      assert.equal(permitsById.size, count);
      assert.equal([...permitsById.values()].reduce((a, b) => a + b, 0), cap);
      assert.equal(benchmark.price_basis, "common_mac");
      assert.ok(Number.isInteger(benchmark.benchmark_price));
      let initialCost = 0;
      let finalCost = 0;
      for (const team of teams) {
        const permits = permitsById.get(team.id);
        const abatement = team.baseline_emissions - permits;
        assert.ok(Number.isInteger(permits) && permits > 0 && abatement > 0);
        assert.equal(team.mac_intercept + team.mac_slope * abatement, benchmark.benchmark_price);
        const cost = abatementCost(team.mac_slope, abatement, team.mac_intercept);
        initialCost += abatementCost(team.mac_slope, team.baseline_emissions - endowments.get(team.id), team.mac_intercept);
        finalCost += cost;
        const row = benchmark.per_team.find(row => row.team_id === team.id);
        assert.equal(row.benchmark_score,
          abatementCost(team.mac_slope, team.baseline_emissions, team.mac_intercept) - cost
          - benchmark.benchmark_price * (permits - endowments.get(team.id)));
        assert.ok(Number.isInteger(row.benchmark_score));
        // No buyer's one-permit savings exceed another firm's selling cost.
        for (const other of teams) {
          if (team.id === other.id) continue;
          const buyerSavings = permitValue(team.baseline_emissions, team.mac_slope, permits + 1, team.mac_intercept);
          const sellerCost = permitValue(other.baseline_emissions, other.mac_slope, permitsById.get(other.id), other.mac_intercept);
          assert.ok(buyerSavings < sellerCost);
        }
      }
      assert.ok(initialCost > finalCost, "Free allocation must leave gains from trading: " + count + "/" + round);
      const reordered = benchmarkForRound([...teams].reverse(), cap, { endowments });
      assert.deepEqual([...reordered.per_team].sort((a, b) => a.team_id.localeCompare(b.team_id)),
        [...benchmark.per_team].sort((a, b) => a.team_id.localeCompare(b.team_id)));
      const admin = currentCostEffectivePrice({ ...defaults, current_phase: round === "round1" ? "market1" : "market2",
        [round === "round1" ? "cap_round1" : "cap_round2"]: cap }, teams);
      assert.equal(admin.price, benchmark.benchmark_price);
      assert.equal(admin.price_basis, "common_mac");
      assert.deepEqual(admin.allocations.map(row => row.team_id), teams.map(team => team.id));
      // Auction payments retain the lowest-winning-bid rule.
      const auction = clearAuction(cap, truthfulUnitBids(teams));
      assert.ok(auction.clearing_price > benchmark.benchmark_price);
    }
  }
});

test("two firms have a clean worked solution in each default round", () => {
  const teams = makeTeams(2);
  for (const [round, cap, price, permits] of [
    ["round1", 12, 12, [6, 6]], ["round2", 6, 20, [2, 4]],
  ]) {
    assert.equal(resolveRoundCap(teams, defaults, round), cap);
    const benchmark = benchmarkForRound(teams, cap);
    assert.equal(benchmark.benchmark_price, price);
    assert.deepEqual(benchmark.per_team.map(row => row.benchmark_permits), permits);
  }
});

test("custom percentages, earlier firms and optional game modes retain percentage caps", () => {
  const teams = makeTeams(2);
  for (let share = 1; share <= 100; share++) {
    if (share === 60) continue;
    assert.equal(resolveRoundCap(teams, { ...defaults, cap_share_round1: share }, "round1"),
      Math.max(1, Math.round(18 * share / 100)));
  }
  for (const option of ["banking_enabled", "borrowing_enabled"]) {
    assert.equal(resolveRoundCap(teams, { ...defaults, [option]: true }, "round1"), 11);
    assert.equal(resolveRoundCap(teams, { ...defaults, [option]: true }, "round2"), 7);
  }
  const earlier = [{ id: "a", baseline_emissions: 10, mac_slope: 1 }, { id: "b", baseline_emissions: 8, mac_slope: 3 }];
  assert.equal(resolveRoundCap(earlier, defaults, "round1"), 11);
  assert.equal(resolveRoundCap([], defaults, "round1"), 1);
  assert.equal(benchmarkForRound(earlier, 11).price_basis, "whole_permit");
});
