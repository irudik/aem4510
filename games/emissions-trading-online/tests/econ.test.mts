import test from "node:test";
import assert from "node:assert/strict";

import {
  DRAWABLE_MAC_TYPES,
  validateTeamRows,
  excessDemand,
  solveMarketPrice,
  teamOutcomeAtPrice,
  teamOutcomeAtUniformStandard,
  computeEfficientCap,
  withinTolerance,
  teamLetterFromIndex,
  randomMacCoefficients,
} from "../../../netlify/functions/_lib/econ.mts";

const exampleTeams = [
  { team_id: "A", mac_intercept: 4000, mac_slope: 2, permit_allocation: 1480 },
  { team_id: "B", mac_intercept: 8000, mac_slope: 4, permit_allocation: 1480 },
  { team_id: "C", mac_intercept: 10000, mac_slope: 5, permit_allocation: 1480 },
  { team_id: "D", mac_intercept: 4000, mac_slope: 1, permit_allocation: 1480 },
  { team_id: "E", mac_intercept: 8000, mac_slope: 2, permit_allocation: 1480 },
  { team_id: "F", mac_intercept: 10000, mac_slope: 2.5, permit_allocation: 1480 },
];

test("validateTeamRows computes initial emissions as intercept/slope", () => {
  const validated = validateTeamRows(exampleTeams);
  assert.equal(validated.length, 6);
  assert.equal(validated[0].initial_emissions, 2000);
  assert.equal(validated[3].initial_emissions, 4000);
});

test("excess demand weakly declines as permit price rises", () => {
  const prices = [0, 1000, 2000, 3000, 3200, 3500, 5000];
  const demands = prices.map((price) => excessDemand(exampleTeams, price));

  for (let i = 1; i < demands.length; i += 1) {
    assert.ok(demands[i] <= demands[i - 1] + 1e-8);
  }
});

test("market solver matches class benchmark p*=3200", () => {
  const marketPrice = solveMarketPrice(exampleTeams);
  assert.ok(Math.abs(marketPrice - 3200) <= 1e-6);

  const aggregateExcessDemand = excessDemand(exampleTeams, marketPrice);
  assert.ok(Math.abs(aggregateExcessDemand) <= 1e-5);
});

test("called-price accounting identities hold", () => {
  const permitPrice = 3000;
  const outcome = teamOutcomeAtPrice(exampleTeams[0], permitPrice);

  assert.ok(Math.abs(outcome.abatement - (outcome.initial_emissions - outcome.final_emissions)) <= 1e-10);
  assert.ok(Math.abs(outcome.net_cost - (outcome.abatement_cost - outcome.permit_revenue)) <= 1e-10);
  assert.ok(outcome.abatement_cost >= -1e-10);
});

test("uniform-standard benchmark cost checks", () => {
  const standard = 1480;
  const costs = exampleTeams.map((row) => teamOutcomeAtUniformStandard(row, standard).abatement_cost);
  const expectedCosts = [270400, 540800, 676000, 3175200, 6350400, 7938000];

  for (let i = 0; i < costs.length; i += 1) {
    assert.ok(Math.abs(costs[i] - expectedCosts[i]) <= 1e-6);
  }
});

test("efficient cap benchmark under MD=3500", () => {
  const efficient = computeEfficientCap(exampleTeams, 3500);
  assert.ok(Math.abs(efficient.efficient_cap - 8025) <= 1e-6);

  const byTeam = efficient.team_outcomes.map((row) => row.efficient_emissions);
  const expectedByTeam = [250, 1125, 1300, 500, 2250, 2600];

  for (let i = 0; i < byTeam.length; i += 1) {
    assert.ok(Math.abs(byTeam[i] - expectedByTeam[i]) <= 1e-6);
  }
});

test("tolerance and team-letter helper behavior", () => {
  assert.equal(withinTolerance(100, 100.9, 1), true);
  assert.equal(withinTolerance(100, 101.1, 1), false);

  assert.equal(teamLetterFromIndex(0), "A");
  assert.equal(teamLetterFromIndex(25), "Z");
  assert.equal(teamLetterFromIndex(26), "AA");
  assert.equal(teamLetterFromIndex(27), "AB");
});

test("random MAC draws come from the fixed four-type classroom menu", () => {
  assert.equal(DRAWABLE_MAC_TYPES.length, 4);

  const allowedTypeKeys = new Set(
    DRAWABLE_MAC_TYPES.map((row) => `${row.mac_intercept}|${row.mac_slope}`),
  );

  for (let drawIndex = 0; drawIndex < 200; drawIndex += 1) {
    const draw = randomMacCoefficients();
    const typeKey = `${draw.mac_intercept}|${draw.mac_slope}`;
    assert.equal(allowedTypeKeys.has(typeKey), true);
    assert.equal(draw.initial_emissions, draw.mac_intercept / draw.mac_slope);
  }
});
