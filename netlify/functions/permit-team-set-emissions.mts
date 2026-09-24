import {
  MARKET_PHASES,
  deadlinePassed,
  roundForPhase,
} from "./_lib/permit_market.mts";
import {
  getActiveSession,
  getTeamByJoinToken,
  setEmissionChoice,
} from "./_lib/permit_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

/**
 * Save a team's Round 1 emissions during the Round 1 market. Emitting less
 * than the permits it holds banks the rest (banking on); emitting more
 * borrows from Round 2 (borrowing on). Sending `emissions: null` clears the
 * choice, so the team simply uses the permits it holds.
 */
export default async function permitTeamSetEmissions(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);

    const joinToken = String(body.join_token ?? "").trim();
    if (!joinToken) {
      return jsonResponse(400, { error: "join_token is required" });
    }

    const team = await getTeamByJoinToken(joinToken);
    if (!team) {
      return jsonResponse(404, { error: "Team token not found" });
    }

    const session = await getActiveSession();
    if (!session || session.id !== team.session_id) {
      return jsonResponse(404, { error: "No active session for this team" });
    }

    const phase = String(session.current_phase ?? "");
    if (!MARKET_PHASES.has(phase) || roundForPhase(phase) !== "round1") {
      return jsonResponse(400, { error: "Emissions can be chosen only during the Round 1 market" });
    }
    if (!session.banking_enabled && !session.borrowing_enabled) {
      return jsonResponse(400, { error: "Banking and borrowing are off; emissions follow the permits you hold" });
    }
    if (deadlinePassed(session)) {
      return jsonResponse(400, { error: "The market has closed. Emissions are locked." });
    }

    const baseline = Number(team.baseline_emissions ?? 0);
    let emissions = null;
    if (body.emissions !== null && body.emissions !== undefined && body.emissions !== "") {
      emissions = Number(body.emissions);
      if (!Number.isInteger(emissions) || emissions < 0 || emissions > baseline) {
        return jsonResponse(400, { error: `Emissions must be a whole number from 0 to your baseline (${baseline})` });
      }
    }

    await setEmissionChoice(String(session.id), String(team.id), "round1", emissions);
    return jsonResponse(200, { emissions });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/permit-market/team/set-emissions",
};
