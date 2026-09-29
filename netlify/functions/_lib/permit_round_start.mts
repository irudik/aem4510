import { auctionPhaseForRound, carryIntoRound2, effectiveIntercept, shockFactor } from "./permit_market.mts";

/** Starting permits and realized costs, with Round 3 repeating Round 2 exactly. */
export function marketStartForTeam(session, team, roundKey, allocations, scores) {
  const teamId = String(team.id);
  if (roundKey === "round3") {
    const source = scores.find(row => String(row.round_key) === "round2" && String(row.team_id) === teamId);
    if (!source) throw new Error("Round 3 requires completed Round 2 results for every team.");
    const banked = Number(source.permits_banked_in ?? 0);
    const owed = Number(source.permits_owed_in ?? 0);
    return {
      allocation: Number(source.permits_from_auction ?? 0),
      auctionPayment: Number(source.auction_payment ?? 0),
      banked, owed, net: banked - owed,
      shock: Number(source.mac_shock ?? 1),
      intercept: Number(source.mac_intercept ?? effectiveIntercept(team, "round2")),
    };
  }
  const allocation = allocations.find(row => String(row.round_key) === auctionPhaseForRound(roundKey)
    && String(row.team_id) === teamId);
  const carry = roundKey === "round2" ? carryIntoRound2(session,
    scores.find(row => String(row.round_key) === "round1" && String(row.team_id) === teamId))
    : { banked: 0, owed: 0, net: 0 };
  return {
    allocation: Number(allocation?.permits_won ?? 0),
    auctionPayment: Number(allocation?.payment ?? 0),
    ...carry,
    shock: shockFactor(team, roundKey),
    intercept: effectiveIntercept(team, roundKey),
  };
}
