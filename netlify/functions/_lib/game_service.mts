import {
  computeEfficientCap,
  randomMacCoefficients,
  solveMarketPrice,
  teamLetterFromIndex,
  teamOutcomeAtPrice,
  teamOutcomeAtUniformStandard,
  validateTeamRows,
  withinTolerance,
  excessDemand,
} from "./econ.mts";
import { getBearerToken } from "./http.mts";
import { fetchSupabaseAuthUser, supabaseRequest } from "./supabase_rest.mts";

export const TON_TOLERANCE = 1;
export const COST_TOLERANCE = 100;

/**
 * @param {string} teamName
 */
export function normalizeTeamName(teamName) {
  return teamName.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @param {Request} req
 */
export async function requireAdminUser(req) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    throw new Error("Missing admin bearer token");
  }

  const authUser = await fetchSupabaseAuthUser(accessToken);
  if (!authUser?.id) {
    throw new Error("Invalid admin bearer token");
  }

  const rows = await supabaseRequest("/rest/v1/admin_users", {
    method: "GET",
    queryParams: {
      select: "user_id",
      user_id: `eq.${authUser.id}`,
      limit: 1,
    },
    useServiceRole: true,
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("User is not authorized as an admin");
  }

  return authUser;
}

export async function getActiveSession() {
  const sessions = await supabaseRequest("/rest/v1/game_sessions", {
    method: "GET",
    queryParams: {
      select: "*",
      is_active: "eq.true",
      order: "created_at.desc",
      limit: 1,
    },
    useServiceRole: true,
  });

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return null;
  }

  return sessions[0];
}

/**
 * @param {string} sessionId
 */
export async function getTeamsForSession(sessionId) {
  return supabaseRequest("/rest/v1/game_teams", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
      order: "created_at.asc",
    },
    useServiceRole: true,
  });
}

/**
 * @param {string} joinToken
 */
export async function getTeamByJoinToken(joinToken) {
  const rows = await supabaseRequest("/rest/v1/game_teams", {
    method: "GET",
    queryParams: {
      select: "*",
      join_token: `eq.${joinToken}`,
      limit: 1,
    },
    useServiceRole: true,
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0];
}

/**
 * @param {string} sessionId
 */
export async function clearCalledPriceSubmissions(sessionId) {
  await supabaseRequest("/rest/v1/called_price_submissions", {
    method: "DELETE",
    queryParams: {
      session_id: `eq.${sessionId}`,
    },
    useServiceRole: true,
  });
}

/**
 * @param {string} sessionId
 */
export async function clearMdSubmissions(sessionId) {
  await supabaseRequest("/rest/v1/md_submissions", {
    method: "DELETE",
    queryParams: {
      session_id: `eq.${sessionId}`,
    },
    useServiceRole: true,
  });
}

/**
 * Create a new active session and mark all prior sessions inactive.
 * @param {{session_name: string, expected_team_count: number, common_permit_allocation: number, created_by: string}} payload
 */
export async function createSession(payload) {
  await supabaseRequest("/rest/v1/game_sessions", {
    method: "PATCH",
    queryParams: {
      is_active: "eq.true",
    },
    body: { is_active: false },
    prefer: "return=minimal",
    useServiceRole: true,
  });

  const inserted = await supabaseRequest("/rest/v1/game_sessions", {
    method: "POST",
    body: [{
      ...payload,
      is_active: true,
      current_phase: "setup",
      called_price: null,
      called_price_excess_demand: null,
      called_price_revealed_at: null,
      md_constant: null,
    }],
    prefer: "return=representation",
    useServiceRole: true,
  });

  return inserted[0];
}

/**
 * @param {{id: string, expected_team_count: number, common_permit_allocation: number}} session
 * @param {string} teamName
 */
export async function createOrFetchTeam(session, teamName) {
  const normalizedName = normalizeTeamName(teamName);
  const existingRows = await supabaseRequest("/rest/v1/game_teams", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${session.id}`,
      team_name_normalized: `eq.${normalizedName}`,
      limit: 1,
    },
    useServiceRole: true,
  });

  if (Array.isArray(existingRows) && existingRows.length > 0) {
    return existingRows[0];
  }

  const currentTeams = await getTeamsForSession(session.id);
  if (currentTeams.length >= session.expected_team_count) {
    throw new Error("This game is full. Ask the instructor to increase the team count.");
  }

  const coefficients = randomMacCoefficients();
  const teamLetter = teamLetterFromIndex(currentTeams.length);

  const insertedRows = await supabaseRequest("/rest/v1/game_teams", {
    method: "POST",
    body: [{
      session_id: session.id,
      team_name: teamName.trim(),
      team_name_normalized: normalizedName,
      team_letter: teamLetter,
      mac_intercept: coefficients.mac_intercept,
      mac_slope: coefficients.mac_slope,
      permit_allocation: session.common_permit_allocation,
      initial_emissions: coefficients.initial_emissions,
    }],
    prefer: "return=representation",
    useServiceRole: true,
  });

  return insertedRows[0];
}

/**
 * @param {Array<Record<string, unknown>>} teams
 */
export function teamRowsForModel(teams) {
  return validateTeamRows(
    teams.map((team) => ({
      team_id: String(team.id),
      team_name: String(team.team_name),
      mac_intercept: Number(team.mac_intercept),
      mac_slope: Number(team.mac_slope),
      permit_allocation: Number(team.permit_allocation),
      initial_emissions: Number(team.initial_emissions),
    })),
  );
}

/**
 * @param {number} calledPrice
 * @param {Array<Record<string, unknown>>} teams
 */
export function calledPriceSummary(calledPrice, teams) {
  const modelRows = teamRowsForModel(teams);
  const aggregateExcessDemand = excessDemand(modelRows, calledPrice);
  const outcomes = modelRows.map((row) => ({
    team_id: row.team_id,
    ...teamOutcomeAtPrice(row, calledPrice),
  }));

  return {
    called_price: calledPrice,
    excess_demand: aggregateExcessDemand,
    team_outcomes: outcomes,
  };
}

/**
 * @param {Array<Record<string, unknown>>} teams
 */
export function marketEquilibriumSummary(teams) {
  const modelRows = teamRowsForModel(teams);
  const equilibriumPrice = solveMarketPrice(modelRows);
  const equilibriumRows = modelRows.map((row) => ({
    team_id: row.team_id,
    ...teamOutcomeAtPrice(row, equilibriumPrice),
  }));

  return {
    equilibrium_price: equilibriumPrice,
    team_outcomes: equilibriumRows,
    excess_demand_at_equilibrium: excessDemand(modelRows, equilibriumPrice),
  };
}

/**
 * @param {Record<string, unknown>} teamRow
 * @param {number} uniformStandard
 */
export function evaluateUniformSubmission(teamRow, uniformStandard, submitted) {
  const modelRows = teamRowsForModel([teamRow]);
  const expected = teamOutcomeAtUniformStandard(modelRows[0], uniformStandard);

  const emissionsCorrect = withinTolerance(
    Number(submitted.submitted_emissions),
    expected.final_emissions,
    TON_TOLERANCE,
  );
  const abatementCorrect = withinTolerance(
    Number(submitted.submitted_abatement),
    expected.abatement,
    TON_TOLERANCE,
  );
  const costCorrect = withinTolerance(
    Number(submitted.submitted_abatement_cost),
    expected.abatement_cost,
    COST_TOLERANCE,
  );

  return {
    expected,
    checks: {
      emissions_correct: emissionsCorrect,
      abatement_correct: abatementCorrect,
      cost_correct: costCorrect,
      is_correct: emissionsCorrect && abatementCorrect && costCorrect,
    },
  };
}

/**
 * @param {Record<string, unknown>} teamRow
 * @param {number} calledPrice
 * @param {number} submittedAbatement
 */
export function evaluateCalledPriceSubmission(teamRow, calledPrice, submittedAbatement) {
  const modelRows = teamRowsForModel([teamRow]);
  const expected = teamOutcomeAtPrice(modelRows[0], calledPrice);

  const abatementCorrect = withinTolerance(submittedAbatement, expected.abatement, TON_TOLERANCE);

  return {
    expected,
    checks: {
      abatement_correct: abatementCorrect,
      is_correct: abatementCorrect,
    },
  };
}

/**
 * @param {Record<string, unknown>} teamRow
 * @param {Array<Record<string, unknown>>} allTeams
 * @param {number} mdConstant
 * @param {number} submittedEfficientEmissions
 * @param {number} submittedIndustryCap
 */
export function evaluateMdSubmission(
  teamRow,
  allTeams,
  mdConstant,
  submittedEfficientEmissions,
  submittedIndustryCap,
) {
  const singleRowModel = teamRowsForModel([teamRow]);
  const teamEfficient = computeEfficientCap(singleRowModel, mdConstant).team_outcomes[0].efficient_emissions;

  const allRowsModel = teamRowsForModel(allTeams);
  const capResult = computeEfficientCap(allRowsModel, mdConstant);

  const efficientEmissionsCorrect = withinTolerance(
    submittedEfficientEmissions,
    teamEfficient,
    TON_TOLERANCE,
  );
  const industryCapCorrect = withinTolerance(submittedIndustryCap, capResult.efficient_cap, TON_TOLERANCE);

  return {
    expected: {
      efficient_emissions: teamEfficient,
      industry_cap: capResult.efficient_cap,
    },
    checks: {
      efficient_emissions_correct: efficientEmissionsCorrect,
      industry_cap_correct: industryCapCorrect,
      is_correct: efficientEmissionsCorrect && industryCapCorrect,
    },
  };
}
