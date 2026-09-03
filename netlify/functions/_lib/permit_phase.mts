/**
 * Phase transitions for the permit market game: closing an auction clears
 * it, closing a market scores the round, entering a phase wipes its data
 * and starts its countdown.
 */

import {
  AUCTION_PHASES,
  MARKET_PHASES,
  benchmarkForRound,
  clearAuction,
  roundForPhase,
  scoreTeamRound,
} from "./permit_market.mts";
import {
  clearPhaseDataForEntry,
  getAllocationsForSession,
  getBidsForSession,
  getRoundScoresForSession,
  getTeamsForSession,
  getTradesForSession,
  patchSession,
  upsertRoundScores,
  writeAuctionClearing,
} from "./permit_game_service.mts";

function capForRound(session, roundKey) {
  return roundKey === "round1"
    ? Number(session.cap_round1 ?? 0)
    : Number(session.cap_round2 ?? 0);
}

/**
 * Clear the sealed-bid auction for an auction phase being closed.
 */
export async function closeAuctionPhase(session, auctionKey) {
  const bids = (await getBidsForSession(String(session.id)))
    .filter((bid) => String(bid.round_key) === auctionKey);

  const cap = capForRound(session, roundForPhase(auctionKey));
  const clearing = clearAuction(cap, bids.map((bid) => ({
    team_id: bid.team_id,
    bid_price: bid.bid_price,
    bid_quantity: bid.bid_quantity,
    submitted_at: bid.submitted_at,
  })));

  await writeAuctionClearing(String(session.id), auctionKey, clearing);
  return clearing;
}

/**
 * Score every team's round when its market phase closes.
 */
export async function closeMarketPhase(session, marketKey) {
  const roundKey = roundForPhase(marketKey);
  const auctionKey = roundKey === "round1" ? "auction1" : "auction2";
  const sessionId = String(session.id);

  const [teams, allocations, trades, previousScores] = await Promise.all([
    getTeamsForSession(sessionId),
    getAllocationsForSession(sessionId),
    getTradesForSession(sessionId),
    getRoundScoresForSession(sessionId),
  ]);

  const roundAllocations = new Map(
    allocations
      .filter((row) => String(row.round_key) === auctionKey)
      .map((row) => [String(row.team_id), row]),
  );

  const roundTrades = trades.filter((row) => String(row.round_key) === marketKey);

  const bankedIn = new Map(
    previousScores
      .filter((row) => String(row.round_key) === "round1")
      .map((row) => [String(row.team_id), Number(row.permits_banked_out ?? 0)]),
  );

  const benchmark = benchmarkForRound(teams, capForRound(session, roundKey));
  const benchmarkByTeam = new Map(
    benchmark.per_team.map((row) => [row.team_id, row]),
  );

  const scoreRows = teams.map((team) => {
    const allocation = roundAllocations.get(String(team.id));
    const scored = scoreTeamRound(team, {
      permits_from_auction: allocation?.permits_won ?? 0,
      auction_payment: allocation?.payment ?? 0,
      permits_banked_in: (roundKey === "round2" && session.banking_enabled)
        ? (bankedIn.get(String(team.id)) ?? 0)
        : 0,
      trades: roundTrades,
      banking_enabled: Boolean(session.banking_enabled),
      is_final_round: roundKey === "round2",
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
    const totalBaseline = teams.reduce(
      (sum, team) => sum + Number(team.baseline_emissions ?? 0),
      0,
    );
    const share = targetPhase === "auction1"
      ? Number(session.cap_share_round1)
      : Number(session.cap_share_round2);
    const cap = Math.max(1, Math.round(totalBaseline * share / 100));

    if (targetPhase === "auction1") {
      body.cap_round1 = cap;
    } else {
      body.cap_round2 = cap;
    }
  }

  return patchSession(String(session.id), body);
}
