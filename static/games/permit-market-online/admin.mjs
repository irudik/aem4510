import {
  apiJson,
  clearStatus,
  downloadTextFile,
  formatNumber,
  setStatus,
  toCsv,
} from "/games/permit-market-online/shared.mjs";

const PHASE_LABELS = {
  setup: "Setup",
  auction1: "Auction (Round 1)",
  market1: "Open Market (Round 1)",
  auction2: "Auction (Round 2)",
  market2: "Open Market (Round 2)",
  complete: "Complete",
};

const TOKEN_KEY = "permit_market_admin_access_token";

const loginStatus = document.getElementById("login-status");
const loginButton = document.getElementById("login-btn");
const logoutButton = document.getElementById("logout-btn");
const adminEmailInput = document.getElementById("admin-email");
const adminPasswordInput = document.getElementById("admin-password");

const adminPanel = document.getElementById("admin-panel");

const sessionNameInput = document.getElementById("session-name");
const expectedTeamCountInput = document.getElementById("expected-team-count");
const capShare1Input = document.getElementById("cap-share-1");
const capShare2Input = document.getElementById("cap-share-2");
const roundSecondsCreateInput = document.getElementById("round-seconds-create");
const bankingEnabledInput = document.getElementById("banking-enabled");
const createSessionButton = document.getElementById("create-session-btn");
const startGameButton = document.getElementById("start-game-btn");
const sessionStatus = document.getElementById("session-status");

const phaseInput = document.getElementById("set-phase");
const roundSecondsInput = document.getElementById("round-seconds");
const applyPhaseButton = document.getElementById("apply-phase-btn");
const refreshButton = document.getElementById("refresh-admin-btn");
const downloadCsvButton = document.getElementById("download-csv-btn");
const phaseStatus = document.getElementById("phase-status");

const sessionKv = document.getElementById("session-kv");
const auctionChartsElement = document.getElementById("auction-charts");
const teamsTableElement = document.getElementById("teams-table");
const bidsTableElement = document.getElementById("bids-table");
const allocationsTableElement = document.getElementById("allocations-table");
const bookBidsElement = document.getElementById("book-bids");
const bookAsksElement = document.getElementById("book-asks");
const tradesTableElement = document.getElementById("trades-table");
const scoresTableElement = document.getElementById("scores-table");
const leaderboardTableElement = document.getElementById("leaderboard-table");

/** @type {{supabaseUrl: string, supabaseAnonKey: string} | null} */
let publicConfig = null;
/** @type {number | null} */
let refreshTimer = null;
/** @type {Record<string, unknown> | null} */
let latestState = null;

function phaseLabel(phase) {
  return PHASE_LABELS[String(phase ?? "")] ?? String(phase ?? "unknown");
}

function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setAdminToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function boolText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return value ? "Yes" : "No";
}

function tableHtml(rows) {
  if (!rows || rows.length === 0) {
    return "<p><small class=\"note\">No rows yet.</small></p>";
  }

  const columns = Object.keys(rows[0]);
  const header = columns.map((column) => `<th>${column.replace(/_/g, " ")}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${row[column] == null ? "" : String(row[column])}</td>`).join("")}</tr>`)
    .join("");

  return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderTable(target, rows) {
  target.innerHTML = tableHtml(rows);
}

/**
 * Draw one auction's clearing picture as an SVG: the submitted bid stack,
 * the true demand stack, the cap, and the clearing/benchmark prices.
 */
function auctionChartSvg(chart) {
  const width = 660;
  const height = 330;
  const margin = { top: 16, right: 20, bottom: 34, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const stacks = [chart.bid_stack ?? [], chart.true_demand_stack ?? []];
  const maxQuantity = Math.max(
    Number(chart.cap) * 1.25,
    ...stacks.map((stack) => stack.length > 0 ? stack[stack.length - 1].to_quantity : 0),
    1,
  );
  const maxPrice = Math.max(
    ...stacks.flatMap((stack) => stack.map((step) => Number(step.price))),
    Number(chart.clearing_price ?? 0),
    Number(chart.benchmark_price ?? 0),
    1,
  ) * 1.15;

  const x = (quantity) => margin.left + (quantity / maxQuantity) * plotWidth;
  const y = (price) => margin.top + plotHeight - (price / maxPrice) * plotHeight;

  const stackPath = (stack) => {
    if (!stack || stack.length === 0) {
      return "";
    }
    let path = `M ${x(stack[0].from_quantity)} ${y(stack[0].price)}`;
    for (const step of stack) {
      path += ` L ${x(step.from_quantity)} ${y(step.price)} L ${x(step.to_quantity)} ${y(step.price)}`;
    }
    return path;
  };

  const priceTicks = [];
  const tickCount = 5;
  for (let index = 0; index <= tickCount; index += 1) {
    priceTicks.push(Math.round((maxPrice / tickCount) * index));
  }

  const clearingLine = chart.clearing_price == null ? "" : `
    <line x1="${margin.left}" y1="${y(chart.clearing_price)}" x2="${width - margin.right}" y2="${y(chart.clearing_price)}"
      stroke="#0d5bd7" stroke-width="1.5" stroke-dasharray="6 4" />
    <text x="${width - margin.right}" y="${y(chart.clearing_price) - 5}" text-anchor="end" font-size="12" fill="#0d5bd7">
      clearing ${formatNumber(chart.clearing_price, 2)}
    </text>
  `;

  const benchmarkLine = chart.benchmark_price == null ? "" : `
    <line x1="${margin.left}" y1="${y(chart.benchmark_price)}" x2="${width - margin.right}" y2="${y(chart.benchmark_price)}"
      stroke="#5d6d83" stroke-width="1" stroke-dasharray="2 4" />
    <text x="${margin.left + 4}" y="${y(chart.benchmark_price) - 5}" font-size="12" fill="#5d6d83">
      efficient ${formatNumber(chart.benchmark_price, 2)}
    </text>
  `;

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" role="img">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
      ${priceTicks.map((tick) => `
        <line x1="${margin.left}" y1="${y(tick)}" x2="${width - margin.right}" y2="${y(tick)}" stroke="#eef2f8" />
        <text x="${margin.left - 6}" y="${y(tick) + 4}" text-anchor="end" font-size="11" fill="#5d6d83">${tick}</text>
      `).join("")}
      <path d="${stackPath(chart.true_demand_stack)}" fill="none" stroke="#b8c4d6" stroke-width="2.5" />
      <path d="${stackPath(chart.bid_stack)}" fill="none" stroke="#0d5bd7" stroke-width="2.5" />
      <line x1="${x(chart.cap)}" y1="${margin.top}" x2="${x(chart.cap)}" y2="${margin.top + plotHeight}"
        stroke="#b01b2f" stroke-width="2" />
      <text x="${x(chart.cap) + 4}" y="${margin.top + 12}" font-size="12" fill="#b01b2f">cap ${formatNumber(chart.cap, 0)}</text>
      ${clearingLine}
      ${benchmarkLine}
      <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#17212f" />
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#17212f" />
      <text x="${margin.left + plotWidth / 2}" y="${height - 8}" text-anchor="middle" font-size="12" fill="#17212f">Permits (cumulative)</text>
      <text x="12" y="${margin.top + plotHeight / 2}" text-anchor="middle" font-size="12" fill="#17212f"
        transform="rotate(-90 12 ${margin.top + plotHeight / 2})">Price</text>
    </svg>
  `;
}

function renderAuctionCharts(state) {
  const charts = state?.auction_charts ?? {};
  const keys = Object.keys(charts);
  if (keys.length === 0) {
    auctionChartsElement.innerHTML = "<p><small class=\"note\">The chart appears once an auction opens and bids arrive.</small></p>";
    return;
  }

  auctionChartsElement.innerHTML = keys.map((key) => {
    const chart = charts[key];
    const title = key === "auction1" ? "Round 1 Auction" : "Round 2 Auction";
    const liveTag = chart.is_live ? " <span class=\"badge\">live</span>" : "";
    return `
      <div class="chart-box" style="margin-bottom: 0.8rem">
        <h4>${title}${liveTag} &middot; ${formatNumber(chart.total_bid_quantity, 0)} units bid for ${formatNumber(chart.cap, 0)} permits</h4>
        ${auctionChartSvg(chart)}
        <p class="chart-legend">
          <span class="swatch" style="background:#0d5bd7"></span>Submitted bids
          <span class="swatch" style="background:#b8c4d6; margin-left: 0.8rem"></span>True permit values
          <span class="swatch" style="background:#b01b2f; margin-left: 0.8rem"></span>Cap
        </p>
      </div>
    `;
  }).join("");
}

function renderSessionSummary(state) {
  const session = state?.session;
  if (!session) {
    sessionKv.innerHTML = "<dt>Status</dt><dd>No active session</dd>";
    return;
  }

  const deadlineText = session.phase_deadline_at
    ? new Date(String(session.phase_deadline_at)).toLocaleTimeString()
    : "-";

  const openOrderCount = (state.orders ?? []).filter(
    (row) => String(row.status) === "open" && String(row.round_key) === String(session.current_phase),
  ).length;

  const entries = [
    ["Session", session.session_name],
    ["Phase", phaseLabel(session.current_phase)],
    ["Phase Deadline", deadlineText],
    ["Teams Joined", (state.teams ?? []).length],
    ["Expected Teams", session.expected_team_count],
    ["Round 1 Cap", session.cap_round1 ?? `${session.cap_share_round1}% of baseline (set when auction opens)`],
    ["Round 2 Cap", session.cap_round2 ?? `${session.cap_share_round2}% of baseline (set when auction opens)`],
    ["Banking", boolText(session.banking_enabled)],
    ["Teams With Bids In", state.bids_in_current_auction ?? "-"],
    ["Open Orders", openOrderCount],
    ["Trades", (state.trades ?? []).length],
  ];

  sessionKv.innerHTML = "";
  for (const [label, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    sessionKv.append(dt, dd);
  }
}

function renderAllTables(state) {
  renderSessionSummary(state);
  renderAuctionCharts(state);

  const teamNamesById = new Map(
    (state.teams ?? []).map((row) => [String(row.id), String(row.team_name ?? "")]),
  );

  renderTable(teamsTableElement, (state.teams ?? []).map((row) => ({
    team: row.team_name,
    baseline_emissions: row.baseline_emissions ?? "-",
    mac_slope: row.mac_slope ?? "-",
    joined_at: row.created_at,
  })));

  const currentPhase = String(state.session?.current_phase ?? "");
  const currentAuction = currentPhase === "auction2" || currentPhase === "market2" || currentPhase === "complete"
    ? "auction2"
    : "auction1";
  renderTable(bidsTableElement, (state.bids ?? [])
    .filter((row) => String(row.round_key) === currentAuction)
    .map((row) => ({
      team: teamNamesById.get(String(row.team_id)) ?? "",
      bid: row.bid_index,
      price: formatNumber(row.bid_price, 2),
      quantity: row.bid_quantity,
      submitted_at: row.submitted_at,
    })));

  renderTable(allocationsTableElement, (state.allocations ?? []).map((row) => ({
    auction: row.round_key === "auction1" ? "Round 1" : "Round 2",
    team: teamNamesById.get(String(row.team_id)) ?? "",
    permits_won: row.permits_won,
    payment: formatNumber(row.payment, 2),
  })));

  renderTable(bookBidsElement, (state.open_book?.bids ?? []).map((level) => ({
    price: formatNumber(level.price, 2),
    quantity: level.quantity,
  })));
  renderTable(bookAsksElement, (state.open_book?.asks ?? []).map((level) => ({
    price: formatNumber(level.price, 2),
    quantity: level.quantity,
  })));

  renderTable(tradesTableElement, (state.trades ?? []).slice(-30).reverse().map((row) => ({
    market: row.round_key === "market1" ? "Round 1" : "Round 2",
    buyer: teamNamesById.get(String(row.buyer_team_id)) ?? "",
    seller: teamNamesById.get(String(row.seller_team_id)) ?? "",
    price: formatNumber(row.price, 2),
    quantity: row.quantity,
    executed_at: row.executed_at,
  })));

  renderTable(scoresTableElement, (state.scores ?? []).map((row) => ({
    round: row.round_key === "round1" ? "Round 1" : "Round 2",
    team: teamNamesById.get(String(row.team_id)) ?? "",
    auction_permits: row.permits_from_auction,
    auction_paid: formatNumber(row.auction_payment, 2),
    banked_in: row.permits_banked_in,
    bought: row.market_buys,
    sold: row.market_sells,
    net_spend: formatNumber(row.market_net_spend, 2),
    emissions: row.emissions,
    abatement_cost: formatNumber(row.abatement_cost, 2),
    banked_out: row.permits_banked_out,
    score: formatNumber(row.score, 2),
    benchmark: formatNumber(row.benchmark_score, 2),
  })));

  renderTable(leaderboardTableElement, (state.leaderboard ?? []).map((row) => ({
    rank: row.rank,
    team: row.team_name,
    round_1: row.round1 == null ? "-" : formatNumber(row.round1, 2),
    round_2: row.round2 == null ? "-" : formatNumber(row.round2, 2),
    total: formatNumber(row.total_score, 2),
    vs_benchmark: formatNumber(row.points_vs_benchmark, 2),
  })));

  if (state?.session?.current_phase) {
    phaseInput.value = String(state.session.current_phase);
  }
  if (state?.session?.round_seconds && document.activeElement !== roundSecondsInput) {
    roundSecondsInput.value = String(state.session.round_seconds);
  }
}

async function loadPublicConfig() {
  if (publicConfig) {
    return publicConfig;
  }

  const cfg = await apiJson("/api/permit-market/config");
  publicConfig = {
    supabaseUrl: cfg.supabase_url,
    supabaseAnonKey: cfg.supabase_anon_key,
  };
  return publicConfig;
}

async function fetchAdminState() {
  const token = getAdminToken();
  if (!token) {
    adminPanel.classList.add("hidden");
    return;
  }

  try {
    const state = await apiJson("/api/permit-market/admin/state", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    latestState = state;
    clearStatus(loginStatus);
    adminPanel.classList.remove("hidden");
    renderAllTables(state);
  } catch (error) {
    adminPanel.classList.add("hidden");
    setStatus(loginStatus, "bad", `Admin state request failed: ${error.message}`);
  }
}

async function adminLogin() {
  clearStatus(loginStatus);

  const email = adminEmailInput.value.trim();
  const password = adminPasswordInput.value;

  if (!email || !password) {
    setStatus(loginStatus, "warn", "Enter email and password.");
    return;
  }

  try {
    const cfg = await loadPublicConfig();
    const tokenResponse = await apiJson(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.supabaseAnonKey,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!tokenResponse.access_token) {
      throw new Error("No access token returned by Supabase auth");
    }

    setAdminToken(tokenResponse.access_token);
    setStatus(loginStatus, "good", "Admin login successful.");
    await fetchAdminState();

    if (!refreshTimer) {
      refreshTimer = window.setInterval(fetchAdminState, 4000);
    }
  } catch (error) {
    setStatus(loginStatus, "bad", `Login failed: ${error.message}`);
  }
}

function adminLogout() {
  clearAdminToken();
  adminPanel.classList.add("hidden");
  clearStatus(loginStatus);
  setStatus(loginStatus, "warn", "Logged out.");
}

async function createSession() {
  clearStatus(sessionStatus);

  const payload = {
    session_name: sessionNameInput.value.trim(),
    expected_team_count: Number(expectedTeamCountInput.value),
    cap_share_round1: Number(capShare1Input.value),
    cap_share_round2: Number(capShare2Input.value),
    round_seconds: Number(roundSecondsCreateInput.value),
    banking_enabled: bankingEnabledInput.value === "on",
  };

  try {
    await apiJson("/api/permit-market/admin/create-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify(payload),
    });

    setStatus(sessionStatus, "good", "Created new active session. Teams can join.");
    await fetchAdminState();
  } catch (error) {
    setStatus(sessionStatus, "bad", error.message);
  }
}

async function startGame() {
  clearStatus(sessionStatus);

  try {
    await apiJson("/api/permit-market/admin/start-game", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAdminToken()}`,
      },
    });

    setStatus(sessionStatus, "good", "Game started: firm types assigned, auction 1 open.");
    await fetchAdminState();
  } catch (error) {
    setStatus(sessionStatus, "bad", error.message);
  }
}

async function applyPhaseUpdate() {
  clearStatus(phaseStatus);

  try {
    await apiJson("/api/permit-market/admin/set-phase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify({
        phase: phaseInput.value,
        round_seconds: roundSecondsInput.value ? Number(roundSecondsInput.value) : undefined,
      }),
    });

    setStatus(phaseStatus, "good", "Phase updated.");
    await fetchAdminState();
  } catch (error) {
    setStatus(phaseStatus, "bad", error.message);
  }
}

function downloadScoresCsv() {
  if (!latestState) {
    return;
  }

  const teamNamesById = new Map(
    (latestState.teams ?? []).map((row) => [String(row.id), String(row.team_name ?? "")]),
  );

  const rows = (latestState.scores ?? []).map((row) => ({
    round: row.round_key,
    team: teamNamesById.get(String(row.team_id)) ?? "",
    permits_from_auction: row.permits_from_auction,
    auction_payment: row.auction_payment,
    permits_banked_in: row.permits_banked_in,
    market_buys: row.market_buys,
    market_sells: row.market_sells,
    market_net_spend: row.market_net_spend,
    permits_end: row.permits_end,
    emissions: row.emissions,
    abatement_cost: row.abatement_cost,
    permits_banked_out: row.permits_banked_out,
    score: row.score,
    benchmark_price: row.benchmark_price,
    benchmark_score: row.benchmark_score,
  }));

  if (rows.length === 0) {
    setStatus(phaseStatus, "warn", "No scores to export yet.");
    return;
  }

  downloadTextFile("permit-market-scores.csv", toCsv(rows));
}

function bindEnterAction(elements, action) {
  for (const element of elements) {
    element?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      action();
    });
  }
}

loginButton.addEventListener("click", adminLogin);
logoutButton.addEventListener("click", adminLogout);
createSessionButton.addEventListener("click", createSession);
startGameButton.addEventListener("click", startGame);
applyPhaseButton.addEventListener("click", applyPhaseUpdate);
refreshButton.addEventListener("click", fetchAdminState);
downloadCsvButton.addEventListener("click", downloadScoresCsv);

bindEnterAction([adminEmailInput, adminPasswordInput], adminLogin);
bindEnterAction([sessionNameInput, expectedTeamCountInput, capShare1Input, capShare2Input], createSession);
bindEnterAction([phaseInput, roundSecondsInput], applyPhaseUpdate);

if (getAdminToken()) {
  fetchAdminState();
  refreshTimer = window.setInterval(fetchAdminState, 4000);
}
