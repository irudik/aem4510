import {
  PAYOFF_TABLE,
  VALID_PHASES,
  isRoundPhase,
  randomPairing,
  roundContext,
  statusQuoOutcome,
} from "./coase.mts";
import { pendingOfferForPair } from "./coase_bargaining.mts";
import { getBearerToken } from "./http.mts";
import { fetchSupabaseAuthUser, supabaseRequest } from "./supabase_rest.mts";

const ADMIN_PROXY_NAME = "Instructor (Admin)";
const ADMIN_PROXY_NORMALIZED = "__admin_proxy__";

/**
 * @param {string} playerName
 */
export function normalizePlayerName(playerName) {
  return playerName.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @param {Record<string, unknown>} player
 */
export function isAdminProxyPlayer(player) {
  return Boolean(player?.is_admin_proxy);
}

/**
 * @param {Array<Record<string, unknown>>} players
 */
export function studentPlayers(players) {
  return (players ?? []).filter((player) => !isAdminProxyPlayer(player));
}

/**
 * @param {Array<Record<string, unknown>>} players
 */
export function adminProxyIdsFromPlayers(players) {
  return new Set(
    (players ?? [])
      .filter((player) => isAdminProxyPlayer(player))
      .map((player) => String(player.id)),
  );
}

/**
 * @param {Request} req
 */
export async function requireAdminUser(req) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    throw new Error("Missing admin bearer token");
  }

  const authUser = await fetchSupabaseAuthUser(accessToken);
  if (!authUser?.id) {
    throw new Error("Invalid admin bearer token");
  }

  const rows = await supabaseRequest("/rest/v1/admin_users", {
    method: "GET",
    queryParams: {
      select: "user_id",
      user_id: `eq.${authUser.id}`,
      limit: 1,
    },
    useServiceRole: true,
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("User is not authorized as an admin");
  }

  return authUser;
}

export async function getActiveSession() {
  const sessions = await supabaseRequest("/rest/v1/coase_sessions", {
    method: "GET",
    queryParams: {
      select: "*",
      is_active: "eq.true",
      order: "created_at.desc",
      limit: 1,
    },
    useServiceRole: true,
  });

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return null;
  }

  return sessions[0];
}

/**
 * @param {string} sessionId
 */
export async function getPlayersForSession(sessionId) {
  return supabaseRequest("/rest/v1/coase_players", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
      order: "created_at.asc",
    },
    useServiceRole: true,
  });
}

/**
 * @param {string} sessionId
 */
export async function ensureAdminProxyPlayer(sessionId) {
  const existingRows = await supabaseRequest("/rest/v1/coase_players", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
      is_admin_proxy: "eq.true",
      limit: 1,
    },
    useServiceRole: true,
  });

  if (Array.isArray(existingRows) && existingRows.length > 0) {
    return existingRows[0];
  }

  const insertedRows = await supabaseRequest("/rest/v1/coase_players", {
    method: "POST",
    body: [{
      session_id: sessionId,
      player_name: ADMIN_PROXY_NAME,
      player_name_normalized: ADMIN_PROXY_NORMALIZED,
      is_admin_proxy: true,
    }],
    prefer: "return=representation",
    useServiceRole: true,
  });

  return insertedRows[0];
}

/**
 * @param {string} sessionId
 */
export async function getPairsForSession(sessionId) {
  return supabaseRequest("/rest/v1/coase_pairs", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
      order: "pair_number.asc",
    },
    useServiceRole: true,
  });
}

/**
 * @param {string} sessionId
 */
export async function getOffersForSession(sessionId) {
  return supabaseRequest("/rest/v1/coase_offers", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
      order: "created_at.asc",
    },
    useServiceRole: true,
  });
}

/**
 * @param {string} sessionId
 */
export async function getRoundOutcomesForSession(sessionId) {
  return supabaseRequest("/rest/v1/coase_round_outcomes", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
      order: "resolved_at.asc",
    },
    useServiceRole: true,
  });
}

/**
 * @param {string} joinToken
 */
export async function getPlayerByJoinToken(joinToken) {
  const rows = await supabaseRequest("/rest/v1/coase_players", {
    method: "GET",
    queryParams: {
      select: "*",
      join_token: `eq.${joinToken}`,
      limit: 1,
    },
    useServiceRole: true,
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0];
}

/**
 * @param {string} sessionId
 */
export async function clearPairingForSession(sessionId) {
  await supabaseRequest("/rest/v1/coase_offers", {
    method: "DELETE",
    queryParams: {
      session_id: `eq.${sessionId}`,
    },
    useServiceRole: true,
  });

  await supabaseRequest("/rest/v1/coase_round_outcomes", {
    method: "DELETE",
    queryParams: {
      session_id: `eq.${sessionId}`,
    },
    useServiceRole: true,
  });

  await supabaseRequest("/rest/v1/coase_pairs", {
    method: "DELETE",
    queryParams: {
      session_id: `eq.${sessionId}`,
    },
    useServiceRole: true,
  });
}

/**
 * @param {string} sessionId
 * @param {string} roundKey
 */
export async function clearRoundData(sessionId, roundKey) {
  await supabaseRequest("/rest/v1/coase_offers", {
    method: "DELETE",
    queryParams: {
      session_id: `eq.${sessionId}`,
      round_key: `eq.${roundKey}`,
    },
    useServiceRole: true,
  });

  await supabaseRequest("/rest/v1/coase_round_outcomes", {
    method: "DELETE",
    queryParams: {
      session_id: `eq.${sessionId}`,
      round_key: `eq.${roundKey}`,
    },
    useServiceRole: true,
  });
}

/**
 * @param {{
 * session_name: string,
 * expected_player_count: number,
 * created_by: string,
 * }} payload
 */
export async function createSession(payload) {
  await supabaseRequest("/rest/v1/coase_sessions", {
    method: "PATCH",
    queryParams: {
      is_active: "eq.true",
    },
    body: { is_active: false },
    prefer: "return=minimal",
    useServiceRole: true,
  });

  const inserted = await supabaseRequest("/rest/v1/coase_sessions", {
    method: "POST",
    body: [{
      ...payload,
      is_active: true,
      current_phase: "setup",
      has_started: false,
      started_at: null,
    }],
    prefer: "return=representation",
    useServiceRole: true,
  });

  return inserted[0];
}

/**
 * @param {{id: string}} session
 * @param {string} playerName
 */
export async function createOrFetchPlayer(session, playerName) {
  const normalized = normalizePlayerName(playerName);
  const existingRows = await supabaseRequest("/rest/v1/coase_players", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${session.id}`,
      player_name_normalized: `eq.${normalized}`,
      limit: 1,
    },
    useServiceRole: true,
  });

  if (Array.isArray(existingRows) && existingRows.length > 0) {
    return existingRows[0];
  }

  const insertedRows = await supabaseRequest("/rest/v1/coase_players", {
    method: "POST",
    body: [{
      session_id: session.id,
      player_name: playerName.trim(),
      player_name_normalized: normalized,
      is_admin_proxy: false,
    }],
    prefer: "return=representation",
    useServiceRole: true,
  });

  return insertedRows[0];
}

/**
 * Randomly pair currently joined students and mark session as started in round1.
 * If student count is odd, add one admin proxy player to complete one pair.
 * @param {Record<string, unknown>} session
 */
export async function startGameAndPairPlayers(session) {
  const allPlayers = await getPlayersForSession(String(session.id));
  const students = studentPlayers(allPlayers);

  if (students.length < 1) {
    throw new Error("Need at least one student player before starting the game");
  }

  let pairingPlayers = [...students];
  if (pairingPlayers.length % 2 !== 0) {
    const adminProxyPlayer = await ensureAdminProxyPlayer(String(session.id));
    pairingPlayers.push(adminProxyPlayer);
  }

  await clearPairingForSession(String(session.id));

  const pairRows = randomPairing(pairingPlayers).map((pairRow) => ({
    session_id: String(session.id),
    pair_number: pairRow.pair_number,
    player_a_id: pairRow.player_a_id,
    player_b_id: pairRow.player_b_id,
  }));

  const insertedPairs = await supabaseRequest("/rest/v1/coase_pairs", {
    method: "POST",
    body: pairRows,
    prefer: "return=representation",
    useServiceRole: true,
  });

  const updatedSessionRows = await supabaseRequest("/rest/v1/coase_sessions", {
    method: "PATCH",
    queryParams: {
      id: `eq.${session.id}`,
      select: "*",
    },
    body: {
      current_phase: "round1",
      has_started: true,
      started_at: new Date().toISOString(),
    },
    prefer: "return=representation",
    useServiceRole: true,
  });

  return {
    session: updatedSessionRows[0],
    pairs: insertedPairs,
  };
}

/**
 * @param {Record<string, unknown>} pair
 * @param {string} playerId
 */
export function roleForPlayer(pair, playerId) {
  if (String(pair.player_a_id) === String(playerId)) {
    return "A";
  }
  if (String(pair.player_b_id) === String(playerId)) {
    return "B";
  }
  return null;
}

/**
 * @param {Array<Record<string, unknown>>} pairs
 * @param {string} playerId
 */
export function pairForPlayer(pairs, playerId) {
  return (pairs ?? []).find((pair) => (
    String(pair.player_a_id) === String(playerId)
    || String(pair.player_b_id) === String(playerId)
  )) ?? null;
}

/**
 * @param {Record<string, unknown>} pair
 * @param {Array<Record<string, unknown>>} players
 * @param {string} playerId
 */
export function partnerForPlayer(pair, players, playerId) {
  if (!pair) {
    return null;
  }
  const partnerId = String(pair.player_a_id) === String(playerId)
    ? String(pair.player_b_id)
    : String(pair.player_a_id);
  return (players ?? []).find((player) => String(player.id) === partnerId) ?? null;
}

/**
 * Mark any pending offer for a pair in a round as superseded (a fresh offer
 * replaces it) and insert the new offer as the pending one.
 *
 * @param {string} sessionId
 * @param {Record<string, unknown>} pair
 * @param {string} roundKey
 * @param {string} proposerPlayerId
 * @param {{
 * offered_emissions: number,
 * offered_payment_noncontroller_to_controller: number,
 * offered_legal_fee_paid_by_a: number,
 * }} terms
 * @param {number} nextOfferIndex
 */
export async function insertOfferSupersedingPending(sessionId, pair, roundKey, proposerPlayerId, terms, nextOfferIndex) {
  await supabaseRequest("/rest/v1/coase_offers", {
    method: "PATCH",
    queryParams: {
      session_id: `eq.${sessionId}`,
      pair_id: `eq.${pair.id}`,
      round_key: `eq.${roundKey}`,
      status: "eq.pending",
    },
    body: {
      status: "superseded",
      responded_at: new Date().toISOString(),
    },
    prefer: "return=minimal",
    useServiceRole: true,
  });

  const insertedRows = await supabaseRequest("/rest/v1/coase_offers", {
    method: "POST",
    body: [{
      session_id: sessionId,
      pair_id: String(pair.id),
      round_key: roundKey,
      offer_index: nextOfferIndex,
      proposer_player_id: proposerPlayerId,
      offered_emissions: terms.offered_emissions,
      offered_payment_noncontroller_to_controller: terms.offered_payment_noncontroller_to_controller,
      offered_legal_fee_paid_by_a: terms.offered_legal_fee_paid_by_a,
      status: "pending",
    }],
    prefer: "return=representation",
    useServiceRole: true,
  });

  return insertedRows[0];
}

/**
 * @param {string} offerId
 * @param {string} status
 * @param {string} respondedByPlayerId
 */
export async function updateOfferStatus(offerId, status, respondedByPlayerId) {
  const updatedRows = await supabaseRequest("/rest/v1/coase_offers", {
    method: "PATCH",
    queryParams: {
      id: `eq.${offerId}`,
      select: "*",
    },
    body: {
      status,
      responded_by_player_id: respondedByPlayerId,
      responded_at: new Date().toISOString(),
    },
    prefer: "return=representation",
    useServiceRole: true,
  });

  return updatedRows[0];
}

/**
 * Write status quo outcomes for every pair in a round that has no resolved
 * outcome yet, and retire any offers still pending. Used when the instructor
 * closes a round with bargaining unfinished.
 *
 * @param {string} sessionId
 * @param {string} roundKey
 */
export async function finalizeUnresolvedPairsForRound(sessionId, roundKey) {
  const [pairs, outcomes] = await Promise.all([
    getPairsForSession(sessionId),
    getRoundOutcomesForSession(sessionId),
  ]);

  const resolvedPairIds = new Set(
    (outcomes ?? [])
      .filter((row) => String(row.round_key) === roundKey)
      .map((row) => String(row.pair_id)),
  );

  const unresolvedPairs = (pairs ?? []).filter(
    (pair) => !resolvedPairIds.has(String(pair.id)),
  );

  for (const pair of unresolvedPairs) {
    await upsertRoundOutcome(sessionId, pair, roundKey, statusQuoOutcome(roundKey), { noDeal: true });
  }

  if (unresolvedPairs.length > 0) {
    await supabaseRequest("/rest/v1/coase_offers", {
      method: "PATCH",
      queryParams: {
        session_id: `eq.${sessionId}`,
        round_key: `eq.${roundKey}`,
        status: "eq.pending",
      },
      body: {
        status: "superseded",
        responded_at: new Date().toISOString(),
      },
      prefer: "return=minimal",
      useServiceRole: true,
    });
  }

  return unresolvedPairs.length;
}

/**
 * @param {string} sessionId
 * @param {Record<string, unknown>} pair
 * @param {string} roundKey
 * @param {Record<string, unknown>} outcome
 * @param {{noDeal?: boolean}} options
 */
export async function upsertRoundOutcome(sessionId, pair, roundKey, outcome, options = {}) {
  await supabaseRequest("/rest/v1/coase_round_outcomes", {
    method: "POST",
    queryParams: {
      on_conflict: "session_id,pair_id,round_key",
    },
    body: [{
      session_id: sessionId,
      pair_id: String(pair.id),
      round_key: roundKey,
      agreed_emissions: Number(outcome.emissions),
      payment_noncontroller_to_controller: Number(outcome.payment_noncontroller_to_controller),
      legal_fee_paid_by_a: Number(outcome.legal_fee_paid_by_a),
      legal_fee_paid_by_b: Number(outcome.legal_fee_paid_by_b),
      player_a_payoff: Number(outcome.payoff_a),
      player_b_payoff: Number(outcome.payoff_b),
      no_deal: Boolean(options.noDeal),
      resolved_at: new Date().toISOString(),
    }],
    prefer: "resolution=merge-duplicates,return=minimal",
    useServiceRole: true,
  });
}

/**
 * @param {Record<string, unknown>} session
 * @param {Array<Record<string, unknown>>} pairs
 * @param {Array<Record<string, unknown>>} outcomes
 */
export function progressSummary(session, pairs, outcomes) {
  const phase = String(session?.current_phase ?? "");
  const pairCount = Array.isArray(pairs) ? pairs.length : 0;
  const outcomeRows = Array.isArray(outcomes) ? outcomes : [];

  const resolvedCounts = {
    round1: outcomeRows.filter((row) => String(row.round_key) === "round1").length,
    round2: outcomeRows.filter((row) => String(row.round_key) === "round2").length,
    round3: outcomeRows.filter((row) => String(row.round_key) === "round3").length,
  };

  const currentRoundResolved = isRoundPhase(phase)
    ? outcomeRows.filter((row) => String(row.round_key) === phase).length
    : 0;

  return {
    expected_player_count: Number(session?.expected_player_count ?? 0),
    pair_count: pairCount,
    current_round: phase,
    current_round_resolved_pairs: currentRoundResolved,
    all_pairs_resolved_current_round: isRoundPhase(phase)
      ? (pairCount > 0 && currentRoundResolved === pairCount)
      : false,
    resolved_by_round: resolvedCounts,
  };
}

/**
 * @param {Array<Record<string, unknown>>} pairs
 * @param {Array<Record<string, unknown>>} players
 */
export function pairDetailsRows(pairs, players) {
  const playersById = new Map((players ?? []).map((player) => [String(player.id), player]));

  return (pairs ?? []).map((pair) => {
    const playerA = playersById.get(String(pair.player_a_id));
    const playerB = playersById.get(String(pair.player_b_id));

    return {
      pair_number: Number(pair.pair_number),
      player_a_name: playerA?.player_name ?? "",
      player_b_name: playerB?.player_name ?? "",
      player_a_is_admin_proxy: isAdminProxyPlayer(playerA),
      player_b_is_admin_proxy: isAdminProxyPlayer(playerB),
      player_a_id: pair.player_a_id,
      player_b_id: pair.player_b_id,
    };
  });
}

/**
 * Live bargaining status per pair for the current round, built from offers
 * rather than the retired matched-submission flow.
 *
 * @param {string} phase
 * @param {Array<Record<string, unknown>>} pairs
 * @param {Array<Record<string, unknown>>} offers
 * @param {Array<Record<string, unknown>>} outcomes
 */
export function currentRoundPairStatusRows(phase, pairs, offers, outcomes) {
  if (!isRoundPhase(phase)) {
    return [];
  }

  return (pairs ?? []).map((pair) => {
    const pairOffers = (offers ?? []).filter((row) => (
      String(row.pair_id) === String(pair.id)
      && String(row.round_key) === String(phase)
    ));
    const pendingOffer = pendingOfferForPair(pairOffers, String(pair.id), String(phase));
    const outcome = (outcomes ?? []).find((row) => (
      String(row.pair_id) === String(pair.id)
      && String(row.round_key) === String(phase)
    ));

    return {
      pair_number: Number(pair.pair_number),
      round_key: phase,
      offers_made: pairOffers.length,
      pending_offer_emissions: pendingOffer?.offered_emissions ?? null,
      pending_offer_payment: pendingOffer?.offered_payment_noncontroller_to_controller ?? null,
      resolved: Boolean(outcome),
      no_deal: outcome ? Boolean(outcome.no_deal) : null,
      agreed_emissions: outcome?.agreed_emissions ?? null,
      payment_noncontroller_to_controller: outcome?.payment_noncontroller_to_controller ?? null,
      player_a_payoff: outcome?.player_a_payoff ?? null,
      player_b_payoff: outcome?.player_b_payoff ?? null,
    };
  });
}

export { PAYOFF_TABLE, VALID_PHASES, isRoundPhase, roundContext };
