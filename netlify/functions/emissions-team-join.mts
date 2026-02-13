import { createOrFetchTeam, getActiveSession } from "./_lib/game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function emissionsTeamJoin(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const teamName = String(body.team_name ?? "").trim();

    if (!teamName) {
      return jsonResponse(400, { error: "team_name is required" });
    }

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(404, { error: "No active game session exists yet." });
    }

    const team = await createOrFetchTeam(session, teamName);

    return jsonResponse(200, {
      session: {
        id: session.id,
        session_name: session.session_name,
        current_phase: session.current_phase,
        common_permit_allocation: session.common_permit_allocation,
        called_price: session.called_price,
        md_constant: session.md_constant,
        called_price_excess_demand: session.called_price_excess_demand,
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
      join_token: team.join_token,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/emissions-trading/team/join",
};
