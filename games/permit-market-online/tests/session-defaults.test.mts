import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import createSession from "../../../netlify/functions/permit-admin-create-session.mts";

/** Run the create-session endpoint against an isolated substitute REST service. */
async function createdSettings(t, settings) {
  const previousNetlify = globalThis.Netlify;
  globalThis.Netlify = { env: { get: key => key === "SUPABASE_URL" ? "https://test.invalid" : "test" } };
  t.after(() => {
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
  });
  let inserted;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const path = new URL(url);
    assert.equal(path.hostname, "test.invalid");
    if (path.pathname === "/auth/v1/user") return Response.json({ id: "admin" });
    if (path.pathname === "/rest/v1/admin_users") return Response.json([{ user_id: "admin" }]);
    assert.equal(path.pathname, "/rest/v1/permit_sessions");
    if (options.method === "PATCH") return new Response(null, { status: 204 });
    assert.equal(options.method, "POST");
    inserted = JSON.parse(options.body)[0];
    return Response.json([{ id: "new-session", ...inserted }]);
  });
  const response = await createSession(new Request("https://game.invalid/api", {
    method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
    body: JSON.stringify({ session_name: "Class game", expected_team_count: 3, ...settings }),
  }));
  assert.equal(response.status, 200);
  return inserted;
}

test("admin defaults to 60 teams and the server accepts that count", async t => {
  const html = readFileSync(new URL("../../../static/games/permit-market-online/admin.html", import.meta.url), "utf8");
  const input = html.match(/<input[^>]*id="expected-team-count"[^>]*>/)?.[0];
  assert.ok(input);
  assert.match(input, /value="60"/);
  const settings = await createdSettings(t, { expected_team_count: 60 });
  assert.equal(settings.expected_team_count, 60);
});

test("new games default to uniform then pay-as-bid, both shocked, without banking or borrowing", async t => {
  const settings = await createdSettings(t, {});
  assert.equal(settings.allocation_round1, "uniform");
  assert.equal(settings.allocation_round2, "pay_as_bid");
  assert.equal(settings.banking_enabled, false);
  assert.equal(settings.borrowing_enabled, false);
  assert.equal(settings.shock_round1, true);
  assert.equal(settings.shock_round2, true);
  const html = readFileSync(new URL("../../../static/games/permit-market-online/admin.html", import.meta.url), "utf8");
  for (const [id, value] of [["allocation-1", "uniform"], ["allocation-2", "pay_as_bid"],
    ["shock-1", "on"], ["shock-2", "on"], ["banking-enabled", ""], ["borrowing-enabled", ""]]) {
    const select = html.split('<select id="' + id + '">')[1]?.split("</select>")[0];
    assert.ok(select, id);
    assert.ok(select.includes('<option value="' + value + '" selected>'), id);
  }
});
test("instructors can still explicitly choose free allocation, no shocks, banking, and borrowing", async t => {
  const settings = await createdSettings(t, { allocation_round1: "free", allocation_round2: "free",
    shock_round1: false, shock_round2: false, banking_enabled: true, borrowing_enabled: true });
  assert.equal(settings.allocation_round1, "free");
  assert.equal(settings.allocation_round2, "free");
  assert.equal(settings.shock_round1, false);
  assert.equal(settings.shock_round2, false);
  assert.equal(settings.banking_enabled, true);
  assert.equal(settings.borrowing_enabled, true);
});
