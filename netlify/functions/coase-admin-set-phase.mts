import {
  VALID_PHASES,
  clearRoundData,
  getActiveSession,
  isRoundPhase,
  requireAdminUser,
} from "./_lib/coase_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

export default async function coaseAdminSetPhase(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const body = await readJsonBody(req);

    const phase = String(body.phase ?? "").trim();
    if (!VALID_PHASES.has(phase)) {
      return jsonResponse(400, { error: "phase must be one of setup, round1, round2, round3, complete" });
    }

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(404, { error: "No active session exists. Create one first." });
    }

    if (isRoundPhase(phase)) {
      await clearRoundData(String(session.id), phase);
    }

    const updatedRows = await supabaseRequest("/rest/v1/coase_sessions", {
      method: "PATCH",
      queryParams: {
        id: `eq.${session.id}`,
        select: "*",
      },
      body: {
        current_phase: phase,
      },
      prefer: "return=representation",
      useServiceRole: true,
    });

    return jsonResponse(200, { session: updatedRows[0] });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/admin/set-phase",
};
