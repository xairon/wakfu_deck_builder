// Edge Function : join_game — rejoint un salon par code (siège B), puis lance
// la partie (mise en place autoritative). Réf. CdC §5.1 (FR-06..09), §4.4.
import { adminClient, getUserId } from "../_shared/auth.ts";
import { json, preflight } from "../_shared/cors.ts";
import { setupEvents } from "../../../src/game/engine/setup.ts";
import { drawTop } from "../../../src/game/engine/verbs.ts";
import { resolveDraft } from "../../../src/game/engine/authority.ts";
import { reconcileAndValidateDeck } from "../_shared/deck.ts";
import { makeBatch, commitBatch } from "../_shared/journal.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  try {
    const uid = await getUserId(req);
    if (!uid) return json({ error: "UNAUTHENTICATED" }, 401);

    const { code, deck: rawDeck } = await req.json();

    const db = adminClient();
    // RÉCONCILIATION + VALIDATION autoritative (C1/M2), cf. create_game : stats de
    // confiance (anti-forge PV/PA/PM/Résistance) + légalité (48/réserve/types/
    // copies). Le deck RÉCONCILIÉ est stocké et alimente setupEvents.
    const rec = await reconcileAndValidateDeck(db, rawDeck);
    if (!rec.ok || !rec.deck) return json({ error: rec.error }, 400);
    const deck = rec.deck;
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

    // Mise en place ATOMIQUE (M3) : setup + mains de départ résolus en mémoire,
    // appendés en UNE transaction (parent_seq 0 → OUT_OF_ORDER si un setup
    // concurrent a déjà écrit). Fini le journal à moitié posé / status incohérent.
    const batch = makeBatch([], (pre, d, seq) =>
      resolveDraft(pre, d, {
        gameId: game.id,
        seq,
        ts: Date.now(),
        masterSeed: secret!.master_seed,
      }),
    );
    try {
      for (const draft of setupEvents(game.id, decks, { firstPlayer: first }))
        batch.add(draft);
      // Main de départ : PA initiale du Héros par siège (4873 ; PA dérivée du
      // compteur réel, non figée). Chaque tirage = MOVE Pioche→Main révélé au seul
      // propriétaire (redaction par siège).
      for (const seat of ["A", "B"] as const) {
        const st = batch.state();
        const heroId = st.seats[seat].heroInstanceId;
        const hero = heroId ? st.instances[heroId] : null;
        const openingHand = Math.max(0, hero?.counters.pa ?? 6);
        for (let i = 0; i < openingHand; i++)
          batch.add({ ...drawTop(batch.state(), seat), actor: "system" });
      }
      await commitBatch(db, game.id, 0, batch.resolved);
    } catch (e) {
      // Échec (double-join concurrent → OUT_OF_ORDER, ou erreur) : rollback total,
      // aucun event partiel, status reste 'lobby'. Le client retentera / resync.
      return json({ error: String(e) }, 409);
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
