import test from "node:test";
import assert from "node:assert/strict";
import { currentCostEffectivePrice } from "../../../netlify/functions/_lib/permit_benchmark.mts";
import { benchmarkPriceHtml } from "../../../static/games/permit-market-online/benchmark-price.mjs";
const teams = [{ id: "a", baseline_emissions: 2, mac_slope: 2, mac_shock_round1: 1.5, mac_shock_round2: 0.5 }];
const session = { current_phase: "auction1", cap_round1: 1, cap_round2: 1, shock_round1: true, shock_round2: true };

test("admin allocation names match team IDs and permits add to the cap", () => {
  const firms = [
    { id: "phone", team_name: "Phone", baseline_emissions: 8, mac_slope: 3 },
    { id: "comp", team_name: "comp", baseline_emissions: 10, mac_slope: 1 },
  ];
  const result = currentCostEffectivePrice({ current_phase: "market1", cap_round1: 11 }, firms);
  assert.deepEqual(result.allocations, [
    { team_id: "phone", team_name: "Phone", permits: 6 },
    { team_id: "comp", team_name: "comp", permits: 5 },
  ]);
  assert.equal(result.allocations.reduce((sum, row) => sum + row.permits, 0), 11);
  const html = benchmarkPriceHtml(result);
  assert.match(html, /Cost-effective allocation of permits/);
  assert.match(html, /<td>Phone<\/td><td>6<\/td>/);
  assert.match(html, /<td>comp<\/td><td>5<\/td>/);
  assert.match(html, /<th>Total<\/th><td>11<\/td>/);
  result.allocations[0].team_name = "<script>test</script>";
  assert.doesNotMatch(benchmarkPriceHtml(result), /<script>/);
});

test("the allocation responds to revealed cost shocks and includes firms with zero permits", () => {
  const firms = [
    { id: "a", team_name: "A", baseline_emissions: 2, mac_slope: 1, mac_shock_round1: 1.5 },
    { id: "b", team_name: "B", baseline_emissions: 2, mac_slope: 2, mac_shock_round1: 0.5 },
  ];
  const before = currentCostEffectivePrice(session, firms);
  const after = currentCostEffectivePrice({ ...session, current_phase: "market1" }, firms);
  assert.deepEqual(before.allocations.map(row => row.permits), [0, 1]);
  assert.deepEqual(after.allocations.map(row => row.permits), [1, 0]);
});

test("admin benchmark switches from pre-shock to realized MAC at market opening", () => {
  assert.equal(currentCostEffectivePrice(session, teams).price, 3);
  const market = currentCostEffectivePrice({ ...session, current_phase: "market1" }, teams);
  assert.equal(market.price, 4.5);
  assert.equal(market.after_shock, true);
  assert.equal(currentCostEffectivePrice({ ...session, current_phase: "complete" }, teams).price, 1.5);
});
test("free allocation retains the cost-effective price; banking is qualified", () => {
  const result = currentCostEffectivePrice({ ...session, allocation_round1: "free", borrowing_enabled: true }, teams);
  assert.equal(result.price, 3);
  assert.equal(result.across_rounds, true);
  assert.match(benchmarkPriceHtml(result), /not the intertemporal equilibrium price/);
});
test("benchmark is unavailable before assignment and cap, without stale prices", () => {
  assert.equal(currentCostEffectivePrice({ ...session, current_phase: "setup" }, teams), null);
  assert.equal(currentCostEffectivePrice(session, []), null);
  assert.equal(currentCostEffectivePrice({ ...session, cap_round1: null }, teams), null);
  assert.match(benchmarkPriceHtml(null), /once firm types and the round cap are set/);
});
test("admin label distinguishes the theoretical price from orders and trades", () => {
  const html = benchmarkPriceHtml(currentCostEffectivePrice(session, teams));
  assert.match(html, /Cost-effective permit price/);
  assert.match(html, /\$3.00/);
  assert.match(html, /not the last trade price/);
  assert.match(html, /lowest accepted whole-permit value/);
});
