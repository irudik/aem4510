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
export const MAX_INCORRECT_SUBMISSIONS = 3;
export const DEFAULT_SCORING_RANK_POINTS = [10, 7, 5, 3, 1];
export const DEFAULT_SCORING_WRONG_DEDUCTION = 1;

/**
 * Increment/decode incorrect-attempt counters for stage submissions.
 * @param {number | null | undefined} priorIncorrectAttempts
 * @param {boolean} isCorrect
 */
export function nextAttemptState(priorIncorrectAttempts, isCorrect) {
  const priorAttemptsRaw = Number(priorIncorrectAttempts ?? 0);
  const priorAttempts =
    Number.isFinite(priorAttemptsRaw) && priorAttemptsRaw >= 0
      ? Math.min(MAX_INCORRECT_SUBMISSIONS, Math.floor(priorAttemptsRaw))
      : 0;
  const incorrectAttempts = isCorrect ? priorAttempts : Math.min(MAX_INCORRECT_SUBMISSIONS, priorAttempts + 1);
  const isLocked = !isCorrect && incorrectAttempts >= MAX_INCORRECT_SUBMISSIONS;

  return {
    incorrect_attempts: incorrectAttempts,
    attempts_remaining: Math.max(0, MAX_INCORRECT_SUBMISSIONS - incorrectAttempts),
    is_locked: isLocked,
  };
}

/**
 * Parse a comma-separated or array-based scoring vector for 1st/2nd/... correct submissions.
 * @param {string | Array<number> | null | undefined} rawValue
 */
export function parseScoringRankPoints(rawValue) {
  if (Array.isArray(rawValue)) {
    if (rawValue.length === 0) {
      throw new Error("scoring_rank_points must contain at least one value");
    }
    const parsed = rawValue.map((value) => Number(value));
    const invalid = parsed.some((value) => !Number.isFinite(value) || value < 0);
    if (invalid) {
      throw new Error("scoring_rank_points entries must be nonnegative numbers");
    }
    return parsed;
  }

  const text = String(rawValue ?? "").trim();
  if (!text) {
    return [...DEFAULT_SCORING_RANK_POINTS];
  }

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("scoring_rank_points must contain at least one value");
  }

  const parsed = parts.map((part) => Number(part));
  const invalid = parsed.some((value) => !Number.isFinite(value) || value < 0);
  if (invalid) {
    throw new Error("scoring_rank_points entries must be nonnegative numbers");
  }

  return parsed;
}

/**
 * Canonical string storage for the rank-point vector.
 * @param {Array<number>} rankPoints
 */
export function scoringRankPointsToText(rankPoints) {
  return rankPoints.join(",");
}

/**
 * Resolve scoring config from the session row with defaults.
 * @param {Record<string, unknown>} session
 */
export function scoringConfigFromSession(session) {
  const scoringRankPoints = parseScoringRankPoints(session?.scoring_rank_points);
  const wrongDeductionRaw = Number(session?.scoring_wrong_deduction ?? DEFAULT_SCORING_WRONG_DEDUCTION);
  const scoringWrongDeduction =
    Number.isFinite(wrongDeductionRaw) && wrongDeductionRaw >= 0
      ? wrongDeductionRaw
      : DEFAULT_SCORING_WRONG_DEDUCTION;

  return {
    scoring_rank_points: scoringRankPoints,
    scoring_wrong_deduction: scoringWrongDeduction,
  };
}

/**
 * @param {string | null | undefined} timestamp
 */
function timestampMs(timestamp) {
  const parsed = Date.parse(String(timestamp ?? ""));
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Compute a session leaderboard from all submitted rows and scoring settings.
 * Teams earn position-based points when correct; each incorrect attempt incurs a deduction.
 * @param {Record<string, unknown>} session
 * @param {Array<Record<string, unknown>>} teams
 * @param {{uniform: Array<Record<string, unknown>>, called_price: Array<Record<string, unknown>>, md: Array<Record<string, unknown>>}} submissions
 */
export function computeLeaderboard(session, teams, submissions) {
  const { scoring_rank_points: rankPoints, scoring_wrong_deduction: wrongDeduction } =
    scoringConfigFromSession(session);

  const scoreboard = new Map(
    teams.map((team) => [
      String(team.id),
      {
        team_id: String(team.id),
        team_letter: String(team.team_letter ?? ""),
        team_name: String(team.team_name ?? ""),
        total_points: 0,
        correct_points: 0,
        penalty_points: 0,
        incorrect_attempts: 0,
        correct_submissions: 0,
        uniform_points: 0,
        called_price_points: 0,
        md_points: 0,
      },
    ]),
  );

  /**
   * @param {Array<Record<string, unknown>>} rows
   * @param {(row: Record<string, unknown>) => string} roundKeyFn
   * @param {"uniform_points" | "called_price_points" | "md_points"} phasePointsField
   */
  function applyPhaseRows(rows, roundKeyFn, phasePointsField) {
    const rowsByRound = new Map();
    for (const row of rows ?? []) {
      const teamId = String(row.team_id ?? "");
      if (!teamId || !scoreboard.has(teamId)) {
        continue;
      }

      const incorrectAttemptsRaw = Number(row.incorrect_attempts ?? 0);
      const incorrectAttempts =
        Number.isFinite(incorrectAttemptsRaw) && incorrectAttemptsRaw > 0
          ? Math.floor(incorrectAttemptsRaw)
          : 0;
      const penalty = wrongDeduction * incorrectAttempts;
      const teamScore = scoreboard.get(teamId);
      teamScore.penalty_points += penalty;
      teamScore.total_points -= penalty;
      teamScore.incorrect_attempts += incorrectAttempts;
      teamScore[phasePointsField] -= penalty;

      const roundKey = roundKeyFn(row);
      if (!rowsByRound.has(roundKey)) {
        rowsByRound.set(roundKey, []);
      }
      rowsByRound.get(roundKey).push(row);
    }

    for (const roundRows of rowsByRound.values()) {
      const correctRows = roundRows
        .filter((row) => Boolean(row.is_correct))
        .sort((left, right) => {
          const timeDelta = timestampMs(left.updated_at) - timestampMs(right.updated_at);
          if (timeDelta !== 0) {
            return timeDelta;
          }
          return String(left.team_id ?? "").localeCompare(String(right.team_id ?? ""));
        });

      for (let index = 0; index < correctRows.length; index += 1) {
        const award = Number(rankPoints[index] ?? 0);
        if (!Number.isFinite(award) || award <= 0) {
          continue;
        }
        const teamId = String(correctRows[index].team_id ?? "");
        const teamScore = scoreboard.get(teamId);
        if (!teamScore) {
          continue;
        }
        teamScore.correct_points += award;
        teamScore.total_points += award;
        teamScore.correct_submissions += 1;
        teamScore[phasePointsField] += award;
      }
    }
  }

  applyPhaseRows(
    submissions.uniform ?? [],
    () => "uniform",
    "uniform_points",
  );
  applyPhaseRows(
    submissions.called_price ?? [],
    (row) => `called_price:${Number(row.called_price ?? 0)}`,
    "called_price_points",
  );
  applyPhaseRows(
    submissions.md ?? [],
    (row) => `md:${Number(row.md_constant ?? 0)}`,
    "md_points",
  );

  const leaderboard = Array.from(scoreboard.values())
    .sort((left, right) => {
      const totalDelta = Number(right.total_points) - Number(left.total_points);
      if (totalDelta !== 0) {
        return totalDelta;
      }
      const correctDelta = Number(right.correct_submissions) - Number(left.correct_submissions);
      if (correctDelta !== 0) {
        return correctDelta;
      }
      const incorrectDelta = Number(left.incorrect_attempts) - Number(right.incorrect_attempts);
      if (incorrectDelta !== 0) {
        return incorrectDelta;
      }
      return String(left.team_letter).localeCompare(String(right.team_letter));
    })
    .map((row, index) => ({
      rank: index + 1,
      ...row,
    }));

  return {
    scoring_rank_points: rankPoints,
    scoring_wrong_deduction: wrongDeduction,
    leaderboard,
  };
}

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
 * @param {{
 *   session_name: string,
 *   expected_team_count: number,
 *   common_permit_allocation: number,
 *   scoring_rank_points: string,
 *   scoring_wrong_deduction: number,
 *   created_by: string
 * }} payload
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
 * MAC display string used in instructor/student tables.
 * @param {number} macIntercept
 * @param {number} macSlope
 */
export function formatMacEquation(macIntercept, macSlope) {
  return `MAC = ${Number(macIntercept)} - ${Number(macSlope)} × E`;
}

/**
 * Build an instructor-facing team table for the current phase.
 * @param {Record<string, unknown>} session
 * @param {Array<Record<string, unknown>>} teams
 * @param {{uniform: Array<Record<string, unknown>>, called_price: Array<Record<string, unknown>>, md: Array<Record<string, unknown>>}} submissions
 */
export function phaseTeamRows(session, teams, submissions) {
  if (!Array.isArray(teams) || teams.length === 0) {
    return [];
  }

  const modelRows = teamRowsForModel(teams);
  const phase = String(session.current_phase ?? "setup");
  const teamMetaById = new Map(
    teams.map((team) => [
      String(team.id),
      {
        team_letter: String(team.team_letter ?? ""),
        team_name: String(team.team_name ?? ""),
      },
    ]),
  );

  const uniformByTeam = new Map((submissions.uniform ?? []).map((row) => [String(row.team_id), row]));
  const calledPriceCurrentRows = (submissions.called_price ?? []).filter((row) => {
    if (session.called_price === null || session.called_price === undefined) {
      return false;
    }
    return Number(row.called_price) === Number(session.called_price);
  });
  const calledPriceByTeam = new Map(calledPriceCurrentRows.map((row) => [String(row.team_id), row]));
  const mdCurrentRows = (submissions.md ?? []).filter((row) => {
    if (session.md_constant === null || session.md_constant === undefined) {
      return false;
    }
    return Number(row.md_constant) === Number(session.md_constant);
  });
  const mdByTeam = new Map(mdCurrentRows.map((row) => [String(row.team_id), row]));

  if (phase === "uniform") {
    const uniformStandard = Number(session.common_permit_allocation);
    return modelRows.map((row) => {
      const teamMeta = teamMetaById.get(row.team_id) ?? { team_letter: "", team_name: "" };
      const expected = teamOutcomeAtUniformStandard(row, uniformStandard);
      const submission = uniformByTeam.get(row.team_id);

      return {
        team_letter: teamMeta.team_letter,
        team_name: teamMeta.team_name,
        mac_intercept: row.mac_intercept,
        mac_slope: row.mac_slope,
        mac_equation: formatMacEquation(row.mac_intercept, row.mac_slope),
        initial_emissions: row.initial_emissions,
        permit_allocation: row.permit_allocation,
        standard_emissions: expected.final_emissions,
        standard_abatement: expected.abatement,
        standard_abatement_cost: expected.abatement_cost,
        submitted_emissions: submission?.submitted_emissions ?? null,
        submitted_abatement: submission?.submitted_abatement ?? null,
        submitted_abatement_cost: submission?.submitted_abatement_cost ?? null,
        incorrect_attempts: Number(submission?.incorrect_attempts ?? 0),
        attempts_remaining: Math.max(0, MAX_INCORRECT_SUBMISSIONS - Number(submission?.incorrect_attempts ?? 0)),
        submission_locked: Boolean(submission?.is_locked ?? false),
        submission_correct: submission?.is_correct ?? null,
      };
    });
  }

  if (phase === "called_price") {
    const calledPrice = Number(session.called_price ?? 0);
    return modelRows.map((row) => {
      const teamMeta = teamMetaById.get(row.team_id) ?? { team_letter: "", team_name: "" };
      const expected = teamOutcomeAtPrice(row, calledPrice);
      const submission = calledPriceByTeam.get(row.team_id);

      return {
        team_letter: teamMeta.team_letter,
        team_name: teamMeta.team_name,
        mac_intercept: row.mac_intercept,
        mac_slope: row.mac_slope,
        mac_equation: formatMacEquation(row.mac_intercept, row.mac_slope),
        initial_emissions: row.initial_emissions,
        permit_allocation: row.permit_allocation,
        called_price: calledPrice,
        optimal_emissions: expected.final_emissions,
        optimal_abatement: expected.abatement,
        optimal_abatement_cost: expected.abatement_cost,
        permit_position: expected.permit_position,
        permit_revenue: expected.permit_revenue,
        net_cost: expected.net_cost,
        submitted_abatement: submission?.submitted_abatement ?? null,
        incorrect_attempts: Number(submission?.incorrect_attempts ?? 0),
        attempts_remaining: Math.max(0, MAX_INCORRECT_SUBMISSIONS - Number(submission?.incorrect_attempts ?? 0)),
        submission_locked: Boolean(submission?.is_locked ?? false),
        submission_correct: submission?.is_correct ?? null,
      };
    });
  }

  if (phase === "md") {
    const mdConstant = Number(session.md_constant ?? 0);
    const capResult = computeEfficientCap(modelRows, mdConstant);
    const efficientByTeam = new Map(
      capResult.team_outcomes.map((row) => [String(row.team_id), Number(row.efficient_emissions)]),
    );

    return modelRows.map((row) => {
      const teamMeta = teamMetaById.get(row.team_id) ?? { team_letter: "", team_name: "" };
      const submission = mdByTeam.get(row.team_id);

      return {
        team_letter: teamMeta.team_letter,
        team_name: teamMeta.team_name,
        mac_intercept: row.mac_intercept,
        mac_slope: row.mac_slope,
        mac_equation: formatMacEquation(row.mac_intercept, row.mac_slope),
        initial_emissions: row.initial_emissions,
        permit_allocation: row.permit_allocation,
        md_constant: mdConstant,
        efficient_emissions: efficientByTeam.get(row.team_id) ?? null,
        efficient_industry_cap: capResult.efficient_cap,
        submitted_efficient_emissions: submission?.submitted_efficient_emissions ?? null,
        submitted_industry_cap: submission?.submitted_industry_cap ?? null,
        incorrect_attempts: Number(submission?.incorrect_attempts ?? 0),
        attempts_remaining: Math.max(0, MAX_INCORRECT_SUBMISSIONS - Number(submission?.incorrect_attempts ?? 0)),
        submission_locked: Boolean(submission?.is_locked ?? false),
        submission_correct: submission?.is_correct ?? null,
      };
    });
  }

  return modelRows.map((row) => {
    const teamMeta = teamMetaById.get(row.team_id) ?? { team_letter: "", team_name: "" };
    return {
      team_letter: teamMeta.team_letter,
      team_name: teamMeta.team_name,
      mac_intercept: row.mac_intercept,
      mac_slope: row.mac_slope,
      mac_equation: formatMacEquation(row.mac_intercept, row.mac_slope),
      initial_emissions: row.initial_emissions,
      permit_allocation: row.permit_allocation,
    };
  });
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
