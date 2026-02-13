import { createOrFetchTeam, getActiveSession } from "./_lib/hedonics_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function hedonicsTeamJoin(req) {
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
      },
      team: {
        id: team.id,
        team_name: team.team_name,
        team_letter: team.team_letter,
        household_type_key: team.household_type_key,
        household_type_label: team.household_type_label,
        household_count: team.household_count,
        alpha_eq: team.alpha_eq,
        beta_sq: team.beta_sq,
      },
      join_token: team.join_token,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/hedonics/team/join",
};
