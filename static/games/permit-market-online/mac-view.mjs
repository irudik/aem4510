/** Describe the firm's MAC in emissions units, including its current position. */
export function macModel(state) {
  const baseline = Number(state?.team?.baseline_emissions);
  // After a cost shock is revealed, the chart uses the shocked slope.
  const slope = Number(state?.team?.display_mac_slope ?? state?.team?.mac_slope);
  if (!Number.isInteger(baseline) || baseline <= 0 || !Number.isFinite(slope) || slope <= 0) {
    return null;
  }

  // Reducing emissions from E + 1 to E costs c * (E0 - E).
  // The area to the right of current emissions equals total abatement cost.
  const steps = Array.from({ length: baseline }, (_, emissions) => ({
    from: emissions,
    to: emissions + 1,
    cost: slope * (baseline - emissions),
  }));
  const finalScore = state.session.current_phase === "complete"
    ? state.own_scores?.find((row) => row.round_key === "round2")
    : null;
  const rawHoldings = state.market?.holdings ?? finalScore?.permits_end;
  const hasPosition = rawHoldings != null && Number.isFinite(Number(rawHoldings));
  const holdings = hasPosition ? Math.max(0, Math.floor(Number(rawHoldings))) : null;
  // Emissions follow the permits held unless the game reports them directly:
  // a Round 1 choice to bank or borrow, or the final Round 2 outcome.
  const reportedEmissions = state.market?.score_preview?.emissions ?? finalScore?.emissions;
  const emissions = !hasPosition ? null
    : (reportedEmissions != null && Number.isFinite(Number(reportedEmissions))
      ? Math.min(baseline, Math.max(0, Math.floor(Number(reportedEmissions))))
      : Math.min(baseline, holdings));
  const abatement = hasPosition ? baseline - emissions : null;
  const cost = hasPosition ? slope * abatement * (abatement + 1) / 2 : null;

  // An observed trade price is a comparison, not a claim of equilibrium.
  const lastTradePrice = state.market?.recent_trades?.[0]?.price;
  const auctionPrice = state.market ? state.auction_result?.clearing_price : null;
  const rawPrice = lastTradePrice ?? auctionPrice;
  const price = rawPrice != null && Number.isFinite(Number(rawPrice)) && Number(rawPrice) >= 0
    ? Number(rawPrice) : null;
  const priceLabel = price === null ? null
    : (lastTradePrice != null ? "Latest trade price" : "Auction clearing price");

  return { baseline, slope, steps, holdings, emissions, abatement, cost, price, priceLabel,
    final: Boolean(finalScore) };
}

/** Draw whole-unit MAC steps on the same emissions axis used in lecture. */
export function macChart(model) {
  const { baseline, slope, steps, emissions, price } = model;
  const left = 58;
  const right = 588;
  const top = 38;
  const bottom = 278;
  const maximumCost = Math.ceil(Math.max(slope * baseline, price ?? 0) * 1.1 / 4) * 4;
  const x = (value) => left + value / baseline * (right - left);
  const y = (value) => bottom - value / maximumCost * (bottom - top);
  const display = (value) => Number(value.toFixed(2));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((share) => {
    const value = maximumCost * share;
    return `<line class="mac-grid-line" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" />
      <text x="${left - 10}" y="${y(value) + 5}" text-anchor="end">${display(value)}</text>`;
  }).join("");
  const xTicks = Array.from({ length: baseline + 1 }, (_, index) => index)
    .filter((value) => value % 2 === 0 || value === baseline)
    .map((value) => `<text x="${x(value)}" y="${bottom + 23}" text-anchor="middle">${value}</text>`)
    .join("");
  const shadedCost = emissions === null ? "" : steps
    .filter((step) => step.from >= emissions)
    .map((step) => `<rect class="mac-cost-area" x="${x(step.from)}" y="${y(step.cost)}"
      width="${x(step.to) - x(step.from)}" height="${bottom - y(step.cost)}" />`).join("");
  const curve = steps.map((step, index) => `${index === 0 ? "M" : "L"} ${x(step.from)} ${y(step.cost)} L ${x(step.to)} ${y(step.cost)}`).join(" ");
  const priceLine = price === null ? "" : `<line class="mac-price-line" x1="${left}" x2="${right}"
    y1="${y(price)}" y2="${y(price)}" />`;
  const positionLine = emissions === null ? "" : `<line class="mac-position-line" x1="${x(emissions)}"
    x2="${x(emissions)}" y1="${top}" y2="${bottom}" />`;
  const positionDescription = emissions === null ? "Emissions have not yet been allocated."
    : `Emissions are ${emissions}, abatement is ${model.abatement}, and abatement cost is ${model.cost}.`;

  return `<svg class="mac-chart" viewBox="0 0 620 335" role="img" aria-labelledby="mac-chart-title mac-chart-description">
    <title id="mac-chart-title">Your marginal abatement cost curve</title>
    <desc id="mac-chart-description">Emissions E increase from 0 to ${baseline} along the horizontal axis.
      Each additional unit of abatement costs ${slope} more than the preceding unit.
      ${positionDescription} ${price === null ? "No observed price is shown." : `${model.priceLabel} is ${price}.`}</desc>
    <text class="mac-axis-label" x="${left}" y="20">MAC / price ($ per unit)</text>
    ${ticks}${shadedCost}
    <path class="mac-curve" d="${curve}" />
    ${priceLine}${positionLine}
    <line class="mac-axis" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" />
    <line class="mac-axis" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" />
    ${xTicks}
    <text class="mac-axis-label" x="${(left + right) / 2}" y="325" text-anchor="middle">Emissions, E (units)</text>
  </svg>`;
}

/** Explain the displayed curve without supplying the student's bidding rule. */
export function macPanel(state) {
  const model = macModel(state);
  if (!model) {
    return "<p>Your MAC curve appears when the instructor starts the game.</p>";
  }
  const dollars = (value) => `$${value.toFixed(2)}`;
  const position = model.emissions === null
    ? "Your emissions position will appear after the auction clears."
    : `${model.final ? "Final Round 2 emissions" : "Emissions if this round ended now"}: <strong>${model.emissions}</strong>.
      Required abatement: <strong>${model.abatement}</strong>. Abatement cost: <strong>${dollars(model.cost)}</strong>.`;
  const phase = String(state.session?.current_phase ?? "");
  const shockRound = phase === "complete" || phase.endsWith("2") ? "round2" : "round1";
  const shock = state.team?.shocks?.[shockRound];
  const shockLine = shock != null && Number(shock) !== 1
    ? `<p class="shock-notice"><strong>Cost shock:</strong> your MAC slope is ×${shock} this round, so each unit of abatement
      costs $${model.slope} × a instead of $${state.team.mac_slope} × a.</p>`
    : (shock != null ? `<p class="mac-note">Cost shock: your MAC slope is unchanged (×1) this round.</p>` : "");
  const carryRules = [
    state.session.banking_enabled ? "permits you do not use in Round 1 carry to Round 2" : "",
    state.session.borrowing_enabled ? "you can emit more than your permits in Round 1 and repay the difference in Round 2" : "",
  ].filter(Boolean).join("; ");
  const banking = carryRules
    ? `<p class="mac-note">${state.session.banking_enabled && state.session.borrowing_enabled ? "Banking and borrowing are" : (state.session.banking_enabled ? "Banking is" : "Borrowing is")} on:
      ${carryRules}. The curve shows current-round abatement costs; it does not include the future use of banked
      permits or the cost of repaying borrowed ones.</p>` : "";
  return `<h3>Your marginal abatement cost (MAC)</h3>
    <p>Without abatement, your firm emits <strong>${model.baseline} units</strong>.
      Abating the <em>a</em>th unit costs <strong>$${model.slope} × a</strong>, where
      <em>a</em> = ${model.baseline} − <em>E</em>.</p>
    ${shockLine}
    <figure class="mac-figure">
      ${macChart(model)}
      <figcaption>
        <span><i class="mac-key mac-key-curve"></i>Your MAC</span>
        ${model.emissions === null ? "" : `<span><i class="mac-key mac-key-position"></i>${model.final ? "Final" : "Current"} emissions</span>
          <span><i class="mac-key mac-key-cost"></i>Abatement cost</span>`}
        ${model.price === null ? "" : `<span><i class="mac-key mac-key-price"></i>${model.priceLabel}: ${dollars(model.price)}</span>`}
      </figcaption>
    </figure>
    <p class="mac-position">${position}</p>
    <p class="mac-note">Moving left means emitting less and abating more. Each step is the cost of reducing emissions by one unit.
      ${model.price === null ? "" : "The price line records an observed price; current buy and sell offers are in the market below."}</p>
    ${banking}`;
}
