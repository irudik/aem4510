import { auctionComparisonHtml } from "./auction-charts.mjs";
import { phaseControls } from "./phase-controls.mjs";
import { marketDepthHtml } from "./market-depth.mjs";
import { benchmarkPriceHtml } from "./benchmark-price.mjs";
import { macDistributionsHtml } from "./mac-distribution.mjs";
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
const borrowingEnabledInput = document.getElementById("borrowing-enabled");
const shortfallPenaltyInput = document.getElementById("shortfall-penalty");
const allocation1Input = document.getElementById("allocation-1");
const allocation2Input = document.getElementById("allocation-2");
const shock1Input = document.getElementById("shock-1");
const shock2Input = document.getElementById("shock-2");

const ALLOCATION_LABELS = {
  uniform: "Uniform-price auction",
  pay_as_bid: "Pay-as-bid auction",
  free: "Free (grandfathered by baseline)",
};
const createSessionButton = document.getElementById("create-session-btn");
const startGameButton = document.getElementById("start-game-btn");
const sessionStatus = document.getElementById("session-status");

const phaseInput = document.getElementById("set-phase");
const roundSecondsInput = document.getElementById("round-seconds");
const phaseControlEdits = phaseControls(phaseInput, roundSecondsInput);
const applyPhaseButton = document.getElementById("apply-phase-btn");
const closePhaseButton = document.getElementById("close-phase-btn");
let closingPhase = false;
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
const costEffectivenessElement = document.getElementById("cost-effectiveness");
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

function costEffectivenessHtml(reports, teamNamesById) {
  if (!reports?.length) return "";
  return reports.map((report) => {
    const round = report.round_key === "round2" ? "Round 2" : "Round 1";
    if (report.achieved) {
      return `<h3>${round}: cost-effective allocation</h3><p><strong>The market achieved cost-effectiveness.</strong></p>`;
    }
    const rows = report.firms_off_allocation.map((row) => ({
      firm: teamNamesById.get(String(row.team_id)) ?? "",
      final_permits: row.actual_permits,
      cost_effective_permits: row.cost_effective_permits,
      difference: row.permit_difference,
    }));
    return `<h3>${round}: firms off the cost-effective allocation</h3>`
      + `<p><strong>The market did not achieve cost-effectiveness.</strong></p>${tableHtml(rows)}`;
  }).join("");
}

function renderAuctionCharts(state) {
  const keys = ["auction1", "auction2"].filter((key) => state?.auction_charts?.[key]);
  auctionChartsElement.innerHTML = keys.length
    ? keys.map((key) => auctionComparisonHtml(state, key)).join("")
    : "<p class=\"mac-note\">The charts appear when an auction opens and firms have been assigned.</p>";
}

function renderSessionSummary(state) {
  const session = state?.session;
  closePhaseButton.disabled = closingPhase || !session || session.phase_closed
    || !["auction1", "auction2", "market1", "market2"].includes(session.current_phase);
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
    ["Phase Status", session.phase_closed ? "Closed — waiting for instructor" : "Not finalized"],
    ["Phase Deadline", deadlineText],
    ["Teams Joined", (state.teams ?? []).length],
    ["Expected Teams", session.expected_team_count],
    ["Round 1 Cap", session.cap_round1 ?? `${session.cap_share_round1}% of baseline (set when auction opens)`],
    ["Round 2 Cap", session.cap_round2 ?? `${session.cap_share_round2}% of baseline (set when auction opens)`],
    ["Round 1 Permits", `${ALLOCATION_LABELS[session.allocation_round1] ?? "Uniform-price auction"}${session.shock_round1 ? ", cost shock" : ""}`],
    ["Round 2 Permits", `${ALLOCATION_LABELS[session.allocation_round2] ?? "Uniform-price auction"}${session.shock_round2 ? ", cost shock" : ""}`],
    ["Banking", boolText(session.banking_enabled)],
    ["Borrowing", session.borrowing_enabled ? `Yes (penalty $${formatNumber(session.shortfall_penalty, 2)} per permit still owed)` : "No"],
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
  const distributions = document.getElementById("mac-distributions");
  const distributionKey = JSON.stringify(state.mac_distributions ?? []);
  if (distributions.dataset.contents !== distributionKey) {
    distributions.innerHTML = macDistributionsHtml(state.mac_distributions);
    distributions.dataset.contents = distributionKey;
  }
  renderSessionSummary(state);
  renderAuctionCharts(state);

  const teamNamesById = new Map(
    (state.teams ?? []).map((row) => [String(row.id), String(row.team_name ?? "")]),
  );
  costEffectivenessElement.innerHTML = costEffectivenessHtml(state.cost_effectiveness, teamNamesById);

  const shocksOn = Boolean(state.session?.shock_round1 || state.session?.shock_round2);
  renderTable(teamsTableElement, (state.teams ?? []).map((row) => ({
    team: row.team_name,
    baseline_emissions: row.baseline_emissions ?? "-",
    mac_slope: row.mac_slope ?? "-",
    ...(shocksOn ? {
      round_1_shock: state.session?.shock_round1 ? `×${Number(row.mac_shock_round1 ?? 1)}` : "-",
      round_2_shock: state.session?.shock_round2 ? `×${Number(row.mac_shock_round2 ?? 1)}` : "-",
    } : {}),
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
  const depth = document.getElementById("market-depth");
  document.getElementById("cost-effective-price").innerHTML = benchmarkPriceHtml(state.cost_effective_benchmark);
  const marketPhase = ["market1", "market2"].includes(state.session?.current_phase);
  depth.innerHTML = marketPhase ? marketDepthHtml(state.open_book, {
    closed: Boolean(state.session.phase_closed) || (state.session.phase_deadline_at != null
      && Date.parse(state.session.phase_deadline_at) <= Date.now()),
  }) : "<p class=\"note\">Market depth appears during an open-market phase.</p>";
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
    shock: `×${Number(row.mac_shock ?? 1)}`,
    permits_allocated: row.permits_from_auction,
    auction_paid: formatNumber(row.auction_payment, 2),
    banked_in: row.permits_banked_in,
    owed_in: row.permits_owed_in ?? 0,
    bought: row.market_buys,
    sold: row.market_sells,
    net_spend: formatNumber(row.market_net_spend, 2),
    emissions: row.emissions,
    abatement_cost: formatNumber(row.abatement_cost, 2),
    banked_out: row.permits_banked_out,
    borrowed_out: row.permits_borrowed_out ?? 0,
    shortfall: row.shortfall ?? 0,
    penalty: formatNumber(row.shortfall_penalty ?? 0, 2),
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

  phaseControlEdits.sync(state?.session);
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
    borrowing_enabled: borrowingEnabledInput.value === "on",
    shortfall_penalty: Number(shortfallPenaltyInput.value),
    allocation_round1: allocation1Input.value,
    allocation_round2: allocation2Input.value,
    shock_round1: shock1Input.value === "on",
    shock_round2: shock2Input.value === "on",
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
  if (closingPhase) return;
  clearStatus(phaseStatus);
  const submitted = {
    current_phase: phaseInput.value,
    round_seconds: roundSecondsInput.value,
  };

  try {
    await apiJson("/api/permit-market/admin/set-phase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify({
        phase: submitted.current_phase,
        round_seconds: submitted.round_seconds ? Number(submitted.round_seconds) : undefined,
      }),
    });

    phaseControlEdits.applied(submitted);
    setStatus(phaseStatus, "good", "Phase updated.");
    await fetchAdminState();
  } catch (error) {
    setStatus(phaseStatus, "bad", error.message);
  }
}

async function closeCurrentPhase() {
  if (closingPhase || !latestState?.session) return;
  closingPhase = true;
  closePhaseButton.disabled = true;
  applyPhaseButton.disabled = true;
  clearStatus(phaseStatus);
  try {
    await apiJson("/api/permit-market/admin/close-phase", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}` },
      body: JSON.stringify({ phase: latestState.session.current_phase }),
    });
    setStatus(phaseStatus, "good", "Phase closed. Results are ready; the next phase has not started.");
  } catch (error) {
    setStatus(phaseStatus, "bad", error.message);
  } finally {
    closingPhase = false;
    applyPhaseButton.disabled = false;
    await fetchAdminState();
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
    mac_shock: row.mac_shock,
    permits_banked_in: row.permits_banked_in,
    permits_owed_in: row.permits_owed_in,
    market_buys: row.market_buys,
    market_sells: row.market_sells,
    market_net_spend: row.market_net_spend,
    permits_end: row.permits_end,
    emissions: row.emissions,
    abatement_cost: row.abatement_cost,
    permits_banked_out: row.permits_banked_out,
    permits_borrowed_out: row.permits_borrowed_out,
    shortfall: row.shortfall,
    shortfall_penalty: row.shortfall_penalty,
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
closePhaseButton.addEventListener("click", closeCurrentPhase);
refreshButton.addEventListener("click", fetchAdminState);
downloadCsvButton.addEventListener("click", downloadScoresCsv);

bindEnterAction([adminEmailInput, adminPasswordInput], adminLogin);
bindEnterAction([sessionNameInput, expectedTeamCountInput, capShare1Input, capShare2Input], createSession);
bindEnterAction([phaseInput, roundSecondsInput], applyPhaseUpdate);

if (getAdminToken()) {
  fetchAdminState();
  refreshTimer = window.setInterval(fetchAdminState, 4000);
}
