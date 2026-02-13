import { createOrFetchPlayer, getActiveSession } from "./_lib/coase_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function coasePlayerJoin(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const playerName = String(body.player_name ?? "").trim();

    if (!playerName) {
      return jsonResponse(400, { error: "player_name is required" });
    }

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(404, { error: "No active game session exists yet." });
    }

    const player = await createOrFetchPlayer(session, playerName);

    return jsonResponse(200, {
      session: {
        id: session.id,
        session_name: session.session_name,
        current_phase: session.current_phase,
        has_started: session.has_started,
      },
      player: {
        id: player.id,
        player_name: player.player_name,
      },
      join_token: player.join_token,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/player/join",
};
