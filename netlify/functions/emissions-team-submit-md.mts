import {
  evaluateMdSubmission,
  getActiveSession,
  getTeamByJoinToken,
  getTeamsForSession,
} from "./_lib/game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

export default async function emissionsTeamSubmitMd(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);

    const joinToken = String(body.join_token ?? "").trim();
    if (!joinToken) {
      return jsonResponse(400, { error: "join_token is required" });
    }

    const team = await getTeamByJoinToken(joinToken);
    if (!team) {
      return jsonResponse(404, { error: "Team token not found" });
    }

    const session = await getActiveSession();
    if (!session || session.id !== team.session_id) {
      return jsonResponse(404, { error: "No active session for this team" });
    }
    if (session.current_phase !== "md") {
      return jsonResponse(400, { error: "MD stage is not currently active" });
    }
    if (session.md_constant === null || session.md_constant === undefined) {
      return jsonResponse(400, { error: "No md_constant is currently set" });
    }

    const submittedEfficientEmissions = Number(body.submitted_efficient_emissions);
    const submittedIndustryCap = Number(body.submitted_industry_cap);
    if (!Number.isFinite(submittedEfficientEmissions) || submittedEfficientEmissions < 0) {
      return jsonResponse(400, { error: "submitted_efficient_emissions must be nonnegative" });
    }
    if (!Number.isFinite(submittedIndustryCap) || submittedIndustryCap < 0) {
      return jsonResponse(400, { error: "submitted_industry_cap must be nonnegative" });
    }

    const allTeams = await getTeamsForSession(session.id);
    const mdConstant = Number(session.md_constant);

    const evaluated = evaluateMdSubmission(
      team,
      allTeams,
      mdConstant,
      submittedEfficientEmissions,
      submittedIndustryCap,
    );

    await supabaseRequest("/rest/v1/md_submissions", {
      method: "POST",
      queryParams: {
        on_conflict: "session_id,team_id,md_constant",
      },
      body: [{
        session_id: session.id,
        team_id: team.id,
        md_constant: mdConstant,
        submitted_efficient_emissions: submittedEfficientEmissions,
        submitted_industry_cap: submittedIndustryCap,
        expected_efficient_emissions: evaluated.expected.efficient_emissions,
        expected_industry_cap: evaluated.expected.industry_cap,
        efficient_emissions_correct: evaluated.checks.efficient_emissions_correct,
        industry_cap_correct: evaluated.checks.industry_cap_correct,
        is_correct: evaluated.checks.is_correct,
      }],
      prefer: "resolution=merge-duplicates,return=minimal",
      useServiceRole: true,
    });

    return jsonResponse(200, {
      is_correct: evaluated.checks.is_correct,
      checks: evaluated.checks,
      expected: evaluated.expected,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/emissions-trading/team/submit-md",
};
