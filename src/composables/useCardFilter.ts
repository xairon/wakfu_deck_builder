/**
 * Composable de filtrage/tri des cartes — extrait de CollectionView.
 *
 * Exporte :
 *   - FilterCriteria  : critères de filtrage (12 existants + force range + effectQuery)
 *   - filterCards()   : filtre pur (mémoïsé, cache 50 entrées)
 *   - sortCards()     : tri pur  (mémoïsé, cache 50 entrées)
 */

import { useMemoize } from "@vueuse/core";
import type { Card } from "@/types/cards";
import { isHeroCard } from "@/types/cards";
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
   * Filtre par élément. Les données stockent l'élément capitalisé ("Feu",
   * "Eau"…) depuis la migration de schéma Zod ; la comparaison dans filterCards
   * est insensible à la casse, donc la valeur peut arriver en minuscules ou non.
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
  if (isHeroCard(card)) {
    const texts: string[] = [];
    for (const e of card.recto?.effects ?? []) texts.push(e.description);
    for (const e of card.verso?.effects ?? []) texts.push(e.description);
    return texts;
  }
  return (card.effects ?? []).map((e) => e.description);
}

/**
 * Clé de mémoïsation COMPACTE et CORRECTE pour le filtrage.
 * `filterCards` reçoit toujours le catalogue complet (statique) → on l'identifie
 * par sa taille au lieu de sérialiser ~1585 cartes à chaque appel. Surtout,
 * `ownedIds` (un Set) se sérialise en `{}` via la clé JSON par défaut : on
 * l'aplatit en liste triée pour que « masquer les non possédées » ne renvoie
 * pas de résultat périmé quand la collection change.
 */
function filterKey(cards: Card[], c: FilterCriteria): string {
  return JSON.stringify({
    n: cards.length,
    q: c.query,
    x: c.extension,
    mt: c.mainType,
    st: c.subType,
    r: c.rarity,
    el: c.element,
    nlv: c.minLevel,
    xlv: c.maxLevel,
    nc: c.minCost,
    xc: c.maxCost,
    nf: c.minForce,
    xf: c.maxForce,
    eq: c.effectQuery,
    h: c.hideNotOwned,
    own: c.hideNotOwned ? [...c.ownedIds].sort() : [],
  });
}

// ── Filtrage mémoïsé ──────────────────────────────────────────────────────────

/**
 * Filtre un tableau de cartes selon les critères fournis.
 * Mémoïsé avec un plafond de 50 entrées (purge automatique).
 */
export const filterCards = useMemoize(
  (cards: Card[], criteria: FilterCriteria): Card[] => {
    /* getKey ci-dessous : voir filterKey (Set ownedIds + perf catalogue). */
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

    // Élément — comparaison insensible à la casse : les données stockent
    // l'élément capitalisé ("Feu") depuis la migration de schéma Zod, alors que
    // l'UI transmet la valeur en minuscules. Sans normalisation des deux côtés,
    // chaque élément renverrait « aucune carte ».
    if (element) {
      const el = element.toLowerCase();
      filtered = filtered.filter(
        (card) =>
          card.stats?.niveau?.element?.toLowerCase() === el ||
          card.stats?.force?.element?.toLowerCase() === el,
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
      filtered = filtered.filter((card) => {
        const force = card.stats?.force?.value;
        return force !== undefined && force !== null
          ? force >= minForce
          : false;
      });
    }

    // Force maximum — exclut les cartes sans force si une borne est posée
    if (maxForce !== null) {
      filtered = filtered.filter((card) => {
        const force = card.stats?.force?.value;
        return force !== undefined && force !== null
          ? force <= maxForce
          : false;
      });
    }

    // Recherche dans le texte d'effet (multi-mots, ordre libre, AND)
    if (effectQuery) {
      filtered = filtered.filter((card) => {
        const hay = cardEffectTexts(card).join(" \n ");
        const terms = effectQuery.split(/\s+/).filter(Boolean);
        return terms.every((t) => matchesSearch(hay, t));
      });
    }

    // Masquer les cartes non possédées
    if (hideNotOwned) {
      filtered = filtered.filter((card) => ownedIds.has(card.id));
    }

    return filtered;
  },
  { getKey: filterKey },
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
