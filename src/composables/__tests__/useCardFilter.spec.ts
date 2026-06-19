import { describe, it, expect } from "vitest";
import { filterCards, type FilterCriteria } from "../useCardFilter";
import {
  createMockAllyCard,
  createMockHeroCard,
  createMockActionCard,
} from "tests/factories/card";

const base: FilterCriteria = {
  query: "",
  extension: "",
  mainType: "",
  subType: "",
  rarity: "",
  element: "",
  minLevel: null,
  maxLevel: null,
  minCost: null,
  maxCost: null,
  minForce: null,
  maxForce: null,
  effectQuery: "",
  hideNotOwned: false,
  ownedIds: new Set<string>(),
};

describe("useCardFilter — filterCards", () => {
  it("force range : ne garde que les cartes dont la force est dans [min,max]", () => {
    const weak = createMockAllyCard({
      id: "w",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 2, element: "Feu" },
      },
    });
    const strong = createMockAllyCard({
      id: "s",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 9, element: "Feu" },
      },
    });
    expect(
      filterCards([weak, strong], { ...base, minForce: 5 }).map((c) => c.id),
    ).toEqual(["s"]);
  });

  it("force range : exclut les cartes sans valeur de force quand une borne est posée", () => {
    const noForce = createMockActionCard({ id: "a" });
    const withForce = createMockAllyCard({
      id: "b",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 4, element: "Feu" },
      },
    });
    expect(
      filterCards([noForce, withForce], { ...base, minForce: 1 }).map(
        (c) => c.id,
      ),
    ).toEqual(["b"]);
  });

  it("effectQuery : filtre sur le texte d'effet (insensible casse/accents)", () => {
    const hit = createMockAllyCard({
      id: "h",
      effects: [{ description: "Piochez une carte." }],
    });
    const miss = createMockAllyCard({
      id: "m",
      effects: [{ description: "Gagnez 1 XP." }],
    });
    expect(
      filterCards([hit, miss], { ...base, effectQuery: "piochez" }).map(
        (c) => c.id,
      ),
    ).toEqual(["h"]);
  });

  it("effectQuery : pour un Héros, cherche dans recto/verso (pas card.effects)", () => {
    const hero = createMockHeroCard({ id: "hero" });
    hero.recto = { ...hero.recto, effects: [{ description: "Trêve sacrée." }] };
    expect(
      filterCards([hero], { ...base, effectQuery: "treve" }).map((c) => c.id),
    ).toEqual(["hero"]);
  });

  it("hideNotOwned : un changement de ownedIds n'est PAS masqué par le cache mémoïsé", () => {
    // Régression : ownedIds est un Set ; la clé JSON par défaut le sérialise en
    // `{}`, donc deux appels aux mêmes critères mais ownedIds différents
    // renverraient le résultat caché périmé. getKey(filterKey) doit l'éviter.
    const a = createMockAllyCard({ id: "a", name: "A" });
    const b = createMockAllyCard({ id: "b", name: "B" });
    const cards = [a, b];
    expect(
      filterCards(cards, {
        ...base,
        hideNotOwned: true,
        ownedIds: new Set(["a"]),
      }).map((c) => c.id),
    ).toEqual(["a"]);
    // mêmes critères, ownedIds élargi → résultat FRAIS, pas le cache de ["a"]
    expect(
      filterCards(cards, {
        ...base,
        hideNotOwned: true,
        ownedIds: new Set(["a", "b"]),
      }).map((c) => c.id),
    ).toEqual(["a", "b"]);
  });
});
