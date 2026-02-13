import {
  MAX_INCORRECT_SUBMISSIONS,
  evaluateUniformSubmission,
  getActiveSession,
  getTeamByJoinToken,
  nextAttemptState,
} from "./_lib/game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

export default async function emissionsTeamSubmitUniform(req) {
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
    if (session.current_phase !== "uniform") {
      return jsonResponse(400, { error: "Uniform-standard stage is not currently active" });
    }

    const submittedEmissions = Number(body.submitted_emissions);
    const submittedAbatement = Number(body.submitted_abatement);
    const submittedCost = Number(body.submitted_abatement_cost);

    if (!Number.isFinite(submittedEmissions) || submittedEmissions < 0) {
      return jsonResponse(400, { error: "submitted_emissions must be nonnegative" });
    }
    if (!Number.isFinite(submittedAbatement) || submittedAbatement < 0) {
      return jsonResponse(400, { error: "submitted_abatement must be nonnegative" });
    }
    if (!Number.isFinite(submittedCost) || submittedCost < 0) {
      return jsonResponse(400, { error: "submitted_abatement_cost must be nonnegative" });
    }

    const existingRows = await supabaseRequest("/rest/v1/uniform_submissions", {
      method: "GET",
      queryParams: {
        select: "*",
        session_id: `eq.${session.id}`,
        team_id: `eq.${team.id}`,
        limit: 1,
      },
      useServiceRole: true,
    });
    const existing = existingRows[0] ?? null;
    const existingIncorrectAttempts = Number(existing?.incorrect_attempts ?? 0);
    const existingLocked =
      Boolean(existing?.is_locked) ||
      (!Boolean(existing?.is_correct) && existingIncorrectAttempts >= MAX_INCORRECT_SUBMISSIONS);

    if (existing?.is_correct || existingLocked) {
      return jsonResponse(200, {
        is_correct: Boolean(existing?.is_correct),
        checks: {
          emissions_correct: Boolean(existing?.emissions_correct),
          abatement_correct: Boolean(existing?.abatement_correct),
          cost_correct: Boolean(existing?.cost_correct),
          is_correct: Boolean(existing?.is_correct),
        },
        expected: {
          final_emissions: Number(existing?.expected_emissions ?? 0),
          abatement: Number(existing?.expected_abatement ?? 0),
          abatement_cost: Number(existing?.expected_abatement_cost ?? 0),
        },
        incorrect_attempts: Math.min(MAX_INCORRECT_SUBMISSIONS, Math.max(0, existingIncorrectAttempts)),
        attempts_remaining: Math.max(
          0,
          MAX_INCORRECT_SUBMISSIONS - Math.min(MAX_INCORRECT_SUBMISSIONS, Math.max(0, existingIncorrectAttempts)),
        ),
        submission_locked: existingLocked,
        submission_resolved: true,
        reveal_answers: existingLocked,
      });
    }

    const evaluated = evaluateUniformSubmission(team, Number(session.common_permit_allocation), {
      submitted_emissions: submittedEmissions,
      submitted_abatement: submittedAbatement,
      submitted_abatement_cost: submittedCost,
    });
    const attemptState = nextAttemptState(existing?.incorrect_attempts, evaluated.checks.is_correct);

    const rowPayload = {
      session_id: session.id,
      team_id: team.id,
      submitted_emissions: submittedEmissions,
      submitted_abatement: submittedAbatement,
      submitted_abatement_cost: submittedCost,
      expected_emissions: evaluated.expected.final_emissions,
      expected_abatement: evaluated.expected.abatement,
      expected_abatement_cost: evaluated.expected.abatement_cost,
      emissions_correct: evaluated.checks.emissions_correct,
      abatement_correct: evaluated.checks.abatement_correct,
      cost_correct: evaluated.checks.cost_correct,
      is_correct: evaluated.checks.is_correct,
      incorrect_attempts: attemptState.incorrect_attempts,
      is_locked: attemptState.is_locked,
    };

    await supabaseRequest("/rest/v1/uniform_submissions", {
      method: "POST",
      queryParams: {
        on_conflict: "session_id,team_id",
      },
      body: [rowPayload],
      prefer: "resolution=merge-duplicates,return=minimal",
      useServiceRole: true,
    });

    return jsonResponse(200, {
      is_correct: evaluated.checks.is_correct,
      checks: evaluated.checks,
      expected: evaluated.expected,
      incorrect_attempts: attemptState.incorrect_attempts,
      attempts_remaining: attemptState.attempts_remaining,
      submission_locked: attemptState.is_locked,
      submission_resolved: Boolean(evaluated.checks.is_correct || attemptState.is_locked),
      reveal_answers: attemptState.is_locked,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/emissions-trading/team/submit-uniform",
};
