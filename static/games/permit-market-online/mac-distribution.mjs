const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Shared bins preserve firm counts and permit direct before/after comparison. */
export function macHistogram(report) {
  const final = report.macs.map(row => Number(row.mac));
  const initial = (report.initial_macs ?? []).map(row => Number(row.mac));
  const upper = Math.max(1, Number(report.benchmark_price ?? 0), ...final, ...initial) * 1.1;
  const bins = 10;
  const width = upper / bins;
  const counts = values => {
    const result = Array(bins).fill(0);
    for (const value of values) result[Math.max(0, Math.min(bins - 1, Math.floor(value / width)))]++;
    return result;
  };
  return { upper, width, final: counts(final), initial: counts(initial) };
}

/** Closed-phase histograms, newest first, retain earlier round results. */
export function macDistributionsHtml(reports = []) {
  if (!reports.length) return '<p class="note">Close an auction or market phase to see the distribution of firms’ MACs.</p>';
  return [...reports].reverse().map(report => {
    const model = macHistogram(report);
    const peak = Math.max(1, ...model.final, ...model.initial);
    const x = value => 60 + value / model.upper * 610;
    const y = count => 270 - count / peak * 195;
    const initial = report.initial_macs.length > 0;
    const market = report.phase.startsWith("market");
    const round = report.round_key === "round2" ? 2 : 1;
    const title = `Round ${round}: ${market ? "after trading" : report.free_allocation ? "initial free allocation" : "after the auction"}`;
    const bar = (counts, background) => counts.map((count, i) => {
      const left = x(i * model.width);
      const full = 610 / 10;
      const inset = background ? 1 : initial ? full * 0.2 : 3;
      return `<rect class="mac-hist-bar ${background ? "mac-hist-initial" : "mac-hist-final"}" x="${left + inset}" y="${y(count)}" width="${full - 2 * inset}" height="${270 - y(count)}"><title>${background ? "Initial" : "Final"}: ${count} firms, MAC $${(i * model.width).toFixed(2)}–$${((i + 1) * model.width).toFixed(2)}</title></rect>`;
    }).join("");
    const price = Number(report.benchmark_price);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => `<text x="${x(f * model.upper)}" y="295" text-anchor="middle">${(f * model.upper).toFixed(1)}</text>`).join("");
    const grid = [...new Set([0, Math.ceil(peak / 2), peak])].map(n => `<line x1="60" x2="670" y1="${y(n)}" y2="${y(n)}" stroke="#d8e2e8"/><text x="50" y="${y(n) + 5}" text-anchor="end">${n}</text>`).join("");
    return `<section class="mac-distribution"><h3>${title}</h3>
      <p><strong>Cost-effective price: $${price.toFixed(2)} per permit</strong> (vertical line)</p>
      <p class="note">${initial ? "Light bars: initial free allocation. Dark bars: after trading. Both use the same realized MAC curves, so the comparison isolates changes in emissions." : market ? "Dark bars: firms’ MACs at final emissions." : "Bars: firms’ MACs at the permit allocation, before any cost shock."}</p>
      <svg class="mac-hist-chart" viewBox="0 0 720 335" role="img" aria-label="${title}. Histogram of firm marginal abatement costs. Cost-effective price $${price.toFixed(2)}.">
        <text x="60" y="28">Number of firms</text>${grid}${initial ? bar(model.initial, true) : ""}${bar(model.final, false)}
        <line class="mac-hist-price" x1="${x(price)}" x2="${x(price)}" y1="55" y2="270"/>
        ${ticks}<text x="365" y="326" text-anchor="middle">Firm MAC ($ per permit)</text>
      </svg>
      <p class="note">MAC is the cost of the last unit abated (zero with no abatement). Whole permits and firms at their emissions limits can leave MACs away from the price even when no cost-saving trade remains.${report.across_rounds ? " The price line is a separate-round benchmark, excluding banking and borrowing incentives." : ""}</p>
      <details><summary>Exact firm MACs</summary><div class="table-wrap"><table><thead><tr><th>Firm</th>${initial ? "<th>Initial MAC</th>" : ""}<th>${market ? "Final" : "Allocated"} MAC</th></tr></thead><tbody>${report.macs.map((row, i) => `<tr><td>${escapeHtml(row.team_name)}</td>${initial ? `<td>$${Number(report.initial_macs[i].mac).toFixed(2)}</td>` : ""}<td>$${Number(row.mac).toFixed(2)}</td></tr>`).join("")}</tbody></table></div></details>
    </section>`;
  }).join("");
}
