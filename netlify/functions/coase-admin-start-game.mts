import {
  getActiveSession,
  requireAdminUser,
  startGameAndPairPlayers,
} from "./_lib/coase_game_service.mts";
import { jsonResponse } from "./_lib/http.mts";

export default async function coaseAdminStartGame(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(404, { error: "No active session exists. Create one first." });
    }

    const result = await startGameAndPairPlayers(session);

    return jsonResponse(200, {
      session: result.session,
      pairs: result.pairs,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/admin/start-game",
};
