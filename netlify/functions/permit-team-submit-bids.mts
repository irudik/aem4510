import {
  AUCTION_PHASES,
  allocationMethodForRound,
  bidQuantityLimit,
  deadlinePassed,
  roundForPhase,
  validateBidSet,
} from "./_lib/permit_market.mts";
import {
  getActiveSession,
  getTeamByJoinToken,
  replaceTeamBids,
} from "./_lib/permit_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function permitTeamSubmitBids(req) {
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
    if (!AUCTION_PHASES.has(phase)) {
      return jsonResponse(400, { error: "The auction is not open right now" });
    }

    if (deadlinePassed(session)) {
      return jsonResponse(400, { error: "The auction has closed. Bids are locked." });
    }

    if (!team.baseline_emissions) {
      return jsonResponse(400, { error: "Your firm type is not assigned yet. Wait for the game to start." });
    }

    if (allocationMethodForRound(session, roundForPhase(phase)) === "free") {
      return jsonResponse(400, { error: "Permits are given away free this round; there is nothing to bid on." });
    }

    const cap = phase === "auction1" ? session.cap_round1 : session.cap_round2;
    const bidSet = validateBidSet(team, body.bids, {
      maxQuantity: bidQuantityLimit(session, team, cap),
    });
    await replaceTeamBids(String(session.id), String(team.id), phase, bidSet);

    return jsonResponse(200, {
      submitted: true,
      bids: bidSet,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/permit-market/team/submit-bids",
};
