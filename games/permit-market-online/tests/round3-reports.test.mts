import test from "node:test";
import assert from "node:assert/strict";
import { roundCostEffectiveness } from "../../../netlify/functions/_lib/permit_cost_effectiveness.mts";
import { closedMacDistributions } from "../../../netlify/functions/_lib/permit_mac_distribution.mts";
import { currentCostEffectivePrice } from "../../../netlify/functions/_lib/permit_benchmark.mts";

const teams = ["a", "b"].map(id => ({ id, team_name: `Firm ${id}`, baseline_emissions: 4,
  mac_slope: 2, mac_intercept: 4, mac_shift_round2: 100 }));
const session = { current_phase: "market3", cap_round2: 4, shock_round2: true };
const sources = [1, 3].map((initial, index) => ({ team_id: teams[index].id, round_key: "round2",
  permits_from_auction: initial, permits_end: 2, abatement: 2, mac_shock: 1,
  mac_intercept: 4, benchmark_permits: 2, benchmark_price: 8 }));

/** Saved Round 2 rows supply initial holdings, independently of final holdings. */
function thirdScores(holdings, fees = [0, 0]) {
  return holdings.map((permits, index) => ({ ...sources[index], round_key: "round3",
    permits_from_auction: 999, mac_intercept: 999, permits_end: permits,
    abatement: 4 - permits, transaction_cost: fees[index] }));
}

test("Round 3 distinguishes abatement efficiency from efficiency with transaction costs", () => {
  const stay = roundCostEffectiveness(teams, [...sources, ...thirdScores([1, 3])], session)
    .find(row => row.round_key === "round3");
  assert.equal(stay.achieved, false);
  assert.equal(stay.cost_gap.initial_total_cost, 26);
  assert.equal(stay.cost_gap.final_total_cost, 26);
  assert.equal(stay.cost_gap.cost_effective_total_cost, 24);
  assert.equal(stay.cost_gap.gap_closed_percent, 0);
  assert.equal(stay.fee_adjusted_achieved, true);
  assert.equal(stay.fee_adjusted_benchmark.minimum_resource_cost, 26);
  assert.equal(stay.fee_adjusted_benchmark.transaction_cost, 0);
  const trade = roundCostEffectiveness([...teams].reverse(), [...thirdScores([2, 2], [3, 0]), ...sources].reverse(), session)
    .find(row => row.round_key === "round3");
  assert.equal(trade.achieved, true);
  assert.equal(trade.cost_gap.gap_closed_percent, 100);
  assert.equal(trade.cost_gap.transaction_cost, 3);
  assert.equal(trade.cost_gap.total_resource_cost, 27);
  assert.equal(trade.fee_adjusted_achieved, false);
});

test("Round 3 reports require all Round 2 and Round 3 scores", () => {
  for (const scores of [[sources[0], ...thirdScores([2, 2])], [...sources, thirdScores([2, 2])[0]]]) {
    assert.ok(roundCostEffectiveness(teams, scores, session).every(row => row.round_key !== "round3"));
    assert.ok(closedMacDistributions(session, teams, [], [], scores).every(row => row.round_key !== "round3"));
  }
});

test("Round 3 histogram overlays saved initial holdings using the same saved post-shock MACs", () => {
  const scores = [...thirdScores([2, 2]), ...sources].reverse();
  const reports = closedMacDistributions(session, teams, [], [], scores);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].phase, "market3");
  assert.equal(reports[0].no_fee, true);
  assert.deepEqual(reports[0].initial_macs.map(row => row.mac), [10, 6]);
  assert.deepEqual(reports[0].macs.map(row => row.mac), [8, 8]);
  assert.equal(reports[0].benchmark_visible, true);
});

test("Round 3 benchmark uses saved Round 2 costs and complete selects the last scored round", () => {
  const current = currentCostEffectivePrice(session, teams, sources);
  assert.equal(current.round_key, "round3");
  assert.equal(current.price, 8);
  assert.equal(current.no_fee, true);
  assert.deepEqual(current.allocations.map(row => row.permits), [2, 2]);
  assert.equal(currentCostEffectivePrice(session, teams, sources.slice(0, 1)), null);
  assert.equal(currentCostEffectivePrice({ ...session, current_phase: "complete" }, teams, sources).round_key, "round2");
  assert.equal(currentCostEffectivePrice({ ...session, current_phase: "complete" }, teams,
    [...sources, ...thirdScores([2, 2])]).round_key, "round3");
});

test("Round 3 initial histogram repeats saved carry while intertemporal cost percentages stay suppressed", () => {
  const carried = sources.map((row, index) => ({ ...row, permits_banked_in: index === 0 ? 1 : 0,
    permits_owed_in: index === 1 ? 1 : 0 }));
  const settings = { ...session, banking_enabled: true, borrowing_enabled: true };
  const scores = [...carried, ...thirdScores([2, 2])];
  const report = closedMacDistributions(settings, teams, [], [], scores)[0];
  assert.deepEqual(report.initial_macs.map(row => row.mac), [8, 8]);
  const costs = roundCostEffectiveness(teams, scores, settings).find(row => row.round_key === "round3");
  assert.equal(costs.cost_gap.status, "across_rounds");
  assert.equal(costs.fee_adjusted_benchmark, undefined);
});
