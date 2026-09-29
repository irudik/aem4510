import test from "node:test";
import assert from "node:assert/strict";
import { roundCostEffectiveness } from "../../../netlify/functions/_lib/permit_cost_effectiveness.mts";
import { costGapHtml } from "../../../static/games/permit-market-online/cost-gap.mjs";
const firms = [{ id: "comp", baseline_emissions: 10, mac_slope: 1 },
  { id: "phone", baseline_emissions: 8, mac_slope: 3 }];
const scoresFor = (permits = [4, 7], allocated = [6, 5], shock = 1) => firms.map((firm, i) => ({
  team_id: firm.id, round_key: "round1", permits_from_auction: allocated[i],
  permits_end: permits[i], abatement: firm.baseline_emissions - permits[i],
  benchmark_permits: [5, 6][i], mac_shock: shock,
}));

test("the two-firm example closes two thirds of the initial cost gap", () => {
  const report = roundCostEffectiveness(firms, scoresFor())[0];
  assert.equal(report.cost_gap.initial_total_cost, 21.5);
  assert.equal(report.cost_gap.final_total_cost, 19.5);
  assert.equal(report.cost_gap.cost_effective_total_cost, 18.5);
  assert.ok(Math.abs(report.cost_gap.gap_closed_percent - 200 / 3) < 1e-9);
  assert.equal(report.achieved, false);
  assert.match(costGapHtml(report), /closed 66.7%/);
  assert.match(costGapHtml(report), /initial \$21.50 → final \$19.50/);
  assert.match(costGapHtml(report), /Cost-effective: \$18.50/);
  assert.equal(report.cost_gap.same_emissions, true);
});

test("no improvement is zero percent, the optimum is 100 percent, worsening stays negative", () => {
  assert.equal(roundCostEffectiveness(firms, scoresFor([6, 5]))[0].cost_gap.gap_closed_percent, 0);
  const optimum = roundCostEffectiveness(firms, scoresFor([5, 6]))[0];
  assert.equal(optimum.cost_gap.gap_closed_percent, 100);
  assert.equal(optimum.achieved, true);
  const worse = roundCostEffectiveness(firms, scoresFor([7, 4]))[0];
  assert.ok(worse.cost_gap.gap_closed_percent < 0);
  assert.match(costGapHtml(worse), /widened/);
});

test("an initially efficient allocation reports no percentage, whether maintained or worsened", () => {
  for (const permits of [[5, 6], [4, 7]]) {
    const report = roundCostEffectiveness(firms, scoresFor(permits, [5, 6]))[0];
    assert.equal(report.cost_gap.gap_closed_percent, null);
    assert.equal(report.cost_gap.status, "initially_cost_effective");
    assert.match(costGapHtml(report), /already cost-effective/);
    assert.doesNotMatch(costGapHtml(report), /NaN|Infinity/);
  }
});

test("same realized shocks apply to all costs and team joins do not depend on row order", () => {
  const report = roundCostEffectiveness([...firms].reverse(), scoresFor([4, 7], [6, 5], 1.5))[0];
  assert.equal(report.cost_gap.initial_total_cost, 32.25);
  assert.equal(report.cost_gap.final_total_cost, 29.25);
  assert.equal(report.cost_gap.cost_effective_total_cost, 27.75);
  assert.ok(Math.abs(report.cost_gap.gap_closed_percent - 200 / 3) < 1e-9);
  const distinct = scoresFor([4, 7], [6, 5]);
  distinct[0].mac_shock = 0.5;
  distinct[1].mac_shock = 1.5;
  distinct[0].benchmark_permits = 4;
  distinct[1].benchmark_permits = 7;
  const shocked = roundCostEffectiveness(firms, distinct)[0].cost_gap;
  assert.equal(shocked.initial_total_cost, 24.25);
  assert.equal(shocked.final_total_cost, 11.25);
  assert.equal(shocked.cost_effective_total_cost, 11.25);
});

test("missing observations do not produce invented costs and banking is explicitly qualified", () => {
  assert.deepEqual(roundCostEffectiveness(firms, scoresFor().slice(0, 1)), []);
  const missing = scoresFor();
  delete missing[0].permits_from_auction;
  assert.equal(roundCostEffectiveness(firms, missing)[0].cost_gap, undefined);
  for (const session of [{ banking_enabled: true }, { borrowing_enabled: true }]) {
    const report = roundCostEffectiveness(firms, scoresFor(), session)[0];
    assert.equal(report.cost_gap.status, "across_rounds");
    assert.match(costGapHtml(report), /not reported with banking or borrowing/);
  }
});

test("equally cheap tied allocations count as cost-effective", () => {
  const teams = [{ id: "a", baseline_emissions: 2, mac_slope: 1 },
    { id: "b", baseline_emissions: 2, mac_slope: 1 }];
  const scores = [
    { team_id: "a", round_key: "round1", permits_from_auction: 1, permits_end: 0, abatement: 2, benchmark_permits: 1 },
    { team_id: "b", round_key: "round1", permits_from_auction: 0, permits_end: 1, abatement: 1, benchmark_permits: 0 },
  ];
  const report = roundCostEffectiveness(teams, scores)[0];
  assert.equal(report.achieved, true);
  assert.equal(report.cost_gap.initial_total_cost, report.cost_gap.final_total_cost);
});
