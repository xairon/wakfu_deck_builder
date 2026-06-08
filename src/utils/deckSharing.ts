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
  /** Cartes: tableau de [cardId, quantity] */
  c: [string, number][];
}

/**
 * Donnees decodees d'un deck partage
 */
export interface DecodedDeckData {
  name: string;
  heroId: string | null;
  havreSacId: string | null;
  cards: { cardId: string; quantity: number }[];
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
    c: deck.cards.map((dc) => [dc.card.id, dc.quantity]),
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
            entry.length === 2 &&
            typeof entry[0] === "string" &&
            typeof entry[1] === "number",
        )
        .map(([cardId, quantity]) => ({ cardId, quantity })),
    };
  } catch {
    return null;
  }
}

/**
 * Genere une URL complete de partage avec le deck encode en query param.
 */
export function generateShareUrl(deck: Deck): string {
  const encoded = encodeDeck(deck);
  return `${window.location.origin}/deck/share?deck=${encodeURIComponent(encoded)}`;
}

/**
 * Parse une URL de partage et retourne les donnees du deck.
 * Retourne null si le parsing echoue.
 */
export function parseShareUrl(url: string): DecodedDeckData | null {
  try {
    const urlObj = new URL(url);
    const deckParam = urlObj.searchParams.get("deck");
    if (!deckParam) return null;
    // URLSearchParams.get() already decodes the percent-encoding
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
