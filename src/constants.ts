// Version de l'application
export const APP_VERSION = '1.0.0'

// Éléments
export const ELEMENTS = ['Feu', 'Eau', 'Terre', 'Air', 'Neutre'] as const
export type Element = typeof ELEMENTS[number]

// Couleurs des éléments
export const ELEMENT_COLORS: Record<Element, string> = {
  'Feu': 'bg-red-500',
  'Eau': 'bg-blue-500',
  'Terre': 'bg-yellow-500',
  'Air': 'bg-green-500',
  'Neutre': 'bg-gray-500'
}

// Émojis des éléments
export const ELEMENT_EMOJIS: Record<Element, string> = {
  'Feu': '🔥',
  'Eau': '💧',
  'Terre': '🌍',
  'Air': '💨',
  'Neutre': '⚪'
} as const

// Types de cartes
export const CARD_TYPES = [
  'Héros',
  'Allié',
  'Action',
  'Équipement',
  'Zone',
  'Salle',
  'Dofus',
  'Protecteur',
  'Havre-Sac',
  'Allié Élémentaire'
] as const

export type CardType = typeof CARD_TYPES[number]

export const RARITY_COLORS = {
  COMMON: 'text-neutral',
  UNCOMMON: 'text-primary',
  RARE: 'text-secondary',
  EPIC: 'text-accent',
  LEGENDARY: 'text-warning'
} as const 