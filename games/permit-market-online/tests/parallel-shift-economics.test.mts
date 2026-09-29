import test from "node:test";
import assert from "node:assert/strict";
import { firmTypeForIndex, drawMacShifts, effectiveIntercept, resolveRoundCap,
  benchmarkForRound, abatementCost, permitValue, scoreTeamRound, clearAuction, truthfulUnitBids }
  from "../../../netlify/functions/_lib/permit_market.mts";
import { roundCostEffectiveness } from "../../../netlify/functions/_lib/permit_cost_effectiveness.mts";

const session = { cap_share_round1: 60, cap_share_round2: 40, shock_round1: true, shock_round2: true };
/** Reproducible shock assignments for testing all supported classroom sizes. */
function randomFrom(seed) {
  let state = seed;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
}

test("balanced parallel shocks preserve integer optima before and after both rounds, 2–100 firms", () => {
  for (let count = 2; count <= 100; count++) {
    for (let draw = 1; draw <= 8; draw++) {
      const teams = Array.from({ length: count }, (_, i) => ({ id: String(i), ...firmTypeForIndex(i) }));
      for (const [index, round] of ["round1", "round2"].entries()) {
        const shifts = drawMacShifts(teams, randomFrom(count * 99 + draw * 3 + index));
        assert.equal(shifts.filter(value => value > 0).length, Math.floor(count / 2));
        assert.equal(shifts.filter(value => value < 0).length, Math.floor(count / 2));
        assert.equal(shifts.filter(value => value === 0).length, count % 2);
        assert.equal(shifts.reduce((total, shift, i) => total + shift / teams[i].mac_slope, 0), 0);
        teams.forEach((team, i) => { team["mac_shift_" + round] = shifts[i]; });
      }
      const caps = [];
      for (const round of ["round1", "round2"]) {
        const cap = resolveRoundCap(teams, session, round);
        caps.push(cap);
        const before = benchmarkForRound(teams, cap);
        const after = benchmarkForRound(teams, cap, { interceptFor: team => effectiveIntercept(team, round) });
        assert.equal(before.price_basis, "common_mac");
        assert.equal(after.price_basis, "common_mac");
        assert.equal(before.benchmark_price, after.benchmark_price);
        assert.ok(Number.isInteger(after.benchmark_price));
        assert.equal(after.per_team.reduce((sum, row) => sum + row.benchmark_permits, 0), cap);
        const preById = new Map(before.per_team.map(row => [row.team_id, row]));
        const postById = new Map(after.per_team.map(row => [row.team_id, row]));
        let initialCost = 0;
        let finalCost = 0;
        for (const team of teams) {
          const d = effectiveIntercept(team, round);
          assert.ok(Number.isInteger(d) && d >= 0);
          const permits = postById.get(team.id).benchmark_permits;
          assert.ok(Number.isInteger(permits) && permits > 0 && permits < team.baseline_emissions);
          assert.equal(permits - preById.get(team.id).benchmark_permits, team["mac_shift_" + round] / team.mac_slope);
          assert.equal(d + team.mac_slope * (team.baseline_emissions - permits), after.benchmark_price);
          initialCost += abatementCost(team.mac_slope, team.baseline_emissions - preById.get(team.id).benchmark_permits, d);
          finalCost += abatementCost(team.mac_slope, team.baseline_emissions - permits, d);
          for (let e = 0; e <= team.baseline_emissions; e++) {
            const a = team.baseline_emissions - e;
            const cost = abatementCost(team.mac_slope, a, d);
            assert.ok(Number.isInteger(cost));
            if (e > 0) assert.equal(permitValue(team.baseline_emissions, team.mac_slope, e, d),
              abatementCost(team.mac_slope, a + 1, d) - cost);
          }
        }
        assert.ok(initialCost > finalCost, "Shocks should create gains from trading.");
      }
      assert.ok(caps[1] < caps[0]);
    }
  }
});

test("post-shock trading percentages exclude auction gains and shock changes in total cost", () => {
  const teams = [{ id: "a", ...firmTypeForIndex(0), mac_shift_round1: -2, mac_shift_round2: 2 },
    { id: "b", ...firmTypeForIndex(1), mac_shift_round1: 4, mac_shift_round2: -4 }];
  const scores = [];
  for (const [round, pricing] of [["round1", "uniform"], ["round2", "pay_as_bid"]]) {
    const cap = resolveRoundCap(teams, session, round);
    const auction = clearAuction(cap, truthfulUnitBids(teams), { pricing });
    const allocations = new Map(auction.allocations.map(row => [row.team_id, row]));
    const optimum = benchmarkForRound(teams, cap, { interceptFor: team => effectiveIntercept(team, round) });
    const optimal = new Map(optimum.per_team.map(row => [row.team_id, row]));
    const seller = teams.find(team => team["mac_shift_" + round] < 0);
    const buyer = teams.find(team => team["mac_shift_" + round] > 0);
    const rows = trades => teams.map(team => ({
      ...scoreTeamRound(team, { permits_from_auction: allocations.get(team.id).permits_won,
        auction_payment: allocations.get(team.id).payment, mac_intercept: effectiveIntercept(team, round), trades }),
      ...optimal.get(team.id), round_key: round,
    }));
    assert.equal(roundCostEffectiveness(teams, rows([]), session)[0].cost_gap.gap_closed_percent, 0);
    const final = rows([{ seller_team_id: seller.id, buyer_team_id: buyer.id, quantity: 1, price: optimum.benchmark_price }]);
    scores.push(...final);
    const report = roundCostEffectiveness(teams, final, session)[0];
    assert.equal(report.cost_gap.gap_closed_percent, 100);
    assert.equal(report.achieved, true);
    assert.equal(report.cost_gap.initial_total_cost - report.cost_gap.final_total_cost, 3);
  }
  assert.equal(roundCostEffectiveness(teams, scores, session).length, 2);
});
