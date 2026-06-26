import type { Deck, Card } from "@/types/cards";
import { ValidationError } from "@/utils/errors";
import { isUniqueCard } from "@/utils/cardRules";
import { canonicalKey } from "@/utils/cardIdentity";

// Règles officielles du Wakfu TCG (paquet construit) — wtcg-return.fr/regles/completes.
// 101.1 : 50 cartes au total = 1 Héros + 1 Havre-Sac + 48 autres.
// 101.4 : la réserve doit contenir exactement 0 ou 12 cartes.
// 101.5 : 3 exemplaires max par carte (1 pour les cartes « Unique »),
//         répartis entre paquet de base et réserve.
export const DECK_RULES = {
  MIN_CARDS: 48,
  MAX_CARDS: 48,
  TOTAL_CARDS: 50,
  MAX_COPIES: 3,
  // Taille EXACTE imposée à la réserve (0 ou cette valeur), pas un simple plafond.
  RESERVE_SIZE: 12,
} as const;

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Compte le nombre total de cartes dans le deck principal (hors réserve)
 */
export function getTotalCards(deck: Deck): number {
  return deck.cards
    .filter((c) => !c.isReserve)
    .reduce((total, card) => total + card.quantity, 0);
}

/**
 * Compte le nombre total de cartes dans la réserve
 */
export function getReserveCards(deck: Deck): number {
  return deck.cards
    .filter((c) => c.isReserve)
    .reduce((total, card) => total + card.quantity, 0);
}

/**
 * Compte les copies d'une carte dans le deck, TOUTES ÉDITIONS confondues
 * (regroupement canonique par nom). Inclut la réserve (pas de filtre isReserve).
 */
export function getCardCopies(deck: Deck, card: Card): number {
  const key = canonicalKey(card);
  return deck.cards
    .filter((c) => canonicalKey(c.card) === key)
    .reduce((total, c) => total + c.quantity, 0);
}

/**
 * Vérifie si une carte peut être ajoutée au deck
 */
export function canAddCard(deck: Deck, card: Card, isReserve = false): boolean {
  const currentCopies = getCardCopies(deck, card);
  const maxCopies = isUniqueCard(card) ? 1 : DECK_RULES.MAX_COPIES;

  if (currentCopies >= maxCopies) {
    return false;
  }

  if (isReserve) {
    const reserveCards = getReserveCards(deck);
    return reserveCards < DECK_RULES.RESERVE_SIZE;
  } else {
    const totalCards = getTotalCards(deck);
    return totalCards < DECK_RULES.MAX_CARDS;
  }
}

/**
 * Valide le héros et le havre-sac
 */
function validateHeroAndHavreSac(deck: Deck, errors: string[]): boolean {
  let isValid = true;

  if (!deck.hero) {
    errors.push("Le deck doit avoir un héros");
    isValid = false;
  } else if (deck.hero.mainType !== "Héros") {
    // 102.1 — la case Héros n'accepte qu'une carte Héros (un import/lien forgé
    // pourrait y placer un autre type).
    errors.push("La carte Héros doit être de type « Héros »");
    isValid = false;
  }

  if (!deck.havreSac) {
    errors.push("Le deck doit avoir un havre-sac");
    isValid = false;
  } else if (deck.havreSac.mainType !== "Havre-Sac") {
    errors.push("La carte Havre-Sac doit être de type « Havre-Sac »");
    isValid = false;
  }

  return isValid;
}

/**
 * Valide le nombre total de cartes dans le deck
 */
function validateCardCount(deck: Deck, errors: string[]): boolean {
  const totalCards = getTotalCards(deck);

  if (totalCards < DECK_RULES.MIN_CARDS) {
    errors.push(
      `Le deck principal doit contenir au moins ${DECK_RULES.MIN_CARDS} cartes`,
    );
    return false;
  }

  if (totalCards > DECK_RULES.MAX_CARDS) {
    errors.push(
      `Le deck principal ne peut pas contenir plus de ${DECK_RULES.MAX_CARDS} cartes`,
    );
    return false;
  }

  return true;
}

/**
 * Valide le nombre de copies de chaque carte
 */
function validateCardCopies(deck: Deck, errors: string[]): boolean {
  let valid = true;
  const seen = new Set<string>();
  for (const deckCard of deck.cards) {
    const key = canonicalKey(deckCard.card);
    if (seen.has(key)) continue; // une carte canonique = une violation max
    seen.add(key);
    const copies = getCardCopies(deck, deckCard.card);
    const unique = isUniqueCard(deckCard.card);
    const maxCopies = unique ? 1 : DECK_RULES.MAX_COPIES;

    if (copies > maxCopies) {
      errors.push(
        unique
          ? `${deckCard.card.name} est une carte unique et ne peut être présente qu'en un seul exemplaire`
          : `Le deck ne peut pas contenir plus de ${maxCopies} copies de ${deckCard.card.name}`,
      );
      valid = false;
    }
  }

  return valid;
}

/**
 * Valide la réserve.
 * Règle 101.4 : en paquet construit, la réserve doit contenir EXACTEMENT
 * 0 ou 12 cartes (pas un simple plafond) et aucun Héros / Havre-Sac.
 */
function validateReserve(deck: Deck, errors: string[]): boolean {
  const reserveCards = getReserveCards(deck);

  if (reserveCards !== 0 && reserveCards !== DECK_RULES.RESERVE_SIZE) {
    errors.push(
      `La réserve doit contenir exactement 0 ou ${DECK_RULES.RESERVE_SIZE} cartes (actuellement ${reserveCards}).`,
    );
    return false;
  }

  return true;
}

/**
 * Valide un deck selon les règles du jeu (paquet construit).
 * NB : aucune règle officielle n'impose un type de carte minimum (« Action /
 * Allié ») — on ne valide donc que Héros+Havre-Sac, 48 cartes, copies et réserve.
 */
export function validateDeck(deck: Deck): ValidationResult {
  const errors: string[] = [];

  const isHeroValid = validateHeroAndHavreSac(deck, errors);
  const isCountValid = validateCardCount(deck, errors);
  const isCopiesValid = validateCardCopies(deck, errors);
  const isReserveValid = validateReserve(deck, errors);

  return {
    isValid: isHeroValid && isCountValid && isCopiesValid && isReserveValid,
    errors,
  };
}

/**
 * Valide un deck avant la sauvegarde et lance une erreur si invalide
 */
export function validateDeckForSave(deck: Deck): void {
  const result = validateDeck(deck);
  if (!result.isValid) {
    throw new ValidationError("Le deck est invalide", result.errors);
  }
}
