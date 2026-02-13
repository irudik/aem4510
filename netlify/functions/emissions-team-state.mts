import {
  computeLeaderboard,
  getActiveSession,
  getTeamByJoinToken,
  getTeamsForSession,
} from "./_lib/game_service.mts";
import { jsonResponse } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

export default async function emissionsTeamState(req) {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const url = new URL(req.url);
    const joinToken = String(url.searchParams.get("join_token") ?? "").trim();

    if (!joinToken) {
      return jsonResponse(400, { error: "join_token is required" });
    }

    const team = await getTeamByJoinToken(joinToken);
    if (!team) {
      return jsonResponse(404, { error: "Team token not found" });
    }

    const session = await getActiveSession();
    if (!session || session.id !== team.session_id) {
      return jsonResponse(404, { error: "Session is no longer active for this team" });
    }

    const [teams, uniformRows, calledPriceRows, mdRows] = await Promise.all([
      getTeamsForSession(session.id),
      supabaseRequest("/rest/v1/uniform_submissions", {
        method: "GET",
        queryParams: {
          select: "*",
          session_id: `eq.${session.id}`,
          order: "updated_at.asc",
        },
        useServiceRole: true,
      }),
      supabaseRequest("/rest/v1/called_price_submissions", {
        method: "GET",
        queryParams: {
          select: "*",
          session_id: `eq.${session.id}`,
          order: "updated_at.asc",
        },
        useServiceRole: true,
      }),
      supabaseRequest("/rest/v1/md_submissions", {
        method: "GET",
        queryParams: {
          select: "*",
          session_id: `eq.${session.id}`,
          order: "updated_at.asc",
        },
        useServiceRole: true,
      }),
    ]);
    const leaderboardSummary = computeLeaderboard(session, teams, {
      uniform: uniformRows,
      called_price: calledPriceRows,
      md: mdRows,
    });
    const uniformRow = (uniformRows ?? []).find((row) => String(row.team_id) === String(team.id)) ?? null;
    const calledPriceRow = (calledPriceRows ?? []).find((row) =>
      String(row.team_id) === String(team.id) &&
      (
        session.called_price === null ||
        session.called_price === undefined ||
        Number(row.called_price) === Number(session.called_price)
      )
    ) ?? null;
    const mdRow = (mdRows ?? []).find((row) =>
      String(row.team_id) === String(team.id) &&
      (
        session.md_constant === null ||
        session.md_constant === undefined ||
        Number(row.md_constant) === Number(session.md_constant)
      )
    ) ?? null;

    return jsonResponse(200, {
      session: {
        id: session.id,
        session_name: session.session_name,
        current_phase: session.current_phase,
        common_permit_allocation: session.common_permit_allocation,
        called_price: session.called_price,
        md_constant: session.md_constant,
        called_price_excess_demand: session.called_price_excess_demand,
        called_price_revealed_at: session.called_price_revealed_at,
        scoring_rank_points: session.scoring_rank_points,
        scoring_wrong_deduction: session.scoring_wrong_deduction,
      },
      team: {
        id: team.id,
        team_name: team.team_name,
        team_letter: team.team_letter,
        mac_intercept: team.mac_intercept,
        mac_slope: team.mac_slope,
        initial_emissions: team.initial_emissions,
        permit_allocation: team.permit_allocation,
      },
      submissions: {
        uniform: uniformRow,
        called_price: calledPriceRow,
        md: mdRow,
      },
      scoring: {
        rank_points: leaderboardSummary.scoring_rank_points,
        wrong_deduction: leaderboardSummary.scoring_wrong_deduction,
      },
      leaderboard: leaderboardSummary.leaderboard,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/emissions-trading/team/state",
};
