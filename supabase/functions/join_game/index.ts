// Edge Function : join_game — rejoint un salon par code (siège B), puis lance
// la partie (mise en place autoritative). Réf. CdC §5.1 (FR-06..09), §4.4.
import { adminClient, getUserId } from "../_shared/auth.ts";
import { json, preflight } from "../_shared/cors.ts";
import { setupEvents } from "../../../src/game/engine/setup.ts";
import { sequence } from "../../../src/game/engine/verbs.ts";
import { resolveDraft } from "../../../src/game/engine/authority.ts";
import { deriveState } from "../../../src/game/engine/reducer.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  try {
    const uid = await getUserId(req);
    if (!uid) return json({ error: "UNAUTHENTICATED" }, 401);

    const { code, deck } = await req.json();
    if (!deck?.hero || !deck?.havreSac)
      return json({ error: "DECK_INVALIDE" }, 400);

    const db = adminClient();
    const { data: game } = await db
      .from("games")
      .select("id, status, seat_a, seat_b")
      .eq("code", code)
      .single();
    if (!game) return json({ error: "PARTIE_INTROUVABLE" }, 404);
    if (game.status !== "lobby")
      return json({ error: "PARTIE_DEJA_LANCEE" }, 409);
    if (game.seat_a === uid) return json({ error: "DEJA_SIEGE_A" }, 409);

    await db
      .from("game_players")
      .insert({ game_id: game.id, seat: "B", user_id: uid, deck });
    await db.from("games").update({ seat_b: uid }).eq("id", game.id);

    // ── Mise en place autoritative : tirage du premier joueur + GAME_STARTED + mélanges.
    const { data: players } = await db
      .from("game_players")
      .select("seat, deck")
      .eq("game_id", game.id);
    const decks = Object.fromEntries(
      (players ?? []).map((p) => [p.seat, p.deck]),
    );
    const first =
      crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0 ? "A" : "B";
    const { data: secret } = await db
      .from("game_secrets")
      .select("master_seed")
      .eq("game_id", game.id)
      .single();

    const drafts = setupEvents(game.id, decks, { firstPlayer: first });
    let parent = 0;
    let stateEvents: ReturnType<typeof sequence> = [];
    for (const draft of drafts) {
      const state = deriveState(stateEvents);
      const ev = resolveDraft(state, draft, {
        gameId: game.id,
        seq: parent + 1,
        ts: Date.now(),
        masterSeed: secret!.master_seed,
      });
      await db.rpc("append_event", {
        p_game_id: game.id,
        p_parent_seq: parent,
        p_actor: ev.actor,
        p_type: ev.type,
        p_payload: ev.payload,
        p_payload_private: ev.payloadPrivate ?? null,
      });
      stateEvents = [...stateEvents, ev];
      parent = ev.seq;
      // Modèle « clients de confiance » : diffusion de l'event COMPLET sur un
      // canal partagé (l'info cachée est respectée à l'affichage côté client).
      await db.channel(`game:${game.id}`).send({
        type: "broadcast",
        event: "game_event",
        payload: ev,
      });
    }
    await db
      .from("games")
      .update({ status: "active", first_player: first })
      .eq("id", game.id);

    return json({ gameId: game.id, firstPlayer: first });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
