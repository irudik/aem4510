/**
 * Economic engine for the AEM 4510 hedonics classroom game.
 *
 * Utility model by household type:
 *   U = alpha_eq * EQ + beta_sq * SQ - Price
 *
 * Classroom supply rule by location:
 *   - Location A: perfectly elastic at price 0
 *   - Locations B-F: Price = number of housing units in that location
 */

export const LOCATION_ORDER = ["A", "B", "C", "D", "E", "F"];
export const TOTAL_HOUSEHOLDS = 75;
export const HOMOGENEOUS_ALPHA_EQ = 3;
export const HOMOGENEOUS_BETA_SQ = 1;
export const HETEROGENEOUS_BETA_SQ = 1;
export const UTILITY_TOLERANCE = 0.5;

const HETEROGENEOUS_TYPES = [
  { type_key: "black", type_label: "Black", household_count: 5, alpha_eq: 6, beta_sq: HETEROGENEOUS_BETA_SQ },
  { type_key: "red", type_label: "Red", household_count: 15, alpha_eq: 5, beta_sq: HETEROGENEOUS_BETA_SQ },
  { type_key: "orange", type_label: "Orange", household_count: 10, alpha_eq: 4, beta_sq: HETEROGENEOUS_BETA_SQ },
  { type_key: "yellow", type_label: "Yellow", household_count: 5, alpha_eq: 3, beta_sq: HETEROGENEOUS_BETA_SQ },
  { type_key: "green", type_label: "Green", household_count: 25, alpha_eq: 2, beta_sq: HETEROGENEOUS_BETA_SQ },
  { type_key: "blue", type_label: "Blue", household_count: 15, alpha_eq: 1, beta_sq: HETEROGENEOUS_BETA_SQ },
];

const ROUND_DEFINITIONS = {
  round1: {
    round_key: "round1",
    round_label: "Round 1",
    preference_mode: "homogeneous",
    eq_by_location: [0, 1, 2, 3, 4, 5],
    sq_by_location: [0, 0, 0, 0, 0, 0],
    equilibrium_houses: [30, 3, 6, 9, 12, 15],
  },
  round2: {
    round_key: "round2",
    round_label: "Round 2",
    preference_mode: "homogeneous",
    eq_by_location: [0, 1, 2, 3, 4, 5],
    sq_by_location: [0, 1, 2, 3, 4, 5],
    equilibrium_houses: [15, 4, 8, 12, 16, 20],
  },
  round3: {
    round_key: "round3",
    round_label: "Round 3",
    preference_mode: "homogeneous",
    eq_by_location: [0, 1, 4, 3, 2, 5],
    sq_by_location: [0, 1, 2, 3, 4, 5],
    equilibrium_houses: [15, 4, 14, 12, 10, 20],
  },
  round4a: {
    round_key: "round4a",
    round_label: "Round 4a",
    preference_mode: "heterogeneous",
    eq_by_location: [0, 3, 0, 0, 0, 0],
    sq_by_location: [0, 0, 0, 0, 0, 0],
    equilibrium_houses: [60, 15, 0, 0, 0, 0],
  },
  round4b: {
    round_key: "round4b",
    round_label: "Round 4b",
    preference_mode: "heterogeneous",
    eq_by_location: [0, 3, 3, 0, 0, 0],
    sq_by_location: [0, 0, 0, 0, 0, 0],
    equilibrium_houses: [51, 12, 12, 0, 0, 0],
  },
  round5: {
    round_key: "round5",
    round_label: "Round 5",
    preference_mode: "heterogeneous",
    eq_by_location: [0, 1, 2, 3, 4, 5],
    sq_by_location: [0, 0, 0, 0, 0, 0],
    equilibrium_houses: [35, 2, 4, 7, 11, 16],
  },
};

/**
 * @param {number[]} values
 */
function locationObject(values) {
  return Object.fromEntries(LOCATION_ORDER.map((locationCode, index) => [locationCode, values[index]]));
}

/**
 * @param {number} value
 * @param {number} expectedValue
 * @param {number} tolerance
 */
function withinTolerance(value, expectedValue, tolerance) {
  if (!Number.isFinite(value) || !Number.isFinite(expectedValue) || !Number.isFinite(tolerance)) {
    return false;
  }
  return Math.abs(value - expectedValue) <= tolerance + 1e-9;
}

/**
 * @param {string} roundKey
 */
export function getRoundDefinition(roundKey) {
  const normalizedKey = String(roundKey ?? "").trim().toLowerCase();
  const definition = ROUND_DEFINITIONS[normalizedKey];
  if (!definition) {
    throw new Error(`Unknown round key: ${roundKey}`);
  }
  return {
    ...definition,
    eq_by_location: [...definition.eq_by_location],
    sq_by_location: [...definition.sq_by_location],
    equilibrium_houses: [...definition.equilibrium_houses],
  };
}

export function listRoundDefinitions() {
  return Object.keys(ROUND_DEFINITIONS).map((roundKey) => getRoundDefinition(roundKey));
}

export function listHouseholdTypes() {
  return HETEROGENEOUS_TYPES.map((typeRow) => ({ ...typeRow }));
}

/**
 * Assign one of the six canonical household types by team join order.
 * @param {number} indexZeroBased
 */
export function householdTypeFromIndex(indexZeroBased) {
  if (!Number.isInteger(indexZeroBased) || indexZeroBased < 0 || indexZeroBased >= HETEROGENEOUS_TYPES.length) {
    throw new Error("indexZeroBased must be an integer between 0 and 5");
  }
  return { ...HETEROGENEOUS_TYPES[indexZeroBased] };
}

/**
 * @param {string} householdTypeKey
 */
export function getHouseholdType(householdTypeKey) {
  const normalizedKey = String(householdTypeKey ?? "").trim().toLowerCase();
  const typeRow = HETEROGENEOUS_TYPES.find((row) => row.type_key === normalizedKey);
  if (!typeRow) {
    throw new Error(`Unknown household type: ${householdTypeKey}`);
  }
  return { ...typeRow };
}

/**
 * @param {string} roundKey
 * @param {string} householdTypeKey
 */
export function preferencesForRound(roundKey, householdTypeKey) {
  const roundDefinition = getRoundDefinition(roundKey);
  if (roundDefinition.preference_mode === "homogeneous") {
    return {
      alpha_eq: HOMOGENEOUS_ALPHA_EQ,
      beta_sq: HOMOGENEOUS_BETA_SQ,
    };
  }

  const typeRow = getHouseholdType(householdTypeKey);
  return {
    alpha_eq: typeRow.alpha_eq,
    beta_sq: typeRow.beta_sq,
  };
}

/**
 * Convert a submitted 6-location vector into canonical numeric array order A-F.
 * @param {number[] | Record<string, number>} submittedHouses
 */
export function housesVector(submittedHouses) {
  if (Array.isArray(submittedHouses)) {
    if (submittedHouses.length !== LOCATION_ORDER.length) {
      throw new Error("submitted_houses must have exactly 6 entries");
    }
    return submittedHouses.map((value) => Number(value));
  }

  if (submittedHouses && typeof submittedHouses === "object") {
    return LOCATION_ORDER.map((locationCode) => Number(submittedHouses[locationCode]));
  }

  throw new Error("submitted_houses must be an array or object keyed by A-F");
}

/**
 * Validate submitted housing counts.
 * @param {number[] | Record<string, number>} submittedHouses
 */
export function validateSubmittedHouses(submittedHouses) {
  const vector = housesVector(submittedHouses);

  const invalidEntry = vector.find(
    (value) => !Number.isInteger(value) || value < 0,
  );
  if (invalidEntry !== undefined) {
    throw new Error("All submitted housing counts must be nonnegative integers");
  }

  const totalHouses = vector.reduce((sum, value) => sum + value, 0);
  if (totalHouses !== TOTAL_HOUSEHOLDS) {
    throw new Error(`Submitted housing counts must sum to ${TOTAL_HOUSEHOLDS}`);
  }

  return vector;
}

/**
 * Derive equilibrium prices from housing quantities using classroom supply rules.
 * @param {number[] | Record<string, number>} housesByLocation
 */
export function pricesFromHouses(housesByLocation) {
  const housesVectorValue = housesVector(housesByLocation);
  return housesVectorValue.map((houseCount, index) => (index === 0 ? 0 : houseCount));
}

/**
 * @param {string} roundKey
 */
export function expectedMarketForRound(roundKey) {
  const roundDefinition = getRoundDefinition(roundKey);
  const prices = pricesFromHouses(roundDefinition.equilibrium_houses);

  return {
    round_key: roundDefinition.round_key,
    round_label: roundDefinition.round_label,
    preference_mode: roundDefinition.preference_mode,
    eq_by_location: locationObject(roundDefinition.eq_by_location),
    sq_by_location: locationObject(roundDefinition.sq_by_location),
    equilibrium_houses: locationObject(roundDefinition.equilibrium_houses),
    equilibrium_prices: locationObject(prices),
    total_houses: roundDefinition.equilibrium_houses.reduce((sum, value) => sum + value, 0),
  };
}

/**
 * @param {string} roundKey
 * @param {string} householdTypeKey
 */
export function wtpByLocation(roundKey, householdTypeKey) {
  const roundDefinition = getRoundDefinition(roundKey);
  const preferences = preferencesForRound(roundKey, householdTypeKey);
  const wtpValues = roundDefinition.eq_by_location.map(
    (eqValue, index) => preferences.alpha_eq * eqValue + preferences.beta_sq * roundDefinition.sq_by_location[index],
  );

  return locationObject(wtpValues);
}

/**
 * @param {string} roundKey
 * @param {string} householdTypeKey
 */
export function utilityByLocation(roundKey, householdTypeKey) {
  const marketState = expectedMarketForRound(roundKey);
  const wtpValues = wtpByLocation(roundKey, householdTypeKey);

  const utilityValues = LOCATION_ORDER.map(
    (locationCode) => Number(wtpValues[locationCode]) - Number(marketState.equilibrium_prices[locationCode]),
  );

  return locationObject(utilityValues);
}

/**
 * @param {string} roundKey
 * @param {string} householdTypeKey
 */
export function bestUtilitySummary(roundKey, householdTypeKey) {
  const utilityValues = utilityByLocation(roundKey, householdTypeKey);
  const maxUtility = Math.max(...LOCATION_ORDER.map((locationCode) => Number(utilityValues[locationCode])));
  const bestLocations = LOCATION_ORDER.filter(
    (locationCode) => withinTolerance(Number(utilityValues[locationCode]), maxUtility, 1e-9),
  );

  return {
    max_utility: maxUtility,
    best_locations: bestLocations,
    utility_by_location: utilityValues,
  };
}

/**
 * Evaluate one team submission for a round.
 * Required submitted fields:
 * - submitted_houses: vector keyed by locations A-F
 * - submitted_best_location: one location code (A-F)
 * - submitted_best_utility: scalar utility value
 *
 * @param {{
 *   round_key: string,
 *   household_type_key: string,
 *   submitted_houses: number[] | Record<string, number>,
 *   submitted_best_location: string,
 *   submitted_best_utility: number
 * }} submission
 */
export function evaluateRoundSubmission(submission) {
  const roundKey = String(submission?.round_key ?? "");
  const householdTypeKey = String(submission?.household_type_key ?? "");
  const marketState = expectedMarketForRound(roundKey);
  const bestSummary = bestUtilitySummary(roundKey, householdTypeKey);

  const submittedHouses = validateSubmittedHouses(submission?.submitted_houses);
  const expectedHouses = housesVector(marketState.equilibrium_houses);

  const housesCorrect = submittedHouses.every((value, index) => value === expectedHouses[index]);
  const submittedBestLocation = String(submission?.submitted_best_location ?? "").trim().toUpperCase();
  const bestLocationCorrect = bestSummary.best_locations.includes(submittedBestLocation);

  const submittedBestUtility = Number(submission?.submitted_best_utility);
  const bestUtilityCorrect = withinTolerance(
    submittedBestUtility,
    bestSummary.max_utility,
    UTILITY_TOLERANCE,
  );

  return {
    expected: {
      market_state: marketState,
      best_locations: bestSummary.best_locations,
      best_utility: bestSummary.max_utility,
      utility_by_location: bestSummary.utility_by_location,
      wtp_by_location: wtpByLocation(roundKey, householdTypeKey),
    },
    checks: {
      houses_correct: housesCorrect,
      best_location_correct: bestLocationCorrect,
      best_utility_correct: bestUtilityCorrect,
      is_correct: housesCorrect && bestLocationCorrect && bestUtilityCorrect,
    },
  };
}
