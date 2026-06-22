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
  authorizeDraft,
  redactEventForSeat,
  type AuthorityContext,
} from "@/game/engine/authority";
import { deriveState, emptyState } from "@/game/engine/reducer";
import { drawTop, playToWorld, sequence } from "@/game/engine/verbs";

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

function twoSeatState() {
  const deck = (n: string) => ({
    hero: createMockHeroCard({ id: `hero-${n}` }),
    havreSac: createMockHavreSacCard({ id: `hs-${n}` }),
    cards: [
      {
        card: createMockAllyCard({ id: `c-${n}` }),
        quantity: 4,
        isReserve: false,
      },
    ],
    reserve: [],
  });
  // @ts-expect-error minimal deck shape for the engine
  return createGame("g1", { A: deck("a"), B: deck("b") }, { firstPlayer: "A" })
    .state;
}

describe("authorizeDraft", () => {
  it("rejette un type d'event inconnu", () => {
    const s = twoSeatState();
    expect(() =>
      authorizeDraft(s, { actor: "A", type: "HACK" as never, payload: {} }),
    ).toThrow(EngineError);
  });

  it("rejette une action visant une instance dans la zone privée adverse (main/pioche/réserve de B)", () => {
    const s = twoSeatState();
    const bPioche = s.seats.B.pioche[0]; // carte privée de B
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "SET_COUNTER",
        payload: { instanceId: bPioche, counter: "hp", value: 0 },
      }),
    ).toThrow(EngineError);
  });

  it("rejette un MOVE qui sort une carte de la main adverse", () => {
    const s = twoSeatState();
    const bPioche = s.seats.B.pioche[0];
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "MOVE",
        payload: {
          instanceId: bPioche,
          from: { zone: "pioche", owner: "B" },
          to: { zone: "monde" },
          position: { at: "any" },
          visibility: { faceDown: false, visibleTo: "all" },
          preservesIdentity: false,
        },
      }),
    ).toThrow(EngineError);
  });

  it("autorise une action sur ses propres cartes et sur une zone publique", () => {
    const s = twoSeatState();
    const aReserveOrPioche = s.seats.A.pioche[0];
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "SET_ORIENTATION",
        payload: {
          instanceId: s.seats.A.heroInstanceId!,
          orientation: "tapped",
        },
      }),
    ).not.toThrow();
    // sa propre pioche : c'est SA zone privée → autorisé (l'auth ne bloque que l'adverse)
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "SET_COUNTER",
        payload: { instanceId: aReserveOrPioche, counter: "x", value: 1 },
      }),
    ).not.toThrow();
  });

  it("laisse passer les events système (setup)", () => {
    const s = twoSeatState();
    expect(() =>
      authorizeDraft(s, {
        actor: "system",
        type: "SHUFFLE",
        payload: {} as never,
      }),
    ).not.toThrow();
  });

  it("rejette un GAME_STARTED émis par un joueur (system-only)", () => {
    const s = twoSeatState();
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "GAME_STARTED",
        payload: {} as never,
      }),
    ).toThrow(EngineError);
  });

  it("rejette un SHUFFLE de la pioche adverse (zone privée de B)", () => {
    const s = twoSeatState();
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "SHUFFLE",
        payload: { zone: { zone: "pioche", owner: "B" }, permutation: [] },
      }),
    ).toThrow(EngineError);
  });

  it("autorise un SHUFFLE de sa propre pioche", () => {
    const s = twoSeatState();
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "SHUFFLE",
        payload: { zone: { zone: "pioche", owner: "A" }, permutation: [] },
      }),
    ).not.toThrow();
  });

  it("authorizeDraft: MULLIGAN_DONE d'un autre siège est rejeté", () => {
    const s = deriveState(
      createGame("g", DECKS, { seedA: "a", seedB: "b" }).events,
    );
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "MULLIGAN_DONE",
        payload: { seat: "B" },
      }),
    ).toThrow();
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "MULLIGAN_DONE",
        payload: { seat: "A" },
      }),
    ).not.toThrow();
  });
});

describe("redactEventForSeat", () => {
  it("GAME_STARTED redacté pour A : aucun cardId de la pioche/main/réserve de B", () => {
    const decks = {
      A: {
        hero: createMockHeroCard({ id: "hA" }),
        havreSac: createMockHavreSacCard({ id: "sA" }),
        cards: [
          {
            card: createMockAllyCard({ id: "cA" }),
            quantity: 4,
            isReserve: false,
          },
        ],
        reserve: [],
      },
      B: {
        hero: createMockHeroCard({ id: "hB" }),
        havreSac: createMockHavreSacCard({ id: "sB" }),
        cards: [
          {
            card: createMockAllyCard({ id: "cB" }),
            quantity: 4,
            isReserve: false,
          },
        ],
        reserve: [],
      },
    } as unknown as Record<Seat, Deck>;
    const { events } = createGame("g2", decks, { firstPlayer: "A" });
    const started = events.find((e) => e.type === "GAME_STARTED")!;
    const pre = emptyState();
    const post = deriveState([started]);
    const red = redactEventForSeat(started, "A", pre, post);
    const state = (
      red.payload as {
        state: { instances: Record<string, { cardId: string; owner: string }> };
      }
    ).state;
    // Toutes les cartes de B doivent avoir cardId "" SAUF héros/havre-sac (publics)
    for (const inst of Object.values(state.instances)) {
      if (inst.owner === "B" && inst.cardId !== "") {
        expect(["hB", "sB"]).toContain(inst.cardId); // seuls héros/HS de B visibles
      }
    }
  });

  it("piocher : reveals contient le cardId pour le pioucheur, pas pour l'adversaire", () => {
    const decks = {
      A: {
        hero: createMockHeroCard({ id: "hA" }),
        havreSac: createMockHavreSacCard({ id: "sA" }),
        cards: [
          {
            card: createMockAllyCard({ id: "cA" }),
            quantity: 4,
            isReserve: false,
          },
        ],
        reserve: [],
      },
      B: {
        hero: createMockHeroCard({ id: "hB" }),
        havreSac: createMockHavreSacCard({ id: "sB" }),
        cards: [
          {
            card: createMockAllyCard({ id: "cB" }),
            quantity: 4,
            isReserve: false,
          },
        ],
        reserve: [],
      },
    } as unknown as Record<Seat, Deck>;
    const setup = createGame("g3", decks, { firstPlayer: "A" });
    const pre = setup.state;
    const draw = sequence([drawTop(pre, "A")], "g3", pre.seq + 1)[0];
    const post = deriveState([...setup.events, draw]);
    const drawnId = (draw.payload as { instanceId: string }).instanceId;
    const forA = redactEventForSeat(draw, "A", pre, post);
    const forB = redactEventForSeat(draw, "B", pre, post);
    expect(forA.reveals?.[drawnId]).toBe("cA"); // A voit ce qu'il pioche
    expect(forB.reveals?.[drawnId]).toBeUndefined(); // B ne le voit pas
  });

  it("jouer au Monde : reveals délivre le cardId aux DEUX sièges", () => {
    const decks = {
      A: {
        hero: createMockHeroCard({ id: "hA" }),
        havreSac: createMockHavreSacCard({ id: "sA" }),
        cards: [
          {
            card: createMockAllyCard({ id: "cA" }),
            quantity: 4,
            isReserve: false,
          },
        ],
        reserve: [],
      },
      B: {
        hero: createMockHeroCard({ id: "hB" }),
        havreSac: createMockHavreSacCard({ id: "sB" }),
        cards: [
          {
            card: createMockAllyCard({ id: "cB" }),
            quantity: 4,
            isReserve: false,
          },
        ],
        reserve: [],
      },
    } as unknown as Record<Seat, Deck>;
    const setup = createGame("g4", decks, { firstPlayer: "A" });
    const draw = sequence(
      [drawTop(setup.state, "A")],
      "g4",
      setup.state.seq + 1,
    )[0];
    const afterDraw = deriveState([...setup.events, draw]);
    const drawnId = (draw.payload as { instanceId: string }).instanceId;
    const play = sequence(
      [playToWorld("A", drawnId)],
      "g4",
      afterDraw.seq + 1,
    )[0];
    const post = deriveState([...setup.events, draw, play]);
    const forB = redactEventForSeat(play, "B", afterDraw, post);
    expect(forB.reveals?.[drawnId]).toBe("cA"); // B voit la carte jouée
  });
});
