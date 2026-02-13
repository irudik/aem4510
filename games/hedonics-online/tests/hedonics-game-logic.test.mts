import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_INCORRECT_SUBMISSIONS,
  computeLeaderboard,
  nextAttemptState,
  parseScoringRankPoints,
  phaseTeamRows,
  publicRoundContext,
  resolutionSummaryForRound,
  revealStateForCurrentPhase,
  sanitizeSubmissionForTeam,
  isRoundPhase,
} from "../../../netlify/functions/_lib/hedonics_game_service.mts";

const teams = [
  {
    id: "t-black",
    team_letter: "A",
    team_name: "Team Black",
    household_type_key: "black",
    household_type_label: "Black",
    household_count: 5,
    alpha_eq: 6,
    beta_sq: 1,
  },
  {
    id: "t-red",
    team_letter: "B",
    team_name: "Team Red",
    household_type_key: "red",
    household_type_label: "Red",
    household_count: 15,
    alpha_eq: 5,
    beta_sq: 1,
  },
  {
    id: "t-green",
    team_letter: "C",
    team_name: "Team Green",
    household_type_key: "green",
    household_type_label: "Green",
    household_count: 25,
    alpha_eq: 2,
    beta_sq: 1,
  },
];

test("phase helper and scoring parser defaults", () => {
  assert.equal(isRoundPhase("round1"), true);
  assert.equal(isRoundPhase("setup"), false);
  assert.deepEqual(parseScoringRankPoints(undefined), [10, 7, 5, 3, 1]);
  assert.deepEqual(parseScoringRankPoints("9,4,1"), [9, 4, 1]);
  assert.equal(publicRoundContext("round2").eq_by_location.C, 2);
  assert.equal(publicRoundContext("setup"), null);
});

test("attempt policy locks on third incorrect submission", () => {
  const firstWrong = nextAttemptState(0, false);
  const secondWrong = nextAttemptState(firstWrong.incorrect_attempts, false);
  const thirdWrong = nextAttemptState(secondWrong.incorrect_attempts, false);

  assert.equal(firstWrong.incorrect_attempts, 1);
  assert.equal(secondWrong.incorrect_attempts, 2);
  assert.equal(thirdWrong.incorrect_attempts, MAX_INCORRECT_SUBMISSIONS);
  assert.equal(thirdWrong.is_locked, true);
  assert.equal(thirdWrong.attempts_remaining, 0);
});

test("leaderboard combines speed points and wrong-answer deductions by round", () => {
  const session = {
    scoring_rank_points: "10,6,3",
    scoring_wrong_deduction: 2,
  };
  const submissions = [
    {
      team_id: "t-black",
      round_key: "round1",
      is_correct: true,
      incorrect_attempts: 0,
      updated_at: "2026-02-13T10:00:01Z",
    },
    {
      team_id: "t-red",
      round_key: "round1",
      is_correct: true,
      incorrect_attempts: 1,
      updated_at: "2026-02-13T10:00:05Z",
    },
    {
      team_id: "t-green",
      round_key: "round1",
      is_correct: false,
      incorrect_attempts: 3,
      updated_at: "2026-02-13T10:00:10Z",
    },
    {
      team_id: "t-green",
      round_key: "round2",
      is_correct: true,
      incorrect_attempts: 0,
      updated_at: "2026-02-13T10:01:00Z",
    },
  ];

  const result = computeLeaderboard(session, teams, submissions);

  assert.equal(result.leaderboard.length, 3);
  assert.equal(result.leaderboard[0].team_id, "t-black");
  assert.equal(result.leaderboard[0].total_points, 10);
  assert.equal(result.leaderboard[1].team_id, "t-red");
  assert.equal(result.leaderboard[1].total_points, 4);
  assert.equal(result.leaderboard[2].team_id, "t-green");
  assert.equal(result.leaderboard[2].total_points, 4);
});

test("phaseTeamRows exposes expected round data and submission status", () => {
  const session = {
    current_phase: "round5",
  };
  const submissions = [
    {
      team_id: "t-black",
      round_key: "round5",
      submitted_houses: { A: 35, B: 2, C: 4, D: 7, E: 11, F: 16 },
      submitted_best_location: "F",
      submitted_best_utility: 14,
      houses_correct: true,
      best_location_correct: true,
      best_utility_correct: true,
      incorrect_attempts: 1,
      is_locked: false,
      is_correct: true,
    },
  ];

  const rows = phaseTeamRows(session, teams, submissions);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].team_letter, "A");
  assert.equal(rows[0].utility_equation, "U = 6 × EQ + 1 × SQ - P");
  assert.equal(rows[0].equilibrium_prices, "A:0 | B:2 | C:4 | D:7 | E:11 | F:16");
  assert.equal(rows[0].best_locations, "F");
  assert.equal(rows[0].best_utility, 14);
  assert.equal(rows[0].submitted_best_location, "F");
  assert.equal(rows[0].attempts_remaining, 2);
  assert.equal(rows[0].submission_correct, true);
});

test("round reveal state appears only when all joined teams are resolved", () => {
  const session = {
    current_phase: "round1",
  };

  const unresolved = [
    { team_id: "t-black", round_key: "round1", is_correct: true, is_locked: false },
    { team_id: "t-red", round_key: "round1", is_correct: false, is_locked: false },
  ];
  const unresolvedState = resolutionSummaryForRound("round1", teams, unresolved);
  assert.equal(unresolvedState.all_teams_resolved, false);
  assert.equal(unresolvedState.revealed_market, null);

  const resolved = [
    { team_id: "t-black", round_key: "round1", is_correct: true, is_locked: false },
    { team_id: "t-red", round_key: "round1", is_correct: false, is_locked: true },
    { team_id: "t-green", round_key: "round1", is_correct: true, is_locked: false },
  ];
  const reveal = revealStateForCurrentPhase(session, teams, resolved);
  assert.equal(reveal.all_teams_resolved, true);
  assert.equal(reveal.all_teams_correct, false);
  assert.equal(reveal.revealed_market.equilibrium_prices.F, 15);
});

test("team submission sanitizer hides expected answers before resolution", () => {
  const unresolved = sanitizeSubmissionForTeam({
    id: "x",
    session_id: "s",
    team_id: "t",
    round_key: "round1",
    submitted_houses: { A: 1, B: 2, C: 3, D: 4, E: 5, F: 60 },
    submitted_best_location: "A",
    submitted_best_utility: 0,
    houses_correct: false,
    best_location_correct: false,
    best_utility_correct: false,
    is_correct: false,
    incorrect_attempts: 1,
    is_locked: false,
    expected_houses: { A: 30, B: 3, C: 6, D: 9, E: 12, F: 15 },
  });
  assert.equal("expected_houses" in unresolved, false);

  const resolved = sanitizeSubmissionForTeam({
    id: "x",
    session_id: "s",
    team_id: "t",
    round_key: "round1",
    submitted_houses: { A: 30, B: 3, C: 6, D: 9, E: 12, F: 15 },
    submitted_best_location: "F",
    submitted_best_utility: 0,
    houses_correct: true,
    best_location_correct: true,
    best_utility_correct: true,
    is_correct: true,
    incorrect_attempts: 0,
    is_locked: false,
    expected_houses: { A: 30, B: 3, C: 6, D: 9, E: 12, F: 15 },
  });
  assert.equal(resolved.expected_houses.F, 15);
});
