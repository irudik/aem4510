import test from "node:test";
import assert from "node:assert/strict";

import {
  PAYOFF_TABLE,
  computeRoundOutcome,
  controllerRole,
  isRoundPhase,
  randomPairing,
  roundContext,
  statusQuoEmissions,
  statusQuoOutcome,
  validateEmissions,
} from "../../../netlify/functions/_lib/coase.mts";

test("payoff table has expected benchmark values", () => {
  assert.equal(PAYOFF_TABLE[0].player_a, 0);
  assert.equal(PAYOFF_TABLE[0].player_b, 12);
  assert.equal(PAYOFF_TABLE[6].player_a, 11);
  assert.equal(PAYOFF_TABLE[6].player_b, 0);
});

test("controller role changes by round as described in game", () => {
  assert.equal(controllerRole("round1"), "A");
  assert.equal(controllerRole("round2"), "B");
  assert.equal(controllerRole("round3"), "B");
});

test("round 1 and round 2 transfers move from noncontroller to controller", () => {
  const r1 = computeRoundOutcome({
    round_key: "round1",
    emissions: 4,
    payment_noncontroller_to_controller: 2,
  });
  assert.equal(r1.payoff_a, 11);
  assert.equal(r1.payoff_b, 0);

  const r2 = computeRoundOutcome({
    round_key: "round2",
    emissions: 4,
    payment_noncontroller_to_controller: 2,
  });
  assert.equal(r2.payoff_a, 7);
  assert.equal(r2.payoff_b, 4);
});

test("round 3 legal agreement cost is applied only when transfer is positive", () => {
  const noTransfer = computeRoundOutcome({
    round_key: "round3",
    emissions: 2,
    payment_noncontroller_to_controller: 0,
    legal_fee_paid_by_a: 4,
  });
  assert.equal(noTransfer.legal_fee_paid_by_a, 0);
  assert.equal(noTransfer.legal_fee_paid_by_b, 0);
  assert.equal(noTransfer.payoff_a, 6);
  assert.equal(noTransfer.payoff_b, 6);

  const withTransfer = computeRoundOutcome({
    round_key: "round3",
    emissions: 2,
    payment_noncontroller_to_controller: 3,
    legal_fee_paid_by_a: 1,
  });
  assert.equal(withTransfer.legal_fee_paid_by_a, 1);
  assert.equal(withTransfer.legal_fee_paid_by_b, 4);
  assert.equal(withTransfer.payoff_a, 2);
  assert.equal(withTransfer.payoff_b, 5);
});

test("status quo is the controller's privately optimal emissions with no payment", () => {
  assert.equal(statusQuoEmissions("round1"), 6);
  assert.equal(statusQuoEmissions("round2"), 0);
  assert.equal(statusQuoEmissions("round3"), 0);

  const round1 = statusQuoOutcome("round1");
  assert.equal(round1.emissions, 6);
  assert.equal(round1.payoff_a, 11);
  assert.equal(round1.payoff_b, 0);

  const round3 = statusQuoOutcome("round3");
  assert.equal(round3.emissions, 0);
  assert.equal(round3.payment_noncontroller_to_controller, 0);
  assert.equal(round3.legal_fee_paid_by_a, 0);
  assert.equal(round3.legal_fee_paid_by_b, 0);
  assert.equal(round3.payoff_a, 0);
  assert.equal(round3.payoff_b, 12);
});

test("random pairing covers each player exactly once with even counts", () => {
  const players = [
    { id: "p1" },
    { id: "p2" },
    { id: "p3" },
    { id: "p4" },
    { id: "p5" },
    { id: "p6" },
  ];

  const pairs = randomPairing(players);
  assert.equal(pairs.length, 3);

  const assignedIds = new Set(
    pairs.flatMap((pair) => [pair.player_a_id, pair.player_b_id]),
  );
  assert.equal(assignedIds.size, players.length);
});

test("round helpers validate emissions and phase context", () => {
  assert.equal(isRoundPhase("round2"), true);
  assert.equal(isRoundPhase("complete"), false);
  assert.equal(validateEmissions(5), 5);
  assert.throws(() => validateEmissions(7), /integer between 0 and 6/);

  const ctx = roundContext("round3");
  assert.equal(ctx.controller_role, "B");
  assert.equal(ctx.status_quo_emissions, 0);
  assert.equal(ctx.payoff_schedule[1].player_b, 10);
});
