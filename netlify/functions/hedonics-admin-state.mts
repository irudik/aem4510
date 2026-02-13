import {
  computeLeaderboard,
  correctCountsByRound,
  getActiveSession,
  getRoundSubmissionsForSession,
  getTeamsForSession,
  phaseTeamRows,
  requireAdminUser,
  revealStateForCurrentPhase,
} from "./_lib/hedonics_game_service.mts";
import { jsonResponse } from "./_lib/http.mts";

export default async function hedonicsAdminState(req) {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(200, {
        session: null,
        teams: [],
        submissions: [],
      });
    }

    const teams = await getTeamsForSession(session.id);
    const submissions = await getRoundSubmissionsForSession(session.id);
    const leaderboardSummary = computeLeaderboard(session, teams, submissions);
    const phaseRows = phaseTeamRows(session, teams, submissions);
    const revealState = revealStateForCurrentPhase(session, teams, submissions);

    return jsonResponse(200, {
      session,
      teams,
      submissions,
      phase_team_rows: phaseRows,
      reveal_state: revealState,
      scoring: {
        rank_points: leaderboardSummary.scoring_rank_points,
        wrong_deduction: leaderboardSummary.scoring_wrong_deduction,
      },
      leaderboard: leaderboardSummary.leaderboard,
      progress: {
        team_count: teams.length,
        expected_team_count: session.expected_team_count,
        correct_by_round: correctCountsByRound(submissions),
      },
    });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/hedonics/admin/state",
};
