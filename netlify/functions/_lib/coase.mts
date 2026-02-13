/**
 * Economic engine for the AEM 4510 Coase theorem game.
 * Payoffs are indexed by emissions e in {0,1,2,3,4,5,6}.
 */

export const VALID_PHASES = new Set(["setup", "round1", "round2", "round3", "complete"]);
export const ROUND_PHASES = new Set(["round1", "round2", "round3"]);

export const PAYOFF_TABLE = Object.freeze({
  0: { player_a: 0, player_b: 12 },
  1: { player_a: 4, player_b: 10 },
  2: { player_a: 6, player_b: 6 },
  3: { player_a: 6, player_b: 4 },
  4: { player_a: 9, player_b: 2 },
  5: { player_a: 10, player_b: 1 },
  6: { player_a: 11, player_b: 0 },
});

/**
 * @param {string | null | undefined} phase
 */
export function isRoundPhase(phase) {
  return ROUND_PHASES.has(String(phase ?? "").trim());
}

/**
 * @param {number} emissions
 */
export function validateEmissions(emissions) {
  const e = Number(emissions);
  if (!Number.isInteger(e) || e < 0 || e > 6) {
    throw new Error("emissions must be an integer between 0 and 6");
  }
  return e;
}

/**
 * @param {number} value
 * @param {string} fieldName
 */
function nonnegativeNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a nonnegative number`);
  }
  return parsed;
}

/**
 * @param {string} roundKey
 */
export function controllerRole(roundKey) {
  if (roundKey === "round1") {
    return "A";
  }
  if (roundKey === "round2" || roundKey === "round3") {
    return "B";
  }
  throw new Error(`Unknown round key: ${roundKey}`);
}

/**
 * Compute payoffs under agreed emissions and transfer.
 *
 * payment_noncontroller_to_controller is always weakly positive and interpreted
 * relative to the controller in the active round.
 *
 * Round 3 adds legal cost 5 only when transfer > 0, with a split chosen by
 * legal_fee_paid_by_a (the remainder is paid by B).
 *
 * @param {{
 * round_key: string,
 * emissions: number,
 * payment_noncontroller_to_controller: number,
 * legal_fee_paid_by_a?: number,
 * }} input
 */
export function computeRoundOutcome(input) {
  const roundKey = String(input?.round_key ?? "").trim();
  if (!ROUND_PHASES.has(roundKey)) {
    throw new Error("round_key must be one of round1, round2, round3");
  }

  const emissions = validateEmissions(input?.emissions);
  const payment = nonnegativeNumber(
    input?.payment_noncontroller_to_controller,
    "payment_noncontroller_to_controller",
  );

  const base = PAYOFF_TABLE[emissions];
  const controller = controllerRole(roundKey);

  let legalFeeA = 0;
  let legalFeeB = 0;

  if (roundKey === "round3" && payment > 0) {
    const legalFeeInput = nonnegativeNumber(input?.legal_fee_paid_by_a ?? 0, "legal_fee_paid_by_a");
    if (legalFeeInput > 5) {
      throw new Error("legal_fee_paid_by_a must be between 0 and 5");
    }
    legalFeeA = legalFeeInput;
    legalFeeB = 5 - legalFeeInput;
  }

  if (roundKey !== "round3" || payment === 0) {
    legalFeeA = 0;
    legalFeeB = 0;
  }

  const transferToA = controller === "A" ? payment : -payment;
  const transferToB = -transferToA;

  return {
    round_key: roundKey,
    controller_role: controller,
    emissions,
    payment_noncontroller_to_controller: payment,
    legal_fee_paid_by_a: legalFeeA,
    legal_fee_paid_by_b: legalFeeB,
    base_payoff_a: base.player_a,
    base_payoff_b: base.player_b,
    payoff_a: base.player_a + transferToA - legalFeeA,
    payoff_b: base.player_b + transferToB - legalFeeB,
  };
}

/**
 * Two player submissions agree if they report the same negotiated terms.
 * @param {Record<string, unknown>} leftSubmission
 * @param {Record<string, unknown>} rightSubmission
 */
export function submissionsAgree(leftSubmission, rightSubmission) {
  if (!leftSubmission || !rightSubmission) {
    return false;
  }

  const leftEmissions = Number(leftSubmission.submitted_emissions);
  const rightEmissions = Number(rightSubmission.submitted_emissions);
  const leftPayment = Number(leftSubmission.submitted_payment_noncontroller_to_controller);
  const rightPayment = Number(rightSubmission.submitted_payment_noncontroller_to_controller);
  const leftLegalA = Number(leftSubmission.submitted_legal_fee_paid_by_a ?? 0);
  const rightLegalA = Number(rightSubmission.submitted_legal_fee_paid_by_a ?? 0);

  return (
    leftEmissions === rightEmissions
    && Math.abs(leftPayment - rightPayment) <= 1e-9
    && Math.abs(leftLegalA - rightLegalA) <= 1e-9
  );
}

/**
 * Round context visible to students and admins.
 * @param {string | null | undefined} phase
 */
export function roundContext(phase) {
  const normalizedPhase = String(phase ?? "").trim();
  if (!ROUND_PHASES.has(normalizedPhase)) {
    return null;
  }

  return {
    round_key: normalizedPhase,
    controller_role: controllerRole(normalizedPhase),
    payoff_schedule: PAYOFF_TABLE,
    legal_cost_note:
      normalizedPhase === "round3"
        ? "Any positive transfer in Round 3 requires a legal agreement cost of 5, split between A and B."
        : "No legal agreement cost applies in this round.",
  };
}

/**
 * @param {Array<Record<string, unknown>>} players
 */
export function randomPairing(players) {
  if (!Array.isArray(players) || players.length < 2) {
    throw new Error("Need at least 2 players to create pairs");
  }
  if (players.length % 2 !== 0) {
    throw new Error("Player count must be even to create random pairs");
  }

  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[swapIndex];
    shuffled[swapIndex] = tmp;
  }

  const pairs = [];
  for (let index = 0; index < shuffled.length; index += 2) {
    const playerA = shuffled[index];
    const playerB = shuffled[index + 1];
    pairs.push({
      pair_number: index / 2 + 1,
      player_a_id: String(playerA.id),
      player_b_id: String(playerB.id),
    });
  }

  return pairs;
}
