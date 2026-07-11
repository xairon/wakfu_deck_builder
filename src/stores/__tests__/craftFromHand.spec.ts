/**
 * A19 — FABRICATION vague 2 : flux complet `craftFromHand` (418.6).
 * Séquence : incliner l'Artisan du Métier (ciblage) → recycler N cartes de
 * l'Élément depuis la Défausse (picking, filtre élément) → la carte est JOUÉE
 * sans coût (Équipement → choix du Porteur → ATTACH). Annulation en cours de
 * coût = rien n'est perdu (la carte reste en main).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import {
  createMockAllyCard,
  createMockEquipmentCard,
} from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const ANNEAU: Card = createMockEquipmentCard({
  id: "anneau-craft-test",
  name: "Anneau de Fabrication",
  keywords: [
    { name: "Recette", description: ": Bijoutier 2", elements: ["Feu"] },
  ],
});

const ARTISAN: Card = createMockAllyCard({
  id: "artisan-craft-test",
  name: "Bijoutier de Test",
  metier: ["Bijoutier"],
});

const CARTE_FEU: Card = createMockAllyCard({
  id: "carte-feu-craft-test",
  name: "Carte Feu",
  stats: { niveau: { value: 1, element: "Feu" } },
});

function setup() {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [ANNEAU, ARTISAN, CARTE_FEU],
  });
  // Tour 2 (au tour 1, rien n'entre dans le Monde — 506.3).
  store.state.turn.number = 2;
  const equipId = placeInZone(store, "A", { zone: "main", owner: "A" });
  store.state.instances[equipId].cardId = "anneau-craft-test";
  const artisanId = placeInZone(store, "A", { zone: "monde" });
  store.state.instances[artisanId].cardId = "artisan-craft-test";
  // Un PORTEUR éligible (Allié non-Monstre) pour l'Équipement fabriqué.
  const bearerId = placeInZone(store, "A", { zone: "monde" });
  // 3 cartes Feu en Défausse (il en faut 2).
  const feu: string[] = [];
  for (let i = 0; i < 3; i++) {
    const id = placeInZone(store, "A", { zone: "defausse", owner: "A" });
    store.state.instances[id].cardId = "carte-feu-craft-test";
    feu.push(id);
  }
  return { store, equipId, artisanId, bearerId, feu };
}

describe("craftFromHand — fabrication complète (A19)", () => {
  it("Artisan incliné → 2 recyclages Feu → Équipement joué attaché SANS coût", () => {
    const { store, equipId, artisanId, bearerId, feu } = setup();
    expect(store.craftFromHand(equipId)).toBe(true);

    // 1) Ciblage du coût : SEUL l'Artisan Bijoutier est éligible.
    expect(store.effectTargeting?.op.op).toBe("costTapControlled");
    expect([...store.effectTargetIdsList]).toEqual([artisanId]);
    store.effectTargetChoose(artisanId);
    expect(store.state.instances[artisanId].orientation).toBe("tapped");

    // 2) Recyclage : picking dans la Défausse, filtré Feu, 2 cartes imposées.
    expect(store.effectPicking?.zone).toBe("defausse");
    expect(store.effectPickIds).toContain(feu[0]);
    store.effectPick(feu[0]);
    store.effectPick(feu[1]);

    // 3) L'Équipement est joué SANS coût → prompt de Porteur.
    expect(store.pendingBearer?.equipmentId).toBe(equipId);
    expect(store.attachToBearer(bearerId)).toBe(true);

    // Attaché au Porteur, plus en main ; recyclées SOUS la Pioche.
    expect(store.state.instances[bearerId].attachments).toContain(equipId);
    expect(store.state.seats.A.main).not.toContain(equipId);
    expect(store.state.instances[feu[0]].location.zone).toBe("pioche");
    expect(store.state.instances[feu[1]].location.zone).toBe("pioche");
    // La 3e carte Feu est restée en Défausse (2 exactement recyclées).
    expect(store.state.instances[feu[2]].location.zone).toBe("defausse");
  });

  it("annuler au ciblage de l'Artisan : rien n'est consommé, la carte reste en main", () => {
    const { store, equipId, artisanId } = setup();
    expect(store.craftFromHand(equipId)).toBe(true);
    expect(store.effectTargeting?.op.op).toBe("costTapControlled");
    store.effectTargetSkip(); // renoncer au coût
    expect(store.state.instances[artisanId].orientation).toBe("upright");
    expect(store.state.seats.A.main).toContain(equipId);
    expect(store.effectPicking).toBeNull();
  });

  it("refus net quand illégal (pas d'Artisan dressé)", () => {
    const { store, equipId, artisanId } = setup();
    store.state.instances[artisanId].orientation = "tapped";
    expect(store.craftFromHand(equipId)).toBe(false);
    expect(store.effectTargeting).toBeNull();
  });
});
