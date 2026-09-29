import { allocationMethodForRound, benchmarkForRound, carryIntoRound2 } from "./permit_market.mts";
import { marketStartForTeam } from "./permit_round_start.mts";

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
    const mac = (team, permits, slope, intercept = Number(team.mac_intercept ?? 0)) => intercept + slope * Math.max(0, Number(team.baseline_emissions) - Math.max(0, permits));
    const values = teams.map(team => ({ team_name: team.team_name, mac: mac(team, holdings(team), Number(team.mac_slope)) }));
    // Allocation results remain visible while students trade, but the benchmark
    // is revealed only once this round's trading has been scored for every firm.
    const tradingClosed = teams.every(team => scoreByTeam.has(String(team.id)));
    const common = { round_key: round, free_allocation: free, benchmark_visible: tradingClosed,
      across_rounds: Boolean(session.banking_enabled || session.borrowing_enabled) };
    reports.push({ ...common, phase: auction, phase_closed: true, macs: values, initial_macs: [],
      benchmark_price: benchmarkForRound(teams, Number(result.cap)).benchmark_price });
    // Incomplete scoring must not look like a finalized distribution.
    if (!teams.every(team => scoreByTeam.has(String(team.id)))) continue;
    const finalMacs = teams.map(team => {
      const score = scoreByTeam.get(String(team.id));
      return { team_name: team.team_name, mac: Number(score.mac_intercept ?? team.mac_intercept ?? 0) + Number(team.mac_slope) * Number(score.mac_shock ?? 1) * Number(score.abatement) };
    });
    const initialMacs = free ? teams.map(team => {
      const score = scoreByTeam.get(String(team.id));
      return { team_name: team.team_name, mac: mac(team, holdings(team), Number(team.mac_slope) * Number(score.mac_shock ?? 1), Number(score.mac_intercept ?? team.mac_intercept ?? 0)) };
    }) : [];
    reports.push({ ...common, phase: market, phase_closed: true, macs: finalMacs, initial_macs: initialMacs,
      benchmark_price: Number(scoreByTeam.values().next().value.benchmark_price) });
  }
  const round2Scores = new Map(scores.filter(row => row.round_key === "round2").map(row => [String(row.team_id), row]));
  const round3Scores = new Map(scores.filter(row => row.round_key === "round3").map(row => [String(row.team_id), row]));
  if (teams.every(team => round2Scores.has(String(team.id)) && round3Scores.has(String(team.id)))) {
    const startFor = team => marketStartForTeam(session, team, "round3", allocations, scores);
    const macAt = (team, abatement) => {
      const start = startFor(team);
      return start.intercept + Number(team.mac_slope) * start.shock * abatement;
    };
    reports.push({ round_key: "round3", phase: "market3", phase_closed: true,
      free_allocation: false, benchmark_visible: true, no_fee: true,
      across_rounds: Boolean(session.banking_enabled || session.borrowing_enabled),
      macs: teams.map(team => ({ team_name: team.team_name,
        mac: macAt(team, Number(round3Scores.get(String(team.id)).abatement)) })),
      initial_macs: teams.map(team => {
        const start = startFor(team);
        const emissions = Math.min(Number(team.baseline_emissions), Math.max(0, start.allocation + start.net));
        return { team_name: team.team_name, mac: macAt(team, Number(team.baseline_emissions) - emissions) };
      }),
      benchmark_price: Number(round3Scores.values().next().value.benchmark_price),
    });
  }
  return reports;
}
