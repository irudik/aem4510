import {
  createSession,
  requireAdminUser,
} from "./_lib/permit_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function permitAdminCreateSession(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const adminUser = await requireAdminUser(req);
    const body = await readJsonBody(req);

    const sessionName = String(body.session_name ?? "").trim();
    if (!sessionName) {
      return jsonResponse(400, { error: "session_name is required" });
    }

    const expectedTeamCount = Number(body.expected_team_count);
    if (!Number.isInteger(expectedTeamCount) || expectedTeamCount < 2 || expectedTeamCount > 100) {
      return jsonResponse(400, { error: "expected_team_count must be an integer between 2 and 100" });
    }

    const capShare1 = Number(body.cap_share_round1 ?? 60);
    const capShare2 = Number(body.cap_share_round2 ?? 40);
    for (const [label, share] of [["cap_share_round1", capShare1], ["cap_share_round2", capShare2]]) {
      if (!Number.isInteger(share) || share < 1 || share > 100) {
        return jsonResponse(400, { error: `${label} must be an integer between 1 and 100 (percent of total baseline)` });
      }
    }

    const roundSeconds = Number(body.round_seconds ?? 300);
    if (!Number.isInteger(roundSeconds) || roundSeconds < 30 || roundSeconds > 3600) {
      return jsonResponse(400, { error: "round_seconds must be an integer between 30 and 3600" });
    }

    const session = await createSession({
      session_name: sessionName,
      expected_team_count: expectedTeamCount,
      cap_share_round1: capShare1,
      cap_share_round2: capShare2,
      banking_enabled: Boolean(body.banking_enabled),
      round_seconds: roundSeconds,
      created_by: adminUser.id,
    });

    return jsonResponse(200, { session });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/permit-market/admin/create-session",
};
