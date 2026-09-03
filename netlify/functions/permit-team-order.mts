import {
  MARKET_PHASES,
  deadlinePassed,
  freeHoldings,
  matchIncomingOrder,
  roundForPhase,
} from "./_lib/permit_market.mts";
import {
  getActiveSession,
  getAllocationsForSession,
  getOrdersForSession,
  getRoundScoresForSession,
  getTeamByJoinToken,
  getTradesForSession,
  insertOrder,
  insertTrades,
  patchOrderRemaining,
} from "./_lib/permit_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

const MAX_ORDER_QUANTITY = 25;
const MAX_ORDER_PRICE = 999;

export default async function permitTeamOrder(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);

    const joinToken = String(body.join_token ?? "").trim();
    if (!joinToken) {
      return jsonResponse(400, { error: "join_token is required" });
    }

    const side = String(body.side ?? "").trim();
    if (side !== "bid" && side !== "ask") {
      return jsonResponse(400, { error: "side must be bid or ask" });
    }

    const price = Math.round(Number(body.price) * 100) / 100;
    const quantity = Number(body.quantity);
    if (!Number.isFinite(price) || price < 0 || price > MAX_ORDER_PRICE) {
      return jsonResponse(400, { error: `price must be between 0 and ${MAX_ORDER_PRICE}` });
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_ORDER_QUANTITY) {
      return jsonResponse(400, { error: `quantity must be an integer between 1 and ${MAX_ORDER_QUANTITY}` });
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
      return jsonResponse(400, { error: "The market has closed. No new orders." });
    }

    const sessionId = String(session.id);
    const roundKey = roundForPhase(phase);
    const auctionKey = roundKey === "round1" ? "auction1" : "auction2";

    const [orders, trades, allocations, scores] = await Promise.all([
      getOrdersForSession(sessionId),
      getTradesForSession(sessionId),
      getAllocationsForSession(sessionId),
      getRoundScoresForSession(sessionId),
    ]);

    const marketOrders = orders.filter((row) => String(row.round_key) === phase);
    const marketTrades = trades.filter((row) => String(row.round_key) === phase);

    const allocation = allocations.find((row) => (
      String(row.round_key) === auctionKey && String(row.team_id) === String(team.id)
    ));

    const bankedIn = (roundKey === "round2" && session.banking_enabled)
      ? Number(scores.find((row) => (
        String(row.round_key) === "round1" && String(row.team_id) === String(team.id)
      ))?.permits_banked_out ?? 0)
      : 0;

    // Sellers cannot promise more permits than they hold and have not
    // already offered.
    if (side === "ask") {
      const sellable = freeHoldings(
        String(team.id),
        allocation?.permits_won ?? 0,
        bankedIn,
        marketTrades,
        marketOrders.filter((row) => String(row.status) === "open"),
      );
      if (quantity > sellable) {
        return jsonResponse(400, {
          error: `You can offer at most ${Math.max(0, sellable)} permit(s): you hold none beyond your open asks.`,
        });
      }
    }

    const newOrder = await insertOrder({
      session_id: sessionId,
      round_key: phase,
      team_id: String(team.id),
      side,
      price,
      quantity,
      remaining_quantity: quantity,
      status: "open",
    });

    const openBook = marketOrders.filter((row) => String(row.status) === "open");
    const matching = matchIncomingOrder(
      { team_id: String(team.id), side, price, quantity },
      openBook,
    );

    // Apply resting-order fills with a guard on the previous remaining
    // quantity; if another order got there first, keep the fills that
    // succeeded and leave the rest of this order in the book.
    const executedTrades = [];
    let filledQuantity = 0;
    for (let index = 0; index < matching.resting_updates.length; index += 1) {
      const update = matching.resting_updates[index];
      const applied = await patchOrderRemaining(
        update.id,
        update.previous_remaining,
        update.remaining_quantity,
        update.status,
      );
      if (!applied) {
        break;
      }
      const trade = matching.trades[index];
      executedTrades.push({
        ...trade,
        buy_order_id: trade.buy_order_id ?? String(newOrder.id),
        sell_order_id: trade.sell_order_id ?? String(newOrder.id),
      });
      filledQuantity += Number(trade.quantity);
    }

    await insertTrades(sessionId, phase, executedTrades);

    const remaining = quantity - filledQuantity;
    await patchOrderRemaining(
      String(newOrder.id),
      quantity,
      remaining,
      remaining === 0 ? "filled" : "open",
    );

    return jsonResponse(200, {
      order_id: newOrder.id,
      filled_quantity: filledQuantity,
      remaining_quantity: remaining,
      trades: executedTrades.map((trade) => ({
        price: trade.price,
        quantity: trade.quantity,
      })),
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/permit-market/team/order",
};
