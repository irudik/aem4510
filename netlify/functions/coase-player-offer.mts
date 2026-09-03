import {
  deadlinePassed,
  offersForPairRound,
  outcomeFromOffer,
  validateOfferTerms,
} from "./_lib/coase_bargaining.mts";
import {
  getActiveSession,
  getOffersForSession,
  getPairsForSession,
  getPlayerByJoinToken,
  getPlayersForSession,
  getRoundOutcomesForSession,
  insertOfferSupersedingPending,
  isRoundPhase,
  pairForPlayer,
  partnerForPlayer,
  updateOfferStatus,
  upsertRoundOutcome,
} from "./_lib/coase_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

export default async function coasePlayerOffer(req) {
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
      return jsonResponse(400, { error: "A bargaining round is not currently open" });
    }

    if (deadlinePassed(session)) {
      return jsonResponse(400, { error: "Time is up for this round. No deal: status quo payoffs apply." });
    }

    const terms = validateOfferTerms(roundKey, body);

    const pairs = await getPairsForSession(String(session.id));
    const pair = pairForPlayer(pairs, String(player.id));
    if (!pair) {
      return jsonResponse(400, { error: "You have not been paired yet. Wait for the instructor to start the game." });
    }

    const outcomes = await getRoundOutcomesForSession(String(session.id));
    const existingOutcome = (outcomes ?? []).find((row) => (
      String(row.pair_id) === String(pair.id)
      && String(row.round_key) === roundKey
    ));
    if (existingOutcome) {
      return jsonResponse(400, { error: "Your pair already settled this round." });
    }

    const allOffers = await getOffersForSession(String(session.id));
    const pairOffers = offersForPairRound(allOffers, String(pair.id), roundKey);
    const nextOfferIndex = pairOffers.length + 1;

    const insertedOffer = await insertOfferSupersedingPending(
      String(session.id),
      pair,
      roundKey,
      String(player.id),
      terms,
      nextOfferIndex,
    );

    // Offers to the instructor proxy are accepted on the spot so an odd class
    // size never leaves one student stuck waiting.
    const players = await getPlayersForSession(String(session.id));
    const partner = partnerForPlayer(pair, players, String(player.id));
    let resolvedOutcome = null;

    if (partner?.is_admin_proxy) {
      const acceptedOffer = await updateOfferStatus(String(insertedOffer.id), "accepted", String(partner.id));
      resolvedOutcome = outcomeFromOffer(roundKey, acceptedOffer);
      await upsertRoundOutcome(String(session.id), pair, roundKey, resolvedOutcome);
    }

    return jsonResponse(200, {
      offer: insertedOffer,
      auto_accepted_by_proxy: Boolean(partner?.is_admin_proxy),
      resolved: Boolean(resolvedOutcome),
      outcome: resolvedOutcome,
    });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/player/offer",
};
