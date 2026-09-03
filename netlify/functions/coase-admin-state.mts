import {
  leaderboardRows,
  roundSummaryRows,
} from "./_lib/coase_bargaining.mts";
import {
  currentRoundPairStatusRows,
  getActiveSession,
  getOffersForSession,
  getPairsForSession,
  getPlayersForSession,
  getRoundOutcomesForSession,
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
        offers: [],
        outcomes: [],
      });
    }

    const [players, pairs, offers, outcomes] = await Promise.all([
      getPlayersForSession(String(session.id)),
      getPairsForSession(String(session.id)),
      getOffersForSession(String(session.id)),
      getRoundOutcomesForSession(String(session.id)),
    ]);

    return jsonResponse(200, {
      session,
      server_now: new Date().toISOString(),
      round_context: roundContext(session.current_phase),
      players,
      pairs,
      pair_details: pairDetailsRows(pairs, players),
      offers,
      outcomes,
      pair_status: currentRoundPairStatusRows(
        session.current_phase,
        pairs,
        offers,
        outcomes,
      ),
      leaderboard: leaderboardRows(players, pairs, outcomes),
      round_summaries: roundSummaryRows(pairs, outcomes),
      progress: progressSummary(session, pairs, outcomes),
    });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/admin/state",
};
