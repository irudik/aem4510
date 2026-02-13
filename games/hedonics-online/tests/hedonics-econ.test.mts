import test from "node:test";
import assert from "node:assert/strict";

import {
  LOCATION_ORDER,
  TOTAL_HOUSEHOLDS,
  bestUtilitySummary,
  evaluateRoundSubmission,
  expectedMarketForRound,
  listRoundDefinitions,
  listHouseholdTypes,
  preferencesForRound,
  pricesFromHouses,
  utilityByLocation,
  validateSubmittedHouses,
  wtpByLocation,
} from "../../../netlify/functions/_lib/hedonics.mts";

test("round definitions are available and each round sums to 75 houses", () => {
  const rounds = listRoundDefinitions();
  assert.equal(rounds.length, 6);

  for (const round of rounds) {
    const total = round.equilibrium_houses.reduce((sum, value) => sum + value, 0);
    assert.equal(total, TOTAL_HOUSEHOLDS);
  }
});

test("household type table matches the 75-household handout distribution", () => {
  const types = listHouseholdTypes();
  assert.equal(types.length, 6);

  const householdTotal = types.reduce((sum, row) => sum + row.household_count, 0);
  assert.equal(householdTotal, TOTAL_HOUSEHOLDS);
  assert.deepEqual(
    types.map((row) => row.type_label),
    ["Black", "Red", "Orange", "Yellow", "Green", "Blue"],
  );
});

test("price rule matches workbook results for rounds 1,2,3,5", () => {
  const round1 = expectedMarketForRound("round1");
  const round2 = expectedMarketForRound("round2");
  const round3 = expectedMarketForRound("round3");
  const round5 = expectedMarketForRound("round5");

  assert.deepEqual(round1.equilibrium_prices, { A: 0, B: 3, C: 6, D: 9, E: 12, F: 15 });
  assert.deepEqual(round2.equilibrium_prices, { A: 0, B: 4, C: 8, D: 12, E: 16, F: 20 });
  assert.deepEqual(round3.equilibrium_prices, { A: 0, B: 4, C: 14, D: 12, E: 10, F: 20 });
  assert.deepEqual(round5.equilibrium_prices, { A: 0, B: 2, C: 4, D: 7, E: 11, F: 16 });
});

test("round 4a and 4b encode the marginal-buyer slopes from the lecture notes", () => {
  const round4a = expectedMarketForRound("round4a");
  const round4b = expectedMarketForRound("round4b");

  const slope4a = (round4a.equilibrium_prices.B - round4a.equilibrium_prices.A) / 3;
  const slope4b = (round4b.equilibrium_prices.B - round4b.equilibrium_prices.A) / 3;

  assert.equal(slope4a, 5);
  assert.equal(slope4b, 4);
});

test("homogeneous rounds use alpha=3, beta=1 for every household type", () => {
  const blackRound1 = preferencesForRound("round1", "black");
  const blueRound3 = preferencesForRound("round3", "blue");

  assert.equal(blackRound1.alpha_eq, 3);
  assert.equal(blackRound1.beta_sq, 1);
  assert.equal(blueRound3.alpha_eq, 3);
  assert.equal(blueRound3.beta_sq, 1);
});

test("heterogeneous rounds recover type-specific utilities and tie sets", () => {
  const blackRound5 = bestUtilitySummary("round5", "black");
  const blueRound5 = bestUtilitySummary("round5", "blue");
  const redRound5 = bestUtilitySummary("round5", "red");

  assert.deepEqual(blackRound5.best_locations, ["F"]);
  assert.equal(blackRound5.max_utility, 14);
  assert.deepEqual(blueRound5.best_locations, ["A"]);
  assert.equal(blueRound5.max_utility, 0);
  assert.deepEqual(redRound5.best_locations, ["E", "F"]);
});

test("validateSubmittedHouses enforces integer nonnegative counts that sum to 75", () => {
  const valid = validateSubmittedHouses([15, 4, 14, 12, 10, 20]);
  assert.deepEqual(valid, [15, 4, 14, 12, 10, 20]);

  assert.throws(() => validateSubmittedHouses([57, 3, 6, 9, 12, 14]), /sum to 75/);
  assert.throws(() => validateSubmittedHouses([57, 3, 6, 9, 12, -1]), /nonnegative integers/);
  assert.throws(() => validateSubmittedHouses([57, 3, 6, 9, 12, 15.5]), /nonnegative integers/);
});

test("evaluateRoundSubmission accepts exact market quantities and valid best-response values", () => {
  const result = evaluateRoundSubmission({
    round_key: "round5",
    household_type_key: "black",
    submitted_houses: {
      A: 35,
      B: 2,
      C: 4,
      D: 7,
      E: 11,
      F: 16,
    },
    submitted_best_location: "F",
    submitted_best_utility: 14,
  });

  assert.equal(result.checks.houses_correct, true);
  assert.equal(result.checks.best_location_correct, true);
  assert.equal(result.checks.best_utility_correct, true);
  assert.equal(result.checks.is_correct, true);
});

test("evaluateRoundSubmission rejects incorrect houses and wrong best response", () => {
  const result = evaluateRoundSubmission({
    round_key: "round4a",
    household_type_key: "red",
    submitted_houses: {
      A: 51,
      B: 12,
      C: 12,
      D: 0,
      E: 0,
      F: 0,
    },
    submitted_best_location: "Z",
    submitted_best_utility: -1,
  });

  assert.equal(result.checks.houses_correct, false);
  assert.equal(result.checks.best_location_correct, false);
  assert.equal(result.checks.best_utility_correct, false);
  assert.equal(result.checks.is_correct, false);
});

test("helpers return location-keyed vectors in A-F order", () => {
  const round2 = expectedMarketForRound("round2");
  const typeWtp = wtpByLocation("round2", "green");
  const typeUtility = utilityByLocation("round2", "green");
  const derivedPrices = pricesFromHouses(round2.equilibrium_houses);

  assert.deepEqual(Object.keys(typeWtp), LOCATION_ORDER);
  assert.deepEqual(Object.keys(typeUtility), LOCATION_ORDER);
  assert.deepEqual(derivedPrices, [0, 4, 8, 12, 16, 20]);
  assert.equal(typeWtp.F, 20);
  assert.equal(typeUtility.F, 0);
});
