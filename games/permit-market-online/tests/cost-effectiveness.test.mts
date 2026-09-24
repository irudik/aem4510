import test from "node:test";
import assert from "node:assert/strict";
import { roundCostEffectiveness } from "../../../netlify/functions/_lib/permit_cost_effectiveness.mts";

const teams = [{ id: "a" }, { id: "b" }];

test("reports a completed round as cost-effective when every firm reaches its benchmark permits", () => {
  const reports = roundCostEffectiveness(teams, [
    { team_id: "a", round_key: "round1", permits_end: 3, benchmark_permits: 3 },
    { team_id: "b", round_key: "round1", permits_end: 1, benchmark_permits: 1 },
  ]);
  assert.deepEqual(reports, [{ round_key: "round1", achieved: true, firms_off_allocation: [] }]);
});

test("lists only firms whose final permits differ from the cost-effective allocation", () => {
  const reports = roundCostEffectiveness(teams, [
    { team_id: "a", round_key: "round1", permits_end: 2, benchmark_permits: 3 },
    { team_id: "b", round_key: "round1", permits_end: 2, benchmark_permits: 1 },
  ]);
  assert.equal(reports[0].achieved, false);
  assert.deepEqual(reports[0].firms_off_allocation, [
    { team_id: "a", actual_permits: 2, cost_effective_permits: 3, permit_difference: -1 },
    { team_id: "b", actual_permits: 2, cost_effective_permits: 1, permit_difference: 1 },
  ]);
});

test("does not judge an unfinished round", () => {
  assert.deepEqual(roundCostEffectiveness(teams, [
    { team_id: "a", round_key: "round1", permits_end: 3, benchmark_permits: 3 },
  ]), []);
});
