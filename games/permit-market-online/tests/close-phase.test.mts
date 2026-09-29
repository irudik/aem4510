import test from "node:test";
import assert from "node:assert/strict";
import closePhase from "../../../netlify/functions/permit-admin-close-phase.mts";
import setPhase from "../../../netlify/functions/permit-admin-set-phase.mts";
import adminState from "../../../netlify/functions/permit-admin-state.mts";
import teamState from "../../../netlify/functions/permit-team-state.mts";
import submitBids from "../../../netlify/functions/permit-team-submit-bids.mts";
import submitOrder from "../../../netlify/functions/permit-team-order.mts";
import { marketStartForTeam } from "../../../netlify/functions/_lib/permit_round_start.mts";
import { phaseIsClosed } from "../../../netlify/functions/_lib/permit_closed.mts";
import { startGameAndAssignFirms } from "../../../netlify/functions/_lib/permit_game_service.mts";
import { truthfulUnitBids, effectiveIntercept } from "../../../netlify/functions/_lib/permit_market.mts";

test("third market restores Round 2 starts, charges fees, closes once, and replays independently", async t => {
  const { db, writes } = database(t, "market2");
  Object.assign(db.permit_sessions[0], { allocation_round2: "pay_as_bid", shock_round2: true });
  db.permit_teams.forEach((team, index) => Object.assign(team, {
    baseline_emissions: 4, mac_intercept: 4, mac_shock_round2: 1, mac_shift_round2: index ? 2 : -2,
  }));
  db.permit_auction_allocations = db.permit_teams.map((team, index) => ({
    session_id: "s", round_key: "auction2", team_id: team.id, permits_won: 1, payment: 12 + 2 * index,
  }));
  db.permit_trades.push({ session_id: "s", round_key: "market2", seller_team_id: "a",
    buyer_team_id: "b", price: 7, quantity: 1, transaction_cost_per_permit: 0 });
  assert.equal((await closePhase(request("market2"))).status, 200);
  const saved = structuredClone(db.permit_round_scores);
  assert.deepEqual(saved.map(row => row.permits_end), [0, 2]);
  // Saved realized costs define the comparison even if team records later change.
  db.permit_teams.forEach(team => { team.mac_shift_round2 = 80; });
  assert.equal((await setPhase(request("market3"))).status, 200);
  assert.deepEqual(db.permit_round_scores, saved);
  assert.equal(db.permit_trades.length, 1);
  const student = async id => {
    const response = await teamState(new Request("https://game.invalid?join_token=" + id));
    assert.equal(response.status, 200);
    return response.json();
  };
  let state = await student("a");
  assert.equal(state.market.holdings, 1);
  assert.equal(state.market.score_preview.auction_payment, 12);
  assert.equal(state.team.display_mac_intercept, 2);
  assert.equal(state.market.transaction_cost_per_permit, 3);
  assert.equal(state.market.score_preview.transaction_cost, 0);
  const order = (id, side, price) => submitOrder(new Request("https://game.invalid/api", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ join_token: id, side, price, quantity: 1 }),
  }));
  assert.equal((await order("a", "ask", 5)).status, 200);
  const bought = await order("b", "bid", 8);
  assert.equal(bought.status, 200);
  assert.equal((await bought.json()).filled_quantity, 1);
  assert.equal(db.permit_trades.filter(row => row.round_key === "market3").length, 1);
  const trade = db.permit_trades.find(row => row.round_key === "market3");
  assert.equal(trade.price, 5);
  assert.equal(trade.transaction_cost_per_permit, 3);
  state = await student("b");
  assert.equal(state.market.holdings, 2);
  assert.equal(state.market.score_preview.transaction_cost, 3);
  assert.equal(state.market.score_preview.market_net_spend, 5);
  assert.equal(state.market.score_preview.mac_intercept, 6);
  const preview = state.market.score_preview.score;
  assert.equal((await closePhase(request("market3"))).status, 200);
  const round3 = db.permit_round_scores.filter(row => row.round_key === "round3");
  assert.equal(round3.length, 2);
  assert.equal(round3.find(row => row.team_id === "b").score, preview);
  assert.equal(round3.find(row => row.team_id === "a").transaction_cost, 0);
  writes.length = 0;
  assert.equal((await closePhase(request("market3"))).status, 200);
  assert.ok(!writes.some(row => row.table === "permit_round_scores" && row.method === "POST"));
  assert.equal((await setPhase(request("complete"))).status, 200);
  state = await student("b");
  assert.equal(state.team.display_round_key, "round3");
  assert.equal(state.team.display_mac_intercept, 6);
  assert.equal(state.own_scores.find(row => row.round_key === "round3").transaction_cost, 3);
  assert.ok(state.leaderboard.every(row => row.round3 !== null));

  assert.equal((await setPhase(request("market3"))).status, 200);
  assert.deepEqual(db.permit_round_scores, saved);
  assert.equal(db.permit_trades.length, 1);
  assert.equal(db.permit_trades[0].round_key, "market2");
  assert.equal(db.permit_orders.length, 0);
  assert.equal((await student("a")).market.holdings, 1);
  assert.equal((await student("b")).market.score_preview.transaction_cost, 0);
});

test("third-market prerequisites fail before writes; rewinding clears the third-round comparison", async t => {
  const { db, writes } = database(t, "auction2");
  const response = await setPhase(request("market3"));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /after Round 2/);
  assert.equal(writes.length, 0);
  db.permit_sessions[0].current_phase = "complete";
  db.permit_round_scores = [{ session_id: "s", team_id: "a", round_key: "round2" },
    { session_id: "s", team_id: "a", round_key: "round3" }];
  assert.notEqual((await setPhase(request("market3"))).status, 200);
  assert.equal(writes.length, 0);
  assert.equal(db.permit_round_scores.length, 2);
  db.permit_round_scores.push({ session_id: "s", team_id: "b", round_key: "round2" });
  db.permit_trades.push({ session_id: "s", round_key: "market3" });
  db.permit_orders.push({ session_id: "s", round_key: "market3" });
  assert.equal((await setPhase(request("market2"))).status, 200);
  assert.equal(db.permit_trades.length, 0);
  assert.equal(db.permit_orders.length, 0);
  assert.equal(db.permit_round_scores.length, 0);
});

test("round-three starting permits include the original carry, independent of final holdings", () => {
  const session = { banking_enabled: false, borrowing_enabled: false };
  const team = { id: "b", mac_slope: 2, mac_intercept: 4, mac_shift_round2: 2 };
  const scores = [{ team_id: "a", round_key: "round2", permits_from_auction: 99 },
    { team_id: "b", round_key: "round2", permits_from_auction: 5, auction_payment: 17,
      permits_banked_in: 2, permits_owed_in: 1, permits_end: 9, mac_shock: 1, mac_intercept: 6 }];
  assert.deepEqual(marketStartForTeam(session, team, "round3", [], scores), {
    allocation: 5, auctionPayment: 17, banked: 2, owed: 1, net: 1, shock: 1, intercept: 6,
  });
  assert.throws(() => marketStartForTeam(session, team, "round3", [], []), /completed Round 2/);
});

test("new games reveal balanced shifts only at market opening and report each round's trading gains", async t => {
  const { db } = database(t, "setup");
  const session = db.permit_sessions[0];
  Object.assign(session, { cap_share_round1: 60, cap_share_round2: 40,
    allocation_round1: "uniform", allocation_round2: "pay_as_bid", shock_round1: true, shock_round2: true });
  await startGameAndAssignFirms(session);
  for (const team of db.permit_teams) {
    assert.equal(team.mac_intercept, 4);
    assert.equal(team.mac_shock_round1, 1);
    assert.equal(team.mac_shock_round2, 1);
  }
  for (const number of [1, 2]) {
    const round = "round" + number;
    assert.equal((await setPhase(request("auction" + number))).status, 200);
    const before = await (await teamState(new Request("https://game.invalid?join_token=a"))).json();
    assert.equal(before.team.display_mac_intercept, 4);
    assert.equal(before.team.mac_shifts[round], null);
    assert.equal(before.cost_effectiveness.length, number - 1);
    db.permit_auction_bids = [
      ...db.permit_auction_bids.filter(row => row.round_key !== "auction" + number),
      ...truthfulUnitBids(db.permit_teams).map((row, i) => ({ ...row, bid_index: i + 1,
        session_id: "s", round_key: "auction" + number })),
    ];
    assert.equal((await closePhase(request("auction" + number))).status, 200);
    assert.equal((await setPhase(request("market" + number))).status, 200);
    const during = await (await teamState(new Request("https://game.invalid?join_token=a"))).json();
    assert.equal(during.team.mac_shifts[round], db.permit_teams[0]["mac_shift_" + round]);
    assert.equal(during.team.display_mac_intercept, effectiveIntercept(db.permit_teams[0], round));
    const buyer = db.permit_teams.find(team => team["mac_shift_" + round] > 0);
    const seller = db.permit_teams.find(team => team["mac_shift_" + round] < 0);
    db.permit_trades.push({ session_id: "s", round_key: "market" + number,
      seller_team_id: seller.id, buyer_team_id: buyer.id, quantity: 1, price: number === 1 ? 12 : 20 });
    assert.equal((await closePhase(request("market" + number))).status, 200);
    const after = await (await teamState(new Request("https://game.invalid?join_token=a"))).json();
    const report = after.cost_effectiveness.find(row => row.round_key === round);
    assert.equal(report.cost_gap.gap_closed_percent, 100);
    assert.equal(report.achieved, true);
    const histogram = after.mac_distributions.find(row => row.phase === "market" + number);
    assert.ok(histogram.macs.every(row => row.mac === histogram.benchmark_price));
    assert.equal(after.leaderboard.length, 2);
    assert.ok(after.leaderboard.every(row => row.rounds_scored === number));
    assert.equal(after.own_scores.find(row => row.round_key === round).mac_intercept,
      effectiveIntercept(db.permit_teams[0], round));
  }
});

test("default caps and common-MAC prices persist through both phase cycles", async (t) => {
  const { db } = database(t, "setup");
  Object.assign(db.permit_sessions[0], { cap_share_round1: 60, cap_share_round2: 40,
    allocation_round1: "free", allocation_round2: "free" });
  Object.assign(db.permit_teams[0], { baseline_emissions: 10, mac_slope: 2 });
  Object.assign(db.permit_teams[1], { baseline_emissions: 8, mac_slope: 4 });
  for (const [number, cap, price, permits] of [[1, 12, 8, [6, 6]], [2, 6, 16, [2, 4]]]) {
    assert.equal((await setPhase(request("auction" + number))).status, 200);
    assert.equal(db.permit_sessions[0]["cap_round" + number], cap);
    assert.equal((await closePhase(request("auction" + number))).status, 200);
    assert.equal((await setPhase(request("market" + number))).status, 200);
    db.permit_trades.push({ session_id: "s", round_key: "market" + number,
      seller_team_id: "a", buyer_team_id: "b", price, quantity: 1 });
    assert.equal((await closePhase(request("market" + number))).status, 200);
    const rows = db.permit_round_scores.filter(row => row.round_key === "round" + number);
    assert.equal(rows.length, 2);
    for (const [index, team] of db.permit_teams.entries()) {
      const row = rows.find(row => row.team_id === team.id);
      assert.equal(row.permits_end, permits[index]);
      assert.equal(row.benchmark_permits, permits[index]);
      assert.equal(row.benchmark_price, price);
      assert.equal(row.score, row.benchmark_score);
      assert.equal(team.mac_slope * row.abatement, price);
    }
    const dashboard = await (await adminState(new Request("https://game.invalid", {
      headers: { Authorization: "Bearer test" },
    }))).json();
    const student = await (await teamState(new Request("https://game.invalid?join_token=a"))).json();
    assert.equal(dashboard.cost_effective_benchmark.price, price);
    assert.deepEqual(student.mac_distributions, dashboard.mac_distributions);
    const histogram = student.mac_distributions.find(row => row.phase === "market" + number);
    assert.equal(histogram.benchmark_price, price);
    assert.equal(histogram.benchmark_visible, true);
    assert.ok(histogram.macs.every(row => row.mac === price));
  }
});

// Tests use an in-memory REST service; no class database or login is used.
function database(t, phase = "auction1") {
  const db = {
    admin_users: [{ user_id: "admin" }],
    permit_sessions: [{ id: "s", is_active: true, current_phase: phase, cap_round1: 2,
      cap_round2: 2, cap_share_round2: 50, round_seconds: 300,
      phase_deadline_at: new Date(Date.now() + 300000).toISOString() }],
    permit_teams: ["a", "b"].map((id) => ({ id, join_token: id, session_id: "s", baseline_emissions: 2, mac_slope: 2 })),
    permit_auction_bids: ["a", "b"].map((team_id) => ({ team_id, session_id: "s", round_key: "auction1", bid_price: 4, bid_quantity: 1 })),
    permit_auction_results: [], permit_auction_allocations: [], permit_round_scores: [],
    permit_orders: [], permit_trades: [], permit_emission_choices: [],
  };
  const writes = [];
  let failAllocation = false;
  const previousNetlify = globalThis.Netlify;
  globalThis.Netlify = { env: { get: (key) => key === "SUPABASE_URL" ? "https://test.invalid" : "test" } };
  t.after(() => {
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
  });
  t.mock.method(globalThis, "fetch", async (input, options = {}) => {
    const url = new URL(input);
    assert.equal(url.hostname, "test.invalid");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "admin" });
    const table = url.pathname.split("/").at(-1);
    assert.ok(table in db, table);
    const matches = (row) => [...url.searchParams].every(([key, value]) => !value.startsWith("eq.") || String(row[key]) === value.slice(3));
    const method = options.method ?? "GET";
    if (method === "GET") return Response.json(db[table].filter(matches));
    writes.push({ table, method });
    if (failAllocation && table === "permit_auction_allocations" && method === "POST") {
      failAllocation = false;
      return new Response("allocation write failed", { status: 500 });
    }
    const body = options.body ? JSON.parse(options.body) : null;
    if (method === "PATCH") {
      const rows = db[table].filter(matches);
      rows.forEach((row) => Object.assign(row, body));
      return Response.json(rows);
    }
    if (method === "DELETE") db[table] = db[table].filter((row) => !matches(row));
    if (method === "POST") {
      const keys = url.searchParams.get("on_conflict")?.split(",");
      for (const row of body) {
        if (table === "permit_orders") {
          row.id ??= "order-" + db[table].length;
          row.created_at ??= new Date().toISOString();
        }
        const existing = keys && db[table].find((stored) => keys.every((key) => stored[key] === row[key]));
        if (existing) Object.assign(existing, row);
        else db[table].push(row);
      }
      if (options.headers?.Prefer?.includes("return=representation")) return Response.json(body);
    }
    return new Response(null, { status: 204 });
  });
  return { db, writes, failNextAllocation: () => { failAllocation = true; } };
}

function request(phase, authorized = true) {
  return new Request("https://game.invalid/api", { method: "POST",
    headers: { "Content-Type": "application/json", ...(authorized ? { Authorization: "Bearer test" } : {}) },
    body: JSON.stringify({ phase }) });
}

test("finalization requires this auction result or every team's round score", () => {
  const teams = [{ id: "a" }, { id: "b" }];
  assert.equal(phaseIsClosed("auction1", teams, [], []), false);
  assert.equal(phaseIsClosed("auction1", teams, [{ round_key: "auction2" }], []), false);
  assert.equal(phaseIsClosed("auction1", teams, [{ round_key: "auction1" }], []), true);
  const scores = [{ team_id: "a", round_key: "round1" }];
  assert.equal(phaseIsClosed("market1", teams, [], scores), false);
  scores.push({ team_id: "b", round_key: "round1" });
  assert.equal(phaseIsClosed("market1", teams, [], scores), true);
  assert.equal(phaseIsClosed("market2", teams, [], scores), false);
  assert.equal(phaseIsClosed("market3", teams, [], scores), false);
  assert.equal(phaseIsClosed("market3", teams, [], teams.map(team => ({ team_id: team.id, round_key: "round3" }))), true);
  assert.equal(phaseIsClosed("market1", [], [], []), false);
  assert.equal(phaseIsClosed("setup", teams, [], scores), false);
});

test("close auction stops timer, allocates permits, and waits; advancing preserves results", async (t) => {
  const { db, writes } = database(t);
  assert.equal((await closePhase(request("auction1"))).status, 200);
  assert.equal(db.permit_sessions[0].current_phase, "auction1");
  assert.ok(Date.parse(db.permit_sessions[0].phase_deadline_at) < Date.now());
  assert.equal(db.permit_auction_results.length, 1);
  assert.equal(db.permit_auction_allocations.reduce((sum, row) => sum + row.permits_won, 0), 2);
  assert.deepEqual(writes[0], { table: "permit_sessions", method: "PATCH" });
  assert.equal(writes.at(-1).table, "permit_auction_results");
  const results = structuredClone(db.permit_auction_results);
  const allocations = structuredClone(db.permit_auction_allocations);
  writes.length = 0;
  assert.equal((await closePhase(request("auction1"))).status, 200);
  assert.deepEqual(writes, [{ table: "permit_sessions", method: "PATCH" }]);
  assert.equal((await setPhase(request("market1"))).status, 200);
  assert.equal(db.permit_sessions[0].current_phase, "market1");
  assert.ok(Date.parse(db.permit_sessions[0].phase_deadline_at) > Date.now());
  assert.deepEqual(db.permit_auction_results, results);
  assert.deepEqual(db.permit_auction_allocations, allocations);
});

test("close market scores all firms without opening next auction or rescoring on advance", async (t) => {
  const { db, writes } = database(t, "market1");
  assert.equal((await closePhase(request("market1"))).status, 200);
  assert.equal(db.permit_sessions[0].current_phase, "market1");
  assert.equal(db.permit_round_scores.length, 2);
  const scores = structuredClone(db.permit_round_scores);
  writes.length = 0;
  assert.equal((await closePhase(request("market1"))).status, 200);
  assert.equal((await setPhase(request("auction2"))).status, 200);
  assert.deepEqual(db.permit_round_scores, scores);
  assert.equal(writes.some((row) => row.table === "permit_round_scores" && row.method === "POST"), false);
});

test("failed allocation can be retried while bidding remains closed", async (t) => {
  const { db, failNextAllocation } = database(t);
  failNextAllocation();
  const failed = await closePhase(request("auction1"));
  assert.equal(failed.status, 400);
  assert.match((await failed.json()).error, /allocation write failed/);
  assert.equal(db.permit_auction_results.length, 0);
  assert.ok(Date.parse(db.permit_sessions[0].phase_deadline_at) < Date.now());
  assert.equal((await closePhase(request("auction1"))).status, 200);
  assert.equal(db.permit_auction_allocations.length, 2);
});

test("expired auctions can still be finalized", async (t) => {
  const { db } = database(t);
  db.permit_sessions[0].phase_deadline_at = "2020-01-01T00:00:00Z";
  assert.equal((await closePhase(request("auction1"))).status, 200);
  assert.equal(db.permit_auction_results.length, 1);
});

test("closed auction reports are visible before advancing and new bids are rejected", async (t) => {
  database(t);
  await closePhase(request("auction1"));
  const admin = await adminState(new Request("https://game.invalid", { headers: { Authorization: "Bearer test" } }));
  assert.equal(admin.status, 200);
  const dashboard = await admin.json();
  assert.equal(dashboard.session.phase_closed, true);
  assert.equal(dashboard.auction_charts.auction1.is_live, false);
  const student = await teamState(new Request("https://game.invalid?join_token=a"));
  assert.equal(student.status, 200);
  const state = await student.json();
  assert.equal(state.session.current_phase, "auction1");
  assert.equal(state.session.phase_closed, true);
  assert.ok(state.auction_reports.auction1);
  assert.equal(state.own_allocation.permits_won, 1);
  assert.deepEqual(state.mac_distributions, dashboard.mac_distributions);
  assert.equal(state.mac_distributions[0].phase, "auction1");
  const bid = await submitBids(new Request("https://game.invalid", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ join_token: "a", bids: [] }) }));
  assert.equal(bid.status, 400);
  assert.equal((await bid.json()).error, "The auction has closed. Bids are locked.");
});

test("students receive finalized MAC histograms with the free-allocation comparison", async (t) => {
  const { db } = database(t);
  db.permit_sessions[0].allocation_round1 = "free";
  const studentState = async () => (await teamState(new Request("https://game.invalid?join_token=a"))).json();
  assert.deepEqual((await studentState()).mac_distributions, []);
  await closePhase(request("auction1"));
  assert.equal((await studentState()).mac_distributions.length, 1);
  await setPhase(request("market1"));
  assert.equal((await studentState()).mac_distributions.length, 1);
  await closePhase(request("market1"));
  const state = await studentState();
  const dashboard = await (await adminState(new Request("https://game.invalid", {
    headers: { Authorization: "Bearer test" },
  }))).json();
  assert.deepEqual(state.mac_distributions, dashboard.mac_distributions);
  const report = state.mac_distributions[1];
  assert.equal(report.phase, "market1");
  assert.equal(report.macs.length, 2);
  assert.equal(report.initial_macs.length, 2);
  assert.ok(Number.isFinite(report.benchmark_price));
  await setPhase(request("auction2"));
  assert.deepEqual((await studentState()).mac_distributions, state.mac_distributions);
});

test("stale, non-timed, and unauthorized close requests do not change data", async (t) => {
  const { db, writes } = database(t);
  assert.equal((await closePhase(new Request("https://game.invalid"))).status, 405);
  assert.equal((await closePhase(request("market1"))).status, 409);
  assert.notEqual((await closePhase(request("auction1", false))).status, 200);
  for (const phase of ["setup", "complete"]) {
    db.permit_sessions[0].current_phase = phase;
    assert.equal((await closePhase(request(phase))).status, 400);
  }
  assert.equal(writes.length, 0);
});
