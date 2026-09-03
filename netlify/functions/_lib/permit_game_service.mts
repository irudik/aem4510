/**
 * Supabase data access for the permit market game. Pure market logic lives
 * in permit_market.mts; this module only reads and writes rows.
 */

import { getBearerToken } from "./http.mts";
import { fetchSupabaseAuthUser, supabaseRequest } from "./supabase_rest.mts";
import {
  AUCTION_PHASES,
  MARKET_PHASES,
  firmTypeForIndex,
  roundForPhase,
} from "./permit_market.mts";

/**
 * @param {string} teamName
 */
export function normalizeTeamName(teamName) {
  return teamName.trim().toLowerCase().replace(/\s+/g, " ");
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
    throw new Error("Invalid admin session");
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
    throw new Error("User is not an authorized admin");
  }

  return authUser;
}

export async function getActiveSession() {
  const sessions = await supabaseRequest("/rest/v1/permit_sessions", {
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
 * @param {{
 * session_name: string,
 * expected_team_count: number,
 * cap_share_round1: number,
 * cap_share_round2: number,
 * banking_enabled: boolean,
 * round_seconds: number,
 * created_by: string,
 * }} payload
 */
export async function createSession(payload) {
  await supabaseRequest("/rest/v1/permit_sessions", {
    method: "PATCH",
    queryParams: {
      is_active: "eq.true",
    },
    body: { is_active: false },
    prefer: "return=minimal",
    useServiceRole: true,
  });

  const inserted = await supabaseRequest("/rest/v1/permit_sessions", {
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
 * @param {string} sessionId
 */
export async function getTeamsForSession(sessionId) {
  return supabaseRequest("/rest/v1/permit_teams", {
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
 * @param {string} joinToken
 */
export async function getTeamByJoinToken(joinToken) {
  const rows = await supabaseRequest("/rest/v1/permit_teams", {
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
 * @param {{id: string}} session
 * @param {string} teamName
 */
export async function createOrFetchTeam(session, teamName) {
  const normalized = normalizeTeamName(teamName);
  const existingRows = await supabaseRequest("/rest/v1/permit_teams", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${session.id}`,
      team_name_normalized: `eq.${normalized}`,
      limit: 1,
    },
    useServiceRole: true,
  });

  if (Array.isArray(existingRows) && existingRows.length > 0) {
    return existingRows[0];
  }

  const insertedRows = await supabaseRequest("/rest/v1/permit_teams", {
    method: "POST",
    body: [{
      session_id: session.id,
      team_name: teamName.trim(),
      team_name_normalized: normalized,
    }],
    prefer: "return=representation",
    useServiceRole: true,
  });

  return insertedRows[0];
}

/**
 * Assign firm types round-robin in join order and mark the session started.
 * @param {Record<string, unknown>} session
 */
export async function startGameAndAssignFirms(session) {
  const teams = await getTeamsForSession(String(session.id));
  if (!Array.isArray(teams) || teams.length < 2) {
    throw new Error("Need at least two teams before starting the game");
  }

  for (let index = 0; index < teams.length; index += 1) {
    const firmType = firmTypeForIndex(index);
    await supabaseRequest("/rest/v1/permit_teams", {
      method: "PATCH",
      queryParams: {
        id: `eq.${teams[index].id}`,
      },
      body: {
        baseline_emissions: firmType.baseline_emissions,
        mac_slope: firmType.mac_slope,
      },
      prefer: "return=minimal",
      useServiceRole: true,
    });
  }

  const updatedRows = await supabaseRequest("/rest/v1/permit_sessions", {
    method: "PATCH",
    queryParams: {
      id: `eq.${session.id}`,
      select: "*",
    },
    body: {
      has_started: true,
      started_at: new Date().toISOString(),
    },
    prefer: "return=representation",
    useServiceRole: true,
  });

  return updatedRows[0];
}

/**
 * @param {string} sessionId
 */
export async function getBidsForSession(sessionId) {
  return supabaseRequest("/rest/v1/permit_auction_bids", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
      order: "submitted_at.asc",
    },
    useServiceRole: true,
  });
}

/**
 * Replace a team's full bid set for one auction.
 */
export async function replaceTeamBids(sessionId, teamId, roundKey, bidSet) {
  await supabaseRequest("/rest/v1/permit_auction_bids", {
    method: "DELETE",
    queryParams: {
      session_id: `eq.${sessionId}`,
      team_id: `eq.${teamId}`,
      round_key: `eq.${roundKey}`,
    },
    useServiceRole: true,
  });

  await supabaseRequest("/rest/v1/permit_auction_bids", {
    method: "POST",
    body: bidSet.map((bid) => ({
      session_id: sessionId,
      team_id: teamId,
      round_key: roundKey,
      bid_index: bid.bid_index,
      bid_price: bid.bid_price,
      bid_quantity: bid.bid_quantity,
    })),
    prefer: "return=minimal",
    useServiceRole: true,
  });
}

/**
 * @param {string} sessionId
 */
export async function getAuctionResultsForSession(sessionId) {
  return supabaseRequest("/rest/v1/permit_auction_results", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
    },
    useServiceRole: true,
  });
}

/**
 * @param {string} sessionId
 */
export async function getAllocationsForSession(sessionId) {
  return supabaseRequest("/rest/v1/permit_auction_allocations", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
    },
    useServiceRole: true,
  });
}

/**
 * Store the outcome of clearing one auction.
 */
export async function writeAuctionClearing(sessionId, auctionKey, clearing) {
  await supabaseRequest("/rest/v1/permit_auction_results", {
    method: "POST",
    queryParams: {
      on_conflict: "session_id,round_key",
    },
    body: [{
      session_id: sessionId,
      round_key: auctionKey,
      cap: clearing.cap,
      clearing_price: clearing.clearing_price,
      total_bid_quantity: clearing.total_bid_quantity,
      cleared_at: new Date().toISOString(),
    }],
    prefer: "resolution=merge-duplicates,return=minimal",
    useServiceRole: true,
  });

  await supabaseRequest("/rest/v1/permit_auction_allocations", {
    method: "DELETE",
    queryParams: {
      session_id: `eq.${sessionId}`,
      round_key: `eq.${auctionKey}`,
    },
    useServiceRole: true,
  });

  if (clearing.allocations.length > 0) {
    await supabaseRequest("/rest/v1/permit_auction_allocations", {
      method: "POST",
      body: clearing.allocations.map((row) => ({
        session_id: sessionId,
        round_key: auctionKey,
        team_id: row.team_id,
        permits_won: row.permits_won,
        payment: row.payment,
      })),
      prefer: "return=minimal",
      useServiceRole: true,
    });
  }
}

/**
 * @param {string} sessionId
 */
export async function getOrdersForSession(sessionId) {
  return supabaseRequest("/rest/v1/permit_orders", {
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
export async function getTradesForSession(sessionId) {
  return supabaseRequest("/rest/v1/permit_trades", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
      order: "executed_at.asc",
    },
    useServiceRole: true,
  });
}

/**
 * Insert a new order row and return it.
 */
export async function insertOrder(order) {
  const rows = await supabaseRequest("/rest/v1/permit_orders", {
    method: "POST",
    body: [order],
    prefer: "return=representation",
    useServiceRole: true,
  });
  return rows[0];
}

/**
 * Update a resting order's remaining quantity, guarded by its previous
 * value so a concurrent fill fails instead of double-spending. Returns
 * true when the update applied.
 */
export async function patchOrderRemaining(orderId, previousRemaining, remainingQuantity, status) {
  const rows = await supabaseRequest("/rest/v1/permit_orders", {
    method: "PATCH",
    queryParams: {
      id: `eq.${orderId}`,
      remaining_quantity: `eq.${previousRemaining}`,
      select: "id",
    },
    body: {
      remaining_quantity: remainingQuantity,
      status,
    },
    prefer: "return=representation",
    useServiceRole: true,
  });

  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Cancel a team's own open order.
 */
export async function cancelOrder(sessionId, teamId, orderId) {
  const rows = await supabaseRequest("/rest/v1/permit_orders", {
    method: "PATCH",
    queryParams: {
      id: `eq.${orderId}`,
      session_id: `eq.${sessionId}`,
      team_id: `eq.${teamId}`,
      status: "eq.open",
      select: "*",
    },
    body: {
      status: "cancelled",
    },
    prefer: "return=representation",
    useServiceRole: true,
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Order not found, not yours, or already closed");
  }

  return rows[0];
}

/**
 * @param {Array<Record<string, unknown>>} tradeRows
 */
export async function insertTrades(sessionId, marketKey, tradeRows) {
  if (!tradeRows || tradeRows.length === 0) {
    return;
  }

  await supabaseRequest("/rest/v1/permit_trades", {
    method: "POST",
    body: tradeRows.map((trade) => ({
      session_id: sessionId,
      round_key: marketKey,
      buyer_team_id: trade.buyer_team_id,
      seller_team_id: trade.seller_team_id,
      buy_order_id: trade.buy_order_id,
      sell_order_id: trade.sell_order_id,
      price: trade.price,
      quantity: trade.quantity,
    })),
    prefer: "return=minimal",
    useServiceRole: true,
  });
}

/**
 * @param {string} sessionId
 */
export async function getRoundScoresForSession(sessionId) {
  return supabaseRequest("/rest/v1/permit_round_scores", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
    },
    useServiceRole: true,
  });
}

/**
 * @param {Array<Record<string, unknown>>} scoreRows
 */
export async function upsertRoundScores(sessionId, roundKey, scoreRows) {
  if (!scoreRows || scoreRows.length === 0) {
    return;
  }

  await supabaseRequest("/rest/v1/permit_round_scores", {
    method: "POST",
    queryParams: {
      on_conflict: "session_id,round_key,team_id",
    },
    body: scoreRows.map((row) => ({
      session_id: sessionId,
      round_key: roundKey,
      ...row,
      scored_at: new Date().toISOString(),
    })),
    prefer: "resolution=merge-duplicates,return=minimal",
    useServiceRole: true,
  });
}

/**
 * Wipe the data a phase produces, so re-entering the phase replays it.
 * Entering an auction also wipes its round's market and scores, since both
 * depend on the auction's outcome.
 * @param {string} sessionId
 * @param {string} phase
 */
export async function clearPhaseDataForEntry(sessionId, phase) {
  const roundKey = roundForPhase(phase);
  if (!roundKey) {
    return;
  }

  const marketKey = roundKey === "round1" ? "market1" : "market2";
  const auctionKey = roundKey === "round1" ? "auction1" : "auction2";

  if (MARKET_PHASES.has(phase) || AUCTION_PHASES.has(phase)) {
    await supabaseRequest("/rest/v1/permit_trades", {
      method: "DELETE",
      queryParams: {
        session_id: `eq.${sessionId}`,
        round_key: `eq.${marketKey}`,
      },
      useServiceRole: true,
    });

    await supabaseRequest("/rest/v1/permit_orders", {
      method: "DELETE",
      queryParams: {
        session_id: `eq.${sessionId}`,
        round_key: `eq.${marketKey}`,
      },
      useServiceRole: true,
    });

    await supabaseRequest("/rest/v1/permit_round_scores", {
      method: "DELETE",
      queryParams: {
        session_id: `eq.${sessionId}`,
        round_key: `eq.${roundKey}`,
      },
      useServiceRole: true,
    });
  }

  if (AUCTION_PHASES.has(phase)) {
    await supabaseRequest("/rest/v1/permit_auction_allocations", {
      method: "DELETE",
      queryParams: {
        session_id: `eq.${sessionId}`,
        round_key: `eq.${auctionKey}`,
      },
      useServiceRole: true,
    });

    await supabaseRequest("/rest/v1/permit_auction_results", {
      method: "DELETE",
      queryParams: {
        session_id: `eq.${sessionId}`,
        round_key: `eq.${auctionKey}`,
      },
      useServiceRole: true,
    });

    await supabaseRequest("/rest/v1/permit_auction_bids", {
      method: "DELETE",
      queryParams: {
        session_id: `eq.${sessionId}`,
        round_key: `eq.${auctionKey}`,
      },
      useServiceRole: true,
    });
  }
}

/**
 * Patch the active session and return the updated row.
 */
export async function patchSession(sessionId, body) {
  const rows = await supabaseRequest("/rest/v1/permit_sessions", {
    method: "PATCH",
    queryParams: {
      id: `eq.${sessionId}`,
      select: "*",
    },
    body,
    prefer: "return=representation",
    useServiceRole: true,
  });

  return rows[0];
}
