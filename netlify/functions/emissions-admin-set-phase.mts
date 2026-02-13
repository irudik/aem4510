import {
  clearCalledPriceSubmissions,
  clearMdSubmissions,
  getActiveSession,
  requireAdminUser,
} from "./_lib/game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

const VALID_PHASES = new Set(["setup", "uniform", "called_price", "md", "complete"]);

export default async function emissionsAdminSetPhase(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const body = await readJsonBody(req);

    const phase = String(body.phase ?? "").trim();
    if (!VALID_PHASES.has(phase)) {
      return jsonResponse(400, { error: "phase must be one of setup, uniform, called_price, md, complete" });
    }

    const session = await getActiveSession();
    if (!session) {
      return jsonResponse(404, { error: "No active session exists. Create one first." });
    }

    const updatePayload = {
      current_phase: phase,
    };

    if (body.common_permit_allocation !== undefined && body.common_permit_allocation !== null) {
      const commonAllocation = Number(body.common_permit_allocation);
      if (!Number.isFinite(commonAllocation) || commonAllocation < 0) {
        return jsonResponse(400, { error: "common_permit_allocation must be nonnegative" });
      }

      updatePayload.common_permit_allocation = commonAllocation;
      await supabaseRequest("/rest/v1/game_teams", {
        method: "PATCH",
        queryParams: { session_id: `eq.${session.id}` },
        body: { permit_allocation: commonAllocation },
        prefer: "return=minimal",
        useServiceRole: true,
      });
    }

    if (phase === "called_price") {
      const calledPrice = Number(body.called_price);
      if (!Number.isFinite(calledPrice) || calledPrice < 0) {
        return jsonResponse(400, { error: "called_price must be nonnegative" });
      }
      updatePayload.called_price = calledPrice;
      updatePayload.called_price_excess_demand = null;
      updatePayload.called_price_revealed_at = null;

      await clearCalledPriceSubmissions(session.id);
    }

    if (phase === "md") {
      const mdConstant = Number(body.md_constant);
      if (!Number.isFinite(mdConstant) || mdConstant < 0) {
        return jsonResponse(400, { error: "md_constant must be nonnegative" });
      }
      updatePayload.md_constant = mdConstant;
      await clearMdSubmissions(session.id);
    }

    const updatedRows = await supabaseRequest("/rest/v1/game_sessions", {
      method: "PATCH",
      queryParams: {
        id: `eq.${session.id}`,
        select: "*",
      },
      body: updatePayload,
      prefer: "return=representation",
      useServiceRole: true,
    });

    return jsonResponse(200, { session: updatedRows[0] });
  } catch (error) {
    return jsonResponse(401, { error: error.message });
  }
}

export const config = {
  path: "/api/emissions-trading/admin/set-phase",
};
