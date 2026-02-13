import { createSession, requireAdminUser } from "./_lib/game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function emissionsAdminCreateSession(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const adminUser = await requireAdminUser(req);
    const body = await readJsonBody(req);

    const sessionName = String(body.session_name ?? "AEM 4510 Emissions Trading Session").trim();
    const expectedTeamCount = Number(body.expected_team_count);
    const commonPermitAllocation = Number(body.common_permit_allocation);

    if (!sessionName) {
      return jsonResponse(400, { error: "session_name is required" });
    }
    if (!Number.isInteger(expectedTeamCount) || expectedTeamCount <= 0) {
      return jsonResponse(400, { error: "expected_team_count must be a positive integer" });
    }
    if (!Number.isFinite(commonPermitAllocation) || commonPermitAllocation < 0) {
      return jsonResponse(400, { error: "common_permit_allocation must be nonnegative" });
    }

    const session = await createSession({
      session_name: sessionName,
      expected_team_count: expectedTeamCount,
      common_permit_allocation: commonPermitAllocation,
      created_by: adminUser.id,
    });

    return jsonResponse(200, { session });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/emissions-trading/admin/create-session",
};
