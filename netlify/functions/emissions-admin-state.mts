import {
  calledPriceSummary,
  getActiveSession,
  getTeamsForSession,
  marketEquilibriumSummary,
  phaseTeamRows,
  requireAdminUser,
} from "./_lib/game_service.mts";
import { jsonResponse } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

export default async function emissionsAdminState(req) {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(200, {
        session: null,
        teams: [],
        submissions: {
          uniform: [],
          called_price: [],
          md: [],
        },
      });
    }

    const teams = await getTeamsForSession(session.id);

    const [uniformSubmissions, calledPriceSubmissions, mdSubmissions] = await Promise.all([
      supabaseRequest("/rest/v1/uniform_submissions", {
        method: "GET",
        queryParams: {
          select: "*",
          session_id: `eq.${session.id}`,
          order: "submitted_at.asc",
        },
        useServiceRole: true,
      }),
      supabaseRequest("/rest/v1/called_price_submissions", {
        method: "GET",
        queryParams: {
          select: "*",
          session_id: `eq.${session.id}`,
          order: "submitted_at.asc",
        },
        useServiceRole: true,
      }),
      supabaseRequest("/rest/v1/md_submissions", {
        method: "GET",
        queryParams: {
          select: "*",
          session_id: `eq.${session.id}`,
          order: "submitted_at.asc",
        },
        useServiceRole: true,
      }),
    ]);

    const marketSummary = teams.length > 0 ? marketEquilibriumSummary(teams) : null;
    const calledSummary =
      session.called_price !== null && session.called_price !== undefined && teams.length > 0
        ? calledPriceSummary(Number(session.called_price), teams)
        : null;
    const phaseRows = phaseTeamRows(session, teams, {
      uniform: uniformSubmissions,
      called_price: calledPriceSubmissions,
      md: mdSubmissions,
    });

    return jsonResponse(200, {
      session,
      teams,
      submissions: {
        uniform: uniformSubmissions,
        called_price: calledPriceSubmissions,
        md: mdSubmissions,
      },
      market_summary: marketSummary,
      called_price_summary: calledSummary,
      phase_team_rows: phaseRows,
      progress: {
        team_count: teams.length,
        expected_team_count: session.expected_team_count,
        uniform_correct: uniformSubmissions.filter((row) => row.is_correct).length,
        called_price_correct: calledPriceSubmissions.filter((row) => row.is_correct).length,
        md_correct: mdSubmissions.filter((row) => row.is_correct).length,
      },
    });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/emissions-trading/admin/state",
};
