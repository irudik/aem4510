import test from "node:test";
import assert from "node:assert/strict";
import { currentCostEffectivePrice } from "../../../netlify/functions/_lib/permit_benchmark.mts";
import { benchmarkPriceHtml } from "../../../static/games/permit-market-online/benchmark-price.mjs";
import { macPanel } from "../../../static/games/permit-market-online/mac-view.mjs";
import { auctionComparisonHtml } from "../../../static/games/permit-market-online/auction-charts.mjs";
import { macDistributionsHtml } from "../../../static/games/permit-market-online/mac-distribution.mjs";

test("shock wording is absent when disabled and appears in enabled rounds", () => {
  const team = { id: "a", team_name: "A", baseline_emissions: 10, mac_slope: 1, shocks: { round1: 1 } };
  for (const enabled of [false, true]) {
    const session = { current_phase: "market1", cap_round1: 6, shock_round1: enabled };
    const benchmark = benchmarkPriceHtml(currentCostEffectivePrice(session, [team]));
    const firm = macPanel({ team, session, market: { holdings: 6 } });
    const auction = auctionComparisonHtml({ teams: [team], session, auction_charts: {
      auction1: { cap: 6, benchmark_price: 4.5, clearing_price: null, total_bid_quantity: 0, shock: enabled },
    } }, "auction1");
    for (const html of [benchmark, firm, auction]) {
      if (enabled) assert.match(html, /shock/i);
      else assert.doesNotMatch(html, /shock/i);
    }
  }
  assert.doesNotMatch(macDistributionsHtml([{ phase: "auction1", round_key: "round1",
    macs: [{ team_name: "A", mac: 4 }], initial_macs: [], benchmark_price: 4.5 }]), /shock/i);
});
