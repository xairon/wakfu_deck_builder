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
