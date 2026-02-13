import {
  DEFAULT_SCORING_RANK_POINTS,
  DEFAULT_SCORING_WRONG_DEDUCTION,
  createSession,
  parseScoringRankPoints,
  requireAdminUser,
  scoringRankPointsToText,
} from "./_lib/hedonics_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function hedonicsAdminCreateSession(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const adminUser = await requireAdminUser(req);
    const body = await readJsonBody(req);

    const sessionName = String(body.session_name ?? "AEM 4510 Hedonics Session").trim();
    const expectedTeamCount = Number(body.expected_team_count);
    let scoringRankPoints = null;
    try {
      scoringRankPoints = parseScoringRankPoints(
        body.scoring_rank_points ?? scoringRankPointsToText(DEFAULT_SCORING_RANK_POINTS),
      );
    } catch (parseError) {
      return jsonResponse(400, { error: parseError.message });
    }
    const scoringWrongDeduction = Number(
      body.scoring_wrong_deduction ?? DEFAULT_SCORING_WRONG_DEDUCTION,
    );

    if (!sessionName) {
      return jsonResponse(400, { error: "session_name is required" });
    }
    if (!Number.isInteger(expectedTeamCount) || expectedTeamCount <= 0 || expectedTeamCount > 6) {
      return jsonResponse(400, { error: "expected_team_count must be an integer between 1 and 6" });
    }
    if (!Number.isFinite(scoringWrongDeduction) || scoringWrongDeduction < 0) {
      return jsonResponse(400, { error: "scoring_wrong_deduction must be nonnegative" });
    }

    const session = await createSession({
      session_name: sessionName,
      expected_team_count: expectedTeamCount,
      scoring_rank_points: scoringRankPointsToText(scoringRankPoints),
      scoring_wrong_deduction: scoringWrongDeduction,
      created_by: adminUser.id,
    });

    return jsonResponse(200, { session });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/hedonics/admin/create-session",
};
