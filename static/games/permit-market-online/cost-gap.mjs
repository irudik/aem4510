/** Describe the share of initial excess abatement cost eliminated in a round. */
export function costGapHtml(report) {
  const gap = report.cost_gap;
  if (!gap) return "";
  if (gap.status === "across_rounds") {
    return '<p class="note">Gap closed: not reported with banking or borrowing, which moves emissions between rounds.</p>';
  }
  const money = value => "$" + Number(value).toFixed(2);
  const feeBenchmark = report.fee_adjusted_benchmark;
  const feeSummary = report.round_key === "round3" && feeBenchmark
    ? `<p><strong>The market ${report.fee_adjusted_achieved ? "did" : "did not"} minimize abatement plus transaction costs.</strong>
      Minimum total resource cost: ${money(feeBenchmark.minimum_resource_cost)}.</p>` : "";
  const percent = Number(gap.gap_closed_percent);
  const headline = gap.status === "initially_cost_effective"
    ? (Math.abs(gap.final_total_cost - gap.initial_total_cost) < 1e-8
      ? "The initial allocation was already cost-effective; total abatement cost stayed at the minimum."
      : "The initial allocation was already cost-effective; trading increased total abatement cost.")
    : (percent < 0
      ? `Trading widened the initial abatement-cost gap by ${Math.abs(percent).toFixed(1)}%.`
      : `Trading closed ${percent.toFixed(1)}% of the initial gap to cost-effective total abatement cost.`);
  return `<div class="cost-gap-summary"><h4>Open-market cost reductions</h4><p><strong>${headline}</strong></p>
    <p>Total abatement cost: initial ${money(gap.initial_total_cost)} → final ${money(gap.final_total_cost)}.
      Cost-effective: ${money(gap.cost_effective_total_cost)}.</p>
    ${report.round_key === "round3" ? `<p>Transaction costs: ${money(gap.transaction_cost ?? report.transaction_cost ?? 0)}. Total resource cost (abatement + transaction costs): ${money(gap.total_resource_cost ?? (Number(gap.final_total_cost) + Number(gap.transaction_cost ?? report.transaction_cost ?? 0)))}.</p><p class="note">The percentage measures abatement-cost reductions before transaction costs.</p>` : ""}
    ${feeSummary}
    ${gap.same_emissions === false ? '<p class="note">Total emissions differ across these allocations, so this comparison also reflects unsold or unused permits.</p>' : ""}
    <details><summary>How this is calculated</summary>
      <p>100 × (initial cost − final cost) ÷ (initial cost − cost-effective cost).
      Initial cost uses the permits held when the open market opened.
      All three totals use the same realized MACs, including any cost change at market opening.
      This measures the class's gains from open-market trading. Auction and trade payments are excluded.</p>
      ${gap.status === "initially_cost_effective" ? "<p>No percentage is defined when the initial cost gap is zero.</p>" : ""}
    </details></div>`;
}
