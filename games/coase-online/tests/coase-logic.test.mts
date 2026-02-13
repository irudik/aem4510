import test from "node:test";
import assert from "node:assert/strict";

import {
  currentRoundPairStatusRows,
  maybeResolvePairRound,
  pairDetailsRows,
  pairForPlayer,
  partnerForPlayer,
  progressSummary,
  roleForPlayer,
} from "../../../netlify/functions/_lib/coase_game_service.mts";

test("pair helper functions recover role and partner identity", () => {
  const players = [
    { id: "p1", player_name: "Alice" },
    { id: "p2", player_name: "Bob" },
    { id: "p3", player_name: "Cara" },
    { id: "p4", player_name: "Dan" },
  ];
  const pairs = [
    { id: "pair1", pair_number: 1, player_a_id: "p1", player_b_id: "p2" },
    { id: "pair2", pair_number: 2, player_a_id: "p3", player_b_id: "p4" },
  ];

  const p1Pair = pairForPlayer(pairs, "p1");
  assert.equal(p1Pair.id, "pair1");
  assert.equal(roleForPlayer(p1Pair, "p1"), "A");
  assert.equal(roleForPlayer(p1Pair, "p2"), "B");

  const partner = partnerForPlayer(p1Pair, players, "p1");
  assert.equal(partner.player_name, "Bob");
});

test("pair detail rows show A/B names by pair", () => {
  const players = [
    { id: "p1", player_name: "Alice" },
    { id: "p2", player_name: "Bob" },
  ];
  const pairs = [
    { id: "pair1", pair_number: 1, player_a_id: "p1", player_b_id: "p2" },
  ];

  const rows = pairDetailsRows(pairs, players);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].player_a_name, "Alice");
  assert.equal(rows[0].player_b_name, "Bob");
});

test("current round status reports submission completeness and resolution", () => {
  const pairs = [
    { id: "pair1", pair_number: 1, player_a_id: "p1", player_b_id: "p2" },
    { id: "pair2", pair_number: 2, player_a_id: "p3", player_b_id: "p4" },
  ];
  const submissions = [
    {
      pair_id: "pair1",
      round_key: "round1",
      player_id: "p1",
      submitted_emissions: 3,
      submitted_payment_noncontroller_to_controller: 1,
      submitted_legal_fee_paid_by_a: 0,
    },
    {
      pair_id: "pair1",
      round_key: "round1",
      player_id: "p2",
      submitted_emissions: 3,
      submitted_payment_noncontroller_to_controller: 1,
      submitted_legal_fee_paid_by_a: 0,
    },
    {
      pair_id: "pair2",
      round_key: "round1",
      player_id: "p3",
      submitted_emissions: 6,
      submitted_payment_noncontroller_to_controller: 0,
      submitted_legal_fee_paid_by_a: 0,
    },
  ];
  const outcomes = [
    {
      pair_id: "pair1",
      round_key: "round1",
      agreed_emissions: 3,
      payment_noncontroller_to_controller: 1,
      player_a_payoff: 7,
      player_b_payoff: 3,
    },
  ];

  const rows = currentRoundPairStatusRows("round1", pairs, submissions, outcomes);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].resolved, true);
  assert.equal(rows[0].submissions_match, true);
  assert.equal(rows[1].resolved, false);
  assert.equal(rows[1].player_b_submitted, false);
});

test("progress summary tracks resolved pairs by round", () => {
  const session = {
    expected_player_count: 6,
    current_phase: "round2",
  };
  const pairs = [
    { id: "pair1" },
    { id: "pair2" },
    { id: "pair3" },
  ];
  const outcomes = [
    { round_key: "round1" },
    { round_key: "round1" },
    { round_key: "round1" },
    { round_key: "round2" },
    { round_key: "round2" },
  ];

  const progress = progressSummary(session, pairs, outcomes);
  assert.equal(progress.expected_player_count, 6);
  assert.equal(progress.pair_count, 3);
  assert.equal(progress.current_round_resolved_pairs, 2);
  assert.equal(progress.all_pairs_resolved_current_round, false);
  assert.equal(progress.resolved_by_round.round1, 3);
  assert.equal(progress.resolved_by_round.round2, 2);
  assert.equal(progress.resolved_by_round.round3, 0);
});

test("admin proxy pair resolves using the single student submission", () => {
  const pair = {
    id: "pair1",
    pair_number: 1,
    player_a_id: "student-1",
    player_b_id: "admin-proxy",
  };
  const submissions = [
    {
      pair_id: "pair1",
      round_key: "round1",
      player_id: "student-1",
      submitted_emissions: 2,
      submitted_payment_noncontroller_to_controller: 3,
      submitted_legal_fee_paid_by_a: 0,
    },
  ];
  const adminProxyIds = new Set(["admin-proxy"]);

  const resolution = maybeResolvePairRound("round1", pair, submissions, adminProxyIds);
  assert.equal(resolution.resolved, true);
  assert.equal(resolution.outcome.emissions, 2);
  assert.equal(resolution.outcome.payment_noncontroller_to_controller, 3);
});

test("admin proxy pair status marks submissions as matching after student submits", () => {
  const pairs = [
    { id: "pair1", pair_number: 1, player_a_id: "student-1", player_b_id: "admin-proxy" },
  ];
  const submissions = [
    {
      pair_id: "pair1",
      round_key: "round2",
      player_id: "student-1",
      submitted_emissions: 5,
      submitted_payment_noncontroller_to_controller: 1,
      submitted_legal_fee_paid_by_a: 0,
    },
  ];
  const outcomes = [];
  const adminProxyIds = new Set(["admin-proxy"]);

  const rows = currentRoundPairStatusRows("round2", pairs, submissions, outcomes, adminProxyIds);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].player_a_submitted, true);
  assert.equal(rows[0].player_b_submitted, false);
  assert.equal(rows[0].submissions_match, true);
});
