/**
 * Client du module de jeu — appelle les Edge Functions autoritatives et
 * s'abonne au flux Realtime redacté. Réf. docs/GAME-MODULE-V1.md §6, CdC §8.
 *
 * Le client n'a AUCUNE autorité : il propose une intention (DraftEvent) via
 * submitEvent, et reçoit en retour des events redactés (sa vue uniquement).
 */
import { supabase } from "./supabase";
import type { DraftEvent, PersistedEvent } from "@/game";
import type { Seat } from "@/game";

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
 * S'abonne au flux d'events redactés de la partie pour le siège donné.
 * Renvoie une fonction de désabonnement.
 */
export function subscribeToGame(
  gameId: string,
  onEvent: (event: PersistedEvent) => void,
): () => void {
  // Modèle « clients de confiance » : canal partagé, events complets.
  const channel = client()
    .channel(`game:${gameId}`)
    .on("broadcast", { event: "game_event" }, (msg) => {
      onEvent(msg.payload as PersistedEvent);
    })
    .subscribe();
  return () => {
    void client().removeChannel(channel);
  };
}
