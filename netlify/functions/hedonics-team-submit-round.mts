import {
  MAX_INCORRECT_SUBMISSIONS,
  canonicalHousesObject,
  evaluateTeamRoundSubmission,
  getActiveSession,
  getRoundSubmissionsForSession,
  getTeamByJoinToken,
  getTeamsForSession,
  isRoundPhase,
  nextAttemptState,
  resolutionSummaryForRound,
} from "./_lib/hedonics_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

export default async function hedonicsTeamSubmitRound(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);

    const joinToken = String(body.join_token ?? "").trim();
    if (!joinToken) {
      return jsonResponse(400, { error: "join_token is required" });
    }

    const team = await getTeamByJoinToken(joinToken);
    if (!team) {
      return jsonResponse(404, { error: "Team token not found" });
    }

    const session = await getActiveSession();
    if (!session || session.id !== team.session_id) {
      return jsonResponse(404, { error: "No active session for this team" });
    }

    const roundKey = String(session.current_phase ?? "");
    if (!isRoundPhase(roundKey)) {
      return jsonResponse(400, { error: "A playable hedonics round is not currently active" });
    }

    const submittedBestLocation = String(body.submitted_best_location ?? "").trim().toUpperCase();
    const submittedBestUtility = Number(body.submitted_best_utility);

    if (!["A", "B", "C", "D", "E", "F"].includes(submittedBestLocation)) {
      return jsonResponse(400, { error: "submitted_best_location must be one of A, B, C, D, E, F" });
    }
    if (!Number.isFinite(submittedBestUtility)) {
      return jsonResponse(400, { error: "submitted_best_utility must be numeric" });
    }

    const existingRows = await supabaseRequest("/rest/v1/hedonics_round_submissions", {
      method: "GET",
      queryParams: {
        select: "*",
        session_id: `eq.${session.id}`,
        team_id: `eq.${team.id}`,
        round_key: `eq.${roundKey}`,
        limit: 1,
      },
      useServiceRole: true,
    });
    const existing = existingRows[0] ?? null;
    const existingIncorrectAttempts = Number(existing?.incorrect_attempts ?? 0);
    const existingLocked =
      Boolean(existing?.is_locked) ||
      (!Boolean(existing?.is_correct) && existingIncorrectAttempts >= MAX_INCORRECT_SUBMISSIONS);

    const teams = await getTeamsForSession(session.id);

    if (existing?.is_correct || existingLocked) {
      const submissions = await getRoundSubmissionsForSession(session.id);
      const revealState = resolutionSummaryForRound(roundKey, teams, submissions);
      return jsonResponse(200, {
        is_correct: Boolean(existing?.is_correct),
        checks: {
          houses_correct: Boolean(existing?.houses_correct),
          best_location_correct: Boolean(existing?.best_location_correct),
          best_utility_correct: Boolean(existing?.best_utility_correct),
          is_correct: Boolean(existing?.is_correct),
        },
        expected: {
          market_state: {
            equilibrium_houses: existing?.expected_houses,
            equilibrium_prices: existing?.expected_prices,
          },
          best_locations: existing?.expected_best_locations,
          best_utility: existing?.expected_best_utility,
          wtp_by_location: existing?.expected_wtp,
          utility_by_location: existing?.expected_utility,
        },
        incorrect_attempts: Math.min(MAX_INCORRECT_SUBMISSIONS, Math.max(0, existingIncorrectAttempts)),
        attempts_remaining: Math.max(
          0,
          MAX_INCORRECT_SUBMISSIONS - Math.min(MAX_INCORRECT_SUBMISSIONS, Math.max(0, existingIncorrectAttempts)),
        ),
        submission_locked: existingLocked,
        submission_resolved: true,
        reveal_answers: existingLocked,
        ...revealState,
      });
    }

    const submittedHouses = canonicalHousesObject(body.submitted_houses);

    const evaluated = evaluateTeamRoundSubmission(team, roundKey, {
      submitted_houses: submittedHouses,
      submitted_best_location: submittedBestLocation,
      submitted_best_utility: submittedBestUtility,
    });
    const attemptState = nextAttemptState(existing?.incorrect_attempts, evaluated.checks.is_correct);

    await supabaseRequest("/rest/v1/hedonics_round_submissions", {
      method: "POST",
      queryParams: {
        on_conflict: "session_id,team_id,round_key",
      },
      body: [{
        session_id: session.id,
        team_id: team.id,
        round_key: roundKey,
        submitted_houses: submittedHouses,
        submitted_best_location: submittedBestLocation,
        submitted_best_utility: submittedBestUtility,
        expected_houses: evaluated.expected.market_state.equilibrium_houses,
        expected_prices: evaluated.expected.market_state.equilibrium_prices,
        expected_best_locations: evaluated.expected.best_locations,
        expected_best_utility: evaluated.expected.best_utility,
        expected_wtp: evaluated.expected.wtp_by_location,
        expected_utility: evaluated.expected.utility_by_location,
        houses_correct: evaluated.checks.houses_correct,
        best_location_correct: evaluated.checks.best_location_correct,
        best_utility_correct: evaluated.checks.best_utility_correct,
        is_correct: evaluated.checks.is_correct,
        incorrect_attempts: attemptState.incorrect_attempts,
        is_locked: attemptState.is_locked,
      }],
      prefer: "resolution=merge-duplicates,return=minimal",
      useServiceRole: true,
    });

    const submissions = await getRoundSubmissionsForSession(session.id);
    const revealState = resolutionSummaryForRound(roundKey, teams, submissions);

    return jsonResponse(200, {
      is_correct: evaluated.checks.is_correct,
      checks: evaluated.checks,
      expected: attemptState.is_locked || evaluated.checks.is_correct ? evaluated.expected : null,
      incorrect_attempts: attemptState.incorrect_attempts,
      attempts_remaining: attemptState.attempts_remaining,
      submission_locked: attemptState.is_locked,
      submission_resolved: Boolean(evaluated.checks.is_correct || attemptState.is_locked),
      reveal_answers: attemptState.is_locked,
      ...revealState,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/hedonics/team/submit-round",
};
