import {
  adminProxyIdsFromPlayers,
  currentRoundPairStatusRows,
  getActiveSession,
  getPairsForSession,
  getPlayersForSession,
  getRoundOutcomesForSession,
  getRoundSubmissionsForSession,
  pairDetailsRows,
  progressSummary,
  requireAdminUser,
  roundContext,
} from "./_lib/coase_game_service.mts";
import { jsonResponse } from "./_lib/http.mts";

export default async function coaseAdminState(req) {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(200, {
        session: null,
        players: [],
        pairs: [],
        submissions: [],
        outcomes: [],
      });
    }

    const [players, pairs, submissions, outcomes] = await Promise.all([
      getPlayersForSession(String(session.id)),
      getPairsForSession(String(session.id)),
      getRoundSubmissionsForSession(String(session.id)),
      getRoundOutcomesForSession(String(session.id)),
    ]);

    const adminProxyIds = adminProxyIdsFromPlayers(players);

    return jsonResponse(200, {
      session,
      round_context: roundContext(session.current_phase),
      players,
      pairs,
      pair_details: pairDetailsRows(pairs, players),
      submissions,
      outcomes,
      pair_status: currentRoundPairStatusRows(
        session.current_phase,
        pairs,
        submissions,
        outcomes,
        adminProxyIds,
      ),
      progress: progressSummary(session, pairs, outcomes),
    });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/admin/state",
};
