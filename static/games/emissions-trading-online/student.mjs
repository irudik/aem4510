import {
  apiJson,
  clearStatus,
  formatNumber,
  phaseLabel,
  setStatus,
} from "/games/emissions-trading-online/shared.mjs";

const JOIN_TOKEN_KEY = "emissions_game_join_token";

const joinCard = document.getElementById("join-card");
const joinStatus = document.getElementById("join-status");
const joinButton = document.getElementById("join-btn");
const resetTokenButton = document.getElementById("reset-token-btn");
const teamNameInput = document.getElementById("team-name");

const teamCard = document.getElementById("team-card");
const teamKv = document.getElementById("team-kv");
const stageCard = document.getElementById("stage-card");
const phaseLabelElement = document.getElementById("phase-label");
const calledPriceBadge = document.getElementById("called-price-badge");
const mdBadge = document.getElementById("md-badge");
const stageStatus = document.getElementById("stage-status");
const stageFormContainer = document.getElementById("stage-form-container");
const revealCard = document.getElementById("reveal-card");
const revealText = document.getElementById("reveal-text");

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

function macEquation(intercept, slope) {
  return `MAC = ${formatNumber(intercept, 0)} - ${formatNumber(slope, 2)} × E`;
}

function renderTeamCard(session, team) {
  teamCard.classList.remove("hidden");
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
    } else {
      setStatus(stageStatus, "warn", "Not correct yet. Revise using your MAC and standard level.");
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
    } else {
      setStatus(stageStatus, "warn", "Not correct yet. Recompute your optimal abatement at this price.");
    }

    if (response.all_teams_correct && response.called_price_excess_demand !== null) {
      setStatus(
        stageStatus,
        "good",
        `All teams are correct. Market excess demand: ${formatNumber(response.called_price_excess_demand, 2)} permits.`,
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
    } else {
      setStatus(stageStatus, "warn", "Not correct yet. Re-check your efficient emissions and industry cap.");
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
    calledPriceBadge.textContent = `Called Price: ${formatNumber(session.called_price, 0)}`;
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
    stageFormContainer.innerHTML = `
      <form id="uniform-form" class="grid">
        <div>
          <label for="uniform-emissions">Final Emissions</label>
          <input id="uniform-emissions" type="number" min="0" step="1" value="${prior?.submitted_emissions ?? ""}" />
        </div>
        <div>
          <label for="uniform-abatement">Abatement</label>
          <input id="uniform-abatement" type="number" min="0" step="1" value="${prior?.submitted_abatement ?? ""}" />
        </div>
        <div>
          <label for="uniform-cost">Abatement Cost</label>
          <input id="uniform-cost" type="number" min="0" step="1" value="${prior?.submitted_abatement_cost ?? ""}" />
        </div>
        <div class="row" style="grid-column: 1/-1; margin-top: 0.5rem;">
          <button class="primary" type="submit">Submit Uniform Answers</button>
        </div>
      </form>
    `;

    document.getElementById("uniform-form")?.addEventListener("submit", submitUniformForm);
    return;
  }

  if (phase === "called_price") {
    const prior = submissions.called_price;
    stageFormContainer.innerHTML = `
      <form id="price-form">
        <div>
          <label for="price-abatement">Chosen Abatement</label>
          <input id="price-abatement" type="number" min="0" step="1" value="${prior?.submitted_abatement ?? ""}" />
        </div>
        <div class="row" style="margin-top: 0.6rem;">
          <button class="primary" type="submit">Submit Called-Price Abatement</button>
        </div>
      </form>
    `;

    document.getElementById("price-form")?.addEventListener("submit", submitCalledPriceForm);
    return;
  }

  if (phase === "md") {
    const prior = submissions.md;
    stageFormContainer.innerHTML = `
      <form id="md-form" class="grid">
        <div>
          <label for="md-efficient-emissions">Efficient Emissions (Your Team)</label>
          <input id="md-efficient-emissions" type="number" min="0" step="1" value="${prior?.submitted_efficient_emissions ?? ""}" />
        </div>
        <div>
          <label for="md-industry-cap">Efficient Industry Cap (All Teams)</label>
          <input id="md-industry-cap" type="number" min="0" step="1" value="${prior?.submitted_industry_cap ?? ""}" />
        </div>
        <div class="row" style="grid-column: 1/-1; margin-top: 0.5rem;">
          <button class="primary" type="submit">Submit MD Answers</button>
        </div>
      </form>
    `;

    document.getElementById("md-form")?.addEventListener("submit", submitMdForm);
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
  revealText.textContent = `All teams are correct. Market excess demand at called price is ${formatNumber(session.called_price_excess_demand, 2)} permits.`;
}

async function refreshState() {
  const joinToken = getJoinToken();
  if (!joinToken) {
    teamCard.classList.add("hidden");
    stageCard.classList.add("hidden");
    revealCard.classList.add("hidden");
    return;
  }

  try {
    const state = await apiJson(`/api/emissions-trading/team/state?join_token=${encodeURIComponent(joinToken)}`);
    clearStatus(joinStatus);
    renderTeamCard(state.session, state.team);
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
    joinTeam();
  }
});

resetTokenButton.addEventListener("click", () => {
  clearJoinToken();
  clearStatus(joinStatus);
  teamCard.classList.add("hidden");
  stageCard.classList.add("hidden");
  revealCard.classList.add("hidden");
  setStatus(joinStatus, "warn", "Stored team token cleared.");
});

if (getJoinToken()) {
  refreshState();
  refreshTimer = window.setInterval(refreshState, 5000);
}
