/**
 * Student-facing help for the uniform-price permit auction.
 *
 * The auction is presented as supply meeting demand: the cap is the supply,
 * each team's bids are its demand curve, and the price is the lowest winning
 * bid, paid by every winner. Students enter one price per permit; each price
 * is sent as a one-permit bid, so the server's validation and clearing rules
 * are unchanged.
 */

const dollars = (value) => `${Number(value) < 0 ? "−" : ""}$${Math.abs(Number(value)).toFixed(2)}`;
const ordinal = (number) => {
  const lastTwo = number % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${number}th`;
  return `${number}${({ 1: "st", 2: "nd", 3: "rd" })[number % 10] ?? "th"}`;
};

/** Total cost of abating `abatement` units when the k-th unit costs slope * k. */
function abatementCost(slope, abatement) {
  const units = Math.max(0, Math.floor(abatement));
  return slope * units * (units + 1) / 2;
}

/**
 * Expand stored bids (a price and a quantity per row) to one price per
 * permit, highest first. Older sessions may store rows covering several
 * permits; the per-permit form shows each of those permits separately.
 * @param {Array<{bid_price: number, bid_quantity: number}>} ownBids
 */
export function permitPricesFromBids(ownBids) {
  return (ownBids ?? [])
    .flatMap((bid) => Array.from(
      { length: Math.max(0, Math.floor(Number(bid.bid_quantity))) },
      () => Number(bid.bid_price),
    ))
    .filter((price) => Number.isFinite(price))
    .sort((left, right) => right - left);
}

/**
 * Turn the per-permit price boxes into bids for the server. Blank boxes are
 * skipped. Prices are sorted from highest to lowest because the auction only
 * cares about the set of prices: a team that wins k permits wins its k
 * highest bids.
 * @param {Array<string>} rawPrices box contents in on-screen order
 * @returns {{bids: Array<{bid_price: number, bid_quantity: number}>, prices: number[], reordered: boolean}}
 */
export function bidsFromPermitPrices(rawPrices) {
  const entered = [];
  (rawPrices ?? []).forEach((raw, index) => {
    const text = String(raw ?? "").trim();
    if (text === "") return;
    const price = Number(text);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Permit ${index + 1}: enter a price of $0 or more, or leave the box blank.`);
    }
    entered.push({ position: index, price: Math.round(price * 100) / 100 });
  });

  const sorted = [...entered].sort((left, right) => right.price - left.price);
  // The boxes already match what is submitted when they are filled from
  // permit 1 with no gaps and the prices never rise.
  const alreadyInOrder = entered.every((entry, index) => (
    entry.position === index && entry.price === sorted[index].price
  ));

  return {
    bids: sorted.map((entry) => ({ bid_price: entry.price, bid_quantity: 1 })),
    prices: sorted.map((entry) => entry.price),
    reordered: !alreadyInOrder,
  };
}

/**
 * Prices typed so far, highest first, ignoring boxes that are blank or not
 * yet a valid price. Used for the live what-if tool, which should never
 * interrupt typing with an error.
 * @param {Array<string>} rawPrices
 */
export function typedPermitPrices(rawPrices) {
  return (rawPrices ?? [])
    .map((raw) => String(raw ?? "").trim())
    .filter((text) => text !== "")
    .map(Number)
    .filter((price) => Number.isFinite(price) && price >= 0)
    .sort((left, right) => right - left);
}

/**
 * What the team's own bids would deliver if the lowest winning bid turned
 * out to be `price`. Bids above it win; a bid exactly at it wins unless too
 * many bids tie there. Under uniform pricing every winning permit costs
 * `price`; under pay-as-bid pricing each costs its own bid.
 *
 * Scores follow the game's scoring rule before any trading: avoided
 * abatement cost, minus the auction payment, minus the penalty on permits
 * still owed at the end of the game. Permits beyond baseline count for
 * nothing now; in Round 1 with banking they carry to Round 2.
 * @param {{baseline: number, slope: number, bankedIn?: number, owedIn?: number,
 *   penalty?: number, finalRound?: boolean}} firm
 * @param {number[]} prices the team's bid prices, one per permit
 * @param {number} price hypothetical lowest winning bid
 * @param {{pricing?: "uniform" | "pay_as_bid"}} options
 */
export function outcomeAtPrice(firm, prices, price, { pricing = "uniform" } = {}) {
  const baseline = Number(firm.baseline);
  const slope = Number(firm.slope);
  const bankedIn = Math.max(0, Math.floor(Number(firm.bankedIn ?? 0)));
  const owedIn = Math.max(0, Math.floor(Number(firm.owedIn ?? 0)));
  const penaltyPerPermit = Math.max(0, Number(firm.penalty ?? 0));
  const valid = (prices ?? []).filter((value) => Number.isFinite(value));

  const winning = valid.filter((value) => value >= price);
  const permitsWon = winning.length;
  const tiedAtPrice = valid.filter((value) => value === price).length;
  const payment = Math.round((pricing === "pay_as_bid"
    ? winning.reduce((sum, value) => sum + value, 0)
    : price * permitsWon) * 100) / 100;
  const permitsHeld = permitsWon + bankedIn - owedIn;
  const emissions = Math.min(baseline, Math.max(0, permitsHeld));
  const shortfall = firm.finalRound ? Math.max(0, -permitsHeld) : 0;
  const extraPermits = Math.max(0, permitsHeld - baseline);
  const abatement = baseline - emissions;
  const cost = abatementCost(slope, abatement);
  const avoidedCost = abatementCost(slope, baseline) - cost;
  const penaltyCost = shortfall * penaltyPerPermit;

  return {
    price,
    pricing,
    permitsWon,
    tiedAtPrice,
    payment,
    bankedIn,
    owedIn,
    emissions,
    abatement,
    abatementCost: cost,
    avoidedCost,
    extraPermits,
    shortfall,
    penaltyCost,
    score: Math.round((avoidedCost - payment - penaltyCost) * 100) / 100,
  };
}

/** Upper end of the what-if price range: comfortably above any bid or MAC step. */
export function priceRangeMax(firm, prices) {
  const highest = Math.max(1, Number(firm.slope) * Number(firm.baseline), ...(prices ?? []));
  return Math.ceil(highest * 1.25 / 5) * 5;
}

/** Plain-language auction rules with a worked example students can open. */
export function auctionRulesHtml(cap, { pricing = "uniform" } = {}) {
  const payAsBid = pricing === "pay_as_bid";
  const paymentRule = payAsBid
    ? `Each winner pays <strong>its own bid</strong> for every permit it wins. If you bid $15 and win, you pay $15,
        even if the lowest winning bid is $9.`
    : `Every winner pays the <strong>same price</strong>: the lowest winning bid. If you bid $15 and the price is $9, you pay $9.`;
  const supplyDemand = payAsBid
    ? `The lowest winning bid is still where the class's total demand meets the ${cap} permits of supply, but each
        winner pays what it bid. EPA sold Acid Rain Program permits this way. Nobody sees anyone else's bids until
        the auction clears.`
    : `Think of it as supply and demand. Supply is the ${cap} permits. Your bids are your demand curve.
        The price is where the class's total demand equals supply. Nobody sees anyone else's bids until the auction clears.`;
  const exampleResult = payAsBid
    ? `<p>Each winner pays its own bids. A wins 2 permits and pays $12 + $9 = <strong>$21</strong>, B pays $10 + $7 = $17,
        and C pays $8. Under a uniform price all winners would have paid $7 a permit, so A would have paid $14.</p>`
    : `<p>The price is the lowest winning bid, <strong>$7</strong>. A wins 2 permits and pays $14, B wins 2 and pays $14,
        C wins 1 and pays $7. A bid $12 for its first permit but pays only $7 for it.</p>`;

  return `<div class="auction-rules">
    <h3>How the auction works${payAsBid ? ": pay as you bid" : ""}</h3>
    <ol>
      <li>For each permit, enter the <strong>most you would pay</strong> for it. Leave a box blank if you do not want that permit.</li>
      <li>When the clock runs out, every team's bids are ranked from highest to lowest. The top <strong>${cap}</strong> bids win.</li>
      <li>${paymentRule}</li>
    </ol>
    <p class="mac-note">${supplyDemand}</p>
    <details class="worked-example">
      <summary>Worked example: 3 firms, 5 permits</summary>
      <table>
        <thead><tr><th scope="col">Firm</th><th scope="col">Permit 1</th><th scope="col">Permit 2</th><th scope="col">Permit 3</th><th scope="col">Permit 4</th></tr></thead>
        <tbody>
          <tr><th scope="row">A</th><td>$12</td><td>$9</td><td>$6</td><td>$3</td></tr>
          <tr><th scope="row">B</th><td>$10</td><td>$7</td><td>$4</td><td>$1</td></tr>
          <tr><th scope="row">C</th><td>$8</td><td>$5</td><td>$2</td><td></td></tr>
        </tbody>
      </table>
      <p>Ranked from highest: $12, $10, $9, $8, <strong>$7</strong> are the top 5 bids, so they win. The next bid, $6, just misses.</p>
      ${exampleResult}
    </details>
  </div>`;
}

/** Notice shown while bidding in a round whose market opens with a cost shock. */
export function shockNoticeHtml() {
  return `<p class="shock-notice"><strong>Cost shock this round.</strong> When the market opens, each firm learns whether
    its MAC slope is multiplied by 0.5, 1, or 1.5. Each is equally likely: a third of the firms get each, and only you
    see yours. Your MAC chart shows your cost before the shock, which is also your expected cost.</p>`;
}

/** What a team sees during a free-allocation round instead of a bid form. */
export function freeAllocationHtml({ cap, permits, baseline, roundLabel }) {
  return `<p class="called-price-callout">${cap} permits given away free</p>
    <div class="auction-rules">
      <h3>No auction in ${roundLabel}: free permits</h3>
      <p>The regulator gives the ${cap} permits away in proportion to each firm's baseline emissions, the way the
        Acid Rain Program handed out most of its permits based on past emissions ("grandfathering").</p>
      <p>Your firm's baseline is ${baseline} units, so you receive <strong>${permits} permit${permits === 1 ? "" : "s"}</strong>
        at no cost. There is nothing to bid on. When the market opens, compare what one more permit would save you
        with what it costs to buy, and what selling one would earn with the extra abatement it requires.</p>
    </div>`;
}

/**
 * Permits worth bidding for this round to cover baseline emissions. Banked
 * permits already cover the first units of emissions; owed permits must be
 * covered before any emissions are. Permits beyond this number are worth
 * something only if they can be banked (Round 1 with banking on).
 */
export function biddablePermits(baseline, bankedIn = 0, owedIn = 0) {
  return Math.max(0, Math.floor(Number(baseline))
    - Math.max(0, Math.floor(Number(bankedIn)))
    + Math.max(0, Math.floor(Number(owedIn))));
}

/** One labelled price box. `kind` is "owed", "extra", or "" for an ordinary permit. */
export function permitBoxHtml(number, value, { kind = "", disabled = false } = {}) {
  const note = kind === "owed" ? " (repays a borrowed permit)" : (kind === "extra" ? " (extra: bank for Round 2)" : "");
  return `<label class="permit-bid${kind ? ` permit-bid-${kind}` : ""}">
      <span>Permit ${number}${note}</span>
      <span class="permit-bid-input"><span aria-hidden="true">$</span><input class="permit-bid-price" type="number" min="0" step="0.01"
        inputmode="decimal" value="${value}" aria-label="Most you would pay for permit ${number}${note}, in dollars" ${disabled ? "disabled" : ""} /></span>
    </label>`;
}

/**
 * One price box per permit, in the order the permits would be used: owed
 * permits first, then one per unit of emissions not already covered, then
 * any extra permits to bank. `allowMore` adds a button for more extra boxes.
 */
export function permitBidInputsHtml(baseline, prices, {
  disabled = false,
  bankedIn = 0,
  owedIn = 0,
  penalty = 0,
  allowMore = false,
} = {}) {
  const needed = biddablePermits(baseline, bankedIn, owedIn);
  if (needed === 0 && !allowMore) {
    return `<p class="mac-note">Your ${bankedIn} banked permits already cover all ${baseline} units of your emissions.
      Any permit you won this round would be worth $0 to you, so there is nothing to bid for.</p>`;
  }

  const boxCount = Math.max(needed, prices.length);
  const kindFor = (index) => (index < owedIn ? "owed" : (index >= needed ? "extra" : ""));
  const boxes = Array.from({ length: boxCount }, (_, index) => permitBoxHtml(
    index + 1,
    prices[index] ?? "",
    { kind: kindFor(index), disabled },
  )).join("");

  let coverage;
  if (owedIn > 0) {
    coverage = `You owe ${owedIn} permit${owedIn === 1 ? "" : "s"} from borrowing in Round 1. The first ${owedIn} permit${owedIn === 1 ? "" : "s"}
      you win repay ${owedIn === 1 ? "it" : "them"}; each one still owed at the end of the game costs $${Number(penalty).toFixed(2)}.
      After that, each permit covers one unit of emissions, starting with the leftmost step on your MAC chart.`;
  } else if (bankedIn > 0) {
    coverage = `Your ${bankedIn} banked permit${bankedIn === 1 ? "" : "s"} from Round 1 already cover${bankedIn === 1 ? "s" : ""} your first
      ${bankedIn} unit${bankedIn === 1 ? "" : "s"} of emissions, so permit 1 here covers your ${ordinal(bankedIn + 1)} unit, permit 2 the next, and so on.`;
  } else {
    coverage = "Permit 1 covers your first unit of emissions (the leftmost step on your MAC chart), permit 2 your second unit, and so on.";
  }
  const extraNote = allowMore
    ? ` Banking is on: permits beyond your ${needed} are extra and carry to Round 2, where the cap is tighter.
      Add as many extra boxes as you like.`
    : "";

  return `<p class="mac-note">${coverage} Each permit you win lets you emit one more unit instead of abating it.${extraNote}</p>
    <div class="permit-bid-grid" id="permit-bid-grid" data-needed="${needed}" data-owed="${owedIn}">${boxes}</div>
    ${allowMore ? `<button id="add-permit-boxes-btn" class="secondary" type="button" ${disabled ? "disabled" : ""}>Add 5 extra permits to bank</button>` : ""}`;
}

/** Bars for the team's own bids, colored by whether they win at `price`. */
export function whatIfChartSvg(baseline, prices, price, maxPrice, { pricing = "uniform" } = {}) {
  const left = 52;
  const right = 592;
  const top = 30;
  const bottom = 214;
  const slots = Math.max(1, baseline, prices.length);
  const slotWidth = (right - left) / slots;
  const y = (value) => bottom - Math.min(value, maxPrice) / maxPrice * (bottom - top);

  const bars = prices.slice(0, slots).map((bidPrice, index) => {
    const wins = bidPrice >= price;
    const x = left + index * slotWidth + slotWidth * 0.12;
    return `<rect class="${wins ? "whatif-bar-win" : "whatif-bar-lose"}" x="${x}" y="${y(bidPrice)}"
      width="${slotWidth * 0.76}" height="${bottom - y(bidPrice)}"><title>Permit ${index + 1}: bid ${dollars(bidPrice)}, ${wins ? "wins" : "loses"}</title></rect>`;
  }).join("");

  const labels = Array.from({ length: slots }, (_, index) => index + 1)
    .filter((number) => slots <= 10 || number % 2 === 1 || number === slots)
    .map((number) => `<text x="${left + (number - 0.5) * slotWidth}" y="${bottom + 20}" text-anchor="middle">${number}</text>`)
    .join("");

  const gridValues = [0, 0.5, 1].map((share) => maxPrice * share);
  const grid = gridValues.map((value) => `<line class="mac-grid-line" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" />
    <text x="${left - 8}" y="${y(value) + 5}" text-anchor="end">${Number(value.toFixed(2))}</text>`).join("");

  const winning = prices.filter((value) => value >= price).length;
  return `<svg class="whatif-chart" viewBox="0 0 620 262" role="img" aria-labelledby="whatif-title whatif-desc">
    <title id="whatif-title">Your bids against a possible auction price</title>
    <desc id="whatif-desc">${prices.length} bids entered. At a price of ${dollars(price)}, ${winning} of them win.</desc>
    ${grid}${bars}
    <line class="whatif-price-line" x1="${left}" x2="${right}" y1="${y(price)}" y2="${y(price)}" />
    <text class="whatif-price-label" x="${right}" y="${y(price) - 6}" text-anchor="end">${pricing === "pay_as_bid" ? "Lowest winning bid" : "Price"} ${dollars(price)}</text>
    <line class="mac-axis" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" />
    <line class="mac-axis" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" />
    ${labels}
    <text class="mac-axis-label" x="${(left + right) / 2}" y="255" text-anchor="middle">Permit number</text>
  </svg>`;
}

/** Text summary of `outcomeAtPrice`, written for students. */
export function outcomeSummaryHtml(outcome, baseline) {
  const payAsBid = outcome.pricing === "pay_as_bid";
  const priceWords = payAsBid ? `If the lowest winning bid is ${dollars(outcome.price)}` : `At ${dollars(outcome.price)}`;
  if (outcome.permitsWon === 0 && outcome.bankedIn === 0 && outcome.owedIn === 0) {
    return `<p>${priceWords}, none of your bids win. You pay nothing, emit nothing, and abate all
      ${baseline} units at a cost of <strong>${dollars(outcome.abatementCost)}</strong>. Round score before trading: <strong>${dollars(outcome.score)}</strong>.</p>`;
  }
  const tie = outcome.tiedAtPrice > 0
    ? `<p class="mac-note">${outcome.tiedAtPrice} of your bids equal ${dollars(outcome.price)} exactly. A bid there can lose some permits if too many bids tie.</p>`
    : "";
  const paymentWords = payAsBid
    ? `pay your own bids, <strong>${dollars(outcome.payment)}</strong> in total`
    : `pay <strong>${dollars(outcome.payment)}</strong> (${outcome.permitsWon} × ${dollars(outcome.price)})`;
  const carry = [
    outcome.bankedIn > 0 ? `plus ${outcome.bankedIn} banked` : "",
    outcome.owedIn > 0 ? `minus ${outcome.owedIn} owed` : "",
  ].filter(Boolean).join(", ");
  const held = outcome.permitsWon + outcome.bankedIn - outcome.owedIn;
  const extra = outcome.extraPermits > 0
    ? `<p class="mac-note">${outcome.extraPermits} of these permits are beyond your baseline. They are worth nothing this round;
        with banking on, they carry to Round 2.</p>`
    : "";
  const short = outcome.shortfall > 0
    ? `<p class="mac-note">You would still owe ${outcome.shortfall} permit${outcome.shortfall === 1 ? "" : "s"} at the end of the game,
        a penalty of ${dollars(outcome.penaltyCost)}, unless you buy more in the market.</p>`
    : "";
  return `<p>${priceWords}, you win <strong>${outcome.permitsWon}</strong> permit${outcome.permitsWon === 1 ? "" : "s"}
    and ${paymentWords}. With ${outcome.permitsWon}${carry ? ` ${carry}` : ""} permit${held === 1 ? "" : "s"} you emit ${outcome.emissions}
    and abate ${outcome.abatement} unit${outcome.abatement === 1 ? "" : "s"} at a cost of <strong>${dollars(outcome.abatementCost)}</strong>.</p>
    <p>Abatement cost avoided: ${dollars(outcome.avoidedCost)}. Minus payment: ${dollars(outcome.payment)}.${outcome.penaltyCost > 0 ? ` Minus penalty: ${dollars(outcome.penaltyCost)}.` : ""}
      Round score before trading: <strong>${dollars(outcome.score)}</strong>.</p>${tie}${extra}${short}`;
}

/**
 * The cleared auction as supply and demand: the class's bids stacked from
 * highest to lowest form a step demand curve, the permits for sale form a
 * vertical supply curve, and the price is the lowest winning bid. The
 * team's own bids are drawn over the demand curve.
 */
export function auctionReportChartSvg(report, idPrefix = "report") {
  const left = 58;
  const right = 592;
  const top = 48;
  const bottom = 270;
  const stack = report.stack ?? [];
  const maxQuantity = Math.max(1, report.total_bid_quantity, report.cap) * 1.06;
  const highest = Math.max(1, report.clearing_price ?? 0, ...stack.map((step) => step.price));
  const maxPrice = Math.ceil(highest * 1.1 / 4) * 4;
  const x = (quantity) => left + quantity / maxQuantity * (right - left);
  const y = (price) => bottom - price / maxPrice * (bottom - top);

  // Demand: horizontal at each bid's price, dropping between bids, and to
  // zero after the last bid.
  const demandPath = stack.length === 0 ? "" : stack.map((step, index) => (
    `${index === 0 ? `M ${x(step.from_quantity)} ${y(step.price)}` : `V ${y(step.price)}`} H ${x(step.to_quantity)}`
  )).join(" ") + ` V ${bottom}`;

  // In a large class one permit is a sliver, so own bids get a minimum width.
  const minimumOwnWidth = 6;
  const ownSegments = stack.filter((step) => step.own).map((step) => {
    const trueWidth = x(step.to_quantity) - x(step.from_quantity);
    const extra = Math.max(0, minimumOwnWidth - trueWidth) / 2;
    const quantity = step.to_quantity - step.from_quantity;
    const won = step.accepted_quantity > 0;
    return `<line class="report-own-bid" x1="${x(step.from_quantity) - extra}" x2="${x(step.to_quantity) + extra}"
      y1="${y(step.price)}" y2="${y(step.price)}"><title>Your bid: ${quantity} permit${quantity === 1 ? "" : "s"} at ${dollars(step.price)}, ${won ? "won" : "lost"}</title></line>`;
  }).join("");

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((share) => {
    const value = maxPrice * share;
    return `<line class="mac-grid-line" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" />
      <text x="${left - 10}" y="${y(value) + 5}" text-anchor="end">${Number(value.toFixed(2))}</text>`;
  }).join("");
  const quantityTicks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((share) => Math.round(maxQuantity / 1.06 * share)))]
    .map((quantity) => `<text x="${x(quantity)}" y="${bottom + 23}" text-anchor="middle">${quantity}</text>`).join("");

  const capLabelOnLeft = x(report.cap) > left + 0.55 * (right - left);
  const supply = `<line class="report-supply" x1="${x(report.cap)}" x2="${x(report.cap)}" y1="${top}" y2="${bottom}" />
    <text class="report-supply-label" x="${capLabelOnLeft ? x(report.cap) - 6 : x(report.cap) + 6}" y="${top + 14}"
      text-anchor="${capLabelOnLeft ? "end" : "start"}">Supply: ${report.cap} permits</text>`;
  const price = report.clearing_price === null ? "" : `<line class="report-price-line" x1="${left}" x2="${right}"
      y1="${y(report.clearing_price)}" y2="${y(report.clearing_price)}" />
    <circle class="report-price-point" cx="${x(Math.min(report.cap, report.total_bid_quantity))}" cy="${y(report.clearing_price)}" r="6" />
    <text class="report-price-label" x="${right}" y="${y(report.clearing_price) - 9}" text-anchor="end">${report.pricing === "pay_as_bid" ? "Lowest winning bid" : "Price"} ${dollars(report.clearing_price)}</text>`;

  return `<svg class="report-chart" viewBox="0 0 620 330" role="img" aria-labelledby="${idPrefix}-title ${idPrefix}-desc">
    <title id="${idPrefix}-title">Auction supply and demand</title>
    <desc id="${idPrefix}-desc">The class bid for ${report.total_bid_quantity} permits in total and ${report.cap} were for sale.
      The demand curve steps down through every bid from highest to lowest; supply is a vertical line at ${report.cap} permits.
      The clearing price is ${report.clearing_price === null ? "undefined because no bids arrived" : dollars(report.clearing_price)}.</desc>
    <text class="mac-axis-label" x="${left}" y="20">$ per permit</text>
    ${ticks}
    <path class="report-demand" d="${demandPath}" />
    ${ownSegments}${supply}${price}
    <line class="mac-axis" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" />
    <line class="mac-axis" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" />
    ${quantityTicks}
    <text class="mac-axis-label" x="${(left + right) / 2}" y="322" text-anchor="middle">Permits (all bids, highest first)</text>
  </svg>`;
}

/**
 * One cleared auction as students see it: the supply-and-demand chart, how
 * the price was set, and the team's own bids.
 * @param {object | null} report from `studentAuctionReport`
 * @param {string} roundLabel e.g. "Round 1"
 * @param {{open?: boolean}} options whether the section starts expanded
 */
export function auctionReportHtml(report, roundLabel, { open = true } = {}) {
  if (!report) return "";
  const idPrefix = `report-${roundLabel.replace(/\W+/g, "-").toLowerCase()}`;
  const payAsBid = report.pricing === "pay_as_bid";
  const summary = report.clearing_price === null
    ? `${roundLabel} auction: no bids`
    : (payAsBid
      ? `${roundLabel} auction (pay as bid): supply, demand, and the lowest winning bid (${dollars(report.clearing_price)})`
      : `${roundLabel} auction: supply, demand, and the price (${dollars(report.clearing_price)})`);
  if (report.clearing_price === null) {
    return `<details class="auction-report" ${open ? "open" : ""}><summary>${summary}</summary>
      <p class="mac-note">No bids arrived in the ${roundLabel} auction, so no permits were sold.</p></details>`;
  }

  const ownRows = report.own_bids.map((bid) => `<tr>
      <td>Permit ${bid.permit_number}</td>
      <td>${dollars(bid.bid_price)}</td>
      <td>${bid.won ? "Won" : (bid.bid_price === report.clearing_price ? "Lost (tie at the price)" : "Lost")}</td>
      <td>${bid.won ? dollars(bid.price_paid) : "-"}</td>
    </tr>`).join("");
  const ownTable = report.own_bids.length === 0
    ? "<p class=\"mac-note\">Your team did not bid in this auction.</p>"
    : `<div class="table-wrap"><table>
        <thead><tr><th scope="col">Your bid for</th><th scope="col">You bid</th><th scope="col">Result</th><th scope="col">You paid</th></tr></thead>
        <tbody>${ownRows}</tbody>
      </table></div>`;

  const highestWinningOwn = report.own_bids.find((bid) => bid.won);
  const example = !payAsBid && highestWinningOwn && highestWinningOwn.bid_price > report.clearing_price
    ? ` For example, you bid ${dollars(highestWinningOwn.bid_price)} for permit ${highestWinningOwn.permit_number} and paid ${dollars(report.clearing_price)}.`
    : "";
  const unsold = report.cap - report.total_bid_quantity;
  const whoPaidWhat = payAsBid
    ? "Each winner paid its own bids, so winners with higher bids paid more for the same permit."
    : "Every winner paid it.";
  const howPriceWasSet = unsold > 0
    ? `Only ${report.total_bid_quantity} permits were bid for, fewer than the ${report.cap} for sale, so every bid won and
      ${unsold} permit${unsold === 1 ? " went" : "s went"} unsold. The lowest winning bid is the lowest bid, ${dollars(report.clearing_price)}. ${whoPaidWhat}`
    : `Demand meets supply at the ${ordinal(report.cap)} permit. The bid there is the lowest winning bid,
      ${dollars(report.clearing_price)}. ${whoPaidWhat} Bids to the left of the supply line won; bids to the right lost.`;

  return `<details class="auction-report" ${open ? "open" : ""}>
    <summary>${summary}</summary>
    <figure class="report-figure">
      ${auctionReportChartSvg(report, idPrefix)}
      <figcaption>
        <span><i class="report-key report-key-demand"></i>Demand: all bids, highest first</span>
        <span><i class="report-key report-key-own"></i>Your bids</span>
        <span><i class="report-key report-key-supply"></i>Supply: permits for sale</span>
        <span><i class="report-key report-key-price"></i>${payAsBid ? "Lowest winning bid" : "Clearing price"}</span>
      </figcaption>
    </figure>
    <p class="mac-note">${howPriceWasSet}${example} When bids tie at the price and not all of them fit, the bids submitted
      first win (revising your bids counts as a new submission). Team names are hidden.</p>
    ${ownTable}
  </details>`;
}

/**
 * Every cleared auction so far, newest first. The newest starts expanded
 * when `openNewest` is set; earlier rounds start collapsed.
 * @param {{auction1?: object | null, auction2?: object | null}} reports
 */
export function clearedAuctionsHtml(reports, { openNewest = true } = {}) {
  const rounds = [["auction2", "Round 2"], ["auction1", "Round 1"]]
    .filter(([key]) => reports?.[key]);
  return rounds.map(([key, label], index) => auctionReportHtml(reports[key], label, {
    open: openNewest && index === 0,
  })).join("");
}
