import { teamLetterFromIndex } from "./econ.mts";
import {
  LOCATION_ORDER,
  bestUtilitySummary,
  evaluateRoundSubmission,
  expectedMarketForRound,
  householdTypeFromIndex,
  utilityByLocation,
  wtpByLocation,
} from "./hedonics.mts";
import { getBearerToken } from "./http.mts";
import { fetchSupabaseAuthUser, supabaseRequest } from "./supabase_rest.mts";

export const MAX_INCORRECT_SUBMISSIONS = 3;
export const ROUND_KEYS = ["round1", "round2", "round3", "round4a", "round4b", "round5"];
export const ROUND_PHASES = new Set(ROUND_KEYS);
export const VALID_PHASES = new Set(["setup", ...ROUND_KEYS, "complete"]);
export const DEFAULT_SCORING_RANK_POINTS = [10, 7, 5, 3, 1];
export const DEFAULT_SCORING_WRONG_DEDUCTION = 1;

/**
 * @param {number} alphaEq
 * @param {number} betaSq
 */
export function formatUtilityEquation(alphaEq, betaSq) {
  return `U = ${Number(alphaEq)} × EQ + ${Number(betaSq)} × SQ - P`;
}

/**
 * @param {Record<string, unknown> | null | undefined} locationObject
 */
export function locationProfileText(locationObject) {
  return LOCATION_ORDER
    .map((locationCode) => {
      const value = Number(locationObject?.[locationCode] ?? 0);
      return `${locationCode}:${Number.isFinite(value) ? value : 0}`;
    })
    .join(" | ");
}

/**
 * @param {Record<string, unknown> | null | undefined} locationObject
 */
export function locationIntegerProfileText(locationObject) {
  return LOCATION_ORDER
    .map((locationCode) => {
      const value = Number(locationObject?.[locationCode] ?? 0);
      const safeValue = Number.isFinite(value) ? Math.round(value) : 0;
      return `${locationCode}:${safeValue}`;
    })
    .join(" | ");
}

/**
 * @param {string | null | undefined} phase
 */
export function isRoundPhase(phase) {
  return ROUND_PHASES.has(String(phase ?? "").trim());
}

/**
 * @param {string | null | undefined} phase
 */
export function publicRoundContext(phase) {
  if (!isRoundPhase(phase)) {
    return null;
  }

  const market = expectedMarketForRound(String(phase));
  return {
    round_key: market.round_key,
    round_label: market.round_label,
    preference_mode: market.preference_mode,
    eq_by_location: market.eq_by_location,
    sq_by_location: market.sq_by_location,
    supply_rule: "Location A price is fixed at 0. Locations B-F have price equal to number of houses.",
    total_houses: market.total_houses,
  };
}

/**
 * @param {string | null | undefined} phase
 */
export function adminRoundContext(phase) {
  const publicContext = publicRoundContext(phase);
  if (!publicContext) {
    return null;
  }

  const market = expectedMarketForRound(String(phase));
  return {
    ...publicContext,
    equilibrium_houses: market.equilibrium_houses,
    equilibrium_prices: market.equilibrium_prices,
  };
}

/**
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
 * @param {Array<number>} rankPoints
 */
export function scoringRankPointsToText(rankPoints) {
  return rankPoints.join(",");
}

/**
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
 * Compute a session leaderboard from round submissions and scoring settings.
 * @param {Record<string, unknown>} session
 * @param {Array<Record<string, unknown>>} teams
 * @param {Array<Record<string, unknown>>} submissions
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
        household_type_label: String(team.household_type_label ?? ""),
        total_points: 0,
        correct_points: 0,
        penalty_points: 0,
        incorrect_attempts: 0,
        correct_submissions: 0,
      },
    ]),
  );

  const rowsByRound = new Map();
  for (const row of submissions ?? []) {
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

    const roundKey = String(row.round_key ?? "");
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
    }
  }

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
  const sessions = await supabaseRequest("/rest/v1/hedonics_sessions", {
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
  return supabaseRequest("/rest/v1/hedonics_teams", {
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
 * @param {string} sessionId
 */
export async function getRoundSubmissionsForSession(sessionId) {
  return supabaseRequest("/rest/v1/hedonics_round_submissions", {
    method: "GET",
    queryParams: {
      select: "*",
      session_id: `eq.${sessionId}`,
      order: "submitted_at.asc",
    },
    useServiceRole: true,
  });
}

/**
 * @param {string} joinToken
 */
export async function getTeamByJoinToken(joinToken) {
  const rows = await supabaseRequest("/rest/v1/hedonics_teams", {
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
 * @param {string} roundKey
 */
export async function clearRoundSubmissions(sessionId, roundKey) {
  await supabaseRequest("/rest/v1/hedonics_round_submissions", {
    method: "DELETE",
    queryParams: {
      session_id: `eq.${sessionId}`,
      round_key: `eq.${roundKey}`,
    },
    useServiceRole: true,
  });
}

/**
 * Create a new active session and mark all prior sessions inactive.
 * @param {{
 *   session_name: string,
 *   expected_team_count: number,
 *   scoring_rank_points: string,
 *   scoring_wrong_deduction: number,
 *   created_by: string
 * }} payload
 */
export async function createSession(payload) {
  await supabaseRequest("/rest/v1/hedonics_sessions", {
    method: "PATCH",
    queryParams: {
      is_active: "eq.true",
    },
    body: { is_active: false },
    prefer: "return=minimal",
    useServiceRole: true,
  });

  const inserted = await supabaseRequest("/rest/v1/hedonics_sessions", {
    method: "POST",
    body: [{
      ...payload,
      is_active: true,
      current_phase: "setup",
    }],
    prefer: "return=representation",
    useServiceRole: true,
  });

  return inserted[0];
}

/**
 * @param {{id: string, expected_team_count: number}} session
 * @param {string} teamName
 */
export async function createOrFetchTeam(session, teamName) {
  const normalizedName = normalizeTeamName(teamName);
  const existingRows = await supabaseRequest("/rest/v1/hedonics_teams", {
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
  if (currentTeams.length >= Number(session.expected_team_count)) {
    throw new Error("This game is full. Ask the instructor to increase expected team count.");
  }
  if (currentTeams.length >= 6) {
    throw new Error("Hedonics game supports at most 6 teams (Black, Red, Orange, Yellow, Green, Blue).");
  }

  const typeRow = householdTypeFromIndex(currentTeams.length);
  const teamLetter = teamLetterFromIndex(currentTeams.length);

  const insertedRows = await supabaseRequest("/rest/v1/hedonics_teams", {
    method: "POST",
    body: [{
      session_id: session.id,
      team_name: teamName.trim(),
      team_name_normalized: normalizedName,
      team_letter: teamLetter,
      household_type_key: typeRow.type_key,
      household_type_label: typeRow.type_label,
      household_count: typeRow.household_count,
      alpha_eq: typeRow.alpha_eq,
      beta_sq: typeRow.beta_sq,
    }],
    prefer: "return=representation",
    useServiceRole: true,
  });

  return insertedRows[0];
}

/**
 * @param {number[] | Record<string, number>} submittedHouses
 */
export function canonicalHousesObject(submittedHouses) {
  if (Array.isArray(submittedHouses)) {
    return Object.fromEntries(
      LOCATION_ORDER.map((locationCode, index) => [locationCode, Number(submittedHouses[index])]),
    );
  }

  if (submittedHouses && typeof submittedHouses === "object") {
    return Object.fromEntries(
      LOCATION_ORDER.map((locationCode) => [locationCode, Number(submittedHouses[locationCode])]),
    );
  }

  throw new Error("submitted_houses must be an array or object keyed by A-F");
}

/**
 * Remove expected-answer fields until a submission is resolved by correctness or lock.
 * @param {Record<string, unknown> | null | undefined} submission
 */
export function sanitizeSubmissionForTeam(submission) {
  if (!submission) {
    return null;
  }

  const incorrectAttempts = Number(submission.incorrect_attempts ?? 0);
  const isCorrect = Boolean(submission.is_correct);
  const isLocked = Boolean(submission.is_locked);
  const resolved = isCorrect || isLocked;

  const sanitized = {
    id: submission.id ?? null,
    session_id: submission.session_id ?? null,
    team_id: submission.team_id ?? null,
    round_key: submission.round_key ?? null,
    submitted_houses: submission.submitted_houses ?? null,
    submitted_best_location: submission.submitted_best_location ?? null,
    submitted_best_utility: submission.submitted_best_utility ?? null,
    houses_correct: submission.houses_correct ?? null,
    best_location_correct: submission.best_location_correct ?? null,
    best_utility_correct: submission.best_utility_correct ?? null,
    is_correct: isCorrect,
    incorrect_attempts: Math.min(MAX_INCORRECT_SUBMISSIONS, Math.max(0, incorrectAttempts)),
    is_locked: isLocked,
    submitted_at: submission.submitted_at ?? null,
    updated_at: submission.updated_at ?? null,
  };

  if (resolved) {
    return {
      ...sanitized,
      expected_houses: submission.expected_houses ?? null,
      expected_prices: submission.expected_prices ?? null,
      expected_best_locations: submission.expected_best_locations ?? null,
      expected_best_utility: submission.expected_best_utility ?? null,
      expected_wtp: submission.expected_wtp ?? null,
      expected_utility: submission.expected_utility ?? null,
    };
  }

  return sanitized;
}

/**
 * @param {Record<string, unknown>} teamRow
 * @param {string} roundKey
 * @param {{submitted_houses: number[] | Record<string, number>, submitted_best_location: string, submitted_best_utility: number}} submitted
 */
export function evaluateTeamRoundSubmission(teamRow, roundKey, submitted) {
  return evaluateRoundSubmission({
    round_key: roundKey,
    household_type_key: String(teamRow.household_type_key ?? ""),
    submitted_houses: submitted.submitted_houses,
    submitted_best_location: submitted.submitted_best_location,
    submitted_best_utility: submitted.submitted_best_utility,
  });
}

/**
 * @param {string} roundKey
 * @param {Array<Record<string, unknown>>} teams
 * @param {Array<Record<string, unknown>>} submissions
 */
export function resolutionSummaryForRound(roundKey, teams, submissions) {
  const roundRows = (submissions ?? []).filter((row) => String(row.round_key ?? "") === String(roundKey));
  const joinedTeamCount = Array.isArray(teams) ? teams.length : 0;
  const allTeamsResolved =
    roundRows.length === joinedTeamCount &&
    joinedTeamCount > 0 &&
    roundRows.every((row) => Boolean(row.is_correct) || Boolean(row.is_locked));
  const allTeamsCorrect = allTeamsResolved && roundRows.every((row) => Boolean(row.is_correct));

  return {
    round_key: roundKey,
    joined_team_count: joinedTeamCount,
    resolved_team_count: roundRows.length,
    all_teams_resolved: allTeamsResolved,
    all_teams_correct: allTeamsCorrect,
    revealed_market: allTeamsResolved ? expectedMarketForRound(roundKey) : null,
  };
}

/**
 * @param {Record<string, unknown>} session
 * @param {Array<Record<string, unknown>>} teams
 * @param {Array<Record<string, unknown>>} submissions
 */
export function revealStateForCurrentPhase(session, teams, submissions) {
  const phase = String(session?.current_phase ?? "");
  if (!isRoundPhase(phase)) {
    return null;
  }
  return resolutionSummaryForRound(phase, teams, submissions);
}

/**
 * @param {Array<Record<string, unknown>>} submissions
 */
export function correctCountsByRound(submissions) {
  const counts = Object.fromEntries(ROUND_KEYS.map((roundKey) => [roundKey, 0]));
  for (const row of submissions ?? []) {
    const roundKey = String(row.round_key ?? "");
    if (!ROUND_PHASES.has(roundKey)) {
      continue;
    }
    if (Boolean(row.is_correct)) {
      counts[roundKey] += 1;
    }
  }
  return counts;
}

/**
 * Build an instructor-facing team table for the current phase.
 * @param {Record<string, unknown>} session
 * @param {Array<Record<string, unknown>>} teams
 * @param {Array<Record<string, unknown>>} submissions
 */
export function phaseTeamRows(session, teams, submissions) {
  if (!Array.isArray(teams) || teams.length === 0) {
    return [];
  }

  const phase = String(session?.current_phase ?? "setup");
  if (!isRoundPhase(phase)) {
    return teams.map((team) => ({
      team_letter: team.team_letter,
      team_name: team.team_name,
      household_type: team.household_type_label,
      household_count: Number(team.household_count),
      alpha_eq: Number(team.alpha_eq),
      beta_sq: Number(team.beta_sq),
      utility_equation: formatUtilityEquation(team.alpha_eq, team.beta_sq),
    }));
  }

  const submissionsByTeam = new Map(
    (submissions ?? [])
      .filter((row) => String(row.round_key ?? "") === phase)
      .map((row) => [String(row.team_id), row]),
  );

  const expectedMarket = expectedMarketForRound(phase);

  return teams.map((team) => {
    const teamId = String(team.id ?? "");
    const submission = submissionsByTeam.get(teamId);
    const wtpProfile = wtpByLocation(phase, String(team.household_type_key));
    const utilityProfile = utilityByLocation(phase, String(team.household_type_key));
    const bestSummary = bestUtilitySummary(phase, String(team.household_type_key));

    const incorrectAttempts = Number(submission?.incorrect_attempts ?? 0);

    return {
      team_letter: team.team_letter,
      team_name: team.team_name,
      household_type: team.household_type_label,
      household_count: Number(team.household_count),
      alpha_eq: Number(team.alpha_eq),
      beta_sq: Number(team.beta_sq),
      utility_equation: formatUtilityEquation(team.alpha_eq, team.beta_sq),
      round_key: phase,
      eq_profile: locationIntegerProfileText(expectedMarket.eq_by_location),
      sq_profile: locationIntegerProfileText(expectedMarket.sq_by_location),
      equilibrium_houses: locationIntegerProfileText(expectedMarket.equilibrium_houses),
      equilibrium_prices: locationIntegerProfileText(expectedMarket.equilibrium_prices),
      wtp_profile: locationProfileText(wtpProfile),
      utility_profile: locationProfileText(utilityProfile),
      best_locations: bestSummary.best_locations.join(", "),
      best_utility: Number(bestSummary.max_utility),
      submitted_houses: submission ? locationIntegerProfileText(submission.submitted_houses) : null,
      submitted_best_location: submission?.submitted_best_location ?? null,
      submitted_best_utility: submission?.submitted_best_utility ?? null,
      houses_correct: submission?.houses_correct ?? null,
      best_location_correct: submission?.best_location_correct ?? null,
      best_utility_correct: submission?.best_utility_correct ?? null,
      incorrect_attempts: Math.min(MAX_INCORRECT_SUBMISSIONS, Math.max(0, incorrectAttempts)),
      attempts_remaining: Math.max(
        0,
        MAX_INCORRECT_SUBMISSIONS - Math.min(MAX_INCORRECT_SUBMISSIONS, Math.max(0, incorrectAttempts)),
      ),
      submission_locked: Boolean(submission?.is_locked),
      submission_correct: submission?.is_correct ?? null,
    };
  });
}
