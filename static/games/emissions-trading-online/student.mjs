import {
  apiJson,
  clearStatus,
  formatNumber,
  phaseLabel,
  setStatus,
} from "/games/emissions-trading-online/shared.mjs";

const JOIN_TOKEN_KEY = "emissions_game_join_token";
const DRAFT_KEY_PREFIX = "emissions_game_stage_draft_";

const joinCard = document.getElementById("join-card");
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
const calledPriceBadge = document.getElementById("called-price-badge");
const mdBadge = document.getElementById("md-badge");
const stageStatus = document.getElementById("stage-status");
const stageFormContainer = document.getElementById("stage-form-container");
const revealCard = document.getElementById("reveal-card");
const revealText = document.getElementById("reveal-text");
const MAX_INCORRECT_SUBMISSIONS = 3;

/** @type {number | null} */
let refreshTimer = null;

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
  const phase = String(session?.current_phase ?? "");
  if (phase === "called_price") {
    return `called_price:${session?.called_price ?? ""}`;
  }
  if (phase === "md") {
    return `md:${session?.md_constant ?? ""}`;
  }
  return phase;
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

function bindDraftInputs(session, fieldBindings) {
  for (const [inputId, fieldName] of fieldBindings) {
    const input = document.getElementById(inputId);
    input?.addEventListener("input", () => {
      setPhaseDraftField(session, fieldName, input.value);
    });
  }
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

function macEquation(intercept, slope) {
  return `MAC = ${formatNumber(intercept, 0)} - ${formatNumber(slope, 2)} × E`;
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
    submission_resolved: submissionLocked || submissionCorrect,
  };
}

function attemptNote(submission) {
  const summary = submissionAttemptSummary(submission);
  return `<p><small class="note">Incorrect attempts used: ${summary.attempts_used} of ${MAX_INCORRECT_SUBMISSIONS}. Remaining: ${summary.attempts_remaining}.</small></p>`;
}

function uniformRevealTable(submission) {
  return `
    <table>
      <thead><tr><th>Correct Value</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Final Emissions</td><td>${formatNumber(submission?.expected_emissions, 2)}</td></tr>
        <tr><td>Abatement</td><td>${formatNumber(submission?.expected_abatement, 2)}</td></tr>
        <tr><td>Abatement Cost</td><td>${formatNumber(submission?.expected_abatement_cost, 2)}</td></tr>
      </tbody>
    </table>
  `;
}

function calledPriceRevealTable(submission) {
  return `
    <table>
      <thead><tr><th>Correct Value</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Optimal Abatement</td><td>${formatNumber(submission?.expected_abatement, 2)}</td></tr>
      </tbody>
    </table>
  `;
}

function mdRevealTable(submission) {
  return `
    <table>
      <thead><tr><th>Correct Value</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Efficient Emissions (Your Team)</td><td>${formatNumber(submission?.expected_efficient_emissions, 2)}</td></tr>
        <tr><td>Efficient Industry Cap</td><td>${formatNumber(submission?.expected_industry_cap, 2)}</td></tr>
      </tbody>
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
    ["MAC Intercept", formatNumber(team.mac_intercept, 0)],
    ["MAC Slope", formatNumber(team.mac_slope, 2)],
    ["MAC Equation", macEquation(team.mac_intercept, team.mac_slope)],
    ["Initial Emissions", formatNumber(team.initial_emissions, 2)],
    ["Permit Allocation", formatNumber(team.permit_allocation, 0)],
  ];

  for (const [label, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
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

async function submitUniformForm(event) {
  event.preventDefault();
  clearStatus(stageStatus);

  const payload = {
    join_token: getJoinToken(),
    submitted_emissions: Number(document.getElementById("uniform-emissions").value),
    submitted_abatement: Number(document.getElementById("uniform-abatement").value),
    submitted_abatement_cost: Number(document.getElementById("uniform-cost").value),
  };

  try {
    const response = await apiJson("/api/emissions-trading/team/submit-uniform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.is_correct) {
      setStatus(stageStatus, "good", "Correct. Your uniform-standard submission is accepted.");
    } else if (response.submission_locked) {
      setStatus(
        stageStatus,
        "warn",
        "Maximum incorrect submissions reached for this phase. Correct answers are now shown below.",
      );
    } else {
      setStatus(
        stageStatus,
        "warn",
        `Not correct yet. Revise using your MAC and standard level. Attempts remaining: ${response.attempts_remaining}.`,
      );
    }

    await refreshState();
  } catch (error) {
    setStatus(stageStatus, "bad", error.message);
  }
}

async function submitCalledPriceForm(event) {
  event.preventDefault();
  clearStatus(stageStatus);

  const payload = {
    join_token: getJoinToken(),
    submitted_abatement: Number(document.getElementById("price-abatement").value),
  };

  try {
    const response = await apiJson("/api/emissions-trading/team/submit-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.is_correct) {
      setStatus(stageStatus, "good", "Correct. Your called-price abatement is accepted.");
    } else if (response.submission_locked) {
      setStatus(
        stageStatus,
        "warn",
        "Maximum incorrect submissions reached for this phase. Correct answers are now shown below.",
      );
    } else {
      setStatus(
        stageStatus,
        "warn",
        `Not correct yet. Recompute your optimal abatement at this price. Attempts remaining: ${response.attempts_remaining}.`,
      );
    }

    if (response.all_teams_resolved && response.called_price_excess_demand !== null) {
      setStatus(
        stageStatus,
        "good",
        `All teams are resolved. Market excess demand: ${formatNumber(response.called_price_excess_demand, 2)} permits.`,
      );
    }

    await refreshState();
  } catch (error) {
    setStatus(stageStatus, "bad", error.message);
  }
}

async function submitMdForm(event) {
  event.preventDefault();
  clearStatus(stageStatus);

  const payload = {
    join_token: getJoinToken(),
    submitted_efficient_emissions: Number(document.getElementById("md-efficient-emissions").value),
    submitted_industry_cap: Number(document.getElementById("md-industry-cap").value),
  };

  try {
    const response = await apiJson("/api/emissions-trading/team/submit-md", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.is_correct) {
      setStatus(stageStatus, "good", "Correct. Your MD-stage submission is accepted.");
    } else if (response.submission_locked) {
      setStatus(
        stageStatus,
        "warn",
        "Maximum incorrect submissions reached for this phase. Correct answers are now shown below.",
      );
    } else {
      setStatus(
        stageStatus,
        "warn",
        `Not correct yet. Re-check your efficient emissions and industry cap. Attempts remaining: ${response.attempts_remaining}.`,
      );
    }

    await refreshState();
  } catch (error) {
    setStatus(stageStatus, "bad", error.message);
  }
}

function renderStageForm(session, submissions) {
  const phase = session.current_phase;
  phaseLabelElement.textContent = phaseLabel(phase);

  calledPriceBadge.classList.add("hidden");
  mdBadge.classList.add("hidden");

  if (phase === "called_price") {
    calledPriceBadge.classList.remove("hidden");
    calledPriceBadge.textContent = `Permit Price: $${formatNumber(session.called_price, 0)}`;
  }

  if (phase === "md") {
    mdBadge.classList.remove("hidden");
    mdBadge.textContent = `MD: ${formatNumber(session.md_constant, 0)}`;
  }

  if (phase === "setup") {
    stageFormContainer.innerHTML = `<p><small class="note">The instructor has not opened submissions yet. Stay on this page.</small></p>`;
    return;
  }

  if (phase === "uniform") {
    const prior = submissions.uniform;
    const draft = getPhaseDraft(session);
    const summary = submissionAttemptSummary(prior);
    if (summary.submission_locked) {
      clearPhaseDraft(session);
      stageFormContainer.innerHTML = `
        <p><small class="note">You used all ${MAX_INCORRECT_SUBMISSIONS} incorrect attempts in this phase. Submissions are now closed.</small></p>
        ${uniformRevealTable(prior)}
      `;
      return;
    }

    if (summary.submission_correct) {
      clearPhaseDraft(session);
      stageFormContainer.innerHTML = `
        <p><small class="note">Your uniform-standard submission is accepted for this phase.</small></p>
        ${uniformRevealTable(prior)}
      `;
      return;
    }

    stageFormContainer.innerHTML = `
      ${attemptNote(prior)}
      <form id="uniform-form" class="grid">
        <div>
          <label for="uniform-emissions">Final Emissions</label>
          <input id="uniform-emissions" type="number" min="0" step="1" value="${draft?.submitted_emissions ?? prior?.submitted_emissions ?? ""}" />
        </div>
        <div>
          <label for="uniform-abatement">Abatement</label>
          <input id="uniform-abatement" type="number" min="0" step="1" value="${draft?.submitted_abatement ?? prior?.submitted_abatement ?? ""}" />
        </div>
        <div>
          <label for="uniform-cost">Abatement Cost</label>
          <input id="uniform-cost" type="number" min="0" step="1" value="${draft?.submitted_abatement_cost ?? prior?.submitted_abatement_cost ?? ""}" />
        </div>
        <div class="row" style="grid-column: 1/-1; margin-top: 0.5rem;">
          <button class="primary" type="submit">Submit Uniform Answers</button>
        </div>
      </form>
    `;

    document.getElementById("uniform-form")?.addEventListener("submit", submitUniformForm);
    bindEnterToSubmit("uniform-form");
    bindDraftInputs(session, [
      ["uniform-emissions", "submitted_emissions"],
      ["uniform-abatement", "submitted_abatement"],
      ["uniform-cost", "submitted_abatement_cost"],
    ]);
    return;
  }

  if (phase === "called_price") {
    const prior = submissions.called_price;
    const draft = getPhaseDraft(session);
    const summary = submissionAttemptSummary(prior);
    if (summary.submission_locked) {
      clearPhaseDraft(session);
      stageFormContainer.innerHTML = `
        <p><small class="note">You used all ${MAX_INCORRECT_SUBMISSIONS} incorrect attempts in this phase. Submissions are now closed.</small></p>
        ${calledPriceRevealTable(prior)}
      `;
      return;
    }

    if (summary.submission_correct) {
      clearPhaseDraft(session);
      stageFormContainer.innerHTML = `
        <p><small class="note">Your called-price submission is accepted for this phase.</small></p>
        ${calledPriceRevealTable(prior)}
      `;
      return;
    }

    stageFormContainer.innerHTML = `
      ${attemptNote(prior)}
      <form id="price-form">
        <div>
          <label for="price-abatement">Chosen Abatement</label>
          <input id="price-abatement" type="number" min="0" step="1" value="${draft?.submitted_abatement ?? prior?.submitted_abatement ?? ""}" />
        </div>
        <div class="row" style="margin-top: 0.6rem;">
          <button class="primary" type="submit">Submit Called-Price Abatement</button>
        </div>
      </form>
    `;

    document.getElementById("price-form")?.addEventListener("submit", submitCalledPriceForm);
    bindEnterToSubmit("price-form");
    bindDraftInputs(session, [["price-abatement", "submitted_abatement"]]);
    return;
  }

  if (phase === "md") {
    const prior = submissions.md;
    const draft = getPhaseDraft(session);
    const summary = submissionAttemptSummary(prior);
    if (summary.submission_locked) {
      clearPhaseDraft(session);
      stageFormContainer.innerHTML = `
        <p><small class="note">You used all ${MAX_INCORRECT_SUBMISSIONS} incorrect attempts in this phase. Submissions are now closed.</small></p>
        ${mdRevealTable(prior)}
      `;
      return;
    }

    if (summary.submission_correct) {
      clearPhaseDraft(session);
      stageFormContainer.innerHTML = `
        <p><small class="note">Your MD-stage submission is accepted for this phase.</small></p>
        ${mdRevealTable(prior)}
      `;
      return;
    }

    stageFormContainer.innerHTML = `
      ${attemptNote(prior)}
      <form id="md-form" class="grid">
        <div>
          <label for="md-efficient-emissions">Efficient Emissions (Your Team)</label>
          <input id="md-efficient-emissions" type="number" min="0" step="1" value="${draft?.submitted_efficient_emissions ?? prior?.submitted_efficient_emissions ?? ""}" />
        </div>
        <div>
          <label for="md-industry-cap">Efficient Industry Cap (All Teams)</label>
          <input id="md-industry-cap" type="number" min="0" step="1" value="${draft?.submitted_industry_cap ?? prior?.submitted_industry_cap ?? ""}" />
        </div>
        <div class="row" style="grid-column: 1/-1; margin-top: 0.5rem;">
          <button class="primary" type="submit">Submit MD Answers</button>
        </div>
      </form>
    `;

    document.getElementById("md-form")?.addEventListener("submit", submitMdForm);
    bindEnterToSubmit("md-form");
    bindDraftInputs(session, [
      ["md-efficient-emissions", "submitted_efficient_emissions"],
      ["md-industry-cap", "submitted_industry_cap"],
    ]);
    return;
  }

  stageFormContainer.innerHTML = `<p><small class="note">This session is marked complete.</small></p>`;
}

function renderReveal(session) {
  if (session.called_price_excess_demand === null || session.called_price_excess_demand === undefined) {
    revealCard.classList.add("hidden");
    return;
  }

  revealCard.classList.remove("hidden");
  revealText.textContent = `All teams are resolved. Market excess demand at called price is ${formatNumber(session.called_price_excess_demand, 2)} permits.`;
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
    const state = await apiJson(`/api/emissions-trading/team/state?join_token=${encodeURIComponent(joinToken)}`);
    clearStatus(joinStatus);
    renderTeamCard(state.session, state.team);
    renderLeaderboard(state.leaderboard ?? [], state.team.id);
    renderStageForm(state.session, state.submissions);
    renderReveal(state.session);
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
    const response = await apiJson("/api/emissions-trading/team/join", {
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
