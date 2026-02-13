/**
 * Economic engine for the AEM 4510 emissions trading game.
 *
 * Core structure: MAC_i(E) = a_i - b_i E with b_i > 0.
 * Baseline emissions are where MAC_i(E)=0, i.e. E0_i = a_i / b_i.
 */

/** @typedef {{
 * team_id?: string,
 * team_name?: string,
 * mac_intercept: number,
 * mac_slope: number,
 * permit_allocation: number,
 * initial_emissions?: number
 * }} TeamRow */

const EPSILON = 1e-9;

/**
 * Validate and normalize team rows.
 * @param {TeamRow[]} teamRows
 * @returns {TeamRow[]}
 */
export function validateTeamRows(teamRows) {
  if (!Array.isArray(teamRows) || teamRows.length === 0) {
    throw new Error("teamRows must be a non-empty array");
  }

  return teamRows.map((row, rowIndex) => {
    if (row == null || typeof row !== "object") {
      throw new Error(`Row ${rowIndex + 1} must be an object`);
    }

    const macIntercept = Number(row.mac_intercept);
    const macSlope = Number(row.mac_slope);
    const permitAllocation = Number(row.permit_allocation);

    if (!Number.isFinite(macIntercept) || macIntercept < 0) {
      throw new Error(`Row ${rowIndex + 1}: mac_intercept must be a nonnegative number`);
    }
    if (!Number.isFinite(macSlope) || macSlope <= 0) {
      throw new Error(`Row ${rowIndex + 1}: mac_slope must be strictly positive`);
    }
    if (!Number.isFinite(permitAllocation) || permitAllocation < 0) {
      throw new Error(`Row ${rowIndex + 1}: permit_allocation must be a nonnegative number`);
    }

    return {
      ...row,
      mac_intercept: macIntercept,
      mac_slope: macSlope,
      permit_allocation: permitAllocation,
      initial_emissions: macIntercept / macSlope,
    };
  });
}

/**
 * Emissions choice at permit price p under cap-and-trade optimization.
 * @param {TeamRow} teamRow
 * @param {number} permitPrice
 * @returns {number}
 */
export function emissionsAtPrice(teamRow, permitPrice) {
  const rawEmissions = (teamRow.mac_intercept - permitPrice) / teamRow.mac_slope;
  return Math.max(rawEmissions, 0);
}

/**
 * Abatement cost between baseline and chosen emissions.
 * This integral is the area under MAC over the abatement interval.
 * @param {TeamRow} teamRow
 * @param {number} finalEmissions
 * @returns {number}
 */
export function abatementCost(teamRow, finalEmissions) {
  const initialEmissions =
    Number.isFinite(teamRow.initial_emissions) && teamRow.initial_emissions !== undefined
      ? Number(teamRow.initial_emissions)
      : teamRow.mac_intercept / teamRow.mac_slope;

  const clampedFinalEmissions = Math.min(Math.max(finalEmissions, 0), initialEmissions);
  const cost =
    teamRow.mac_intercept * (initialEmissions - clampedFinalEmissions) -
    (teamRow.mac_slope * (initialEmissions ** 2 - clampedFinalEmissions ** 2)) / 2;

  return Math.max(cost, 0);
}

/**
 * Team outcomes at a called permit price.
 * @param {TeamRow} teamRow
 * @param {number} permitPrice
 */
export function teamOutcomeAtPrice(teamRow, permitPrice) {
  const initialEmissions =
    Number.isFinite(teamRow.initial_emissions) && teamRow.initial_emissions !== undefined
      ? Number(teamRow.initial_emissions)
      : teamRow.mac_intercept / teamRow.mac_slope;

  const finalEmissions = emissionsAtPrice(teamRow, permitPrice);
  const abatement = initialEmissions - finalEmissions;
  const teamAbatementCost = abatementCost(teamRow, finalEmissions);
  const permitPosition = finalEmissions - teamRow.permit_allocation;
  const permitRevenue = (teamRow.permit_allocation - finalEmissions) * permitPrice;
  const netCost = teamAbatementCost - permitRevenue;

  return {
    initial_emissions: initialEmissions,
    final_emissions: finalEmissions,
    abatement,
    abatement_cost: teamAbatementCost,
    permit_position: permitPosition,
    permit_revenue: permitRevenue,
    net_cost: netCost,
  };
}

/**
 * Team outcomes under a uniform standard.
 * @param {TeamRow} teamRow
 * @param {number} uniformStandard
 */
export function teamOutcomeAtUniformStandard(teamRow, uniformStandard) {
  const initialEmissions =
    Number.isFinite(teamRow.initial_emissions) && teamRow.initial_emissions !== undefined
      ? Number(teamRow.initial_emissions)
      : teamRow.mac_intercept / teamRow.mac_slope;

  const finalEmissions = Math.min(initialEmissions, Math.max(uniformStandard, 0));
  const abatement = initialEmissions - finalEmissions;
  const teamAbatementCost = abatementCost(teamRow, finalEmissions);

  return {
    initial_emissions: initialEmissions,
    final_emissions: finalEmissions,
    abatement,
    abatement_cost: teamAbatementCost,
  };
}

/**
 * Team emissions under constant marginal damages.
 * @param {TeamRow} teamRow
 * @param {number} marginalDamages
 */
export function teamEfficientEmissions(teamRow, marginalDamages) {
  return Math.max((teamRow.mac_intercept - marginalDamages) / teamRow.mac_slope, 0);
}

/**
 * Aggregate excess permit demand at price p.
 * @param {TeamRow[]} teamRows
 * @param {number} permitPrice
 * @returns {number}
 */
export function excessDemand(teamRows, permitPrice) {
  const validated = validateTeamRows(teamRows);
  let aggregateDemand = 0;

  for (const teamRow of validated) {
    aggregateDemand += emissionsAtPrice(teamRow, permitPrice) - teamRow.permit_allocation;
  }

  return aggregateDemand;
}

/**
 * Market-clearing permit price with nonnegative price constraint.
 * @param {TeamRow[]} teamRows
 * @param {number} tolerance
 * @returns {number}
 */
export function solveMarketPrice(teamRows, tolerance = 1e-8) {
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new Error("tolerance must be strictly positive");
  }

  const validated = validateTeamRows(teamRows);
  const excessAtZero = excessDemand(validated, 0);
  if (excessAtZero <= tolerance) {
    return 0;
  }

  let low = 0;
  let high = Math.max(...validated.map((row) => row.mac_intercept));
  let excessAtHigh = excessDemand(validated, high);
  let expansionCount = 0;

  while (excessAtHigh > tolerance && expansionCount < 60) {
    high *= 2;
    excessAtHigh = excessDemand(validated, high);
    expansionCount += 1;
  }

  if (excessAtHigh > tolerance) {
    throw new Error("Unable to bracket market-clearing permit price");
  }

  for (let iteration = 0; iteration < 120; iteration += 1) {
    const mid = (low + high) / 2;
    const excessAtMid = excessDemand(validated, mid);

    if (Math.abs(excessAtMid) <= tolerance || Math.abs(high - low) <= tolerance) {
      return Math.max(mid, 0);
    }

    if (excessAtMid > 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.max((low + high) / 2, 0);
}

/**
 * Efficient cap under constant marginal damages.
 * @param {TeamRow[]} teamRows
 * @param {number} marginalDamages
 */
export function computeEfficientCap(teamRows, marginalDamages) {
  if (!Number.isFinite(marginalDamages) || marginalDamages < 0) {
    throw new Error("marginalDamages must be a nonnegative number");
  }

  const validated = validateTeamRows(teamRows);
  let efficientCap = 0;

  const byTeam = validated.map((teamRow) => {
    const efficientEmissions = teamEfficientEmissions(teamRow, marginalDamages);
    efficientCap += efficientEmissions;
    return {
      ...teamRow,
      efficient_emissions: efficientEmissions,
    };
  });

  return {
    marginal_damages: marginalDamages,
    efficient_cap: efficientCap,
    team_outcomes: byTeam,
  };
}

/**
 * Tolerance check around a target value.
 * @param {number} submittedValue
 * @param {number} expectedValue
 * @param {number} tolerance
 */
export function withinTolerance(submittedValue, expectedValue, tolerance) {
  if (!Number.isFinite(submittedValue) || !Number.isFinite(expectedValue) || !Number.isFinite(tolerance)) {
    return false;
  }
  return Math.abs(submittedValue - expectedValue) <= tolerance + EPSILON;
}

/**
 * Round helper for displaying classroom-reported values.
 * @param {number} value
 * @param {number} digits
 */
export function roundTo(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Team letter generator: A, B, ..., Z, AA, AB, ...
 * @param {number} indexZeroBased
 */
export function teamLetterFromIndex(indexZeroBased) {
  if (!Number.isInteger(indexZeroBased) || indexZeroBased < 0) {
    throw new Error("indexZeroBased must be a nonnegative integer");
  }

  let n = indexZeroBased;
  let label = "";

  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }

  return label;
}

/**
 * Draw random MAC coefficients from classroom-friendly discrete supports.
 * Intercepts in {2000, 4000, ..., 12000}, slopes in {1,2,...,6}.
 */
export function randomMacCoefficients() {
  const interceptOptions = [2000, 4000, 6000, 8000, 10000, 12000];
  const macIntercept = interceptOptions[Math.floor(Math.random() * interceptOptions.length)];
  const macSlope = 1 + Math.floor(Math.random() * 6);

  return {
    mac_intercept: macIntercept,
    mac_slope: macSlope,
    initial_emissions: macIntercept / macSlope,
  };
}
