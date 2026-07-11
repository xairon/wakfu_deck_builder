/**
 * PAIEMENT AU CHOIX DU JOUEUR (retour utilisateur : « le mana est choisi
 * automatiquement, on n'a pas le choix ») — en local assisté, un coût > 0
 * ouvre l'invite pendingPayment : le joueur clique SES producteurs (re-clic
 * = retrait), ou « Auto » (plan planCost), ou annule (rien n'est consommé).
 * Le paiement est revalidé au jeu (validatePayment — compte exact, dressés,
 * 418.5b élémentaire).
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";
import { createMockAllyCard } from "tests/factories/card";
import type { Card } from "@/types/cards";

const COUT2: Card = createMockAllyCard({
  id: "cout2-payment-test",
  name: "Allié Coûteux",
  stats: { niveau: { value: 2, element: "Neutre" } },
});

function setup() {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [COUT2],
  });
  store.state.turn.number = 2; // hors contrainte « 1er tour »
  // Une carte à jouer (coût 1 — mock Niveau 1) dans MA main.
  const cardId = placeInZone(store, "A", { zone: "main", owner: "A" });
  // DÉTERMINISME : les mocks ex-Action du deck ont Niveau 0 (coût 0 = pas
  // d'invite) selon le mélange — on force une carte à coût 2 connue.
  store.state.instances[cardId].cardId = "cout2-payment-test";
  // Un producteur dédié dressé dans le Monde (en plus du Héros/Havre-Sac).
  const producer = placeInZone(store, "A", { zone: "monde" });
  return { store, cardId, producer };
}

describe("pendingPayment — paiement au choix du joueur", () => {
  it("jouer une carte à coût ouvre l'invite SANS rien consommer", () => {
    const { store, cardId } = setup();
    expect(store.playFromHand(cardId)).toBe(true);
    expect(store.pendingPayment).not.toBeNull();
    expect(store.pendingPayment?.cost).toBeGreaterThan(0);
    // rien n'est joué ni incliné tant que le paiement n'est pas fait
    expect(store.state.seats.A.main).toContain(cardId);
  });

  it("payPick du producteur choisi → LUI est incliné, la carte est jouée", () => {
    const { store, cardId, producer } = setup();
    store.playFromHand(cardId);
    const cost = store.pendingPayment!.cost;
    // choisir exactement `cost` producteurs en commençant par le dédié
    const picks = [
      producer,
      ...store.pendingPayment!.eligible.filter((id) => id !== producer),
    ].slice(0, cost);
    for (const id of picks) store.payPick(id);
    expect(store.pendingPayment).toBeNull();
    expect(store.state.seats.A.main).not.toContain(cardId);
    expect(store.state.instances[producer].orientation).toBe("tapped");
  });

  it("re-clic = désélection ; Annuler = rien consommé, carte en main", () => {
    const { store, cardId, producer } = setup();
    store.playFromHand(cardId);
    store.payPick(producer);
    store.payPick(producer); // retrait
    expect(store.pendingPayment?.chosen).toEqual([]);
    store.payCancel();
    expect(store.pendingPayment).toBeNull();
    expect(store.state.seats.A.main).toContain(cardId);
    expect(store.state.instances[producer].orientation).toBe("upright");
  });

  it("Auto = plan automatique (l'ancien comportement, en un clic)", () => {
    const { store, cardId } = setup();
    store.playFromHand(cardId);
    expect(store.payAuto()).toBe(true);
    expect(store.pendingPayment).toBeNull();
    expect(store.state.seats.A.main).not.toContain(cardId);
  });

  it("clic sur une carte non productrice → refus, l'invite reste ouverte", () => {
    const { store, cardId } = setup();
    store.playFromHand(cardId);
    expect(store.payPick(cardId)).toBe(false); // une carte de la MAIN
    expect(store.pendingPayment).not.toBeNull();
  });
});
