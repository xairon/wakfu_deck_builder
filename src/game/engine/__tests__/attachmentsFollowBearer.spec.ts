/**
 * 305.x — les cartes PORTÉES suivent leur Porteur (bug rapporté 2026-07-10 :
 * un Allié portant deux Équipements est tué au combat → les Équipements
 * restaient des ORPHELINS invisibles, hors de toute zone, au lieu d'aller à
 * la Défausse). Règle appliquée AU REDUCER (applyMove) pour couvrir TOUS les
 * chemins de sortie du jeu d'un coup : combat, destruction ciblée,
 * bannissement, retour en main, recyclage, chemins online — même règle que
 * la passe d'état 1414/3019 (destruction.ts) qui, elle, émettait déjà ses
 * DETACH explicites.
 */
import { describe, it, expect } from "vitest";
import {
  createMockDeck,
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";
import type { Deck } from "@/types/cards";
import type { Seat, DraftEvent, GameState, PersistedEvent } from "@/game";
import {
  createGame,
  deriveState,
  attach,
  discard,
  move,
  worldHavenSwap,
  sequence,
} from "@/game";

function deckFor(seat: Seat): Deck {
  return createMockDeck({
    hero: createMockHeroCard({ id: `${seat}-hero`, name: `Héros ${seat}` }),
    havreSac: createMockHavreSacCard({
      id: `${seat}-havre`,
      name: `Havre ${seat}`,
    }),
    cards: Array.from({ length: 16 }, (_, i) => ({
      card: createMockAllyCard({
        id: `${seat}-ally-${i}`,
        name: `${seat} Allié ${i}`,
      }),
      quantity: 3,
    })),
  });
}
const DECKS = { A: deckFor("A"), B: deckFor("B") } as Record<Seat, Deck>;
const GID = "game-attach-test";

function play(...steps: Array<(s: GameState) => DraftEvent[]>): {
  events: PersistedEvent[];
  state: GameState;
} {
  let all = createGame(GID, DECKS, { seedA: "sa", seedB: "sb" }).events;
  for (const step of steps) {
    const s = deriveState(all);
    all = [...all, ...sequence(step(s), GID, s.seq + 1)];
  }
  return { events: all, state: deriveState(all) };
}

/** Sort le Porteur + 2 portés en jeu : renvoie [bearerId, e1, e2]. */
function setupBearer(s: GameState): {
  ids: [string, string, string];
  drafts: DraftEvent[];
} {
  const [bearer, e1, e2] = s.seats.A.pioche;
  const toMonde = (id: string): DraftEvent =>
    move("A", {
      instanceId: id,
      from: { zone: "pioche", owner: "A" },
      to: { zone: "monde" },
      position: { at: "any" },
      visibility: { faceDown: false, visibleTo: "all" },
      preservesIdentity: false,
      orientationOnArrival: "upright",
    });
  return {
    ids: [bearer, e1, e2],
    drafts: [toMonde(bearer), attach("A", e1, bearer), attach("A", e2, bearer)],
  };
}

describe("reducer — les portés suivent leur Porteur (305.x)", () => {
  it("Porteur défaussé → ses 2 portés vont à la Défausse (3 cartes, sans doublon)", () => {
    let ids: [string, string, string] = ["", "", ""];
    const { state } = play(
      (s) => {
        const r = setupBearer(s);
        ids = r.ids;
        return r.drafts;
      },
      (s) => [
        discard("A", ids[0], s.instances[ids[0]].location), // mort du Porteur
      ],
    );
    const [bearer, e1, e2] = ids;
    const defausse = state.seats.A.defausse;
    expect(defausse).toContain(bearer);
    expect(defausse).toContain(e1);
    expect(defausse).toContain(e2);
    // pas de doublon d'id dans la pile
    expect(new Set(defausse).size).toBe(defausse.length);
    expect(state.instances[e1].location.zone).toBe("defausse");
    expect(state.instances[e2].location.zone).toBe("defausse");
    // le Porteur mort ne référence plus rien (pas de résurrection fantôme)
    expect(state.instances[bearer].attachments).toEqual([]);
  });

  it("échange Monde↔Havre-Sac : les portés restent CO-LOCALISÉS (pas défaussés)", () => {
    let ids: [string, string, string] = ["", "", ""];
    const { state } = play(
      (s) => {
        const r = setupBearer(s);
        ids = r.ids;
        return r.drafts;
      },
      () => [worldHavenSwap("A", ids[0], "monde")],
    );
    const [bearer, e1, e2] = ids;
    expect(state.instances[bearer].location.zone).toBe("havreSac");
    expect(state.instances[bearer].attachments).toEqual([e1, e2]);
    expect(state.instances[e1].location.zone).toBe("havreSac");
    expect(state.instances[e2].location.zone).toBe("havreSac");
    // toujours attachés : dans AUCUNE pile
    expect(state.seats.A.defausse).not.toContain(e1);
    expect(state.seats.A.defausse).not.toContain(e2);
  });

  it("DETACH explicite vers la Défausse APRÈS le départ du Porteur : idempotent (pas de doublon)", () => {
    // La passe d'état (destruction.ts) émet discard(Porteur) PUIS detach(porté).
    // Le reducer ayant déjà défaussé le porté au discard du Porteur, le DETACH
    // qui suit ne doit PAS dupliquer l'entrée dans la pile.
    let ids: [string, string, string] = ["", "", ""];
    const { state } = play(
      (s) => {
        const r = setupBearer(s);
        ids = r.ids;
        return r.drafts;
      },
      (s) => [
        discard("A", ids[0], s.instances[ids[0]].location),
        {
          actor: "A",
          type: "DETACH",
          payload: {
            equipmentId: ids[1],
            to: { zone: "defausse", owner: "A" },
            position: { at: "top" },
          },
        } as DraftEvent,
      ],
    );
    const defausse = state.seats.A.defausse;
    expect(defausse.filter((id) => id === ids[1])).toHaveLength(1);
    expect(new Set(defausse).size).toBe(defausse.length);
  });
});
