import {
  MAX_INCORRECT_SUBMISSIONS,
  evaluateMdSubmission,
  getActiveSession,
  getTeamByJoinToken,
  getTeamsForSession,
  nextAttemptState,
} from "./_lib/game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

export default async function emissionsTeamSubmitMd(req) {
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
    if (session.current_phase !== "md") {
      return jsonResponse(400, { error: "MD stage is not currently active" });
    }
    if (session.md_constant === null || session.md_constant === undefined) {
      return jsonResponse(400, { error: "No md_constant is currently set" });
    }

    const submittedEfficientEmissions = Number(body.submitted_efficient_emissions);
    const submittedIndustryCap = Number(body.submitted_industry_cap);
    if (!Number.isFinite(submittedEfficientEmissions) || submittedEfficientEmissions < 0) {
      return jsonResponse(400, { error: "submitted_efficient_emissions must be nonnegative" });
    }
    if (!Number.isFinite(submittedIndustryCap) || submittedIndustryCap < 0) {
      return jsonResponse(400, { error: "submitted_industry_cap must be nonnegative" });
    }

    const allTeams = await getTeamsForSession(session.id);
    const mdConstant = Number(session.md_constant);
    const existingRows = await supabaseRequest("/rest/v1/md_submissions", {
      method: "GET",
      queryParams: {
        select: "*",
        session_id: `eq.${session.id}`,
        team_id: `eq.${team.id}`,
        md_constant: `eq.${mdConstant}`,
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
          efficient_emissions_correct: Boolean(existing?.efficient_emissions_correct),
          industry_cap_correct: Boolean(existing?.industry_cap_correct),
          is_correct: Boolean(existing?.is_correct),
        },
        expected: {
          efficient_emissions: Number(existing?.expected_efficient_emissions ?? 0),
          industry_cap: Number(existing?.expected_industry_cap ?? 0),
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

    const evaluated = evaluateMdSubmission(
      team,
      allTeams,
      mdConstant,
      submittedEfficientEmissions,
      submittedIndustryCap,
    );
    const attemptState = nextAttemptState(existing?.incorrect_attempts, evaluated.checks.is_correct);

    await supabaseRequest("/rest/v1/md_submissions", {
      method: "POST",
      queryParams: {
        on_conflict: "session_id,team_id,md_constant",
      },
      body: [{
        session_id: session.id,
        team_id: team.id,
        md_constant: mdConstant,
        submitted_efficient_emissions: submittedEfficientEmissions,
        submitted_industry_cap: submittedIndustryCap,
        expected_efficient_emissions: evaluated.expected.efficient_emissions,
        expected_industry_cap: evaluated.expected.industry_cap,
        efficient_emissions_correct: evaluated.checks.efficient_emissions_correct,
        industry_cap_correct: evaluated.checks.industry_cap_correct,
        is_correct: evaluated.checks.is_correct,
        incorrect_attempts: attemptState.incorrect_attempts,
        is_locked: attemptState.is_locked,
      }],
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
  path: "/api/emissions-trading/team/submit-md",
};
