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
 * How a round's permits reach firms: a uniform-price auction, a pay-as-bid
 * auction (each winner pays its own bid), or free allocation in proportion
 * to baseline emissions.
 */
export const ALLOCATION_METHODS = Object.freeze(["uniform", "pay_as_bid", "free"]);

/** Cost-shock multipliers on a firm's MAC slope, equally likely. */
export const SHOCK_FACTORS = Object.freeze([0.5, 1, 1.5]);

/** Allocation method a session uses in a round ("round1" or "round2"). */
export function allocationMethodForRound(session, roundKey) {
  const raw = String((roundKey === "round2" ? session?.allocation_round2 : session?.allocation_round1) ?? "uniform");
  return ALLOCATION_METHODS.includes(raw) ? raw : "uniform";
}

/** Whether a session applies a cost shock when a round's market opens. */
export function shockEnabledForRound(session, roundKey) {
  return Boolean(roundKey === "round2" ? session?.shock_round2 : session?.shock_round1);
}

/** A team's cost-shock multiplier in a round (1 when there is no shock). */
export function shockFactor(team, roundKey) {
  const factor = Number(roundKey === "round2" ? team?.mac_shock_round2 : team?.mac_shock_round1);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

/**
 * Whether teams may see a round's cost shock yet: only once that round's
 * market has opened, and only if the round has a shock.
 */
export function shockRevealed(session, roundKey, phase) {
  if (!shockEnabledForRound(session, roundKey)) {
    return false;
  }
  return PHASE_ORDER.indexOf(String(phase)) >= PHASE_ORDER.indexOf(marketPhaseForRound(roundKey));
}

/** A team's MAC slope in a round after any cost shock. */
export function effectiveSlope(team, roundKey) {
  return Number(team?.mac_slope) * shockFactor(team, roundKey);
}

/**
 * Shock multipliers for a class: equal thirds of 0.5, 1, and 1.5 (as close
 * as the class size allows), in random order. Balancing the draws keeps the
 * class's total demand for permits close to its expected level.
 * @param {number} teamCount
 * @param {() => number} random uniform draw on [0, 1)
 */
export function drawShockFactors(teamCount, random = Math.random) {
  const factors = Array.from({ length: teamCount }, (_, index) => SHOCK_FACTORS[index % SHOCK_FACTORS.length]);
  for (let index = factors.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [factors[index], factors[swapIndex]] = [factors[swapIndex], factors[index]];
  }
  return factors;
}

/**
 * Most permits a team may bid for in one auction. Without banking or
 * borrowing, permits beyond baseline are worthless, so bids stop at the
 * baseline. With either, extra permits can be banked or repay borrowing, so
 * the only limit is the number of permits for sale.
 */
export function bidQuantityLimit(session, team, cap) {
  const baseline = Number(team?.baseline_emissions ?? 0);
  if (session?.banking_enabled || session?.borrowing_enabled) {
    return Math.max(baseline, Math.floor(Number(cap ?? 0)));
  }
  return baseline;
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
 * Validate price/quantity bids. Total quantity cannot exceed `maxQuantity`,
 * which defaults to baseline emissions (see `bidQuantityLimit`).
 * @param {{baseline_emissions: number}} team
 * @param {Array<{bid_price: unknown, bid_quantity: unknown}>} bids
 * @param {{maxQuantity?: number}} options
 */
export function validateBidSet(team, bids, { maxQuantity } = {}) {
  if (!Array.isArray(bids) || bids.length === 0) {
    throw new Error("Submit at least one bid (price and quantity)");
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
  const limit = maxQuantity === undefined ? baseline : Number(maxQuantity);
  if (totalQuantity > limit) {
    throw new Error(limit === baseline
      ? `Total bid quantity (${totalQuantity}) cannot exceed your baseline emissions (${baseline})`
      : `Total bid quantity (${totalQuantity}) cannot exceed the ${limit} permits for sale`);
  }

  return normalized;
}

/**
 * Order bids the way the auction fills them: highest price first, ties to
 * the earlier submission. Rows without a positive quantity or a finite price
 * are dropped.
 */
function rankAuctionBids(bidRows) {
  return [...(bidRows ?? [])]
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
}

/**
 * Clear a sealed-bid permit auction.
 *
 * Bid units are stacked from the highest price down (ties go to the earlier
 * submission) and the top `cap` units win. Under uniform pricing every
 * winner pays the price of the lowest accepted unit; under pay-as-bid
 * pricing each winning unit costs its own bid. `clearing_price` is the
 * lowest accepted bid in both cases.
 *
 * @param {number} cap total permits for sale
 * @param {Array<{
 * team_id: string,
 * bid_price: number,
 * bid_quantity: number,
 * submitted_at?: string,
 * }>} bidRows
 * @param {{pricing?: "uniform" | "pay_as_bid"}} options
 */
export function clearAuction(cap, bidRows, { pricing = "uniform" } = {}) {
  const capUnits = Math.max(0, Math.floor(Number(cap)));
  const sortedBids = rankAuctionBids(bidRows);

  const totalBidQuantity = sortedBids.reduce((sum, bid) => sum + bid.bid_quantity, 0);

  const allocations = new Map();
  const ownBidSpending = new Map();
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
    ownBidSpending.set(bid.team_id, (ownBidSpending.get(bid.team_id) ?? 0) + filled * bid.bid_price);
  }

  const allocationRows = [...allocations.entries()].map(([teamId, permitsWon]) => {
    const payment = pricing === "pay_as_bid"
      ? ownBidSpending.get(teamId) ?? 0
      : (clearingPrice === null ? 0 : permitsWon * clearingPrice);
    return {
      team_id: teamId,
      permits_won: permitsWon,
      payment: Math.round(payment * 100) / 100,
    };
  });

  return {
    cap: capUnits,
    pricing,
    clearing_price: clearingPrice,
    total_bid_quantity: totalBidQuantity,
    allocations: allocationRows,
    bid_stack: stepSeriesFromSortedUnits(sortedBids),
  };
}

/**
 * Free allocation in proportion to baseline emissions (grandfathering):
 * each firm gets its share of the cap, rounded to whole permits by largest
 * remainder so the allocations add up to the cap exactly. Ties in the
 * remainder go to the firm listed first.
 * @param {Array<{id: string, baseline_emissions: number}>} teams
 * @param {number} cap
 */
export function freeAllocation(teams, cap) {
  const capUnits = Math.max(0, Math.floor(Number(cap)));
  const firms = (teams ?? []).filter((team) => Number(team.baseline_emissions) > 0);
  const totalBaseline = firms.reduce((sum, team) => sum + Number(team.baseline_emissions), 0);
  if (totalBaseline === 0) {
    return [];
  }

  const shares = firms.map((team, order) => {
    const exact = capUnits * Number(team.baseline_emissions) / totalBaseline;
    return { team_id: String(team.id), order, whole: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let leftOver = capUnits - shares.reduce((sum, share) => sum + share.whole, 0);
  const byRemainder = [...shares].sort((left, right) => right.remainder - left.remainder || left.order - right.order);
  for (const share of byRemainder) {
    if (leftOver <= 0) break;
    share.whole += 1;
    leftOver -= 1;
  }

  return shares.map((share) => ({ team_id: share.team_id, permits_won: share.whole, payment: 0 }));
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
 * What one team sees about a cleared auction, so students can see how the
 * price was set without learning who bid what.
 *
 * `stack` lists every bid in the order the auction filled it (price and
 * quantity only, no team names), so it traces the class's step demand
 * curve; `own` marks the requesting team's bids and `accepted_quantity` is
 * the part of each step inside the cap. `own_bids`
 * expands the team's bids to one row per permit, highest first. A team
 * always wins its highest bids first, so its k winning permits are its k
 * highest bids. Each costs the common clearing price under uniform pricing
 * and its own bid under pay-as-bid pricing.
 *
 * @param {number} cap total permits for sale
 * @param {Array<{team_id: string, bid_price: number, bid_quantity: number, submitted_at?: string}>} bidRows
 * @param {string} teamId the team requesting the report
 */
export function studentAuctionReport(cap, bidRows, teamId, { pricing = "uniform" } = {}) {
  const id = String(teamId);
  const cleared = clearAuction(cap, bidRows, { pricing });
  const rankedBids = rankAuctionBids(bidRows);

  // Adjacent bids at the same price from the same side (own or other) are
  // merged, which keeps the report small in a large class without changing
  // the curve.
  let cumulative = 0;
  const stack = [];
  for (const bid of rankedBids) {
    const fromQuantity = cumulative;
    cumulative += bid.bid_quantity;
    const own = bid.team_id === id;
    const accepted = Math.max(0, Math.min(bid.bid_quantity, cleared.cap - fromQuantity));
    const previous = stack[stack.length - 1];
    if (previous && previous.own === own && previous.price === bid.bid_price) {
      previous.to_quantity = cumulative;
      previous.accepted_quantity += accepted;
    } else {
      stack.push({
        from_quantity: fromQuantity,
        to_quantity: cumulative,
        price: bid.bid_price,
        accepted_quantity: accepted,
        own,
      });
    }
  }

  const ownAllocation = cleared.allocations.find((row) => row.team_id === id);
  const permitsWon = ownAllocation?.permits_won ?? 0;
  const ownUnitPrices = rankedBids
    .filter((bid) => bid.team_id === id)
    .flatMap((bid) => Array.from({ length: bid.bid_quantity }, () => bid.bid_price));

  const ownBids = ownUnitPrices.map((price, index) => ({
    permit_number: index + 1,
    bid_price: price,
    won: index < permitsWon,
    price_paid: index < permitsWon ? (pricing === "pay_as_bid" ? price : cleared.clearing_price) : null,
  }));

  return {
    cap: cleared.cap,
    pricing,
    clearing_price: cleared.clearing_price,
    total_bid_quantity: cleared.total_bid_quantity,
    stack,
    own_bids: ownBids,
    permits_won: permitsWon,
    payment: ownAllocation?.payment ?? 0,
  };
}

/**
 * The class's true aggregate demand for permits, as unit bids at each
 * team's value schedule. Used for the efficiency benchmark and the debrief
 * chart of bids against true values.
 * @param {Array<{id: string, baseline_emissions: number, mac_slope: number}>} teams
 * @param {(team: object) => number} slopeFor MAC slope to use (default: unshocked)
 */
export function truthfulUnitBids(teams, slopeFor = (team) => Number(team.mac_slope)) {
  const unitBids = [];
  for (const team of teams ?? []) {
    for (const step of valueSchedule(Number(team.baseline_emissions), slopeFor(team))) {
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
 * efficient permit count and the score from reaching it at that price:
 * buying all of it when permits are sold, or trading from the free
 * endowment when permits are given away. `slopeFor` supplies the MAC slope
 * (after any cost shock).
 * @param {Array<{id: string, baseline_emissions: number, mac_slope: number}>} teams
 * @param {number} cap
 * @param {{slopeFor?: (team: object) => number, endowments?: Map<string, number>}} options
 */
export function benchmarkForRound(teams, cap, {
  slopeFor = (team) => Number(team.mac_slope),
  endowments = new Map(),
} = {}) {
  const cleared = clearAuction(cap, truthfulUnitBids(teams, slopeFor));
  const allocationByTeam = new Map(
    cleared.allocations.map((row) => [row.team_id, row.permits_won]),
  );

  const perTeam = (teams ?? []).map((team) => {
    const e0 = Number(team.baseline_emissions);
    const slope = slopeFor(team);
    const permits = allocationByTeam.get(String(team.id)) ?? 0;
    const endowment = Number(endowments.get(String(team.id)) ?? 0);
    const price = cleared.clearing_price ?? 0;
    const score = grossValue(e0, slope)
      - abatementCost(slope, e0 - Math.min(e0, permits))
      - price * (permits - endowment);

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
 * Permits a team currently holds in a round: allocation plus net carry-in
 * from Round 1 (banked minus owed, so negative for a team that borrowed)
 * plus net executed purchases. A team that borrowed can hold a negative
 * number of permits until it covers the debt.
 */
export function holdingsForTeam(teamId, allocation, carryIn, trades) {
  const id = String(teamId);
  let holdings = Math.max(0, Math.floor(Number(allocation ?? 0)))
    + Math.floor(Number(carryIn ?? 0));

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
export function freeHoldings(teamId, allocation, carryIn, trades, openOrders) {
  const id = String(teamId);
  const committed = (openOrders ?? [])
    .filter((order) => (
      String(order.team_id) === id
      && String(order.side) === "ask"
      && String(order.status) !== "cancelled"
      && Number(order.remaining_quantity) > 0
    ))
    .reduce((sum, order) => sum + Number(order.remaining_quantity), 0);

  return holdingsForTeam(teamId, allocation, carryIn, trades) - committed;
}

/**
 * What a team carries from Round 1 into Round 2, read from its Round 1 score:
 * permits banked (when banking is on) and permits owed (when borrowing is
 * on). `net` is banked minus owed.
 * @param {Record<string, unknown>} session
 * @param {Record<string, unknown> | undefined} round1Score
 */
export function carryIntoRound2(session, round1Score) {
  const banked = session?.banking_enabled ? Math.max(0, Math.floor(Number(round1Score?.permits_banked_out ?? 0))) : 0;
  const owed = session?.borrowing_enabled ? Math.max(0, Math.floor(Number(round1Score?.permits_borrowed_out ?? 0))) : 0;
  return { banked, owed, net: banked - owed };
}

/**
 * Score one team's round once the market closes.
 *
 * score = gross value - abatement cost - auction payment - net market spend
 *         - shortfall penalty.
 *
 * Costs use the round's MAC slope after any cost shock (`mac_shock`). Net
 * permits are the allocation, plus banked permits and minus owed permits
 * carried in, plus net purchases.
 *
 * In a round that is not the last, the team's emissions are its
 * `emissions_choice` (default: use its permits, up to baseline), limited to
 * [0, baseline]. Without borrowing it cannot emit more than it holds; without
 * banking it uses all the permits it holds up to baseline. Permits left over
 * are banked (with banking on); emissions above holdings are borrowed from
 * the next round.
 *
 * In the last round emissions follow the permits held; if owed permits leave
 * the team short, each missing permit pays `shortfall_penalty_per_permit`.
 */
export function scoreTeamRound(team, input) {
  const e0 = Number(team.baseline_emissions);
  const shock = Number.isFinite(Number(input.mac_shock)) && Number(input.mac_shock) > 0
    ? Number(input.mac_shock)
    : 1;
  const slope = Number(team.mac_slope) * shock;
  const id = String(team.id);

  const allocation = Math.max(0, Math.floor(Number(input.permits_from_auction ?? 0)));
  const auctionPayment = Number(input.auction_payment ?? 0);
  const bankedIn = Math.max(0, Math.floor(Number(input.permits_banked_in ?? 0)));
  const owedIn = Math.max(0, Math.floor(Number(input.permits_owed_in ?? 0)));
  const isFinalRound = Boolean(input.is_final_round);
  const bankingEnabled = Boolean(input.banking_enabled);
  const borrowingEnabled = Boolean(input.borrowing_enabled);
  const penaltyPerPermit = Math.max(0, Number(input.shortfall_penalty_per_permit ?? 0));

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

  const permitsEnd = allocation + bankedIn - owedIn + buys - sells;
  const coveredByPermits = Math.min(e0, Math.max(0, permitsEnd));

  let emissions = coveredByPermits;
  let bankedOut = 0;
  let borrowedOut = 0;
  let shortfall = 0;

  if (isFinalRound) {
    shortfall = Math.max(0, -permitsEnd);
  } else {
    const choice = input.emissions_choice;
    if (choice !== null && choice !== undefined && Number.isFinite(Number(choice))) {
      emissions = Math.min(e0, Math.max(0, Math.floor(Number(choice))));
    }
    if (!borrowingEnabled) {
      emissions = Math.min(emissions, Math.max(0, permitsEnd));
    }
    if (!bankingEnabled) {
      emissions = Math.max(emissions, coveredByPermits);
    }
    const leftOver = permitsEnd - emissions;
    bankedOut = bankingEnabled ? Math.max(0, leftOver) : 0;
    borrowedOut = Math.max(0, -leftOver);
  }

  const abatement = e0 - emissions;
  const cost = abatementCost(slope, abatement);
  const penalty = shortfall * penaltyPerPermit;
  const score = grossValue(e0, slope) - cost - auctionPayment - netSpend - penalty;
  const round2 = (value) => Math.round(value * 100) / 100;

  return {
    team_id: id,
    permits_from_auction: allocation,
    auction_payment: round2(auctionPayment),
    permits_banked_in: bankedIn,
    permits_owed_in: owedIn,
    market_buys: buys,
    market_sells: sells,
    market_net_spend: round2(netSpend),
    permits_end: permitsEnd,
    emissions,
    abatement,
    abatement_cost: round2(cost),
    permits_banked_out: bankedOut,
    permits_borrowed_out: borrowedOut,
    shortfall,
    shortfall_penalty: round2(penalty),
    mac_shock: shock,
    score: round2(score),
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
