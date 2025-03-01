import type { Element } from '@/services/elementService'

export interface CollectionCard {
  id: string;
  quantity: number;
  dateAdded: string;
  isFoil: boolean;
  element: Element;
}

export interface CollectionStats {
  totalCards: number;
  uniqueCards: number;
  foilCards: number;
  completionRate: number;
  elementDistribution: Record<Element, number>;
}

export interface CollectionFilters {
  searchTerm: string;
  elements: Element[];
  rarity: string[];
  onlyFoil: boolean;
  onlyMissing: boolean;
}

export const ELEMENTS = ['Feu', 'Eau', 'Terre', 'Air'] as const;
export type Element = typeof ELEMENTS[number];

export const RARITIES = ['Commune', 'Peu Commune', 'Rare', 'Épique', 'Légendaire'] as const;
export type Rarity = typeof RARITIES[number];

export interface Card {
  id: string;
  name: string;
  element?: Element;
  rarity: Rarity;
  imageUrl: string;
  stats?: {
    ap?: number;
    hp?: number;
    power?: number;
  };
} 