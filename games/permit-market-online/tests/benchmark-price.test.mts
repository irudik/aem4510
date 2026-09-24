import test from "node:test";
import assert from "node:assert/strict";
import { currentCostEffectivePrice } from "../../../netlify/functions/_lib/permit_benchmark.mts";
import { benchmarkPriceHtml } from "../../../static/games/permit-market-online/benchmark-price.mjs";
const teams = [{ id: "a", baseline_emissions: 2, mac_slope: 2, mac_shock_round1: 1.5, mac_shock_round2: 0.5 }];
const session = { current_phase: "auction1", cap_round1: 1, cap_round2: 1, shock_round1: true, shock_round2: true };

test("admin benchmark switches from pre-shock to realized MAC at market opening", () => {
  assert.equal(currentCostEffectivePrice(session, teams).price, 4);
  const market = currentCostEffectivePrice({ ...session, current_phase: "market1" }, teams);
  assert.equal(market.price, 6);
  assert.equal(market.after_shock, true);
  assert.equal(currentCostEffectivePrice({ ...session, current_phase: "complete" }, teams).price, 2);
});
test("free allocation retains the cost-effective price; banking is qualified", () => {
  const result = currentCostEffectivePrice({ ...session, allocation_round1: "free", borrowing_enabled: true }, teams);
  assert.equal(result.price, 4);
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
  assert.match(html, /\$4.00/);
  assert.match(html, /not the last trade price/);
  assert.match(html, /lowest accepted MAC bid/);
});
