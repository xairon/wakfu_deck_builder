/**
 * Client du module de jeu — appelle les Edge Functions autoritatives et
 * s'abonne au flux Realtime redacté. Réf. docs/GAME-MODULE-V1.md §6, CdC §8.
 *
 * Le client n'a AUCUNE autorité : il propose une intention (DraftEvent) via
 * submitEvent, et reçoit en retour des events redactés (sa vue uniquement).
 */
import { supabase } from "./supabase";
import type { DraftEvent, RedactedEvent } from "@/game";
import type { Seat } from "@/game";

/** Retire le journal redacté du siège appelant depuis `sinceSeq` (résolu côté serveur). */
export async function pullEvents(
  gameId: string,
  sinceSeq: number,
): Promise<RedactedEvent[]> {
  const { data, error } = await client().functions.invoke("pull_events", {
    body: { gameId, sinceSeq },
  });
  if (error) throw error;
  return (data as { events: RedactedEvent[] }).events ?? [];
}

/** Partie ACTIVE de l'utilisateur courant (pour reprise après refresh). */
export async function findMyActiveGame(): Promise<{
  gameId: string;
  seat: Seat;
} | null> {
  const c = client();
  const { data: auth } = await c.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await c
    .from("games")
    .select("id, seat_a, seat_b")
    .or(`seat_a.eq.${uid},seat_b.eq.${uid}`)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; seat_a: string; seat_b: string };
  return { gameId: row.id, seat: row.seat_a === uid ? "A" : "B" };
}

export interface CreateGameResult {
  gameId: string;
  code: string;
}
export interface JoinGameResult {
  gameId: string;
  firstPlayer: Seat;
}

function client() {
  if (!supabase) throw new Error("Supabase non configuré");
  return supabase;
}

/** Crée un salon 1v1 avec son deck (siège A). Renvoie le code partageable. */
export async function createGame(deck: unknown): Promise<CreateGameResult> {
  const { data, error } = await client().functions.invoke("create_game", {
    body: { deck },
  });
  if (error) throw error;
  return data as CreateGameResult;
}

/** Rejoint un salon par code avec son deck (siège B) ; lance la partie. */
export async function joinGame(
  code: string,
  deck: unknown,
): Promise<JoinGameResult> {
  const { data, error } = await client().functions.invoke("join_game", {
    body: { code, deck },
  });
  if (error) throw error;
  return data as JoinGameResult;
}

/**
 * Résout l'id de partie depuis un code de salon (`games` est lisible par tout
 * utilisateur authentifié). Indispensable côté siège B : il faut s'abonner au
 * flux `game:<id>:B` AVANT d'appeler joinGame, sinon on rate les events de
 * mise en place diffusés pendant joinGame (pas encore de pull_events).
 */
export async function findGameByCode(code: string): Promise<string | null> {
  const { data, error } = await client()
    .from("games")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Demande un mulligan : le serveur recycle la main, re-mélange (RNG serveur),
 * repioche (n-1) puis marque le siège prêt (MULLIGAN_DONE). Méta-intention
 * expansée serveur — pas un event persisté tel quel.
 */
export async function requestMulligan(gameId: string): Promise<void> {
  const { error } = await client().functions.invoke("submit_event", {
    body: { gameId, draft: { type: "MULLIGAN" } },
  });
  if (error) throw error;
}

/** Soumet une intention de coup ; le serveur tranche et renvoie le seq. */
export async function submitEvent(
  gameId: string,
  draft: DraftEvent,
): Promise<{ seq: number }> {
  const { data, error } = await client().functions.invoke("submit_event", {
    body: { gameId, draft },
  });
  if (error) throw error;
  return data as { seq: number };
}

/**
 * S'abonne au flux REDACTÉ du siège `seat` sur un canal PRIVÉ game:<id>:<seat>.
 * Renvoie une fonction de désabonnement.
 */
export function subscribeToGame(
  gameId: string,
  seat: Seat,
  onEvent: (event: RedactedEvent) => void,
): () => void {
  const channel = client()
    .channel(`game:${gameId}:${seat}`, { config: { private: true } })
    .on("broadcast", { event: "game_event" }, (msg) => {
      onEvent(msg.payload as RedactedEvent);
    })
    .subscribe((status) => {
      // Canal privé refusé (mauvais siège / autorisation Realtime) ou perdu :
      // on le signale (la reconnexion/resync complète est un lot P1).
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(
          `[gameClient] canal Realtime ${status} : game:${gameId}:${seat}`,
        );
      }
    });
  return () => {
    void client().removeChannel(channel);
  };
}
