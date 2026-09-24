import {
  AUCTION_PHASES,
  MARKET_PHASES,
  allocationMethodForRound,
  bidQuantityLimit,
  bookLevels,
  carryIntoRound2,
  effectiveSlope,
  freeAllocation,
  freeHoldings,
  holdingsForTeam,
  leaderboardRows,
  roundForPhase,
  scoreTeamRound,
  shockFactor,
  shockRevealed,
  studentAuctionReport,
  valueSchedule,
} from "./_lib/permit_market.mts";
import {
  getActiveSession,
  getAllocationsForSession,
  getAuctionResultsForSession,
  getBidsForSession,
  getEmissionChoicesForSession,
  getOrdersForSession,
  getRoundScoresForSession,
  getTeamByJoinToken,
  getTeamsForSession,
  getTradesForSession,
} from "./_lib/permit_game_service.mts";
import { jsonResponse } from "./_lib/http.mts";

export default async function permitTeamState(req) {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const url = new URL(req.url);
    const joinToken = String(url.searchParams.get("join_token") ?? "").trim();

    if (!joinToken) {
      return jsonResponse(400, { error: "join_token is required" });
    }

    const team = await getTeamByJoinToken(joinToken);
    if (!team) {
      return jsonResponse(404, { error: "Team token not found" });
    }

    const session = await getActiveSession();
    if (!session || session.id !== team.session_id) {
      return jsonResponse(404, { error: "Session is no longer active for this team" });
    }

    const sessionId = String(session.id);
    const teamId = String(team.id);
    const phase = String(session.current_phase ?? "");
    const roundKey = roundForPhase(phase);
    const auctionKey = roundKey === "round2" ? "auction2" : "auction1";
    // The round whose MAC the firm card shows; at the end, Round 2.
    const displayRound = phase === "complete" ? "round2" : roundKey;

    const [teams, bids, results, allocations, orders, trades, scores, emissionChoices] = await Promise.all([
      getTeamsForSession(sessionId),
      getBidsForSession(sessionId),
      getAuctionResultsForSession(sessionId),
      getAllocationsForSession(sessionId),
      getOrdersForSession(sessionId),
      getTradesForSession(sessionId),
      getRoundScoresForSession(sessionId),
      getEmissionChoicesForSession(sessionId),
    ]);

    const allocationMethod = roundKey ? allocationMethodForRound(session, roundKey) : null;
    const currentCap = roundKey === "round2" ? session.cap_round2 : session.cap_round1;

    const ownBids = AUCTION_PHASES.has(phase)
      ? bids
        .filter((row) => (
          String(row.team_id) === teamId && String(row.round_key) === phase
        ))
        .sort((left, right) => Number(left.bid_index) - Number(right.bid_index))
        .map((row) => ({
          bid_index: row.bid_index,
          bid_price: row.bid_price,
          bid_quantity: row.bid_quantity,
        }))
      : [];

    const currentResult = roundKey
      ? results.find((row) => String(row.round_key) === auctionKey) ?? null
      : null;

    const ownAllocation = roundKey
      ? allocations.find((row) => (
        String(row.round_key) === auctionKey && String(row.team_id) === teamId
      )) ?? null
      : null;

    // Round 2 starts from banked permits minus permits owed from Round 1.
    const carry = roundKey === "round2"
      ? carryIntoRound2(session, scores.find((row) => (
        String(row.round_key) === "round1" && String(row.team_id) === teamId
      )))
      : { banked: 0, owed: 0, net: 0 };

    // Cost shocks stay hidden until the round's market opens.
    const revealedShock = (key) => (shockRevealed(session, key, phase) ? shockFactor(team, key) : null);
    const shocks = { round1: revealedShock("round1"), round2: revealedShock("round2") };
    const displaySlope = displayRound && shocks[displayRound] !== null
      ? effectiveSlope(team, displayRound)
      : Number(team.mac_slope ?? 0);

    // During a free-allocation round, each team sees its permits right away.
    const freeAllocationPreview = (AUCTION_PHASES.has(phase) && allocationMethod === "free"
      && team.baseline_emissions && currentCap)
      ? freeAllocation(teams, Number(currentCap)).find((row) => row.team_id === teamId)?.permits_won ?? 0
      : null;

    // For every auction that has cleared, show the team how the price was
    // set: the class's bids as a demand curve (prices and quantities, no team
    // names) against the permits for sale, with its own bids marked. Free
    // rounds have no bids to show.
    const auctionReports = {};
    for (const clearedKey of ["auction1", "auction2"]) {
      const result = results.find((row) => String(row.round_key) === clearedKey);
      const method = allocationMethodForRound(session, roundForPhase(clearedKey));
      auctionReports[clearedKey] = (result && phase !== clearedKey && method !== "free")
        ? studentAuctionReport(
          Number(result.cap),
          bids
            .filter((row) => String(row.round_key) === clearedKey)
            .map((row) => ({
              team_id: row.team_id,
              bid_price: row.bid_price,
              bid_quantity: row.bid_quantity,
              submitted_at: row.submitted_at,
            })),
          teamId,
          { pricing: method },
        )
        : null;
    }

    let market = null;
    if (MARKET_PHASES.has(phase)) {
      const marketOrders = orders.filter((row) => String(row.round_key) === phase);
      const openOrders = marketOrders.filter((row) => String(row.status) === "open");
      const marketTrades = trades.filter((row) => String(row.round_key) === phase);
      const choice = roundKey === "round1"
        ? emissionChoices.find((row) => (
          String(row.team_id) === teamId && String(row.round_key) === "round1"
        ))?.emissions ?? null
        : null;

      const holdings = holdingsForTeam(
        teamId,
        ownAllocation?.permits_won ?? 0,
        carry.net,
        marketTrades,
      );

      // Live score preview: what this round pays if the market closed now.
      const preview = team.baseline_emissions
        ? scoreTeamRound(team, {
          permits_from_auction: ownAllocation?.permits_won ?? 0,
          auction_payment: ownAllocation?.payment ?? 0,
          permits_banked_in: carry.banked,
          permits_owed_in: carry.owed,
          trades: marketTrades,
          banking_enabled: Boolean(session.banking_enabled),
          borrowing_enabled: Boolean(session.borrowing_enabled),
          emissions_choice: choice,
          is_final_round: roundKey === "round2",
          shortfall_penalty_per_permit: Number(session.shortfall_penalty ?? 0),
          mac_shock: shockFactor(team, roundKey),
        })
        : null;

      market = {
        book: bookLevels(openOrders),
        own_open_orders: openOrders
          .filter((row) => String(row.team_id) === teamId)
          .map((row) => ({
            id: row.id,
            side: row.side,
            price: row.price,
            quantity: row.quantity,
            remaining_quantity: row.remaining_quantity,
            created_at: row.created_at,
          })),
        recent_trades: marketTrades
          .slice(-15)
          .reverse()
          .map((row) => ({
            price: row.price,
            quantity: row.quantity,
            executed_at: row.executed_at,
            you_bought: String(row.buyer_team_id) === teamId,
            you_sold: String(row.seller_team_id) === teamId,
          })),
        holdings,
        sellable: freeHoldings(
          teamId,
          ownAllocation?.permits_won ?? 0,
          carry.net,
          marketTrades,
          openOrders,
        ),
        emissions_choice: choice,
        score_preview: preview,
      };
    }

    const ownScores = scores
      .filter((row) => String(row.team_id) === teamId)
      .sort((left, right) => String(left.round_key).localeCompare(String(right.round_key)))
      .map((row) => ({
        round_key: row.round_key,
        permits_from_auction: row.permits_from_auction,
        auction_payment: row.auction_payment,
        permits_banked_in: row.permits_banked_in,
        permits_owed_in: row.permits_owed_in,
        market_buys: row.market_buys,
        market_sells: row.market_sells,
        market_net_spend: row.market_net_spend,
        permits_end: row.permits_end,
        emissions: row.emissions,
        abatement: row.abatement,
        abatement_cost: row.abatement_cost,
        permits_banked_out: row.permits_banked_out,
        permits_borrowed_out: row.permits_borrowed_out,
        shortfall: row.shortfall,
        shortfall_penalty: row.shortfall_penalty,
        mac_shock: row.mac_shock,
        score: row.score,
        benchmark_price: row.benchmark_price,
        benchmark_score: row.benchmark_score,
      }));

    return jsonResponse(200, {
      session: {
        id: session.id,
        session_name: session.session_name,
        current_phase: session.current_phase,
        has_started: session.has_started,
        round_seconds: session.round_seconds ?? null,
        phase_deadline_at: session.phase_deadline_at ?? null,
        cap_round1: session.cap_round1 ?? null,
        cap_round2: session.cap_round2 ?? null,
        banking_enabled: Boolean(session.banking_enabled),
        borrowing_enabled: Boolean(session.borrowing_enabled),
        shortfall_penalty: Number(session.shortfall_penalty ?? 0),
        allocation_round1: allocationMethodForRound(session, "round1"),
        allocation_round2: allocationMethodForRound(session, "round2"),
        shock_round1: Boolean(session.shock_round1),
        shock_round2: Boolean(session.shock_round2),
      },
      server_now: new Date().toISOString(),
      team: {
        id: team.id,
        team_name: team.team_name,
        baseline_emissions: team.baseline_emissions ?? null,
        mac_slope: team.mac_slope ?? null,
        display_mac_slope: team.mac_slope ? displaySlope : null,
        shocks,
        value_schedule: team.baseline_emissions
          ? valueSchedule(Number(team.baseline_emissions), Number(team.mac_slope))
          : [],
      },
      allocation_method: allocationMethod,
      bid_quantity_limit: AUCTION_PHASES.has(phase) && team.baseline_emissions
        ? bidQuantityLimit(session, team, currentCap)
        : null,
      free_allocation: freeAllocationPreview,
      own_bids: ownBids,
      auction_result: currentResult
        ? {
          round_key: currentResult.round_key,
          cap: currentResult.cap,
          clearing_price: currentResult.clearing_price,
          total_bid_quantity: currentResult.total_bid_quantity,
        }
        : null,
      own_allocation: ownAllocation
        ? {
          permits_won: ownAllocation.permits_won,
          payment: ownAllocation.payment,
        }
        : null,
      auction_reports: auctionReports,
      permits_banked_in: carry.banked,
      permits_owed_in: carry.owed,
      market,
      own_scores: ownScores,
      leaderboard: leaderboardRows(teams, scores),
      joined_team_count: teams.length,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/permit-market/team/state",
};
