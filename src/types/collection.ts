import type { Element } from "@/services/elementService";

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
