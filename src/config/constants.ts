/**
 * Application-level constants.
 * Card-related constants (CARD_TYPES, ELEMENTS, DECK_CONSTRAINTS, etc.)
 * are in cards.ts — import from there.
 */

// Re-export card constants for backward compatibility
export {
  CARD_TYPES,
  ELEMENTS,
  ELEMENT_COLORS,
  DECK_CONSTRAINTS,
} from "./cards";
export type { CardElement } from "@/types/cards";

// Derive types from the source of truth
export type Element = "Feu" | "Eau" | "Terre" | "Air" | "Neutre";
export type CardType =
  | "Allié"
  | "Action"
  | "Équipement"
  | "Zone"
  | "Salle"
  | "Dofus"
  | "Héros"
  | "Protecteur"
  | "Havre-Sac"
  | "Allié Élémentaire";

export const APP_VERSION = "1.0.0";

export const ELEMENT_EMOJIS: Record<Element, string> = {
  Feu: "🔥",
  Eau: "💧",
  Terre: "🌍",
  Air: "💨",
  Neutre: "⚪",
} as const;

export const RARITY_COLORS = {
  COMMON: "text-neutral",
  UNCOMMON: "text-primary",
  RARE: "text-secondary",
  EPIC: "text-accent",
  LEGENDARY: "text-warning",
} as const;
