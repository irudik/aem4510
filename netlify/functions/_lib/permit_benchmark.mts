import { benchmarkForRound, effectiveSlope, effectiveIntercept, roundForPhase, shockRevealed } from "./permit_market.mts";

/** Current-round cost-minimizing price and allocation, independent of orders. */
export function currentCostEffectivePrice(session, teams, scores = []) {
  const phase = String(session.current_phase);
  const thirdRoundScores = new Map(scores.filter(row => row.round_key === "round3").map(row => [String(row.team_id), row]));
  const round = phase === "complete"
    ? teams.length && teams.every(team => thirdRoundScores.has(String(team.id))) ? "round3" : "round2"
    : roundForPhase(phase);
  if (!round || !teams.length || teams.some(team => !team.baseline_emissions)) return null;
  const cap = session[round === "round1" ? "cap_round1" : "cap_round2"];
  if (cap == null || !Number.isFinite(Number(cap)) || Number(cap) <= 0) return null;
  const savedCosts = new Map(scores.filter(row => row.round_key === "round2").map(row => [String(row.team_id), row]));
  if (round === "round3" && !teams.every(team => savedCosts.has(String(team.id)))) return null;
  const afterShock = round === "round3" || shockRevealed(session, round, phase);
  const benchmark = benchmarkForRound(teams, Number(cap), {
    slopeFor: team => round === "round3"
      ? Number(team.mac_slope) * Number(savedCosts.get(String(team.id)).mac_shock ?? 1)
      : afterShock ? effectiveSlope(team, round) : Number(team.mac_slope),
    interceptFor: team => round === "round3"
      ? Number(savedCosts.get(String(team.id)).mac_intercept ?? effectiveIntercept(team, "round2"))
      : afterShock ? effectiveIntercept(team, round) : Number(team.mac_intercept ?? 0),
  });
  const names = new Map(teams.map(team => [String(team.id), String(team.team_name ?? "")]));
  const allocations = benchmark.per_team.map(row => ({
    team_id: row.team_id,
    team_name: names.get(row.team_id) ?? "",
    permits: row.benchmark_permits,
  }));
  return { round_key: round, cap: Number(cap), price: benchmark.benchmark_price, allocations,
    price_basis: benchmark.price_basis,
    after_shock: afterShock,
    ...(round === "round3" ? { no_fee: true } : {}),
    shock_enabled: Boolean(session[round === "round1" ? "shock_round1" : "shock_round2"]),
    across_rounds: Boolean(session.banking_enabled || session.borrowing_enabled) };
}
