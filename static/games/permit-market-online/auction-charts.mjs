import { macModel } from "./mac-view.mjs";

const COLORS = ["#b74364", "#25769b", "#378057", "#8050a1", "#ac661d", "#596580"];
const DASHES = ["", "9 3", "3 3", "12 3 3 3", "7 3", "2 4"];
const dollars = (value) => value == null ? "No bids yet" : `$${Number(value).toFixed(2)}`;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

/** Keep each firm's MAC on its own emissions axis; do not sum quantities. */
export function firmMacCurves(teams) {
  return (teams ?? []).flatMap((team) => {
    const model = macModel({ team, session: {} });
    return model ? [{ id: String(team.id), name: String(team.team_name ?? "Unnamed team"),
      baseline: model.baseline, slope: model.slope, steps: model.steps }] : [];
  });
}

/** Identical firm curves coincide, so label all their teams on one line. */
export function groupFirmCurves(curves) {
  const groups = new Map();
  for (const curve of curves) {
    const key = `${curve.baseline}:${curve.slope}`;
    if (!groups.has(key)) groups.set(key, { ...curve, names: [], teamIds: [] });
    groups.get(key).names.push(curve.name);
    groups.get(key).teamIds.push(curve.id);
  }
  return [...groups.values()].sort((a, b) => a.baseline - b.baseline || a.slope - b.slope)
    .map((curve, index) => ({ ...curve, color: COLORS[index % COLORS.length],
      dash: DASHES[index % DASHES.length] }));
}

/** Use the same vertical scale for aggregate MAC, bids, and individual MACs. */
export function auctionComparisonModel(state, roundKey) {
  const chart = state?.auction_charts?.[roundKey];
  if (!chart) return null;
  const curves = firmMacCurves(state.teams);
  const toSteps = (stack) => (stack ?? []).map((step) => ({
    from: Number(step.from_quantity), to: Number(step.to_quantity), cost: Number(step.price),
  }));
  const aggregate = toSteps(chart.true_demand_stack);
  const bids = toSteps(chart.bid_stack);
  const price = (value) => value == null ? null : Number(value);
  const clearingPrice = price(chart.clearing_price);
  const benchmarkPrice = price(chart.benchmark_price);
  const maxCost = Math.ceil(Math.max(1, clearingPrice ?? 0, benchmarkPrice ?? 0,
    ...aggregate.map((step) => step.cost), ...bids.map((step) => step.cost),
    ...curves.flatMap((curve) => curve.steps.map((step) => step.cost))) * 1.1 / 4) * 4;
  return { curves, groups: groupFirmCurves(curves), aggregate, bids, maxCost,
    cap: Number(chart.cap), clearingPrice, benchmarkPrice, live: Boolean(chart.is_live),
    pricing: chart.pricing ?? "uniform", shock: Boolean(chart.shock),
    totalBidQuantity: Number(chart.total_bid_quantity),
    aggregateMax: Math.max(1, Number(chart.cap) * 1.08, ...aggregate.map((step) => step.to), ...bids.map((step) => step.to)),
    firmMax: Math.max(1, ...curves.map((curve) => curve.baseline)) };
}

/** Draw whole-unit MAC curves and the auction price comparisons. */
function comparisonSvg(model, individual, id) {
  const left = 52;
  const right = 592;
  const top = 42;
  const bottom = 294;
  const maximum = individual ? model.firmMax : model.aggregateMax;
  const x = (quantity) => left + quantity / maximum * (right - left);
  const y = (cost) => bottom - cost / model.maxCost * (bottom - top);
  const curvePath = (steps) => steps.map((step, index) =>
    `${index ? "L" : "M"} ${x(step.from)} ${y(step.cost)} L ${x(step.to)} ${y(step.cost)}`).join(" ");
  const path = (steps, color, dash = "", name = "") => `<path d="${curvePath(steps)}"
    fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${dash}"><title>${escapeHtml(name)}</title></path>`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const grid = ticks.map((share) => `<line class="mac-grid-line" x1="${left}" x2="${right}" y1="${y(model.maxCost * share)}" y2="${y(model.maxCost * share)}" />
    <text x="${left - 10}" y="${y(model.maxCost * share) + 5}" text-anchor="end">${model.maxCost * share}</text>`).join("");
  const quantityTicks = [...new Set(ticks.map((share) => Math.round(maximum * share)))];
  const prices = [[model.benchmarkPrice, "#718096", "2 5"], [model.clearingPrice, "#17212f", "9 5"]]
    .filter(([price]) => price !== null)
    .map(([price, color, dash]) => `<line x1="${left}" x2="${right}" y1="${y(price)}" y2="${y(price)}"
      stroke="${color}" stroke-width="2" stroke-dasharray="${dash}" />`).join("");
  const cap = individual ? "" : `<line x1="${x(model.cap)}" x2="${x(model.cap)}" y1="${top}" y2="${bottom}"
    stroke="#b01b2f" stroke-width="2" />
    <text x="${x(model.cap)}" y="${top - 8}" text-anchor="middle" fill="#b01b2f">Cap: ${model.cap}</text>`;
  const curves = individual
    ? model.groups.map((curve) => path(curve.steps, curve.color, curve.dash, curve.names.join(", "))).join("")
    : path(model.aggregate, "#ca5670", "", "Aggregate MAC") + path(model.bids, "#0d5bd7", "", "Submitted bids");
  const title = individual ? "Individual firm MAC curves" : "Aggregate MAC and auction bids";
  const description = individual
    ? `${model.curves.length} firms, each measured against its own emissions. Identical curves coincide and share a legend entry.`
    : `The aggregate MAC horizontally sums the firms' curves. The cap is ${model.cap} permits.`;
  return `<svg class="auction-mac-chart" viewBox="0 0 620 355" role="img" aria-labelledby="${id}-title ${id}-desc">
    <title id="${id}-title">${title}</title><desc id="${id}-desc">${description}</desc>
    <text class="mac-axis-label" x="${left}" y="21">MAC / price ($ per unit)</text>
    ${grid}${curves}${cap}${prices}
    <line class="mac-axis" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" />
    <line class="mac-axis" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" />
    ${quantityTicks.map((quantity) => `<text x="${x(quantity)}" y="${bottom + 23}" text-anchor="middle">${quantity}</text>`).join("")}
    <text class="mac-axis-label" x="${(left + right) / 2}" y="345" text-anchor="middle">${individual ? "Firm emissions, Eᵢ (units)" : "Total emissions / permits (units)"}</text>
  </svg>`;
}

/** Render the same two charts in the dashboard and the projection window. */
export function auctionComparisonHtml(state, roundKey, { popoutLink = true } = {}) {
  const model = auctionComparisonModel(state, roundKey);
  if (!model) return "<p class=\"mac-note\">The charts appear when this auction opens and firms have been assigned.</p>";
  const round = roundKey === "auction2" ? 2 : 1;
  return `<section class="auction-round">
    <div class="auction-heading"><h3>Round ${round} auction ${model.live ? '<span class="badge">Live bids</span>' : ''}</h3>
      ${popoutLink ? `<a class="chart-popout-link" href="/games/permit-market-online/auction-view.html?round=${roundKey}" target="_blank" rel="noopener">Pop out MAC charts</a>` : ''}
    </div>
    <p class="auction-summary">${model.totalBidQuantity} permits bid for a cap of ${model.cap}.</p>
    <div class="auction-prices">
      <span><i class="auction-price-key"></i>${model.pricing === "pay_as_bid"
        ? (model.live ? "Lowest winning bid if closed now" : "Lowest winning bid (pay as bid)")
        : (model.live ? "Clearing price if closed now" : "Auction clearing price")}: <strong>${dollars(model.clearingPrice)}</strong></span>
      <span><i class="auction-benchmark-key"></i>Cost-effective price before any shock: <strong>${dollars(model.benchmarkPrice)}</strong></span>
    </div>
    <div class="auction-comparison">
      <figure class="auction-figure"><h4>Aggregate MAC &amp; auction bids</h4>
        ${comparisonSvg(model, false, `${roundKey}-aggregate`)}
        <figcaption class="auction-legend">
          <span><i class="mac-key mac-key-curve"></i>Aggregate MAC</span>
          <span><i class="auction-bid-key"></i>Submitted bids</span>
          <span><i class="auction-cap-key"></i>Cap</span>
        </figcaption>
        <p class="mac-note">At each price, add the firms' emissions horizontally to obtain aggregate MAC.</p>
      </figure>
      <figure class="auction-figure"><h4>Individual firm MACs</h4>
        ${comparisonSvg(model, true, `${roundKey}-firms`)}
        <figcaption class="firm-curve-legend">${model.groups.map((curve) => `<span>
          <svg viewBox="0 0 36 12" aria-hidden="true"><line x1="0" x2="36" y1="6" y2="6" stroke="${curve.color}" stroke-width="3" stroke-dasharray="${curve.dash}" /></svg>
          <span>${escapeHtml(curve.names.join(", "))} <small>(E₀ = ${curve.baseline}, c = ${curve.slope})</small></span>
        </span>`).join("")}</figcaption>
        <p class="mac-note">Each curve uses that firm's own emissions, not cumulative class emissions.
          Firms with identical MACs share a curve; every team is listed.</p>
      </figure>
    </div>
    ${model.shock ? '<p class="mac-note">This round has a cost shock: MACs shown are before the shock, which is what bidders knew. Scored benchmarks use the shocked MACs.</p>' : ""}
    <p class="mac-note auction-reading-note">Both graphs use the same price scale. Steps represent whole permits; firms can have no gains from trading when price lies between adjacent MAC steps.
      ${state.session?.banking_enabled ? "The benchmark measures current-round abatement costs and excludes the future value of banked permits." : ""}</p>
  </section>`;
}
