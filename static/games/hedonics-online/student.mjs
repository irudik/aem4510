import {
  apiJson,
  clearStatus,
  formatNumber,
  setStatus,
} from "/games/hedonics-online/shared.mjs";

const LOCATION_CODES = ["A", "B", "C", "D", "E", "F"];
const ROUND_LABELS = {
  round1: "Round 1",
  round2: "Round 2",
  round3: "Round 3",
  round4a: "Round 4a",
  round4b: "Round 4b",
  round5: "Round 5",
};
const MAX_INCORRECT_SUBMISSIONS = 3;

const JOIN_TOKEN_KEY = "hedonics_game_join_token";
const DRAFT_KEY_PREFIX = "hedonics_game_stage_draft_";

const joinStatus = document.getElementById("join-status");
const joinButton = document.getElementById("join-btn");
const resetTokenButton = document.getElementById("reset-token-btn");
const teamNameInput = document.getElementById("team-name");

const teamLeaderboardRow = document.getElementById("team-leaderboard-row");
const teamCard = document.getElementById("team-card");
const teamKv = document.getElementById("team-kv");
const leaderboardCard = document.getElementById("leaderboard-card");
const leaderboardTable = document.getElementById("leaderboard-table");
const stageCard = document.getElementById("stage-card");
const phaseLabelElement = document.getElementById("phase-label");
const roundContextElement = document.getElementById("round-context");
const stageStatus = document.getElementById("stage-status");
const stageFormContainer = document.getElementById("stage-form-container");
const revealCard = document.getElementById("reveal-card");
const revealText = document.getElementById("reveal-text");
const revealTable = document.getElementById("reveal-table");

/** @type {number | null} */
let refreshTimer = null;

function roundLabel(phase) {
  return ROUND_LABELS[String(phase ?? "")] ?? String(phase ?? "unknown");
}

function utilityEquation(alphaEq, betaSq) {
  return `U = ${formatNumber(alphaEq, 0)} * EQ + ${formatNumber(betaSq, 0)} * SQ - P`;
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

function getDraftStorageKey(joinToken) {
  return `${DRAFT_KEY_PREFIX}${joinToken}`;
}

function readDraftStore(joinToken) {
  if (!joinToken) {
    return {};
  }

  try {
    const rawDraft = localStorage.getItem(getDraftStorageKey(joinToken));
    if (!rawDraft) {
      return {};
    }
    const parsed = JSON.parse(rawDraft);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return {};
  }

  return {};
}

function writeDraftStore(joinToken, draftStore) {
  if (!joinToken) {
    return;
  }

  localStorage.setItem(getDraftStorageKey(joinToken), JSON.stringify(draftStore));
}

function clearAllDrafts(joinToken) {
  if (!joinToken) {
    return;
  }

  localStorage.removeItem(getDraftStorageKey(joinToken));
}

function phaseDraftKey(session) {
  return String(session?.current_phase ?? "");
}

function getPhaseDraft(session) {
  const joinToken = getJoinToken();
  const draftStore = readDraftStore(joinToken);
  const draftKey = phaseDraftKey(session);
  const phaseDraft = draftStore[draftKey];
  if (phaseDraft && typeof phaseDraft === "object") {
    return phaseDraft;
  }
  return {};
}

function setPhaseDraftField(session, fieldName, fieldValue) {
  const joinToken = getJoinToken();
  if (!joinToken) {
    return;
  }

  const draftKey = phaseDraftKey(session);
  const draftStore = readDraftStore(joinToken);
  const previousDraft = draftStore[draftKey] && typeof draftStore[draftKey] === "object"
    ? draftStore[draftKey]
    : {};

  draftStore[draftKey] = {
    ...previousDraft,
    [fieldName]: fieldValue,
  };

  writeDraftStore(joinToken, draftStore);
}

function clearPhaseDraft(session) {
  const joinToken = getJoinToken();
  if (!joinToken) {
    return;
  }

  const draftKey = phaseDraftKey(session);
  const draftStore = readDraftStore(joinToken);
  if (!(draftKey in draftStore)) {
    return;
  }

  delete draftStore[draftKey];
  writeDraftStore(joinToken, draftStore);
}

function bindDraftInput(session, inputId, fieldName) {
  const input = document.getElementById(inputId);
  input?.addEventListener("input", () => {
    setPhaseDraftField(session, fieldName, input.value);
  });
}

function bindEnterToSubmit(formId) {
  const form = document.getElementById(formId);
  form?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }
    event.preventDefault();
    form.requestSubmit();
  });
}

function submissionAttemptSummary(submission) {
  const attemptsUsed = Math.max(
    0,
    Math.min(MAX_INCORRECT_SUBMISSIONS, Number(submission?.incorrect_attempts ?? 0)),
  );
  const attemptsRemaining = Math.max(0, MAX_INCORRECT_SUBMISSIONS - attemptsUsed);
  const submissionLocked = Boolean(submission?.is_locked);
  const submissionCorrect = Boolean(submission?.is_correct);

  return {
    attempts_used: attemptsUsed,
    attempts_remaining: attemptsRemaining,
    submission_locked: submissionLocked,
    submission_correct: submissionCorrect,
  };
}

function attemptNote(submission) {
  const summary = submissionAttemptSummary(submission);
  return `<p><small class="note">Incorrect attempts used: ${summary.attempts_used} of ${MAX_INCORRECT_SUBMISSIONS}. Remaining: ${summary.attempts_remaining}.</small></p>`;
}

function locationValue(profile, code) {
  const value = Number(profile?.[code]);
  return Number.isFinite(value) ? value : 0;
}

function roundContextTable(roundContext) {
  const body = LOCATION_CODES
    .map((code) => {
      const eqValue = formatNumber(locationValue(roundContext.eq_by_location, code), 0);
      const sqValue = formatNumber(locationValue(roundContext.sq_by_location, code), 0);
      return `<tr><td>${code}</td><td>${eqValue}</td><td>${sqValue}</td></tr>`;
    })
    .join("");

  return `
    <p><small class="note">${roundContext.supply_rule}</small></p>
    <table>
      <thead>
        <tr><th>Location</th><th>EQ</th><th>SQ</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function submissionRevealTable(submission) {
  const body = LOCATION_CODES
    .map((code) => {
      const houses = formatNumber(locationValue(submission?.expected_houses, code), 0);
      const price = formatNumber(locationValue(submission?.expected_prices, code), 0);
      const wtpValue = formatNumber(locationValue(submission?.expected_wtp, code), 0);
      const utility = formatNumber(locationValue(submission?.expected_utility, code), 0);
      return `<tr><td>${code}</td><td>${houses}</td><td>${price}</td><td>${wtpValue}</td><td>${utility}</td></tr>`;
    })
    .join("");

  const bestLocations = Array.isArray(submission?.expected_best_locations)
    ? submission.expected_best_locations.join(", ")
    : "-";

  return `
    <table>
      <thead>
        <tr><th>Location</th><th>Equilibrium Houses</th><th>Price</th><th>Your WTP</th><th>Your Utility</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
    <p><small class="note">Best location(s): ${bestLocations}. Best utility: ${formatNumber(submission?.expected_best_utility, 2)}.</small></p>
  `;
}

function revealMarketTable(market) {
  const body = LOCATION_CODES
    .map((code) => {
      const houses = formatNumber(locationValue(market?.equilibrium_houses, code), 0);
      const price = formatNumber(locationValue(market?.equilibrium_prices, code), 0);
      return `<tr><td>${code}</td><td>${houses}</td><td>${price}</td></tr>`;
    })
    .join("");

  return `
    <table>
      <thead>
        <tr><th>Location</th><th>Equilibrium Houses</th><th>Price</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderTeamCard(session, team) {
  teamLeaderboardRow.classList.remove("hidden");
  teamCard.classList.remove("hidden");
  leaderboardCard.classList.remove("hidden");
  stageCard.classList.remove("hidden");

  teamKv.innerHTML = "";
  const entries = [
    ["Session", session.session_name],
    ["Team Name", team.team_name],
    ["Team Letter", team.team_letter],
    ["Household Type", team.household_type_label],
    ["Number of Households", formatNumber(team.household_count, 0)],
    ["Alpha (EQ)", formatNumber(team.alpha_eq, 0)],
    ["Beta (SQ)", formatNumber(team.beta_sq, 0)],
    ["Utility Equation", utilityEquation(team.alpha_eq, team.beta_sq)],
  ];

  for (const [label, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    teamKv.append(dt, dd);
  }
}

function renderLeaderboard(rows, ownTeamId) {
  if (!rows || rows.length === 0) {
    leaderboardTable.innerHTML = "<p><small class=\"note\">No teams have joined yet.</small></p>";
    return;
  }

  const body = rows
    .map((row) => {
      const highlightClass = String(row.team_id) === String(ownTeamId) ? "leaderboard-you" : "";
      return `
        <tr class="${highlightClass}">
          <td>${row.rank}</td>
          <td>${row.team_name ?? ""}</td>
          <td>${formatNumber(row.total_points, 2)}</td>
        </tr>
      `;
    })
    .join("");

  leaderboardTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function populateHouseInputs(session, draft, prior) {
  for (const code of LOCATION_CODES) {
    const input = document.getElementById(`houses-${code}`);
    if (!input) {
      continue;
    }

    const draftValue = draft?.[`houses_${code}`];
    const priorValue = prior?.submitted_houses?.[code];
    input.value = draftValue ?? (priorValue ?? "");
    bindDraftInput(session, `houses-${code}`, `houses_${code}`);
  }

  const locationInput = document.getElementById("best-location");
  if (locationInput) {
    locationInput.value = draft?.submitted_best_location ?? (prior?.submitted_best_location ?? "A");
    bindDraftInput(session, "best-location", "submitted_best_location");
  }

  const utilityInput = document.getElementById("best-utility");
  if (utilityInput) {
    utilityInput.value = draft?.submitted_best_utility ?? (prior?.submitted_best_utility ?? "");
    bindDraftInput(session, "best-utility", "submitted_best_utility");
  }
}

async function submitRoundForm(event) {
  event.preventDefault();
  clearStatus(stageStatus);

  const submittedHouses = Object.fromEntries(
    LOCATION_CODES.map((code) => [code, Number(document.getElementById(`houses-${code}`).value)]),
  );

  const payload = {
    join_token: getJoinToken(),
    submitted_houses: submittedHouses,
    submitted_best_location: String(document.getElementById("best-location").value ?? "").toUpperCase(),
    submitted_best_utility: Number(document.getElementById("best-utility").value),
  };

  try {
    const response = await apiJson("/api/hedonics/team/submit-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.is_correct) {
      setStatus(stageStatus, "good", "Correct. Your round submission is accepted.");
    } else if (response.submission_locked) {
      setStatus(
        stageStatus,
        "warn",
        "Maximum incorrect submissions reached for this round. Correct answers are now shown below.",
      );
    } else {
      setStatus(
        stageStatus,
        "warn",
        `Not correct yet. Re-check market houses and your best response. Attempts remaining: ${response.attempts_remaining}.`,
      );
    }

    if (response.all_teams_resolved && response.revealed_market) {
      setStatus(stageStatus, "good", "All teams are resolved. Round market outcome is now revealed.");
    }

    await refreshState();
  } catch (error) {
    setStatus(stageStatus, "bad", error.message);
  }
}

function renderRoundContext(roundContext) {
  if (!roundContext) {
    roundContextElement.innerHTML = "<p><small class=\"note\">No active round context yet.</small></p>";
    return;
  }

  roundContextElement.innerHTML = roundContextTable(roundContext);
}

function renderStageForm(state) {
  const session = state.session;
  const phase = String(session.current_phase ?? "");
  const submission = state.submission;
  phaseLabelElement.textContent = roundLabel(phase);

  if (phase === "setup") {
    roundContextElement.innerHTML = "<p><small class=\"note\">The instructor has not opened rounds yet. Stay on this page.</small></p>";
    stageFormContainer.innerHTML = "";
    return;
  }

  if (phase === "complete") {
    roundContextElement.innerHTML = "<p><small class=\"note\">This session is marked complete.</small></p>";
    stageFormContainer.innerHTML = "<p><small class=\"note\">No additional submissions are accepted.</small></p>";
    return;
  }

  renderRoundContext(state.round_context);

  const draft = getPhaseDraft(session);
  const summary = submissionAttemptSummary(submission);

  if (summary.submission_locked) {
    clearPhaseDraft(session);
    stageFormContainer.innerHTML = `
      <p><small class="note">You used all ${MAX_INCORRECT_SUBMISSIONS} incorrect attempts in this round. Submissions are now closed.</small></p>
      ${submissionRevealTable(submission)}
    `;
    return;
  }

  if (summary.submission_correct) {
    clearPhaseDraft(session);
    stageFormContainer.innerHTML = `
      <p><small class="note">Your submission is accepted for this round.</small></p>
      ${submissionRevealTable(submission)}
    `;
    return;
  }

  const housesInputs = LOCATION_CODES
    .map((code) => `
      <div>
        <label for="houses-${code}">Houses in ${code}</label>
        <input id="houses-${code}" type="number" min="0" step="1" />
      </div>
    `)
    .join("");

  stageFormContainer.innerHTML = `
    ${attemptNote(submission)}
    <form id="round-form" class="grid">
      ${housesInputs}
      <div>
        <label for="best-location">Best Location For Your Team</label>
        <select id="best-location">
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
          <option value="D">D</option>
          <option value="E">E</option>
          <option value="F">F</option>
        </select>
      </div>
      <div>
        <label for="best-utility">Best Utility For Your Team</label>
        <input id="best-utility" type="number" step="1" />
      </div>
      <div class="row" style="grid-column: 1/-1; margin-top: 0.5rem;">
        <button class="primary" type="submit">Submit Round Answers</button>
      </div>
    </form>
  `;

  populateHouseInputs(session, draft, submission);
  document.getElementById("round-form")?.addEventListener("submit", submitRoundForm);
  bindEnterToSubmit("round-form");
}

function renderReveal(revealState) {
  if (!revealState || !revealState.all_teams_resolved || !revealState.revealed_market) {
    revealCard.classList.add("hidden");
    revealText.textContent = "";
    revealTable.innerHTML = "";
    return;
  }

  revealCard.classList.remove("hidden");
  revealText.textContent = "All teams are resolved. The market outcome for this round is now visible.";
  revealTable.innerHTML = revealMarketTable(revealState.revealed_market);
}

async function refreshState() {
  const joinToken = getJoinToken();
  if (!joinToken) {
    teamLeaderboardRow.classList.add("hidden");
    teamCard.classList.add("hidden");
    leaderboardCard.classList.add("hidden");
    stageCard.classList.add("hidden");
    revealCard.classList.add("hidden");
    return;
  }

  try {
    const state = await apiJson(`/api/hedonics/team/state?join_token=${encodeURIComponent(joinToken)}`);
    clearStatus(joinStatus);
    renderTeamCard(state.session, state.team);
    renderLeaderboard(state.leaderboard ?? [], state.team.id);
    renderStageForm(state);
    renderReveal(state.reveal_state);
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
    const response = await apiJson("/api/hedonics/team/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_name: teamName }),
    });

    setJoinToken(response.join_token);
    setStatus(joinStatus, "good", `Joined as Team ${response.team.team_letter} (${response.team.team_name}).`);
    await refreshState();

    if (!refreshTimer) {
      refreshTimer = window.setInterval(refreshState, 5000);
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
  const joinToken = getJoinToken();
  clearAllDrafts(joinToken);
  clearJoinToken();
  clearStatus(joinStatus);
  teamLeaderboardRow.classList.add("hidden");
  teamCard.classList.add("hidden");
  leaderboardCard.classList.add("hidden");
  stageCard.classList.add("hidden");
  revealCard.classList.add("hidden");
  setStatus(joinStatus, "warn", "Stored team token cleared.");
});

if (getJoinToken()) {
  refreshState();
  refreshTimer = window.setInterval(refreshState, 5000);
}
