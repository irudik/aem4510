import {
  PHASE_ORDER,
  VALID_PHASES,
} from "./_lib/permit_market.mts";
import {
  closePhaseForward,
  enterPhase,
} from "./_lib/permit_phase.mts";
import {
  getActiveSession,
  requireAdminUser,
} from "./_lib/permit_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function permitAdminSetPhase(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const body = await readJsonBody(req);

    const phase = String(body.phase ?? "").trim();
    if (!VALID_PHASES.has(phase)) {
      return jsonResponse(400, {
        error: "phase must be one of setup, auction1, market1, auction2, market2, complete",
      });
    }

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(404, { error: "No active session exists. Create one first." });
    }

    let roundSeconds = Number(session.round_seconds ?? 300);
    if (body.round_seconds !== undefined && body.round_seconds !== null && body.round_seconds !== "") {
      roundSeconds = Number(body.round_seconds);
      if (!Number.isInteger(roundSeconds) || roundSeconds < 30 || roundSeconds > 3600) {
        return jsonResponse(400, { error: "round_seconds must be an integer between 30 and 3600" });
      }
    }

    const currentPhase = String(session.current_phase ?? "setup");
    const movingForward = PHASE_ORDER.indexOf(phase) > PHASE_ORDER.indexOf(currentPhase);

    // Moving forward closes the phase being left: an auction clears, a
    // market scores its round. Rewinding replays without closing anything.
    if (movingForward && currentPhase !== phase) {
      await closePhaseForward(session, currentPhase);
    }

    const updatedSession = await enterPhase(session, phase, roundSeconds);

    return jsonResponse(200, { session: updatedSession });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/permit-market/admin/set-phase",
};
