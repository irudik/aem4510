import test from "node:test";
import assert from "node:assert/strict";
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

test("new games default to free allocation in both rounds without banking or borrowing", async t => {
  const settings = await createdSettings(t, {});
  assert.equal(settings.allocation_round1, "free");
  assert.equal(settings.allocation_round2, "free");
  assert.equal(settings.banking_enabled, false);
  assert.equal(settings.borrowing_enabled, false);
  assert.equal(settings.shock_round1, false);
  assert.equal(settings.shock_round2, false);
});
test("instructors can still explicitly choose auctions, banking, and borrowing", async t => {
  const settings = await createdSettings(t, { allocation_round1: "uniform", allocation_round2: "pay_as_bid", banking_enabled: true, borrowing_enabled: true });
  assert.equal(settings.allocation_round1, "uniform");
  assert.equal(settings.allocation_round2, "pay_as_bid");
  assert.equal(settings.banking_enabled, true);
  assert.equal(settings.borrowing_enabled, true);
});
