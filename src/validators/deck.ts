import type { Deck, Card } from '@/types'
import { ValidationError } from '@/utils/errors'

export const DECK_RULES = {
  MIN_CARDS: 15,
  MAX_CARDS: 30,
  MAX_COPIES: 3,
  MAX_RESERVE: 12,
  REQUIRED_TYPES: ['Sort', 'Allié'],
} as const

interface ValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Compte le nombre total de cartes dans le deck principal (hors réserve)
 */
export function getTotalCards(deck: Deck): number {
  return deck.cards
    .filter((c) => !c.isReserve)
    .reduce((total, card) => total + card.quantity, 0)
}

/**
 * Compte le nombre total de cartes dans la réserve
 */
export function getReserveCards(deck: Deck): number {
  return deck.cards
    .filter((c) => c.isReserve)
    .reduce((total, card) => total + card.quantity, 0)
}

/**
 * Compte le nombre de copies d'une carte dans le deck
 */
export function getCardCopies(deck: Deck, card: Card): number {
  return deck.cards
    .filter((c) => c.card.id === card.id)
    .reduce((total, c) => total + c.quantity, 0)
}

/**
 * Vérifie si une carte peut être ajoutée au deck
 */
export function canAddCard(deck: Deck, card: Card, isReserve = false): boolean {
  const currentCopies = getCardCopies(deck, card)
  const maxCopies = card.keywords?.some((k) => k.name === 'Unique')
    ? 1
    : DECK_RULES.MAX_COPIES

  if (currentCopies >= maxCopies) {
    return false
  }

  if (isReserve) {
    const reserveCards = getReserveCards(deck)
    return reserveCards < DECK_RULES.MAX_RESERVE
  } else {
    const totalCards = getTotalCards(deck)
    return totalCards < DECK_RULES.MAX_CARDS
  }
}

/**
 * Valide le héros et le havre-sac
 */
function validateHeroAndHavreSac(deck: Deck, errors: string[]): boolean {
  let isValid = true

  if (!deck.hero) {
    errors.push('Le deck doit avoir un héros')
    isValid = false
  }

  if (!deck.havreSac) {
    errors.push('Le deck doit avoir un havre-sac')
    isValid = false
  }

  return isValid
}

/**
 * Valide le nombre total de cartes dans le deck
 */
function validateCardCount(deck: Deck, errors: string[]): boolean {
  const totalCards = getTotalCards(deck)

  if (totalCards < DECK_RULES.MIN_CARDS) {
    errors.push(
      `Le deck principal doit contenir au moins ${DECK_RULES.MIN_CARDS} cartes`
    )
    return false
  }

  if (totalCards > DECK_RULES.MAX_CARDS) {
    errors.push(
      `Le deck principal ne peut pas contenir plus de ${DECK_RULES.MAX_CARDS} cartes`
    )
    return false
  }

  return true
}

/**
 * Valide le nombre de copies de chaque carte
 */
function validateCardCopies(deck: Deck, errors: string[]): boolean {
  for (const deckCard of deck.cards) {
    const copies = getCardCopies(deck, deckCard.card)
    const maxCopies = deckCard.card.keywords?.some((k) => k.name === 'Unique')
      ? 1
      : DECK_RULES.MAX_COPIES

    if (copies > maxCopies) {
      errors.push(
        deckCard.card.keywords?.some((k) => k.name === 'Unique')
          ? `${deckCard.card.name} est une carte unique et ne peut être présente qu'en un seul exemplaire`
          : `Le deck ne peut pas contenir plus de ${maxCopies} copies de ${deckCard.card.name}`
      )
      return false
    }
  }

  return true
}

/**
 * Valide la réserve
 */
function validateReserve(deck: Deck, errors: string[]): boolean {
  const reserveCards = getReserveCards(deck)

  if (reserveCards > DECK_RULES.MAX_RESERVE) {
    errors.push(
      `La réserve ne peut pas contenir plus de ${DECK_RULES.MAX_RESERVE} cartes`
    )
    return false
  }

  return true
}

/**
 * Valide les combinaisons de types de cartes
 */
function validateCardCombinations(deck: Deck, errors: string[]): boolean {
  const hasRequiredTypes = DECK_RULES.REQUIRED_TYPES.some((type) =>
    deck.cards.some((c) => c.card.type === type)
  )

  if (!hasRequiredTypes) {
    errors.push(
      `Le deck doit contenir au moins un ${DECK_RULES.REQUIRED_TYPES.join(' ou ')}`
    )
    return false
  }

  return true
}

/**
 * Valide un deck selon les règles du jeu
 */
export function validateDeck(deck: Deck): ValidationResult {
  const errors: string[] = []

  const isHeroValid = validateHeroAndHavreSac(deck, errors)
  const isCountValid = validateCardCount(deck, errors)
  const isCopiesValid = validateCardCopies(deck, errors)
  const isReserveValid = validateReserve(deck, errors)
  const isCombinationsValid = validateCardCombinations(deck, errors)

  return {
    isValid:
      isHeroValid &&
      isCountValid &&
      isCopiesValid &&
      isReserveValid &&
      isCombinationsValid,
    errors,
  }
}

/**
 * Valide un deck avant la sauvegarde et lance une erreur si invalide
 */
export function validateDeckForSave(deck: Deck): void {
  const result = validateDeck(deck)
  if (!result.isValid) {
    throw new ValidationError('Le deck est invalide', result.errors)
  }
}
