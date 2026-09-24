import { AUCTION_PHASES, MARKET_PHASES } from "./_lib/permit_market.mts";
import { closePhaseForward } from "./_lib/permit_phase.mts";
import { getActiveSession, patchSession, requireAdminUser } from "./_lib/permit_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

/** Finalize the current phase without opening the next round of decisions. */
export default async function permitAdminClosePhase(req) {
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  try {
    await requireAdminUser(req);
    const body = await readJsonBody(req);
    const session = await getActiveSession();
    if (!session) return jsonResponse(404, { error: "No active session" });
    const phase = String(session.current_phase);
    if (body.phase !== phase) {
      return jsonResponse(409, { error: "The phase changed. Refresh before closing it." });
    }
    if (!AUCTION_PHASES.has(phase) && !MARKET_PHASES.has(phase)) {
      return jsonResponse(400, { error: "Only an auction or market phase can be closed." });
    }
    // Stop new submissions before calculating allocations or round scores.
    const updated = await patchSession(String(session.id), {
      phase_deadline_at: new Date(Date.now() - 1000).toISOString(),
    });
    await closePhaseForward(updated, phase);
    return jsonResponse(200, { session: updated });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = { path: "/api/permit-market/admin/close-phase" };
