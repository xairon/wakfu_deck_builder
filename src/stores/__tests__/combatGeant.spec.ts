/**
 * Store — 6135 : la répartition de Force d'un attaquant GÉANT bloqué est un
 * CHOIX du joueur (étape « geant » du combat), préremplie avec la politique
 * automatique et éditable (façon MTGA), validée par whyBadGeantAssign.
 */
import { describe, expect, it } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { Card, Deck } from "@/types/cards";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import { createMockAllyCard, createMockDeck } from "tests/factories/card";

function ally(id: string, force: number, geant = false): Card {
  return createMockAllyCard({
    id,
    name: `Allié ${id}`,
    subTypes: ["Bouftou"],
    stats: {
      niveau: { value: 0, element: "Neutre" },
      force: { value: force, element: "Neutre" },
    },
    effects: geant ? [{ description: "Géant" }] : [],
  });
}

let store: ReturnType<typeof useGameStore>;

/** Sandbox : Géant F4 de A dans le Monde, deux bloqueurs F3 de B en face. */
function setup() {
  setActivePinia(createPinia());
  const geant = ally("colosse", 4, true);
  const b1 = ally("bloc1", 3);
  const b2 = ally("bloc2", 3);
  const deckA: Deck = createMockDeck();
  deckA.cards[0] = { card: geant, quantity: 1 };
  const deckB: Deck = createMockDeck();
  deckB.cards[0] = { card: b1, quantity: 1 };
  deckB.cards[1] = { card: b2, quantity: 1 };
  const cardStore = useCardStore();
  cardStore.cards = [
    deckA.hero!,
    deckA.havreSac!,
    ...deckA.cards.map((dc) => dc.card),
    ...deckB.cards.map((dc) => dc.card),
  ].filter((c): c is Card => !!c);
  store = useGameStore();
  store.startSandbox(deckA, deckB, "A");
  const idOf = (cardId: string, owner: "A" | "B") => {
    for (const inst of Object.values(store.state.instances)) {
      if (inst.owner === owner && inst.cardId === cardId)
        return inst.instanceId;
    }
    throw new Error(`carte ${cardId} absente`);
  };
  const gid = idOf(geant.id, "A");
  const b1id = idOf(b1.id, "B");
  const b2id = idOf(b2.id, "B");
  // En jeu AVANT d'avancer les tours (sinon jeton d'arrivée = mal d'invocation).
  store.moveTo(gid, { zone: "monde" });
  store.moveTo(b1id, { zone: "monde" });
  store.moveTo(b2id, { zone: "monde" });
  // Tour ≥ 3 de A : attaque légale (603.2), cartes redressées aux débuts de tour.
  while (store.state.turn.number < 3 || store.state.turn.active !== "A") {
    store.nextTurn();
  }
  const sacB = store.state.seats.B.havreSacInstanceId!;
  return { gid, b1id, b2id, sacB };
}

/** Déclare le combat : Géant attaque le Havre-Sac B, bloqué par b1 et b2. */
function declare(gid: string, b1id: string, b2id: string, sacB: string) {
  if (!store.beginCombat(gid))
    throw new Error(`beginCombat refusé : ${store.ruleError}`);
  if (!store.combat!.attackers.includes(gid))
    throw new Error(`attaquant non retenu : ${store.ruleError}`);
  store.combatChooseTarget(sacB);
  if (!store.combat!.target)
    throw new Error(`cible non retenue : ${store.ruleError}`);
  if (!store.combatConfirmAttackers())
    throw new Error(`confirmation refusée : ${store.ruleError}`);
  // Blocages du défenseur (un seul attaquant → assignation directe).
  store.combatToggleBlock(b1id);
  store.combatToggleBlock(b2id);
  expect(Object.keys(store.combat!.blocks).sort()).toEqual([b1id, b2id].sort());
}

describe("store — répartition de Force du Géant (6135)", () => {
  it("résoudre avec un Géant multi-bloqué ouvre l'étape « geant » préremplie (auto)", () => {
    const { gid, b1id, b2id, sacB } = setup();
    declare(gid, b1id, b2id, sacB);
    store.combatResolve();
    const c = store.combat!;
    expect(c.step).toBe("geant");
    expect(c.geantFor).toBe(gid);
    // Préremplissage = politique auto : létal (3) sur un bloqueur, reliquat (1) sur l'autre.
    const pre = c.geantAssign[gid];
    expect(Object.values(pre).reduce((s, n) => s + n, 0)).toBe(4);
  });

  it("le joueur ajuste la répartition (2/2) et confirme → personne ne meurt", () => {
    const { gid, b1id, b2id, sacB } = setup();
    declare(gid, b1id, b2id, sacB);
    store.combatResolve();
    expect(store.combat!.step).toBe("geant");
    // Repartir de zéro : 2 sur chaque bloqueur.
    const pre = store.combat!.geantAssign[gid];
    for (const [id, n] of Object.entries(pre)) {
      for (let i = 0; i < n; i++) store.combatGeantAdjust(id, -1);
    }
    store.combatGeantAdjust(b1id, +1);
    store.combatGeantAdjust(b1id, +1);
    store.combatGeantAdjust(b2id, +1);
    store.combatGeantAdjust(b2id, +1);
    expect(store.combatGeantConfirm()).toBe(true);
    // Combat résolu : les deux bloqueurs survivent avec 2 Dommages chacun.
    expect(store.combat).toBeNull();
    expect(store.state.instances[b1id].counters.damage).toBe(2);
    expect(store.state.instances[b2id].counters.damage).toBe(2);
    expect(store.state.instances[b1id].location.zone).toBe("monde");
    expect(store.state.instances[b2id].location.zone).toBe("monde");
  });

  it("une répartition invalide est refusée avec un motif (ruleError), sans résoudre", () => {
    const { gid, b1id, b2id, sacB } = setup();
    declare(gid, b1id, b2id, sacB);
    store.combatResolve();
    // Retire 1 au premier candidat prérempli → somme 3 ≠ Force 4.
    const pre = store.combat!.geantAssign[gid];
    const first = Object.keys(pre).find((k) => pre[k] > 0)!;
    store.combatGeantAdjust(first, -1);
    expect(store.combatGeantConfirm()).toBe(false);
    expect(store.ruleError).toContain("Force");
    store.clearRuleError();
    expect(store.combat!.step).toBe("geant"); // toujours en attente
  });
});
