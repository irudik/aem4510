import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateUniformSubmission,
  evaluateCalledPriceSubmission,
  evaluateMdSubmission,
} from "../../../netlify/functions/_lib/game_service.mts";

const singleTeam = {
  id: "team-a",
  team_name: "Alpha",
  mac_intercept: 4000,
  mac_slope: 2,
  permit_allocation: 1480,
  initial_emissions: 2000,
};

const allTeams = [
  { id: "A", team_name: "A", mac_intercept: 4000, mac_slope: 2, permit_allocation: 1480, initial_emissions: 2000 },
  { id: "B", team_name: "B", mac_intercept: 8000, mac_slope: 4, permit_allocation: 1480, initial_emissions: 2000 },
  { id: "C", team_name: "C", mac_intercept: 10000, mac_slope: 5, permit_allocation: 1480, initial_emissions: 2000 },
  { id: "D", team_name: "D", mac_intercept: 4000, mac_slope: 1, permit_allocation: 1480, initial_emissions: 4000 },
  { id: "E", team_name: "E", mac_intercept: 8000, mac_slope: 2, permit_allocation: 1480, initial_emissions: 4000 },
  { id: "F", team_name: "F", mac_intercept: 10000, mac_slope: 2.5, permit_allocation: 1480, initial_emissions: 4000 },
];

test("uniform submission check uses ton and cost tolerances", () => {
  const evaluated = evaluateUniformSubmission(singleTeam, 1480, {
    submitted_emissions: 1481,
    submitted_abatement: 520,
    submitted_abatement_cost: 270480,
  });

  assert.equal(evaluated.checks.is_correct, true);
  assert.equal(evaluated.checks.emissions_correct, true);
  assert.equal(evaluated.checks.cost_correct, true);

  const wrongCost = evaluateUniformSubmission(singleTeam, 1480, {
    submitted_emissions: 1480,
    submitted_abatement: 520,
    submitted_abatement_cost: 270700,
  });
  assert.equal(wrongCost.checks.is_correct, false);
});

test("called-price submission check flags near-miss outside tolerance", () => {
  const correct = evaluateCalledPriceSubmission(singleTeam, 3000, 1501);
  assert.equal(correct.checks.is_correct, true);

  const wrong = evaluateCalledPriceSubmission(singleTeam, 3000, 1502);
  assert.equal(wrong.checks.is_correct, false);
});

test("MD submission check evaluates team and industry targets", () => {
  const evaluated = evaluateMdSubmission(singleTeam, allTeams, 3500, 250, 8025);
  assert.equal(evaluated.checks.is_correct, true);

  const wrongCap = evaluateMdSubmission(singleTeam, allTeams, 3500, 250, 8010);
  assert.equal(wrongCap.checks.is_correct, false);
});
