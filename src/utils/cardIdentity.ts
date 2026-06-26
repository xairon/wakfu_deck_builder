/**
 * Identité canonique d'une carte = regroupement des réimpressions.
 *
 * Vérifié sur les données : deux cartes de même nom dans des extensions
 * différentes sont la même carte au sens des règles (les écarts résiduels sont
 * des artefacts de scraping). Le nom est donc une clé fiable.
 *
 * Les noms sont DÉJÀ normalisés au chargement (cardLoader.fixSpecialCharacters),
 * donc on se contente ici de trim + lowercase (aucun import de cardLoader →
 * pas de dépendance circulaire).
 */
import type { Card } from "@/types/cards";

/** Clé regroupant les impressions d'une même carte (nom normalisé). */
export function canonicalKey(card: Card): string {
  return card.name.trim().toLowerCase();
}

/** Vrai si `a` et `b` sont la même carte au sens canonique (mêmes copies). */
export function sameCanonicalCard(a: Card, b: Card): boolean {
  return canonicalKey(a) === canonicalKey(b);
}

/** Toutes les impressions de `cards` partageant la clé canonique de `card`. */
export function printingsOf(cards: Card[], card: Card): Card[] {
  const key = canonicalKey(card);
  return cards.filter((c) => canonicalKey(c) === key);
}
