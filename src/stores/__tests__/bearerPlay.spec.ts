/**
 * Store — action de jeu ÉQUIPER (305.x, lot F) : jouer un Équipement / une
 * Monture à bonus de Porteur l'ATTACHE à une créature contrôlée (ouvre un
 * ciblage de Porteur), au lieu de l'arriver en standalone. Le bonus de Force
 * devient vivant une fois porté.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { Card, Deck } from "@/types/cards";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import { createMockAllyCard, createMockDeck } from "tests/factories/card";
import { effectiveForce } from "@/game/rules";

/** Monture (Allié) à bonus de Porteur « +N en Force ». */
function mount(id: string, n: number): Card {
  const name = `Monture ${id}`;
  return createMockAllyCard({
    id,
    name,
    subTypes: ["Monstre", "Monture"],
    stats: { niveau: { value: 1, element: "Neutre" } },
    effects: [{ description: `Le Porteur de ${name} gagne +${n} en Force.` }],
  });
}

/** Allié « ordinaire » (Porteur potentiel, non-Monstre) de Force connue. */
function plainAlly(id: string, force: number): Card {
  return createMockAllyCard({
    id,
    name: `Allié ${id}`,
    subTypes: ["Bouftou"],
    stats: {
      niveau: { value: 1, element: "Neutre" },
      force: { value: force, element: "Neutre" },
    },
  });
}

let store: ReturnType<typeof useGameStore>;

/** Sandbox : deck dont la 1re carte est un Porteur, la 2e une Monture-bonus. */
function setup(bearerForce = 3, bonus = 2): { bearer: Card; equip: Card } {
  setActivePinia(createPinia());
  const bearer = plainAlly("bearer", bearerForce);
  const equip = mount("equip", bonus);
  const deck: Deck = createMockDeck();
  // Force les deux premières cartes du deck à nos cartes (le reste = remplissage).
  deck.cards[0] = { card: bearer, quantity: 1 };
  deck.cards[1] = { card: equip, quantity: 1 };
  const cardStore = useCardStore();
  cardStore.cards = [
    deck.hero!,
    deck.havreSac!,
    ...deck.cards.map((dc) => dc.card),
  ].filter((c): c is Card => !!c);
  store = useGameStore();
  store.startSandbox(deck, deck, "A");
  // 601 — rien n'entre dans le Monde au tour 1 : on avance jusqu'au tour de A ≥ 2.
  while (store.state.turn.number < 2 || store.state.turn.active !== "A") {
    store.nextTurn();
  }
  return { bearer, equip };
}

/** Localise l'instance d'une carte (par id de carte) chez A, retourne son id. */
function instanceOf(cardId: string): string {
  for (const inst of Object.values(store.state.instances)) {
    if (inst.owner === "A" && inst.cardId === cardId) return inst.instanceId;
  }
  throw new Error(`carte ${cardId} absente`);
}

/** Amène une carte (par id de carte) en main de A, retourne son instanceId. */
function toHand(cardId: string): string {
  const id = instanceOf(cardId);
  store.moveTo(id, { zone: "main", owner: "A" });
  return id;
}

describe("store — équiper un Porteur (305.x)", () => {
  beforeEach(() => setup());

  it("jouer une Monture-bonus ouvre un ciblage de Porteur (pas d'arrivée standalone)", () => {
    const { bearer, equip } = setup(3, 2);
    const bearerId = toHand(bearer.id);
    store.moveTo(bearerId, { zone: "monde" });
    const equipId = toHand(equip.id);
    const before = store.state.instances[equipId].location.zone;
    expect(before).toBe("main");
    const ok = store.playFromHand(equipId);
    expect(ok).toBe(true);
    // L'équipement n'a PAS bougé : en attente du clic sur le Porteur.
    expect(store.state.instances[equipId].location.zone).toBe("main");
    expect(store.pendingBearer).not.toBeNull();
    expect(store.pendingBearer!.eligible).toContain(bearerId);
  });

  it("attachToBearer joue l'équipement attaché et applique le +Force", () => {
    const { bearer, equip } = setup(3, 2);
    const bearerId = toHand(bearer.id);
    store.moveTo(bearerId, { zone: "monde" });
    // Force de base avant attachement.
    expect(effectiveForce(store.rulesCtx(), bearerId)).toBe(3);
    const equipId = toHand(equip.id);
    store.playFromHand(equipId);
    const ok = store.attachToBearer(bearerId);
    expect(ok).toBe(true);
    expect(store.pendingBearer).toBeNull();
    const inst = store.state.instances[equipId];
    // L'équipement est en jeu et listé dans les attachments du Porteur.
    expect(inst.location.zone).toBe("monde");
    expect(store.state.instances[bearerId].attachments).toContain(equipId);
    // +2 de Force appliqué au Porteur (3 → 5).
    expect(effectiveForce(store.rulesCtx(), bearerId)).toBe(5);
  });

  it("le Héros contrôlé est un Porteur éligible (toujours en jeu)", () => {
    const { equip } = setup(3, 2);
    const equipId = toHand(equip.id);
    const ok = store.playFromHand(equipId);
    // Même sans Allié en jeu, le Héros de A (ci_A_001) peut porter l'équipement.
    expect(ok).toBe(true);
    expect(store.pendingBearer).not.toBeNull();
    expect(store.pendingBearer!.eligible).toContain("ci_A_001");
  });

  it("rejette un clic sur une cible non éligible (le Havre-Sac)", () => {
    const { bearer, equip } = setup(3, 2);
    const bearerId = toHand(bearer.id);
    store.moveTo(bearerId, { zone: "monde" });
    const equipId = toHand(equip.id);
    store.playFromHand(equipId);
    // Le Havre-Sac de A (ci_A_002) n'est pas une créature → cible invalide.
    const bad = store.attachToBearer("ci_A_002");
    expect(bad).toBe(false);
    expect(store.pendingBearer).not.toBeNull(); // prompt toujours ouvert
  });
});
