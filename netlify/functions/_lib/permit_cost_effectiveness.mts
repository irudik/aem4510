/** Compare final permit holdings with the realized cost-effective allocation. */
export function roundCostEffectiveness(teams, scores) {
  const reports = [];
  for (const roundKey of ["round1", "round2"]) {
    const byTeam = new Map((scores ?? [])
      .filter((row) => String(row.round_key) === roundKey)
      .map((row) => [String(row.team_id), row]));
    if (!teams.length || !teams.every((team) => byTeam.has(String(team.id)))) continue;
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
    reports.push({
      round_key: roundKey,
      achieved: comparisons.every((row) => row.permit_difference === 0),
      firms_off_allocation: comparisons.filter((row) => row.permit_difference !== 0),
    });
  }
  return reports;
}
