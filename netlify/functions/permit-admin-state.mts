import {
  AUCTION_PHASES,
  benchmarkForRound,
  bookLevels,
  clearAuction,
  leaderboardRows,
} from "./_lib/permit_market.mts";
import {
  getActiveSession,
  getAllocationsForSession,
  getAuctionResultsForSession,
  getBidsForSession,
  getOrdersForSession,
  getRoundScoresForSession,
  getTeamsForSession,
  getTradesForSession,
  requireAdminUser,
} from "./_lib/permit_game_service.mts";
import { jsonResponse } from "./_lib/http.mts";

export default async function permitAdminState(req) {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(200, {
        session: null,
        teams: [],
        bids: [],
        orders: [],
        trades: [],
        scores: [],
      });
    }

    const sessionId = String(session.id);
    const [teams, bids, results, allocations, orders, trades, scores] = await Promise.all([
      getTeamsForSession(sessionId),
      getBidsForSession(sessionId),
      getAuctionResultsForSession(sessionId),
      getAllocationsForSession(sessionId),
      getOrdersForSession(sessionId),
      getTradesForSession(sessionId),
      getRoundScoresForSession(sessionId),
    ]);

    // Chart data per auction: the (live or final) bid stack against the
    // cap, plus the true aggregate demand and its benchmark price.
    const firmsAssigned = teams.some((team) => team.baseline_emissions);
    const auctionCharts = {};
    for (const auctionKey of ["auction1", "auction2"]) {
      const cap = auctionKey === "auction1"
        ? Number(session.cap_round1 ?? 0)
        : Number(session.cap_round2 ?? 0);
      if (!cap || !firmsAssigned) {
        continue;
      }

      const auctionBids = bids.filter((row) => String(row.round_key) === auctionKey);
      const isLive = String(session.current_phase) === auctionKey;
      const result = results.find((row) => String(row.round_key) === auctionKey);
      if (!isLive && !result && auctionBids.length === 0) {
        continue;
      }

      const clearing = clearAuction(cap, auctionBids.map((row) => ({
        team_id: row.team_id,
        bid_price: row.bid_price,
        bid_quantity: row.bid_quantity,
        submitted_at: row.submitted_at,
      })));
      const benchmark = benchmarkForRound(teams, cap);

      auctionCharts[auctionKey] = {
        cap,
        is_live: isLive,
        clearing_price: result ? result.clearing_price : clearing.clearing_price,
        total_bid_quantity: clearing.total_bid_quantity,
        bid_stack: clearing.bid_stack,
        true_demand_stack: benchmark.true_demand_stack,
        benchmark_price: benchmark.benchmark_price,
      };
    }

    const phase = String(session.current_phase ?? "");
    const openOrders = orders.filter(
      (row) => String(row.round_key) === phase && String(row.status) === "open",
    );

    return jsonResponse(200, {
      session,
      server_now: new Date().toISOString(),
      teams,
      bids,
      auction_results: results,
      allocations,
      orders,
      open_book: bookLevels(openOrders),
      trades,
      scores,
      leaderboard: leaderboardRows(teams, scores),
      auction_charts: auctionCharts,
      bids_in_current_auction: AUCTION_PHASES.has(phase)
        ? new Set(
          bids
            .filter((row) => String(row.round_key) === phase)
            .map((row) => String(row.team_id)),
        ).size
        : null,
    });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/permit-market/admin/state",
};
