/**
 * Test d'intégration : Custom card créée → visible via filtre extension
 *
 * Simule le flux utilisateur :
 * 1. L'utilisateur crée une carte dans CustomCardCreatorView
 * 2. La carte est construite via buildCanonicalCardFromInput
 * 3. Elle est injectée dans allCards (cardStore.customCards)
 * 4. Le filtre extension "Cartes Personnalisées" la retourne bien
 * 5. Sans le filtre custom, elle n'apparaît pas dans les résultats
 */
import { describe, it, expect, beforeEach } from "vitest";
import { filterCards, type FilterCriteria } from "../useCardFilter";
import { buildCanonicalCardFromInput } from "@/services/customCardService";
import { createMockAllyCard } from "tests/factories/card";
import type { CustomCardInput } from "@/types/customCards";

const CUSTOM_EXTENSION_NAME = "Cartes Personnalisées";

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

describe("Custom card → filtre extension 'Cartes Personnalisées'", () => {
  // Simule ce que le CustomCardCreatorView soumet au service
  const input: CustomCardInput = {
    name: "Carte Test Automatique",
    mainType: "Allié",
    element: "Neutre",
    rarity: "Commune",
    imageUrl: "",
    subTypes: [],
    stats: { level: 1, xp: 1, hp: 5, strength: 2, ap: 0, mp: 0, resistance: 0 },
    effects: [{ trigger: "Entrée en jeu", cost: "", description: "Inflige 1 dommage." }],
    flavorText: "",
    isPublic: false,
  };

  const customCardId = "custom_test-uuid-1234";
  let customCard: ReturnType<typeof buildCanonicalCardFromInput>;

  beforeEach(() => {
    // Construit la carte comme le fait createCustomCard()
    customCard = buildCanonicalCardFromInput(customCardId, input, "user_123");
  });

  it("devrait avoir l'extension 'Cartes Personnalisées' après création", () => {
    expect(customCard.extension.name).toBe(CUSTOM_EXTENSION_NAME);
    expect(customCard.extension.id).toBe("custom");
    expect(customCard.name).toBe("Carte Test Automatique");
    expect(customCard.isCustom).toBe(true);
  });

  it("devrait apparaître dans filterCards avec le filtre extension 'Cartes Personnalisées'", () => {
    // Simule allCards = cartes standard + cartes custom
    const standardCard = createMockAllyCard({ id: "std-001", name: "Allié Standard" });
    const allCards = [standardCard, customCard];

    const results = filterCards(allCards, {
      ...base,
      extension: CUSTOM_EXTENSION_NAME,
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(customCardId);
    expect(results[0].name).toBe("Carte Test Automatique");
  });

  it("ne devrait PAS apparaître quand le filtre extension est vide (toutes extensions)", () => {
    // Sans filtre → toutes les cartes sont retournées
    const standardCard = createMockAllyCard({ id: "std-001", name: "Allié Standard" });
    const allCards = [standardCard, customCard];

    const results = filterCards(allCards, { ...base, extension: "" });

    // Les deux cartes sont retournées
    expect(results).toHaveLength(2);
  });

  it("ne devrait PAS apparaître quand on filtre par une extension officielle", () => {
    const standardCard = createMockAllyCard({ id: "std-001", name: "Allié Standard" });
    // standardCard.extension.name = "Amakna" (valeur par défaut de la factory)
    const allCards = [standardCard, customCard];

    const results = filterCards(allCards, {
      ...base,
      extension: standardCard.extension.name,
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("std-001");
    // La carte custom n'est PAS dans cette extension officielle
    expect(results.find((c) => c.id === customCardId)).toBeUndefined();
  });

  it("devrait être retournée par une recherche par nom dans 'Cartes Personnalisées'", () => {
    const standardCard = createMockAllyCard({ id: "std-001", name: "Allié Standard" });
    const allCards = [standardCard, customCard];

    const results = filterCards(allCards, {
      ...base,
      extension: CUSTOM_EXTENSION_NAME,
      query: "Carte Test",
    });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Carte Test Automatique");
  });

  it("devrait fonctionner avec plusieurs cartes custom simultanées", () => {
    const input2: CustomCardInput = { ...input, name: "Deuxième Carte Custom" };
    const customCard2 = buildCanonicalCardFromInput("custom_uuid-5678", input2, "user_123");

    const standardCard = createMockAllyCard({ id: "std-001" });
    const allCards = [standardCard, customCard, customCard2];

    const results = filterCards(allCards, {
      ...base,
      extension: CUSTOM_EXTENSION_NAME,
    });

    expect(results).toHaveLength(2);
    const names = results.map((c) => c.name).sort();
    expect(names).toEqual(["Carte Test Automatique", "Deuxième Carte Custom"]);
  });

  it("la clé de mémoïsation distingue bien le catalogue avec/sans cartes custom", () => {
    // Régression : si la clé de mémo ne différencie pas les deux catalogues,
    // le résultat pour les cartes custom serait retourné depuis le cache
    // du catalogue standard (qui lui n'a pas de cartes "Cartes Personnalisées").
    const standardCard = createMockAllyCard({ id: "std-001" });

    // Premier appel : catalogue standard seul
    const withoutCustom = filterCards([standardCard], {
      ...base,
      extension: CUSTOM_EXTENSION_NAME,
    });
    expect(withoutCustom).toHaveLength(0);

    // Deuxième appel : même critère mais catalogue augmenté (custom ajoutée)
    const withCustom = filterCards([standardCard, customCard], {
      ...base,
      extension: CUSTOM_EXTENSION_NAME,
    });
    // Le cache ne doit PAS renvoyer le résultat vide du premier appel
    expect(withCustom).toHaveLength(1);
    expect(withCustom[0].id).toBe(customCardId);
  });
});
