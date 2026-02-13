import test from "node:test";
import assert from "node:assert/strict";

import {
  phaseTeamRows,
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
  { id: "A", team_letter: "A", team_name: "A", mac_intercept: 4000, mac_slope: 2, permit_allocation: 1480, initial_emissions: 2000 },
  { id: "B", team_letter: "B", team_name: "B", mac_intercept: 8000, mac_slope: 4, permit_allocation: 1480, initial_emissions: 2000 },
  { id: "C", team_letter: "C", team_name: "C", mac_intercept: 10000, mac_slope: 5, permit_allocation: 1480, initial_emissions: 2000 },
  { id: "D", team_letter: "D", team_name: "D", mac_intercept: 4000, mac_slope: 1, permit_allocation: 1480, initial_emissions: 4000 },
  { id: "E", team_letter: "E", team_name: "E", mac_intercept: 8000, mac_slope: 2, permit_allocation: 1480, initial_emissions: 4000 },
  { id: "F", team_letter: "F", team_name: "F", mac_intercept: 10000, mac_slope: 2.5, permit_allocation: 1480, initial_emissions: 4000 },
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

test("phase team rows expose uniform expected and submitted values", () => {
  const session = {
    current_phase: "uniform",
    common_permit_allocation: 1480,
    called_price: null,
    md_constant: null,
  };
  const submissions = {
    uniform: [
      {
        team_id: "A",
        submitted_emissions: 1480,
        submitted_abatement: 520,
        submitted_abatement_cost: 270400,
        is_correct: true,
      },
    ],
    called_price: [],
    md: [],
  };

  const rows = phaseTeamRows(session, allTeams, submissions);
  assert.equal(rows.length, 6);
  assert.equal(rows[0].team_letter, "A");
  assert.equal(rows[0].standard_emissions, 1480);
  assert.equal(rows[0].standard_abatement, 520);
  assert.equal(rows[0].standard_abatement_cost, 270400);
  assert.equal(rows[0].submitted_emissions, 1480);
  assert.equal(rows[0].submission_correct, true);
});

test("phase team rows expose called-price expected and submitted values", () => {
  const session = {
    current_phase: "called_price",
    common_permit_allocation: 1480,
    called_price: 3000,
    md_constant: null,
  };
  const submissions = {
    uniform: [],
    called_price: [
      {
        team_id: "A",
        called_price: 3000,
        submitted_abatement: 1500,
        is_correct: true,
      },
    ],
    md: [],
  };

  const rows = phaseTeamRows(session, allTeams, submissions);
  assert.equal(rows.length, 6);
  assert.equal(rows[0].called_price, 3000);
  assert.equal(rows[0].optimal_abatement, 1500);
  assert.equal(rows[0].optimal_emissions, 500);
  assert.equal(rows[0].submitted_abatement, 1500);
  assert.equal(rows[0].submission_correct, true);
});

test("phase team rows expose md expected and submitted values", () => {
  const session = {
    current_phase: "md",
    common_permit_allocation: 1480,
    called_price: null,
    md_constant: 3500,
  };
  const submissions = {
    uniform: [],
    called_price: [],
    md: [
      {
        team_id: "A",
        md_constant: 3500,
        submitted_efficient_emissions: 250,
        submitted_industry_cap: 8025,
        is_correct: true,
      },
    ],
  };

  const rows = phaseTeamRows(session, allTeams, submissions);
  assert.equal(rows.length, 6);
  assert.equal(rows[0].efficient_emissions, 250);
  assert.equal(rows[0].efficient_industry_cap, 8025);
  assert.equal(rows[0].submitted_efficient_emissions, 250);
  assert.equal(rows[0].submission_correct, true);
});
