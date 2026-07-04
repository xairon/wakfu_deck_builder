/**
 * Intégration store (W73) — DÉFI : duel avec consentement adverse. Séquence :
 * incliner un duelliste (coût), désigner un défié adverse, l'adversaire accepte
 * (les deux cartes s'infligent SIMULTANÉMENT leur Force en Dommages) ou refuse
 * (le LANCEUR gagne 1 XP).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

/** Allié de Force N (Neutre), sans Résistance → Dommages = Force exactement. */
function ally(id: string, force: number): Card {
  return createMockAllyCard({
    id,
    name: id,
    stats: {
      niveau: { value: 1, element: "Feu" },
      force: { value: force, element: "Feu" },
    },
  });
}

const DUELIST = ally("duelist-w73", 3);
const CHALLENGED = ally("challenged-w73", 5);

const DEFI_OPS = [
  { op: "duelTapDuelist" as const },
  { op: "duelChooseChallenged" as const },
  { op: "duelOffer" as const },
];

function setup() {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [DUELIST, CHALLENGED],
  });
  const duelist = placeInZone(store, "A", { zone: "monde" });
  store.state.instances[duelist].cardId = "duelist-w73";
  const challenged = placeInZone(store, "B", { zone: "monde" });
  store.state.instances[challenged].cardId = "challenged-w73";
  store.enqueueEffect({ seat: "A", cardName: "Défi", ops: DEFI_OPS });
  return { store, duelist, challenged };
}

describe("Défi — duel avec consentement adverse", () => {
  it("désigne duelliste puis défié, propose le défi à l'adversaire", () => {
    const { store, duelist, challenged } = setup();
    // 1er ciblage : le duelliste (une de VOS créatures dressées).
    expect(store.effectTargeting?.op.op).toBe("duelTapDuelist");
    expect(store.effectTargetIdsList).toContain(duelist);
    expect(store.effectTargetIdsList).not.toContain(challenged); // adverse exclu
    store.effectTargetChoose(duelist);
    // le duelliste s'incline.
    expect(store.state.instances[duelist].orientation).toBe("tapped");
    // 2e ciblage : le défié (créature ADVERSE).
    expect(store.effectTargeting?.op.op).toBe("duelChooseChallenged");
    expect(store.effectTargetIdsList).toContain(challenged);
    expect(store.effectTargetIdsList).not.toContain(duelist);
    store.effectTargetChoose(challenged);
    // le défi est proposé (choix Accepter/Refuser).
    expect(store.effectChoice?.optionLabels).toEqual(["Accepter", "Refuser"]);
  });

  it("ACCEPTÉ : les deux cartes s'infligent leur Force (duelliste Force 3 meurt, défié Force 5 survit)", () => {
    const { store, duelist, challenged } = setup();
    store.effectTargetChoose(duelist);
    store.effectTargetChoose(challenged);
    store.effectChoiceResolve(true); // l'adversaire accepte
    // le défié (Force 5) subit 3 et survit ; le duelliste (Force 3) subit 5 et meurt.
    expect(store.state.instances[challenged].counters.damage).toBe(3);
    expect(store.state.instances[duelist].location.zone).toBe("defausse");
  });

  it("ACCEPTÉ, forces égales : DOUBLE KO simultané (les deux paquets calculés avant application)", () => {
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [ally("d5-w73", 5), ally("c5-w73", 5)],
    });
    const duelist = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[duelist].cardId = "d5-w73";
    const challenged = placeInZone(store, "B", { zone: "monde" });
    store.state.instances[challenged].cardId = "c5-w73";
    store.enqueueEffect({ seat: "A", cardName: "Défi", ops: DEFI_OPS });
    store.effectTargetChoose(duelist);
    store.effectTargetChoose(challenged);
    store.effectChoiceResolve(true);
    // les deux (Force 5) subissent 5 → simultanément détruits (si séquentiel avec
    // destruction précoce, le 2e paquet — de la carte morte — ne partirait pas).
    expect(store.state.instances[duelist].location.zone).toBe("defausse");
    expect(store.state.instances[challenged].location.zone).toBe("defausse");
  });

  it("REFUSÉ : le LANCEUR gagne 1 XP, aucun Dommage", () => {
    const { store, duelist, challenged } = setup();
    const heroA = store.state.seats.A.heroInstanceId!;
    const xpBefore = store.state.instances[heroA].counters.xp ?? 0;
    store.effectTargetChoose(duelist);
    store.effectTargetChoose(challenged);
    store.effectChoiceResolve(false); // l'adversaire refuse
    expect(store.state.instances[heroA].counters.xp ?? 0).toBe(xpBefore + 1);
    expect(store.state.instances[challenged].counters.damage ?? 0).toBe(0);
    expect(store.state.instances[duelist].counters.damage ?? 0).toBe(0);
  });

  it("aucune créature dressée à incliner (Héros inclus incliné) : effet abandonné (coût impayable)", () => {
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [DUELIST, CHALLENGED],
    });
    // le Héros de A est un duelliste valide (« Alliés OU Héros ») : on l'incline
    // pour qu'aucune créature dressée du lanceur ne subsiste.
    const heroA = store.state.seats.A.heroInstanceId!;
    store.state.instances[heroA].orientation = "tapped";
    const challenged = placeInZone(store, "B", { zone: "monde" });
    store.state.instances[challenged].cardId = "challenged-w73";
    store.enqueueEffect({ seat: "A", cardName: "Défi", ops: DEFI_OPS });
    // pas de ciblage ouvert (coût sans cible → frame abandonnée).
    expect(store.effectTargeting).toBeNull();
    expect(store.state.instances[challenged].counters.damage ?? 0).toBe(0);
  });
});
