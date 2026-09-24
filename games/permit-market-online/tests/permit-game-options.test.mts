import test from "node:test";
import assert from "node:assert/strict";
import {
  FIRM_TYPES,
  SHOCK_FACTORS,
  abatementCost,
  allocationMethodForRound,
  benchmarkForRound,
  bidQuantityLimit,
  carryIntoRound2,
  clearAuction,
  drawShockFactors,
  effectiveSlope,
  freeAllocation,
  grossValue,
  scoreTeamRound,
  shockFactor,
  studentAuctionReport,
  validateBidSet,
} from "../../../netlify/functions/_lib/permit_market.mts";
import {
  auctionReportHtml,
  auctionRulesHtml,
  biddablePermits,
  freeAllocationHtml,
  outcomeAtPrice,
  permitBidInputsHtml,
} from "../../../static/games/permit-market-online/auction-guide.mjs";
import { macModel, macPanel } from "../../../static/games/permit-market-online/mac-view.mjs";

/** One-permit bids for each team, in the order given. */
function unitBids(pricesByTeam) {
  return Object.entries(pricesByTeam).flatMap(([teamId, prices]) => prices.map((price, index) => ({
    team_id: teamId,
    bid_price: price,
    bid_quantity: 1,
    submitted_at: `2026-09-24T10:00:0${index}Z`,
  })));
}

/** Deterministic uniform draws for shuffles in tests. */
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

const exampleBids = { A: [12, 9, 6, 3], B: [10, 7, 4, 1], C: [8, 5, 2] };

test("pay-as-bid charges each winner its own bids; quantities match the uniform auction", () => {
  const uniform = clearAuction(5, unitBids(exampleBids));
  const payAsBid = clearAuction(5, unitBids(exampleBids), { pricing: "pay_as_bid" });
  const byTeam = (cleared) => Object.fromEntries(cleared.allocations.map((row) => [row.team_id, row]));

  assert.equal(payAsBid.clearing_price, 7);
  assert.deepEqual(
    Object.fromEntries(payAsBid.allocations.map((row) => [row.team_id, row.permits_won])),
    Object.fromEntries(uniform.allocations.map((row) => [row.team_id, row.permits_won])),
  );
  assert.equal(byTeam(payAsBid).A.payment, 21);
  assert.equal(byTeam(payAsBid).B.payment, 17);
  assert.equal(byTeam(payAsBid).C.payment, 8);
  assert.equal(byTeam(uniform).A.payment, 14);

  // Bidding MAC under pay-as-bid leaves no surplus on any winning permit.
  const report = studentAuctionReport(5, unitBids(exampleBids), "A", { pricing: "pay_as_bid" });
  assert.equal(report.payment, 21);
  assert.deepEqual(report.own_bids.filter((bid) => bid.won).map((bid) => bid.price_paid), [12, 9]);
});

test("free allocation shares the cap in proportion to baseline, by largest remainder", () => {
  const teams = FIRM_TYPES.slice(0, 4).map((firm, index) => ({ id: `t${index}`, ...firm }));
  // Baselines 10, 8, 12, 6 (total 36); a cap of 22 gives 6.11, 4.89, 7.33, 3.67.
  const allocation = freeAllocation(teams, 22);
  assert.deepEqual(allocation.map((row) => row.permits_won), [6, 5, 7, 4]);
  assert.ok(allocation.every((row) => row.payment === 0));

  for (let cap = 0; cap <= 60; cap += 1) {
    const rows = freeAllocation([...FIRM_TYPES, ...FIRM_TYPES].map((firm, index) => ({ id: `f${index}`, ...firm })), cap);
    assert.equal(rows.reduce((sum, row) => sum + row.permits_won, 0), cap);
  }
});

test("shock factors are balanced thirds of 0.5, 1, 1.5 in random order", () => {
  const factors = drawShockFactors(12, seededRandom(3));
  assert.equal(factors.length, 12);
  for (const factor of SHOCK_FACTORS) {
    assert.equal(factors.filter((value) => value === factor).length, 4);
  }
  assert.notDeepEqual(factors, drawShockFactors(12, seededRandom(4)));
  const seven = drawShockFactors(7, seededRandom(5));
  assert.deepEqual([0.5, 1, 1.5].map((factor) => seven.filter((value) => value === factor).length), [3, 2, 2]);
});

test("a cost shock scales the MAC slope used for costs and scores", () => {
  const team = { id: "T", baseline_emissions: 8, mac_slope: 3, mac_shock_round1: 1.5, mac_shock_round2: 0.5 };
  assert.equal(shockFactor(team, "round1"), 1.5);
  assert.equal(effectiveSlope(team, "round1"), 4.5);
  assert.equal(effectiveSlope(team, "round2"), 1.5);
  assert.equal(shockFactor({ mac_slope: 3 }, "round1"), 1);

  const scored = scoreTeamRound(team, { permits_from_auction: 5, auction_payment: 20, mac_shock: 1.5 });
  assert.equal(scored.abatement_cost, abatementCost(4.5, 3));
  assert.equal(scored.score, grossValue(8, 4.5) - abatementCost(4.5, 3) - 20);
  assert.equal(scored.mac_shock, 1.5);
});

test("banking by over-complying: emit less than you hold and bank the rest", () => {
  const team = { id: "T", baseline_emissions: 8, mac_slope: 2 };
  const scored = scoreTeamRound(team, {
    permits_from_auction: 6,
    emissions_choice: 4,
    banking_enabled: true,
  });
  assert.equal(scored.emissions, 4);
  assert.equal(scored.permits_banked_out, 2);
  assert.equal(scored.abatement_cost, abatementCost(2, 4));

  // Without banking a team uses the permits it holds; the choice cannot waste them.
  const noBank = scoreTeamRound(team, { permits_from_auction: 6, emissions_choice: 4 });
  assert.equal(noBank.emissions, 6);
  assert.equal(noBank.permits_banked_out, 0);

  // With no choice, banking keeps only permits beyond baseline, as before.
  const surplus = scoreTeamRound(team, { permits_from_auction: 11, banking_enabled: true });
  assert.equal(surplus.emissions, 8);
  assert.equal(surplus.permits_banked_out, 3);
});

test("borrowing: emit more than you hold now, owe the difference next round, pay for any shortfall", () => {
  const team = { id: "T", baseline_emissions: 8, mac_slope: 2 };
  const round1 = scoreTeamRound(team, {
    permits_from_auction: 3,
    emissions_choice: 7,
    borrowing_enabled: true,
  });
  assert.equal(round1.emissions, 7);
  assert.equal(round1.permits_borrowed_out, 4);
  assert.equal(round1.abatement_cost, abatementCost(2, 1));

  const noBorrow = scoreTeamRound(team, { permits_from_auction: 3, emissions_choice: 7 });
  assert.equal(noBorrow.emissions, 3);
  assert.equal(noBorrow.permits_borrowed_out, 0);

  const carry = carryIntoRound2({ banking_enabled: true, borrowing_enabled: true }, round1);
  assert.deepEqual(carry, { banked: 0, owed: 4, net: -4 });

  const repaid = scoreTeamRound(team, {
    permits_from_auction: 9,
    permits_owed_in: 4,
    is_final_round: true,
    shortfall_penalty_per_permit: 50,
  });
  assert.equal(repaid.permits_end, 5);
  assert.equal(repaid.emissions, 5);
  assert.equal(repaid.shortfall, 0);

  const short = scoreTeamRound(team, {
    permits_from_auction: 1,
    auction_payment: 5,
    permits_owed_in: 4,
    is_final_round: true,
    shortfall_penalty_per_permit: 50,
  });
  assert.equal(short.permits_end, -3);
  assert.equal(short.emissions, 0);
  assert.equal(short.shortfall, 3);
  assert.equal(short.shortfall_penalty, 150);
  assert.equal(short.score, grossValue(8, 2) - abatementCost(2, 8) - 5 - 150);
});

test("the default penalty exceeds every possible shocked MAC, so repaying beats defaulting", () => {
  const highestMac = Math.max(...FIRM_TYPES.map((firm) => firm.baseline_emissions * firm.mac_slope))
    * Math.max(...SHOCK_FACTORS);
  assert.ok(50 > highestMac, `highest MAC is ${highestMac}`);
});

test("benchmarks use shocked slopes and credit free endowments", () => {
  const teams = FIRM_TYPES.slice(0, 4).map((firm, index) => ({
    id: `t${index}`, ...firm, mac_shock_round1: [0.5, 1.5, 1, 0.5][index],
  }));
  const cap = 22;
  const slopeFor = (team) => effectiveSlope(team, "round1");
  const sold = benchmarkForRound(teams, cap, { slopeFor });
  const endowments = new Map(freeAllocation(teams, cap).map((row) => [row.team_id, row.permits_won]));
  const free = benchmarkForRound(teams, cap, { slopeFor, endowments });

  assert.equal(free.benchmark_price, sold.benchmark_price);
  const totalGross = teams.reduce((sum, team) => sum + grossValue(team.baseline_emissions, slopeFor(team)), 0);
  const permits = new Map(sold.per_team.map((row) => [row.team_id, row.benchmark_permits]));
  const efficientCost = teams.reduce((sum, team) => sum
    + abatementCost(slopeFor(team), team.baseline_emissions - permits.get(team.id)), 0);
  // With free permits, payments only move between firms: benchmarks sum to the avoided cost.
  const freeTotal = free.per_team.reduce((sum, row) => sum + row.benchmark_score, 0);
  assert.ok(Math.abs(freeTotal - (totalGross - efficientCost)) < 1e-6);
  // When sold, the benchmarks sum to avoided cost minus the auction revenue.
  const soldTotal = sold.per_team.reduce((sum, row) => sum + row.benchmark_score, 0);
  assert.ok(Math.abs(soldTotal - (totalGross - efficientCost - sold.benchmark_price * cap)) < 1e-6);
});

test("bid limits: baseline normally, the permits for sale with banking or borrowing", () => {
  const team = { baseline_emissions: 8 };
  assert.equal(bidQuantityLimit({}, team, 40), 8);
  assert.equal(bidQuantityLimit({ banking_enabled: true }, team, 40), 40);
  assert.equal(bidQuantityLimit({ borrowing_enabled: true }, team, 40), 40);
  const bids = Array.from({ length: 12 }, () => ({ bid_price: 5, bid_quantity: 1 }));
  assert.throws(() => validateBidSet(team, bids), /baseline emissions/);
  assert.equal(validateBidSet(team, bids, { maxQuantity: 40 }).length, 12);
  assert.throws(() => validateBidSet(team, bids, { maxQuantity: 10 }), /10 permits for sale/);
});

test("allocation method defaults to uniform and rejects unknown settings", () => {
  assert.equal(allocationMethodForRound({}, "round1"), "uniform");
  assert.equal(allocationMethodForRound({ allocation_round2: "free" }, "round2"), "free");
  assert.equal(allocationMethodForRound({ allocation_round1: "pay_as_bid" }, "round1"), "pay_as_bid");
  assert.equal(allocationMethodForRound({ allocation_round1: "lottery" }, "round1"), "uniform");
});

test("two rounds with every option on conserve permits and cash", () => {
  const teams = [...FIRM_TYPES, ...FIRM_TYPES].map((firm, index) => ({ id: `t${index}`, ...firm }));
  const shocks1 = drawShockFactors(teams.length, seededRandom(21));
  const shocks2 = drawShockFactors(teams.length, seededRandom(22));
  teams.forEach((team, index) => {
    team.mac_shock_round1 = shocks1[index];
    team.mac_shock_round2 = shocks2[index];
  });
  const session = { banking_enabled: true, borrowing_enabled: true, shortfall_penalty: 50 };
  const totalBaseline = teams.reduce((sum, team) => sum + team.baseline_emissions, 0);
  const cap1 = Math.round(totalBaseline * 0.6);
  const cap2 = Math.round(totalBaseline * 0.4);

  // Round 1: free allocation, then trades from the first teams to the next ones.
  const endowments = freeAllocation(teams, cap1);
  const trades1 = [
    { buyer_team_id: "t1", seller_team_id: "t0", price: 6, quantity: 2 },
    { buyer_team_id: "t4", seller_team_id: "t5", price: 7.5, quantity: 1 },
  ];
  const choices = new Map([["t0", 2], ["t1", 8], ["t2", 12], ["t3", 1]]);
  const round1 = teams.map((team) => scoreTeamRound(team, {
    permits_from_auction: endowments.find((row) => row.team_id === team.id).permits_won,
    trades: trades1,
    banking_enabled: true,
    borrowing_enabled: true,
    emissions_choice: choices.get(team.id) ?? null,
    mac_shock: team.mac_shock_round1,
  }));

  // Round 2: pay-as-bid auction with bids at shocked MAC, trades, carry-in.
  const bids2 = teams.flatMap((team) => Array.from({ length: team.baseline_emissions }, (_, index) => ({
    team_id: team.id,
    bid_price: effectiveSlope(team, "round2") * (team.baseline_emissions - index),
    bid_quantity: 1,
    submitted_at: team.id,
  })));
  const cleared2 = clearAuction(cap2, bids2, { pricing: "pay_as_bid" });
  const trades2 = [{ buyer_team_id: "t2", seller_team_id: "t6", price: 9, quantity: 1 }];
  const round2 = teams.map((team, index) => {
    const carry = carryIntoRound2(session, round1[index]);
    const won = cleared2.allocations.find((row) => row.team_id === team.id);
    return scoreTeamRound(team, {
      permits_from_auction: won?.permits_won ?? 0,
      auction_payment: won?.payment ?? 0,
      permits_banked_in: carry.banked,
      permits_owed_in: carry.owed,
      trades: trades2,
      is_final_round: true,
      shortfall_penalty_per_permit: 50,
      mac_shock: team.mac_shock_round2,
    });
  });

  const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key]), 0);
  assert.equal(sum(round1, "market_net_spend"), 0);
  assert.equal(sum(round2, "market_net_spend"), 0);
  assert.equal(sum(round1, "permits_end"), cap1);
  assert.ok(sum(round1, "permits_borrowed_out") > 0);
  assert.ok(sum(round1, "permits_banked_out") > 0);

  // Total emissions over both rounds equal the permits issued, minus permits
  // left unused at the end, plus borrowed emissions never repaid (shortfalls).
  const unusedAtEnd = round2.reduce((total, row, index) => total
    + Math.max(0, row.permits_end - teams[index].baseline_emissions), 0);
  assert.equal(
    sum(round1, "emissions") + sum(round2, "emissions"),
    cap1 + cap2 - unusedAtEnd + sum(round2, "shortfall"),
  );
  assert.equal(sum(round2, "permits_end"), cap2 + sum(round1, "permits_banked_out") - sum(round1, "permits_borrowed_out"));
  assert.equal(sum(round2, "auction_payment"), cleared2.allocations.reduce((total, row) => total + row.payment, 0));
});


test("pay-as-bid rules, what-if payments, and report wording", () => {
  const rules = auctionRulesHtml(5, { pricing: "pay_as_bid" });
  assert.match(rules, /its own bid/);
  assert.match(rules, /\$12 \+ \$9 = <strong>\$21<\/strong>/);
  assert.match(rules, /Acid Rain Program/);

  const firm = { baseline: 8, slope: 2 };
  const outcome = outcomeAtPrice(firm, [16, 14, 12, 10, 8], 11, { pricing: "pay_as_bid" });
  assert.equal(outcome.permitsWon, 3);
  assert.equal(outcome.payment, 42);
  const scored = scoreTeamRound({ id: "T", baseline_emissions: 8, mac_slope: 2 }, {
    permits_from_auction: 3, auction_payment: 42, is_final_round: true,
  });
  assert.equal(outcome.score, scored.score);

  const report = studentAuctionReport(5, unitBids(exampleBids), "B", { pricing: "pay_as_bid" });
  const html = auctionReportHtml(report, "Round 2");
  assert.match(html, /pay as bid/);
  assert.match(html, /Each winner paid its own bids/);
  assert.doesNotMatch(html, /For example, you bid/);
});

test("what-if with owed permits matches the game's Round 2 score and penalty", () => {
  const firm = { baseline: 8, slope: 2, owedIn: 3, penalty: 50, finalRound: true };
  for (const price of [5, 9, 13, 20]) {
    const prices = [18, 15, 12, 9, 6];
    const outcome = outcomeAtPrice(firm, prices, price);
    const scored = scoreTeamRound({ id: "T", baseline_emissions: 8, mac_slope: 2 }, {
      permits_from_auction: outcome.permitsWon,
      auction_payment: outcome.payment,
      permits_owed_in: 3,
      is_final_round: true,
      shortfall_penalty_per_permit: 50,
    });
    assert.equal(outcome.score, scored.score, `price ${price}`);
    assert.equal(outcome.shortfall, scored.shortfall);
  }
});

test("bid boxes: owed permits first, then emissions, then extra permits to bank", () => {
  assert.equal(biddablePermits(8, 0, 3), 11);
  const owed = permitBidInputsHtml(8, [], { owedIn: 3, penalty: 50 });
  assert.equal((owed.match(/repays a borrowed permit\)<\/span>/g) ?? []).length, 3);
  assert.equal((owed.match(/class="permit-bid-price"/g) ?? []).length, 11);
  assert.match(owed, /costs \$50\.00/);

  const withExtra = permitBidInputsHtml(6, [9, 8, 7, 6, 5, 4, 3, 3], { allowMore: true });
  assert.equal((withExtra.match(/class="permit-bid-price"/g) ?? []).length, 8);
  assert.equal((withExtra.match(/extra: bank for Round 2\)<\/span>/g) ?? []).length, 2);
  assert.match(withExtra, /id="add-permit-boxes-btn"/);
  assert.doesNotMatch(permitBidInputsHtml(6, [], {}), /add-permit-boxes-btn/);
});

test("borrowed permits and saved bids cannot create more boxes than the auction accepts", () => {
  const team = { baseline_emissions: 10, mac_slope: 1 };
  for (const cap of [7, 12]) {
    const limit = bidQuantityLimit({ borrowing_enabled: true }, team, cap);
    const html = permitBidInputsHtml(10, Array(14).fill(20), {
      owedIn: 4, penalty: 50, quantityLimit: limit,
    });
    const boxes = (html.match(/class="permit-bid-price"/g) ?? []).length;
    assert.equal(boxes, limit);
    assert.equal((html.match(/repays a borrowed permit\)<\/span>/g) ?? []).length, 4);
    assert.match(html, /additional permits must be bought during trading/);
    assert.doesNotThrow(() => validateBidSet(team,
      Array.from({ length: boxes }, () => ({ bid_price: 20, bid_quantity: 1 })),
      { maxQuantity: limit }));
  }

  const extra = permitBidInputsHtml(6, Array(12).fill(10), {
    allowMore: true, quantityLimit: 8,
  });
  assert.equal((extra.match(/class="permit-bid-price"/g) ?? []).length, 8);
  assert.match(extra, /id="add-permit-boxes-btn"[^>]*disabled/);
});

test("free rounds show each firm its grandfathered permits", () => {
  const html = freeAllocationHtml({ cap: 22, permits: 5, baseline: 8, roundLabel: "Round 1" });
  assert.match(html, /22 permits given away free/);
  assert.match(html, /receive <strong>5 permits<\/strong>/);
});

test("after a shock is revealed, the MAC chart uses the shocked slope and the chosen emissions", () => {
  const state = {
    team: { id: "T", baseline_emissions: 8, mac_slope: 2, display_mac_slope: 3, shocks: { round1: 1.5, round2: null } },
    session: { current_phase: "market1", banking_enabled: true, borrowing_enabled: true },
    market: { holdings: 5, recent_trades: [], score_preview: { emissions: 3 } },
    own_scores: [],
  };
  const model = macModel(state);
  assert.equal(model.slope, 3);
  assert.equal(model.emissions, 3);
  assert.equal(model.cost, abatementCost(3, 5));
  const panel = macPanel(state);
  assert.match(panel, /slope is ×1\.5 this round/);
  assert.match(panel, /Banking and borrowing are on/);
});
