import {
  apiJson,
  clearStatus,
  downloadTextFile,
  formatNumber,
  setStatus,
  toCsv,
} from "/games/hedonics-online/shared.mjs";

const ROUND_LABELS = {
  setup: "Setup",
  round1: "Round 1",
  round2: "Round 2",
  round3: "Round 3",
  round4a: "Round 4a",
  round4b: "Round 4b",
  round5: "Round 5",
  complete: "Complete",
};

const TOKEN_KEY = "hedonics_admin_access_token";

const loginStatus = document.getElementById("login-status");
const loginButton = document.getElementById("login-btn");
const logoutButton = document.getElementById("logout-btn");
const adminEmailInput = document.getElementById("admin-email");
const adminPasswordInput = document.getElementById("admin-password");

const adminPanel = document.getElementById("admin-panel");

const sessionNameInput = document.getElementById("session-name");
const expectedTeamCountInput = document.getElementById("expected-team-count");
const scoringRankPointsInput = document.getElementById("scoring-rank-points");
const wrongAnswerDeductionInput = document.getElementById("wrong-answer-deduction");
const createSessionButton = document.getElementById("create-session-btn");
const sessionStatus = document.getElementById("session-status");

const phaseInput = document.getElementById("set-phase");
const applyPhaseButton = document.getElementById("apply-phase-btn");
const refreshButton = document.getElementById("refresh-admin-btn");
const exportButton = document.getElementById("export-csv-btn");
const phaseStatus = document.getElementById("phase-status");

const sessionKv = document.getElementById("session-kv");
const roundContextElement = document.getElementById("round-context");
const revealStatusElement = document.getElementById("reveal-status");
const leaderboardTableElement = document.getElementById("leaderboard-table");
const phaseTeamTitleElement = document.getElementById("phase-team-title");
const phaseTeamTableElement = document.getElementById("phase-team-table");
const teamsTableElement = document.getElementById("teams-table");
const submissionsTableElement = document.getElementById("submissions-table");

/** @type {{supabaseUrl: string, supabaseAnonKey: string} | null} */
let publicConfig = null;
/** @type {number | null} */
let refreshTimer = null;
/** @type {any | null} */
let latestAdminState = null;

function roundLabel(phase) {
  return ROUND_LABELS[String(phase ?? "")] ?? String(phase ?? "unknown");
}

function utilityEquation(alphaEq, betaSq) {
  return `U = ${formatNumber(alphaEq, 0)} * EQ + ${formatNumber(betaSq, 0)} * SQ - P`;
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
  const acronymTokens = new Set(["id", "eq", "sq"]);
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

  const cfg = await apiJson("/api/hedonics/config");
  publicConfig = {
    supabaseUrl: cfg.supabase_url,
    supabaseAnonKey: cfg.supabase_anon_key,
  };
  return publicConfig;
}

function renderTable(target, rows) {
  target.innerHTML = tableHtml(rows);
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

function renderSessionSummary(state) {
  const session = state?.session;
  if (!session) {
    sessionKv.innerHTML = "<dt>Status</dt><dd>No active session</dd>";
    return;
  }

  const progress = state.progress ?? {};
  const scoring = state.scoring ?? {};
  const rankPointsText = Array.isArray(scoring.rank_points)
    ? scoring.rank_points.join(",")
    : (session.scoring_rank_points ?? "-");
  const wrongDeductionValue = scoring.wrong_deduction ?? session.scoring_wrong_deduction ?? "-";
  const correctByRound = progress.correct_by_round ?? {};

  sessionKv.innerHTML = "";
  const entries = [
    ["Session", session.session_name],
    ["Phase", roundLabel(session.current_phase)],
    ["Expected Teams", progress.expected_team_count ?? session.expected_team_count],
    ["Joined Teams", progress.team_count ?? 0],
    ["Scoring Points (1st,2nd,...)", rankPointsText],
    ["Wrong Deduction", formatNumber(wrongDeductionValue, 2)],
    ["Correct Round 1", correctByRound.round1 ?? 0],
    ["Correct Round 2", correctByRound.round2 ?? 0],
    ["Correct Round 3", correctByRound.round3 ?? 0],
    ["Correct Round 4a", correctByRound.round4a ?? 0],
    ["Correct Round 4b", correctByRound.round4b ?? 0],
    ["Correct Round 5", correctByRound.round5 ?? 0],
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
    roundContextElement.innerHTML = "<p><small class=\"note\">No active round.</small></p>";
    return;
  }

  const rows = ["A", "B", "C", "D", "E", "F"]
    .map((locationCode) => ({
      location: locationCode,
      eq: roundContext.eq_by_location?.[locationCode] ?? "",
      sq: roundContext.sq_by_location?.[locationCode] ?? "",
      equilibrium_houses: roundContext.equilibrium_houses?.[locationCode] ?? "",
      equilibrium_prices: roundContext.equilibrium_prices?.[locationCode] ?? "",
    }));

  const tableRows = rows.map((row) => ({
    location: row.location,
    eq: formatNumber(row.eq, 0),
    sq: formatNumber(row.sq, 0),
    equilibrium_houses: formatNumber(row.equilibrium_houses, 0),
    equilibrium_prices: formatNumber(row.equilibrium_prices, 0),
  }));
  renderTable(roundContextElement, tableRows);

  roundContextElement.insertAdjacentHTML(
    "beforeend",
    `<p><small class="note">${roundContext.supply_rule}</small></p>`,
  );
}

function renderRevealStatus(revealState) {
  if (!revealState || !revealState.round_key) {
    revealStatusElement.innerHTML = "<p><small class=\"note\">No active round reveal state.</small></p>";
    return;
  }

  const summaryRows = [{
    round: roundLabel(revealState.round_key),
    joined_teams: revealState.joined_team_count,
    resolved_teams: revealState.resolved_team_count,
    all_teams_resolved: revealState.all_teams_resolved,
    all_teams_correct: revealState.all_teams_correct,
  }];
  let html = tableHtml(summaryRows);

  if (revealState.revealed_market) {
    const rows = ["A", "B", "C", "D", "E", "F"]
      .map((locationCode) => ({
        location: locationCode,
        equilibrium_houses: formatNumber(revealState.revealed_market.equilibrium_houses?.[locationCode], 0),
        equilibrium_prices: formatNumber(revealState.revealed_market.equilibrium_prices?.[locationCode], 0),
      }));
    html += "<h3>Revealed Market</h3>";
    html += tableHtml(rows);
  }

  revealStatusElement.innerHTML = html;
}

function flattenRows(state) {
  const session = state?.session;
  const teams = state?.teams ?? [];
  const submissions = state?.submissions ?? [];
  const phase = String(session?.current_phase ?? "");

  const submissionsByTeam = new Map(
    submissions
      .filter((row) => String(row.round_key) === phase)
      .map((row) => [String(row.team_id), row]),
  );
  const leaderboardByTeam = new Map((state.leaderboard ?? []).map((row) => [String(row.team_id), row]));

  return teams.map((team) => {
    const submission = submissionsByTeam.get(String(team.id)) ?? {};
    const score = leaderboardByTeam.get(String(team.id)) ?? {};

    return {
      session_name: session?.session_name ?? "",
      phase,
      team_letter: team.team_letter,
      team_name: team.team_name,
      household_type: team.household_type_label,
      household_count: team.household_count,
      alpha_eq: team.alpha_eq,
      beta_sq: team.beta_sq,
      utility_equation: utilityEquation(team.alpha_eq, team.beta_sq),
      submitted_best_location: submission.submitted_best_location ?? "",
      submitted_best_utility: submission.submitted_best_utility ?? "",
      houses_correct: submission.houses_correct ?? "",
      best_location_correct: submission.best_location_correct ?? "",
      best_utility_correct: submission.best_utility_correct ?? "",
      is_correct: submission.is_correct ?? "",
      incorrect_attempts: submission.incorrect_attempts ?? 0,
      total_points: score.total_points ?? 0,
      rank: score.rank ?? "",
    };
  });
}

function renderAllTables(state) {
  renderSessionSummary(state);
  renderRoundContext(state.round_context);
  renderRevealStatus(state.reveal_state);

  const phaseName = roundLabel(state?.session?.current_phase ?? "setup");
  phaseTeamTitleElement.textContent = `Current Phase Team Detail (${phaseName})`;

  const teamsRows = (state.teams ?? []).map((row) => ({
    ...row,
    utility_equation: utilityEquation(row.alpha_eq, row.beta_sq),
  }));
  const leaderboardRows = (state.leaderboard ?? []).map((row) => ({
    rank: row.rank,
    team_name: row.team_name,
    household_type: row.household_type_label,
    total_points: formatNumber(row.total_points, 2),
    correct_points: formatNumber(row.correct_points, 2),
    penalty_points: formatNumber(row.penalty_points, 2),
    incorrect_attempts: row.incorrect_attempts,
    correct_submissions: row.correct_submissions,
  }));

  renderTable(leaderboardTableElement, leaderboardRows);
  renderTable(phaseTeamTableElement, state.phase_team_rows ?? []);
  renderTable(teamsTableElement, teamsRows);
  renderTable(submissionsTableElement, state.submissions ?? []);
}

async function fetchAdminState() {
  const token = getAdminToken();
  if (!token) {
    adminPanel.classList.add("hidden");
    return;
  }

  try {
    const state = await apiJson("/api/hedonics/admin/state", {
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
    scoring_rank_points: scoringRankPointsInput.value.trim(),
    scoring_wrong_deduction: Number(wrongAnswerDeductionInput.value),
  };

  try {
    await apiJson("/api/hedonics/admin/create-session", {
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

  try {
    await apiJson("/api/hedonics/admin/set-phase", {
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

loginButton.addEventListener("click", adminLogin);
logoutButton.addEventListener("click", adminLogout);
createSessionButton.addEventListener("click", createSession);
applyPhaseButton.addEventListener("click", applyPhaseUpdate);
refreshButton.addEventListener("click", fetchAdminState);
exportButton.addEventListener("click", exportSnapshot);

if (getAdminToken()) {
  fetchAdminState();
  refreshTimer = window.setInterval(fetchAdminState, 5000);
}
