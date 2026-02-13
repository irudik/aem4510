import {
  apiJson,
  clearStatus,
  downloadTextFile,
  formatNumber,
  phaseLabel,
  setStatus,
  toCsv,
} from "/games/emissions-trading-online/shared.mjs";

const TOKEN_KEY = "emissions_admin_access_token";

const loginCard = document.getElementById("login-card");
const loginStatus = document.getElementById("login-status");
const loginButton = document.getElementById("login-btn");
const logoutButton = document.getElementById("logout-btn");
const adminEmailInput = document.getElementById("admin-email");
const adminPasswordInput = document.getElementById("admin-password");

const adminPanel = document.getElementById("admin-panel");

const sessionNameInput = document.getElementById("session-name");
const expectedTeamCountInput = document.getElementById("expected-team-count");
const commonAllocationInput = document.getElementById("common-allocation");
const scoringRankPointsInput = document.getElementById("scoring-rank-points");
const wrongAnswerDeductionInput = document.getElementById("wrong-answer-deduction");
const createSessionButton = document.getElementById("create-session-btn");
const sessionStatus = document.getElementById("session-status");

const phaseInput = document.getElementById("set-phase");
const calledPriceInput = document.getElementById("called-price-input");
const mdInput = document.getElementById("md-input");
const applyPhaseButton = document.getElementById("apply-phase-btn");
const refreshButton = document.getElementById("refresh-admin-btn");
const exportButton = document.getElementById("export-csv-btn");
const phaseStatus = document.getElementById("phase-status");

const sessionKv = document.getElementById("session-kv");
const marketSummaryElement = document.getElementById("market-summary");
const leaderboardTableElement = document.getElementById("leaderboard-table");
const phaseTeamTitleElement = document.getElementById("phase-team-title");
const phaseTeamTableElement = document.getElementById("phase-team-table");
const teamsTableElement = document.getElementById("teams-table");
const uniformTableElement = document.getElementById("uniform-table");
const priceTableElement = document.getElementById("price-table");
const mdTableElement = document.getElementById("md-table");

/** @type {{supabaseUrl: string, supabaseAnonKey: string} | null} */
let publicConfig = null;
/** @type {number | null} */
let refreshTimer = null;
/** @type {any | null} */
let latestAdminState = null;

function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setAdminToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function macEquation(intercept, slope) {
  return `MAC = ${formatNumber(intercept, 0)} - ${formatNumber(slope, 2)} × E`;
}

function formatColumnLabel(columnName) {
  const acronymTokens = new Set(["id", "md", "mac"]);
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

async function loadPublicConfig() {
  if (publicConfig) {
    return publicConfig;
  }

  const cfg = await apiJson("/api/emissions-trading/config");
  publicConfig = {
    supabaseUrl: cfg.supabase_url,
    supabaseAnonKey: cfg.supabase_anon_key,
  };
  return publicConfig;
}

function renderTable(target, rows) {
  if (!rows || rows.length === 0) {
    target.innerHTML = "<p><small class=\"note\">No rows yet.</small></p>";
    return;
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

  target.innerHTML = `
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderSessionSummary(state) {
  const session = state?.session;
  if (!session) {
    sessionKv.innerHTML = "<dt>Status</dt><dd>No active session</dd>";
    marketSummaryElement.innerHTML = "<p><small class=\"note\">No active session.</small></p>";
    return;
  }

  const progress = state.progress ?? {};
  const scoring = state.scoring ?? {};
  const rankPointsText = Array.isArray(scoring.rank_points)
    ? scoring.rank_points.join(",")
    : (session.scoring_rank_points ?? "-");
  const wrongDeductionValue =
    scoring.wrong_deduction ?? session.scoring_wrong_deduction ?? "-";
  sessionKv.innerHTML = "";
  const entries = [
    ["Session", session.session_name],
    ["Phase", phaseLabel(session.current_phase)],
    ["Expected Teams", progress.expected_team_count ?? session.expected_team_count],
    ["Joined Teams", progress.team_count ?? 0],
    ["Common Allocation", formatNumber(session.common_permit_allocation, 0)],
    ["Called Price", session.called_price == null ? "-" : formatNumber(session.called_price, 0)],
    ["Called Price Excess Demand", session.called_price_excess_demand == null ? "Hidden" : formatNumber(session.called_price_excess_demand, 2)],
    ["MD Constant", session.md_constant == null ? "-" : formatNumber(session.md_constant, 0)],
    ["Scoring Points (1st,2nd,...)", rankPointsText],
    ["Wrong Deduction", formatNumber(wrongDeductionValue, 2)],
    ["Uniform Correct", progress.uniform_correct ?? 0],
    ["Price Correct", progress.called_price_correct ?? 0],
    ["MD Correct", progress.md_correct ?? 0],
  ];

  for (const [label, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    sessionKv.append(dt, dd);
  }

  if (state.market_summary) {
    const summaryRows = [
      {
        equilibrium_price: formatNumber(state.market_summary.equilibrium_price, 2),
        excess_demand_at_equilibrium: formatNumber(state.market_summary.excess_demand_at_equilibrium, 4),
      },
    ];
    renderTable(marketSummaryElement, summaryRows);
  } else {
    marketSummaryElement.innerHTML = "<p><small class=\"note\">Need at least one team for equilibrium calculations.</small></p>";
  }
}

function flattenRows(state) {
  const session = state.session;
  const teams = state.teams ?? [];
  const uniformByTeam = new Map((state.submissions?.uniform ?? []).map((row) => [row.team_id, row]));
  const priceByTeam = new Map((state.submissions?.called_price ?? []).map((row) => [row.team_id, row]));
  const mdByTeam = new Map((state.submissions?.md ?? []).map((row) => [row.team_id, row]));
  const leaderboardByTeam = new Map((state.leaderboard ?? []).map((row) => [row.team_id, row]));

  return teams.map((team) => {
    const uniform = uniformByTeam.get(team.id) ?? {};
    const price = priceByTeam.get(team.id) ?? {};
    const md = mdByTeam.get(team.id) ?? {};
    const score = leaderboardByTeam.get(team.id) ?? {};

    return {
      session_name: session?.session_name ?? "",
      phase: session?.current_phase ?? "",
      team_letter: team.team_letter,
      team_name: team.team_name,
      mac_intercept: team.mac_intercept,
      mac_slope: team.mac_slope,
      mac_equation: macEquation(team.mac_intercept, team.mac_slope),
      initial_emissions: team.initial_emissions,
      permit_allocation: team.permit_allocation,
      uniform_submitted_emissions: uniform.submitted_emissions ?? "",
      uniform_submitted_abatement: uniform.submitted_abatement ?? "",
      uniform_submitted_cost: uniform.submitted_abatement_cost ?? "",
      uniform_is_correct: uniform.is_correct ?? "",
      called_price: session?.called_price ?? "",
      called_submitted_abatement: price.submitted_abatement ?? "",
      called_is_correct: price.is_correct ?? "",
      md_constant: session?.md_constant ?? "",
      md_submitted_efficient_emissions: md.submitted_efficient_emissions ?? "",
      md_submitted_industry_cap: md.submitted_industry_cap ?? "",
      md_is_correct: md.is_correct ?? "",
      points_total: score.total_points ?? 0,
      points_rank: score.rank ?? "",
    };
  });
}

function renderAllTables(state) {
  renderSessionSummary(state);
  const phaseName = phaseLabel(state?.session?.current_phase ?? "setup");
  phaseTeamTitleElement.textContent = `Current Phase Team Detail (${phaseName})`;
  const phaseRows = (state.phase_team_rows ?? []).map((row) => ({
    ...row,
    mac_equation: row.mac_equation ?? macEquation(row.mac_intercept, row.mac_slope),
  }));
  const teamsRows = (state.teams ?? []).map((row) => ({
    ...row,
    mac_equation: macEquation(row.mac_intercept, row.mac_slope),
  }));
  const leaderboardRows = (state.leaderboard ?? []).map((row) => ({
    rank: row.rank,
    team_name: row.team_name,
    total_points: formatNumber(row.total_points, 2),
    correct_points: formatNumber(row.correct_points, 2),
    penalty_points: formatNumber(row.penalty_points, 2),
    incorrect_attempts: row.incorrect_attempts,
    correct_submissions: row.correct_submissions,
  }));
  renderTable(leaderboardTableElement, leaderboardRows);
  renderTable(phaseTeamTableElement, phaseRows);
  renderTable(teamsTableElement, teamsRows);
  renderTable(uniformTableElement, state.submissions?.uniform ?? []);
  renderTable(priceTableElement, state.submissions?.called_price ?? []);
  renderTable(mdTableElement, state.submissions?.md ?? []);
}

async function fetchAdminState() {
  const token = getAdminToken();
  if (!token) {
    adminPanel.classList.add("hidden");
    return;
  }

  try {
    const state = await apiJson("/api/emissions-trading/admin/state", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    latestAdminState = state;
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
  latestAdminState = null;
  clearStatus(loginStatus);
  setStatus(loginStatus, "warn", "Logged out.");
}

async function createSession() {
  clearStatus(sessionStatus);

  const payload = {
    session_name: sessionNameInput.value.trim(),
    expected_team_count: Number(expectedTeamCountInput.value),
    common_permit_allocation: Number(commonAllocationInput.value),
    scoring_rank_points: scoringRankPointsInput.value.trim(),
    scoring_wrong_deduction: Number(wrongAnswerDeductionInput.value),
  };

  try {
    await apiJson("/api/emissions-trading/admin/create-session", {
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

async function applyPhaseUpdate() {
  clearStatus(phaseStatus);

  const payload = {
    phase: phaseInput.value,
  };

  if (payload.phase === "called_price") {
    payload.called_price = Number(calledPriceInput.value);
  }
  if (payload.phase === "md") {
    payload.md_constant = Number(mdInput.value);
  }

  try {
    await apiJson("/api/emissions-trading/admin/set-phase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify(payload),
    });

    setStatus(phaseStatus, "good", "Phase updated.");
    await fetchAdminState();
  } catch (error) {
    setStatus(phaseStatus, "bad", error.message);
  }
}

function exportSnapshot() {
  if (!latestAdminState || !latestAdminState.session) {
    setStatus(phaseStatus, "warn", "No active session data to export.");
    return;
  }

  const rows = flattenRows(latestAdminState);
  const csvText = toCsv(rows);
  const safeSessionName = String(latestAdminState.session.session_name || "session").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const filename = `${safeSessionName}_snapshot.csv`;
  downloadTextFile(filename, csvText);
  setStatus(phaseStatus, "good", `Exported ${rows.length} team rows to ${filename}.`);
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
applyPhaseButton.addEventListener("click", applyPhaseUpdate);
refreshButton.addEventListener("click", fetchAdminState);
exportButton.addEventListener("click", exportSnapshot);

bindEnterAction([adminEmailInput, adminPasswordInput], adminLogin);
bindEnterAction(
  [
    sessionNameInput,
    expectedTeamCountInput,
    commonAllocationInput,
    scoringRankPointsInput,
    wrongAnswerDeductionInput,
  ],
  createSession,
);
bindEnterAction([phaseInput, calledPriceInput, mdInput], applyPhaseUpdate);

if (getAdminToken()) {
  fetchAdminState();
  refreshTimer = window.setInterval(fetchAdminState, 5000);
}
