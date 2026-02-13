import {
  computeLeaderboard,
  getActiveSession,
  getRoundSubmissionsForSession,
  getTeamByJoinToken,
  getTeamsForSession,
  isRoundPhase,
  revealStateForCurrentPhase,
} from "./_lib/hedonics_game_service.mts";
import { jsonResponse } from "./_lib/http.mts";

export default async function hedonicsTeamState(req) {
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

    const [teams, submissions] = await Promise.all([
      getTeamsForSession(session.id),
      getRoundSubmissionsForSession(session.id),
    ]);

    const phase = String(session.current_phase ?? "");
    const currentSubmission = isRoundPhase(phase)
      ? (submissions ?? []).find((row) => String(row.team_id) === String(team.id) && String(row.round_key) === phase) ?? null
      : null;

    const leaderboardSummary = computeLeaderboard(session, teams, submissions);
    const revealState = revealStateForCurrentPhase(session, teams, submissions);

    return jsonResponse(200, {
      session: {
        id: session.id,
        session_name: session.session_name,
        current_phase: session.current_phase,
        scoring_rank_points: session.scoring_rank_points,
        scoring_wrong_deduction: session.scoring_wrong_deduction,
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
      submission: currentSubmission,
      reveal_state: revealState,
      scoring: {
        rank_points: leaderboardSummary.scoring_rank_points,
        wrong_deduction: leaderboardSummary.scoring_wrong_deduction,
      },
      leaderboard: leaderboardSummary.leaderboard,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/hedonics/team/state",
};
