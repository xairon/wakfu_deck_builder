/**
 * TL3 — TABLE LIBRE : geste manuel d'équipement. `attachSelected` ouvre le
 * ciblage de Porteur (manual:true) pour un Équipement de MA main/plateau ; la
 * résolution (attachToBearer) émet l'intent autoritatif ATTACH (couvert par M1
 * côté resolveIntent). Ici on verrouille la SÉLECTION (pendingBearer).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockEquipmentCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const EQUIP: Card = createMockEquipmentCard({
  id: "equip-x",
  name: "Épée test",
});

describe("TL3 — attachSelected (ciblage de Porteur manuel)", () => {
  it("Équipement de la main + Allié en jeu : ouvre pendingBearer(manual) avec le Porteur éligible", () => {
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [EQUIP],
    });
    store.state.turn.number = 3;
    const ally = placeInZone(store, "A", { zone: "monde" });
    const equip = placeInZone(store, "A", { zone: "main", owner: "A" });
    store.state.instances[equip].cardId = "equip-x";

    const ok = store.attachSelected(equip);
    expect(ok).toBe(true);
    expect(store.pendingBearer?.equipmentId).toBe(equip);
    expect(store.pendingBearer?.manual).toBe(true);
    expect(store.pendingBearer?.eligible).toContain(ally);
  });

  it("sans Allié en jeu : le Héros reste un Porteur éligible (414/305.x)", () => {
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [EQUIP],
    });
    store.state.turn.number = 3;
    const equip = placeInZone(store, "A", { zone: "main", owner: "A" });
    store.state.instances[equip].cardId = "equip-x";

    const ok = store.attachSelected(equip);
    expect(ok).toBe(true);
    const heroA = store.state.seats.A.heroInstanceId!;
    expect(store.pendingBearer?.eligible).toContain(heroA);
  });

  it("carte non-Équipement : accepte (peut être attachée à un Porteur)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    store.state.turn.number = 3;
    const ally = placeInZone(store, "A", { zone: "monde" });
    const ok = store.attachSelected(ally);
    expect(ok).toBe(true);
    expect(store.pendingBearer).not.toBeNull();
  });
});
