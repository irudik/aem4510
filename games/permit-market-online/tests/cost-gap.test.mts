import test from "node:test";
import assert from "node:assert/strict";
import { benchmarkForRound, clearAuction, truthfulUnitBids, scoreTeamRound, leaderboardRows }
  from "../../../netlify/functions/_lib/permit_market.mts";

test("both auction rounds track only post-shock trading gains and preserve individual scores", () => {
  const teams = [
    { id: "a", team_name: "A", baseline_emissions: 10, mac_slope: 2 },
    { id: "b", team_name: "B", baseline_emissions: 8, mac_slope: 4 },
  ];
  const session = { allocation_round1: "uniform", allocation_round2: "pay_as_bid",
    shock_round1: true, shock_round2: true, banking_enabled: false, borrowing_enabled: false };
  const scores = [];
  for (const [round, cap, pricing, shocks, seller, buyer, expectedInitial, expectedFinal, expectedEfficient] of [
    ["round1", 12, "uniform", [0.5, 1.5], "a", "b", 20, 15.5, 15.5],
    ["round2", 6, "pay_as_bid", [1.5, 0.5], "b", "a", 112, 98.5, 86.5],
  ]) {
    const auction = clearAuction(cap, truthfulUnitBids(teams), { pricing });
    const allocation = new Map(auction.allocations.map(row => [row.team_id, row]));
    const shockById = new Map(teams.map((team, i) => [team.id, shocks[i]]));
    const benchmark = benchmarkForRound(teams, cap, { slopeFor: team => team.mac_slope * shockById.get(team.id) });
    const benchmarkById = new Map(benchmark.per_team.map(row => [row.team_id, row]));
    const rows = trades => [...teams].reverse().map(team => ({
      ...scoreTeamRound(team, { permits_from_auction: allocation.get(team.id).permits_won,
        auction_payment: allocation.get(team.id).payment, mac_shock: shockById.get(team.id),
        trades, is_final_round: round === "round2" }),
      ...benchmarkById.get(team.id), round_key: round,
    }));
    // The auction and cost shock alone receive no credit for trading gains.
    const before = roundCostEffectiveness(teams, rows([]), session)[0];
    assert.equal(before.cost_gap.gap_closed_percent, 0);
    const after = rows([{ seller_team_id: seller, buyer_team_id: buyer, quantity: 1, price: 10 }]);
    scores.push(...after);
    const report = roundCostEffectiveness(teams, after, session)[0];
    assert.equal(report.cost_gap.initial_total_cost, expectedInitial);
    assert.equal(report.cost_gap.final_total_cost, expectedFinal);
    assert.equal(report.cost_gap.cost_effective_total_cost, expectedEfficient);
    assert.ok(Math.abs(report.cost_gap.gap_closed_percent
      - 100 * (expectedInitial - expectedFinal) / (expectedInitial - expectedEfficient)) < 1e-9);
    assert.match(costGapHtml(report), /Open-market cost reductions/);
    assert.match(costGapHtml(report), /permits held when the open market opened/);
    const differentPayments = after.map(row => ({ ...row, auction_payment: 9999, market_net_spend: -9999 }));
    assert.deepEqual(roundCostEffectiveness(teams, differentPayments, session)[0].cost_gap, report.cost_gap);
  }
  const reports = roundCostEffectiveness(teams, scores, session);
  assert.deepEqual(reports.map(row => row.round_key), ["round1", "round2"]);
  assert.equal(reports[0].cost_gap.gap_closed_percent, 100);
  assert.ok(Math.abs(reports[1].cost_gap.gap_closed_percent - 100 * 13.5 / 25.5) < 1e-9);
  const leaderboard = leaderboardRows(teams, scores);
  assert.equal(leaderboard.length, 2);
  for (const row of leaderboard) {
    const own = scores.filter(score => score.team_id === row.team_id);
    assert.equal(row.rounds_scored, 2);
    assert.equal(row.round1, own.find(score => score.round_key === "round1").score);
    assert.equal(row.round2, own.find(score => score.round_key === "round2").score);
    assert.equal(row.total_score, own.reduce((sum, score) => sum + score.score, 0));
    assert.equal(row.points_vs_benchmark, own.reduce((sum, score) => sum + score.score - score.benchmark_score, 0));
  }
});
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
