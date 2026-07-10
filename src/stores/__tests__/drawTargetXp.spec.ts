/**
 * Intégration store (W42) — drawTargetXp : choisir un Allié en jeu, piocher sa
 * valeur d'XP (card.experience). API publique du store.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";
import { createMockAllyCard } from "tests/factories/card";

describe("drawTargetXp — pioche = valeur d'XP de la cible choisie", () => {
  it("cible d'XP 3 → l'acteur pioche 3 cartes", () => {
    const target = createMockAllyCard({
      id: "cible-xp3",
      name: "Grosse Cible",
      experience: 3,
    });
    const { store } = makeEffectSandbox({
      extraCards: [target],
      allAllies: true,
      first: "A",
    });
    const tid = placeInZone(store, "B", { zone: "monde" });
    store.state.instances[tid].cardId = "cible-xp3";
    const handBefore = store.state.seats.A.main.length;

    store.enqueueEffect({
      seat: "A",
      cardName: "Prospection",
      ops: [{ op: "drawTargetXp", zones: ["monde"] }],
    });
    expect(store.effectTargeting).not.toBeNull();
    store.effectTargetChoose(tid);

    expect(store.state.seats.A.main.length).toBe(handBefore + 3);
    expect(store.effectTargeting).toBeNull();
  });

  it("W75 (Anneau Cérémonial) : filtres sub Unique + recentlyAppeared → seul l'Unique apparu est éligible", () => {
    const unique = createMockAllyCard({
      id: "unique-xp2",
      name: "Allié Unique Frais",
      subTypes: ["Monstre", "Unique"],
      experience: 2,
    });
    const { store } = makeEffectSandbox({
      extraCards: [unique],
      allAllies: true,
      first: "A",
    });
    // Un Allié banal apparu AVANT (marqueur déplacé), puis l'Unique (dernier
    // apparu = porte justAppeared, cf. W74).
    const older = placeInZone(store, "A", { zone: "monde" });
    const tid = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[tid].cardId = "unique-xp2";
    const handBefore = store.state.seats.A.main.length;

    store.enqueueEffect({
      seat: "A",
      cardName: "Anneau Cérémonial",
      ops: [
        {
          op: "drawTargetXp",
          sub: "unique",
          recentlyAppeared: true,
          zones: ["monde"],
        },
      ],
    });
    expect(store.effectTargeting).not.toBeNull();
    expect([...store.effectTargetIdsList]).toEqual([tid]);
    expect([...store.effectTargetIdsList]).not.toContain(older);
    store.effectTargetChoose(tid);

    expect(store.state.seats.A.main.length).toBe(handBefore + 2);
    expect(store.effectTargeting).toBeNull();
  });

  it("W75 : le dernier apparu n'est PAS Unique → aucun éligible, effet abandonné (fizzle)", () => {
    const unique = createMockAllyCard({
      id: "unique-xp2b",
      name: "Allié Unique Ancien",
      subTypes: ["Monstre", "Unique"],
      experience: 2,
    });
    const { store } = makeEffectSandbox({
      extraCards: [unique],
      allAllies: true,
      first: "A",
    });
    // L'Unique apparaît EN PREMIER, puis un banal : le marqueur justAppeared
    // est sur le banal → le filtre sub "unique" ne laisse AUCUNE cible.
    const uid = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[uid].cardId = "unique-xp2b";
    placeInZone(store, "A", { zone: "monde" });
    const handBefore = store.state.seats.A.main.length;

    store.enqueueEffect({
      seat: "A",
      cardName: "Anneau Cérémonial",
      ops: [
        {
          op: "drawTargetXp",
          sub: "unique",
          recentlyAppeared: true,
          zones: ["monde"],
        },
      ],
    });
    expect(store.effectTargeting).toBeNull();
    expect(store.state.seats.A.main.length).toBe(handBefore);
  });
});
