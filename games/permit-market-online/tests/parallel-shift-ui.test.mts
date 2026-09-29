import test from "node:test";
import assert from "node:assert/strict";
test("post-migration zero shifts preserve earlier multiplier-shock descriptions", async () => {
  const { readFile } = await import("node:fs/promises");
  const studentSource = await readFile(new URL("../../../static/games/permit-market-online/student.mjs", import.meta.url), "utf8");
  const marketStart = studentSource.indexOf("function renderMarketScaffold");
  const marketDescription = studentSource.slice(studentSource.indexOf("  const roundKey", marketStart),
    studentSource.indexOf("  const showPlan", marketStart));
  const bannerFor = new Function("state", "macShiftDescription", marketDescription + "\nreturn shockBanner;");
  const adminSource = await readFile(new URL("../../../static/games/permit-market-online/admin.mjs", import.meta.url), "utf8");
  const teamsStart = adminSource.indexOf("renderTable(teamsTableElement");
  const teamColumns = adminSource.slice(adminSource.indexOf("    team:", teamsStart),
    adminSource.indexOf("    joined_at:", teamsStart));
  const columnsFor = new Function("state", "row", "shocksOn", "return ({" + teamColumns + "});");
  const scoreStart = adminSource.indexOf("  const showSlopeMultiplier");
  const scoreCode = adminSource.slice(scoreStart, adminSource.indexOf("    permits_allocated:", scoreStart));
  const scoreRowsFor = new Function("state", "renderTable", "scoresTableElement", "teamNamesById", "shocksOn",
    scoreCode + "})));");
  let scoreRows;
  scoreRowsFor({ scores: [{ mac_shock: 1 }, { mac_shock: 0.5 }, { mac_shock: 1.5 }] },
    (_target, rows) => { scoreRows = rows; }, null, new Map(), true);
  assert.deepEqual(scoreRows.map(row => row.slope_multiplier), ["×1", "×0.5", "×1.5"]);
  for (const multiplier of [0.5, 1, 1.5]) {
    const state = { team: { baseline_emissions: 10, mac_slope: 2, mac_intercept: 0,
      display_mac_slope: 2 * multiplier, display_mac_intercept: 0,
      mac_shifts: { round1: 0 }, shocks: { round1: multiplier } },
      session: { current_phase: "market1", shock_round1: true }, market: { holdings: 6 } };
    assert.ok(macPanel(state).includes("×" + multiplier));
    assert.ok(bannerFor(state, macShiftDescription).includes("×" + multiplier));
    assert.doesNotMatch(bannerFor(state, macShiftDescription), /Your MAC is unchanged/);
    const columns = columnsFor(state, { ...state.team, mac_shift_round1: 0, mac_shock_round1: multiplier }, true);
    assert.equal(columns.round_1_shock, "×" + multiplier);
  }
});
import { macModel, macPanel, macShiftDescription } from "../../../static/games/permit-market-online/mac-view.mjs";
import { aggregateMacPoints, firmMacCurves, groupFirmCurves } from "../../../static/games/permit-market-online/auction-charts.mjs";
import { outcomeAtPrice, shockNoticeHtml } from "../../../static/games/permit-market-online/auction-guide.mjs";

test("parallel shifts preserve slope and update point MAC, total costs and one-permit areas", () => {
  for (const slope of [2, 4]) {
    for (const shift of [-slope, 0, slope]) {
      const intercept = 4 + shift;
      const state = { team: { baseline_emissions: 10, mac_slope: slope, mac_intercept: 4,
        display_mac_intercept: intercept, mac_shifts: { round1: shift } },
        session: { current_phase: "market1", shock_round1: true }, market: { holdings: 6 } };
      const model = macModel(state);
      assert.equal(model.slope, slope);
      assert.equal(model.currentMac, intercept + slope * 4);
      assert.equal(model.cost, intercept * 4 + slope * 8);
      assert.equal(model.nextAbatementCost, intercept + slope * 4.5);
      assert.equal(model.moreEmissionsSavings, intercept + slope * 3.5);
      assert.equal(model.steps.slice(6).reduce((sum, unit) => sum + unit.cost, 0), model.cost);
      const html = macPanel(state);
      assert.match(html, new RegExp(`MAC\\(<em>E</em>\\) = ${intercept + slope * 10} − ${slope}`));
      assert.ok(html.includes(macShiftDescription(shift)));
      assert.doesNotMatch(html, /NaN|Infinity|multiplied/);
      const endpoint = html.match(/class="mac-curve" d="M [\d.]+ [\d.]+ L 588 ([\d.]+)"/);
      assert.ok(endpoint);
      assert.equal(Number(endpoint[1]) < 278, intercept > 0);
    }
  }
});

test("auction charts retain base intercepts and aggregate all positive-endpoint curve segments", () => {
  const teams = [2, 4, 6].map((intercept, index) => ({ id: String(index), baseline_emissions: 10,
    mac_slope: 2, mac_intercept: intercept, display_mac_slope: 4, display_mac_intercept: 12 }));
  const curves = firmMacCurves(teams);
  assert.deepEqual(curves.map(curve => curve.intercept), [2, 4, 6]);
  assert.ok(curves.every(curve => curve.slope === 2));
  assert.equal(groupFirmCurves(curves).length, 3);
  const points = aggregateMacPoints(curves);
  for (let index = 1; index < points.length; index++) {
    const price = (points[index - 1].price + points[index].price) / 2;
    const expected = teams.reduce((sum, team) => sum + Math.min(10, Math.max(0,
      10 - (price - team.mac_intercept) / 2)), 0);
    assert.equal((points[index - 1].quantity + points[index].quantity) / 2, expected);
  }
});

test("auction previews include intercept costs and describe parallel shocks", () => {
  const outcome = outcomeAtPrice({ baseline: 10, slope: 2, intercept: 4 }, Array(6).fill(20), 10);
  assert.equal(outcome.abatementCost, 32);
  assert.equal(outcome.avoidedCost, 108);
  assert.equal(outcome.score, 48);
  assert.match(shockNoticeHtml(), /shifts up or down by \$2 or \$4/);
  assert.doesNotMatch(shockNoticeHtml(), /multiplied|equally likely/);
  assert.match(shockNoticeHtml({ parallel: false }), /multiplied/);
});
