import { abatementCost } from "./permit_market.mts";

/** Buyer-paid resource cost per permit in the repeated third-round market. */
export function roundTransactionCost(roundKey) {
  return roundKey === "round3" ? 3 : 0;
}

/**
 * Minimize abatement plus the cost of transfers from the starting allocation.
 * A permit moved once incurs one buyer fee. Dynamic programming compares every
 * feasible integer emission choice while conserving the initial permit total.
 * This is a resource-cost benchmark: permit payments are transfers between firms.
 */
export function transactionCostBenchmark(teams, startingHoldings, {
  transactionCost = 3,
  slopeFor = team => Number(team.mac_slope),
  interceptFor = team => Number(team.mac_intercept ?? 0),
} = {}) {
  const fee = Number(transactionCost);
  if (!teams?.length || !Number.isFinite(fee) || fee < 0) return null;
  const firms = teams.map(team => ({
    id: String(team.id),
    baseline: Number(team.baseline_emissions),
    initial: Number(startingHoldings.get(String(team.id))),
    slope: slopeFor(team),
    intercept: interceptFor(team),
  }));
  if (new Set(firms.map(firm => firm.id)).size !== firms.length
    || firms.some(firm => !Number.isInteger(firm.baseline) || firm.baseline < 0
      || !Number.isInteger(firm.initial) || firm.initial < 0 || firm.initial > firm.baseline
      || !Number.isFinite(firm.slope) || firm.slope <= 0 || !Number.isFinite(firm.intercept)
      || firm.intercept < 0)) return null;
  const cap = firms.reduce((sum, firm) => sum + firm.initial, 0);
  let costs = new Array(cap + 1).fill(Infinity);
  costs[0] = 0;
  const choices = [];
  for (const firm of firms) {
    const nextCosts = new Array(cap + 1).fill(Infinity);
    const emissionsAtTotal = new Array(cap + 1).fill(-1);
    for (let total = 0; total <= cap; total++) {
      if (!Number.isFinite(costs[total])) continue;
      for (let emissions = 0; emissions <= Math.min(firm.baseline, cap - total); emissions++) {
        const cost = costs[total] + abatementCost(firm.slope, firm.baseline - emissions, firm.intercept)
          + fee * Math.max(0, emissions - firm.initial);
        if (cost < nextCosts[total + emissions]) {
          nextCosts[total + emissions] = cost;
          emissionsAtTotal[total + emissions] = emissions;
        }
      }
    }
    costs = nextCosts;
    choices.push(emissionsAtTotal);
  }
  let remaining = cap;
  const allocations = new Array(firms.length);
  for (let index = firms.length - 1; index >= 0; index--) {
    const emissions = choices[index][remaining];
    allocations[index] = { team_id: firms[index].id, permits: emissions };
    remaining -= emissions;
  }
  const abatement = firms.reduce((sum, firm, index) => sum
    + abatementCost(firm.slope, firm.baseline - allocations[index].permits, firm.intercept), 0);
  const transfers = firms.reduce((sum, firm, index) => sum
    + Math.max(0, allocations[index].permits - firm.initial), 0);
  return {
    minimum_resource_cost: abatement + fee * transfers,
    abatement_cost: abatement,
    transaction_cost: fee * transfers,
    allocations,
  };
}
