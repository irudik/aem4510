import { getActiveSession, getTeamByJoinToken } from "./_lib/game_service.mts";
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

    const [uniformRows, calledPriceRows, mdRows] = await Promise.all([
      supabaseRequest("/rest/v1/uniform_submissions", {
        method: "GET",
        queryParams: {
          select: "*",
          session_id: `eq.${session.id}`,
          team_id: `eq.${team.id}`,
          limit: 1,
        },
        useServiceRole: true,
      }),
      supabaseRequest("/rest/v1/called_price_submissions", {
        method: "GET",
        queryParams: {
          select: "*",
          session_id: `eq.${session.id}`,
          team_id: `eq.${team.id}`,
          called_price: session.called_price == null ? undefined : `eq.${session.called_price}`,
          limit: 1,
        },
        useServiceRole: true,
      }),
      supabaseRequest("/rest/v1/md_submissions", {
        method: "GET",
        queryParams: {
          select: "*",
          session_id: `eq.${session.id}`,
          team_id: `eq.${team.id}`,
          md_constant: session.md_constant == null ? undefined : `eq.${session.md_constant}`,
          limit: 1,
        },
        useServiceRole: true,
      }),
    ]);

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
        uniform: uniformRows[0] ?? null,
        called_price: calledPriceRows[0] ?? null,
        md: mdRows[0] ?? null,
      },
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/emissions-trading/team/state",
};
