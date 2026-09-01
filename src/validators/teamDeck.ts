import type { Deck, Card } from "@/types/cards";
import { isUniqueCard } from "@/utils/cardRules";
import { canonicalKey } from "@/utils/cardIdentity";
import { validateDeck } from "./deck";

export interface TeamValidationResult {
  isValid: boolean;
  errors: string[];
  deck1Errors: string[];
  deck2Errors: string[];
}

/**
 * Compte les exemplaires de cartes Unique dans l'ensemble des decks d'une équipe.
 */
export function getTeamUniqueCardCopies(
  deck1: Deck,
  deck2: Deck,
): Map<string, { card: Card; count: number }> {
  const map = new Map<string, { card: Card; count: number }>();

  const processDeck = (deck: Deck) => {
    for (const item of deck.cards) {
      if (isUniqueCard(item.card)) {
        const key = canonicalKey(item.card);
        const current = map.get(key);
        if (current) {
          current.count += item.quantity;
        } else {
          map.set(key, { card: item.card, count: item.quantity });
        }
      }
    }
  };

  processDeck(deck1);
  processDeck(deck2);

  return map;
}

/**
 * Valide les decks d'une équipe en 2v2 :
 * 1. Chaque deck doit être légal individuellement (50 cartes, héros, havre-sac, copies <= 3).
 * 2. Règle d'unicité d'équipe : une carte « Unique » ne peut être présente qu'en 1 seul
 *    exemplaire au TOTAL sur l'ensemble des decks de l'équipe.
 */
export function validateTeamDecks(
  deck1: Deck,
  deck2: Deck,
): TeamValidationResult {
  const res1 = validateDeck(deck1);
  const res2 = validateDeck(deck2);

  const teamErrors: string[] = [];

  // Règle d'unicité d'équipe
  const uniqueCopies = getTeamUniqueCardCopies(deck1, deck2);
  for (const [, entry] of uniqueCopies) {
    if (entry.count > 1) {
      teamErrors.push(
        `La carte Unique "${entry.card.name}" est présente en ${entry.count} exemplaires au total dans l'équipe (1 seul autorisé pour toute l'équipe).`,
      );
    }
  }

  const allErrors = [
    ...res1.errors.map((e) => `[Joueur 1] ${e}`),
    ...res2.errors.map((e) => `[Joueur 2] ${e}`),
    ...teamErrors,
  ];

  return {
    isValid: res1.isValid && res2.isValid && teamErrors.length === 0,
    errors: allErrors,
    deck1Errors: res1.errors,
    deck2Errors: res2.errors,
  };
}
