/** Aggregate remaining permits by price, then accumulate from the best offer. */
export function depthLevels(levels, side) {
  const quantities = new Map();
  for (const row of levels ?? []) {
    const price = Number(row.price);
    const quantity = Number(row.quantity);
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity <= 0) continue;
    quantities.set(price, (quantities.get(price) ?? 0) + quantity);
  }
  let cumulative = 0;
  return [...quantities].sort((a, b) => side === "bid" ? b[0] - a[0] : a[0] - b[0])
    .map(([price, quantity]) => ({ price, quantity, cumulative: cumulative += quantity }));
}

/** Market-style depth: price on the horizontal axis, cumulative permits vertically. */
export function marketDepthHtml(book, { closed = false } = {}) {
  const bids = depthLevels(book?.bids, "bid");
  const asks = depthLevels(book?.asks, "ask");
  const status = closed ? "Market closed: remaining orders cannot trade." : "Updates with the order book.";
  if (!bids.length && !asks.length) {
    return `<div class="market-depth"><h4>Market depth</h4><p>No open buy or sell orders yet.</p><p class="note">${status}</p></div>`;
  }
  const money = (value) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const prices = [...bids, ...asks].map(row => row.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const padding = Math.max((high - low) * 0.12, high * 0.02, 0.5);
  const minimum = Math.max(0, low - padding);
  const maximum = high + padding;
  const quantityMax = Math.max(bids.at(-1)?.cumulative ?? 0, asks.at(-1)?.cumulative ?? 0);
  const x = (price) => 64 + (price - minimum) / (maximum - minimum) * 610;
  const y = (quantity) => 266 - quantity / quantityMax * 210;
  const curve = (rows, side) => {
    if (!rows.length) return "";
    let line = `M ${x(rows[0].price)} ${y(0)}`;
    for (const row of rows) line += ` H ${x(row.price)} V ${y(row.cumulative)}`;
    const edge = side === "bid" ? minimum : maximum;
    line += ` H ${x(edge)}`;
    const area = `${line} V ${y(0)} Z`;
    return `<path class="depth-area depth-${side}" d="${area}"/>
      <path class="depth-line depth-${side}" d="${line}"/>
      ${rows.map(row => `<circle class="depth-point depth-${side}" cx="${x(row.price)}" cy="${y(row.cumulative)}" r="4"><title>${side === "bid" ? "Buy" : "Sell"} at $${money(row.price)}: ${row.quantity} permits at this price, ${row.cumulative} cumulative</title></circle>`).join("")}`;
  };
  const grid = [0, 0.5, 1].map(fraction => {
    const quantity = quantityMax * fraction;
    return `<line class="depth-grid" x1="64" x2="674" y1="${y(quantity)}" y2="${y(quantity)}"/>
      <text x="54" y="${y(quantity) + 5}" text-anchor="end">${money(quantity)}</text>`;
  }).join("");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(fraction => {
    const price = minimum + (maximum - minimum) * fraction;
    return `<text x="${x(price)}" y="291" text-anchor="middle">${money(price)}</text>`;
  }).join("");
  const spread = bids.length && asks.length
    ? `Best bid $${money(bids[0].price)} · Best ask $${money(asks[0].price)} · Spread $${money(asks[0].price - bids[0].price)}`
    : bids.length ? `Best bid $${money(bids[0].price)} · No sell orders` : `Best ask $${money(asks[0].price)} · No buy orders`;
  return `<div class="market-depth"><h4>Market depth</h4>
    <p class="depth-summary">${spread}</p>
    <div class="depth-legend"><span class="depth-buy-label">Buy orders (bids)</span><span class="depth-sell-label">Sell orders (asks)</span></div>
    <svg class="depth-chart" viewBox="0 0 720 330" role="img" aria-label="Open-order market depth: price per permit horizontally and cumulative permits vertically. ${spread}">
      <text x="64" y="25">Cumulative permits</text>${grid}${curve(bids, "bid")}${curve(asks, "ask")}${ticks}
      <text x="369" y="324" text-anchor="middle">Price per permit ($)</text>
    </svg>
    <p class="note">Buy curve: permits bid for at or above each price. Sell curve: permits offered at or below each price. These are open orders, not firms' MAC curves. ${status}</p>
  </div>`;
}
