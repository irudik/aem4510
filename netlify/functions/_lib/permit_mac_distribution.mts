import { allocationMethodForRound, benchmarkForRound, carryIntoRound2 } from "./permit_market.mts";

/** Compare final MACs with initial holdings, using the same realized costs. */
export function closedMacDistributions(session, teams, results, allocations, scores) {
  if (!teams.length || teams.some(team => !team.baseline_emissions)) return [];
  const reports = [];
  for (const round of ["round1", "round2"]) {
    const auction = round === "round1" ? "auction1" : "auction2";
    const market = round === "round1" ? "market1" : "market2";
    const result = results.find(row => row.round_key === auction);
    if (!result) continue;
    const free = allocationMethodForRound(session, round) === "free";
    const allocationByTeam = new Map(allocations.filter(row => row.round_key === auction).map(row => [String(row.team_id), row]));
    const scoreByTeam = new Map(scores.filter(row => row.round_key === round).map(row => [String(row.team_id), row]));
    const priorByTeam = new Map(scores.filter(row => row.round_key === "round1").map(row => [String(row.team_id), row]));
    const holdings = team => Number(allocationByTeam.get(String(team.id))?.permits_won ?? 0)
      + (round === "round2" ? carryIntoRound2(session, priorByTeam.get(String(team.id))).net : 0);
    const mac = (team, permits, slope) => slope * Math.max(0, Number(team.baseline_emissions) - Math.max(0, permits));
    const values = teams.map(team => ({ team_name: team.team_name, mac: mac(team, holdings(team), Number(team.mac_slope)) }));
    const common = { round_key: round, free_allocation: free,
      across_rounds: Boolean(session.banking_enabled || session.borrowing_enabled) };
    reports.push({ ...common, phase: auction, phase_closed: true, macs: values, initial_macs: [],
      benchmark_price: benchmarkForRound(teams, Number(result.cap)).benchmark_price });
    // Incomplete scoring must not look like a finalized distribution.
    if (!teams.every(team => scoreByTeam.has(String(team.id)))) continue;
    const finalMacs = teams.map(team => {
      const score = scoreByTeam.get(String(team.id));
      return { team_name: team.team_name, mac: Number(team.mac_slope) * Number(score.mac_shock ?? 1) * Number(score.abatement) };
    });
    const initialMacs = free ? teams.map(team => {
      const score = scoreByTeam.get(String(team.id));
      return { team_name: team.team_name, mac: mac(team, holdings(team), Number(team.mac_slope) * Number(score.mac_shock ?? 1)) };
    }) : [];
    reports.push({ ...common, phase: market, phase_closed: true, macs: finalMacs, initial_macs: initialMacs,
      benchmark_price: Number(scoreByTeam.values().next().value.benchmark_price) });
  }
  return reports;
}
