/**
 * Types et interfaces pour la gestion des cartes et des decks
 * @module Types
 */

/**
 * Types de rareté possibles
 */
export type Rarity =
  | 'Commune'
  | 'Peu Commune'
  | 'Rare'
  | 'Mythique'
  | 'Légendaire'

/**
 * Types de cartes possibles
 */
export type CardType =
  | 'Allié'
  | 'Havre-sac'
  | 'Héros'
  | 'Équipement'
  | 'Sort'
  | 'Zone'

/**
 * Classes de cartes possibles
 */
export type CardClass =
  | 'Monstre'
  | 'Bandit'
  | 'Hibou'
  | 'Marchand'
  | 'Vampyre'
  | 'Crâ'
  | 'Xélor'
  | 'Guide'
  | 'Ecaflip'
  | 'Iop'
  | 'Sacrieur'
  | 'Eniripsa'
  | 'Osamodas'
  | 'Feca'
  | 'Sram'
  | 'Sadida'
  | 'Pandawa'
  | null

/**
 * Éléments possibles
 */
export type Element = 'Air' | 'Eau' | 'Feu' | 'Terre' | null

/**
 * Statistiques d'une carte
 * @interface Stats
 */
export interface Stats {
  /** Points d'action (PA) requis pour jouer la carte */
  ap?: number
  /** Points de vie de la carte */
  hp?: number
  /** Points de mouvement de la carte */
  mp?: number
}

/**
 * Interface représentant une carte du jeu Wakfu TCG
 */
export interface Card {
  id: string
  name: string
  description: string
  type: string
  rarity: string
  cost: number
  power?: number
  health?: number
  imageUrl: string
  quantity: number
  element?: Element
  effects?: string[]
  keywords?: string[]
}

/**
 * Représente une entrée de carte dans un deck avec sa quantité
 * @interface DeckEntry
 */
export interface DeckEntry {
  /** La carte */
  card: Card
  /** Nombre d'exemplaires dans le deck (1-3) */
  quantity: number
}

/**
 * Interface représentant un deck de cartes
 */
export interface Deck {
  id: string
  name: string
  cards: DeckCard[]
  hero: Card | null
  havreSac: Card | null
  createdAt: string
  updatedAt: string
}

/**
 * Interface représentant une carte dans un deck avec sa quantité
 */
export interface DeckCard {
  /** La carte */
  card: Card
  /** Quantité de la carte dans le deck (1-3) */
  quantity: number
  /** Indique si la carte est dans la réserve */
  isReserve?: boolean
}

/**
 * Interface représentant la collection de cartes d'un joueur
 */
export interface Collection {
  /** Identifiant unique de la collection */
  id: string
  /** Liste des cartes avec leur quantité */
  cards: DeckCard[]
  /** Date de dernière mise à jour de la collection */
  updatedAt?: Date
}

/**
 * Représente une synergie entre cartes
 * @interface Synergy
 */
export interface Synergy {
  /** Type de synergie (Type, Élément, Coût) */
  type: string
  /** Force de la synergie (0-1) */
  strength: number
  /** Description de la synergie */
  description: string
}

/**
 * Métriques calculées pour un deck
 * @interface DeckMetrics
 */
export interface DeckMetrics {
  /** Nombre total de cartes */
  totalCards: number
  /** Nombre de cartes uniques */
  uniqueCards: number
  /** Coût moyen en PA */
  averageAP: number
  /** Points de vie moyens */
  averageHP: number
  /** Points de mouvement moyens */
  averageMP: number
  /** Distribution des types de cartes */
  typeDistribution: Record<string, number>
  /** Distribution des éléments */
  elementDistribution: Record<string, number>
  /** Courbe de coût en PA */
  apCurve: Record<number, number>
  /** Ratio de diversité des cartes */
  cardDiversity: number
  /** Ratio de diversité des éléments */
  elementDiversity: number
  /** Ratio de diversité des types */
  typeDiversity: number
  /** Synergies détectées */
  synergies: Synergy[]
  /** Potentiel de combos */
  comboPotential: Array<{
    combo: string
    probability: number
  }>
  /** Efficacité PA/Stats */
  apEfficiency: number
  /** Équilibre des ressources */
  resourceBalance: number
  /** Fluidité de la courbe */
  curveSmoothness: number
  /** Potentiel early game */
  earlyGamePotential: number
  /** Potentiel late game */
  lateGamePotential: number
}

/**
 * Résultat de la comparaison entre deux decks
 * @interface DeckComparisonResult
 */
export interface DeckComparisonResult {
  /** Différences relatives entre les decks */
  differences: {
    totalCards: number
    averageAP: number
    averageHP: number
    averageMP: number
    cardDiversity: number
    elementDiversity: number
    typeDiversity: number
  }
  /** Forces identifiées pour chaque deck */
  strengths: {
    deck1: string[]
    deck2: string[]
  }
  /** Suggestions d'amélioration */
  suggestions: {
    deck1: string[]
    deck2: string[]
  }
  /** Analyse de compatibilité */
  compatibility: {
    score: number
    reasons: string[]
  }
  /** Style de jeu dominant */
  playstyle: {
    deck1: {
      style: string
      description: string
    }
    deck2: {
      style: string
      description: string
    }
  }
}

export interface DeckStats {
  totalCards: number
  uniqueCards: number
  averageCost: number
  powerDistribution: Record<number, number>
}
