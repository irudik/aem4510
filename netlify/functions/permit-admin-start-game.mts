import { enterPhase } from "./_lib/permit_phase.mts";
import {
  getActiveSession,
  requireAdminUser,
  startGameAndAssignFirms,
} from "./_lib/permit_game_service.mts";
import { jsonResponse } from "./_lib/http.mts";

export default async function permitAdminStartGame(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(404, { error: "No active session exists. Create one first." });
    }

    const startedSession = await startGameAndAssignFirms(session);
    const updatedSession = await enterPhase(
      startedSession,
      "auction1",
      Number(startedSession.round_seconds ?? 300),
    );

    return jsonResponse(200, { session: updatedSession });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/permit-market/admin/start-game",
};
