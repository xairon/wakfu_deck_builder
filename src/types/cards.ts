import type { CardType } from '@/config/constants'
import type { Element } from '@/services/elementService'
import { EXTENSION_LEVELS } from '@/config/cards'

// Types de base
export type CardRarity =
  | 'Commune'
  | 'Peu Commune'
  | 'Rare'
  | 'Mythique'
  | 'Légendaire'
export type CardElement = 'Air' | 'Eau' | 'Feu' | 'Terre' | 'Neutre'

// Types principaux de cartes
export type CardMainType =
  | 'Allié'
  | 'Action'
  | 'Équipement'
  | 'Zone'
  | 'Salle'
  | 'Dofus'
  | 'Héros'
  | 'Protecteur'
  | 'Havre-Sac'
  | 'Allié Élémentaire'

// Interface pour les ressources élémentaires
export interface ElementalCost {
  element: CardElement
  count: number
}

// Interface pour les effets
export interface CardEffect {
  description: string
  elements?: CardElement[]
  isOncePerTurn?: boolean
  requiresIncline?: boolean
  linkedTokens?: {
    name: string
    type: string[]
    force?: number
    elements?: CardElement[]
  }[]
}

// Interface pour les mots-clés
export interface CardKeywordInfo {
  name: CardKeyword
  description: string
  elements?: CardElement[]
}

// Interface pour les statistiques élémentaires
export interface ElementalStat {
  value: number
  element: CardElement
}

// Stats de base étendues
export interface BaseStats {
  niveau?: ElementalStat
  force?: ElementalStat
  pa?: number
  pm?: number
  pv?: number
  cost?: number
  power?: number
  health?: number
  movement?: number
  range?: number
}

// Interface pour les métiers
export interface Profession {
  name: string
  level: number
  specialization?: string
}

// Interface pour les informations d'extension
export interface ExtensionInfo {
  name: keyof typeof EXTENSION_LEVELS
  id: string
  number?: string
  shortUrl?: string
}

// Interface de base pour toutes les cartes
export interface BaseCard {
  id: string
  name: string
  mainType: CardType
  subTypes: string[]
  extension: ExtensionInfo
  rarity: CardRarity
  stats?: BaseStats
  effects?: CardEffect[]
  keywords?: CardKeywordInfo[]
  experience?: number
  artists: string[]
  notes?: string[]
  flavor?: {
    text: string
    attribution?: string
  }
  imageUrl?: string
  url?: string
}

// Interface pour les cartes de type Allié
export interface AllyCard extends BaseCard {
  mainType: 'Allié'
  stats: BaseStats
  effects?: CardEffect[]
  keywords?: CardKeywordInfo[]
  race?: string
  tribe?: string
}

// Interface pour les cartes de type Action
export interface ActionCard extends BaseCard {
  mainType: 'Action'
  effects: CardEffect[]
  keywords?: CardKeywordInfo[]
  spellSchool?: string
}

// Interface pour les cartes de type Équipement
export interface EquipmentCard extends BaseCard {
  mainType: 'Équipement'
  stats?: BaseStats
  effects?: CardEffect[]
  keywords?: CardKeywordInfo[]
  equipmentType:
    | 'Arme'
    | 'Armure'
    | 'Bijou'
    | 'Chapeau'
    | 'Bottes'
    | 'Cape'
    | 'Ceinture'
    | 'Amulette'
    | 'Anneau'
  durability?: number
  requirements?: {
    level?: number
    professions?: string[]
    elements?: CardElement[]
  }
}

// Interface pour les cartes de type Zone
export interface ZoneCard extends BaseCard {
  mainType: 'Zone'
  effects: CardEffect[]
  keywords?: CardKeywordInfo[]
  zoneType?: string
}

// Interface pour les cartes de type Salle
export interface RoomCard extends BaseCard {
  mainType: 'Salle'
  effects: CardEffect[]
  keywords?: CardKeywordInfo[]
  roomType?: string
}

// Interface pour les cartes de type Dofus
export interface DofusCard extends BaseCard {
  mainType: 'Dofus'
  effects: CardEffect[]
  keywords?: CardKeywordInfo[]
  requirements?: {
    level?: number
    elements?: CardElement[]
  }
}

// Interface pour les cartes de type Héros
export interface HeroCard extends BaseCard {
  mainType: 'Héros'
  class: string
  recto: {
    stats: BaseStats
    effects: CardEffect[]
    keywords: CardKeywordInfo[]
  }
  verso?: {
    stats: BaseStats
    effects: CardEffect[]
    keywords: CardKeywordInfo[]
  }
}

// Interface pour les cartes de type Protecteur
export interface ProtectorCard extends BaseCard {
  mainType: 'Protecteur'
  stats: BaseStats
  effects: CardEffect[]
  keywords?: CardKeywordInfo[]
  protectorType?: string
}

// Interface pour les cartes de type Havre-Sac
export interface HavenBagCard extends BaseCard {
  mainType: 'Havre-Sac'
  effects: CardEffect[]
  keywords?: CardKeywordInfo[]
  capacity?: number
}

// Interface pour les cartes de type Allié Élémentaire
export interface ElementalAllyCard extends BaseCard {
  mainType: 'Allié Élémentaire'
  stats: BaseStats
  effects?: CardEffect[]
  keywords?: CardKeywordInfo[]
  elements: CardElement[]
  elementalAffinity?: {
    primary: CardElement
    secondary?: CardElement
  }
}

// Type union pour toutes les cartes possibles
export type Card =
  | AllyCard
  | ActionCard
  | EquipmentCard
  | ZoneCard
  | RoomCard
  | DofusCard
  | HeroCard
  | ProtectorCard
  | HavenBagCard
  | ElementalAllyCard

// Type guard functions
export function isAllyCard(card: Card): card is AllyCard {
  return card.mainType === 'Allié'
}

export function isActionCard(card: Card): card is ActionCard {
  return card.mainType === 'Action'
}

export function isEquipmentCard(card: Card): card is EquipmentCard {
  return card.mainType === 'Équipement'
}

export function isZoneCard(card: Card): card is ZoneCard {
  return card.mainType === 'Zone'
}

export function isRoomCard(card: Card): card is RoomCard {
  return card.mainType === 'Salle'
}

export function isDofusCard(card: Card): card is DofusCard {
  return card.mainType === 'Dofus'
}

export function isHeroCard(card: Card): card is HeroCard {
  return card.mainType === 'Héros'
}

export function isProtectorCard(card: Card): card is ProtectorCard {
  return card.mainType === 'Protecteur'
}

export function isHavenBagCard(card: Card): card is HavenBagCard {
  return card.mainType === 'Havre-Sac'
}

export function isElementalAllyCard(card: Card): card is ElementalAllyCard {
  return card.mainType === 'Allié Élémentaire'
}

// Types utilitaires
export type CardKeyword =
  | 'Inclinaison'
  | 'Riposte'
  | 'Portée'
  | 'Critique'
  | 'Parade'
  | 'Résistance'
  | 'Unique'

export interface DeckCard {
  card: Card
  quantity: number
  isReserve?: boolean
}

export interface Deck {
  id: string
  name: string
  description?: string
  hero: Card | null
  havreSac: Card | null
  cards: Record<string, number> // cardId -> quantity
  reserve?: DeckCard[]
  extension?: string
  createdAt: string
  updatedAt: string
  isOfficial?: boolean // Marque les decks officiels
  _officialData?: any // Données du deck officiel pour l'import
}
