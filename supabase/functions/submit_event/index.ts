// Edge Function : submit_event — UNIQUE chemin d'écriture autoritatif (§6.3).
// 1. authentifie l'appelant → son siège ; 2. dérive l'état depuis le journal ;
// 3. calcule l'event autoritatif (RNG serveur, redaction) ; 4. append atomique ;
// 5. diffuse l'event REDACTÉ à chaque siège. Le client ne décide jamais le coup.
import { adminClient, getUserId } from "../_shared/auth.ts";
import { json, preflight } from "../_shared/cors.ts";
import { deriveState } from "../../../src/game/engine/reducer.ts";
import {
  resolveDraft,
  authorizeDraft,
  redactEventForSeat,
} from "../../../src/game/engine/authority.ts";
import { drawTop, recycleToPiocheTop } from "../../../src/game/engine/verbs.ts";
import { victoryFromState } from "../../../src/game/rules/victory.ts";
import { equalityRescueEvents } from "../../../src/game/rules/progress.ts";
import { resolveIntent } from "../../../src/game/actions/resolveIntent.ts";
import { loadCards } from "../_shared/cards.ts";
import { otherSeat } from "../../../src/game/types/zones.ts";
import type { Card, Deck } from "../../../src/types/cards.ts";
import type {
  PersistedEvent,
  DraftEvent,
} from "../../../src/game/types/events.ts";

/** Ids de cartes d'un deck (Héros + Havre-Sac + cartes) pour précharger getCard. */
function deckCardIds(deck: Deck | null): string[] {
  if (!deck) return [];
  const ids: string[] = [];
  if (deck.hero?.id) ids.push(deck.hero.id);
  if (deck.havreSac?.id) ids.push(deck.havreSac.id);
  for (const dc of deck.cards ?? []) if (dc?.card?.id) ids.push(dc.card.id);
  return ids;
}

function rowToEvent(r: Record<string, unknown>): PersistedEvent {
  return {
    gameId: r.game_id as string,
    seq: r.seq as number,
    parentSeq: r.parent_seq as number,
    actor: r.actor as PersistedEvent["actor"],
    type: r.type as PersistedEvent["type"],
    payload: r.payload,
    payloadPrivate:
      (r.payload_private as PersistedEvent["payloadPrivate"]) ?? undefined,
    ts: 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  try {
    const uid = await getUserId(req);
    if (!uid) return json({ error: "UNAUTHENTICATED" }, 401);

    const { gameId, draft, intent } = await req.json();
    const db = adminClient();

    // Siège de l'appelant (sécurité : l'acteur est imposé par le serveur).
    const { data: me } = await db
      .from("game_players")
      .select("seat")
      .eq("game_id", gameId)
      .eq("user_id", uid)
      .single();
    if (!me) return json({ error: "PAS_JOUEUR_DE_CETTE_PARTIE" }, 403);

    const { data: game } = await db
      .from("games")
      .select("last_seq, status, updated_at")
      .eq("id", gameId)
      .single();
    if (!game || game.status !== "active")
      return json({ error: "PARTIE_INACTIVE" }, 409);

    const { data: secret } = await db
      .from("game_secrets")
      .select("master_seed")
      .eq("game_id", gameId)
      .single();
    const { data: rows } = await db
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .order("seq", { ascending: true });

    // On garde le tableau d'events mappé pour que la mémoïsation de deriveState
    // reconnaisse `post` comme une extension de `state` (sinon re-dérivation O(N)).
    const rowEvents = (rows ?? []).map(rowToEvent);
    const state = deriveState(rowEvents);

    // Partie déjà terminée : aucun event ne peut plus être appendé. La garde
    // `status !== 'active'` plus haut couvre le cas où `games.status` est passé à
    // 'finished' ; ce garde-fou complémentaire bloque sur le journal lui-même.
    if (rowEvents.some((e) => e.type === "GAME_OVER"))
      return json({ error: "PARTIE_TERMINEE" }, 409);

    // Termine la partie : append système GAME_OVER (résolu + diffusé redacté par
    // siège, comme `appendOne`) puis bascule la ligne `games` en 'finished'.
    // `baseEvents` = journal courant ; il inclut l'event joueur qui vient d'être
    // appendé dans le cas auto-victoire (sinon `parentSeq` serait obsolète).
    const finishGame = async (
      winner: "A" | "B" | "draw",
      reason: "concede" | "defeat" | "disconnect",
      baseEvents: PersistedEvent[] = rowEvents,
    ): Promise<void> => {
      const pre = deriveState(baseEvents);
      const draftOver: DraftEvent = {
        actor: "system",
        type: "GAME_OVER",
        payload: { winner, reason },
      };
      const ev = resolveDraft(pre, draftOver, {
        gameId,
        seq: pre.seq + 1,
        ts: Date.now(),
        masterSeed: secret!.master_seed,
      });
      const { error } = await db.rpc("append_event", {
        p_game_id: gameId,
        p_parent_seq: pre.seq,
        p_actor: ev.actor,
        p_type: ev.type,
        p_payload: ev.payload,
        p_payload_private: ev.payloadPrivate ?? null,
      });
      if (error) throw new Error(error.message);
      const post = deriveState([...baseEvents, ev]);
      for (const s of ["A", "B"] as const) {
        await db
          .channel(`game:${gameId}:${s}`, { config: { private: true } })
          .send({
            type: "broadcast",
            event: "game_event",
            payload: redactEventForSeat(ev, s, pre, post),
          });
      }
      await db
        .from("games")
        .update({ status: "finished", winner, end_reason: reason })
        .eq("id", gameId);
    };

    // Meta-intent CONCEDE : le siège abandonne → l'adversaire gagne.
    if ((draft as { type?: string })?.type === "CONCEDE") {
      await finishGame(otherSeat(me.seat as "A" | "B"), "concede");
      return json({ ok: true });
    }

    // Meta-intent CLAIM_VICTORY : réclamation après déconnexion adverse. Garde
    // SERVEUR (proxy de présence) : on n'autorise la réclamation que si la partie
    // est INACTIVE depuis ≥ la fenêtre de grâce — `games.updated_at` est posé par
    // append_event à chaque coup, donc un event récent = quelqu'un a agi → refus.
    // Le gate client seul (fenêtre de grâce) ne suffit pas : un client trafiqué
    // pourrait forger une victoire instantanée. Combiné, c'est robuste.
    if ((draft as { type?: string })?.type === "CLAIM_VICTORY") {
      const CLAIM_IDLE_MS = 5 * 60 * 1000;
      const lastTs = Date.parse(
        (game as { updated_at?: string }).updated_at ?? "",
      );
      if (!Number.isNaN(lastTs) && Date.now() - lastTs < CLAIM_IDLE_MS)
        return json({ error: "ADVERSAIRE_ENCORE_ACTIF" }, 409);
      await finishGame(me.seat as "A" | "B", "disconnect");
      return json({ ok: true });
    }

    // Meta-intent MULLIGAN : recycle la main → mélange (RNG serveur) → repioche
    // (n-1). Expansé côté serveur en une suite d'events appendés un par un (comme
    // la mise en place de join_game), diffusés redactés. Le mulligan est
    // RÉPÉTABLE : il ne marque PLUS MULLIGAN_DONE (le siège valide sa main via le
    // chemin MULLIGAN_DONE distinct). Un échec en cours est rejouable — le client
    // resync (lot fiabilité).
    if ((draft as { type?: string })?.type === "MULLIGAN") {
      const seat = me.seat as "A" | "B";
      const already = rowEvents.some(
        (e) =>
          e.type === "MULLIGAN_DONE" &&
          (e.payload as { seat?: string }).seat === seat,
      );
      if (already) return json({ error: "MULLIGAN_DEJA_FAIT" }, 409);

      let working = rowEvents.slice();
      const hand = [...deriveState(working).seats[seat].main];

      const appendOne = async (d: DraftEvent): Promise<void> => {
        const pre = deriveState(working);
        const ev = resolveDraft(pre, d, {
          gameId,
          seq: pre.seq + 1,
          ts: Date.now(),
          masterSeed: secret!.master_seed,
        });
        const { error } = await db.rpc("append_event", {
          p_game_id: gameId,
          p_parent_seq: pre.seq,
          p_actor: ev.actor,
          p_type: ev.type,
          p_payload: ev.payload,
          p_payload_private: ev.payloadPrivate ?? null,
        });
        if (error) throw new Error(error.message);
        working = [...working, ev];
        const post = deriveState(working);
        for (const s of ["A", "B"] as const) {
          await db
            .channel(`game:${gameId}:${s}`, { config: { private: true } })
            .send({
              type: "broadcast",
              event: "game_event",
              payload: redactEventForSeat(ev, s, pre, post),
            });
        }
      };

      try {
        for (const id of hand) await appendOne(recycleToPiocheTop(seat, id));
        await appendOne({
          actor: seat,
          type: "SHUFFLE",
          payload: { zone: { zone: "pioche", owner: seat }, permutation: [] },
        });
        const redraw = Math.max(0, hand.length - 1);
        for (let i = 0; i < redraw; i++) {
          await appendOne(drawTop(deriveState(working), seat));
        }
      } catch (e) {
        return json({ error: String(e) }, 409); // partiel → le client resync
      }
      return json({ ok: true });
    }

    // ── Nouveau contrat : intention de HAUT NIVEAU (résolue + validée serveur).
    // Le serveur est l'AUTORITÉ : `resolveIntent` valide tour → légalité → coût et
    // renvoie les events autoritatifs (ou une erreur 403). On précharge les cartes
    // des deux decks (Héros + Havre-Sac + cartes) pour `getCard`. Les events sont
    // appendés un par un + diffusés redactés (même boucle que le MULLIGAN) ; un
    // éventuel `draws` (END_TURN) est résolu en re-dérivant l'état entre chaque
    // pioche (le sommet de la Pioche change à chacune).
    if (intent) {
      const { data: players } = await db
        .from("game_players")
        .select("deck")
        .eq("game_id", gameId);
      const ids = (players ?? []).flatMap((p) => deckCardIds(p.deck as Deck));
      const cardMap = await loadCards(db, ids);
      const getCard = (id: string | null): Card | null =>
        id ? (cardMap.get(id) ?? null) : null;

      const res = resolveIntent(state, getCard, intent, me.seat as "A" | "B");
      if ("error" in res) return json({ error: res.error }, 403);

      let working = rowEvents.slice();
      const appendOne = async (d: DraftEvent): Promise<void> => {
        const pre = deriveState(working);
        const ev = resolveDraft(pre, d, {
          gameId,
          seq: pre.seq + 1,
          ts: Date.now(),
          masterSeed: secret!.master_seed,
        });
        const { error } = await db.rpc("append_event", {
          p_game_id: gameId,
          p_parent_seq: pre.seq,
          p_actor: ev.actor,
          p_type: ev.type,
          p_payload: ev.payload,
          p_payload_private: ev.payloadPrivate ?? null,
        });
        if (error) throw new Error(error.message);
        working = [...working, ev];
        const post = deriveState(working);
        for (const s of ["A", "B"] as const) {
          await db
            .channel(`game:${gameId}:${s}`, { config: { private: true } })
            .send({
              type: "broadcast",
              event: "game_event",
              payload: redactEventForSeat(ev, s, pre, post),
            });
        }
      };

      try {
        for (const d of res.events) await appendOne(d);
        if ("draws" in res && res.draws)
          for (let i = 0; i < res.draws; i++)
            await appendOne(
              drawTop(deriveState(working), me.seat as "A" | "B"),
            );
        // 103.3 — sauvetage d'égalité : si l'état résultant (typiquement après un
        // RESOLVE_COMBAT) a les DEUX Héros à ≤ 0 PV (K.O. simultané), on les
        // ramène à 1 PV via des events JOURNALISÉS, AVANT de tester la victoire.
        // Le serveur fait autorité (le client ne dispatch plus rien en ligne).
        const rescue = equalityRescueEvents({
          state: deriveState(working),
          getCard,
        });
        for (const d of rescue) await appendOne(d);
      } catch (e) {
        return json({ error: String(e) }, 409); // partiel → le client resync
      }
      // Auto-victoire : l'état résultant de l'intention peut satisfaire une
      // condition de victoire (PV adverses ≤ 0 ou Niveau 3). Comme le chemin
      // legacy, on clôt alors la partie (GAME_OVER terminal + write 'finished').
      const postIntent = deriveState(working);
      const wIntent = victoryFromState({ state: postIntent } as never);
      if (wIntent && !working.some((e) => e.type === "GAME_OVER"))
        await finishGame(wIntent, "defeat", working);
      return json({ ok: true });
    }

    // Autorisation serveur (table libre : on bloque seulement l'accès aux zones
    // privées adverses + le peeking). L'acteur est imposé par le serveur.
    try {
      authorizeDraft(state, { ...draft, actor: me.seat });
    } catch (e) {
      return json({ error: (e as Error).message || "FORBIDDEN" }, 403);
    }

    // L'acteur est FORCÉ au siège authentifié (on ne fait pas confiance au client).
    const ev = resolveDraft(
      state,
      { ...draft, actor: me.seat },
      {
        gameId,
        seq: state.seq + 1,
        ts: Date.now(),
        masterSeed: secret!.master_seed,
      },
    );

    const { error: appendErr } = await db.rpc("append_event", {
      p_game_id: gameId,
      p_parent_seq: state.seq,
      p_actor: ev.actor,
      p_type: ev.type,
      p_payload: ev.payload,
      p_payload_private: ev.payloadPrivate ?? null,
    });
    if (appendErr) return json({ error: appendErr.message }, 409); // OUT_OF_ORDER → resync client

    // Diffusion REDACTÉE par siège, sur des canaux privés distincts.
    const post = deriveState([...rowEvents, ev]);
    for (const seat of ["A", "B"] as const) {
      // Canal PRIVÉ : le client s'abonne avec { private: true } ; l'émetteur doit
      // l'être aussi, sinon le message part sur le topic public et n'est pas reçu.
      await db
        .channel(`game:${gameId}:${seat}`, {
          config: { private: true },
        })
        .send({
          type: "broadcast",
          event: "game_event",
          payload: redactEventForSeat(ev, seat, state, post),
        });
    }

    // Auto-victoire : si l'état post-event satisfait une condition de victoire
    // (PV adverses ≤ 0 ou Niveau 3), on clôt automatiquement la partie. Le test
    // `!rowEvents.some(... GAME_OVER)` est redondant avec le garde-fou d'entrée
    // mais protège d'une éventuelle course (défense en profondeur).
    const w = victoryFromState({ state: post } as never);
    if (w && !rowEvents.some((e) => e.type === "GAME_OVER"))
      await finishGame(w, "defeat", [...rowEvents, ev]);

    return json({ seq: ev.seq });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
