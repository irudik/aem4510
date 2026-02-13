import {
  adminProxyIdsFromPlayers,
  deleteRoundOutcome,
  getActiveSession,
  getPairsForSession,
  getPlayerByJoinToken,
  getPlayersForSession,
  getRoundSubmissionsForSession,
  isRoundPhase,
  maybeResolvePairRound,
  pairForPlayer,
  upsertRoundOutcome,
} from "./_lib/coase_game_service.mts";
import { validateEmissions } from "./_lib/coase.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";
import { supabaseRequest } from "./_lib/supabase_rest.mts";

export default async function coasePlayerSubmitRound(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);

    const joinToken = String(body.join_token ?? "").trim();
    if (!joinToken) {
      return jsonResponse(400, { error: "join_token is required" });
    }

    const player = await getPlayerByJoinToken(joinToken);
    if (!player) {
      return jsonResponse(404, { error: "Player token not found" });
    }

    const session = await getActiveSession();
    if (!session || session.id !== player.session_id) {
      return jsonResponse(404, { error: "No active session for this player" });
    }

    const roundKey = String(session.current_phase ?? "");
    if (!isRoundPhase(roundKey)) {
      return jsonResponse(400, { error: "A Coase round is not currently active" });
    }

    const emissions = validateEmissions(body.submitted_emissions);
    const payment = Number(body.submitted_payment_noncontroller_to_controller);
    const legalFeePaidByA = Number(body.submitted_legal_fee_paid_by_a ?? 0);

    if (!Number.isFinite(payment) || payment < 0) {
      return jsonResponse(400, { error: "submitted_payment_noncontroller_to_controller must be nonnegative" });
    }
    if (!Number.isFinite(legalFeePaidByA) || legalFeePaidByA < 0 || legalFeePaidByA > 5) {
      return jsonResponse(400, { error: "submitted_legal_fee_paid_by_a must be between 0 and 5" });
    }

    const pairs = await getPairsForSession(String(session.id));
    const pair = pairForPlayer(pairs, String(player.id));
    if (!pair) {
      return jsonResponse(400, { error: "You have not been paired yet. Wait for admin to start the game." });
    }

    await supabaseRequest("/rest/v1/coase_round_submissions", {
      method: "POST",
      queryParams: {
        on_conflict: "session_id,pair_id,player_id,round_key",
      },
      body: [{
        session_id: session.id,
        pair_id: pair.id,
        player_id: player.id,
        round_key: roundKey,
        submitted_emissions: emissions,
        submitted_payment_noncontroller_to_controller: payment,
        submitted_legal_fee_paid_by_a: roundKey === "round3" ? legalFeePaidByA : 0,
      }],
      prefer: "resolution=merge-duplicates,return=minimal",
      useServiceRole: true,
    });

    const submissions = await getRoundSubmissionsForSession(String(session.id));
    const pairRoundSubmissions = (submissions ?? []).filter((row) => (
      String(row.pair_id) === String(pair.id)
      && String(row.round_key) === roundKey
    ));

    const players = await getPlayersForSession(String(session.id));
    const adminProxyIds = adminProxyIdsFromPlayers(players);
    const resolution = await maybeResolvePairRound(roundKey, pair, pairRoundSubmissions, adminProxyIds);
    if (resolution.resolved) {
      await upsertRoundOutcome(String(session.id), pair, roundKey, resolution.outcome);
    } else {
      await deleteRoundOutcome(String(session.id), String(pair.id), roundKey);
    }

    return jsonResponse(200, {
      submitted: true,
      pair_submission_count: pairRoundSubmissions.length,
      resolved: resolution.resolved,
      outcome: resolution.outcome,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/player/submit-round",
};
