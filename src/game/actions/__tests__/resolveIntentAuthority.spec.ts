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

// ── 305.x (lot F) — PORTEUR autoritatif au jeu d'un Équipement ────────────────
import { createMockEquipmentCard } from "tests/factories/card";

describe("resolveIntent — PLAY_CARD d'un Équipement : Porteur validé serveur", () => {
  const EQUIP = createMockEquipmentCard({
    id: "equip-authority-test",
    name: "Anneau d'Autorité",
  });

  /** État en cours : tour 2, un Allié de A et un de B dans le Monde, l'Équipement en main de A. */
  function bearerState() {
    const { state, getCard } = playingState();
    state.turn.number = 2;
    const put = (seat: Seat) => {
      const id = state.seats[seat].main[0];
      state.seats[seat].main.splice(0, 1);
      state.monde.push(id);
      const inst = state.instances[id];
      inst.location = { zone: "monde" };
      inst.orientation = "upright";
      return id;
    };
    const myAlly = put("A");
    const oppAlly = put("B");
    const equipId = state.seats.A.main[0];
    state.instances[equipId].cardId = "equip-authority-test";
    const getCard2 = (id: string | null) =>
      id === "equip-authority-test" ? EQUIP : getCard(id);
    return { state, getCard: getCard2, equipId, myAlly, oppAlly };
  }

  it("SANS bearerId → refusé (plus jamais d'Équipement standalone en ligne)", () => {
    const { state, getCard, equipId } = bearerState();
    const r = resolveIntent(
      state,
      getCard,
      { kind: "PLAY_CARD", instanceId: equipId },
      "A",
    );
    expect(isErr(r)).toBe(true);
    expect(isErr(r) && r.error).toMatch(/porteur/i);
  });

  it("bearerId FORGÉ (créature adverse) → refusé", () => {
    const { state, getCard, equipId, oppAlly } = bearerState();
    const r = resolveIntent(
      state,
      getCard,
      { kind: "PLAY_CARD", instanceId: equipId, bearerId: oppAlly },
      "A",
    );
    expect(isErr(r)).toBe(true);
    expect(isErr(r) && r.error).toMatch(/porteur/i);
  });

  it("bearerId VALIDE (mon Allié) → événement ATTACH autoritatif émis", () => {
    const { state, getCard, equipId, myAlly } = bearerState();
    const r = resolveIntent(
      state,
      getCard,
      { kind: "PLAY_CARD", instanceId: equipId, bearerId: myAlly },
      "A",
    );
    expect(isErr(r)).toBe(false);
    const events = !isErr(r) ? r.events : [];
    const att = events.find((e) => e.type === "ATTACH");
    expect(att).toBeTruthy();
    expect(
      (att?.payload as { equipmentId?: string; bearerId?: string })
        ?.equipmentId,
    ).toBe(equipId);
    expect(
      (att?.payload as { equipmentId?: string; bearerId?: string })?.bearerId,
    ).toBe(myAlly);
  });
});

// ── A19 / lot F — FABRICATION autoritative (intent CRAFT, 418.6) ─────────────
describe("resolveIntent — CRAFT : Recette entièrement revalidée serveur", () => {
  const EQUIP_R = createMockEquipmentCard({
    id: "equip-recette-authority",
    name: "Anneau à Recette",
    keywords: [
      { name: "Recette", description: ": Bijoutier 2", elements: ["Feu"] },
    ],
  });
  const ARTISAN_C = createMockAllyCard({
    id: "artisan-authority",
    name: "Bijoutier",
    metier: ["Bijoutier"],
  });
  const FEU_C = createMockAllyCard({
    id: "feu-authority",
    name: "Carte Feu",
    stats: { niveau: { value: 1, element: "Feu" } },
  });

  function craftState() {
    const { state, getCard } = playingState();
    state.turn.number = 2;
    const custom = new Map<string, Card>([
      ["equip-recette-authority", EQUIP_R],
      ["artisan-authority", ARTISAN_C],
      ["feu-authority", FEU_C],
    ]);
    const getCard2 = (id: string | null) =>
      (id && custom.get(id)) || getCard(id);
    const toMonde = (seat: Seat, cardId?: string) => {
      const id = state.seats[seat].main.shift()!;
      state.monde.push(id);
      const inst = state.instances[id];
      inst.location = { zone: "monde" };
      inst.orientation = "upright";
      if (cardId) inst.cardId = cardId;
      return id;
    };
    const toDefausse = (seat: Seat, cardId: string) => {
      const id = state.seats[seat].main.shift()!;
      state.seats[seat].defausse.push(id);
      const inst = state.instances[id];
      inst.location = { zone: "defausse", owner: seat };
      inst.cardId = cardId;
      return id;
    };
    // Main de A regarnie (playingState n'en met que 3) : piocher 3 de plus.
    for (let i = 0; i < 3; i++) {
      const top = state.seats.A.pioche.shift()!;
      state.seats.A.main.push(top);
      state.instances[top].location = { zone: "main", owner: "A" };
    }
    const artisanId = toMonde("A", "artisan-authority");
    const bearerId = toMonde("A");
    const oppAlly = toMonde("B");
    const feu1 = toDefausse("A", "feu-authority");
    const feu2 = toDefausse("A", "feu-authority");
    const equipId = state.seats.A.main[0];
    state.instances[equipId].cardId = "equip-recette-authority";
    return { state, getCard: getCard2, equipId, artisanId, bearerId, oppAlly, feu1, feu2 };
  }

  it("soumission VALIDE → tap Artisan + 2 recyclages sous la Pioche + ATTACH", () => {
    const s = craftState();
    const r = resolveIntent(
      s.state,
      s.getCard,
      { kind: "CRAFT", equipmentId: s.equipId, artisanId: s.artisanId, recycledIds: [s.feu1, s.feu2], bearerId: s.bearerId },
      "A",
    );
    expect(isErr(r) && r.error).toBeFalsy();
    const events = !isErr(r) ? r.events : [];
    expect(events.some((e) => e.type === "SET_ORIENTATION")).toBe(true);
    const moves = events.filter((e) => e.type === "MOVE");
    expect(moves.length).toBe(3); // 2 recyclages + la mise en jeu
    expect(events.some((e) => e.type === "ATTACH")).toBe(true);
  });

  it("Artisan FORGÉ (mauvais Métier / adverse / incliné) → refusé", () => {
    const s1 = craftState();
    const r1 = resolveIntent(s1.state, s1.getCard, { kind: "CRAFT", equipmentId: s1.equipId, artisanId: s1.bearerId, recycledIds: [s1.feu1, s1.feu2], bearerId: s1.bearerId }, "A");
    expect(isErr(r1) && r1.error).toMatch(/artisan/i);
    const s2 = craftState();
    const r2 = resolveIntent(s2.state, s2.getCard, { kind: "CRAFT", equipmentId: s2.equipId, artisanId: s2.oppAlly, recycledIds: [s2.feu1, s2.feu2], bearerId: s2.bearerId }, "A");
    expect(isErr(r2) && r2.error).toMatch(/artisan/i);
    const s3 = craftState();
    s3.state.instances[s3.artisanId].orientation = "tapped";
    const r3 = resolveIntent(s3.state, s3.getCard, { kind: "CRAFT", equipmentId: s3.equipId, artisanId: s3.artisanId, recycledIds: [s3.feu1, s3.feu2], bearerId: s3.bearerId }, "A");
    expect(isErr(r3)).toBe(true);
  });

  it("recyclage FORGÉ (mauvais Élément / hors Défausse / compte faux) → refusé", () => {
    const s1 = craftState();
    // une carte de la MAIN au lieu de la Défausse
    const handCard = s1.state.seats.A.main[1];
    const r1 = resolveIntent(s1.state, s1.getCard, { kind: "CRAFT", equipmentId: s1.equipId, artisanId: s1.artisanId, recycledIds: [s1.feu1, handCard], bearerId: s1.bearerId }, "A");
    expect(isErr(r1) && r1.error).toMatch(/recycl|418/i);
    const s2 = craftState();
    const r2 = resolveIntent(s2.state, s2.getCard, { kind: "CRAFT", equipmentId: s2.equipId, artisanId: s2.artisanId, recycledIds: [s2.feu1], bearerId: s2.bearerId }, "A");
    expect(isErr(r2) && r2.error).toMatch(/exactement 2/i);
    const s3 = craftState();
    const r3 = resolveIntent(s3.state, s3.getCard, { kind: "CRAFT", equipmentId: s3.equipId, artisanId: s3.artisanId, recycledIds: [s3.feu1, s3.feu1], bearerId: s3.bearerId }, "A");
    expect(isErr(r3)).toBe(true); // doublon = compte forgé
  });

  it("hors de son tour → refusé (TURN_BOUND)", () => {
    const s = craftState();
    const r = resolveIntent(s.state, s.getCard, { kind: "CRAFT", equipmentId: s.equipId, artisanId: s.artisanId, recycledIds: [s.feu1, s.feu2], bearerId: s.bearerId }, "B");
    expect(isErr(r)).toBe(true);
  });
});