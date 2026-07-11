/**
 * A19 — FABRICATION / RECETTE (règles officielles 305.4 / 401.4 / 418.6 /
 * 408.2), vague 1 : parse de la Recette + légalité de fabrication.
 *
 * 418.6 : « Pour payer un coût de fabrication d'un Équipement, le joueur doit
 * incliner un Artisan possédant le Métier mentionné sur la carte, puis payer
 * la Recette en recyclant une carte d'un Élément donné de sa Défausse pour
 * chaque symbole d'Élément présent dans la Recette. »
 *
 * Données (232 cartes, format uniforme) : keyword
 * { name: "Recette", description: ": <Métier> <N>", elements: ["<Élément>"] }.
 */
import { describe, it, expect } from "vitest";
import { recetteOf } from "@/game/rules/cardAttrs";
import {
  createMockAllyCard,
  createMockEquipmentCard,
} from "tests/factories/card";
import {
  makeEffectSandbox,
  placeInZone,
} from "@/stores/__tests__/effectPipeline.harness";
import { useCardStore } from "@/stores/cardStore";
import type { Card } from "@/types/cards";

const ANNEAU: Card = createMockEquipmentCard({
  id: "anneau-recette-test",
  name: "Anneau de Test",
  keywords: [
    { name: "Recette", description: ": Bijoutier 2", elements: ["Feu"] },
  ],
});

const ARTISAN: Card = createMockAllyCard({
  id: "artisan-bijoutier-test",
  name: "Bijoutier de Test",
  subTypes: ["Eniripsa"],
  // Métier inné en TRAIT (forme réelle des données — cf. Guerya Wood).
  effects: [{ description: "Bijoutier", coverage: "trait" }],
});

const CARTE_FEU: Card = createMockAllyCard({
  id: "carte-feu-test",
  name: "Carte Feu",
  stats: { niveau: { value: 1, element: "Feu" } },
});

describe("recetteOf — parse STRICT du keyword Recette", () => {
  it("forme canonique « : Bijoutier 2 » + [Feu]", () => {
    expect(recetteOf(ANNEAU)).toEqual({
      metier: "Bijoutier",
      n: 2,
      element: "Feu",
    });
  });

  it("formes inconnues → null (jamais d'approximation)", () => {
    const bad = (kw: object) =>
      recetteOf(
        createMockEquipmentCard({ keywords: [kw] as Card["keywords"] }),
      );
    expect(
      bad({
        name: "Recette",
        description: ": Alchimiste 2",
        elements: ["Feu"],
      }),
    ).toBeNull();
    expect(
      bad({ name: "Recette", description: ": Bijoutier", elements: ["Feu"] }),
    ).toBeNull();
    expect(
      bad({ name: "Recette", description: ": Bijoutier 2", elements: [] }),
    ).toBeNull();
    expect(bad({ name: "Géant", description: "" })).toBeNull();
  });
});

function setup() {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [ANNEAU, ARTISAN, CARTE_FEU],
  });
  // L'Anneau EN MAIN de A.
  const equipId = placeInZone(store, "A", { zone: "main", owner: "A" });
  store.state.instances[equipId].cardId = "anneau-recette-test";
  // Un Artisan Bijoutier DRESSÉ dans le Monde de A.
  const artisanId = placeInZone(store, "A", { zone: "monde" });
  store.state.instances[artisanId].cardId = "artisan-bijoutier-test";
  return { store, equipId, artisanId };
}

/** Pose n cartes d'Élément Feu dans la Défausse de A. */
function fillDiscard(store: ReturnType<typeof setup>["store"], n: number) {
  for (let i = 0; i < n; i++) {
    const id = placeInZone(store, "A", { zone: "defausse", owner: "A" });
    store.state.instances[id].cardId = "carte-feu-test";
  }
}

describe("whyCannotCraft — légalité de fabrication (418.6)", () => {
  it("légal : Artisan dressé du bon Métier + 2 cartes Feu en Défausse → null", () => {
    const { store, equipId } = setup();
    expect(useCardStore().cards.length).toBeGreaterThan(0);
    fillDiscard(store, 2);
    expect(store.whyCannotCraft(equipId)).toBeNull();
  });

  it("refus : l'Artisan du Métier est incliné (401.4a exige de l'incliner)", () => {
    const { store, equipId, artisanId } = setup();
    fillDiscard(store, 2);
    store.state.instances[artisanId].orientation = "tapped";
    expect(store.whyCannotCraft(equipId)).toMatch(/artisan/i);
  });

  it("refus : Défausse insuffisante dans l'Élément requis", () => {
    const { store, equipId } = setup();
    fillDiscard(store, 1); // il en faut 2 (Feu)
    expect(store.whyCannotCraft(equipId)).toMatch(/défausse|recycl/i);
  });

  it("refus : carte sans Recette", () => {
    const { store } = setup();
    const noRecette = placeInZone(store, "A", { zone: "main", owner: "A" });
    expect(store.whyCannotCraft(noRecette)).toMatch(/recette/i);
  });
});
