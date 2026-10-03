import type { Deck } from "@/types/cards";

/**
 * Structure minimale pour l'encodage d'un deck partageable
 */
export interface EncodedDeckPayload {
  /** Nom du deck */
  n: string;
  /** ID du heros */
  h: string | null;
  /** ID du havre-sac */
  s: string | null;
  /** Cartes: tableau de [cardId, quantity] ou [cardId, quantity, 1] pour la réserve */
  c: ([string, number] | [string, number, 0 | 1])[];
}

/**
 * Donnees decodees d'un deck partage
 */
export interface DecodedDeckData {
  name: string;
  heroId: string | null;
  havreSacId: string | null;
  cards: { cardId: string; quantity: number; isReserve?: boolean }[];
}

/**
 * Encode un deck en une chaine compacte partageable.
 * Extrait les IDs et quantites, JSON-stringify puis base64 encode.
 */
export function encodeDeck(deck: Deck): string {
  const payload: EncodedDeckPayload = {
    n: deck.name,
    h: deck.hero?.id ?? null,
    s: deck.havreSac?.id ?? null,
    c: deck.cards.map((dc) =>
      dc.isReserve ? [dc.card.id, dc.quantity, 1] : [dc.card.id, dc.quantity],
    ),
  };

  const jsonStr = JSON.stringify(payload);
  // Encoder en base64 compatible UTF-8
  const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
  return encoded;
}

/**
 * Decode une chaine encodee en donnees de deck.
 * Retourne null si le decodage echoue.
 */
export function decodeDeck(encoded: string): DecodedDeckData | null {
  try {
    const jsonStr = decodeURIComponent(escape(atob(encoded)));
    const payload: EncodedDeckPayload = JSON.parse(jsonStr);

    // Validation basique de la structure
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.n !== "string") return null;
    if (!Array.isArray(payload.c)) return null;

    return {
      name: payload.n,
      heroId: payload.h ?? null,
      havreSacId: payload.s ?? null,
      cards: payload.c
        .filter(
          (entry) =>
            Array.isArray(entry) &&
            (entry.length === 2 ||
              (entry.length === 3 && (entry[2] === 0 || entry[2] === 1))) &&
            typeof entry[0] === "string" &&
            typeof entry[1] === "number",
        )
        .map((entry) => ({
          cardId: entry[0] as string,
          quantity: entry[1] as number,
          ...(entry[2] === 1 ? { isReserve: true } : {}),
        })),
    };
  } catch {
    return null;
  }
}

import { supabase } from "@/services/supabase";

/**
 * Génère un identifiant court aléatoire (8 caractères).
 */
export function generateShortId(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Enregistre le deck dans Supabase (table deck_shares) et renvoie son ID court.
 * En cas d'échec ou d'absence de Supabase, renvoie null.
 */
export async function createDeckShare(deck: Deck): Promise<string | null> {
  if (!supabase) return null;
  const id = generateShortId();
  const payload = {
    id,
    name: deck.name,
    hero_id: deck.hero?.id ?? null,
    havre_sac_id: deck.havreSac?.id ?? null,
    cards: deck.cards.map((dc) => ({
      cardId: dc.card.id,
      quantity: dc.quantity,
      ...(dc.isReserve ? { isReserve: true } : {}),
    })),
  };

  const { error } = await supabase.from("deck_shares").insert(payload);
  if (error) {
    console.error("Erreur lors de la création du partage de deck:", error);
    return null;
  }
  return id;
}

/**
 * Récupère un deck partagé depuis Supabase par son ID court.
 */
export async function fetchDeckShare(id: string): Promise<DecodedDeckData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("deck_shares")
    .select("name, hero_id, havre_sac_id, cards")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const rawCards = Array.isArray(data.cards) ? data.cards : [];
  return {
    name: data.name,
    heroId: data.hero_id ?? null,
    havreSacId: data.havre_sac_id ?? null,
    cards: rawCards.map((c: any) => ({
      cardId: c.cardId,
      quantity: c.quantity,
      ...(c.isReserve ? { isReserve: true } : {}),
    })),
  };
}

/**
 * Génère l'URL de partage optimisée pour Discord et compacte.
 * Utilise la passerelle Edge Function pour les métadonnées OpenGraph (rich embeds sur Discord)
 * qui redirige ensuite automatiquement vers la vue du deck.
 */
export function buildShortShareUrl(id: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1/share_preview?id=${encodeURIComponent(id)}`;
  }
  return `${window.location.origin}/deck/share?id=${encodeURIComponent(id)}`;
}

/**
 * Génère une URL de partage pour un deck.
 * Tente d'abord de créer un partage court (Edge Function + Discord Embed).
 * Si indisponible ou en échec, repli transparent sur l'URL avec deck encodé en base64.
 */
export async function generateShareUrlAsync(deck: Deck): Promise<string> {
  try {
    const shareId = await createDeckShare(deck);
    if (shareId) {
      return buildShortShareUrl(shareId);
    }
  } catch (err) {
    console.warn("Échec génération lien court, repli URL base64:", err);
  }
  return generateShareUrl(deck);
}

/**
 * Genere une URL complete de partage avec le deck encode en query param (synchrone / offline).
 */
export function generateShareUrl(deck: Deck): string {
  const encoded = encodeDeck(deck);
  return `${window.location.origin}/deck/share?deck=${encodeURIComponent(encoded)}`;
}

/**
 * Parse une URL de partage et retourne les donnees du deck (synchrone pour le paramètre 'deck').
 * Retourne null si le parsing echoue.
 */
export function parseShareUrl(url: string): DecodedDeckData | null {
  try {
    const urlObj = new URL(url);
    const deckParam = urlObj.searchParams.get("deck");
    if (!deckParam) return null;
    return decodeDeck(deckParam);
  } catch {
    // Fallback: essayer de parser juste le parametre
    try {
      const params = new URLSearchParams(url.split("?")[1] || "");
      const deckParam = params.get("deck");
      if (!deckParam) return null;
      return decodeDeck(deckParam);
    } catch {
      return null;
    }
  }
}

