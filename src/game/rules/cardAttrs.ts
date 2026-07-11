/**
 * Moteur de règles R1 — lecture défensive des attributs d'une `Card`.
 * Les données de cartes sont hétérogènes (scraping) : tout accès passe ici.
 */
import type { Card, BaseStats } from "@/types/cards";
import { isHeroCard } from "../../types/cards.ts";

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

/**
 * RÉCENCE DE JEU PAR CATÉGORIE : jetons TURN-scoped posés sur le Héros du
 * JOUEUR à CHAQUE carte jouée (tous écrasés — stricte récence, comme
 * `recentQuestParch`), purgés au changement de tour. Lus par la restriction
 * `playCondition { cond: "recentlyPlayedKind", kinds, who }` (Bébé
 * Crocodaille, Buveur, Tolot, Sagesse de Silouate, Démons et Merveilles).
 */
export const RECENT_PLAY_TOKENS = {
  action: "recentPlayAction",
  sort: "recentPlaySort",
  parchemin: "recentPlayParchemin",
  equipement: "recentPlayEquipement",
  allie: "recentPlayAllie",
  unique: "recentPlayUnique",
} as const;
export type RecentPlayKind = keyof typeof RECENT_PLAY_TOKENS;

/** Catégories de récence portées par une carte jouée (cumulables : une Action
 *  au subType Parchemin pose `action` ET `parchemin`). */
export function recentPlayKindsOf(card: Card): RecentPlayKind[] {
  const kinds: RecentPlayKind[] = [];
  if (card.mainType === "Action") kinds.push("action");
  if (card.mainType === "Équipement") kinds.push("equipement");
  if (card.mainType === "Allié" || card.mainType === "Allié Élémentaire")
    kinds.push("allie");
  const subs = (card.subTypes ?? []).map(normWord);
  if (subs.includes("sort")) kinds.push("sort");
  if (subs.includes("parchemin")) kinds.push("parchemin");
  if (subs.includes("unique")) kinds.push("unique");
  return kinds;
}

/** Jeton « une seule <Nom> par tour » (onceNamePerTurn) : clé par NOM
 *  normalisé — les rééditions du même nom partagent la limite. */
export function onceNameToken(cardName: string): string {
  return `oncePlayed_${normWord(cardName).replace(/\W+/g, "-")}`;
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
 * NB : c'est AUSSI l'Élément des Dommages de combat (410.1, `damageElementOf`)
 * et l'Élément imprimé pour les filtres de pile (« une carte [X] ») — il reste
 * l'Élément IMPRIMÉ, sans override de production colorée (cf. `resourceElement`).
 */
export function producedElement(card: Card): string {
  if (isHeroCard(card)) {
    return normElement(
      card.recto?.stats?.force?.element ?? card.recto?.stats?.niveau?.element,
    );
  }
  return normElement(card.stats?.force?.element ?? card.stats?.niveau?.element);
}

/**
 * Élément de la RESSOURCE produite quand la carte s'incline pour PAYER (4261).
 * Un producteur COLORÉ (« Produisez une Ressource [X] », un seul Élément —
 * `card.producesElement`, peuplé par compileEffects) produit CET Élément, même
 * si son Élément imprimé diffère : les Pious sont Neutre en Niveau/Force mais
 * produisent Eau/Air/Feu/Terre (color-fixing). Sans override → producteur
 * générique (son Élément imprimé, `producedElement`). DISTINCT de `producedElement`
 * (Dommages de combat / filtres de pile) : l'override ne s'applique QU'À la
 * production de Ressources (resourceProducers), jamais au combat.
 */
export function resourceElement(card: Card): string {
  return card.producesElement
    ? normElement(card.producesElement)
    : producedElement(card);
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
  // Lecture DÉFENSIVE (recto peut manquer sur des données/mocks malformés) :
  // renvoie `undefined` plutôt que de planter.
  return side === "verso"
    ? (card.verso?.stats ?? card.recto?.stats)
    : card.recto?.stats;
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

/**
 * A19 — RECETTE d'une carte (305.4 / 418.4c) : parse STRICT du keyword
 * `{ name: "Recette", description: ": <Métier> <N>", elements: ["<Élément>"] }`
 * (format uniforme des 232 cartes à Recette). Toute forme inattendue → null
 * (la carte n'est simplement pas fabricable — jamais d'approximation).
 * `metier` est canonisé (Forgeron / Armurier / Bijoutier / Bricoleur).
 */
export function recetteOf(
  card: Card | null | undefined,
): { metier: string; n: number; element: string } | null {
  const kw = (card?.keywords ?? []).find((k) => k?.name === "Recette");
  if (!kw) return null;
  const m = (kw.description ?? "")
    .trim()
    .match(/^:?\s*(forgeron|armurier|bijoutier|bricoleur)\s+(\d+)$/i);
  if (!m) return null;
  const els = kw.elements ?? [];
  if (els.length !== 1 || !els[0]) return null;
  const metier = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  return { metier, n: Number.parseInt(m[2], 10), element: els[0] };
}
