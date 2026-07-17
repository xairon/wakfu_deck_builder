/**
 * 506.3 / 303.1 — PARITÉ STARTER en TABLE LIBRE (bug playtesters : « le premier
 * joueur ne peut rien poser dans le Monde / Alliés refusés au 1er tour »).
 *
 * En table libre, la pose part en MOVE_CARD brut (pas playFromHand) : sans ce
 * correctif le serveur laissait TOUT entrer dans le Monde au 1er tour (trop
 * permissif) et ne routait pas les Alliés vers le Havre-Sac. La vraie règle
 * (rules-reference 4943) : au premier tour du premier joueur, rien n'entre dans
 * le Monde — un Allié/Salle va dans le Havre-Sac, comme dans le module starter.
 */
import { describe, it, expect } from "vitest";
import {
  createMockDeck,
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";
import type { Card, Deck } from "@/types/cards";
import type { Seat, GameState, PersistedEvent } from "@/game";
import { createGame, deriveState, drawTop, sequence } from "@/game";
import { resolveIntent } from "@/game/actions/resolveIntent";

const ZONE_CARD = {
  ...createMockAllyCard({ id: "zone-test", name: "Zone test" }),
  mainType: "Zone",
} as unknown as Card;

function deckFor(seat: Seat): Deck {
  return createMockDeck({
    hero: createMockHeroCard({ id: `${seat}-hero`, name: `Héros ${seat}` }),
    havreSac: createMockHavreSacCard({ id: `${seat}-havre` }),
    cards: Array.from({ length: 16 }, (_, i) => ({
      card: createMockAllyCard({
        id: `${seat}-ally-${i}`,
        name: `${seat} ${i}`,
      }),
      quantity: 3,
    })),
  });
}
const DECKS = { A: deckFor("A"), B: deckFor("B") } as Record<Seat, Deck>;
const CARDS = new Map<string, Card>();
for (const seat of ["A", "B"] as Seat[]) {
  const d = DECKS[seat];
  if (d.hero) CARDS.set(d.hero.id, d.hero);
  if (d.havreSac) CARDS.set(d.havreSac.id, d.havreSac);
  for (const dc of d.cards) CARDS.set(dc.card.id, dc.card);
}
CARDS.set(ZONE_CARD.id, ZONE_CARD);
const getCard = (id: string | null): Card | null =>
  id ? (CARDS.get(id) ?? null) : null;

/** Partie au 1er tour (A actif), une carte en main de A. */
function setup(): { state: GameState; inHand: string } {
  let events: PersistedEvent[] = createGame("tl-t1", DECKS, {
    firstPlayer: "A",
    seedA: "sa",
    seedB: "sb",
  }).events;
  const s0 = deriveState(events);
  events = [...events, ...sequence([drawTop(s0, "A")], "tl-t1", s0.seq + 1)];
  const state = deriveState(events);
  const main = state.seats.A.main;
  return { state, inHand: main[main.length - 1] };
}

function moveIntent(instanceId: string, to: "monde" | "havreSac") {
  return {
    kind: "MOVE_CARD" as const,
    instanceId,
    to:
      to === "monde"
        ? ({ zone: "monde" } as const)
        : ({ zone: "havreSac", owner: "A" } as const),
    position: { at: "any" as const },
  };
}

describe("table libre — 506.3 au premier tour (MOVE_CARD serveur)", () => {
  it("Allié main→Monde au tour 1 : ROUTÉ vers le Havre-Sac (303.1, parité starter)", () => {
    const { state, inHand } = setup();
    const res = resolveIntent(
      state,
      getCard,
      moveIntent(inHand, "monde"),
      "A",
      {
        manual: true,
      },
    );
    expect("error" in res ? res.error : null).toBeNull();
    if (!("events" in res)) throw new Error("events attendus");
    const mv = res.events.find((e) => e.type === "MOVE");
    const to = (mv?.payload as { to?: { zone?: string } }).to;
    expect(to?.zone).toBe("havreSac");
  });

  it("Allié main→Havre-Sac au tour 1 : ACCEPTÉ (le Héros ne remplit pas le sac, Taille 4)", () => {
    const { state, inHand } = setup();
    const res = resolveIntent(
      state,
      getCard,
      moveIntent(inHand, "havreSac"),
      "A",
      { manual: true },
    );
    expect("error" in res ? res.error : null).toBeNull();
  });

  it("Zone main→Monde au tour 1 : REFUSÉE avec le message 506.3", () => {
    const { state, inHand } = setup();
    state.instances[inHand].cardId = "zone-test";
    const res = resolveIntent(
      state,
      getCard,
      moveIntent(inHand, "monde"),
      "A",
      {
        manual: true,
      },
    );
    expect("error" in res && res.error).toContain("premier tour");
  });

  it("Allié main→Monde au tour 2 : entre dans le Monde normalement (pas de reroutage)", () => {
    const { state, inHand } = setup();
    state.turn.number = 2;
    state.turn.active = "B";
    // A joue hors-tour (geste manuel table libre) : la destination reste le Monde.
    const res = resolveIntent(
      state,
      getCard,
      moveIntent(inHand, "monde"),
      "A",
      {
        manual: true,
      },
    );
    expect("error" in res ? res.error : null).toBeNull();
    if (!("events" in res)) throw new Error("events attendus");
    const mv = res.events.find((e) => e.type === "MOVE");
    const to = (mv?.payload as { to?: { zone?: string } }).to;
    expect(to?.zone).toBe("monde");
  });
});
