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

const ROLE_NAMES = {
  A: "Data center operator",
  B: "Resident next door",
};

const JOIN_TOKEN_KEY = "coase_game_join_token";
const DRAFT_KEY_PREFIX = "coase_game_round_draft_";
const POLL_INTERVAL_MS = 3000;

const joinStatus = document.getElementById("join-status");
const joinButton = document.getElementById("join-btn");
const resetTokenButton = document.getElementById("reset-token-btn");
const playerNameInput = document.getElementById("player-name");

const playerCard = document.getElementById("player-card");
const playerKv = document.getElementById("player-kv");
const stageCard = document.getElementById("stage-card");
const phaseLabelElement = document.getElementById("phase-label");
const roundTimerElement = document.getElementById("round-timer");
const roundContextElement = document.getElementById("round-context");
const stageStatus = document.getElementById("stage-status");
const pendingOfferContainer = document.getElementById("pending-offer-container");
const offerComposerContainer = document.getElementById("offer-composer-container");
const offerFeedContainer = document.getElementById("offer-feed-container");
const currentOutcomeCard = document.getElementById("current-outcome-card");
const currentOutcomeTable = document.getElementById("current-outcome-table");
const leaderboardCard = document.getElementById("leaderboard-card");
const leaderboardTable = document.getElementById("leaderboard-table");
const historyCard = document.getElementById("history-card");
const historyTable = document.getElementById("history-table");

/** @type {number | null} */
let refreshTimer = null;
/** @type {number | null} */
let countdownTimer = null;
/** Milliseconds to add to local clock to approximate server time. */
let serverClockOffsetMs = 0;
/** Deadline for the current round in server time, or null. */
let deadlineMs = null;
/** Signature of the last rendered bargaining panel, to keep inputs stable. */
let renderedPanelSignature = null;
/** Latest state payload, reused by the composer's live payoff preview. */
let latestState = null;
/** Two-step confirmation flag for walking away. */
let walkAwayArmed = false;

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

function tableHtml(rows, options = {}) {
  if (!rows || rows.length === 0) {
    return "<p><small class=\"note\">No rows yet.</small></p>";
  }

  const rowClassFor = options.rowClassFor ?? (() => "");
  const columns = Object.keys(rows[0]);
  const header = columns.map((column) => `<th>${formatColumnLabel(column)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${row[column] == null ? "" : String(row[column])}</td>`)
        .join("");
      const rowClass = rowClassFor(row);
      return rowClass ? `<tr class="${rowClass}">${cells}</tr>` : `<tr>${cells}</tr>`;
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
  if (role === "A" || role === "B") {
    return `${role} (${ROLE_NAMES[role].toLowerCase()})`;
  }
  return "Not assigned";
}

function controllerRoleForPhase(state) {
  return state?.round_context?.controller_role ?? null;
}

function paymentDirectionText(state) {
  const controller = controllerRoleForPhase(state);
  if (controller === "A") {
    return "resident pays operator";
  }
  if (controller === "B") {
    return "operator pays resident";
  }
  return "";
}

/**
 * Mirror of the server payoff engine so offers can be previewed live.
 */
function previewPayoffs(state, emissions, payment, legalFeePaidByA) {
  const schedule = state?.round_context?.payoff_schedule ?? {};
  const base = schedule[emissions];
  const roundKey = String(state?.session?.current_phase ?? "");
  const controller = controllerRoleForPhase(state);

  if (!base || !controller || !Number.isFinite(payment) || payment < 0) {
    return null;
  }

  let feeA = 0;
  let feeB = 0;
  if (roundKey === "round3" && payment > 0) {
    const fee = Number(legalFeePaidByA ?? 0);
    if (!Number.isFinite(fee) || fee < 0 || fee > 5) {
      return null;
    }
    feeA = fee;
    feeB = 5 - fee;
  }

  const transferToA = controller === "A" ? payment : -payment;

  return {
    payoff_a: Number(base.player_a) + transferToA - feeA,
    payoff_b: Number(base.player_b) - transferToA - feeB,
    legal_fee_paid_by_a: feeA,
    legal_fee_paid_by_b: feeB,
  };
}

function payoffsForRole(payoffs, role) {
  if (!payoffs || (role !== "A" && role !== "B")) {
    return { own: null, partner: null };
  }
  return role === "A"
    ? { own: payoffs.payoff_a, partner: payoffs.payoff_b }
    : { own: payoffs.payoff_b, partner: payoffs.payoff_a };
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
    // Lock the bargaining panel the moment the clock hits zero.
    if (renderedPanelSignature !== null && !renderedPanelSignature.endsWith("|expired")) {
      renderBargainingPanel(latestState, { force: true });
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

function renderPlayerCard(session, player, pair) {
  playerCard.classList.remove("hidden");
  stageCard.classList.remove("hidden");

  const partnerText = pair
    ? (pair.partner_is_admin_proxy ? `${pair.partner_name} (Instructor)` : pair.partner_name)
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

function renderRoundContext(state) {
  const roundContext = state?.round_context;
  if (!roundContext) {
    roundContextElement.innerHTML = "<p><small class=\"note\">No active round. Wait for the instructor.</small></p>";
    return;
  }

  const role = state?.pair?.role ?? null;
  const statusQuo = Number(roundContext.status_quo_emissions);

  const payoffRows = Object.entries(roundContext.payoff_schedule ?? {})
    .map(([emissions, payoff]) => ({
      generator_hours: Number(emissions),
      operator_a_payoff: formatNumber(payoff.player_a, 0),
      resident_b_payoff: formatNumber(payoff.player_b, 0),
    }))
    .sort((left, right) => left.generator_hours - right.generator_hours);

  const roleReminder = role
    ? `<p><small class="note">You are Player ${role}: the ${ROLE_NAMES[role].toLowerCase()}.</small></p>`
    : "";

  roundContextElement.innerHTML = `
    ${roleReminder}
    <p><small class="note">${roundContext.rights_note} Payments run ${paymentDirectionText(state)}.</small></p>
    ${tableHtml(payoffRows, {
      rowClassFor: (row) => (Number(row.generator_hours) === statusQuo ? "status-quo-row" : ""),
    })}
    <p><small class="note">Highlighted row: the status quo if you never reach a deal. ${roundContext.legal_cost_note}</small></p>
  `;
}

function offerTermsText(state, offer) {
  const hours = Number(offer.offered_emissions);
  const payment = Number(offer.offered_payment_noncontroller_to_controller);
  const parts = [
    `${hours} generator ${hours === 1 ? "hour" : "hours"}`,
    `payment ${formatNumber(payment, 2)} (${paymentDirectionText(state)})`,
  ];

  if (String(state?.session?.current_phase) === "round3" && payment > 0) {
    parts.push(`legal fee split A/B: ${formatNumber(offer.offered_legal_fee_paid_by_a, 1)} / ${formatNumber(5 - Number(offer.offered_legal_fee_paid_by_a), 1)}`);
  }

  return parts.join(", ");
}

async function postAction(url, payload, pendingMessage) {
  clearStatus(stageStatus);
  if (pendingMessage) {
    setStatus(stageStatus, "warn", pendingMessage);
  }

  try {
    const response = await apiJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    clearStatus(stageStatus);
    await refreshState();
    return response;
  } catch (error) {
    setStatus(stageStatus, "bad", error.message);
    await refreshState();
    return null;
  }
}

async function sendOffer(state) {
  const hours = Number(document.getElementById("offer-hours")?.value);
  const payment = Number(document.getElementById("offer-payment")?.value);
  const legalFeeInput = document.getElementById("offer-legal-fee-a");
  const legalFee = legalFeeInput ? Number(legalFeeInput.value || 0) : 0;

  if (!Number.isInteger(hours) || hours < 0 || hours > 6) {
    setStatus(stageStatus, "warn", "Pick generator hours between 0 and 6.");
    return;
  }
  if (!Number.isFinite(payment) || payment < 0) {
    setStatus(stageStatus, "warn", "Payment must be a nonnegative number.");
    return;
  }

  const response = await postAction("/api/coase/player/offer", {
    join_token: getJoinToken(),
    offered_emissions: hours,
    offered_payment_noncontroller_to_controller: payment,
    offered_legal_fee_paid_by_a: legalFee,
  });

  if (response) {
    const message = response.auto_accepted_by_proxy
      ? "The instructor accepted your offer. Round settled."
      : "Offer sent. Your partner sees it now.";
    setStatus(stageStatus, "good", message);
  }
}

async function respondToOffer(action) {
  const response = await postAction("/api/coase/player/respond", {
    join_token: getJoinToken(),
    action,
  });

  if (response) {
    if (action === "accept") {
      setStatus(stageStatus, "good", "Deal! The round is settled.");
    } else if (action === "reject") {
      setStatus(stageStatus, "warn", "Offer rejected. Either side can make a new offer.");
    } else {
      setStatus(stageStatus, "warn", "You walked away. Status quo payoffs apply this round.");
    }
  }
}

function bindComposerPreview(state) {
  const hoursInput = document.getElementById("offer-hours");
  const paymentInput = document.getElementById("offer-payment");
  const legalFeeInput = document.getElementById("offer-legal-fee-a");
  const previewElement = document.getElementById("offer-preview");

  if (!previewElement) {
    return;
  }

  const role = state?.pair?.role ?? null;

  const updatePreview = () => {
    const hours = Number(hoursInput?.value);
    const payment = Number(paymentInput?.value);
    const legalFee = legalFeeInput ? Number(legalFeeInput.value || 0) : 0;

    if (!Number.isInteger(hours) || hours < 0 || hours > 6 || !Number.isFinite(payment)) {
      previewElement.innerHTML = "<small class=\"note\">Set hours and payment to preview payoffs.</small>";
      return;
    }

    const payoffs = previewPayoffs(state, hours, payment, legalFee);
    if (!payoffs) {
      previewElement.innerHTML = "<small class=\"note\">Set hours and payment to preview payoffs.</small>";
      return;
    }

    const { own, partner } = payoffsForRole(payoffs, role);
    previewElement.innerHTML = `
      <span class="badge">If accepted</span>
      <strong>You: ${formatNumber(own, 2)}</strong> &middot; Partner: ${formatNumber(partner, 2)}
    `;
  };

  for (const input of [hoursInput, paymentInput, legalFeeInput]) {
    input?.addEventListener("input", () => {
      updatePreview();
      if (input === hoursInput) {
        setPhaseDraftField(state.session, "offer_hours", hoursInput.value);
      } else if (input === paymentInput) {
        setPhaseDraftField(state.session, "offer_payment", paymentInput.value);
      } else if (legalFeeInput && input === legalFeeInput) {
        setPhaseDraftField(state.session, "offer_legal_fee_a", legalFeeInput.value);
      }
    });
  }

  updatePreview();
}

function renderPendingOffer(state) {
  const pendingOffer = state?.pending_offer;
  const expired = deadlineExpired();

  if (!pendingOffer || state?.current_outcome) {
    pendingOfferContainer.innerHTML = "";
    return;
  }

  if (pendingOffer.proposer_is_self) {
    pendingOfferContainer.innerHTML = `
      <div class="offer-banner own">
        <strong>Your offer is on the table:</strong> ${offerTermsText(state, pendingOffer)}.
        <small class="note">Waiting for your partner. Sending a new offer replaces this one.</small>
      </div>
    `;
    return;
  }

  const payoffs = previewPayoffs(
    state,
    Number(pendingOffer.offered_emissions),
    Number(pendingOffer.offered_payment_noncontroller_to_controller),
    Number(pendingOffer.offered_legal_fee_paid_by_a ?? 0),
  );
  const { own, partner } = payoffsForRole(payoffs, state?.pair?.role ?? null);

  pendingOfferContainer.innerHTML = `
    <div class="offer-banner partner">
      <strong>Offer from your partner:</strong> ${offerTermsText(state, pendingOffer)}.
      <div class="offer-banner-payoffs">If you accept &rarr; You: <strong>${formatNumber(own, 2)}</strong> &middot; Partner: ${formatNumber(partner, 2)}</div>
      <div class="row" style="margin-top: 0.5rem">
        <button id="accept-offer-btn" class="primary" type="button" ${expired ? "disabled" : ""}>Accept Deal</button>
        <button id="reject-offer-btn" class="secondary" type="button" ${expired ? "disabled" : ""}>Reject</button>
      </div>
    </div>
  `;

  document.getElementById("accept-offer-btn")?.addEventListener("click", () => respondToOffer("accept"));
  document.getElementById("reject-offer-btn")?.addEventListener("click", () => respondToOffer("reject"));
}

function renderComposer(state) {
  walkAwayArmed = false;
  const session = state.session;
  const phase = String(session.current_phase ?? "");
  const expired = deadlineExpired();
  const draft = getPhaseDraft(session);
  const partnerOffer = state?.pending_offer && !state.pending_offer.proposer_is_self
    ? state.pending_offer
    : null;

  // Counteroffers start from the partner's terms so haggling moves in steps.
  const defaultHours = draft.offer_hours
    ?? (partnerOffer ? String(partnerOffer.offered_emissions) : "");
  const defaultPayment = draft.offer_payment
    ?? (partnerOffer ? String(partnerOffer.offered_payment_noncontroller_to_controller) : "");
  const defaultLegalFee = draft.offer_legal_fee_a
    ?? (partnerOffer ? String(partnerOffer.offered_legal_fee_paid_by_a ?? 0) : "0");

  const legalFeeBlock = phase === "round3"
    ? `
      <div>
        <label for="offer-legal-fee-a">Legal Fee Paid by A (0 to 5)</label>
        <input id="offer-legal-fee-a" type="number" min="0" max="5" step="0.5" inputmode="decimal" value="${defaultLegalFee}" />
        <small class="note">Only charged if the payment is positive; B pays the rest of the 5.</small>
      </div>
    `
    : "";

  offerComposerContainer.innerHTML = `
    <h3>${partnerOffer ? "Counteroffer" : "Make an Offer"}</h3>
    <form id="offer-form" class="grid">
      <div>
        <label for="offer-hours">Generator Hours (0 to 6)</label>
        <input id="offer-hours" type="number" min="0" max="6" step="1" inputmode="numeric" value="${defaultHours}" />
      </div>
      <div>
        <label for="offer-payment">Payment (${paymentDirectionText(state)})</label>
        <input id="offer-payment" type="number" min="0" step="0.5" inputmode="decimal" value="${defaultPayment}" />
      </div>
      ${legalFeeBlock}
      <div class="offer-preview-box" style="grid-column: 1/-1">
        <div id="offer-preview"></div>
      </div>
      <div class="row" style="grid-column: 1/-1; margin-top: 0.4rem">
        <button id="send-offer-btn" class="primary" type="submit" ${expired ? "disabled" : ""}>
          ${partnerOffer ? "Send Counteroffer" : "Send Offer"}
        </button>
        <button id="walk-away-btn" class="danger" type="button" ${expired ? "disabled" : ""}>Walk Away (No Deal)</button>
      </div>
    </form>
    ${expired ? "<p><small class=\"note\">Time is up. If you have no deal, status quo payoffs lock in when the instructor closes the round.</small></p>" : ""}
  `;

  document.getElementById("offer-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!deadlineExpired()) {
      sendOffer(state);
    }
  });

  const walkAwayButton = document.getElementById("walk-away-btn");
  walkAwayButton?.addEventListener("click", () => {
    if (deadlineExpired()) {
      return;
    }
    if (!walkAwayArmed) {
      walkAwayArmed = true;
      walkAwayButton.textContent = "Confirm: lock in NO DEAL for this round";
      window.setTimeout(() => {
        walkAwayArmed = false;
        if (document.getElementById("walk-away-btn") === walkAwayButton) {
          walkAwayButton.textContent = "Walk Away (No Deal)";
        }
      }, 5000);
      return;
    }
    walkAwayArmed = false;
    respondToOffer("walk_away");
  });

  bindComposerPreview(state);
}

function renderOfferFeed(state) {
  const offers = state?.offers ?? [];
  if (offers.length === 0) {
    offerFeedContainer.innerHTML = "";
    return;
  }

  const items = [...offers]
    .sort((left, right) => Number(right.offer_index) - Number(left.offer_index))
    .map((offer) => {
      const who = offer.proposer_is_self ? "You" : (offer.proposer_name || "Partner");
      const statusLabel = {
        pending: "on the table",
        accepted: "accepted",
        rejected: "rejected",
        superseded: "replaced",
      }[String(offer.status)] ?? String(offer.status);

      return `
        <li class="offer-item ${offer.proposer_is_self ? "own" : "partner"} ${offer.status}">
          <span class="offer-who">${who}:</span>
          ${offerTermsText(state, offer)}
          <span class="badge">${statusLabel}</span>
        </li>
      `;
    })
    .join("");

  offerFeedContainer.innerHTML = `
    <h3>Offer History</h3>
    <ul class="offer-feed">${items}</ul>
  `;
}

function outcomeRows(state, outcome) {
  if (!outcome) {
    return [];
  }

  return [{
    round: roundLabel(outcome.round_key),
    deal: outcome.no_deal ? "No deal (status quo)" : "Deal",
    generator_hours: outcome.agreed_emissions,
    payment: `${formatNumber(outcome.payment_noncontroller_to_controller, 2)}`,
    legal_fees_a_b: `${formatNumber(outcome.legal_fee_paid_by_a, 1)} / ${formatNumber(outcome.legal_fee_paid_by_b, 1)}`,
    operator_a_payoff: formatNumber(outcome.player_a_payoff, 2),
    resident_b_payoff: formatNumber(outcome.player_b_payoff, 2),
  }];
}

function renderCurrentOutcome(state) {
  const outcome = state?.current_outcome;
  if (!outcome) {
    currentOutcomeCard.classList.add("hidden");
    currentOutcomeTable.innerHTML = "";
    return;
  }

  currentOutcomeCard.classList.remove("hidden");
  currentOutcomeTable.innerHTML = tableHtml(outcomeRows(state, outcome));
}

function renderLeaderboard(state) {
  const leaderboard = state?.leaderboard ?? [];
  if (leaderboard.length === 0) {
    leaderboardCard.classList.add("hidden");
    leaderboardTable.innerHTML = "";
    return;
  }

  const ownPlayerId = String(state?.player?.id ?? "");
  const rows = leaderboard.map((row) => ({
    rank: row.rank,
    player: row.player_name,
    round_1: row.round1 == null ? "-" : formatNumber(row.round1, 2),
    round_2: row.round2 == null ? "-" : formatNumber(row.round2, 2),
    round_3: row.round3 == null ? "-" : formatNumber(row.round3, 2),
    total: formatNumber(row.total_payoff, 2),
    player_id: row.player_id,
  }));

  leaderboardCard.classList.remove("hidden");
  leaderboardTable.innerHTML = tableHtml(
    rows.map(({ player_id, ...visible }) => visible),
    {
      rowClassFor: (row) => {
        const source = rows.find((candidate) => candidate.rank === row.rank && candidate.player === row.player);
        return source && String(source.player_id) === ownPlayerId ? "leaderboard-you" : "";
      },
    },
  );
}

function renderHistory(state) {
  const pairOutcomes = state?.pair_outcomes ?? [];
  if (pairOutcomes.length === 0) {
    historyCard.classList.add("hidden");
    historyTable.innerHTML = "";
    return;
  }

  const rows = pairOutcomes.flatMap((outcome) => outcomeRows(state, outcome));
  historyCard.classList.remove("hidden");
  historyTable.innerHTML = tableHtml(rows);
}

/**
 * The bargaining panel holds live inputs, so it re-renders only when the
 * underlying negotiation state changes, not on every poll.
 */
function bargainingPanelSignature(state) {
  const pendingOffer = state?.pending_offer;
  return [
    String(state?.session?.current_phase ?? ""),
    state?.pair ? "paired" : "unpaired",
    pendingOffer ? `${pendingOffer.id}:${pendingOffer.proposer_is_self}` : "none",
    state?.current_outcome ? "settled" : "open",
    (state?.offers ?? []).length,
    deadlineExpired() ? "expired" : "live",
  ].join("|");
}

function renderBargainingPanel(state, options = {}) {
  if (!state) {
    return;
  }

  const signature = bargainingPanelSignature(state);
  if (!options.force && signature === renderedPanelSignature) {
    return;
  }
  renderedPanelSignature = signature;

  const session = state.session;
  const phase = String(session.current_phase ?? "");
  const pair = state.pair;

  if (phase === "setup") {
    pendingOfferContainer.innerHTML = "";
    offerComposerContainer.innerHTML = "<p><small class=\"note\">Stay on this page while the instructor sets up pairing.</small></p>";
    offerFeedContainer.innerHTML = "";
    return;
  }

  if (!pair) {
    pendingOfferContainer.innerHTML = "";
    offerComposerContainer.innerHTML = "<p><small class=\"note\">Waiting for random pairing.</small></p>";
    offerFeedContainer.innerHTML = "";
    return;
  }

  if (phase === "complete") {
    pendingOfferContainer.innerHTML = "";
    offerComposerContainer.innerHTML = "<p><small class=\"note\">The game is over. Check the leaderboard below.</small></p>";
    renderOfferFeed(state);
    return;
  }

  if (state.current_outcome) {
    pendingOfferContainer.innerHTML = "";
    const outcome = state.current_outcome;
    offerComposerContainer.innerHTML = outcome.no_deal
      ? "<p><small class=\"note\">No deal this round: status quo payoffs locked in. Wait for the next round.</small></p>"
      : "<p><small class=\"note\">Deal reached! Wait for the instructor to open the next round.</small></p>";
    renderOfferFeed(state);
    return;
  }

  renderPendingOffer(state);
  renderComposer(state);
  renderOfferFeed(state);
}

async function refreshState() {
  const joinToken = getJoinToken();
  if (!joinToken) {
    playerCard.classList.add("hidden");
    stageCard.classList.add("hidden");
    currentOutcomeCard.classList.add("hidden");
    leaderboardCard.classList.add("hidden");
    historyCard.classList.add("hidden");
    return;
  }

  try {
    const state = await apiJson(`/api/coase/player/state?join_token=${encodeURIComponent(joinToken)}`);
    latestState = state;
    clearStatus(joinStatus);
    syncCountdown(state);
    renderPlayerCard(state.session, state.player, state.pair);
    phaseLabelElement.textContent = roundLabel(state.session.current_phase);
    renderRoundContext(state);
    renderBargainingPanel(state);
    renderCurrentOutcome(state);
    renderLeaderboard(state);
    renderHistory(state);
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
      refreshTimer = window.setInterval(refreshState, POLL_INTERVAL_MS);
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
  leaderboardCard.classList.add("hidden");
  historyCard.classList.add("hidden");
  setStatus(joinStatus, "warn", "Stored join token cleared.");
});

if (getJoinToken()) {
  refreshState();
  refreshTimer = window.setInterval(refreshState, POLL_INTERVAL_MS);
}
