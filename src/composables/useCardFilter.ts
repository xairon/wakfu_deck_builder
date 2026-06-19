/**
 * Composable de filtrage/tri des cartes — extrait de CollectionView.
 *
 * Exporte :
 *   - FilterCriteria  : critères de filtrage (12 existants + force range + effectQuery)
 *   - filterCards()   : filtre pur (mémoïsé, cache 50 entrées)
 *   - sortCards()     : tri pur  (mémoïsé, cache 50 entrées)
 */

import { useMemoize } from "@vueuse/core";
import type { Card, HeroCard } from "@/types/cards";
import { matchesSearch } from "@/utils/text";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilterCriteria {
  /** Recherche par nom ou sous-type */
  query: string;
  /** Filtre par extension (nom exact) */
  extension: string;
  /** Filtre par type principal */
  mainType: string;
  /** Filtre par sous-type */
  subType: string;
  /** Filtre par rareté */
  rarity: string;
  /**
   * Filtre par élément — ATTENTION : les données stockent les éléments en
   * minuscules ("feu", "eau", etc.) ; comparer avec card.stats.niveau.element
   * ou card.stats.force.element (déjà en minuscules dans la source).
   */
  element: string;
  /** Niveau minimum (stats.niveau.value) */
  minLevel: number | null;
  /** Niveau maximum (stats.niveau.value) */
  maxLevel: number | null;
  /** Coût PA minimum (stats.pa) */
  minCost: number | null;
  /** Coût PA maximum (stats.pa) */
  maxCost: number | null;
  /** Force minimum (stats.force.value) */
  minForce: number | null;
  /** Force maximum (stats.force.value) */
  maxForce: number | null;
  /** Recherche dans le texte d'effet (insensible casse/accents) */
  effectQuery: string;
  /** Masquer les cartes non possédées */
  hideNotOwned: boolean;
  /** Ensemble des IDs de cartes possédées (version + foil) */
  ownedIds: Set<string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Collecte tous les textes d'effets d'une carte.
 * Pour les Héros, lit recto.effects et verso.effects (pas card.effects qui
 * n'existe pas sur HeroCard).
 */
function cardEffectTexts(card: Card): string[] {
  if (card.mainType === "Héros") {
    const hero = card as HeroCard;
    const texts: string[] = [];
    for (const e of hero.recto?.effects ?? []) texts.push(e.description);
    for (const e of hero.verso?.effects ?? []) texts.push(e.description);
    return texts;
  }
  return (card.effects ?? []).map((e) => e.description);
}

// ── Filtrage mémoïsé ──────────────────────────────────────────────────────────

/**
 * Filtre un tableau de cartes selon les critères fournis.
 * Mémoïsé avec un plafond de 50 entrées (purge automatique).
 */
export const filterCards = useMemoize(
  (cards: Card[], criteria: FilterCriteria): Card[] => {
    const {
      query,
      extension,
      mainType,
      subType,
      rarity,
      element,
      minLevel,
      maxLevel,
      minCost,
      maxCost,
      minForce,
      maxForce,
      effectQuery,
      hideNotOwned,
      ownedIds,
    } = criteria;

    let filtered = [...cards];

    // Recherche par nom ou sous-type
    if (query) {
      filtered = filtered.filter(
        (card) =>
          matchesSearch(card.name, query) ||
          card.subTypes.some((type) => matchesSearch(type, query)),
      );
    }

    // Extension
    if (extension) {
      filtered = filtered.filter((card) => card.extension.name === extension);
    }

    // Type principal
    if (mainType) {
      filtered = filtered.filter((card) => card.mainType === mainType);
    }

    // Sous-type
    if (subType) {
      filtered = filtered.filter((card) => card.subTypes.includes(subType));
    }

    // Rareté
    if (rarity) {
      filtered = filtered.filter((card) => card.rarity === rarity);
    }

    // Élément — les valeurs dans les données sont en minuscules
    if (element) {
      filtered = filtered.filter(
        (card) =>
          card.stats?.niveau?.element === element ||
          card.stats?.force?.element === element,
      );
    }

    // Niveau minimum
    if (minLevel !== null) {
      filtered = filtered.filter((card) => {
        const niveau = card.stats?.niveau?.value;
        return niveau !== undefined ? niveau >= minLevel : false;
      });
    }

    // Niveau maximum
    if (maxLevel !== null) {
      filtered = filtered.filter((card) => {
        const niveau = card.stats?.niveau?.value;
        return niveau !== undefined ? niveau <= maxLevel : false;
      });
    }

    // Coût PA minimum
    if (minCost !== null) {
      filtered = filtered.filter((card) => {
        const cost = card.stats?.pa;
        return cost !== undefined ? cost >= minCost : false;
      });
    }

    // Coût PA maximum
    if (maxCost !== null) {
      filtered = filtered.filter((card) => {
        const cost = card.stats?.pa;
        return cost !== undefined ? cost <= maxCost : false;
      });
    }

    // Force minimum — exclut les cartes sans force si une borne est posée
    if (minForce !== null) {
      const min = minForce;
      filtered = filtered.filter((card) => {
        const force = card.stats?.force?.value;
        return force !== undefined && force !== null ? force >= min : false;
      });
    }

    // Force maximum — exclut les cartes sans force si une borne est posée
    if (maxForce !== null) {
      const max = maxForce;
      filtered = filtered.filter((card) => {
        const force = card.stats?.force?.value;
        return force !== undefined && force !== null ? force <= max : false;
      });
    }

    // Recherche dans le texte d'effet
    if (effectQuery) {
      filtered = filtered.filter((card) =>
        cardEffectTexts(card).some((text) => matchesSearch(text, effectQuery)),
      );
    }

    // Masquer les cartes non possédées
    if (hideNotOwned) {
      filtered = filtered.filter((card) => ownedIds.has(card.id));
    }

    return filtered;
  },
);

// ── Tri mémoïsé ───────────────────────────────────────────────────────────────

/**
 * Trie un tableau de cartes selon le champ et la direction spécifiés.
 * Mémoïsé avec un plafond de 50 entrées (purge automatique).
 */
export const sortCards = useMemoize(
  (cards: Card[], sortField: string, isDesc: boolean): Card[] => {
    const result = [...cards];

    const applyDirection = (r: number) => (isDesc ? -r : r);

    result.sort((cardA, cardB) => {
      const compareExtensions = () => {
        const extensionOrder: Record<string, number> = {
          Incarnam: 0,
          Astrub: 1,
          Amakna: 2,
          "Bonta-Brakmar": 3,
          Pandala: 4,
          Otomaï: 5,
          "DOFUS Collection": 6,
          "Chaos d'Ogrest": 7,
          "Ankama Convention 5": 8,
          "Île des Wabbits": 9,
          Draft: 10,
        };

        const getCardNumber = (card: Card) => {
          const match = card.extension.number?.match(/^(\d+)\//);
          return match ? parseInt(match[1]) : 0;
        };

        const extA = extensionOrder[cardA.extension.name] ?? 999;
        const extB = extensionOrder[cardB.extension.name] ?? 999;

        if (extA !== extB) {
          return extA - extB;
        }

        return getCardNumber(cardA) - getCardNumber(cardB);
      };

      switch (sortField) {
        case "number":
          return applyDirection(compareExtensions());

        case "rarity": {
          const rarityOrder: Record<string, number> = {
            Commune: 0,
            "Peu Commune": 1,
            Rare: 2,
            Mythique: 3,
            Légendaire: 4,
          };
          const rarityCompare =
            (rarityOrder[cardA.rarity] || 0) - (rarityOrder[cardB.rarity] || 0);
          if (rarityCompare !== 0) return applyDirection(rarityCompare);
          return compareExtensions();
        }

        case "type": {
          const typeCompare = cardA.mainType.localeCompare(cardB.mainType);
          if (typeCompare !== 0) return applyDirection(typeCompare);
          return compareExtensions();
        }

        case "element": {
          const elementA =
            cardA.stats?.niveau?.element ||
            cardA.stats?.force?.element ||
            "neutre";
          const elementB =
            cardB.stats?.niveau?.element ||
            cardB.stats?.force?.element ||
            "neutre";
          const elementCompare = elementA.localeCompare(elementB);
          if (elementCompare !== 0) return applyDirection(elementCompare);
          return compareExtensions();
        }

        case "force": {
          const forceA = cardA.stats?.force?.value || 0;
          const forceB = cardB.stats?.force?.value || 0;
          if (forceA !== forceB) return applyDirection(forceA - forceB);
          return compareExtensions();
        }

        default:
          return compareExtensions();
      }
    });

    return result;
  },
);

// ── Cache cap ─────────────────────────────────────────────────────────────────

/**
 * Purge les caches de mémoïsation si leur taille dépasse 50 entrées.
 * À appeler dans le computed qui utilise filterCards/sortCards.
 */
export function pruneFilterCaches(): void {
  if ((filterCards.cache as Map<unknown, unknown>).size > 50)
    filterCards.clear();
  if ((sortCards.cache as Map<unknown, unknown>).size > 50) sortCards.clear();
}
