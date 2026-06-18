/**
 * Harness de CARACTÉRISATION du pipeline d'effets : verrouille le comportement
 * courant du moteur de résolution (gameStore) AVANT son extraction. Tout passe
 * par l'API publique du store (startSandbox + enqueueEffect + effectPick/…),
 * donc ces tests restent valides de part et d'autre du refactor.
 */
import { setActivePinia, createPinia } from "pinia";
import type { Card, Deck } from "@/types/cards";
import type { Seat, ZoneRef } from "@/game";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import {
  createMockAllyCard,
  createMockDeck,
  createMockHeroCard,
  createMockHavreSacCard,
} from "tests/factories/card";

type Store = ReturnType<typeof useGameStore>;

/**
 * Sandbox dédié au pipeline d'effets : Pinia neuf, cartes (Héros + Havre-Sac +
 * deck + extras) référencées dans le cardStore pour que `getCard` résolve,
 * partie démarrée en mode assisté (assistEffects par défaut à true).
 */
export function makeEffectSandbox(opts?: {
  /** Cartes supplémentaires à rendre résolvables par getCard. */
  extraCards?: Card[];
  first?: Seat;
}): { store: Store; deck: Deck; cardStore: ReturnType<typeof useCardStore> } {
  setActivePinia(createPinia());
  const deck = createMockDeck();
  const cardStore = useCardStore();
  const allCards = [
    deck.hero,
    deck.havreSac,
    ...deck.cards.map((dc) => dc.card),
    ...(opts?.extraCards ?? []),
  ].filter((c): c is Card => !!c);
  cardStore.cards = allCards;
  const store = useGameStore();
  store.startSandbox(deck, deck, opts?.first ?? "A");
  return { store, deck, cardStore };
}

/**
 * Met une carte sous contrôle d'un siège dans une zone et renvoie son
 * instanceId, par le chemin réel (pioche → main → zone cible).
 */
export function placeInZone(store: Store, seat: Seat, to: ZoneRef): string {
  store.draw(seat, 1);
  const main = store.state.seats[seat].main;
  const id = main[main.length - 1];
  if (to.zone !== "main") store.moveTo(id, to);
  return id;
}

/** Snapshot compact des compteurs d'une instance (jetons inclus). */
export function counters(store: Store, id: string) {
  const inst = store.state.instances[id];
  return { ...inst.counters, tokens: { ...(inst.counters.tokens ?? {}) } };
}

/** Texte concaténé du journal (asserts de présence). */
export function logText(store: Store): string {
  return store.log.map((l) => l.text).join("\n");
}

export { createMockAllyCard, createMockHeroCard, createMockHavreSacCard };
