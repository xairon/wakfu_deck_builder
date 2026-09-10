/**
 * TL3 — TABLE LIBRE : geste manuel d'équipement. `attachSelected` ouvre le
 * ciblage de Porteur (manual:true) pour un Équipement de MA main/plateau ; la
 * résolution (attachToBearer) émet l'intent autoritatif ATTACH (couvert par M1
 * côté resolveIntent). Ici on verrouille la SÉLECTION (pendingBearer).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockEquipmentCard, createMockDeck } from "tests/factories/card";
import { createGame } from "@/game";
import { useGameStore } from "../gameStore";
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

  it("attachCard en local : attache directement et met à jour les attachments", () => {
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [EQUIP],
    });
    store.state.turn.number = 3;
    const ally = placeInZone(store, "A", { zone: "monde" });
    const equip = placeInZone(store, "A", { zone: "main", owner: "A" });
    store.state.instances[equip].cardId = "equip-x";

    const ok = store.attachCard(equip, ally);
    expect(ok).toBe(true);
    expect(store.state.instances[ally].attachments).toContain(equip);
  });

  it("attachCard en ligne : soumet une intention ATTACH via submitIntent (évite BAD_EVENT_TYPE)", async () => {
    let emit: ((e: any) => void) | null = null;
    const intents: any[] = [];
    const drafts: any[] = [];
    const transport = {
      submit: async (_id: string, d: any) => {
        drafts.push(d);
        return { seq: 1 };
      },
      submitIntent: async (_id: string, i: any) => {
        intents.push(i);
      },
      subscribe: (_id: string, _seat: any, cb: (e: any) => void) => {
        emit = cb;
        return () => {};
      },
      pull: async () => [],
      concede: async () => {},
    };

    const deck = createMockDeck();
    deck.cards[0] = { card: EQUIP, quantity: 1 };
    const { events } = createGame(
      "g-online-attach",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a", seedB: "b" },
    );
    const store = useGameStore();
    store.connectOnline("g-online-attach", "A", transport, deck);
    for (const ev of events) emit!(ev);

    const heroA = store.state.seats.A.heroInstanceId!;
    const equip = Object.keys(store.state.instances).find(
      (id) => store.state.instances[id].cardId === "equip-x",
    )!;

    const ok = store.attachCard(equip, heroA);
    expect(ok).toBe(true);
    await new Promise((r) => setTimeout(r, 10));

    // Doit avoir émis l'intention ATTACH de haut niveau
    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual({
      kind: "ATTACH",
      equipmentId: equip,
      bearerId: heroA,
    });
    // Ne doit SURTOUT PAS avoir soumis de draft ATTACH direct (qui lève BAD_EVENT_TYPE)
    expect(drafts).toHaveLength(0);
  });

  it("detachCard en ligne : soumet une intention DETACH via submitIntent", async () => {
    let emit: ((e: any) => void) | null = null;
    const intents: any[] = [];
    const drafts: any[] = [];
    const transport = {
      submit: async (_id: string, d: any) => {
        drafts.push(d);
        return { seq: 1 };
      },
      submitIntent: async (_id: string, i: any) => {
        intents.push(i);
      },
      subscribe: (_id: string, _seat: any, cb: (e: any) => void) => {
        emit = cb;
        return () => {};
      },
      pull: async () => [],
      concede: async () => {},
    };

    const deck = createMockDeck();
    deck.cards[0] = { card: EQUIP, quantity: 1 };
    const { events } = createGame(
      "g-online-detach",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a", seedB: "b" },
    );
    const store = useGameStore();
    store.connectOnline("g-online-detach", "A", transport, deck);
    for (const ev of events) emit!(ev);

    const heroA = store.state.seats.A.heroInstanceId!;
    const equip = Object.keys(store.state.instances).find(
      (id) => store.state.instances[id].cardId === "equip-x",
    )!;
    store.state.instances[heroA].attachments = [equip];

    store.detachCard(equip, "monde");
    await new Promise((r) => setTimeout(r, 10));

    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual({
      kind: "DETACH",
      equipmentId: equip,
      to: { zone: "monde" },
      position: { at: "any" },
    });
    expect(drafts).toHaveLength(0);
  });
});
