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
  carryIntoRound2,
  clearAuction,
  effectiveSlope,
  freeAllocation,
  roundForPhase,
  scoreTeamRound,
  shockFactor,
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
  const auctionKey = roundKey === "round1" ? "auction1" : "auction2";
  const sessionId = String(session.id);

  const [teams, allocations, trades, previousScores, emissionChoices] = await Promise.all([
    getTeamsForSession(sessionId),
    getAllocationsForSession(sessionId),
    getTradesForSession(sessionId),
    getRoundScoresForSession(sessionId),
    getEmissionChoicesForSession(sessionId),
  ]);

  const roundAllocations = new Map(
    allocations
      .filter((row) => String(row.round_key) === auctionKey)
      .map((row) => [String(row.team_id), row]),
  );

  const roundTrades = trades.filter((row) => String(row.round_key) === marketKey);

  const round1Scores = new Map(
    previousScores
      .filter((row) => String(row.round_key) === "round1")
      .map((row) => [String(row.team_id), row]),
  );
  const choices = new Map(
    emissionChoices
      .filter((row) => String(row.round_key) === roundKey)
      .map((row) => [String(row.team_id), Number(row.emissions)]),
  );

  // The benchmark uses realized (post-shock) MACs. When permits were given
  // away, firms reach the efficient allocation by trading from their
  // endowments rather than buying everything.
  const endowments = allocationMethodForRound(session, roundKey) === "free"
    ? new Map([...roundAllocations.entries()].map(([teamId, row]) => [teamId, Number(row.permits_won ?? 0)]))
    : new Map();
  const benchmark = benchmarkForRound(teams, capForRound(session, roundKey), {
    slopeFor: (team) => effectiveSlope(team, roundKey),
    endowments,
  });
  const benchmarkByTeam = new Map(
    benchmark.per_team.map((row) => [row.team_id, row]),
  );

  const scoreRows = teams.map((team) => {
    const allocation = roundAllocations.get(String(team.id));
    const carry = roundKey === "round2"
      ? carryIntoRound2(session, round1Scores.get(String(team.id)))
      : { banked: 0, owed: 0 };
    const scored = scoreTeamRound(team, {
      permits_from_auction: allocation?.permits_won ?? 0,
      auction_payment: allocation?.payment ?? 0,
      permits_banked_in: carry.banked,
      permits_owed_in: carry.owed,
      trades: roundTrades,
      banking_enabled: Boolean(session.banking_enabled),
      borrowing_enabled: Boolean(session.borrowing_enabled),
      emissions_choice: choices.get(String(team.id)) ?? null,
      is_final_round: roundKey === "round2",
      shortfall_penalty_per_permit: Number(session.shortfall_penalty ?? 0),
      mac_shock: shockFactor(team, roundKey),
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
