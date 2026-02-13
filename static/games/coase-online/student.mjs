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

const JOIN_TOKEN_KEY = "coase_game_join_token";
const DRAFT_KEY_PREFIX = "coase_game_round_draft_";

const joinStatus = document.getElementById("join-status");
const joinButton = document.getElementById("join-btn");
const resetTokenButton = document.getElementById("reset-token-btn");
const playerNameInput = document.getElementById("player-name");

const playerCard = document.getElementById("player-card");
const playerKv = document.getElementById("player-kv");
const stageCard = document.getElementById("stage-card");
const phaseLabelElement = document.getElementById("phase-label");
const roundContextElement = document.getElementById("round-context");
const stageStatus = document.getElementById("stage-status");
const stageFormContainer = document.getElementById("stage-form-container");
const currentOutcomeCard = document.getElementById("current-outcome-card");
const currentOutcomeTable = document.getElementById("current-outcome-table");
const historyCard = document.getElementById("history-card");
const historyTable = document.getElementById("history-table");

/** @type {number | null} */
let refreshTimer = null;

function roundLabel(phase) {
  return ROUND_LABELS[String(phase ?? "")] ?? String(phase ?? "unknown");
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

function roleDescription(role) {
  if (role === "A") {
    return "A (chemical plant)";
  }
  if (role === "B") {
    return "B (water sports)";
  }
  return "Not assigned";
}

function renderPlayerCard(session, player, pair) {
  playerCard.classList.remove("hidden");
  stageCard.classList.remove("hidden");

  const partnerText = pair
    ? (pair.partner_is_admin_proxy ? `${pair.partner_name} (Admin)` : pair.partner_name)
    : "Waiting for pairing";

  const entries = [
    ["Session", session.session_name],
    ["Player", player.player_name],
    ["Phase", roundLabel(session.current_phase)],
    ["Pair Number", pair?.pair_number ?? "-"],
    ["Your Role", roleDescription(pair?.role)],
    ["Partner", partnerText ?? "-"],
  ];

  playerKv.innerHTML = "";
  for (const [label, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    playerKv.append(dt, dd);
  }
}

function renderRoundContext(roundContext) {
  if (!roundContext) {
    roundContextElement.innerHTML = "<p><small class=\"note\">No active round. Wait for the instructor.</small></p>";
    return;
  }

  const payoffRows = Object.entries(roundContext.payoff_schedule ?? {})
    .map(([emissions, payoff]) => ({
      emissions: Number(emissions),
      player_a_payoff: formatNumber(payoff.player_a, 0),
      player_b_payoff: formatNumber(payoff.player_b, 0),
    }))
    .sort((left, right) => left.emissions - right.emissions);

  roundContextElement.innerHTML = `
    <p><small class="note">Controller in ${roundLabel(roundContext.round_key)}: Player ${roundContext.controller_role}</small></p>
    ${tableHtml(payoffRows)}
    <p><small class="note">${roundContext.legal_cost_note}</small></p>
  `;
}

function submissionStatusBlock(pair, ownSubmission, partnerSubmission) {
  const partnerRequired = pair && !pair.partner_is_admin_proxy;
  const ownSubmitted = Boolean(ownSubmission);
  const partnerSubmitted = Boolean(partnerSubmission);

  const rows = [{
    own_submitted: ownSubmitted ? "Yes" : "No",
    partner_submitted: partnerRequired ? (partnerSubmitted ? "Yes" : "No") : "Not required",
    own_updated_at: ownSubmission?.updated_at ?? "",
    partner_updated_at: partnerSubmission?.updated_at ?? "",
  }];

  const note = pair?.partner_is_admin_proxy
    ? "Your partner is the instructor proxy. Only your submission is required to resolve this round."
    : "Both paired players must submit the same values to resolve this round.";

  return `
    ${tableHtml(rows)}
    <p><small class="note">${note}</small></p>
  `;
}

function submissionOutcomeRows(outcome) {
  if (!outcome) {
    return [];
  }

  return [{
    round: roundLabel(outcome.round_key),
    agreed_emissions: outcome.agreed_emissions,
    payment_noncontroller_to_controller: formatNumber(outcome.payment_noncontroller_to_controller, 2),
    legal_fee_paid_by_a: formatNumber(outcome.legal_fee_paid_by_a, 2),
    legal_fee_paid_by_b: formatNumber(outcome.legal_fee_paid_by_b, 2),
    player_a_payoff: formatNumber(outcome.player_a_payoff, 2),
    player_b_payoff: formatNumber(outcome.player_b_payoff, 2),
  }];
}

function renderCurrentOutcome(outcome) {
  if (!outcome) {
    currentOutcomeCard.classList.add("hidden");
    currentOutcomeTable.innerHTML = "";
    return;
  }

  currentOutcomeCard.classList.remove("hidden");
  currentOutcomeTable.innerHTML = tableHtml(submissionOutcomeRows(outcome));
}

function renderHistory(pairOutcomes) {
  if (!pairOutcomes || pairOutcomes.length === 0) {
    historyCard.classList.add("hidden");
    historyTable.innerHTML = "";
    return;
  }

  const rows = pairOutcomes.map((outcome) => ({
    round: roundLabel(outcome.round_key),
    agreed_emissions: outcome.agreed_emissions,
    payment_noncontroller_to_controller: formatNumber(outcome.payment_noncontroller_to_controller, 2),
    legal_fee_paid_by_a: formatNumber(outcome.legal_fee_paid_by_a, 2),
    legal_fee_paid_by_b: formatNumber(outcome.legal_fee_paid_by_b, 2),
    player_a_payoff: formatNumber(outcome.player_a_payoff, 2),
    player_b_payoff: formatNumber(outcome.player_b_payoff, 2),
  }));

  historyCard.classList.remove("hidden");
  historyTable.innerHTML = tableHtml(rows);
}

function fillSubmissionInputs(session, draft, ownSubmission, phase) {
  const emissionsInput = document.getElementById("submitted-emissions");
  const paymentInput = document.getElementById("submitted-payment");
  const legalFeeInput = document.getElementById("submitted-legal-fee-a");

  if (emissionsInput) {
    emissionsInput.value = draft.submitted_emissions ?? (ownSubmission?.submitted_emissions ?? "");
    bindDraftInput(session, "submitted-emissions", "submitted_emissions");
  }

  if (paymentInput) {
    paymentInput.value = draft.submitted_payment_noncontroller_to_controller
      ?? (ownSubmission?.submitted_payment_noncontroller_to_controller ?? "");
    bindDraftInput(session, "submitted-payment", "submitted_payment_noncontroller_to_controller");
  }

  if (phase === "round3" && legalFeeInput) {
    legalFeeInput.value = draft.submitted_legal_fee_paid_by_a
      ?? (ownSubmission?.submitted_legal_fee_paid_by_a ?? "0");
    bindDraftInput(session, "submitted-legal-fee-a", "submitted_legal_fee_paid_by_a");
  }
}

async function submitRoundForm(event) {
  event.preventDefault();
  clearStatus(stageStatus);

  const phase = event.currentTarget.dataset.phase;

  const payload = {
    join_token: getJoinToken(),
    submitted_emissions: Number(document.getElementById("submitted-emissions").value),
    submitted_payment_noncontroller_to_controller: Number(document.getElementById("submitted-payment").value),
    submitted_legal_fee_paid_by_a: phase === "round3"
      ? Number(document.getElementById("submitted-legal-fee-a").value)
      : 0,
  };

  try {
    const response = await apiJson("/api/coase/player/submit-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.resolved) {
      setStatus(stageStatus, "good", "Round outcome resolved for your pair.");
    } else {
      setStatus(stageStatus, "warn", "Submission saved. Waiting for partner to submit matching terms.");
    }

    await refreshState();
  } catch (error) {
    setStatus(stageStatus, "bad", error.message);
  }
}

function renderStageForm(state) {
  const session = state.session;
  const phase = String(session.current_phase ?? "");
  const pair = state.pair;
  const roundContext = state.round_context;
  const ownSubmission = state.own_submission;
  const partnerSubmission = state.partner_submission;
  const currentOutcome = state.current_outcome;

  phaseLabelElement.textContent = roundLabel(phase);

  if (phase === "setup") {
    roundContextElement.innerHTML = "<p><small class=\"note\">The instructor has not opened rounds yet.</small></p>";
    stageFormContainer.innerHTML = "<p><small class=\"note\">Stay on this page while pairing is prepared.</small></p>";
    return;
  }

  if (!pair) {
    roundContextElement.innerHTML = "<p><small class=\"note\">Waiting for random pairing.</small></p>";
    stageFormContainer.innerHTML = "<p><small class=\"note\">Your pair is not assigned yet.</small></p>";
    return;
  }

  if (phase === "complete") {
    renderRoundContext(roundContext);
    stageFormContainer.innerHTML = "<p><small class=\"note\">Session is complete. No further submissions are accepted.</small></p>";
    return;
  }

  renderRoundContext(roundContext);

  if (currentOutcome) {
    clearPhaseDraft(session);
    stageFormContainer.innerHTML = `
      <p><small class="note">Your pair's agreement is resolved for this round.</small></p>
      ${submissionStatusBlock(pair, ownSubmission, partnerSubmission)}
    `;
    return;
  }

  const draft = getPhaseDraft(session);
  const legalFeeInput = phase === "round3"
    ? `
      <div>
        <label for="submitted-legal-fee-a">Legal Fee Paid by Player A (0 to 5)</label>
        <input id="submitted-legal-fee-a" type="number" min="0" max="5" step="1" inputmode="numeric" />
      </div>
    `
    : "";

  stageFormContainer.innerHTML = `
    ${submissionStatusBlock(pair, ownSubmission, partnerSubmission)}
    <form id="round-form" class="grid" data-phase="${phase}">
      <div>
        <label for="submitted-emissions">Agreed Emissions (integer 0 to 6)</label>
        <input id="submitted-emissions" type="number" min="0" max="6" step="1" inputmode="numeric" />
      </div>
      <div>
        <label for="submitted-payment">Payment (noncontroller to controller)</label>
        <input id="submitted-payment" type="number" min="0" step="0.01" inputmode="decimal" />
      </div>
      ${legalFeeInput}
      <div class="row" style="grid-column: 1/-1; margin-top: 0.5rem;">
        <button class="primary" type="submit">Submit Round Agreement</button>
      </div>
    </form>
  `;

  fillSubmissionInputs(session, draft, ownSubmission, phase);
  document.getElementById("round-form")?.addEventListener("submit", submitRoundForm);
  bindEnterToSubmit("round-form");
}

async function refreshState() {
  const joinToken = getJoinToken();
  if (!joinToken) {
    playerCard.classList.add("hidden");
    stageCard.classList.add("hidden");
    currentOutcomeCard.classList.add("hidden");
    historyCard.classList.add("hidden");
    return;
  }

  try {
    const state = await apiJson(`/api/coase/player/state?join_token=${encodeURIComponent(joinToken)}`);
    clearStatus(joinStatus);
    renderPlayerCard(state.session, state.player, state.pair);
    renderStageForm(state);
    renderCurrentOutcome(state.current_outcome);
    renderHistory(state.pair_outcomes);
  } catch (error) {
    setStatus(joinStatus, "bad", error.message);
  }
}

async function joinPlayer() {
  clearStatus(joinStatus);
  const playerName = playerNameInput.value.trim();
  if (!playerName) {
    setStatus(joinStatus, "warn", "Please enter a player name.");
    return;
  }

  try {
    const response = await apiJson("/api/coase/player/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_name: playerName }),
    });

    setJoinToken(response.join_token);
    setStatus(joinStatus, "good", `Joined as ${response.player.player_name}.`);
    await refreshState();

    if (!refreshTimer) {
      refreshTimer = window.setInterval(refreshState, 5000);
    }
  } catch (error) {
    setStatus(joinStatus, "bad", error.message);
  }
}

joinButton.addEventListener("click", joinPlayer);
playerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    joinPlayer();
  }
});

resetTokenButton.addEventListener("click", () => {
  const joinToken = getJoinToken();
  clearAllDrafts(joinToken);
  clearJoinToken();
  clearStatus(joinStatus);
  playerCard.classList.add("hidden");
  stageCard.classList.add("hidden");
  currentOutcomeCard.classList.add("hidden");
  historyCard.classList.add("hidden");
  setStatus(joinStatus, "warn", "Stored join token cleared.");
});

if (getJoinToken()) {
  refreshState();
  refreshTimer = window.setInterval(refreshState, 5000);
}
