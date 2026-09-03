import {
  createOrFetchTeam,
  getActiveSession,
  getTeamsForSession,
} from "./_lib/permit_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function permitTeamJoin(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const teamName = String(body.team_name ?? "").trim();

    if (!teamName) {
      return jsonResponse(400, { error: "team_name is required" });
    }
    if (teamName.length > 40) {
      return jsonResponse(400, { error: "team_name must be at most 40 characters" });
    }

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(404, { error: "No active game session exists yet." });
    }

    const teams = await getTeamsForSession(String(session.id));
    const existing = teams.find(
      (team) => String(team.team_name_normalized)
        === teamName.trim().toLowerCase().replace(/\s+/g, " "),
    );

    // Rejoining is always allowed; new teams only before the game starts,
    // because firm types are assigned at the start.
    if (!existing && session.has_started) {
      return jsonResponse(400, { error: "The game has already started; new teams cannot join." });
    }
    if (!existing && teams.length >= Number(session.expected_team_count)) {
      return jsonResponse(400, { error: "This game is full." });
    }

    const team = existing ?? await createOrFetchTeam(session, teamName);

    return jsonResponse(200, {
      join_token: team.join_token,
      team: {
        id: team.id,
        team_name: team.team_name,
      },
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/permit-market/team/join",
};
