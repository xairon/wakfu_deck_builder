/**
 * Empreinte stable d'un snapshot de deck publié. Sert à comparer le deck de
 * travail (local) à sa publication distante pour afficher « modifications en
 * attente » : identique → rien à re-publier ; différent → « Mettre à jour ».
 *
 * Pure et testable en isolation. Insensible à l'ordre des cartes ; sensible au
 * nom, au héros, au havre-sac, aux quantités et au drapeau réserve.
 */

/** Ligne de carte minimale suffisante pour l'empreinte. */
export interface SnapshotCard {
  cardId: string;
  quantity: number;
  isReserve?: boolean;
}

/** Forme minimale d'un deck (local ou distant) pour l'empreinte. */
export interface SnapshotInput {
  name: string;
  heroId: string | null;
  havreSacId: string | null;
  cards: SnapshotCard[];
}

/**
 * Empreinte déterministe. Les cartes sont normalisées (`cardId|R|quantity`) puis
 * triées, de sorte que deux decks identiques au réordonnancement près donnent la
 * même chaîne.
 */
export function publicationSnapshotHash(input: SnapshotInput): string {
  const cards = input.cards
    .map((c) => `${c.cardId}|${c.isReserve ? "R" : "M"}|${c.quantity}`)
    .sort()
    .join(",");
  return [
    `n:${input.name.trim()}`,
    `h:${input.heroId ?? ""}`,
    `s:${input.havreSacId ?? ""}`,
    `c:${cards}`,
  ].join("\n");
}
