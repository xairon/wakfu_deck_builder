/**
 * Règles de cartes partagées (limite d'exemplaires, trait Unique…).
 *
 * Le trait « Unique » est stocké dans `subTypes` dans les données réelles
 * (public/data/*.json) — PAS dans `keywords`. On vérifie les deux par sécurité.
 */
import type { Card } from "@/types/cards";

/** Vrai si la carte est « Unique » (limitée à 1 exemplaire par deck). */
export function isUniqueCard(card: Card): boolean {
  return (
    card.subTypes?.includes("Unique") ||
    card.keywords?.some((k) => k.name === "Unique") ||
    false
  );
}

/** Nombre maximum d'exemplaires autorisés (1 si Unique, sinon `defaultMax`). */
export function maxCopiesForCard(card: Card, defaultMax = 3): number {
  return isUniqueCard(card) ? 1 : defaultMax;
}
