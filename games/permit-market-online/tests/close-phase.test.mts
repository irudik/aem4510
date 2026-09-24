import test from "node:test";
import assert from "node:assert/strict";
import closePhase from "../../../netlify/functions/permit-admin-close-phase.mts";
import setPhase from "../../../netlify/functions/permit-admin-set-phase.mts";
import adminState from "../../../netlify/functions/permit-admin-state.mts";
import teamState from "../../../netlify/functions/permit-team-state.mts";
import submitBids from "../../../netlify/functions/permit-team-submit-bids.mts";
import { phaseIsClosed } from "../../../netlify/functions/_lib/permit_closed.mts";

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
        const existing = keys && db[table].find((stored) => keys.every((key) => stored[key] === row[key]));
        if (existing) Object.assign(existing, row);
        else db[table].push(row);
      }
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
