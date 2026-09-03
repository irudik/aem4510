import {
  leaderboardRows,
  offersForPairRound,
  pendingOfferForPair,
} from "./_lib/coase_bargaining.mts";
import {
  getActiveSession,
  getOffersForSession,
  getPairsForSession,
  getPlayerByJoinToken,
  getPlayersForSession,
  getRoundOutcomesForSession,
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

    const [players, pairs, offers, outcomes] = await Promise.all([
      getPlayersForSession(String(session.id)),
      getPairsForSession(String(session.id)),
      getOffersForSession(String(session.id)),
      getRoundOutcomesForSession(String(session.id)),
    ]);

    const pair = pairForPlayer(pairs, String(player.id));
    const role = pair ? roleForPlayer(pair, String(player.id)) : null;
    const partner = pair ? partnerForPlayer(pair, players, String(player.id)) : null;
    const phase = String(session.current_phase ?? "");

    const playerNamesById = new Map(
      (players ?? []).map((row) => [String(row.id), String(row.player_name ?? "")]),
    );

    const pairOffers = (isRoundPhase(phase) && pair)
      ? offersForPairRound(offers, String(pair.id), phase).map((offer) => ({
        id: offer.id,
        offer_index: offer.offer_index,
        proposer_player_id: offer.proposer_player_id,
        proposer_name: playerNamesById.get(String(offer.proposer_player_id)) ?? "",
        proposer_is_self: String(offer.proposer_player_id) === String(player.id),
        offered_emissions: offer.offered_emissions,
        offered_payment_noncontroller_to_controller: offer.offered_payment_noncontroller_to_controller,
        offered_legal_fee_paid_by_a: offer.offered_legal_fee_paid_by_a,
        status: offer.status,
        created_at: offer.created_at,
        responded_at: offer.responded_at,
      }))
      : [];

    const pendingOffer = (isRoundPhase(phase) && pair)
      ? pendingOfferForPair(offers, String(pair.id), phase)
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
        round_seconds: session.round_seconds ?? null,
        phase_deadline_at: session.phase_deadline_at ?? null,
      },
      server_now: new Date().toISOString(),
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
      offers: pairOffers,
      pending_offer: pendingOffer
        ? {
          id: pendingOffer.id,
          proposer_player_id: pendingOffer.proposer_player_id,
          proposer_is_self: String(pendingOffer.proposer_player_id) === String(player.id),
          offered_emissions: pendingOffer.offered_emissions,
          offered_payment_noncontroller_to_controller: pendingOffer.offered_payment_noncontroller_to_controller,
          offered_legal_fee_paid_by_a: pendingOffer.offered_legal_fee_paid_by_a,
        }
        : null,
      current_outcome: currentOutcome,
      pair_outcomes: pairOutcomes,
      leaderboard: leaderboardRows(players, pairs, outcomes),
      progress: progressSummary(session, pairs, outcomes),
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/player/state",
};
