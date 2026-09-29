/**
 * Phase transitions for the permit market game: closing an auction clears
 * it, closing a market scores the round, entering a phase wipes its data
 * and starts its countdown.
 */

import {
  AUCTION_PHASES,
  MARKET_PHASES,
  allocationMethodForRound,
  benchmarkForRound,
  clearAuction,
  freeAllocation,
  roundForPhase,
  resolveRoundCap,
  scoreTeamRound,
} from "./permit_market.mts";
import {
  clearPhaseDataForEntry,
  getAuctionResultsForSession,
  getAllocationsForSession,
  getBidsForSession,
  getEmissionChoicesForSession,
  getRoundScoresForSession,
  getTeamsForSession,
  getTradesForSession,
  patchSession,
  upsertRoundScores,
  writeAuctionClearing,
} from "./permit_game_service.mts";
import { phaseIsClosed } from "./permit_closed.mts";
import { marketStartForTeam } from "./permit_round_start.mts";

function capForRound(session, roundKey) {
  return roundKey === "round1"
    ? Number(session.cap_round1 ?? 0)
    : Number(session.cap_round2 ?? 0);
}

/**
 * Allocate a round's permits when its auction phase closes: clear the
 * sealed-bid auction (uniform or pay-as-bid pricing), or hand permits out
 * free in proportion to baseline emissions.
 */
export async function closeAuctionPhase(session, auctionKey) {
  const roundKey = roundForPhase(auctionKey);
  const cap = capForRound(session, roundKey);
  const method = allocationMethodForRound(session, roundKey);

  if (method === "free") {
    const teams = await getTeamsForSession(String(session.id));
    const clearing = {
      cap,
      clearing_price: null,
      total_bid_quantity: 0,
      allocations: freeAllocation(teams, cap),
    };
    await writeAuctionClearing(String(session.id), auctionKey, clearing);
    return clearing;
  }

  const bids = (await getBidsForSession(String(session.id)))
    .filter((bid) => String(bid.round_key) === auctionKey);

  const clearing = clearAuction(cap, bids.map((bid) => ({
    team_id: bid.team_id,
    bid_price: bid.bid_price,
    bid_quantity: bid.bid_quantity,
    submitted_at: bid.submitted_at,
  })), { pricing: method });

  await writeAuctionClearing(String(session.id), auctionKey, clearing);
  return clearing;
}

/**
 * Score every team's round when its market phase closes.
 */
export async function closeMarketPhase(session, marketKey) {
  const roundKey = roundForPhase(marketKey);
  const sessionId = String(session.id);

  const [teams, allocations, trades, previousScores, emissionChoices] = await Promise.all([
    getTeamsForSession(sessionId),
    getAllocationsForSession(sessionId),
    getTradesForSession(sessionId),
    getRoundScoresForSession(sessionId),
    getEmissionChoicesForSession(sessionId),
  ]);

  const roundTrades = trades.filter((row) => String(row.round_key) === marketKey);

  const starts = new Map(teams.map(team => [String(team.id),
    marketStartForTeam(session, team, roundKey, allocations, previousScores)]));
  const choices = new Map(
    emissionChoices
      .filter((row) => String(row.round_key) === roundKey)
      .map((row) => [String(row.team_id), Number(row.emissions)]),
  );

  // The benchmark uses realized (post-shock) MACs. When permits were given
  // away, firms reach the efficient allocation by trading from their
  // endowments rather than buying everything.
  const endowments = allocationMethodForRound(session, roundKey) === "free"
    ? new Map([...starts.entries()].map(([teamId, start]) => [teamId, start.allocation]))
    : new Map();
  const benchmark = benchmarkForRound(teams, capForRound(session, roundKey), {
    slopeFor: team => Number(team.mac_slope) * starts.get(String(team.id)).shock,
    interceptFor: team => starts.get(String(team.id)).intercept,
    endowments,
  });
  const benchmarkByTeam = new Map(
    benchmark.per_team.map((row) => [row.team_id, row]),
  );

  const scoreRows = teams.map((team) => {
    const start = starts.get(String(team.id));
    const scored = scoreTeamRound(team, {
      permits_from_auction: start.allocation,
      auction_payment: start.auctionPayment,
      permits_banked_in: start.banked,
      permits_owed_in: start.owed,
      trades: roundTrades,
      banking_enabled: roundKey !== "round3" && Boolean(session.banking_enabled),
      borrowing_enabled: roundKey !== "round3" && Boolean(session.borrowing_enabled),
      emissions_choice: roundKey === "round3" ? null : choices.get(String(team.id)) ?? null,
      is_final_round: roundKey !== "round1",
      shortfall_penalty_per_permit: Number(session.shortfall_penalty ?? 0),
      mac_shock: start.shock,
      mac_intercept: start.intercept,
    });

    const teamBenchmark = benchmarkByTeam.get(String(team.id));

    return {
      ...scored,
      benchmark_price: benchmark.benchmark_price,
      benchmark_permits: teamBenchmark?.benchmark_permits ?? 0,
      benchmark_score: teamBenchmark?.benchmark_score ?? 0,
    };
  });

  await upsertRoundScores(sessionId, roundKey, scoreRows);
  return scoreRows;
}

/**
 * Close the phase being left when moving forward through the game.
 */
export async function closePhaseForward(session, currentPhase) {
  const [teams, results, scores] = await Promise.all([
    getTeamsForSession(String(session.id)),
    getAuctionResultsForSession(String(session.id)),
    getRoundScoresForSession(String(session.id)),
  ]);
  if (phaseIsClosed(currentPhase, teams, results, scores)) return;
  if (AUCTION_PHASES.has(currentPhase)) {
    await closeAuctionPhase(session, currentPhase);
  }
  if (MARKET_PHASES.has(currentPhase)) {
    await closeMarketPhase(session, currentPhase);
  }
}

/**
 * Enter a phase: wipe its data for a clean (re)start, resolve the cap when
 * an auction opens, and start the countdown.
 */
export async function enterPhase(session, targetPhase, roundSeconds) {
  if (targetPhase === "market3") {
    const [teams, scores] = await Promise.all([
      getTeamsForSession(String(session.id)), getRoundScoresForSession(String(session.id)),
    ]);
    if (!phaseIsClosed("market2", teams, [], scores)) {
      throw new Error("Round 3 requires completed Round 2 results for every team.");
    }
  }
  await clearPhaseDataForEntry(String(session.id), targetPhase);

  const isTimedPhase = AUCTION_PHASES.has(targetPhase) || MARKET_PHASES.has(targetPhase);
  const body = {
    current_phase: targetPhase,
    round_seconds: roundSeconds,
    phase_deadline_at: isTimedPhase
      ? new Date(Date.now() + roundSeconds * 1000).toISOString()
      : null,
  };

  if (AUCTION_PHASES.has(targetPhase)) {
    const teams = await getTeamsForSession(String(session.id));
    const cap = resolveRoundCap(teams, session, roundForPhase(targetPhase));

    if (targetPhase === "auction1") {
      body.cap_round1 = cap;
    } else {
      body.cap_round2 = cap;
    }
  }

  return patchSession(String(session.id), body);
}
