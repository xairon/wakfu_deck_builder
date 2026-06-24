// Edge Function : join_game — rejoint un salon par code (siège B), puis lance
// la partie (mise en place autoritative). Réf. CdC §5.1 (FR-06..09), §4.4.
import { adminClient, getUserId } from "../_shared/auth.ts";
import { json, preflight } from "../_shared/cors.ts";
import { setupEvents } from "../../../src/game/engine/setup.ts";
import { sequence, drawTop } from "../../../src/game/engine/verbs.ts";
import {
  resolveDraft,
  redactEventForSeat,
} from "../../../src/game/engine/authority.ts";
import { deriveState } from "../../../src/game/engine/reducer.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  try {
    const uid = await getUserId(req);
    if (!uid) return json({ error: "UNAUTHENTICATED" }, 401);

    const { code, deck } = await req.json();
    if (!deck?.hero || !deck?.havreSac)
      return json({ error: "DECK_INVALIDE" }, 400);
    // Garde-fou : la main de départ pioche 6 cartes par siège ; un deck dont la
    // Pioche (cartes hors Réserve) compte < 6 cartes ferait planter setup
    // (PIOCHE_VIDE). Le client valide déjà 48 cartes ; ceci protège l'API.
    const entries =
      (deck.cards as
        | { quantity?: number; isReserve?: boolean }[]
        | undefined) ?? [];
    const piocheCount = entries.reduce(
      (s, c) => s + (c?.isReserve ? 0 : (c?.quantity ?? 0)),
      0,
    );
    if (piocheCount < 6) return json({ error: "DECK_TROP_PETIT" }, 400);
    // Borne HAUTE (anti-DoS), cf. create_game.
    const totalQty = entries.reduce((s, c) => s + (c?.quantity ?? 0), 0);
    if (entries.length > 120 || totalQty > 200)
      return json({ error: "DECK_TROP_GROS" }, 400);

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

    // Prise de siège ATOMIQUE (anti-course double-join) : un UPDATE conditionnel
    // (status='lobby' ET seat_b NULL) — un seul appel concurrent gagne la ligne ;
    // les autres voient 0 ligne → 409. Remplace l'ancien insert-puis-update non
    // transactionnel (deux joins simultanés passaient tous deux les pré-checks).
    const { data: claimed } = await db
      .from("games")
      .update({ seat_b: uid })
      .eq("id", game.id)
      .eq("status", "lobby")
      .is("seat_b", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return json({ error: "PARTIE_DEJA_LANCEE" }, 409);

    // Le gagnant de la prise est l'unique siège B → l'insert ne peut pas entrer
    // en conflit de PK (game_id,'B'). On vérifie quand même l'erreur.
    const { error: gpErr } = await db
      .from("game_players")
      .insert({ game_id: game.id, seat: "B", user_id: uid, deck });
    if (gpErr) {
      console.error("join_game insert game_players", gpErr);
      return json({ error: "PLACE_DEJA_PRISE" }, 409);
    }

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
      const { error: appendErr } = await db.rpc("append_event", {
        p_game_id: game.id,
        p_parent_seq: parent,
        p_actor: ev.actor,
        p_type: ev.type,
        p_payload: ev.payload,
        p_payload_private: ev.payloadPrivate ?? null,
      });
      // Échec d'append (ex. double-join concurrent → OUT_OF_ORDER) : on AVORTE
      // au lieu de continuer sur un état corrompu (sinon broadcasts + status
      // 'active' incohérents). L'atomicité fine du join reste un lot P1.
      if (appendErr) return json({ error: appendErr.message }, 409);
      stateEvents = [...stateEvents, ev];
      parent = ev.seq;
      // Diffusion REDACTÉE par siège, sur des canaux privés distincts.
      const post = deriveState(stateEvents);
      for (const seat of ["A", "B"] as const) {
        // Canal PRIVÉ (cf. submit_event) : l'émetteur doit aussi être privé.
        await db
          .channel(`game:${game.id}:${seat}`, {
            config: { private: true },
          })
          .send({
            type: "broadcast",
            event: "game_event",
            payload: redactEventForSeat(ev, seat, state, post),
          });
      }
    }
    // ── Main de départ : PA initiale du Héros par siège (4873 ; = paOf côté
    // client). On la DÉRIVE du compteur pa réel (setup lit la PA imprimée du
    // Héros) plutôt qu'une constante 6, pour rester en parité avec le jeu local
    // et tout Héros non standard. Chaque tirage est un MOVE Pioche→Main révélé au
    // SEUL propriétaire (la redaction par siège masque le cardId à l'autre).
    for (const seat of ["A", "B"] as const) {
      const setupState = deriveState(stateEvents);
      const heroId = setupState.seats[seat].heroInstanceId;
      const hero = heroId ? setupState.instances[heroId] : null;
      const openingHand = Math.max(0, hero?.counters.pa ?? 6);
      for (let i = 0; i < openingHand; i++) {
        const state = deriveState(stateEvents);
        const ev = resolveDraft(
          state,
          { ...drawTop(state, seat), actor: "system" },
          {
            gameId: game.id,
            seq: parent + 1,
            ts: Date.now(),
            masterSeed: secret!.master_seed,
          },
        );
        const { error: appendErr } = await db.rpc("append_event", {
          p_game_id: game.id,
          p_parent_seq: parent,
          p_actor: ev.actor,
          p_type: ev.type,
          p_payload: ev.payload,
          p_payload_private: ev.payloadPrivate ?? null,
        });
        if (appendErr) return json({ error: appendErr.message }, 409);
        stateEvents = [...stateEvents, ev];
        parent = ev.seq;
        const post = deriveState(stateEvents);
        for (const s of ["A", "B"] as const) {
          await db
            .channel(`game:${game.id}:${s}`, { config: { private: true } })
            .send({
              type: "broadcast",
              event: "game_event",
              payload: redactEventForSeat(ev, s, state, post),
            });
        }
      }
    }

    await db
      .from("games")
      .update({ status: "active", first_player: first })
      .eq("id", game.id);

    return json({ gameId: game.id, firstPlayer: first });
  } catch (e) {
    console.error("join_game", e);
    return json({ error: "ERREUR_SERVEUR" }, 500);
  }
});
