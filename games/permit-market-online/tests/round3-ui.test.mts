import test from "node:test";
import assert from "node:assert/strict";
import { marketDepthHtml } from "../../../static/games/permit-market-online/market-depth.mjs";
import { macModel, macPanel } from "../../../static/games/permit-market-online/mac-view.mjs";
import { costGapHtml } from "../../../static/games/permit-market-online/cost-gap.mjs";
import { macDistributionsHtml } from "../../../static/games/permit-market-online/mac-distribution.mjs";

test("transaction-cost depth compares buyer payments on both curves", () => {
  const html = marketDepthHtml({ bids: [{ price: 10, quantity: 2 }], asks: [{ price: 8, quantity: 1 }] }, { transactionCost: 3 });
  assert.match(html, /Best bid \$10/);
  assert.match(html, /Best ask \+ fee \$11/);
  assert.match(html, /Spread \$1/);
  assert.match(html, /Sell orders \(asks \+ fee\)/);
  assert.match(html, /\$3 buyer fee/);
  assert.doesNotMatch(html, /Spread \$-2/);
});

test("completed game uses the last scored round and retains Round 2 shock", () => {
  const state = { session: { current_phase: "complete", shock_round2: true }, team: {
    baseline_emissions: 10, mac_slope: 2, mac_intercept: 4, display_mac_intercept: 6,
    mac_shifts: { round2: 2 },
  }, own_scores: [{ round_key: "round3", permits_end: 7, emissions: 7 }, { round_key: "round2", permits_end: 6, emissions: 6 }] };
  assert.equal(macModel(state).emissions, 7);
  assert.equal(macModel(state).cost, 27);
  assert.match(macPanel(state), /Final Round 3 emissions/);
  assert.match(macPanel(state), /shifts up by \$2/);
  state.own_scores = state.own_scores.slice(1);
  assert.match(macPanel(state), /Final Round 2 emissions/);
});

test("Round 3 cost reductions distinguish abatement from resource costs", () => {
  const html = costGapHtml({ round_key: "round3", fee_adjusted_achieved: true,
    fee_adjusted_benchmark: { minimum_resource_cost: 82 }, cost_gap: { status: "measured", initial_total_cost: 100,
    final_total_cost: 70, cost_effective_total_cost: 60, gap_closed_percent: 75, transaction_cost: 12, total_resource_cost: 82 } });
  assert.match(html, /75.0%/);
  assert.match(html, /Transaction costs: \$12.00/);
  assert.match(html, /resource cost \(abatement \+ transaction costs\): \$82.00/);
  assert.match(html, /before transaction costs/);
  assert.match(html, /did minimize abatement plus transaction costs/);
  assert.match(html, /Minimum total resource cost: \$82.00/);
});

test("Round 3 histogram marks the no-fee benchmark only after closing", () => {
  const report = { phase: "market3", round_key: "round3", phase_closed: true, benchmark_visible: true,
    benchmark_price: 16, initial_macs: [{ team_name: "A", mac: 20 }], macs: [{ team_name: "A", mac: 18 }] };
  assert.match(macDistributionsHtml([report]), /Round 3: after trading/);
  assert.match(macDistributionsHtml([report]), /No-transaction-cost benchmark price: \$16.00/);
  assert.doesNotMatch(macDistributionsHtml([{ ...report, phase_closed: false }]), /class="mac-hist-price"/);
});
