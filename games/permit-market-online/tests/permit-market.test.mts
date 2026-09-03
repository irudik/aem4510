import test from "node:test";
import assert from "node:assert/strict";

import {
  bookLevels,
  freeHoldings,
  holdingsForTeam,
  leaderboardRows,
  matchIncomingOrder,
  scoreTeamRound,
} from "../../../netlify/functions/_lib/permit_market.mts";

test("incoming bid trades at resting ask prices with price-time priority", () => {
  const book = [
    { id: "o1", team_id: "S1", side: "ask", price: 6, remaining_quantity: 2, created_at: "t2" },
    { id: "o2", team_id: "S2", side: "ask", price: 5, remaining_quantity: 1, created_at: "t3" },
    { id: "o3", team_id: "S3", side: "ask", price: 6, remaining_quantity: 3, created_at: "t1" },
    { id: "o4", team_id: "S4", side: "ask", price: 9, remaining_quantity: 5, created_at: "t0" },
  ];

  const result = matchIncomingOrder(
    { team_id: "B1", side: "bid", price: 6, quantity: 4 },
    book,
  );

  // Fills the 5 first, then the earlier of the two 6s.
  assert.equal(result.trades.length, 2);
  assert.equal(result.trades[0].price, 5);
  assert.equal(result.trades[0].quantity, 1);
  assert.equal(result.trades[0].seller_team_id, "S2");
  assert.equal(result.trades[1].price, 6);
  assert.equal(result.trades[1].quantity, 3);
  assert.equal(result.trades[1].seller_team_id, "S3");
  assert.equal(result.remaining_quantity, 0);

  const updates = new Map(result.resting_updates.map((row) => [row.id, row]));
  assert.equal(updates.get("o2").status, "filled");
  assert.equal(updates.get("o3").status, "filled");
  assert.equal(updates.has("o1"), false);
});

test("incoming ask trades against the best bids and rests any remainder", () => {
  const book = [
    { id: "b1", team_id: "B1", side: "bid", price: 7, remaining_quantity: 2, created_at: "t1" },
    { id: "b2", team_id: "B2", side: "bid", price: 4, remaining_quantity: 4, created_at: "t2" },
  ];

  const result = matchIncomingOrder(
    { team_id: "S1", side: "ask", price: 5, quantity: 5 },
    book,
  );

  // Only the 7 bid crosses a 5 ask; 3 units rest in the book.
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].price, 7);
  assert.equal(result.trades[0].quantity, 2);
  assert.equal(result.trades[0].buyer_team_id, "B1");
  assert.equal(result.remaining_quantity, 3);
});

test("matching skips the trader's own resting orders", () => {
  const book = [
    { id: "o1", team_id: "T1", side: "ask", price: 3, remaining_quantity: 2, created_at: "t1" },
  ];

  const result = matchIncomingOrder(
    { team_id: "T1", side: "bid", price: 5, quantity: 2 },
    book,
  );

  assert.equal(result.trades.length, 0);
  assert.equal(result.remaining_quantity, 2);
});

test("holdings and free holdings account for trades and open asks", () => {
  const trades = [
    { buyer_team_id: "T1", seller_team_id: "T2", price: 5, quantity: 2 },
    { buyer_team_id: "T3", seller_team_id: "T1", price: 6, quantity: 1 },
  ];

  // T1: 4 from auction + 1 banked + 2 bought - 1 sold = 6.
  assert.equal(holdingsForTeam("T1", 4, 1, trades), 6);

  const openOrders = [
    { team_id: "T1", side: "ask", price: 8, remaining_quantity: 2, status: "open" },
    { team_id: "T1", side: "bid", price: 2, remaining_quantity: 3, status: "open" },
    { team_id: "T2", side: "ask", price: 8, remaining_quantity: 5, status: "open" },
  ];

  // Two units already committed to T1's open ask.
  assert.equal(freeHoldings("T1", 4, 1, trades, openOrders), 4);
});

test("round scoring combines abatement, auction, and market cash flows", () => {
  const team = { id: "T1", baseline_emissions: 10, mac_slope: 1 };
  const trades = [
    { buyer_team_id: "T1", seller_team_id: "T2", price: 4, quantity: 2 },
    { buyer_team_id: "T3", seller_team_id: "T1", price: 5, quantity: 1 },
  ];

  const result = scoreTeamRound(team, {
    permits_from_auction: 6,
    auction_payment: 18,
    permits_banked_in: 0,
    trades,
    banking_enabled: false,
    is_final_round: false,
  });

  // Holdings 6 + 2 - 1 = 7: abate 3 at cost 6; V = 55.
  // Net market spend 8 - 5 = 3. Score = 55 - 6 - 18 - 3 = 28.
  assert.equal(result.permits_end, 7);
  assert.equal(result.emissions, 7);
  assert.equal(result.abatement_cost, 6);
  assert.equal(result.market_net_spend, 3);
  assert.equal(result.score, 28);
  assert.equal(result.permits_banked_out, 0);
});

test("banking carries surplus permits forward except in the final round", () => {
  const team = { id: "T1", baseline_emissions: 10, mac_slope: 2 };

  const banked = scoreTeamRound(team, {
    permits_from_auction: 12,
    auction_payment: 0,
    permits_banked_in: 0,
    trades: [],
    banking_enabled: true,
    is_final_round: false,
  });
  assert.equal(banked.emissions, 10);
  assert.equal(banked.abatement, 0);
  assert.equal(banked.permits_banked_out, 2);

  const finalRound = scoreTeamRound(team, {
    permits_from_auction: 12,
    auction_payment: 0,
    permits_banked_in: 0,
    trades: [],
    banking_enabled: true,
    is_final_round: true,
  });
  assert.equal(finalRound.permits_banked_out, 0);
});

test("leaderboard ranks by points relative to the benchmark", () => {
  const teams = [
    { id: "T1", team_name: "Alpha" },
    { id: "T2", team_name: "Beta" },
    { id: "T3", team_name: "Gamma" },
  ];
  const scores = [
    { team_id: "T1", round_key: "round1", score: 30, benchmark_score: 25 },
    { team_id: "T2", round_key: "round1", score: 40, benchmark_score: 42 },
    { team_id: "T3", round_key: "round1", score: 10, benchmark_score: 5 },
    { team_id: "T1", round_key: "round2", score: 12, benchmark_score: 10 },
  ];

  const rows = leaderboardRows(teams, scores);
  assert.equal(rows[0].team_name, "Alpha");
  assert.equal(rows[0].points_vs_benchmark, 7);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[1].team_name, "Gamma");
  assert.equal(rows[2].team_name, "Beta");
  assert.equal(rows[2].points_vs_benchmark, -2);
  assert.equal(rows[0].round2, 12);
  assert.equal(rows[1].round2, null);
});

test("book levels aggregate open orders by price, best first", () => {
  const orders = [
    { side: "bid", price: 5, remaining_quantity: 2 },
    { side: "bid", price: 6, remaining_quantity: 1 },
    { side: "bid", price: 5, remaining_quantity: 3 },
    { side: "ask", price: 8, remaining_quantity: 2 },
    { side: "ask", price: 7, remaining_quantity: 4 },
    { side: "ask", price: 7, remaining_quantity: 0 },
  ];

  const levels = bookLevels(orders);
  assert.deepEqual(levels.bids, [
    { price: 6, quantity: 1 },
    { price: 5, quantity: 5 },
  ]);
  assert.deepEqual(levels.asks, [
    { price: 7, quantity: 4 },
    { price: 8, quantity: 2 },
  ]);
});
