import {
  MAX_INCORRECT_SUBMISSIONS,
  calledPriceSummary,
  evaluateCalledPriceSubmission,
  getActiveSession,
  getTeamByJoinToken,
  getTeamsForSession,
  nextAttemptState,
} from "./_lib/game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

/**
 * Reveal excess demand once all teams are resolved (correct or maxed-out).
 * @param {Record<string, unknown>} session
 * @param {Array<Record<string, unknown>>} teams
 * @param {number} calledPrice
 */
async function maybeRevealCalledPriceExcessDemand(session, teams, calledPrice) {
  const resolutionRows = await supabaseRequest("/rest/v1/called_price_submissions", {
    method: "GET",
    queryParams: {
      select: "team_id,is_correct,is_locked",
      session_id: `eq.${session.id}`,
      called_price: `eq.${calledPrice}`,
    },
    useServiceRole: true,
  });

  const expectedTeamCount = Number(session.expected_team_count);
  const allTeamsResolved =
    Array.isArray(resolutionRows) &&
    teams.length === expectedTeamCount &&
    resolutionRows.length === expectedTeamCount &&
    expectedTeamCount > 0 &&
    resolutionRows.every((row) => Boolean(row.is_correct) || Boolean(row.is_locked));
  const allTeamsCorrect = allTeamsResolved && resolutionRows.every((row) => Boolean(row.is_correct));

  if (!allTeamsResolved) {
    return {
      all_teams_resolved: false,
      all_teams_correct: false,
      called_price_excess_demand: null,
    };
  }

  if (session.called_price_excess_demand !== null && session.called_price_excess_demand !== undefined) {
    return {
      all_teams_resolved: true,
      all_teams_correct: allTeamsCorrect,
      called_price_excess_demand: Number(session.called_price_excess_demand),
    };
  }

  const calledSummary = calledPriceSummary(calledPrice, teams);
  const revealPayload = {
    called_price_excess_demand: calledSummary.excess_demand,
    called_price_revealed_at: new Date().toISOString(),
  };

  await supabaseRequest("/rest/v1/game_sessions", {
    method: "PATCH",
    queryParams: {
      id: `eq.${session.id}`,
    },
    body: revealPayload,
    prefer: "return=minimal",
    useServiceRole: true,
  });

  return {
    all_teams_resolved: true,
    all_teams_correct: allTeamsCorrect,
    called_price_excess_demand: revealPayload.called_price_excess_demand,
  };
}

export default async function emissionsTeamSubmitPrice(req) {
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
    if (session.current_phase !== "called_price") {
      return jsonResponse(400, { error: "Called-price stage is not currently active" });
    }
    if (session.called_price === null || session.called_price === undefined) {
      return jsonResponse(400, { error: "No called price is currently set" });
    }

    const submittedAbatement = Number(body.submitted_abatement);
    if (!Number.isFinite(submittedAbatement) || submittedAbatement < 0) {
      return jsonResponse(400, { error: "submitted_abatement must be nonnegative" });
    }

    const calledPrice = Number(session.called_price);
    const teams = await getTeamsForSession(session.id);
    const existingRows = await supabaseRequest("/rest/v1/called_price_submissions", {
      method: "GET",
      queryParams: {
        select: "*",
        session_id: `eq.${session.id}`,
        team_id: `eq.${team.id}`,
        called_price: `eq.${calledPrice}`,
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
      const revealState = await maybeRevealCalledPriceExcessDemand(session, teams, calledPrice);
      return jsonResponse(200, {
        is_correct: Boolean(existing?.is_correct),
        checks: {
          abatement_correct: Boolean(existing?.abatement_correct),
          is_correct: Boolean(existing?.is_correct),
        },
        expected: {
          abatement: Number(existing?.expected_abatement ?? 0),
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

    const evaluated = evaluateCalledPriceSubmission(team, calledPrice, submittedAbatement);
    const attemptState = nextAttemptState(existing?.incorrect_attempts, evaluated.checks.is_correct);

    await supabaseRequest("/rest/v1/called_price_submissions", {
      method: "POST",
      queryParams: {
        on_conflict: "session_id,team_id,called_price",
      },
      body: [{
        session_id: session.id,
        team_id: team.id,
        called_price: calledPrice,
        submitted_abatement: submittedAbatement,
        expected_abatement: evaluated.expected.abatement,
        abatement_correct: evaluated.checks.abatement_correct,
        is_correct: evaluated.checks.is_correct,
        incorrect_attempts: attemptState.incorrect_attempts,
        is_locked: attemptState.is_locked,
      }],
      prefer: "resolution=merge-duplicates,return=minimal",
      useServiceRole: true,
    });
    const revealState = await maybeRevealCalledPriceExcessDemand(session, teams, calledPrice);

    return jsonResponse(200, {
      is_correct: evaluated.checks.is_correct,
      checks: evaluated.checks,
      expected: evaluated.expected,
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
  path: "/api/emissions-trading/team/submit-price",
};
