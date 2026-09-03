import test from "node:test";
import assert from "node:assert/strict";

import {
  currentRoundPairStatusRows,
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

test("current round status reports offer activity and resolution", () => {
  const pairs = [
    { id: "pair1", pair_number: 1, player_a_id: "p1", player_b_id: "p2" },
    { id: "pair2", pair_number: 2, player_a_id: "p3", player_b_id: "p4" },
  ];
  const offers = [
    {
      pair_id: "pair1",
      round_key: "round1",
      offer_index: 1,
      proposer_player_id: "p2",
      offered_emissions: 3,
      offered_payment_noncontroller_to_controller: 4,
      status: "superseded",
    },
    {
      pair_id: "pair1",
      round_key: "round1",
      offer_index: 2,
      proposer_player_id: "p1",
      offered_emissions: 2,
      offered_payment_noncontroller_to_controller: 5,
      status: "accepted",
    },
    {
      pair_id: "pair2",
      round_key: "round1",
      offer_index: 1,
      proposer_player_id: "p3",
      offered_emissions: 4,
      offered_payment_noncontroller_to_controller: 1,
      status: "pending",
    },
  ];
  const outcomes = [
    {
      pair_id: "pair1",
      round_key: "round1",
      no_deal: false,
      agreed_emissions: 2,
      payment_noncontroller_to_controller: 5,
      player_a_payoff: 11,
      player_b_payoff: 1,
    },
  ];

  const rows = currentRoundPairStatusRows("round1", pairs, offers, outcomes);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].offers_made, 2);
  assert.equal(rows[0].resolved, true);
  assert.equal(rows[0].no_deal, false);
  assert.equal(rows[0].agreed_emissions, 2);
  assert.equal(rows[1].offers_made, 1);
  assert.equal(rows[1].resolved, false);
  assert.equal(rows[1].pending_offer_emissions, 4);
  assert.equal(rows[1].pending_offer_payment, 1);
});

test("current round status is empty outside round phases", () => {
  const pairs = [
    { id: "pair1", pair_number: 1, player_a_id: "p1", player_b_id: "p2" },
  ];

  assert.deepEqual(currentRoundPairStatusRows("setup", pairs, [], []), []);
  assert.deepEqual(currentRoundPairStatusRows("complete", pairs, [], []), []);
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
