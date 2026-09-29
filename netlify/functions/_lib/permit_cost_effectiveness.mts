import { abatementCost } from "./permit_market.mts";
import { transactionCostBenchmark } from "./permit_transaction_costs.mts";
import { marketStartForTeam } from "./permit_round_start.mts";

/** Measure trading gains against the initial allocation at the same realized costs. */
export function roundCostGap(teams, byTeam, session = {}) {
  if (session.banking_enabled || session.borrowing_enabled) return { status: "across_rounds" };
  let initial = 0;
  let final = 0;
  let efficient = 0;
  let initialEmissions = 0;
  let finalEmissions = 0;
  let efficientEmissions = 0;
  let transactionCost = 0;
  for (const team of teams) {
    const row = byTeam.get(String(team.id));
    if (!row) return null;
    const values = [team.baseline_emissions, team.mac_slope, row.permits_from_auction,
      row.abatement, row.benchmark_permits];
    if (values.some(value => value == null || !Number.isFinite(Number(value)))) return null;
    const baseline = Number(team.baseline_emissions);
    const slope = Number(team.mac_slope) * Number(row.mac_shock ?? 1);
    const intercept = Number(row.mac_intercept ?? team.mac_intercept ?? 0);
    if (!Number.isFinite(intercept) || intercept < 0 || baseline <= 0 || !Number.isFinite(slope) || slope <= 0
      || Number(row.abatement) < 0 || Number(row.abatement) > baseline) return null;
    const initialE = Math.min(baseline, Math.max(0, Number(row.permits_from_auction)));
    const efficientE = Math.min(baseline, Math.max(0, Number(row.benchmark_permits)));
    initial += abatementCost(slope, baseline - initialE, intercept);
    final += abatementCost(slope, Number(row.abatement), intercept);
    efficient += abatementCost(slope, baseline - efficientE, intercept);
    initialEmissions += initialE;
    finalEmissions += baseline - Number(row.abatement);
    efficientEmissions += efficientE;
    const fee = Number(row.transaction_cost ?? 0);
    if (!Number.isFinite(fee) || fee < 0) return null;
    transactionCost += fee;
  }
  // Unused permits can change total emissions; flag this comparison explicitly.
  const sameEmissions = initialEmissions === finalEmissions && initialEmissions === efficientEmissions;
  const gap = initial - efficient;
  if (gap < -1e-8 || final < efficient - 1e-8) return null;
  return {
    status: Math.abs(gap) < 1e-8 ? "initially_cost_effective" : "measured",
    initial_total_cost: initial,
    final_total_cost: final,
    cost_effective_total_cost: efficient,
    gap_closed_percent: Math.abs(gap) < 1e-8 ? null : 100 * (initial - final) / gap,
    same_emissions: sameEmissions,
    transaction_cost: transactionCost,
    total_resource_cost: final + transactionCost,
  };
}

/** Compare final costs and permit holdings with the realized benchmark. */
export function roundCostEffectiveness(teams, scores, session = {}) {
  const reports = [];
  for (const roundKey of ["round1", "round2", "round3"]) {
    const byTeam = new Map((scores ?? [])
      .filter((row) => String(row.round_key) === roundKey)
      .map((row) => [String(row.team_id), row]));
    if (!teams.length || !teams.every((team) => byTeam.has(String(team.id)))) continue;
    let starts;
    if (roundKey === "round3") {
      const sources = new Map((scores ?? []).filter(row => row.round_key === "round2")
        .map(row => [String(row.team_id), row]));
      if (!teams.every(team => sources.has(String(team.id)))) continue;
      starts = new Map(teams.map(team => [String(team.id), marketStartForTeam(session, team, roundKey, [], scores)]));
      // Compare both trading rounds using the saved Round 2 cost curves and
      // starting permits, even if firm settings have subsequently changed.
      for (const team of teams) {
        const id = String(team.id);
        const start = starts.get(id);
        byTeam.set(id, { ...byTeam.get(id), permits_from_auction: start.allocation + start.net,
          mac_shock: start.shock, mac_intercept: start.intercept });
      }
    }
    const comparisons = teams.map((team) => {
      const score = byTeam.get(String(team.id));
      const actualPermits = Number(score.permits_end);
      const costEffectivePermits = Number(score.benchmark_permits);
      return {
        team_id: String(team.id),
        actual_permits: actualPermits,
        cost_effective_permits: costEffectivePermits,
        permit_difference: actualPermits - costEffectivePermits,
      };
    });
    if (comparisons.some((row) => !Number.isFinite(row.actual_permits) || !Number.isFinite(row.cost_effective_permits))) continue;
    const costGap = roundCostGap(teams, byTeam, session);
    const feeBenchmark = roundKey === "round3" && costGap?.final_total_cost != null
      ? transactionCostBenchmark(teams, new Map(teams.map(team => {
        const start = starts.get(String(team.id));
        return [String(team.id), start.allocation + start.net];
      })), {
        transactionCost: 3,
        slopeFor: team => Number(team.mac_slope) * starts.get(String(team.id)).shock,
        interceptFor: team => starts.get(String(team.id)).intercept,
      }) : null;
    reports.push({
      round_key: roundKey,
      achieved: costGap?.final_total_cost != null
        ? Math.abs(costGap.final_total_cost - costGap.cost_effective_total_cost) < 1e-8
        : comparisons.every((row) => row.permit_difference === 0),
      ...(costGap ? { cost_gap: costGap } : {}),
      ...(feeBenchmark ? { fee_adjusted_benchmark: feeBenchmark,
        fee_adjusted_achieved: Math.abs(costGap.total_resource_cost - feeBenchmark.minimum_resource_cost) < 1e-8 } : {}),
      firms_off_allocation: comparisons.filter((row) => row.permit_difference !== 0),
    });
  }
  return reports;
}
