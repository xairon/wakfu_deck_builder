import { describe, it, expect } from "vitest";
import {
  createMockDeck,
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";
import type { Deck } from "@/types/cards";
import type { Seat, DraftEvent, PersistedEvent } from "@/game";
import { createGame, EngineError } from "@/game";
import {
  resolveDraft,
  redactEventForBroadcast,
  type AuthorityContext,
} from "@/game/engine/authority";

function deckFor(seat: Seat): Deck {
  return createMockDeck({
    hero: createMockHeroCard({ id: `${seat}-hero` }),
    havreSac: createMockHavreSacCard({ id: `${seat}-havre` }),
    cards: Array.from({ length: 16 }, (_, i) => ({
      card: createMockAllyCard({ id: `${seat}-ally-${i}` }),
      quantity: 3,
    })),
  });
}
const DECKS = { A: deckFor("A"), B: deckFor("B") } as Record<Seat, Deck>;
const { state } = createGame("g", DECKS, { seedA: "sa", seedB: "sb" });
const ctx = (over: Partial<AuthorityContext> = {}): AuthorityContext => ({
  gameId: "g",
  seq: state.seq + 1,
  ts: 123,
  masterSeed: "SECRET-SERVER-SEED",
  ...over,
});

describe("authority — RNG autoritatif (anti-triche)", () => {
  // Le client tente d'imposer l'ordre identité (pas de mélange) :
  const cheat: DraftEvent = {
    actor: "A",
    type: "SHUFFLE",
    payload: {
      zone: { zone: "pioche", owner: "A" },
      permutation: Array.from({ length: 48 }, (_, i) => i), // identité
    },
  };

  it("ignore la permutation cliente et la dérive de la masterSeed", () => {
    const ev = resolveDraft(state, cheat, ctx());
    const perm = (ev.payload as { permutation: number[] }).permutation;
    expect(perm).toHaveLength(48);
    // ce n'est PAS l'identité demandée par le client
    expect(perm).not.toEqual(Array.from({ length: 48 }, (_, i) => i));
    // c'est bien une permutation
    expect([...perm].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 48 }, (_, i) => i),
    );
  });

  it("déterministe : même (masterSeed, seq) ⇒ même permutation ; seed ≠ ⇒ ≠", () => {
    const a = resolveDraft(state, cheat, ctx({ masterSeed: "S1" }));
    const b = resolveDraft(state, cheat, ctx({ masterSeed: "S1" }));
    const c = resolveDraft(state, cheat, ctx({ masterSeed: "S2" }));
    expect((a.payload as any).permutation).toEqual(
      (b.payload as any).permutation,
    );
    expect((a.payload as any).permutation).not.toEqual(
      (c.payload as any).permutation,
    );
  });

  it("assigne seq/parentSeq/ts depuis le contexte serveur", () => {
    const ev = resolveDraft(state, cheat, ctx({ seq: 99, ts: 555 }));
    expect(ev.seq).toBe(99);
    expect(ev.parentSeq).toBe(state.seq);
    expect(ev.ts).toBe(555);
  });

  it("rejette un MOVE d'une instance inexistante", () => {
    const bad: DraftEvent = {
      actor: "A",
      type: "MOVE",
      payload: {
        instanceId: "nope",
        from: { zone: "main", owner: "A" },
        to: { zone: "monde" },
        position: { at: "any" },
        visibility: { faceDown: false, visibleTo: "all" },
        preservesIdentity: false,
      },
    };
    expect(() => resolveDraft(state, bad, ctx())).toThrow(EngineError);
  });
});

describe("authority — redaction des events diffusés", () => {
  it("retire la permutation d'un SHUFFLE (ordre secret)", () => {
    const ev = resolveDraft(
      state,
      {
        actor: "A",
        type: "SHUFFLE",
        payload: { zone: { zone: "pioche", owner: "A" }, permutation: [] },
      },
      ctx(),
    );
    const forB = redactEventForBroadcast(ev, "B");
    expect((forB.payload as { permutation: number[] }).permutation).toEqual([]);
  });

  it("ne conserve que le fragment privé du destinataire", () => {
    const ev: PersistedEvent = {
      gameId: "g",
      seq: 10,
      parentSeq: 9,
      actor: "A",
      type: "MOVE",
      payload: { tag: "draw" },
      payloadPrivate: { A: { cardId: "A-ally-3" }, B: { cardId: "B-secret" } },
      ts: 1,
    };
    const forA = redactEventForBroadcast(ev, "A");
    const forB = redactEventForBroadcast(ev, "B");
    expect(forA.payloadPrivate).toEqual({ A: { cardId: "A-ally-3" } });
    expect(forB.payloadPrivate).toEqual({ B: { cardId: "B-secret" } });
    // A ne reçoit jamais le fragment de B
    expect(JSON.stringify(forA)).not.toContain("B-secret");
  });

  it("le spectateur ne reçoit aucun fragment privé", () => {
    const ev: PersistedEvent = {
      gameId: "g",
      seq: 1,
      parentSeq: 0,
      actor: "A",
      type: "MOVE",
      payload: {},
      payloadPrivate: { A: { cardId: "secret" } },
      ts: 1,
    };
    expect(
      redactEventForBroadcast(ev, "spectator").payloadPrivate,
    ).toBeUndefined();
  });

  it("GAME_STARTED : masque les cardId non révélés au destinataire", () => {
    const started = createGame("g2", DECKS, {
      seedA: "sa",
      seedB: "sb",
    }).events.find((e) => e.type === "GAME_STARTED")!;
    const idsOf = (ev: PersistedEvent) =>
      Object.values(
        (
          ev.payload as {
            state: { instances: Record<string, { cardId: string }> };
          }
        ).state.instances,
      ).map((i) => i.cardId);
    const forB = idsOf(redactEventForBroadcast(started, "B"));
    // B ne voit ni la Pioche de A, ni la sienne (ordre/identité secrets).
    expect(forB).not.toContain("A-ally-0");
    expect(forB).not.toContain("B-ally-0");
    // mais voit les Héros (révélés à tous).
    expect(forB).toContain("A-hero");
    expect(forB).toContain("B-hero");
    // l'event SOURCE reste complet (le serveur garde tout) — pas de mutation.
    expect(idsOf(started)).toContain("A-ally-0");
  });
});
