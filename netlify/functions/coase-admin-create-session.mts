import {
  createSession,
  requireAdminUser,
} from "./_lib/coase_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function coaseAdminCreateSession(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const adminUser = await requireAdminUser(req);
    const body = await readJsonBody(req);

    const sessionName = String(body.session_name ?? "AEM 4510 Coase Session").trim();
    const expectedPlayerCount = Number(body.expected_player_count);

    if (!sessionName) {
      return jsonResponse(400, { error: "session_name is required" });
    }
    if (!Number.isInteger(expectedPlayerCount) || expectedPlayerCount < 1) {
      return jsonResponse(400, { error: "expected_player_count must be an integer >= 1" });
    }

    const session = await createSession({
      session_name: sessionName,
      expected_player_count: expectedPlayerCount,
      created_by: adminUser.id,
    });

    return jsonResponse(200, { session });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/admin/create-session",
};
