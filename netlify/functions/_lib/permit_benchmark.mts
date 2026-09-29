import { benchmarkForRound, effectiveSlope, roundForPhase, shockRevealed } from "./permit_market.mts";

/** Current-round cost-minimizing price and allocation, independent of orders. */
export function currentCostEffectivePrice(session, teams) {
  const phase = String(session.current_phase);
  const round = phase === "complete" ? "round2" : roundForPhase(phase);
  if (!round || !teams.length || teams.some(team => !team.baseline_emissions)) return null;
  const cap = session[round === "round1" ? "cap_round1" : "cap_round2"];
  if (cap == null || !Number.isFinite(Number(cap)) || Number(cap) <= 0) return null;
  const afterShock = shockRevealed(session, round, phase);
  const benchmark = benchmarkForRound(teams, Number(cap), {
    slopeFor: team => afterShock ? effectiveSlope(team, round) : Number(team.mac_slope),
  });
  const names = new Map(teams.map(team => [String(team.id), String(team.team_name ?? "")]));
  const allocations = benchmark.per_team.map(row => ({
    team_id: row.team_id,
    team_name: names.get(row.team_id) ?? "",
    permits: row.benchmark_permits,
  }));
  return { round_key: round, cap: Number(cap), price: benchmark.benchmark_price, allocations,
    after_shock: afterShock,
    shock_enabled: Boolean(session[round === "round1" ? "shock_round1" : "shock_round2"]),
    across_rounds: Boolean(session.banking_enabled || session.borrowing_enabled) };
}
