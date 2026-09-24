import { ALLOCATION_METHODS } from "./_lib/permit_market.mts";
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

    const allocation1 = String(body.allocation_round1 ?? "uniform");
    const allocation2 = String(body.allocation_round2 ?? "uniform");
    for (const [label, method] of [["allocation_round1", allocation1], ["allocation_round2", allocation2]]) {
      if (!ALLOCATION_METHODS.includes(method)) {
        return jsonResponse(400, { error: `${label} must be one of ${ALLOCATION_METHODS.join(", ")}` });
      }
    }

    // Penalty per borrowed permit not covered by the end of Round 2.
    const shortfallPenalty = Number(body.shortfall_penalty ?? 50);
    if (!Number.isFinite(shortfallPenalty) || shortfallPenalty < 0 || shortfallPenalty > 999) {
      return jsonResponse(400, { error: "shortfall_penalty must be a number between 0 and 999" });
    }

    const session = await createSession({
      session_name: sessionName,
      expected_team_count: expectedTeamCount,
      cap_share_round1: capShare1,
      cap_share_round2: capShare2,
      banking_enabled: Boolean(body.banking_enabled),
      borrowing_enabled: Boolean(body.borrowing_enabled),
      shortfall_penalty: shortfallPenalty,
      allocation_round1: allocation1,
      allocation_round2: allocation2,
      shock_round1: Boolean(body.shock_round1),
      shock_round2: Boolean(body.shock_round2),
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
