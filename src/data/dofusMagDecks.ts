/**
 * Decks « idées de deck » WAKFU TCG extraits du magazine Dofus Mag.
 * Source de vérité : photos dans `dofus_mag_decks/` (hors git).
 * INVARIANT : chaque deck = exactement 48 cartes (hors héros + havre-sac).
 * Voir le rapport de matching : `docs/dofus-mag-matching-report.md`.
 */
import type { OfficialDeck } from "./officialDecks";

export const DOFUS_MAG_DECKS: OfficialDeck[] = [];
