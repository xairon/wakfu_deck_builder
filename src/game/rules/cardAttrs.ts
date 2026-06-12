/**
 * Moteur de règles R1 — lecture défensive des attributs d'une `Card`.
 * Les données de cartes sont hétérogènes (scraping) : tout accès passe ici.
 */
import type { Card, BaseStats } from "@/types/cards";
import { isHeroCard } from "@/types/cards";

/**
 * Élément normalisé (minuscules) : les données réelles stockent "feu"/"eau"
 * alors que les types déclarent "Feu"/"Eau" — toute comparaison passe ici.
 */
export function normElement(el?: string | null): string {
  return (el ?? "Neutre").toLowerCase();
}

/** Libellé d'élément pour l'affichage (« feu » → « Feu »). */
export function elementLabel(el: string): string {
  return el.charAt(0).toUpperCase() + el.slice(1);
}

/**
 * Mot normalisé pour comparer familles/sous-types (minuscules, sans accents) :
 * « Bouftou » ≡ « bouftou », « Fécas » ≢ « feca » (le pluriel reste à l'appelant).
 */
export function normWord(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Coût de lancement = Niveau de la carte (4316). */
export function levelCost(card: Card): number {
  return card.stats?.niveau?.value ?? 0;
}

/**
 * Élément obligatoire du coût (4381), normalisé : uniquement pour les Alliés,
 * et seulement si leur Niveau est élémentaire (un fond Neutre est libre, 4398).
 */
export function requiredElement(card: Card): string | null {
  if (card.mainType !== "Allié" && card.mainType !== "Allié Élémentaire")
    return null;
  const el = normElement(card.stats?.niveau?.element);
  return el !== "neutre" ? el : null;
}

/**
 * Élément produit quand la carte s'incline (1337/8764), normalisé :
 * l'Élément de la carte = symbole de Force ; repli sur l'élément de Niveau.
 */
export function producedElement(card: Card): string {
  if (isHeroCard(card)) {
    return normElement(
      card.recto?.stats?.force?.element ?? card.recto?.stats?.niveau?.element,
    );
  }
  return normElement(card.stats?.force?.element ?? card.stats?.niveau?.element);
}

/** Force de combat (204.4). Pour un Héros : selon sa face courante. */
export function forceValue(
  card: Card,
  side: "recto" | "verso" = "recto",
): number {
  if (isHeroCard(card)) return heroStats(card, side)?.force?.value ?? 0;
  return card.stats?.force?.value ?? 0;
}

/** Expérience rapportée à l'adversaire quand l'Allié est détruit (415.1). */
export function xpValue(card: Card): number {
  return card.experience ?? 0;
}

export function heroStats(
  card: Card,
  side: "recto" | "verso",
): BaseStats | undefined {
  if (!isHeroCard(card)) return undefined;
  return side === "verso"
    ? (card.verso?.stats ?? card.recto.stats)
    : card.recto.stats;
}

/** Toute carte en jeu produit une Ressource en s'inclinant, sauf Protecteur (4261). */
export function canProduceResource(card: Card): boolean {
  return card.mainType !== "Protecteur";
}

/** Peut être déclarée attaquante : Alliés et Héros (303.6 exclut les Élémentaires). */
export function canAttackCard(card: Card): boolean {
  return card.mainType === "Allié" || card.mainType === "Héros";
}

/** Peut bloquer : Alliés du Monde (303.6 exclut les Élémentaires). */
export function canBlockCard(card: Card): boolean {
  return card.mainType === "Allié";
}
