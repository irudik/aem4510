/**
 * Economic engine for the AEM 4510 permit market game.
 *
 * Each team is a firm with integer baseline emissions e0 and MAC slope c:
 * the k-th unit of abatement costs c*k, so the q-th permit a firm holds is
 * worth c*(e0 - q + 1) in avoided abatement cost. Permits are sold in a
 * uniform-price sealed-bid auction and retraded in a continuous double
 * auction. Compliance is automatic: emissions = min(e0, permits held), the
 * rest is abated.
 */

export const VALID_PHASES = new Set([
  "setup", "auction1", "market1", "auction2", "market2", "complete",
]);

export const AUCTION_PHASES = new Set(["auction1", "auction2"]);
export const MARKET_PHASES = new Set(["market1", "market2"]);

export const PHASE_ORDER = ["setup", "auction1", "market1", "auction2", "market2", "complete"];

export const MAX_BIDS_PER_TEAM = 4;

/** Round that each active phase belongs to. */
export function roundForPhase(phase) {
  const normalized = String(phase ?? "").trim();
  if (normalized === "auction1" || normalized === "market1") {
    return "round1";
  }
  if (normalized === "auction2" || normalized === "market2") {
    return "round2";
  }
  return null;
}

/** Auction phase belonging to a round key. */
export function auctionPhaseForRound(roundKey) {
  return roundKey === "round1" ? "auction1" : "auction2";
}

/** Market phase belonging to a round key. */
export function marketPhaseForRound(roundKey) {
  return roundKey === "round1" ? "market1" : "market2";
}

/**
 * Firm types cycle through this list as teams join, so any class size gets
 * a spread of cheap and expensive abaters, large and small.
 */
export const FIRM_TYPES = Object.freeze([
  { baseline_emissions: 10, mac_slope: 1 },
  { baseline_emissions: 8, mac_slope: 3 },
  { baseline_emissions: 12, mac_slope: 2 },
  { baseline_emissions: 6, mac_slope: 4 },
  { baseline_emissions: 10, mac_slope: 2 },
  { baseline_emissions: 8, mac_slope: 1 },
]);

/**
 * @param {number} teamIndex zero-based join order
 */
export function firmTypeForIndex(teamIndex) {
  return FIRM_TYPES[teamIndex % FIRM_TYPES.length];
}

/**
 * Cost of abating `abatement` units at MAC slope c: sum of c*k.
 */
export function abatementCost(macSlope, abatement) {
  const a = Math.max(0, Math.floor(abatement));
  return macSlope * a * (a + 1) / 2;
}

/**
 * Value of holding the q-th permit: the marginal abatement cost avoided.
 */
export function permitValue(baselineEmissions, macSlope, q) {
  if (!Number.isInteger(q) || q < 1 || q > baselineEmissions) {
    return 0;
  }
  return macSlope * (baselineEmissions - q + 1);
}

/**
 * Full value schedule for a firm, permit 1 (most valuable) to permit e0.
 */
export function valueSchedule(baselineEmissions, macSlope) {
  const schedule = [];
  for (let q = 1; q <= baselineEmissions; q += 1) {
    schedule.push({ permit_number: q, value: permitValue(baselineEmissions, macSlope, q) });
  }
  return schedule;
}

/**
 * Gross value of emitting the full baseline: the cost of abating everything.
 * Scores are measured against this, so a team with no permits and no trades
 * scores zero.
 */
export function grossValue(baselineEmissions, macSlope) {
  return abatementCost(macSlope, baselineEmissions);
}

/**
 * Validate a team's auction bid set. Bids are up to MAX_BIDS_PER_TEAM
 * (price, quantity) pairs whose total quantity cannot exceed the baseline.
 * @param {{baseline_emissions: number}} team
 * @param {Array<{bid_price: unknown, bid_quantity: unknown}>} bids
 */
export function validateBidSet(team, bids) {
  if (!Array.isArray(bids) || bids.length === 0) {
    throw new Error("Submit at least one bid (price and quantity)");
  }
  if (bids.length > MAX_BIDS_PER_TEAM) {
    throw new Error(`At most ${MAX_BIDS_PER_TEAM} bids per auction`);
  }

  const normalized = bids.map((bid, index) => {
    const price = Number(bid?.bid_price);
    const quantity = Number(bid?.bid_quantity);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Bid ${index + 1}: price must be a nonnegative number`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Bid ${index + 1}: quantity must be a positive integer`);
    }
    return {
      bid_index: index + 1,
      bid_price: Math.round(price * 100) / 100,
      bid_quantity: quantity,
    };
  });

  const totalQuantity = normalized.reduce((sum, bid) => sum + bid.bid_quantity, 0);
  const baseline = Number(team?.baseline_emissions ?? 0);
  if (totalQuantity > baseline) {
    throw new Error(`Total bid quantity (${totalQuantity}) cannot exceed your baseline emissions (${baseline})`);
  }

  return normalized;
}

/**
 * Clear a uniform-price auction.
 *
 * Bid units are stacked from the highest price down (ties go to the earlier
 * submission); the top `cap` units win and every winner pays the price of
 * the lowest accepted unit.
 *
 * @param {number} cap total permits for sale
 * @param {Array<{
 * team_id: string,
 * bid_price: number,
 * bid_quantity: number,
 * submitted_at?: string,
 * }>} bidRows
 */
export function clearAuction(cap, bidRows) {
  const capUnits = Math.max(0, Math.floor(Number(cap)));

  const sortedBids = [...(bidRows ?? [])]
    .map((bid) => ({
      team_id: String(bid.team_id),
      bid_price: Number(bid.bid_price),
      bid_quantity: Math.max(0, Math.floor(Number(bid.bid_quantity))),
      submitted_at: String(bid.submitted_at ?? ""),
    }))
    .filter((bid) => bid.bid_quantity > 0 && Number.isFinite(bid.bid_price))
    .sort((left, right) => (
      right.bid_price - left.bid_price
      || left.submitted_at.localeCompare(right.submitted_at)
    ));

  const totalBidQuantity = sortedBids.reduce((sum, bid) => sum + bid.bid_quantity, 0);

  const allocations = new Map();
  let remainingCap = capUnits;
  let clearingPrice = null;

  for (const bid of sortedBids) {
    if (remainingCap <= 0) {
      break;
    }
    const filled = Math.min(bid.bid_quantity, remainingCap);
    remainingCap -= filled;
    clearingPrice = bid.bid_price;
    const current = allocations.get(bid.team_id) ?? 0;
    allocations.set(bid.team_id, current + filled);
  }

  const allocationRows = [...allocations.entries()].map(([teamId, permitsWon]) => ({
    team_id: teamId,
    permits_won: permitsWon,
    payment: clearingPrice === null ? 0 : Math.round(permitsWon * clearingPrice * 100) / 100,
  }));

  return {
    cap: capUnits,
    clearing_price: clearingPrice,
    total_bid_quantity: totalBidQuantity,
    allocations: allocationRows,
    bid_stack: stepSeriesFromSortedUnits(sortedBids),
  };
}

/**
 * Turn sorted bids into cumulative steps for charting:
 * [{from_quantity, to_quantity, price}], quantities cumulative.
 */
function stepSeriesFromSortedUnits(sortedBids) {
  const steps = [];
  let cumulative = 0;
  for (const bid of sortedBids) {
    steps.push({
      from_quantity: cumulative,
      to_quantity: cumulative + bid.bid_quantity,
      price: bid.bid_price,
    });
    cumulative += bid.bid_quantity;
  }
  return steps;
}

/**
 * The class's true aggregate demand for permits, as unit bids at each
 * team's value schedule. Used for the efficiency benchmark and the debrief
 * chart of bids against true values.
 * @param {Array<{id: string, baseline_emissions: number, mac_slope: number}>} teams
 */
export function truthfulUnitBids(teams) {
  const unitBids = [];
  for (const team of teams ?? []) {
    for (const step of valueSchedule(Number(team.baseline_emissions), Number(team.mac_slope))) {
      unitBids.push({
        team_id: String(team.id),
        bid_price: step.value,
        bid_quantity: 1,
        submitted_at: "",
      });
    }
  }
  return unitBids;
}

/**
 * Efficient benchmark for a round: clear the auction as if every team bid
 * its true value schedule. Returns the benchmark price and, per team, the
 * efficient permit count and the score from buying it at that price.
 * @param {Array<{id: string, baseline_emissions: number, mac_slope: number}>} teams
 * @param {number} cap
 */
export function benchmarkForRound(teams, cap) {
  const cleared = clearAuction(cap, truthfulUnitBids(teams));
  const allocationByTeam = new Map(
    cleared.allocations.map((row) => [row.team_id, row.permits_won]),
  );

  const perTeam = (teams ?? []).map((team) => {
    const e0 = Number(team.baseline_emissions);
    const slope = Number(team.mac_slope);
    const permits = allocationByTeam.get(String(team.id)) ?? 0;
    const price = cleared.clearing_price ?? 0;
    const score = grossValue(e0, slope)
      - abatementCost(slope, e0 - Math.min(e0, permits))
      - price * permits;

    return {
      team_id: String(team.id),
      benchmark_permits: permits,
      benchmark_score: Math.round(score * 100) / 100,
    };
  });

  return {
    benchmark_price: cleared.clearing_price,
    per_team: perTeam,
    true_demand_stack: cleared.bid_stack,
  };
}

/**
 * Match an incoming limit order against the book.
 *
 * Standard continuous double auction: the incoming order trades against the
 * best-priced crossing resting orders (ties to the earlier order) at the
 * RESTING order's price, until it no longer crosses or is filled.
 *
 * Pure function: returns the trades, the incoming order's remaining
 * quantity, and the resting orders' new remaining quantities.
 *
 * @param {{team_id: string, side: string, price: number, quantity: number}} incoming
 * @param {Array<{
 * id: string, team_id: string, side: string, price: number,
 * remaining_quantity: number, created_at: string,
 * }>} openOrders
 */
export function matchIncomingOrder(incoming, openOrders) {
  const side = String(incoming.side);
  const oppositeSide = side === "bid" ? "ask" : "bid";
  const price = Number(incoming.price);
  let remaining = Math.floor(Number(incoming.quantity));

  const book = (openOrders ?? [])
    .filter((order) => (
      String(order.side) === oppositeSide
      && String(order.team_id) !== String(incoming.team_id)
      && Number(order.remaining_quantity) > 0
    ))
    .sort((left, right) => {
      const priceOrder = oppositeSide === "ask"
        ? Number(left.price) - Number(right.price)
        : Number(right.price) - Number(left.price);
      return priceOrder || String(left.created_at).localeCompare(String(right.created_at));
    });

  const trades = [];
  const restingUpdates = [];

  for (const resting of book) {
    if (remaining <= 0) {
      break;
    }

    const crosses = side === "bid"
      ? price >= Number(resting.price)
      : price <= Number(resting.price);
    if (!crosses) {
      break;
    }

    const filled = Math.min(remaining, Number(resting.remaining_quantity));
    remaining -= filled;

    trades.push({
      buyer_team_id: side === "bid" ? String(incoming.team_id) : String(resting.team_id),
      seller_team_id: side === "ask" ? String(incoming.team_id) : String(resting.team_id),
      buy_order_id: side === "bid" ? null : String(resting.id),
      sell_order_id: side === "ask" ? null : String(resting.id),
      resting_order_id: String(resting.id),
      price: Number(resting.price),
      quantity: filled,
    });

    restingUpdates.push({
      id: String(resting.id),
      previous_remaining: Number(resting.remaining_quantity),
      remaining_quantity: Number(resting.remaining_quantity) - filled,
      status: Number(resting.remaining_quantity) - filled === 0 ? "filled" : "open",
    });
  }

  return {
    trades,
    remaining_quantity: remaining,
    resting_updates: restingUpdates,
  };
}

/**
 * Permits a team currently holds in a round: auction allocation plus banked
 * carry-in plus net executed purchases.
 */
export function holdingsForTeam(teamId, allocation, bankedIn, trades) {
  const id = String(teamId);
  let holdings = Math.max(0, Math.floor(Number(allocation ?? 0)))
    + Math.max(0, Math.floor(Number(bankedIn ?? 0)));

  for (const trade of trades ?? []) {
    if (String(trade.buyer_team_id) === id) {
      holdings += Number(trade.quantity);
    }
    if (String(trade.seller_team_id) === id) {
      holdings -= Number(trade.quantity);
    }
  }

  return holdings;
}

/**
 * Holdings not already committed to open ask orders: the most a team can
 * offer for sale. Blocks short selling.
 */
export function freeHoldings(teamId, allocation, bankedIn, trades, openOrders) {
  const id = String(teamId);
  const committed = (openOrders ?? [])
    .filter((order) => (
      String(order.team_id) === id
      && String(order.side) === "ask"
      && String(order.status) !== "cancelled"
      && Number(order.remaining_quantity) > 0
    ))
    .reduce((sum, order) => sum + Number(order.remaining_quantity), 0);

  return holdingsForTeam(teamId, allocation, bankedIn, trades) - committed;
}

/**
 * Score one team's round once the market closes.
 *
 * score = gross value - abatement cost - auction payment - net market spend.
 * With banking on (and not in the final round), permits beyond the baseline
 * carry to the next round instead of expiring.
 */
export function scoreTeamRound(team, input) {
  const e0 = Number(team.baseline_emissions);
  const slope = Number(team.mac_slope);
  const id = String(team.id);

  const allocation = Math.max(0, Math.floor(Number(input.permits_from_auction ?? 0)));
  const auctionPayment = Number(input.auction_payment ?? 0);
  const bankedIn = Math.max(0, Math.floor(Number(input.permits_banked_in ?? 0)));

  let buys = 0;
  let sells = 0;
  let netSpend = 0;
  for (const trade of input.trades ?? []) {
    if (String(trade.buyer_team_id) === id) {
      buys += Number(trade.quantity);
      netSpend += Number(trade.price) * Number(trade.quantity);
    }
    if (String(trade.seller_team_id) === id) {
      sells += Number(trade.quantity);
      netSpend -= Number(trade.price) * Number(trade.quantity);
    }
  }

  const permitsEnd = allocation + bankedIn + buys - sells;
  const emissions = Math.min(e0, Math.max(0, permitsEnd));
  const abatement = e0 - emissions;
  const cost = abatementCost(slope, abatement);
  const bankedOut = (input.banking_enabled && !input.is_final_round)
    ? Math.max(0, permitsEnd - e0)
    : 0;

  const score = grossValue(e0, slope) - cost - auctionPayment - netSpend;

  return {
    team_id: id,
    permits_from_auction: allocation,
    auction_payment: Math.round(auctionPayment * 100) / 100,
    permits_banked_in: bankedIn,
    market_buys: buys,
    market_sells: sells,
    market_net_spend: Math.round(netSpend * 100) / 100,
    permits_end: permitsEnd,
    emissions,
    abatement,
    abatement_cost: cost,
    permits_banked_out: bankedOut,
    score: Math.round(score * 100) / 100,
  };
}

/**
 * Leaderboard across scored rounds. Teams are ranked by cumulative
 * (score - benchmark score), so the endowment draw does not decide the
 * ranking; raw totals are also reported.
 * @param {Array<Record<string, unknown>>} teams
 * @param {Array<Record<string, unknown>>} scoreRows rows from permit_round_scores
 */
export function leaderboardRows(teams, scoreRows) {
  const rows = (teams ?? []).map((team) => {
    const teamScores = (scoreRows ?? []).filter(
      (row) => String(row.team_id) === String(team.id),
    );

    const totalScore = teamScores.reduce((sum, row) => sum + Number(row.score ?? 0), 0);
    const totalBenchmark = teamScores.reduce(
      (sum, row) => sum + Number(row.benchmark_score ?? 0),
      0,
    );

    const byRound = {};
    for (const row of teamScores) {
      byRound[String(row.round_key)] = Number(row.score ?? 0);
    }

    return {
      team_id: String(team.id),
      team_name: String(team.team_name ?? ""),
      round1: byRound.round1 ?? null,
      round2: byRound.round2 ?? null,
      total_score: Math.round(totalScore * 100) / 100,
      benchmark_total: Math.round(totalBenchmark * 100) / 100,
      points_vs_benchmark: Math.round((totalScore - totalBenchmark) * 100) / 100,
      rounds_scored: teamScores.length,
    };
  });

  rows.sort((left, right) => (
    right.points_vs_benchmark - left.points_vs_benchmark
    || left.team_name.localeCompare(right.team_name)
  ));

  let rank = 0;
  let previous = null;
  rows.forEach((row, index) => {
    if (previous === null || row.points_vs_benchmark < previous) {
      rank = index + 1;
      previous = row.points_vs_benchmark;
    }
    row.rank = rank;
  });

  return rows;
}

/**
 * True once the phase deadline has passed.
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
 * Aggregate open orders into book levels for display: bids and asks
 * grouped by price, best first.
 * @param {Array<Record<string, unknown>>} openOrders
 */
export function bookLevels(openOrders) {
  const aggregate = (side, sortDirection) => {
    const levels = new Map();
    for (const order of openOrders ?? []) {
      if (String(order.side) !== side || Number(order.remaining_quantity) <= 0) {
        continue;
      }
      const price = Number(order.price);
      levels.set(price, (levels.get(price) ?? 0) + Number(order.remaining_quantity));
    }
    return [...levels.entries()]
      .map(([price, quantity]) => ({ price, quantity }))
      .sort((left, right) => sortDirection * (right.price - left.price));
  };

  return {
    bids: aggregate("bid", 1),
    asks: aggregate("ask", -1),
  };
}
