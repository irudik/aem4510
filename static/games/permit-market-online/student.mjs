import {
  apiJson,
  clearStatus,
  formatNumber,
  setStatus,
} from "/games/permit-market-online/shared.mjs";
import { macModel, macPanel } from "/games/permit-market-online/mac-view.mjs";
import { marketDepthHtml } from "./market-depth.mjs";
import { macDistributionsHtml } from "./mac-distribution.mjs";
import {
  auctionRulesHtml,
  biddablePermits,
  bidsFromPermitPrices,
  clearedAuctionsHtml,
  freeAllocationHtml,
  outcomeAtPrice,
  outcomeSummaryHtml,
  permitBidInputsHtml,
  permitBoxHtml,
  permitPricesFromBids,
  priceRangeMax,
  shockNoticeHtml,
  typedPermitPrices,
  whatIfChartSvg,
} from "/games/permit-market-online/auction-guide.mjs";

const PHASE_LABELS = {
  setup: "Setup",
  auction1: "Auction (Round 1)",
  market1: "Open Market (Round 1)",
  auction2: "Auction (Round 2)",
  market2: "Open Market (Round 2)",
  complete: "Complete",
};

const JOIN_TOKEN_KEY = "permit_market_join_token";
const POLL_INTERVAL_MS = 2500;

const joinCard = document.getElementById("join-card");
const joinStatus = document.getElementById("join-status");
const joinButton = document.getElementById("join-btn");
const resetTokenButton = document.getElementById("reset-token-btn");
const teamNameInput = document.getElementById("team-name");

const firmCard = document.getElementById("firm-card");
const firmKv = document.getElementById("firm-kv");
const macCurveElement = document.getElementById("mac-curve");
const stageCard = document.getElementById("stage-card");
const stageTitle = document.getElementById("stage-title");
const phaseLabelElement = document.getElementById("phase-label");
const roundTimerElement = document.getElementById("round-timer");
const stageStatus = document.getElementById("stage-status");
const stageContainer = document.getElementById("stage-container");
const resultsCard = document.getElementById("results-card");
const macDistributionsCard = document.getElementById("mac-distributions-card");
const macDistributionsElement = document.getElementById("mac-distributions");
const resultsCostEffectiveness = document.getElementById("results-cost-effectiveness");
const resultsTable = document.getElementById("results-table");
const leaderboardCard = document.getElementById("leaderboard-card");
const leaderboardTable = document.getElementById("leaderboard-table");

/** @type {number | null} */
let refreshTimer = null;
/** @type {number | null} */
let countdownTimer = null;
let serverClockOffsetMs = 0;
let deadlineMs = null;
/** Signature of the last rendered stage scaffolding, to keep inputs stable. */
let renderedStageSignature = null;
let latestState = null;
/** Price chosen on the what-if slider, kept when the auction form is redrawn. */
let whatIfPrice = null;

function phaseLabel(phase, state = latestState) {
  const key = String(phase ?? "");
  if ((key === "auction1" || key === "auction2") && state?.allocation_method === "free") {
    return `Free Permits (Round ${key.endsWith("2") ? 2 : 1})`;
  }
  if ((key === "auction1" || key === "auction2") && state?.allocation_method === "pay_as_bid") {
    return `Pay-as-Bid Auction (Round ${key.endsWith("2") ? 2 : 1})`;
  }
  return PHASE_LABELS[key] ?? String(phase ?? "unknown");
}

function getJoinToken() {
  return localStorage.getItem(JOIN_TOKEN_KEY);
}

function setJoinToken(token) {
  localStorage.setItem(JOIN_TOKEN_KEY, token);
}

function clearJoinToken() {
  localStorage.removeItem(JOIN_TOKEN_KEY);
}

function tableHtml(rows, headerLabels = null) {
  if (!rows || rows.length === 0) {
    return "<p><small class=\"note\">Nothing here yet.</small></p>";
  }

  const columns = Object.keys(rows[0]);
  const header = columns
    .map((column, index) => `<th>${headerLabels?.[index] ?? column.replace(/_/g, " ")}</th>`)
    .join("");
  const body = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${row[column] == null ? "" : String(row[column])}</td>`).join("")}</tr>`)
    .join("");

  return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function deadlineExpired() {
  return deadlineMs !== null && (Date.now() + serverClockOffsetMs) > deadlineMs;
}

function updateCountdownDisplay() {
  if (deadlineMs === null) {
    roundTimerElement.classList.add("hidden");
    return;
  }

  roundTimerElement.classList.remove("hidden");
  const remainingMs = deadlineMs - (Date.now() + serverClockOffsetMs);

  if (remainingMs <= 0) {
    roundTimerElement.textContent = "Time is up";
    roundTimerElement.classList.add("expired");
    if (renderedStageSignature !== null && !renderedStageSignature.endsWith("|expired")) {
      renderStage(latestState, { force: true });
    }
    return;
  }

  roundTimerElement.classList.remove("expired");
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  roundTimerElement.textContent = `${minutes}:${String(seconds).padStart(2, "0")} left`;
  roundTimerElement.classList.toggle("closing", totalSeconds < 60);
}

function syncCountdown(state) {
  const serverNow = Date.parse(String(state?.server_now ?? ""));
  if (Number.isFinite(serverNow)) {
    serverClockOffsetMs = serverNow - Date.now();
  }

  const deadlineRaw = state?.session?.phase_deadline_at;
  const parsedDeadline = deadlineRaw ? Date.parse(String(deadlineRaw)) : NaN;
  deadlineMs = Number.isFinite(parsedDeadline) ? parsedDeadline : null;

  updateCountdownDisplay();

  if (!countdownTimer) {
    countdownTimer = window.setInterval(updateCountdownDisplay, 1000);
  }
}

function renderFirmCard(state) {
  firmCard.classList.remove("hidden");
  stageCard.classList.remove("hidden");

  const session = state.session;
  const team = state.team;

  const entries = [
    ["Session", session.session_name],
    ["Team", team.team_name],
  ];

  firmKv.innerHTML = "";
  for (const [label, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    firmKv.append(dt, dd);
  }

  macCurveElement.innerHTML = macPanel(state);
}

/**
 * Contents of the per-permit price boxes, permit 1 first. A number box
 * reports text it cannot read (such as "12,50" on some keyboards) as empty,
 * so those boxes are marked unreadable instead of being skipped silently.
 */
function readPermitBoxes() {
  return [...document.querySelectorAll(".permit-bid-price")]
    .map((input) => (input.validity?.badInput ? "unreadable" : input.value));
}

async function submitBids() {
  let converted;
  try {
    converted = bidsFromPermitPrices(readPermitBoxes());
  } catch (error) {
    setStatus(stageStatus, "warn", error.message);
    return;
  }

  if (converted.bids.length === 0) {
    setStatus(stageStatus, "warn", "Enter a price for at least one permit.");
    return;
  }

  clearStatus(stageStatus);
  try {
    await apiJson("/api/permit-market/team/submit-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ join_token: getJoinToken(), bids: converted.bids }),
    });
    const orderNote = converted.reordered
      ? " Your bids are now listed from highest to lowest: if you win some permits, they are always your highest bids."
      : "";
    setStatus(stageStatus, "good", `Bids submitted.${orderNote} You can revise them until the auction closes.`);
    await refreshState();
  } catch (error) {
    setStatus(stageStatus, "bad", error.message);
  }
}

async function postOrder() {
  const side = document.getElementById("order-side")?.value;
  const price = Number(document.getElementById("order-price")?.value);
  const quantity = Number(document.getElementById("order-qty")?.value);

  if (!Number.isFinite(price) || !Number.isInteger(quantity) || quantity <= 0) {
    setStatus(stageStatus, "warn", "Enter a price and a whole-number quantity.");
    return;
  }

  clearStatus(stageStatus);
  try {
    const response = await apiJson("/api/permit-market/team/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ join_token: getJoinToken(), side, price, quantity }),
    });

    if (response.filled_quantity > 0 && response.remaining_quantity > 0) {
      setStatus(stageStatus, "good", `Traded ${response.filled_quantity} right away; ${response.remaining_quantity} now resting in the book.`);
    } else if (response.filled_quantity > 0) {
      const tradeText = response.trades.map((trade) => `${trade.quantity} at ${formatNumber(trade.price, 2)}`).join(", ");
      setStatus(stageStatus, "good", `Order filled: ${tradeText}.`);
    } else {
      setStatus(stageStatus, "good", "Order placed in the book.");
    }
    await refreshState();
  } catch (error) {
    setStatus(stageStatus, "bad", error.message);
  }
}

async function cancelOrder(orderId) {
  clearStatus(stageStatus);
  try {
    await apiJson("/api/permit-market/team/cancel-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ join_token: getJoinToken(), order_id: orderId }),
    });
    setStatus(stageStatus, "warn", "Order cancelled.");
    await refreshState();
  } catch (error) {
    setStatus(stageStatus, "bad", error.message);
  }
}

function renderAuctionStage(state) {
  const expired = deadlineExpired();
  const session = state.session;
  const phase = String(session.current_phase);
  const roundKey = phase === "auction2" ? "round2" : "round1";
  const roundLabel = roundKey === "round2" ? "Round 2" : "Round 1";
  const cap = formatNumber(phase === "auction1" ? session.cap_round1 : session.cap_round2, 0);
  const method = state.allocation_method ?? "uniform";
  if (session.phase_closed) {
    stageContainer.innerHTML = `
      <h3>Permit allocation closed</h3>
      <p>You received ${formatNumber(state.own_allocation?.permits_won ?? 0, 0)} permits
      and paid $${formatNumber(state.own_allocation?.payment ?? 0, 2)}.</p>
      ${clearedAuctionsHtml(state.auction_reports)}
      <p class="note">Waiting for the instructor to open the market. You cannot submit more bids.</p>`;
    return;
  }
  const shockComing = Boolean(roundKey === "round2" ? session.shock_round2 : session.shock_round1);
  const firm = {
    baseline: Number(state.team.baseline_emissions),
    slope: Number(state.team.mac_slope),
    bankedIn: Number(state.permits_banked_in ?? 0),
    owedIn: Number(state.permits_owed_in ?? 0),
    penalty: Number(session.shortfall_penalty ?? 0),
    finalRound: roundKey === "round2",
  };

  if (method === "free") {
    stageContainer.innerHTML = `
      ${freeAllocationHtml({ cap, permits: Number(state.free_allocation ?? 0), baseline: firm.baseline, roundLabel })}
      ${firm.owedIn > 0 ? `<p class="mac-note">You also owe ${firm.owedIn} permit(s) from borrowing in Round 1; your free permits cover them first.</p>` : ""}
      ${firm.bankedIn > 0 ? `<p class="mac-note">You also carry ${firm.bankedIn} banked permit(s) from Round 1.</p>` : ""}
      ${shockComing ? shockNoticeHtml() : ""}
      ${clearedAuctionsHtml(state.auction_reports, { openNewest: false })}
      <p><small class="note">Waiting for the instructor to open the market.</small></p>`;
    return;
  }

  const ownBids = state.own_bids ?? [];
  // Extra boxes for banking: only in Round 1 with banking on.
  const allowMore = roundKey === "round1" && Boolean(session.banking_enabled);
  const needed = biddablePermits(firm.baseline, firm.bankedIn, firm.owedIn);
  const quantityLimit = Number(state.bid_quantity_limit ?? firm.baseline);
  const savedPrices = permitPricesFromBids(ownBids).slice(0, allowMore ? quantityLimit : Math.min(needed, quantityLimit));
  const pricing = method === "pay_as_bid" ? "pay_as_bid" : "uniform";
  const rangeMax = priceRangeMax(firm, savedPrices);
  if (whatIfPrice === null || whatIfPrice > rangeMax) {
    whatIfPrice = Math.round(rangeMax * 0.4);
  }
  const noBoxes = needed === 0 && !allowMore;
  const priceWord = pricing === "pay_as_bid" ? "lowest winning bid" : "price";

  stageContainer.innerHTML = `
    <p class="called-price-callout">${cap} permits for sale</p>
    ${auctionRulesHtml(cap, { pricing })}
    ${shockComing ? shockNoticeHtml() : ""}
    ${clearedAuctionsHtml(state.auction_reports, { openNewest: false })}
    <h3>Your bids</h3>
    <p class="learning-prompt">Before bidding: if you won one more permit, which unit of abatement would you avoid?</p>
    ${permitBidInputsHtml(firm.baseline, savedPrices, {
      disabled: expired,
      bankedIn: firm.bankedIn,
      owedIn: firm.owedIn,
      penalty: firm.penalty,
      allowMore,
      quantityLimit,
    })}
    <div class="row" style="margin-top: 0.6rem">
      <button id="clear-bids-btn" class="secondary" type="button" ${expired || noBoxes ? "disabled" : ""}>Clear Boxes</button>
      <button id="submit-bids-btn" class="primary" type="button" ${expired || noBoxes ? "disabled" : ""}>
        ${ownBids.length > 0 ? "Revise Bids" : "Submit Bids"}
      </button>
      ${ownBids.length > 0 ? "<span class=\"badge\">Bids in</span>" : ""}
    </div>
    <p class="mac-note">You can revise your bids until the clock runs out; only your latest submission counts.
      Clear Boxes only empties the form: bids you already submitted stay in until you submit new ones.</p>
    ${expired ? "<p><small class=\"note\">The auction has closed. Waiting for the instructor to clear it.</small></p>" : ""}
    <section class="whatif" aria-labelledby="whatif-heading">
      <h3 id="whatif-heading">What if the ${priceWord} were...?</h3>
      <p class="mac-note">No one knows the ${priceWord} until the auction clears. Move the slider to see what the bids typed
        above would get you at different values. Only your own bids are used${shockComing ? ", with your cost before the shock" : ""}.</p>
      <label for="whatif-price">Possible ${priceWord}: <strong id="whatif-price-value"></strong></label>
      <input id="whatif-price" type="range" min="0" max="${rangeMax}" step="0.5" value="${whatIfPrice}" />
      <div id="whatif-chart"></div>
      <div id="whatif-summary"></div>
    </section>
  `;

  const slider = document.getElementById("whatif-price");
  const updateWhatIf = () => {
    const boxCount = document.querySelectorAll(".permit-bid-price").length;
    const prices = typedPermitPrices(readPermitBoxes()).slice(0, boxCount);
    // Widen the slider when a typed bid goes above its current range.
    const sliderMax = Math.max(rangeMax, priceRangeMax(firm, prices));
    slider.max = String(sliderMax);
    whatIfPrice = Number(slider.value);
    document.getElementById("whatif-price-value").textContent = `$${whatIfPrice.toFixed(2)}`;
    document.getElementById("whatif-chart").innerHTML = whatIfChartSvg(boxCount, prices, whatIfPrice, sliderMax, { pricing });
    document.getElementById("whatif-summary").innerHTML = prices.length === 0 && firm.bankedIn === 0 && firm.owedIn === 0
      ? "<p class=\"mac-note\">Enter bids above to see what they would win.</p>"
      : outcomeSummaryHtml(outcomeAtPrice(firm, prices, whatIfPrice, { pricing }), firm.baseline);
  };

  slider.addEventListener("input", updateWhatIf);
  const grid = document.getElementById("permit-bid-grid");
  grid?.addEventListener("input", updateWhatIf);
  document.getElementById("add-permit-boxes-btn")?.addEventListener("click", () => {
    if (deadlineExpired() || !grid) return;
    const current = grid.querySelectorAll(".permit-bid-price").length;
    const toAdd = Math.min(5, Math.max(0, quantityLimit - current));
    if (toAdd === 0) {
      setStatus(stageStatus, "warn", `You can bid for at most ${quantityLimit} permits, the number for sale.`);
      return;
    }
    grid.insertAdjacentHTML("beforeend", Array.from({ length: toAdd }, (_, index) => (
      permitBoxHtml(current + index + 1, "", { kind: "extra" })
    )).join(""));
    grid.querySelector(`.permit-bid:nth-child(${current + 1}) input`)?.focus();
    updateWhatIf();
  });
  document.getElementById("clear-bids-btn")?.addEventListener("click", () => {
    if (deadlineExpired()) return;
    for (const input of document.querySelectorAll(".permit-bid-price")) {
      input.value = "";
    }
    updateWhatIf();
  });
  document.getElementById("submit-bids-btn")?.addEventListener("click", submitBids);
  updateWhatIf();
}

/** Save (or clear, with null) the team's Round 1 emissions choice. */
async function saveEmissionsChoice(emissions) {
  clearStatus(stageStatus);
  try {
    await apiJson("/api/permit-market/team/set-emissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ join_token: getJoinToken(), emissions }),
    });
    setStatus(stageStatus, "good", emissions === null
      ? "Emissions reset: you will use the permits you hold."
      : `Round 1 emissions set to ${emissions}. You can change this until the market closes.`);
    await refreshState();
  } catch (error) {
    setStatus(stageStatus, "bad", error.message);
  }
}

/** Round 1 control for banking and borrowing: how much to emit this round. */
function emissionsPlanHtml(state, expired) {
  const session = state.session;
  const baseline = Number(state.team.baseline_emissions);
  const penalty = Number(session.shortfall_penalty ?? 0);
  const choice = state.market?.emissions_choice;
  const options = [
    session.banking_enabled ? "Emit fewer units than the permits you hold and bank the rest for Round 2, where the cap is tighter." : "",
    session.borrowing_enabled ? `Emit more units than your permits and borrow the difference from Round 2. Borrowed permits must
      be covered in Round 2; each one still owed at the end of the game costs $${penalty.toFixed(2)}.` : "",
  ].filter(Boolean).map((line) => `<li>${line}</li>`).join("");
  return `<section class="emissions-plan" aria-labelledby="emissions-plan-heading">
      <h3 id="emissions-plan-heading">Round 1 emissions: ${session.banking_enabled && session.borrowing_enabled ? "bank or borrow" : (session.banking_enabled ? "bank" : "borrow")}</h3>
      <ul>${options}</ul>
      <div class="row">
        <label for="emissions-choice">Emit this round (0 to ${baseline} units)</label>
        <input id="emissions-choice" type="number" min="0" max="${baseline}" step="1" inputmode="numeric"
          value="${choice ?? ""}" placeholder="use my permits" style="max-width: 9rem" ${expired ? "disabled" : ""} />
        <button id="save-emissions-btn" class="primary" type="button" ${expired ? "disabled" : ""}>Save</button>
        <button id="reset-emissions-btn" class="secondary" type="button" ${expired ? "disabled" : ""}>Use my permits</button>
      </div>
      <p id="emissions-plan-summary" class="mac-note"></p>
    </section>`;
}

function renderMarketScaffold(state) {
  const expired = deadlineExpired();
  // The auction charts do not change during a market, so they are drawn once
  // here rather than on every refresh; that keeps them open or closed as the
  // student left them.
  const roundKey = String(state.session.current_phase) === "market2" ? "round2" : "round1";
  const shock = state.team?.shocks?.[roundKey];
  const shockBanner = shock == null ? "" : `<p class="shock-notice"><strong>Cost shock revealed:</strong> your MAC slope is
    ×${shock} this round${Number(shock) === 1 ? " (no change)" : `, so each unit of abatement now costs $${state.team.display_mac_slope} × a`}.
    Other firms learned theirs too, so what permits are worth has changed.</p>`;
  const showPlan = roundKey === "round1" && (state.session.banking_enabled || state.session.borrowing_enabled);
  stageContainer.innerHTML = `
    ${shockBanner}
    <div id="auction-outcome"></div>
    ${clearedAuctionsHtml(state.auction_reports)}
    <div id="position-tiles" class="position-kv" style="margin: 0.6rem 0"></div>
    ${showPlan ? emissionsPlanHtml(state, expired) : ""}
    <h3>Buy and Sell Orders</h3>
    <div id="market-depth"></div>
    <p class="learning-prompt">Before trading: would buying one permit save more in abatement costs than you would pay?
      Would selling one earn more than the additional abatement would cost?</p>
    <h3>Place an Order</h3>
    <form id="order-form" class="grid">
      <div>
        <label for="order-side">Side</label>
        <select id="order-side" ${expired ? "disabled" : ""}>
          <option value="bid">Buy permits</option>
          <option value="ask">Sell permits</option>
        </select>
      </div>
      <div>
        <label for="order-price">Price per permit</label>
        <input id="order-price" type="number" min="0" step="0.5" inputmode="decimal" ${expired ? "disabled" : ""} />
      </div>
      <div>
        <label for="order-qty">Quantity</label>
        <input id="order-qty" type="number" min="1" step="1" inputmode="numeric" ${expired ? "disabled" : ""} />
      </div>
      <div class="row" style="align-items: end">
        <button id="post-order-btn" class="primary" type="submit" ${expired ? "disabled" : ""}>Send Order</button>
      </div>
    </form>
    <p><small class="note">A buy at or above the best ask (or a sell at or below the best bid) trades immediately at the resting order's price; otherwise it waits in the book. Selling is limited to permits you hold.</small></p>
    <div id="own-orders"></div>
    <h4 style="margin-top: 0.6rem">Trade Ticker</h4>
    <ul id="trade-ticker" class="ticker"></ul>
    ${expired ? `<p><small class="note">${state.session.phase_closed ? "Round scored. Waiting for the instructor to start the next phase." : "The market has closed. Waiting for the instructor to score the round."}</small></p>` : ""}
  `;

  document.getElementById("order-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!deadlineExpired()) {
      postOrder();
    }
  });
  document.getElementById("save-emissions-btn")?.addEventListener("click", () => {
    const raw = document.getElementById("emissions-choice").value.trim();
    if (raw === "") {
      saveEmissionsChoice(null);
      return;
    }
    const value = Number(raw);
    const baseline = Number(state.team.baseline_emissions);
    if (!Number.isInteger(value) || value < 0 || value > baseline) {
      setStatus(stageStatus, "warn", `Enter a whole number of units from 0 to ${baseline}.`);
      return;
    }
    saveEmissionsChoice(value);
  });
  document.getElementById("reset-emissions-btn")?.addEventListener("click", () => {
    document.getElementById("emissions-choice").value = "";
    saveEmissionsChoice(null);
  });
}

function renderMarketLiveData(state) {
  const market = state.market;
  if (!market) {
    return;
  }

  const outcome = document.getElementById("auction-outcome");
  if (outcome) {
    const result = state.auction_result;
    const allocation = state.own_allocation;
    const banked = Number(state.permits_banked_in ?? 0);
    const owed = Number(state.permits_owed_in ?? 0);
    const carry = [
      banked > 0 ? `plus ${banked} banked from Round 1` : "",
      owed > 0 ? `minus ${owed} owed from Round 1 borrowing` : "",
    ].filter(Boolean).join(", ");
    const method = state.allocation_method ?? "uniform";
    const headline = method === "free"
      ? "<strong>Free allocation:</strong> permits were given away in proportion to baseline emissions."
      : (result?.clearing_price == null
        ? "<strong>Auction result:</strong> no price (no bids)."
        : (method === "pay_as_bid"
          ? `<strong>Auction result:</strong> lowest winning bid $${formatNumber(result.clearing_price, 2)}; each winner paid its own bids.`
          : `<strong>Auction result:</strong> $${formatNumber(result.clearing_price, 2)} per permit.`));
    outcome.innerHTML = result
      ? `
        <p>${headline}</p>
        <p><small class="note">
          You ${method === "free" ? "received" : "won"} ${formatNumber(allocation?.permits_won ?? 0, 0)} permit(s) for $${formatNumber(allocation?.payment ?? 0, 2)}${carry ? `, ${carry}` : ""}.
          Cap: ${formatNumber(result.cap, 0)}${method === "free" ? "" : `; total bids: ${formatNumber(result.total_bid_quantity, 0)}`}.
        </small></p>
      `
      : "";
  }

  const tiles = document.getElementById("position-tiles");
  if (tiles) {
    const preview = market.score_preview;
    const position = macModel(state);
    const carryTiles = [
      preview?.permits_banked_out > 0 ? ["Banked for Round 2", formatNumber(preview.permits_banked_out, 0)] : null,
      preview?.permits_borrowed_out > 0 ? ["Borrowed from Round 2", formatNumber(preview.permits_borrowed_out, 0)] : null,
      preview?.shortfall > 0 ? ["Still owed: penalty", `$${formatNumber(preview.shortfall_penalty, 2)}`] : null,
    ].filter(Boolean).map(([label, value]) => `<div class="cell"><div class="label">${label}</div><div class="value">${value}</div></div>`).join("");
    tiles.innerHTML = `
      <div class="cell"><div class="label">Permits held</div><div class="value">${formatNumber(market.holdings, 0)}</div></div>
      <div class="cell"><div class="label">Emissions, E</div><div class="value">${formatNumber(position?.emissions, 0)}</div></div>
      <div class="cell"><div class="label">Required abatement</div><div class="value">${formatNumber(position?.abatement, 0)}</div></div>
      <div class="cell"><div class="label">Available to sell</div><div class="value">${formatNumber(Math.max(0, market.sellable), 0)}</div></div>
      <div class="cell"><div class="label">Abatement cost</div><div class="value">$${formatNumber(position?.cost, 2)}</div></div>
      <div class="cell"><div class="label">Round score if market closed now</div><div class="value">${preview ? formatNumber(preview.score, 2) : "-"}</div></div>
      ${carryTiles}
    `;
  }

  const planSummary = document.getElementById("emissions-plan-summary");
  if (planSummary && market.score_preview) {
    const preview = market.score_preview;
    const choice = market.emissions_choice;
    const carryText = preview.permits_banked_out > 0
      ? `banking ${preview.permits_banked_out} permit(s) for Round 2`
      : (preview.permits_borrowed_out > 0
        ? `borrowing ${preview.permits_borrowed_out} permit(s) from Round 2`
        : "neither banking nor borrowing");
    const tradeoff = preview.permits_borrowed_out > 0
      ? " Borrowing raises this round's score, but the borrowed permits must come out of Round 2."
      : (preview.permits_banked_out > 0 ? " Banking lowers this round's score, but the banked permits are yours to use in Round 2." : "");
    planSummary.textContent = `${choice == null ? "Using your permits" : `Your choice: emit ${choice}`}. If the market closed now you would
      emit ${preview.emissions}, holding ${market.holdings} permit(s) and ${carryText}; this round's abatement cost would be
      $${formatNumber(preview.abatement_cost, 2)}.${tradeoff}`;
  }

  const ownOrders = document.getElementById("own-orders");
  if (ownOrders) {
    if (market.own_open_orders.length === 0) {
      ownOrders.innerHTML = "";
    } else {
      const rows = market.own_open_orders.map((order) => `
        <tr>
          <td>${order.side === "bid" ? "Buy" : "Sell"}</td>
          <td>${formatNumber(order.price, 2)}</td>
          <td>${formatNumber(order.remaining_quantity, 0)} of ${formatNumber(order.quantity, 0)}</td>
          <td><button class="secondary cancel-order-btn" data-order-id="${order.id}" type="button">Cancel</button></td>
        </tr>
      `).join("");
      ownOrders.innerHTML = `
        <h4 style="margin-top: 0.6rem">Your Open Orders</h4>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Side</th><th>Price</th><th>Open</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
      for (const button of ownOrders.querySelectorAll(".cancel-order-btn")) {
        button.addEventListener("click", () => cancelOrder(button.dataset.orderId));
      }
    }
  }

  const depth = document.getElementById("market-depth");
  if (depth) depth.innerHTML = marketDepthHtml(market.book, { closed: deadlineExpired() });

  const ticker = document.getElementById("trade-ticker");
  if (ticker) {
    ticker.innerHTML = market.recent_trades.length === 0
      ? "<li><small class=\"note\">No trades yet. Be the first.</small></li>"
      : market.recent_trades.map((trade) => {
        const ownTag = trade.you_bought ? " (you bought)" : (trade.you_sold ? " (you sold)" : "");
        return `<li class="${ownTag ? "own-trade" : ""}">${formatNumber(trade.quantity, 0)} permit(s) at ${formatNumber(trade.price, 2)}${ownTag}</li>`;
      }).join("");
  }
}

function stageSignature(state) {
  const phase = String(state?.session?.current_phase ?? "");
  const bidsJson = JSON.stringify(state?.own_bids ?? []);
  return [
    phase,
    state?.team?.baseline_emissions ? "assigned" : "unassigned",
    bidsJson,
    state?.session?.phase_closed ? "closed" : "open",
    Object.keys(state?.auction_reports ?? {}).filter((key) => state.auction_reports[key]).join("+"),
    deadlineExpired() ? "expired" : "live",
  ].join("|");
}

function renderStage(state, options = {}) {
  if (!state) {
    return;
  }

  const phase = String(state.session.current_phase ?? "");
  phaseLabelElement.textContent = phaseLabel(phase, state);

  const signature = stageSignature(state);
  const scaffoldChanged = options.force || signature !== renderedStageSignature;

  if (scaffoldChanged) {
    renderedStageSignature = signature;

    if (phase === "setup") {
      stageTitle.textContent = "Waiting Room";
      stageContainer.innerHTML = `<p><small class="note">${state.joined_team_count} team(s) joined. The game begins when the instructor starts it.</small></p>`;
    } else if (phase === "auction1" || phase === "auction2") {
      stageTitle.textContent = state.allocation_method === "free" ? "Free Permits" : "Permit Auction";
      renderAuctionStage(state);
    } else if (phase === "market1" || phase === "market2") {
      stageTitle.textContent = "Open Market";
      renderMarketScaffold(state);
    } else if (phase === "complete") {
      stageTitle.textContent = "Game Over";
      stageContainer.innerHTML = `
        <p>The market is closed. Compare your final emissions with your earlier trading decisions.</p>
        <div class="learning-prompt">
          <h3>When did another trade stop helping?</h3>
          <p>Buying a permit lets you emit more and avoid abatement. Selling a permit requires more abatement,
            unless you have surplus permits. Compare the cost change with the price paid or received.</p>
          <p>With competitive trading and divisible emissions, an interior cost-minimizing choice has
            <strong>MAC = P</strong>. Firms facing the same price then have the same MAC, so total abatement cost is minimized.</p>
          <p>Here permits are whole units. At an interior stopping point, a common price can lie between
            the cost saved by buying one more permit and the cost added by selling one.
            Did the class exhaust those gains from trade, or did time run out first?</p>
          ${state.session.banking_enabled ? "<p>For Round 1, also consider the future use of any surplus permits you banked.</p>" : ""}
        </div>
        ${clearedAuctionsHtml(state.auction_reports)}`;
    }
  }

  if (phase === "market1" || phase === "market2") {
    renderMarketLiveData(state);
  }
}

/** Keep closed-phase comparisons visible without resetting expanded details on refresh. */
function renderMacDistributions(state) {
  const reports = state.mac_distributions ?? [];
  macDistributionsCard.classList.toggle("hidden", reports.length === 0);
  const signature = JSON.stringify(reports);
  if (macDistributionsElement.dataset.signature !== signature) {
    macDistributionsElement.innerHTML = reports.length ? macDistributionsHtml(reports) : "";
    macDistributionsElement.dataset.signature = signature;
  }
}

function renderResults(state) {
  const scores = state?.own_scores ?? [];
  if (scores.length === 0) {
    resultsCard.classList.add("hidden");
    resultsCostEffectiveness.innerHTML = "";
    resultsTable.innerHTML = "";
    return;
  }

  const session = state?.session ?? {};
  const carryOn = Boolean(session.banking_enabled || session.borrowing_enabled);
  const shocksOn = Boolean(session.shock_round1 || session.shock_round2);
  const rows = scores.map((row) => ({
    round: row.round_key === "round1" ? "Round 1" : "Round 2",
    ...(shocksOn ? { mac_shock: `×${Number(row.mac_shock ?? 1)}` } : {}),
    permits_allocated: row.permits_from_auction,
    auction_paid: formatNumber(row.auction_payment, 2),
    ...(carryOn ? { banked_in: row.permits_banked_in, owed_in: row.permits_owed_in ?? 0 } : {}),
    bought: row.market_buys,
    sold: row.market_sells,
    market_net_spend: formatNumber(row.market_net_spend, 2),
    emissions: row.emissions,
    abatement_cost: formatNumber(row.abatement_cost, 2),
    ...(carryOn ? {
      banked_out: row.permits_banked_out,
      borrowed_out: row.permits_borrowed_out ?? 0,
      penalty: formatNumber(row.shortfall_penalty ?? 0, 2),
    } : {}),
    score: formatNumber(row.score, 2),
    benchmark: formatNumber(row.benchmark_score, 2),
  }));

  resultsCard.classList.remove("hidden");
  resultsCostEffectiveness.innerHTML = (state.cost_effectiveness ?? []).map((report) => {
    const round = report.round_key === "round2" ? "Round 2" : "Round 1";
    return `<p><strong>The market ${report.achieved ? "did" : "did not"} achieve cost-effectiveness in ${round}.</strong></p>`;
  }).join("");
  resultsTable.innerHTML = tableHtml(rows);
}

function renderLeaderboard(state) {
  const leaderboard = state?.leaderboard ?? [];
  const scored = leaderboard.some((row) => row.rounds_scored > 0);
  if (!scored) {
    leaderboardCard.classList.add("hidden");
    leaderboardTable.innerHTML = "";
    return;
  }

  const ownTeamId = String(state?.team?.id ?? "");
  const rows = leaderboard.map((row) => `
    <tr class="${String(row.team_id) === ownTeamId ? "leaderboard-you" : ""}">
      <td>${row.rank}</td>
      <td>${row.team_name}</td>
      <td>${row.round1 == null ? "-" : formatNumber(row.round1, 2)}</td>
      <td>${row.round2 == null ? "-" : formatNumber(row.round2, 2)}</td>
      <td>${formatNumber(row.total_score, 2)}</td>
      <td>${formatNumber(row.points_vs_benchmark, 2)}</td>
    </tr>
  `).join("");

  leaderboardCard.classList.remove("hidden");
  leaderboardTable.innerHTML = `
    <table>
      <thead><tr><th>Rank</th><th>Team</th><th>Round 1</th><th>Round 2</th><th>Total</th><th>Vs Benchmark</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function refreshState() {
  const joinToken = getJoinToken();
  if (!joinToken) {
    joinCard.classList.remove("hidden");
    firmCard.classList.add("hidden");
    stageCard.classList.add("hidden");
    resultsCard.classList.add("hidden");
    leaderboardCard.classList.add("hidden");
    macDistributionsCard.classList.add("hidden");
    return;
  }

  try {
    const state = await apiJson(`/api/permit-market/team/state?join_token=${encodeURIComponent(joinToken)}`);
    latestState = state;
    joinCard.classList.add("hidden");
    clearStatus(joinStatus);
    syncCountdown(state);
    renderFirmCard(state);
    renderStage(state);
    renderMacDistributions(state);
    renderResults(state);
    renderLeaderboard(state);
  } catch (error) {
    joinCard.classList.remove("hidden");
    setStatus(joinStatus, "bad", error.message);
  }
}

async function joinTeam() {
  clearStatus(joinStatus);
  const teamName = teamNameInput.value.trim();
  if (!teamName) {
    setStatus(joinStatus, "warn", "Please enter a team name.");
    return;
  }

  try {
    const response = await apiJson("/api/permit-market/team/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_name: teamName }),
    });

    setJoinToken(response.join_token);
    setStatus(joinStatus, "good", `Joined as ${response.team.team_name}.`);
    await refreshState();

    if (!refreshTimer) {
      refreshTimer = window.setInterval(refreshState, POLL_INTERVAL_MS);
    }
  } catch (error) {
    setStatus(joinStatus, "bad", error.message);
  }
}

joinButton.addEventListener("click", joinTeam);
teamNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    joinTeam();
  }
});

resetTokenButton.addEventListener("click", () => {
  clearJoinToken();
  joinCard.classList.remove("hidden");
  clearStatus(joinStatus);
  firmCard.classList.add("hidden");
  stageCard.classList.add("hidden");
  resultsCard.classList.add("hidden");
  leaderboardCard.classList.add("hidden");
  macDistributionsCard.classList.add("hidden");
  setStatus(joinStatus, "warn", "Enter a team name to join or rejoin.");
  teamNameInput.focus();
});

if (getJoinToken()) {
  refreshState();
  refreshTimer = window.setInterval(refreshState, POLL_INTERVAL_MS);
}
