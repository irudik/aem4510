import {
  apiJson,
  clearStatus,
  formatNumber,
  setStatus,
} from "/games/coase-online/shared.mjs";

const ROUND_LABELS = {
  setup: "Setup",
  round1: "Round 1",
  round2: "Round 2",
  round3: "Round 3",
  complete: "Complete",
};

const TOKEN_KEY = "coase_admin_access_token";

const loginStatus = document.getElementById("login-status");
const loginButton = document.getElementById("login-btn");
const logoutButton = document.getElementById("logout-btn");
const adminEmailInput = document.getElementById("admin-email");
const adminPasswordInput = document.getElementById("admin-password");

const adminPanel = document.getElementById("admin-panel");

const sessionNameInput = document.getElementById("session-name");
const expectedPlayerCountInput = document.getElementById("expected-player-count");
const createSessionButton = document.getElementById("create-session-btn");
const startGameButton = document.getElementById("start-game-btn");
const sessionStatus = document.getElementById("session-status");

const phaseInput = document.getElementById("set-phase");
const roundSecondsInput = document.getElementById("round-seconds");
const applyPhaseButton = document.getElementById("apply-phase-btn");
const refreshButton = document.getElementById("refresh-admin-btn");
const phaseStatus = document.getElementById("phase-status");

const sessionKv = document.getElementById("session-kv");
const roundContextElement = document.getElementById("round-context");
const pairStatusTableElement = document.getElementById("pair-status-table");
const pairsTableElement = document.getElementById("pairs-table");
const playersTableElement = document.getElementById("players-table");
const offersTableElement = document.getElementById("offers-table");
const roundSummaryTableElement = document.getElementById("round-summary-table");
const leaderboardTableElement = document.getElementById("leaderboard-table");
const outcomesTableElement = document.getElementById("outcomes-table");

/** @type {{supabaseUrl: string, supabaseAnonKey: string} | null} */
let publicConfig = null;
/** @type {number | null} */
let refreshTimer = null;

function roundLabel(phase) {
  return ROUND_LABELS[String(phase ?? "")] ?? String(phase ?? "unknown");
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

function formatColumnLabel(columnName) {
  const acronymTokens = new Set(["id"]);
  const spacedText = String(columnName)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  if (!spacedText) {
    return "";
  }

  return spacedText
    .split(/\s+/)
    .map((token) => {
      const lowerToken = token.toLowerCase();
      if (acronymTokens.has(lowerToken)) {
        return lowerToken.toUpperCase();
      }
      return `${token.slice(0, 1).toUpperCase()}${token.slice(1).toLowerCase()}`;
    })
    .join(" ");
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
  const header = columns.map((column) => `<th>${formatColumnLabel(column)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${row[column] == null ? "" : String(row[column])}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderTable(target, rows) {
  target.innerHTML = tableHtml(rows);
}

function renderSessionSummary(state) {
  const session = state?.session;
  if (!session) {
    sessionKv.innerHTML = "<dt>Status</dt><dd>No active session</dd>";
    return;
  }

  const players = state.players ?? [];
  const joinedPlayers = players.filter((player) => !player.is_admin_proxy).length;
  const adminProxyPlayers = players.filter((player) => player.is_admin_proxy).length;
  const progress = state.progress ?? {};
  const resolvedByRound = progress.resolved_by_round ?? {};

  const deadlineText = session.phase_deadline_at
    ? new Date(String(session.phase_deadline_at)).toLocaleTimeString()
    : "-";

  sessionKv.innerHTML = "";
  const entries = [
    ["Session", session.session_name],
    ["Phase", roundLabel(session.current_phase)],
    ["Round Length (s)", session.round_seconds ?? "-"],
    ["Round Deadline", deadlineText],
    ["Started", boolText(session.has_started)],
    ["Expected Players", progress.expected_player_count ?? session.expected_player_count ?? "-"],
    ["Joined Players", joinedPlayers],
    ["Admin Proxy Players", adminProxyPlayers],
    ["Pairs", progress.pair_count ?? 0],
    ["Current Round Resolved Pairs", progress.current_round_resolved_pairs ?? 0],
    ["All Pairs Resolved This Round", boolText(progress.all_pairs_resolved_current_round)],
    ["Resolved Round 1", resolvedByRound.round1 ?? 0],
    ["Resolved Round 2", resolvedByRound.round2 ?? 0],
    ["Resolved Round 3", resolvedByRound.round3 ?? 0],
  ];

  for (const [label, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    sessionKv.append(dt, dd);
  }
}

function renderRoundContext(roundContext) {
  if (!roundContext) {
    roundContextElement.innerHTML = "<p><small class=\"note\">No active round. Start the game and set a round phase.</small></p>";
    return;
  }

  const payoffRows = Object.entries(roundContext.payoff_schedule ?? {})
    .map(([emissions, payoff]) => ({
      generator_hours: Number(emissions),
      operator_a_payoff: formatNumber(payoff.player_a, 0),
      resident_b_payoff: formatNumber(payoff.player_b, 0),
    }))
    .sort((left, right) => left.generator_hours - right.generator_hours);

  roundContextElement.innerHTML = `
    <p><small class="note">${roundContext.rights_note}</small></p>
    ${tableHtml(payoffRows)}
    <p><small class="note">${roundContext.legal_cost_note}</small></p>
  `;
}

function renderAllTables(state) {
  renderSessionSummary(state);
  renderRoundContext(state.round_context);

  const pairStatusRows = (state.pair_status ?? []).map((row) => ({
    pair_number: row.pair_number,
    round: roundLabel(row.round_key),
    offers_made: row.offers_made,
    pending_hours: row.pending_offer_emissions,
    pending_payment: row.pending_offer_payment,
    resolved: boolText(row.resolved),
    no_deal: row.no_deal == null ? "" : boolText(row.no_deal),
    agreed_hours: row.agreed_emissions,
    payment: row.payment_noncontroller_to_controller,
    player_a_payoff: row.player_a_payoff,
    player_b_payoff: row.player_b_payoff,
  }));

  const pairDetailRows = (state.pair_details ?? []).map((row) => ({
    pair_number: row.pair_number,
    player_a_name: row.player_a_is_admin_proxy ? `${row.player_a_name} (Admin)` : row.player_a_name,
    player_b_name: row.player_b_is_admin_proxy ? `${row.player_b_name} (Admin)` : row.player_b_name,
    player_a_id: row.player_a_id,
    player_b_id: row.player_b_id,
  }));

  const playerRows = (state.players ?? []).map((row) => ({
    player_name: row.player_name,
    player_name_normalized: row.player_name_normalized,
    is_admin_proxy: boolText(row.is_admin_proxy),
    id: row.id,
    created_at: row.created_at,
  }));

  const playerNamesById = new Map(
    (state.players ?? []).map((row) => [String(row.id), String(row.player_name ?? "")]),
  );
  const pairNumbersById = new Map(
    (state.pairs ?? []).map((row) => [String(row.id), Number(row.pair_number)]),
  );

  const offerRows = (state.offers ?? []).map((row) => ({
    round: roundLabel(row.round_key),
    pair_number: pairNumbersById.get(String(row.pair_id)) ?? "",
    offer_index: row.offer_index,
    proposer: playerNamesById.get(String(row.proposer_player_id)) ?? "",
    generator_hours: row.offered_emissions,
    payment: row.offered_payment_noncontroller_to_controller,
    legal_fee_paid_by_a: row.offered_legal_fee_paid_by_a,
    status: row.status,
    created_at: row.created_at,
  }));

  const roundSummaryRows = (state.round_summaries ?? []).map((row) => ({
    round: roundLabel(row.round_key),
    status_quo_hours: row.status_quo_emissions,
    resolved_pairs: `${row.resolved_pairs} / ${row.pair_count}`,
    deals: row.deals,
    no_deals: row.no_deals,
    pairs_at_1_hour: row.pairs_at_efficient_emissions,
    average_payment: row.average_payment_among_deals == null
      ? "-"
      : formatNumber(row.average_payment_among_deals, 2),
    total_surplus: row.total_surplus == null ? "-" : formatNumber(row.total_surplus, 1),
  }));

  const leaderboardRows = (state.leaderboard ?? []).map((row) => ({
    rank: row.rank,
    player: row.player_name,
    round_1: row.round1 == null ? "-" : formatNumber(row.round1, 2),
    round_2: row.round2 == null ? "-" : formatNumber(row.round2, 2),
    round_3: row.round3 == null ? "-" : formatNumber(row.round3, 2),
    total: formatNumber(row.total_payoff, 2),
  }));

  const outcomeRows = (state.outcomes ?? []).map((row) => ({
    round: roundLabel(row.round_key),
    pair_number: pairNumbersById.get(String(row.pair_id)) ?? "",
    deal: row.no_deal ? "No deal" : "Deal",
    agreed_hours: row.agreed_emissions,
    payment: row.payment_noncontroller_to_controller,
    legal_fee_paid_by_a: row.legal_fee_paid_by_a,
    legal_fee_paid_by_b: row.legal_fee_paid_by_b,
    player_a_payoff: row.player_a_payoff,
    player_b_payoff: row.player_b_payoff,
    resolved_at: row.resolved_at,
  }));

  renderTable(pairStatusTableElement, pairStatusRows);
  renderTable(pairsTableElement, pairDetailRows);
  renderTable(playersTableElement, playerRows);
  renderTable(offersTableElement, offerRows);
  renderTable(roundSummaryTableElement, roundSummaryRows);
  renderTable(leaderboardTableElement, leaderboardRows);
  renderTable(outcomesTableElement, outcomeRows);

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

  const cfg = await apiJson("/api/coase/config");
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
    const state = await apiJson("/api/coase/admin/state", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

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
      refreshTimer = window.setInterval(fetchAdminState, 5000);
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
    expected_player_count: Number(expectedPlayerCountInput.value),
  };

  try {
    await apiJson("/api/coase/admin/create-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify(payload),
    });

    setStatus(sessionStatus, "good", "Created new active session.");
    await fetchAdminState();
  } catch (error) {
    setStatus(sessionStatus, "bad", error.message);
  }
}

async function startGame() {
  clearStatus(sessionStatus);

  try {
    await apiJson("/api/coase/admin/start-game", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAdminToken()}`,
      },
    });

    setStatus(sessionStatus, "good", "Game started and players paired randomly.");
    await fetchAdminState();
  } catch (error) {
    setStatus(sessionStatus, "bad", error.message);
  }
}

async function applyPhaseUpdate() {
  clearStatus(phaseStatus);

  try {
    const response = await apiJson("/api/coase/admin/set-phase", {
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

    const finalizedPairs = Number(response?.finalized_pairs ?? 0);
    const finalizedNote = finalizedPairs > 0
      ? ` Closed ${finalizedPairs} unresolved pair${finalizedPairs === 1 ? "" : "s"} at the status quo.`
      : "";
    setStatus(phaseStatus, "good", `Phase updated.${finalizedNote}`);
    await fetchAdminState();
  } catch (error) {
    setStatus(phaseStatus, "bad", error.message);
  }
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

bindEnterAction([adminEmailInput, adminPasswordInput], adminLogin);
bindEnterAction([sessionNameInput, expectedPlayerCountInput], createSession);
bindEnterAction([phaseInput, roundSecondsInput], applyPhaseUpdate);

if (getAdminToken()) {
  fetchAdminState();
  refreshTimer = window.setInterval(fetchAdminState, 5000);
}
