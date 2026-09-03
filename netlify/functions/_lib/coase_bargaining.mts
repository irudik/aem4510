/**
 * Pure bargaining logic for the interactive Coase game.
 *
 * Students bargain inside the app: at most one offer is pending per pair per
 * round; a new offer supersedes the pending one, acceptance resolves the
 * round through the payoff engine, and walking away (or the round closing)
 * locks in the status quo.
 */

import {
  ROUND_PHASES,
  computeRoundOutcome,
  statusQuoEmissions,
  validateEmissions,
} from "./coase.mts";

/**
 * Validate and normalize the terms of an offer.
 * @param {string} roundKey
 * @param {{
 * offered_emissions: unknown,
 * offered_payment_noncontroller_to_controller: unknown,
 * offered_legal_fee_paid_by_a?: unknown,
 * }} terms
 */
export function validateOfferTerms(roundKey, terms) {
  const normalizedRound = String(roundKey ?? "").trim();
  if (!ROUND_PHASES.has(normalizedRound)) {
    throw new Error("Offers can only be made during round1, round2, or round3");
  }

  const emissions = validateEmissions(terms?.offered_emissions);

  const payment = Number(terms?.offered_payment_noncontroller_to_controller);
  if (!Number.isFinite(payment) || payment < 0) {
    throw new Error("Offered payment must be a nonnegative number");
  }

  let legalFeePaidByA = Number(terms?.offered_legal_fee_paid_by_a ?? 0);
  if (normalizedRound !== "round3" || payment === 0) {
    legalFeePaidByA = 0;
  }
  if (!Number.isFinite(legalFeePaidByA) || legalFeePaidByA < 0 || legalFeePaidByA > 5) {
    throw new Error("Legal fee paid by A must be between 0 and 5");
  }

  return {
    offered_emissions: emissions,
    offered_payment_noncontroller_to_controller: payment,
    offered_legal_fee_paid_by_a: legalFeePaidByA,
  };
}

/**
 * The single pending offer for a pair in a round, if any.
 * @param {Array<Record<string, unknown>>} offers
 * @param {string} pairId
 * @param {string} roundKey
 */
export function pendingOfferForPair(offers, pairId, roundKey) {
  return (offers ?? []).find((offer) => (
    String(offer.pair_id) === String(pairId)
    && String(offer.round_key) === String(roundKey)
    && String(offer.status) === "pending"
  )) ?? null;
}

/**
 * All offers for a pair in a round, oldest first.
 * @param {Array<Record<string, unknown>>} offers
 * @param {string} pairId
 * @param {string} roundKey
 */
export function offersForPairRound(offers, pairId, roundKey) {
  return (offers ?? [])
    .filter((offer) => (
      String(offer.pair_id) === String(pairId)
      && String(offer.round_key) === String(roundKey)
    ))
    .sort((left, right) => Number(left.offer_index) - Number(right.offer_index));
}

/**
 * Resolve an accepted offer into a round outcome.
 * @param {string} roundKey
 * @param {Record<string, unknown>} offer
 */
export function outcomeFromOffer(roundKey, offer) {
  return computeRoundOutcome({
    round_key: roundKey,
    emissions: Number(offer.offered_emissions),
    payment_noncontroller_to_controller: Number(offer.offered_payment_noncontroller_to_controller),
    legal_fee_paid_by_a: Number(offer.offered_legal_fee_paid_by_a ?? 0),
  });
}

/**
 * True once the round deadline has passed.
 * @param {Record<string, unknown>} session
 * @param {number} nowMs
 */
export function deadlinePassed(session, nowMs = Date.now()) {
  const deadline = session?.phase_deadline_at;
  if (!deadline) {
    return false;
  }
  const deadlineMs = Date.parse(String(deadline));
  return Number.isFinite(deadlineMs) && nowMs > deadlineMs;
}

/**
 * Cumulative payoffs by student across resolved rounds, ranked best first.
 * Admin proxy players are excluded from the board.
 * @param {Array<Record<string, unknown>>} players
 * @param {Array<Record<string, unknown>>} pairs
 * @param {Array<Record<string, unknown>>} outcomes
 */
export function leaderboardRows(players, pairs, outcomes) {
  const pairsById = new Map((pairs ?? []).map((pair) => [String(pair.id), pair]));
  const totals = new Map();

  for (const player of players ?? []) {
    if (player.is_admin_proxy) {
      continue;
    }
    totals.set(String(player.id), {
      player_id: String(player.id),
      player_name: String(player.player_name ?? ""),
      total_payoff: 0,
      round1: null,
      round2: null,
      round3: null,
      rounds_resolved: 0,
    });
  }

  for (const outcome of outcomes ?? []) {
    const pair = pairsById.get(String(outcome.pair_id));
    if (!pair) {
      continue;
    }

    const roundKey = String(outcome.round_key);
    const sides = [
      { playerId: String(pair.player_a_id), payoff: Number(outcome.player_a_payoff) },
      { playerId: String(pair.player_b_id), payoff: Number(outcome.player_b_payoff) },
    ];

    for (const side of sides) {
      const row = totals.get(side.playerId);
      if (!row || !Number.isFinite(side.payoff)) {
        continue;
      }
      row.total_payoff += side.payoff;
      row.rounds_resolved += 1;
      if (roundKey === "round1" || roundKey === "round2" || roundKey === "round3") {
        row[roundKey] = side.payoff;
      }
    }
  }

  const rows = [...totals.values()].sort((left, right) => (
    right.total_payoff - left.total_payoff
    || left.player_name.localeCompare(right.player_name)
  ));

  let rank = 0;
  let previousTotal = null;
  rows.forEach((row, index) => {
    if (previousTotal === null || row.total_payoff < previousTotal) {
      rank = index + 1;
      previousTotal = row.total_payoff;
    }
    row.rank = rank;
  });

  return rows;
}

/**
 * Class results for the debrief: per round, how many pairs dealt, where
 * emissions landed relative to the surplus-maximizing level (1 hour), and
 * average payments among deals.
 * @param {Array<Record<string, unknown>>} pairs
 * @param {Array<Record<string, unknown>>} outcomes
 */
export function roundSummaryRows(pairs, outcomes) {
  const pairCount = Array.isArray(pairs) ? pairs.length : 0;

  return ["round1", "round2", "round3"].map((roundKey) => {
    const roundOutcomes = (outcomes ?? []).filter(
      (outcome) => String(outcome.round_key) === roundKey,
    );
    const deals = roundOutcomes.filter((outcome) => !outcome.no_deal);
    const noDeals = roundOutcomes.filter((outcome) => Boolean(outcome.no_deal));
    const efficientDeals = roundOutcomes.filter(
      (outcome) => Number(outcome.agreed_emissions) === 1,
    );

    const payments = deals
      .map((outcome) => Number(outcome.payment_noncontroller_to_controller))
      .filter((payment) => Number.isFinite(payment));
    const averagePayment = payments.length > 0
      ? payments.reduce((sum, payment) => sum + payment, 0) / payments.length
      : null;

    const totalSurplus = roundOutcomes
      .map((outcome) => Number(outcome.player_a_payoff) + Number(outcome.player_b_payoff))
      .filter((surplus) => Number.isFinite(surplus))
      .reduce((sum, surplus) => sum + surplus, 0);

    return {
      round_key: roundKey,
      status_quo_emissions: statusQuoEmissions(roundKey),
      pair_count: pairCount,
      resolved_pairs: roundOutcomes.length,
      deals: deals.length,
      no_deals: noDeals.length,
      pairs_at_efficient_emissions: efficientDeals.length,
      average_payment_among_deals: averagePayment,
      total_surplus: roundOutcomes.length > 0 ? totalSurplus : null,
    };
  });
}
