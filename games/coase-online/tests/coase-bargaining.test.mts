import test from "node:test";
import assert from "node:assert/strict";

import {
  deadlinePassed,
  leaderboardRows,
  offersForPairRound,
  outcomeFromOffer,
  pendingOfferForPair,
  roundSummaryRows,
  validateOfferTerms,
} from "../../../netlify/functions/_lib/coase_bargaining.mts";

test("offer terms are validated and normalized", () => {
  const terms = validateOfferTerms("round1", {
    offered_emissions: 2,
    offered_payment_noncontroller_to_controller: 3.5,
    offered_legal_fee_paid_by_a: 4,
  });

  assert.equal(terms.offered_emissions, 2);
  assert.equal(terms.offered_payment_noncontroller_to_controller, 3.5);
  // The legal fee split only matters in round 3; other rounds zero it out.
  assert.equal(terms.offered_legal_fee_paid_by_a, 0);

  const round3Terms = validateOfferTerms("round3", {
    offered_emissions: 1,
    offered_payment_noncontroller_to_controller: 4,
    offered_legal_fee_paid_by_a: 2,
  });
  assert.equal(round3Terms.offered_legal_fee_paid_by_a, 2);

  const round3FreeDeal = validateOfferTerms("round3", {
    offered_emissions: 1,
    offered_payment_noncontroller_to_controller: 0,
    offered_legal_fee_paid_by_a: 2,
  });
  assert.equal(round3FreeDeal.offered_legal_fee_paid_by_a, 0);

  assert.throws(() => validateOfferTerms("setup", {
    offered_emissions: 1,
    offered_payment_noncontroller_to_controller: 0,
  }), /round1, round2, or round3/);

  assert.throws(() => validateOfferTerms("round1", {
    offered_emissions: 9,
    offered_payment_noncontroller_to_controller: 0,
  }), /integer between 0 and 6/);

  assert.throws(() => validateOfferTerms("round1", {
    offered_emissions: 1,
    offered_payment_noncontroller_to_controller: -2,
  }), /nonnegative/);
});

test("pending and historical offers are recovered per pair and round", () => {
  const offers = [
    { pair_id: "pair1", round_key: "round1", offer_index: 2, status: "pending" },
    { pair_id: "pair1", round_key: "round1", offer_index: 1, status: "superseded" },
    { pair_id: "pair1", round_key: "round2", offer_index: 1, status: "pending" },
    { pair_id: "pair2", round_key: "round1", offer_index: 1, status: "rejected" },
  ];

  const pending = pendingOfferForPair(offers, "pair1", "round1");
  assert.equal(pending.offer_index, 2);
  assert.equal(pendingOfferForPair(offers, "pair2", "round1"), null);

  const history = offersForPairRound(offers, "pair1", "round1");
  assert.equal(history.length, 2);
  assert.equal(history[0].offer_index, 1);
  assert.equal(history[1].offer_index, 2);
});

test("accepted offers resolve through the payoff engine", () => {
  const outcome = outcomeFromOffer("round2", {
    offered_emissions: 1,
    offered_payment_noncontroller_to_controller: 6,
    offered_legal_fee_paid_by_a: 0,
  });

  // B controls in round 2, so A pays B 6: A gets 4 - 6 = -2, B gets 10 + 6 = 16.
  assert.equal(outcome.payoff_a, -2);
  assert.equal(outcome.payoff_b, 16);
});

test("deadline detection compares against the session cutoff", () => {
  const now = Date.parse("2026-09-01T10:00:00Z");

  assert.equal(deadlinePassed({ phase_deadline_at: null }, now), false);
  assert.equal(deadlinePassed({}, now), false);
  assert.equal(deadlinePassed({ phase_deadline_at: "2026-09-01T10:05:00Z" }, now), false);
  assert.equal(deadlinePassed({ phase_deadline_at: "2026-09-01T09:55:00Z" }, now), true);
});

test("leaderboard sums payoffs across rounds and ranks with ties", () => {
  const players = [
    { id: "p1", player_name: "Alice" },
    { id: "p2", player_name: "Bob" },
    { id: "p3", player_name: "Cara" },
    { id: "proxy", player_name: "Instructor (Admin)", is_admin_proxy: true },
  ];
  const pairs = [
    { id: "pair1", player_a_id: "p1", player_b_id: "p2" },
    { id: "pair2", player_a_id: "p3", player_b_id: "proxy" },
  ];
  const outcomes = [
    { pair_id: "pair1", round_key: "round1", player_a_payoff: 8, player_b_payoff: 3 },
    { pair_id: "pair1", round_key: "round2", player_a_payoff: 2, player_b_payoff: 12 },
    { pair_id: "pair2", round_key: "round1", player_a_payoff: 10, player_b_payoff: 1 },
  ];

  const rows = leaderboardRows(players, pairs, outcomes);
  assert.equal(rows.length, 3);

  assert.equal(rows[0].player_name, "Bob");
  assert.equal(rows[0].total_payoff, 15);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].round1, 3);
  assert.equal(rows[0].round2, 12);

  assert.equal(rows[1].player_name, "Alice");
  assert.equal(rows[1].total_payoff, 10);
  assert.equal(rows[2].player_name, "Cara");
  assert.equal(rows[2].total_payoff, 10);
  assert.equal(rows[1].rank, 2);
  assert.equal(rows[2].rank, 2);
});

test("round summaries separate deals from no-deals and track payments", () => {
  const pairs = [{ id: "pair1" }, { id: "pair2" }];
  const outcomes = [
    {
      pair_id: "pair1",
      round_key: "round1",
      no_deal: false,
      agreed_emissions: 1,
      payment_noncontroller_to_controller: 8,
      player_a_payoff: 12,
      player_b_payoff: 2,
    },
    {
      pair_id: "pair2",
      round_key: "round1",
      no_deal: true,
      agreed_emissions: 6,
      payment_noncontroller_to_controller: 0,
      player_a_payoff: 11,
      player_b_payoff: 0,
    },
  ];

  const summaries = roundSummaryRows(pairs, outcomes);
  assert.equal(summaries.length, 3);

  const round1 = summaries.find((row) => row.round_key === "round1");
  assert.equal(round1.pair_count, 2);
  assert.equal(round1.resolved_pairs, 2);
  assert.equal(round1.deals, 1);
  assert.equal(round1.no_deals, 1);
  assert.equal(round1.pairs_at_efficient_emissions, 1);
  assert.equal(round1.average_payment_among_deals, 8);
  assert.equal(round1.total_surplus, 25);

  const round2 = summaries.find((row) => row.round_key === "round2");
  assert.equal(round2.resolved_pairs, 0);
  assert.equal(round2.average_payment_among_deals, null);
  assert.equal(round2.total_surplus, null);
});
