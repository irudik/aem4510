import {
  deadlinePassed,
  outcomeFromOffer,
  pendingOfferForPair,
} from "./_lib/coase_bargaining.mts";
import { statusQuoOutcome } from "./_lib/coase.mts";
import {
  getActiveSession,
  getOffersForSession,
  getPairsForSession,
  getPlayerByJoinToken,
  getRoundOutcomesForSession,
  isRoundPhase,
  pairForPlayer,
  updateOfferStatus,
  upsertRoundOutcome,
} from "./_lib/coase_game_service.mts";
import { jsonResponse, readJsonBody } from "./_lib/http.mts";

const VALID_ACTIONS = new Set(["accept", "reject", "walk_away"]);

export default async function coasePlayerRespond(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);

    const joinToken = String(body.join_token ?? "").trim();
    if (!joinToken) {
      return jsonResponse(400, { error: "join_token is required" });
    }

    const action = String(body.action ?? "").trim();
    if (!VALID_ACTIONS.has(action)) {
      return jsonResponse(400, { error: "action must be accept, reject, or walk_away" });
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

    const pairs = await getPairsForSession(String(session.id));
    const pair = pairForPlayer(pairs, String(player.id));
    if (!pair) {
      return jsonResponse(400, { error: "You have not been paired yet." });
    }

    const outcomes = await getRoundOutcomesForSession(String(session.id));
    const existingOutcome = (outcomes ?? []).find((row) => (
      String(row.pair_id) === String(pair.id)
      && String(row.round_key) === roundKey
    ));
    if (existingOutcome) {
      return jsonResponse(400, { error: "Your pair already settled this round." });
    }

    const offers = await getOffersForSession(String(session.id));
    const pendingOffer = pendingOfferForPair(offers, String(pair.id), roundKey);

    if (action === "walk_away") {
      // Walking away is final for the pair this round: the controller keeps
      // their preferred generator hours and no payment changes hands.
      if (pendingOffer) {
        await updateOfferStatus(String(pendingOffer.id), "superseded", String(player.id));
      }
      const outcome = statusQuoOutcome(roundKey);
      await upsertRoundOutcome(String(session.id), pair, roundKey, outcome, { noDeal: true });
      return jsonResponse(200, { resolved: true, no_deal: true, outcome });
    }

    if (!pendingOffer) {
      return jsonResponse(400, { error: "There is no pending offer to respond to." });
    }

    if (String(pendingOffer.proposer_player_id) === String(player.id)) {
      return jsonResponse(400, { error: "You cannot respond to your own offer. Wait for your partner, or send a new offer." });
    }

    if (action === "reject") {
      const rejectedOffer = await updateOfferStatus(String(pendingOffer.id), "rejected", String(player.id));
      return jsonResponse(200, { resolved: false, offer: rejectedOffer });
    }

    const acceptedOffer = await updateOfferStatus(String(pendingOffer.id), "accepted", String(player.id));
    const outcome = outcomeFromOffer(roundKey, acceptedOffer);
    await upsertRoundOutcome(String(session.id), pair, roundKey, outcome);

    return jsonResponse(200, { resolved: true, no_deal: false, offer: acceptedOffer, outcome });
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }
}

export const config = {
  path: "/api/coase/player/respond",
};
