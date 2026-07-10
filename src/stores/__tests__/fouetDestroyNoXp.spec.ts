/**
 * Intégration store (W76) — Fouet : destroyTarget nonUnique + recentlyAppeared
 * + noXp. Le Monstre non Unique qui VIENT d'apparaître est détruit ; le
 * lanceur NE gagne PAS l'XP de la destruction (415.1 suspendu pour « vous »
 * seul) ; un Monstre Unique marqué n'est PAS éligible.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const MONSTRE: Card = createMockAllyCard({
  id: "monstre-banal-test",
  name: "Monstre Banal",
  subTypes: ["Monstre"],
  experience: 2,
});

const MONSTRE_UNIQUE: Card = createMockAllyCard({
  id: "monstre-unique-test",
  name: "Monstre Unique",
  subTypes: ["Monstre", "Unique"],
  experience: 2,
});

const FOUET_OP = {
  op: "destroyTarget" as const,
  what: "Allié" as const,
  sub: "monstre",
  nonUnique: true,
  recentlyAppeared: true,
  noXp: true,
  zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
};

describe("Fouet — destruction sans XP du Monstre non Unique apparu", () => {
  it("détruit le Monstre apparu SANS accorder d'XP au lanceur", () => {
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [MONSTRE],
    });
    const tid = placeInZone(store, "B", { zone: "monde" });
    store.state.instances[tid].cardId = "monstre-banal-test";
    const heroA = store.state.seats.A.heroInstanceId!;
    const xpBefore = store.state.instances[heroA].counters.xp ?? 0;

    store.enqueueEffect({ seat: "A", cardName: "Fouet", ops: [FOUET_OP] });
    expect(store.effectTargeting).not.toBeNull();
    store.effectTargetChoose(tid);

    expect(store.state.instances[tid].location.zone).toBe("defausse");
    // « Vous ne gagnez pas d'XP » : l'XP de 415.1 (destruction d'un Allié
    // adverse → XP au lanceur) est SUPPRIMÉ.
    expect(store.state.instances[heroA].counters.xp ?? 0).toBe(xpBefore);
  });

  it("un Monstre Unique marqué n'est PAS éligible (nonUnique)", () => {
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [MONSTRE_UNIQUE],
    });
    const tid = placeInZone(store, "B", { zone: "monde" });
    store.state.instances[tid].cardId = "monstre-unique-test";

    store.enqueueEffect({ seat: "A", cardName: "Fouet", ops: [FOUET_OP] });
    // Seul candidat = Unique → exclu → aucun éligible, effet abandonné.
    expect(store.effectTargeting).toBeNull();
    expect(store.state.instances[tid].location.zone).toBe("monde");
  });
});
