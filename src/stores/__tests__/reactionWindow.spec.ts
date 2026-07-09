/**
 * Fenêtre de réaction « façon MTGA » : pendant l'attaque de l'adversaire, le
 * DÉFENSEUR peut jouer une Action et activer ses pouvoirs à inclinaison AUTO —
 * sans dérouler la fenêtre à la main (706.5 / règle « lorsqu'il attaque »). En
 * local uniquement (en ligne = protocole serveur).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockActionCard,
  createMockAllyCard,
} from "tests/factories/card";
import type { Card, Deck } from "@/types/cards";

function heroWithPower(tag: string): Card {
  const face = {
    stats: { pv: 16, pa: 6, pm: 3 },
    effects: [
      {
        description: "inflige 2 Dommages à l'Allié ou Héros de votre choix.",
        compiled: {
          trigger: "onTap",
          ops: [
            {
              op: "damageTarget",
              n: 2,
              element: "Air",
              heroes: true,
              zones: ["monde", "havreSac"],
            },
          ],
        },
      },
    ],
    keywords: [],
  };
  return createMockHeroCard({
    id: tag + "-hero",
    name: tag + " Tirlangue",
    recto: face as never,
    verso: face as never,
  });
}

function smallDeck(hero: Card, cards: Card[]): Deck {
  return {
    id: `deck-${Math.random().toString(36).slice(2)}`,
    name: "test",
    hero: hero as Deck["hero"],
    havreSac: createMockHavreSacCard(),
    cards: cards.map((card) => ({ card, quantity: 1 })),
    reserve: [],
    createdAt: "",
    updatedAt: "",
  };
}

function instOf(store: ReturnType<typeof useGameStore>, cardId: string) {
  return Object.values(store.state.instances).find((i) => i.cardId === cardId)!
    .instanceId;
}

describe("Fenêtre de réaction — le défenseur agit pendant l'attaque adverse (local)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  /** Amène B (attaquant) à déclarer une attaque ; A est défenseur au step blockers. */
  function setupBAttacksA() {
    const action = createMockActionCard({
      id: "a-action",
      name: "Action A",
      stats: { niveau: { value: 0, element: "Neutre" } },
    });
    const atk = createMockAllyCard({
      id: "b-atk",
      name: "Attaquant B",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 2, element: "Feu" },
      },
    });
    useCardStore().cards = [
      heroWithPower("A"),
      heroWithPower("B"),
      action,
      atk,
    ];
    const store = useGameStore();
    store.startSandbox(
      smallDeck(heroWithPower("A"), [action]),
      smallDeck(heroWithPower("B"), [atk]),
      "A",
    );
    store.assistEffects = true;

    const atkId = instOf(store, "b-atk");
    const actionId = instOf(store, "a-action");
    store.moveTo(atkId, { zone: "monde" }); // attaquant B prêt
    store.moveTo(actionId, { zone: "main", owner: "A" }); // Action en main de A

    // Amener le tour de B (turn 4 = 2e tour de B → attaque légale).
    store.nextTurn(); // 2 (B)
    store.nextTurn(); // 3 (A)
    store.nextTurn(); // 4 (B)
    // B déclare l'attaque sur le Havre-Sac de A.
    store.perspective = "B";
    expect(store.beginCombat(atkId)).toBe(true);
    store.combatChooseTarget(store.state.seats.A.havreSacInstanceId!);
    expect(store.combatConfirmAttackers()).toBe(true); // → step blockers
    // Vue rendue au défenseur (comme en solo pendant l'attaque du bot).
    store.perspective = "A";
    return { store, actionId };
  }

  it("le défenseur peut JOUER une Action pendant l'attaque adverse (sans ouvrir la réaction à la main)", () => {
    const { store, actionId } = setupBAttacksA();
    // Aucune fenêtre reactingSeat ouverte : pourtant la légalité de tour est relâchée.
    expect(store.combat?.reactingSeat).toBeFalsy();
    expect(store.playFromHand(actionId)).toBe(true);
    expect(store.ruleError).toBeNull();
    expect(store.state.instances[actionId].location.zone).not.toBe("main");
  });

  it("le défenseur peut ACTIVER un pouvoir pendant l'attaque adverse", () => {
    const { store } = setupBAttacksA();
    const heroA = store.state.seats.A.heroInstanceId!;
    // Le Héros de A active « inflige 2 Dommages » en réaction (cible = attaquant B).
    expect(store.activateTapPower(heroA)).toBe(true);
    expect(store.ruleError).toBeNull();
  });

  it("un attaquant DÉTRUIT par une réaction ne frappe plus à la résolution", () => {
    // A attaque le Havre-Sac de B avec un Allié Force 1 ; B (défenseur) réagit
    // avec le pouvoir de son Héros (2 Dmg), tue l'attaquant, puis on résout : le
    // Havre-Sac de B ne doit PRENDRE AUCUN Dommage (l'attaquant mort ne frappe pas).
    const weak = createMockAllyCard({
      id: "a-weak",
      name: "Faible",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 1, element: "Feu" },
      },
    });
    useCardStore().cards = [
      createMockHeroCard({ id: "A-hero", name: "A Héros" }),
      heroWithPower("B"),
      weak,
    ];
    const store = useGameStore();
    store.startSandbox(
      smallDeck(createMockHeroCard({ id: "A-hero", name: "A Héros" }), [weak]),
      smallDeck(heroWithPower("B"), []),
      "A",
    );
    store.assistEffects = true;

    const atkId = instOf(store, "a-weak");
    store.moveTo(atkId, { zone: "monde" });
    store.nextTurn(); // 2 (B)
    store.nextTurn(); // 3 (A) — A attaque
    store.perspective = "A";
    const sacB = store.state.seats.B.havreSacInstanceId!;
    const resBefore = store.state.instances[sacB].counters.resistance ?? 0;
    expect(store.beginCombat(atkId)).toBe(true);
    store.combatChooseTarget(sacB);
    expect(store.combatConfirmAttackers()).toBe(true); // step blockers

    // B réagit : son Héros inflige 2 Dommages à l'attaquant Force 1 → il meurt.
    store.perspective = "B";
    expect(store.activateTapPower(store.state.seats.B.heroInstanceId!)).toBe(
      true,
    );
    store.effectTargetChoose(atkId); // cible = l'attaquant de A
    expect(store.state.instances[atkId].location.zone).toBe("defausse");

    // Résolution : l'attaquant mort n'inflige rien au Havre-Sac de B.
    store.combatResolve();
    expect(store.state.instances[sacB].counters.resistance ?? 0).toBe(
      resBefore,
    );
  });
});
