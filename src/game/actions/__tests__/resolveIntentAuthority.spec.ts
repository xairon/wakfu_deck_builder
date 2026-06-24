/**
 * Autorité serveur — tests anti-triche des intentions de mutation bas niveau.
 *
 * `resolveIntent` est l'UNIQUE autorité du jeu EN LIGNE (submit_event l'exécute
 * avec le siège authentifié). L'audit 2026-06-24 a montré qu'être le joueur
 * actif (TURN_BOUND) ne suffisait pas : SET_COUNTER/INC_COUNTER/SET_LEVEL/
 * MOVE_CARD/TAP/UNTAP/ATTACH/DETACH étaient émis sans contrôle de propriété ni de
 * bornes → victoire forgée (xp=18), kill (hp=0 sur l'adverse), ressources
 * infinies (pa/pm), vol/destruction de cartes. Ces tests prouvent que c'est
 * désormais REFUSÉ, et que les coups légitimes (sur ses propres cartes, compteurs
 * non protégés) passent toujours.
 */
import { describe, it, expect } from "vitest";
import {
  createMockDeck,
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";
import type { Card, Deck } from "@/types/cards";
import type { Seat } from "@/game";
import { createGame } from "@/game";
import { drawTop, sequence } from "@/game/engine/verbs";
import { deriveState } from "@/game/engine/reducer";
import { resolveIntent } from "@/game/actions/resolveIntent";

function deckFor(seat: Seat): Deck {
  return createMockDeck({
    hero: createMockHeroCard({ id: `${seat}-hero` }),
    havreSac: createMockHavreSacCard({ id: `${seat}-havre` }),
    cards: Array.from({ length: 16 }, (_, i) => ({
      card: createMockAllyCard({ id: `${seat}-ally-${i}`, name: `Allié ${i}` }),
      quantity: 3,
    })),
  });
}
const DECKS = { A: deckFor("A"), B: deckFor("B") } as Record<Seat, Deck>;

function buildCardIndex(): Map<string, Card> {
  const map = new Map<string, Card>();
  for (const deck of Object.values(DECKS)) {
    if (deck.hero) map.set(deck.hero.id, deck.hero);
    if (deck.havreSac) map.set(deck.havreSac.id, deck.havreSac);
    for (const dc of deck.cards ?? []) map.set(dc.card.id, dc.card);
  }
  return map;
}

/** Partie en cours, joueur actif = A ; 3 cartes en main par siège. */
function playingState() {
  const { events } = createGame("g", DECKS, { seedA: "sa", seedB: "sb" });
  const cardIndex = buildCardIndex();
  const getCard = (id: string | null) =>
    id ? (cardIndex.get(id) ?? null) : null;
  let working = events.slice();
  for (const seat of ["A", "B"] as Seat[]) {
    for (let i = 0; i < 3; i++) {
      const draft = drawTop(deriveState(working), seat);
      const [persisted] = sequence([draft], "g", working.length + 1);
      working = [...working, persisted];
    }
  }
  return { state: deriveState(working), getCard };
}

const isErr = (r: ReturnType<typeof resolveIntent>): r is { error: string } =>
  "error" in r;

describe("resolveIntent — autorité anti-triche (intentions bas niveau)", () => {
  // ── Victoire forgée / compteurs vitaux ─────────────────────────────────────
  it("SET_COUNTER xp=18 sur SON PROPRE Héros → refusé (compteur protégé)", () => {
    const { state, getCard } = playingState();
    const aHero = state.seats.A.heroInstanceId!;
    const r = resolveIntent(
      state,
      getCard,
      { kind: "SET_COUNTER", instanceId: aHero, counter: "xp", value: 18 },
      "A",
    );
    expect(isErr(r)).toBe(true);
    expect(isErr(r) && r.error).toContain("protégé");
  });

  it("INC_COUNTER xp +18 sur son Héros → refusé (compteur protégé)", () => {
    const { state, getCard } = playingState();
    const aHero = state.seats.A.heroInstanceId!;
    const r = resolveIntent(
      state,
      getCard,
      { kind: "INC_COUNTER", instanceId: aHero, counter: "xp", delta: 18 },
      "A",
    );
    expect(isErr(r)).toBe(true);
    expect(isErr(r) && r.error).toContain("protégé");
  });

  it("SET_LEVEL sur son Héros → refusé (le niveau dérive de la progression)", () => {
    const { state, getCard } = playingState();
    const aHero = state.seats.A.heroInstanceId!;
    const r = resolveIntent(
      state,
      getCard,
      { kind: "SET_LEVEL", instanceId: aHero, face: "verso", level: 3 },
      "A",
    );
    expect(isErr(r)).toBe(true);
    expect(isErr(r) && r.error).toContain("niveau");
  });

  it("SET_COUNTER pa=999 / INC pm sur soi → refusé (ressources protégées)", () => {
    const { state, getCard } = playingState();
    const aHero = state.seats.A.heroInstanceId!;
    const pa = resolveIntent(
      state,
      getCard,
      { kind: "SET_COUNTER", instanceId: aHero, counter: "pa", value: 999 },
      "A",
    );
    expect(isErr(pa) && pa.error).toContain("protégé");
    const pm = resolveIntent(
      state,
      getCard,
      { kind: "INC_COUNTER", instanceId: aHero, counter: "pm", delta: 99 },
      "A",
    );
    expect(isErr(pm) && pm.error).toContain("protégé");
  });

  it("paMod (jeton) protégé → refusé (alimente la PA effective)", () => {
    const { state, getCard } = playingState();
    const aHero = state.seats.A.heroInstanceId!;
    const r = resolveIntent(
      state,
      getCard,
      {
        kind: "SET_COUNTER",
        instanceId: aHero,
        counter: "paMod",
        value: 99,
        token: true,
      },
      "A",
    );
    expect(isErr(r) && r.error).toContain("protégé");
  });

  // ── Manipulation des cartes adverses ───────────────────────────────────────
  it("SET_COUNTER hp=0 sur le Héros ADVERSE → refusé (non contrôlé)", () => {
    const { state, getCard } = playingState();
    const bHero = state.seats.B.heroInstanceId!;
    const r = resolveIntent(
      state,
      getCard,
      { kind: "SET_COUNTER", instanceId: bHero, counter: "hp", value: 0 },
      "A",
    );
    expect(isErr(r)).toBe(true);
    expect(isErr(r) && r.error).toContain("contrôles pas");
  });

  it("MOVE_CARD du Héros adverse → refusé (non contrôlé)", () => {
    const { state, getCard } = playingState();
    const bHero = state.seats.B.heroInstanceId!;
    const r = resolveIntent(
      state,
      getCard,
      {
        kind: "MOVE_CARD",
        instanceId: bHero,
        to: { zone: "exil", owner: "B" },
      },
      "A",
    );
    expect(isErr(r)).toBe(true);
    expect(isErr(r) && r.error).toContain("contrôles pas");
  });

  it("MOVE_CARD de SA carte vers la zone privée ADVERSE → refusé", () => {
    const { state, getCard } = playingState();
    const aCard = state.seats.A.main[0];
    const r = resolveIntent(
      state,
      getCard,
      {
        kind: "MOVE_CARD",
        instanceId: aCard,
        to: { zone: "main", owner: "B" },
      },
      "A",
    );
    expect(isErr(r)).toBe(true);
    expect(isErr(r) && r.error).toContain("interdite");
  });

  it("TAP / UNTAP d'une carte adverse → refusé (non contrôlé)", () => {
    const { state, getCard } = playingState();
    const bHero = state.seats.B.heroInstanceId!;
    const tap = resolveIntent(
      state,
      getCard,
      { kind: "TAP", instanceId: bHero },
      "A",
    );
    expect(isErr(tap) && tap.error).toContain("contrôles pas");
    const untap = resolveIntent(
      state,
      getCard,
      { kind: "UNTAP", instanceId: bHero },
      "A",
    );
    expect(isErr(untap) && untap.error).toContain("contrôles pas");
  });

  it("ATTACH avec un équipement adverse → refusé (non contrôlé)", () => {
    const { state, getCard } = playingState();
    const aHero = state.seats.A.heroInstanceId!;
    const bCard = state.seats.B.main[0];
    const r = resolveIntent(
      state,
      getCard,
      { kind: "ATTACH", equipmentId: bCard, bearerId: aHero },
      "A",
    );
    expect(isErr(r)).toBe(true);
    expect(isErr(r) && r.error).toContain("contrôles pas");
  });

  // ── Les coups LÉGITIMES passent toujours ───────────────────────────────────
  it("SET_COUNTER d'un compteur NON protégé sur SA carte → autorisé", () => {
    const { state, getCard } = playingState();
    const aHero = state.seats.A.heroInstanceId!;
    const r = resolveIntent(
      state,
      getCard,
      {
        kind: "SET_COUNTER",
        instanceId: aHero,
        counter: "marqueur",
        value: 1,
        token: true,
      },
      "A",
    );
    expect("events" in r).toBe(true);
    expect("events" in r && r.events).toHaveLength(1);
  });

  it("TAP de SA propre carte → autorisé (SET_ORIENTATION)", () => {
    const { state, getCard } = playingState();
    const aHavre = state.seats.A.havreSac[0];
    const r = resolveIntent(
      state,
      getCard,
      { kind: "TAP", instanceId: aHavre },
      "A",
    );
    expect("events" in r).toBe(true);
    expect("events" in r && r.events[0].type).toBe("SET_ORIENTATION");
  });

  it("MOVE_CARD de SA carte vers SA propre défausse → autorisé", () => {
    const { state, getCard } = playingState();
    const aCard = state.seats.A.main[0];
    const r = resolveIntent(
      state,
      getCard,
      {
        kind: "MOVE_CARD",
        instanceId: aCard,
        to: { zone: "defausse", owner: "A" },
      },
      "A",
    );
    expect("events" in r).toBe(true);
  });
});
