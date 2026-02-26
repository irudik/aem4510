import test from "node:test";
import assert from "node:assert/strict";

import {
  phaseTeamRows,
  evaluateUniformSubmission,
  evaluateCalledPriceSubmission,
  evaluateMdSubmission,
  parseScoringRankPoints,
  computeLeaderboard,
  nextAttemptState,
  MAX_INCORRECT_SUBMISSIONS,
  summarizeMacTypeCounts,
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

test("called-price submission accepts decimal and whole-number formatting", () => {
  const decimalExampleTeam = {
    id: "team-decimal",
    team_name: "Decimal",
    mac_intercept: 1000,
    mac_slope: 10,
    permit_allocation: 0,
    initial_emissions: 100,
  };

  const firstDecimalEntry = evaluateCalledPriceSubmission(decimalExampleTeam, 523.5, 52.3);
  assert.equal(firstDecimalEntry.expected.abatement, 52.35);
  assert.equal(firstDecimalEntry.checks.is_correct, true);

  const wholeNumberEntry = evaluateCalledPriceSubmission(decimalExampleTeam, 520, 52);
  assert.equal(wholeNumberEntry.expected.abatement, 52);
  assert.equal(wholeNumberEntry.checks.is_correct, true);
});

test("MD submission check evaluates team and industry targets", () => {
  const evaluated = evaluateMdSubmission(singleTeam, allTeams, 3500, 250, 8025);
  assert.equal(evaluated.checks.is_correct, true);

  const wrongCap = evaluateMdSubmission(singleTeam, allTeams, 3500, 250, 8010);
  assert.equal(wrongCap.checks.is_correct, false);
});

test("attempt policy locks on third incorrect and preserves attempts on correct", () => {
  const firstWrong = nextAttemptState(0, false);
  assert.equal(firstWrong.incorrect_attempts, 1);
  assert.equal(firstWrong.attempts_remaining, 2);
  assert.equal(firstWrong.is_locked, false);

  const secondWrong = nextAttemptState(1, false);
  assert.equal(secondWrong.incorrect_attempts, 2);
  assert.equal(secondWrong.attempts_remaining, 1);
  assert.equal(secondWrong.is_locked, false);

  const thirdWrong = nextAttemptState(2, false);
  assert.equal(thirdWrong.incorrect_attempts, MAX_INCORRECT_SUBMISSIONS);
  assert.equal(thirdWrong.attempts_remaining, 0);
  assert.equal(thirdWrong.is_locked, true);

  const correctAfterWrong = nextAttemptState(2, true);
  assert.equal(correctAfterWrong.incorrect_attempts, 2);
  assert.equal(correctAfterWrong.attempts_remaining, 1);
  assert.equal(correctAfterWrong.is_locked, false);
});

test("scoring rank-points parser handles defaults and explicit vectors", () => {
  assert.deepEqual(parseScoringRankPoints(undefined), [10, 7, 5, 3, 1]);
  assert.deepEqual(parseScoringRankPoints("12,8,4"), [12, 8, 4]);
  assert.deepEqual(parseScoringRankPoints([9, 6, 3]), [9, 6, 3]);
});

test("MAC-type summary counts duplicates by intercept and slope", () => {
  const summary = summarizeMacTypeCounts(allTeams);

  assert.deepEqual(summary, [
    { mac_intercept: 4000, mac_slope: 1, team_count: 1 },
    { mac_intercept: 4000, mac_slope: 2, team_count: 1 },
    { mac_intercept: 8000, mac_slope: 2, team_count: 1 },
    { mac_intercept: 8000, mac_slope: 4, team_count: 1 },
    { mac_intercept: 10000, mac_slope: 2.5, team_count: 1 },
    { mac_intercept: 10000, mac_slope: 5, team_count: 1 },
  ]);

  const withDuplicates = summarizeMacTypeCounts([
    ...allTeams,
    { id: "A2", team_letter: "G", team_name: "G", mac_intercept: 4000, mac_slope: 2, permit_allocation: 1480, initial_emissions: 2000 },
    { id: "B2", team_letter: "H", team_name: "H", mac_intercept: 8000, mac_slope: 4, permit_allocation: 1480, initial_emissions: 2000 },
  ]);

  assert.deepEqual(withDuplicates, [
    { mac_intercept: 4000, mac_slope: 1, team_count: 1 },
    { mac_intercept: 4000, mac_slope: 2, team_count: 2 },
    { mac_intercept: 8000, mac_slope: 2, team_count: 1 },
    { mac_intercept: 8000, mac_slope: 4, team_count: 2 },
    { mac_intercept: 10000, mac_slope: 2.5, team_count: 1 },
    { mac_intercept: 10000, mac_slope: 5, team_count: 1 },
  ]);
});

test("leaderboard combines speed points and wrong-answer deductions", () => {
  const session = {
    scoring_rank_points: "10,6,3",
    scoring_wrong_deduction: 2,
  };
  const teams = [
    { id: "A", team_letter: "A", team_name: "A" },
    { id: "B", team_letter: "B", team_name: "B" },
    { id: "C", team_letter: "C", team_name: "C" },
  ];
  const submissions = {
    uniform: [
      { team_id: "A", is_correct: true, incorrect_attempts: 0, updated_at: "2026-02-13T10:01:00Z" },
      { team_id: "B", is_correct: true, incorrect_attempts: 1, updated_at: "2026-02-13T10:02:00Z" },
      { team_id: "C", is_correct: false, incorrect_attempts: 3, updated_at: "2026-02-13T10:03:00Z" },
    ],
    called_price: [
      { team_id: "A", called_price: 3000, is_correct: false, incorrect_attempts: 2, updated_at: "2026-02-13T10:05:00Z" },
      { team_id: "B", called_price: 3000, is_correct: true, incorrect_attempts: 0, updated_at: "2026-02-13T10:07:00Z" },
      { team_id: "C", called_price: 3000, is_correct: true, incorrect_attempts: 1, updated_at: "2026-02-13T10:06:00Z" },
    ],
    md: [],
  };

  const result = computeLeaderboard(session, teams, submissions);
  assert.equal(result.leaderboard.length, 3);
  assert.equal(result.leaderboard[0].team_id, "B");
  assert.equal(result.leaderboard[0].total_points, 10);
  assert.equal(result.leaderboard[1].team_id, "A");
  assert.equal(result.leaderboard[1].total_points, 6);
  assert.equal(result.leaderboard[2].team_id, "C");
  assert.equal(result.leaderboard[2].total_points, 2);
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
        incorrect_attempts: 1,
        is_locked: false,
        is_correct: true,
      },
    ],
    called_price: [],
    md: [],
  };

  const rows = phaseTeamRows(session, allTeams, submissions);
  assert.equal(rows.length, 6);
  assert.equal(rows[0].team_letter, "A");
  assert.equal(rows[0].mac_equation, "MAC = 4000 - 2 × E");
  assert.equal(rows[0].standard_emissions, 1480);
  assert.equal(rows[0].standard_abatement, 520);
  assert.equal(rows[0].standard_abatement_cost, 270400);
  assert.equal(rows[0].submitted_emissions, 1480);
  assert.equal(rows[0].incorrect_attempts, 1);
  assert.equal(rows[0].attempts_remaining, 2);
  assert.equal(rows[0].submission_locked, false);
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
        incorrect_attempts: 3,
        is_locked: true,
        is_correct: true,
      },
    ],
    md: [],
  };

  const rows = phaseTeamRows(session, allTeams, submissions);
  assert.equal(rows.length, 6);
  assert.equal(rows[0].mac_equation, "MAC = 4000 - 2 × E");
  assert.equal(rows[0].called_price, 3000);
  assert.equal(rows[0].optimal_abatement, 1500);
  assert.equal(rows[0].optimal_emissions, 500);
  assert.equal(rows[0].submitted_abatement, 1500);
  assert.equal(rows[0].incorrect_attempts, 3);
  assert.equal(rows[0].attempts_remaining, 0);
  assert.equal(rows[0].submission_locked, true);
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
        incorrect_attempts: 0,
        is_locked: false,
        is_correct: true,
      },
    ],
  };

  const rows = phaseTeamRows(session, allTeams, submissions);
  assert.equal(rows.length, 6);
  assert.equal(rows[0].mac_equation, "MAC = 4000 - 2 × E");
  assert.equal(rows[0].efficient_emissions, 250);
  assert.equal(rows[0].efficient_industry_cap, 8025);
  assert.equal(rows[0].submitted_efficient_emissions, 250);
  assert.equal(rows[0].incorrect_attempts, 0);
  assert.equal(rows[0].attempts_remaining, 3);
  assert.equal(rows[0].submission_locked, false);
  assert.equal(rows[0].submission_correct, true);
});
