import {
  apiJson,
  clearStatus,
  formatNumber,
  setStatus,
} from "/games/permit-market-online/shared.mjs";

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

const joinStatus = document.getElementById("join-status");
const joinButton = document.getElementById("join-btn");
const resetTokenButton = document.getElementById("reset-token-btn");
const teamNameInput = document.getElementById("team-name");

const firmCard = document.getElementById("firm-card");
const firmKv = document.getElementById("firm-kv");
const valueScheduleElement = document.getElementById("value-schedule");
const stageCard = document.getElementById("stage-card");
const stageTitle = document.getElementById("stage-title");
const phaseLabelElement = document.getElementById("phase-label");
const roundTimerElement = document.getElementById("round-timer");
const stageStatus = document.getElementById("stage-status");
const stageContainer = document.getElementById("stage-container");
const resultsCard = document.getElementById("results-card");
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

function phaseLabel(phase) {
  return PHASE_LABELS[String(phase ?? "")] ?? String(phase ?? "unknown");
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
    ["Phase", phaseLabel(session.current_phase)],
    ["Baseline Emissions", team.baseline_emissions ?? "Assigned at game start"],
    ["MAC Slope", team.mac_slope ?? "-"],
    ["Banking", session.banking_enabled ? "On: unused permits carry to round 2" : "Off"],
  ];

  firmKv.innerHTML = "";
  for (const [label, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    firmKv.append(dt, dd);
  }

  if (team.value_schedule && team.value_schedule.length > 0) {
    const scheduleRow = {};
    for (const step of team.value_schedule) {
      scheduleRow[`p${step.permit_number}`] = formatNumber(step.value, 0);
    }
    valueScheduleElement.innerHTML = `
      <p><small class="note">What each permit is worth to you (avoided abatement cost), from your 1st to your last:</small></p>
      <table class="value-schedule">
        <thead><tr>${team.value_schedule.map((step) => `<th>#${step.permit_number}</th>`).join("")}</tr></thead>
        <tbody><tr>${team.value_schedule.map((step) => `<td>${formatNumber(step.value, 0)}</td>`).join("")}</tr></tbody>
      </table>
      <p><small class="note">Keep this private: it is your bidding and trading guide.</small></p>
    `;
  } else {
    valueScheduleElement.innerHTML = "<p><small class=\"note\">Your firm's cost schedule appears when the instructor starts the game.</small></p>";
  }
}

async function submitBids() {
  const bids = [];
  for (let index = 1; index <= 4; index += 1) {
    const price = document.getElementById(`bid-price-${index}`)?.value;
    const quantity = document.getElementById(`bid-qty-${index}`)?.value;
    if (price !== "" && quantity !== "" && price != null && quantity != null) {
      bids.push({ bid_price: Number(price), bid_quantity: Number(quantity) });
    }
  }

  if (bids.length === 0) {
    setStatus(stageStatus, "warn", "Fill in at least one bid row (price and quantity).");
    return;
  }

  clearStatus(stageStatus);
  try {
    await apiJson("/api/permit-market/team/submit-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ join_token: getJoinToken(), bids }),
    });
    setStatus(stageStatus, "good", "Bids submitted. You can revise them until the auction closes.");
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
  const cap = phase === "auction1" ? session.cap_round1 : session.cap_round2;
  const ownBids = state.own_bids ?? [];

  const bidRow = (index) => {
    const existing = ownBids.find((bid) => Number(bid.bid_index) === index);
    return `
      <tr>
        <td>Bid ${index}</td>
        <td><input id="bid-price-${index}" type="number" min="0" step="0.5" inputmode="decimal" value="${existing ? existing.bid_price : ""}" ${expired ? "disabled" : ""} /></td>
        <td><input id="bid-qty-${index}" type="number" min="1" step="1" inputmode="numeric" value="${existing ? existing.bid_quantity : ""}" ${expired ? "disabled" : ""} /></td>
      </tr>
    `;
  };

  stageContainer.innerHTML = `
    <p class="called-price-callout">${formatNumber(cap, 0)} permits for sale</p>
    <ol class="phase-steps" aria-label="Auction steps">
      <li>Review your private permit values above.</li>
      <li>Enter up to four price and quantity bids.</li>
      <li>Submit before time expires; you may revise while the auction is open.</li>
    </ol>
    <p><small class="note">
      Sealed uniform-price auction: rank your bids by price; the top ${formatNumber(cap, 0)} bid units win and
      everyone pays the lowest accepted price. Bid up to 4 price/quantity pairs; total quantity at most your
      baseline (${state.team.baseline_emissions ?? "-"}). Your value table above tells you what each permit is worth.
    </small></p>
    <div class="table-wrap">
      <table>
        <thead><tr><th></th><th>Price per permit</th><th>Quantity</th></tr></thead>
        <tbody>${[1, 2, 3, 4].map(bidRow).join("")}</tbody>
      </table>
    </div>
    <div class="row" style="margin-top: 0.6rem">
      <button id="submit-bids-btn" class="primary" type="button" ${expired ? "disabled" : ""}>
        ${ownBids.length > 0 ? "Revise Bids" : "Submit Bids"}
      </button>
      ${ownBids.length > 0 ? "<span class=\"badge\">Bids in</span>" : ""}
    </div>
    ${expired ? "<p><small class=\"note\">The auction has closed. Waiting for the instructor to clear it.</small></p>" : ""}
  `;

  document.getElementById("submit-bids-btn")?.addEventListener("click", submitBids);
}

function renderMarketScaffold(state) {
  const expired = deadlineExpired();

  stageContainer.innerHTML = `
    <div id="auction-outcome"></div>
    <div id="position-tiles" class="position-kv" style="margin: 0.6rem 0"></div>
    <ol class="phase-steps" aria-label="Market steps">
      <li>Check your permits held and how many are available to sell.</li>
      <li>Choose buy or sell, then enter your limit price and quantity.</li>
      <li>Watch the order book and cancel or revise resting orders as prices change.</li>
    </ol>
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
    <div class="book-grid" style="margin-top: 0.6rem">
      <div><h4>Buyers (bids)</h4><div id="book-bids" class="table-wrap"></div></div>
      <div><h4>Sellers (asks)</h4><div id="book-asks" class="table-wrap"></div></div>
    </div>
    <h4 style="margin-top: 0.6rem">Trade Ticker</h4>
    <ul id="trade-ticker" class="ticker"></ul>
    ${expired ? "<p><small class=\"note\">The market has closed. Waiting for the instructor to score the round.</small></p>" : ""}
  `;

  document.getElementById("order-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!deadlineExpired()) {
      postOrder();
    }
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
    outcome.innerHTML = result
      ? `
        <p class="called-price-callout">Auction cleared at ${result.clearing_price == null ? "no price (no bids)" : formatNumber(result.clearing_price, 2)}</p>
        <p><small class="note">
          You won ${formatNumber(allocation?.permits_won ?? 0, 0)} permit(s) for ${formatNumber(allocation?.payment ?? 0, 2)}${banked > 0 ? `, plus ${banked} banked from round 1` : ""}.
          Cap: ${formatNumber(result.cap, 0)}; total bids: ${formatNumber(result.total_bid_quantity, 0)}.
        </small></p>
      `
      : "";
  }

  const tiles = document.getElementById("position-tiles");
  if (tiles) {
    const preview = market.score_preview;
    tiles.innerHTML = `
      <div class="cell"><div class="label">Permits held</div><div class="value">${formatNumber(market.holdings, 0)}</div></div>
      <div class="cell"><div class="label">Available to sell</div><div class="value">${formatNumber(market.sellable, 0)}</div></div>
      <div class="cell"><div class="label">Bought / sold</div><div class="value">${formatNumber(preview?.market_buys ?? 0, 0)} / ${formatNumber(preview?.market_sells ?? 0, 0)}</div></div>
      <div class="cell"><div class="label">Round score if market closed now</div><div class="value">${preview ? formatNumber(preview.score, 2) : "-"}</div></div>
    `;
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

  const bookBids = document.getElementById("book-bids");
  const bookAsks = document.getElementById("book-asks");
  if (bookBids && bookAsks) {
    bookBids.innerHTML = tableHtml(
      market.book.bids.map((level) => ({ price: formatNumber(level.price, 2), quantity: level.quantity })),
      ["Price", "Quantity"],
    );
    bookAsks.innerHTML = tableHtml(
      market.book.asks.map((level) => ({ price: formatNumber(level.price, 2), quantity: level.quantity })),
      ["Price", "Quantity"],
    );
  }

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
    deadlineExpired() ? "expired" : "live",
  ].join("|");
}

function renderStage(state, options = {}) {
  if (!state) {
    return;
  }

  const phase = String(state.session.current_phase ?? "");
  phaseLabelElement.textContent = phaseLabel(phase);

  const signature = stageSignature(state);
  const scaffoldChanged = options.force || signature !== renderedStageSignature;

  if (scaffoldChanged) {
    renderedStageSignature = signature;

    if (phase === "setup") {
      stageTitle.textContent = "Waiting Room";
      stageContainer.innerHTML = `<p><small class="note">${state.joined_team_count} team(s) joined. The game begins when the instructor starts it.</small></p>`;
    } else if (phase === "auction1" || phase === "auction2") {
      stageTitle.textContent = "Permit Auction";
      renderAuctionStage(state);
    } else if (phase === "market1" || phase === "market2") {
      stageTitle.textContent = "Open Market";
      renderMarketScaffold(state);
    } else if (phase === "complete") {
      stageTitle.textContent = "Game Over";
      stageContainer.innerHTML = "<p><small class=\"note\">The market is closed. Final standings are on the leaderboard below.</small></p>";
    }
  }

  if (phase === "market1" || phase === "market2") {
    renderMarketLiveData(state);
  }
}

function renderResults(state) {
  const scores = state?.own_scores ?? [];
  if (scores.length === 0) {
    resultsCard.classList.add("hidden");
    resultsTable.innerHTML = "";
    return;
  }

  const rows = scores.map((row) => ({
    round: row.round_key === "round1" ? "Round 1" : "Round 2",
    auction_permits: row.permits_from_auction,
    auction_paid: formatNumber(row.auction_payment, 2),
    banked_in: row.permits_banked_in,
    bought: row.market_buys,
    sold: row.market_sells,
    market_net_spend: formatNumber(row.market_net_spend, 2),
    emissions: row.emissions,
    abatement_cost: formatNumber(row.abatement_cost, 2),
    banked_out: row.permits_banked_out,
    score: formatNumber(row.score, 2),
    benchmark: formatNumber(row.benchmark_score, 2),
  }));

  resultsCard.classList.remove("hidden");
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
    firmCard.classList.add("hidden");
    stageCard.classList.add("hidden");
    resultsCard.classList.add("hidden");
    leaderboardCard.classList.add("hidden");
    return;
  }

  try {
    const state = await apiJson(`/api/permit-market/team/state?join_token=${encodeURIComponent(joinToken)}`);
    latestState = state;
    clearStatus(joinStatus);
    syncCountdown(state);
    renderFirmCard(state);
    renderStage(state);
    renderResults(state);
    renderLeaderboard(state);
  } catch (error) {
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
  clearStatus(joinStatus);
  firmCard.classList.add("hidden");
  stageCard.classList.add("hidden");
  resultsCard.classList.add("hidden");
  leaderboardCard.classList.add("hidden");
  setStatus(joinStatus, "warn", "Stored join token cleared.");
});

if (getJoinToken()) {
  refreshState();
  refreshTimer = window.setInterval(refreshState, POLL_INTERVAL_MS);
}
