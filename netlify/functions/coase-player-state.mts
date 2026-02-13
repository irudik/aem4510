import {
  getActiveSession,
  getPairsForSession,
  getPlayerByJoinToken,
  getPlayersForSession,
  getRoundOutcomesForSession,
  getRoundSubmissionsForSession,
  isRoundPhase,
  pairForPlayer,
  partnerForPlayer,
  progressSummary,
  roleForPlayer,
  roundContext,
} from "./_lib/coase_game_service.mts";
import { jsonResponse } from "./_lib/http.mts";

export default async function coasePlayerState(req) {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const url = new URL(req.url);
    const joinToken = String(url.searchParams.get("join_token") ?? "").trim();

    if (!joinToken) {
      return jsonResponse(400, { error: "join_token is required" });
    }

    const player = await getPlayerByJoinToken(joinToken);
    if (!player) {
      return jsonResponse(404, { error: "Player token not found" });
    }

    const session = await getActiveSession();
    if (!session || session.id !== player.session_id) {
      return jsonResponse(404, { error: "Session is no longer active for this player" });
    }

    const [players, pairs, submissions, outcomes] = await Promise.all([
      getPlayersForSession(String(session.id)),
      getPairsForSession(String(session.id)),
      getRoundSubmissionsForSession(String(session.id)),
      getRoundOutcomesForSession(String(session.id)),
    ]);

    const pair = pairForPlayer(pairs, String(player.id));
    const role = pair ? roleForPlayer(pair, String(player.id)) : null;
    const partner = pair ? partnerForPlayer(pair, players, String(player.id)) : null;
    const phase = String(session.current_phase ?? "");

    const ownSubmission = (isRoundPhase(phase) && pair)
      ? (submissions ?? []).find((row) => (
        String(row.pair_id) === String(pair.id)
        && String(row.player_id) === String(player.id)
        && String(row.round_key) === phase
      )) ?? null
      : null;

    const partnerSubmission = (isRoundPhase(phase) && pair && partner)
      ? (submissions ?? []).find((row) => (
        String(row.pair_id) === String(pair.id)
        && String(row.player_id) === String(partner.id)
        && String(row.round_key) === phase
      )) ?? null
      : null;

    const currentOutcome = (isRoundPhase(phase) && pair)
      ? (outcomes ?? []).find((row) => (
        String(row.pair_id) === String(pair.id)
        && String(row.round_key) === phase
      )) ?? null
      : null;

    const pairOutcomes = pair
      ? (outcomes ?? [])
        .filter((row) => String(row.pair_id) === String(pair.id))
        .sort((left, right) => String(left.round_key).localeCompare(String(right.round_key)))
      : [];

    return jsonResponse(200, {
      session: {
        id: session.id,
        session_name: session.session_name,
        current_phase: session.current_phase,
        has_started: session.has_started,
      },
      round_context: roundContext(phase),
      player,
      pair: pair
        ? {
          id: pair.id,
          pair_number: pair.pair_number,
          role,
          partner_name: partner?.player_name ?? null,
          partner_is_admin_proxy: Boolean(partner?.is_admin_proxy),
        }
        : null,
      own_submission: ownSubmission,
      partner_submission: partnerSubmission
        ? {
          player_id: partnerSubmission.player_id,
          submitted_emissions: partnerSubmission.submitted_emissions,
          submitted_payment_noncontroller_to_controller: partnerSubmission.submitted_payment_noncontroller_to_controller,
          submitted_legal_fee_paid_by_a: partnerSubmission.submitted_legal_fee_paid_by_a,
          submitted_at: partnerSubmission.submitted_at,
          updated_at: partnerSubmission.updated_at,
        }
        : null,
      current_outcome: currentOutcome,
      pair_outcomes: pairOutcomes,
      progress: progressSummary(session, pairs, outcomes),
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/player/state",
};
