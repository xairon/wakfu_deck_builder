// Helper Edge (Deno) : écriture ATOMIQUE d'un LOT d'events au journal (M3) +
// diffusion redactée par siège.
//
// Les coups multi-events (MULLIGAN, mise en place, END_TURN avec pioches/
// recyclage) étaient appendés un par un via `append_event` : un crash au milieu
// laissait un journal partiel. Ici on RÉSOUT tout le lot en mémoire, on l'append
// en UNE transaction (`append_events`), PUIS on diffuse. Si l'append échoue,
// aucun event n'est écrit (rollback) → journal toujours cohérent.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { redactEventForSeat } from "../../../src/game/engine/authority.ts";
import { deriveState } from "../../../src/game/engine/reducer.ts";
import type {
  DraftEvent,
  PersistedEvent,
} from "../../../src/game/types/events.ts";
import type { GameState } from "../../../src/game/types/state.ts";

/** Un event résolu + les états AVANT/APRÈS (pour la redaction de diffusion). */
export interface ResolvedEvent {
  ev: PersistedEvent;
  pre: GameState;
  post: GameState;
}

/**
 * Accumulateur de lot : résout chaque draft SÉQUENTIELLEMENT en mémoire (chaque
 * event dépend de l'état après le précédent — pioches, mélanges) SANS écrire en
 * base. `resolve` fournit l'event autoritatif (RNG serveur) via l'appelant.
 */
export function makeBatch(
  start: PersistedEvent[],
  resolve: (pre: GameState, draft: DraftEvent, seq: number) => PersistedEvent,
) {
  let working = start.slice();
  const resolved: ResolvedEvent[] = [];
  return {
    /** Résout un draft, l'accumule, et renvoie l'état APRÈS (pour le prochain). */
    add(draft: DraftEvent): GameState {
      const pre = deriveState(working);
      const ev = resolve(pre, draft, pre.seq + 1);
      working = [...working, ev];
      const post = deriveState(working);
      resolved.push({ ev, pre, post });
      return post;
    },
    /** État courant (dérivé) pour décider le prochain draft. */
    state(): GameState {
      return deriveState(working);
    },
    /** Journal courant complet (base + lot) — ex. pour un append terminal après. */
    events(): PersistedEvent[] {
      return working;
    },
    resolved,
  };
}

/**
 * Écrit tout le lot en UNE transaction (rollback si échec), puis diffuse chaque
 * event redacté aux deux sièges. `parentSeq` = seq AVANT le premier event du lot.
 * Lève sur échec d'append (le client resync depuis un journal COHÉRENT).
 */
export async function commitBatch(
  db: SupabaseClient,
  gameId: string,
  parentSeq: number,
  resolved: ResolvedEvent[],
): Promise<void> {
  if (!resolved.length) return;
  const { error } = await db.rpc("append_events", {
    p_game_id: gameId,
    p_parent_seq: parentSeq,
    p_events: resolved.map(({ ev }) => ({
      actor: ev.actor,
      type: ev.type,
      payload: ev.payload,
      payload_private: ev.payloadPrivate ?? null,
    })),
  });
  if (error) throw new Error(error.message);
  // Diffusion APRÈS commit : un échec de broadcast laisse le journal intact
  // (le client comblera le trou via resync).
  for (const { ev, pre, post } of resolved) {
    for (const seat of ["A", "B"] as const) {
      await db
        .channel(`game:${gameId}:${seat}`, { config: { private: true } })
        .send({
          type: "broadcast",
          event: "game_event",
          payload: redactEventForSeat(ev, seat, pre, post),
        });
    }
  }
}

/**
 * Récupère TOUS les événements d'une partie dans l'ordre, en paginant par lots
 * de 1000 pour dépasser le plafond PostgREST par défaut (max-rows = 1000).
 * Indispensable pour les longues parties avec de nombreux tours et coups.
 */
export async function fetchAllGameEvents(
  db: SupabaseClient,
  gameId: string,
): Promise<Record<string, unknown>[]> {
  const PAGE_SIZE = 1000;
  let from = 0;
  const allRows: Record<string, unknown>[] = [];
  while (true) {
    const { data, error } = await db
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .order("seq", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

