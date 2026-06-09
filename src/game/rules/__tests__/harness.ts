/**
 * Harnais des tests du moteur de règles : construit une partie réelle via
 * `createGame` (instanceIds déterministes : ci_A_001 = Héros, ci_A_002 =
 * Havre-Sac, ci_A_003+i = i-ème carte du deck) puis manipule l'état par
 * events — exactement comme le store le ferait.
 */
import type {
  Card,
  Deck,
  HeroCard,
  AllyCard,
  CardElement,
} from "@/types/cards";
import {
  createGame,
  deriveState,
  move,
  sequence,
  setCounter,
  setPhase,
  tap,
} from "@/game";
import type { DraftEvent, PersistedEvent, Seat, TurnPhase } from "@/game";
import type { RulesCtx } from "../types";
import {
  createMockAllyCard,
  createMockHavreSacCard,
  createMockHeroCard,
} from "tests/factories/card";

export function makeHero(
  id: string,
  element: CardElement = "Feu",
  force = 2,
): HeroCard {
  return createMockHeroCard({
    id,
    name: `Héros ${id}`,
    recto: {
      stats: { pv: 16, pa: 6, pm: 3, force: { value: force, element } },
      effects: [],
      keywords: [],
    },
    verso: {
      stats: { pv: 20, pa: 7, pm: 3, force: { value: force + 1, element } },
      effects: [],
      keywords: [],
    },
  });
}

export function makeAlly(
  id: string,
  opts: {
    niveau?: number;
    element?: CardElement;
    force?: number;
    xp?: number;
  } = {},
): AllyCard {
  const element = opts.element ?? "Feu";
  return createMockAllyCard({
    id,
    name: `Allié ${id}`,
    stats: {
      niveau: { value: opts.niveau ?? 1, element },
      force: { value: opts.force ?? 2, element },
    },
    experience: opts.xp ?? 1,
  });
}

export interface Fixture {
  events: PersistedEvent[];
  cards: Map<string, Card>;
}

/** ci_A_003 = cardsA[0], ci_A_004 = cardsA[1]… (idem côté B). */
export function instId(seat: Seat, deckIndex: number): string {
  return `ci_${seat}_${String(deckIndex + 3).padStart(3, "0")}`;
}
export const HERO_A = "ci_A_001";
export const SAC_A = "ci_A_002";
export const HERO_B = "ci_B_001";
export const SAC_B = "ci_B_002";

export function fixture(
  cardsA: Card[],
  cardsB: Card[] = [],
  opts: { heroA?: HeroCard; heroB?: HeroCard } = {},
): Fixture {
  const cards = new Map<string, Card>();
  const heroA = opts.heroA ?? makeHero("heroA", "Feu");
  const heroB = opts.heroB ?? makeHero("heroB", "Eau");
  const sacA = createMockHavreSacCard({ id: "sacA" });
  const sacB = createMockHavreSacCard({ id: "sacB" });
  for (const c of [heroA, heroB, sacA, sacB, ...cardsA, ...cardsB])
    cards.set(c.id, c);

  const deck = (hero: HeroCard, sac: Card, cs: Card[]): Deck => ({
    id: `deck-${hero.id}`,
    name: hero.id,
    hero,
    havreSac: sac,
    cards: cs.map((card) => ({ card, quantity: 1 })),
    createdAt: "",
    updatedAt: "",
  });

  const { events } = createGame(
    "test",
    { A: deck(heroA, sacA, cardsA), B: deck(heroB, sacB, cardsB) },
    { firstPlayer: "A", seedA: "sa", seedB: "sb" },
  );
  return { events, cards };
}

export function dispatch(f: Fixture, ...drafts: DraftEvent[]): void {
  if (!drafts.length) return;
  const st = deriveState(f.events);
  f.events = [...f.events, ...sequence(drafts, "test", st.seq + 1)];
}

export function ctxOf(f: Fixture): RulesCtx {
  return {
    state: deriveState(f.events),
    getCard: (id) => (id ? (f.cards.get(id) ?? null) : null),
  };
}

export function setTurn(
  f: Fixture,
  active: Seat,
  number: number,
  phase: TurnPhase = "principale",
): void {
  dispatch(f, setPhase("system", { active, number, phase }));
}

/** Sort une carte de la Pioche vers le Monde (état arbitraire de test). */
export function bringToMonde(
  f: Fixture,
  seat: Seat,
  instanceId: string,
  opts: { tapped?: boolean; arrivedTurn?: number } = {},
): void {
  dispatch(
    f,
    move(seat, {
      instanceId,
      from: { zone: "pioche", owner: seat },
      to: { zone: "monde" },
      position: { at: "any" },
      visibility: { faceDown: false, visibleTo: "all" },
      preservesIdentity: false,
      orientationOnArrival: "upright",
    }),
  );
  if (opts.arrivedTurn !== undefined)
    dispatch(
      f,
      setCounter(seat, instanceId, "arrivedTurn", opts.arrivedTurn, true),
    );
  if (opts.tapped) dispatch(f, tap(seat, instanceId));
}

export function bringToHand(f: Fixture, seat: Seat, instanceId: string): void {
  dispatch(
    f,
    move(seat, {
      instanceId,
      from: { zone: "pioche", owner: seat },
      to: { zone: "main", owner: seat },
      position: { at: "any" },
      visibility: { faceDown: false, visibleTo: [seat] },
      preservesIdentity: false,
    }),
  );
}
