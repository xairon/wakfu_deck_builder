/**
 * Helpers d'affichage carte partagés (decklists, grilles). Source unique pour
 * l'élément dominant, le libellé « PA · Élément » et la couleur d'encre.
 */
import type { Card } from "@/types/cards";
import { elementColor } from "@/config/elementColors";

/** Élément dominant d'une carte, en minuscule. Repli « neutre ». */
export function cardElement(card: Card): string {
  return (
    card.stats?.niveau?.element ||
    card.stats?.force?.element ||
    "neutre"
  ).toLowerCase();
}

/** Couleur d'encre élémentaire (spine) d'une carte. */
export function cardSpineColor(card: Card): string {
  return elementColor(cardElement(card));
}

/** Libellé court : « 3 PA · Feu », ou « Feu » si la carte n'a pas de PA. */
export function cardPaLabel(card: Card): string {
  const el = cardElement(card);
  const elName = el.charAt(0).toUpperCase() + el.slice(1);
  const pa = card.stats?.pa;
  if (pa === undefined) return elName;
  return `${pa} PA · ${elName}`;
}
