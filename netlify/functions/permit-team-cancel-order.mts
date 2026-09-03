import {
  MARKET_PHASES,
  deadlinePassed,
} from "./_lib/permit_market.mts";
import {
  cancelOrder,
  getActiveSession,
  getTeamByJoinToken,
} from "./_lib/permit_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function permitTeamCancelOrder(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);

    const joinToken = String(body.join_token ?? "").trim();
    const orderId = String(body.order_id ?? "").trim();
    if (!joinToken || !orderId) {
      return jsonResponse(400, { error: "join_token and order_id are required" });
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
    if (!MARKET_PHASES.has(phase)) {
      return jsonResponse(400, { error: "The market is not open right now" });
    }

    if (deadlinePassed(session)) {
      return jsonResponse(400, { error: "The market has closed." });
    }

    const cancelled = await cancelOrder(String(session.id), String(team.id), orderId);

    return jsonResponse(200, { cancelled: true, order: cancelled });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/permit-market/team/cancel-order",
};
