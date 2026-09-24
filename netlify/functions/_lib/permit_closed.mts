/** Stored results distinguish finalization from a timer that merely expired. */
export function phaseIsClosed(phase, teams, results, scores) {
  if (phase === "auction1" || phase === "auction2") {
    return results.some((row) => String(row.round_key) === phase);
  }
  if (phase === "market1" || phase === "market2") {
    const round = phase === "market1" ? "round1" : "round2";
    const scored = new Set(scores.filter((row) => String(row.round_key) === round)
      .map((row) => String(row.team_id)));
    return teams.length > 0 && teams.every((team) => scored.has(String(team.id)));
  }
  return false;
}
