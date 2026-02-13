import {
  calledPriceSummary,
  evaluateCalledPriceSubmission,
  getActiveSession,
  getTeamByJoinToken,
  getTeamsForSession,
} from "./_lib/game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

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
    const evaluated = evaluateCalledPriceSubmission(team, calledPrice, submittedAbatement);

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
      }],
      prefer: "resolution=merge-duplicates,return=minimal",
      useServiceRole: true,
    });

    const teams = await getTeamsForSession(session.id);
    const correctRows = await supabaseRequest("/rest/v1/called_price_submissions", {
      method: "GET",
      queryParams: {
        select: "team_id",
        session_id: `eq.${session.id}`,
        called_price: `eq.${calledPrice}`,
        is_correct: "eq.true",
      },
      useServiceRole: true,
    });

    const expectedTeamCount = Number(session.expected_team_count);
    const allCorrect =
      Array.isArray(correctRows) &&
      teams.length === expectedTeamCount &&
      correctRows.length === expectedTeamCount &&
      expectedTeamCount > 0;
    let excessDemandPayload = null;

    if (allCorrect) {
      const calledSummary = calledPriceSummary(calledPrice, teams);
      excessDemandPayload = {
        called_price_excess_demand: calledSummary.excess_demand,
        called_price_revealed_at: new Date().toISOString(),
      };

      await supabaseRequest("/rest/v1/game_sessions", {
        method: "PATCH",
        queryParams: {
          id: `eq.${session.id}`,
        },
        body: excessDemandPayload,
        prefer: "return=minimal",
        useServiceRole: true,
      });
    }

    return jsonResponse(200, {
      is_correct: evaluated.checks.is_correct,
      checks: evaluated.checks,
      expected: evaluated.expected,
      all_teams_correct: allCorrect,
      called_price_excess_demand: excessDemandPayload?.called_price_excess_demand ?? null,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/emissions-trading/team/submit-price",
};
