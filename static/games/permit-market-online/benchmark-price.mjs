const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

/** Show the cost-minimizing price and each firm's corresponding permits. */
export function benchmarkPriceHtml(benchmark) {
  if (!benchmark || benchmark.price == null) {
    return '<p class="note">Cost-effective permit price appears once firm types and the round cap are set.</p>';
  }
  const price = Number(benchmark.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const round = benchmark.round_key === "round2" ? 2 : 1;
  return `<div class="benchmark-price-panel">
    <h3>Cost-effective permit price · Round ${round}</h3>
    <p class="benchmark-price-value">$${price} <span>per permit</span></p>
    ${benchmark.allocations?.length ? `<h4>Cost-effective allocation of permits</h4>
      <div class="table-wrap"><table class="benchmark-allocation-table">
        <thead><tr><th>Firm</th><th>Permits</th></tr></thead>
        <tbody>${benchmark.allocations.map(row => `<tr><td>${escapeHtml(row.team_name)}</td><td>${Number(row.permits)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><th>Total</th><td>${benchmark.allocations.reduce((sum, row) => sum + Number(row.permits), 0)}</td></tr></tfoot>
      </table></div>
      <p class="note">One cost-effective allocation; tied permit values can allow others.</p>` : ""}
    <p>Target from firms' actual MAC curves and this round's cap of ${Number(benchmark.cap)} permits${benchmark.shock_enabled ? (benchmark.after_shock ? ", after the cost shock" : ", before the cost shock") : ""}.</p>
    <p class="note">This is a theoretical benchmark, not the last trade price, auction payment, or midpoint of the bid–ask spread. Remaining buy and sell orders need not meet here.</p>
    <p class="note">With whole permits, several prices can support the same allocation. This benchmark uses the lowest accepted whole-permit value: the abatement cost saved by that permit.</p>
    ${benchmark.across_rounds ? '<p class="note"><strong>Banking/borrowing:</strong> this is a separate-round benchmark. It excludes the value of moving permits across rounds, so it is not the intertemporal equilibrium price.</p>' : ""}
  </div>`;
}
