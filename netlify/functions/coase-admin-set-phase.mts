import {
  VALID_PHASES,
  clearRoundData,
  finalizeUnresolvedPairsForRound,
  getActiveSession,
  isRoundPhase,
  requireAdminUser,
} from "./_lib/coase_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

// Phase progression order, used to tell forward moves (close the old round
// at the status quo) from rewinds (replay a round, no finalization).
const PHASE_ORDER = ["setup", "round1", "round2", "round3", "complete"];

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

    let roundSeconds = Number(session.round_seconds ?? 300);
    if (body.round_seconds !== undefined && body.round_seconds !== null && body.round_seconds !== "") {
      roundSeconds = Number(body.round_seconds);
      if (!Number.isInteger(roundSeconds) || roundSeconds < 30 || roundSeconds > 3600) {
        return jsonResponse(400, { error: "round_seconds must be an integer between 30 and 3600" });
      }
    }

    const currentPhase = String(session.current_phase ?? "setup");
    const movingForward = PHASE_ORDER.indexOf(phase) > PHASE_ORDER.indexOf(currentPhase);

    // Closing a round that is still being bargained locks in the status quo
    // for unresolved pairs: no deal, controller keeps preferred hours.
    let finalizedPairs = 0;
    if (movingForward && isRoundPhase(currentPhase) && currentPhase !== phase) {
      finalizedPairs = await finalizeUnresolvedPairsForRound(String(session.id), currentPhase);
    }

    if (isRoundPhase(phase)) {
      await clearRoundData(String(session.id), phase);
    }

    const phaseDeadlineAt = isRoundPhase(phase)
      ? new Date(Date.now() + roundSeconds * 1000).toISOString()
      : null;

    const updatedRows = await supabaseRequest("/rest/v1/coase_sessions", {
      method: "PATCH",
      queryParams: {
        id: `eq.${session.id}`,
        select: "*",
      },
      body: {
        current_phase: phase,
        round_seconds: roundSeconds,
        phase_deadline_at: phaseDeadlineAt,
      },
      prefer: "return=representation",
      useServiceRole: true,
    });

    return jsonResponse(200, {
      session: updatedRows[0],
      finalized_pairs: finalizedPairs,
    });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/admin/set-phase",
};
