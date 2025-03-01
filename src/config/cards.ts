import type { CardElement } from '@/types/cards'

export const CARD_TYPES = [
  'Allié',
  'Sort',
  'Équipement',
  'Zone',
  'Salle',
  'Dofus',
  'Héros',
  'Protecteur',
  'Havre-Sac',
  'Allié Élémentaire'
] as const

export const ELEMENTS: CardElement[] = ['Feu', 'Eau', 'Terre', 'Air', 'Neutre']

export const ELEMENT_COLORS: Record<CardElement, string> = {
  'Feu': 'bg-red-500',
  'Eau': 'bg-blue-500',
  'Terre': 'bg-yellow-500',
  'Air': 'bg-green-500',
  'Neutre': 'bg-gray-500'
}

export const DECK_CONSTRAINTS = {
  MIN_CARDS: 48,
  MAX_CARDS: 48,
  MAX_COPIES: 3,
  MAX_RESERVE: 12,
  REQUIRES_HERO: true,
  REQUIRES_HAVEN_BAG: true
} as const 

export const EXTENSION_LEVELS = {
  'Incarnam': 1,
  'Astrub': 2,
  'Amakna': 3,
  'Bonta-Brakmar': 4,
  'Pandala': 5,
  'Otomaï': 6,
  'DOFUS Collection': 7,
  'Chaos d\'Ogrest': 8,
  'Ankama Convention 5': 9,
  'Île des Wabbits': 10,
  'Draft': 11
} as const 