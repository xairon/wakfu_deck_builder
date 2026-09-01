/**
 * Mise en place initiale — Module de jeu (L1). Réf. §5, règles 102.1/306.1/307.1.
 * Havre-Sac → Monde ; Héros → Havre-Sac ; 48 cartes → Pioche (face cachée) ;
 * réserve → Réserve. Puis mélange autoritatif de chaque Pioche.
 */
import type { Deck } from "@/types/cards";
import type { CardInstance, GameState } from "../types/state";
import type { DraftEvent, PersistedEvent } from "../types/events";
import type { Seat } from "../types/zones";
import { emptyState } from "./reducer.ts";
import { deriveState } from "./reducer.ts";
import { shuffle, sequence } from "./verbs.ts";
import { permutationFromSeed } from "./rng.ts";

/** Lit défensivement les PV du Héros (forme de stats variable selon les cartes). */
function getHeroPv(hero: unknown): number | undefined {
  const h = hero as {
    recto?: { stats?: Record<string, unknown> };
    stats?: Record<string, unknown>;
  };
  const s = h?.recto?.stats ?? h?.stats;
  const pv = (s?.pv ?? s?.hp ?? s?.vie) as unknown;
  return typeof pv === "number" ? pv : undefined;
}

/** Lit défensivement une stat imprimée du recto du Héros (pa/pm…), repli undefined.
 *  Évite de figer PA=6/PM=3 : la main de départ (4873) et le plafond d'attaquants
 *  (703) en dépendent — un Héros N1 non standard recevait sinon de mauvaises valeurs. */
function getHeroStat(hero: unknown, key: string): number | undefined {
  const h = hero as {
    recto?: { stats?: Record<string, unknown> };
    stats?: Record<string, unknown>;
  };
  const v = (h?.recto?.stats ?? h?.stats)?.[key] as unknown;
  return typeof v === "number" ? v : undefined;
}

export interface SetupOptions {
  firstPlayer?: Seat;
  masterSeedHash?: string;
  seedA?: string;
  seedB?: string;
}

/** Layout déterministe AVANT mélange (Pioche initiale mélangée d'emblée). */
export function buildInitialLayout(
  gameId: string,
  decks: Partial<Record<Seat, Deck>>,
  firstPlayer: Seat = "A",
  opts: SetupOptions = {},
): GameState {
  const state = emptyState();
  state.gameId = gameId;
  state.status = "active";
  const seatList = Object.keys(decks) as Seat[];
  if (seatList.length > 2) {
    state.mode = "2v2";
    state.teamXp = { team1: 0, team2: 0 };
    state.eliminatedSeats = [];
  }
  state.turn = {
    active: firstPlayer,
    number: 1,
    phase: "principale",
    firstPlayer,
  };

  for (const seat of seatList) {
    const deck = decks[seat];
    if (!deck) continue;
    if (!state.seats[seat]) {
      state.seats[seat] = {
        seat,
        pioche: [],
        main: [],
        havreSac: [],
        defausse: [],
        reserve: [],
        exil: [],
        limbo: [],
      };
    }
    const board = state.seats[seat]!;
    let n = 0;
    const mkId = () => `ci_${seat}_${String(++n).padStart(3, "0")}`;
    const add = (inst: CardInstance) => {
      state.instances[inst.instanceId] = inst;
    };

    if (deck.hero) {
      const id = mkId();
      const pv = getHeroPv(deck.hero);
      add({
        instanceId: id,
        cardId: deck.hero.id,
        owner: seat,
        controller: seat,
        location: { zone: "havreSac", owner: seat },
        face: "recto",
        orientation: "upright",
        counters: {
          level: 1,
          xp: 0,
          // PA/PM imprimés du Héros (repli 6/3 si absents) — pas de valeur figée.
          pa: getHeroStat(deck.hero, "pa") ?? 6,
          pm: getHeroStat(deck.hero, "pm") ?? 3,
          ...(pv !== undefined ? { hp: pv } : {}),
        },
        attachments: [],
        revealedTo: seatList,
      });
      board.havreSac.push(id);
      board.heroInstanceId = id;
    }

    if (deck.havreSac) {
      const id = mkId();
      // Résistance imprimée du Havre-Sac (2303) → compteur courant
      const resistance = (deck.havreSac as { stats?: { resistance?: number } })
        .stats?.resistance;
      add({
        instanceId: id,
        cardId: deck.havreSac.id,
        owner: seat,
        controller: seat,
        location: { zone: "monde" },
        face: "recto",
        orientation: "upright",
        counters: typeof resistance === "number" ? { resistance } : {},
        attachments: [],
        revealedTo: seatList,
      });
      state.monde.push(id);
      board.havreSacInstanceId = id;
    }

    for (const dc of deck.cards ?? []) {
      const zone: "pioche" | "reserve" = dc.isReserve ? "reserve" : "pioche";
      for (let q = 0; q < dc.quantity; q++) {
        const id = mkId();
        add({
          instanceId: id,
          cardId: dc.card.id,
          owner: seat,
          controller: seat,
          location: { zone, owner: seat },
          face: zone === "pioche" ? "hidden" : "recto",
          orientation: null,
          counters: {},
          attachments: [],
          revealedTo: zone === "reserve" ? [seat] : [],
        });
        board[zone].push(id);
      }
    }

    const piocheSize = board.pioche.length;
    if (piocheSize > 1) {
      const seed =
        seat === "A" || seat === "A1"
          ? (opts.seedA ?? `${gameId}:A:init:${Math.random().toString(36).slice(2)}`)
          : seat === "B" || seat === "B1"
            ? (opts.seedB ?? `${gameId}:B:init:${Math.random().toString(36).slice(2)}`)
            : `${gameId}:${seat}:init:${Math.random().toString(36).slice(2)}`;
      const perm = permutationFromSeed(piocheSize, seed);
      board.pioche = perm.map((i) => board.pioche[i]);
    }
  }
  return state;
}

/** Events de mise en place : GAME_STARTED (layout) + un SHUFFLE par Pioche. */
export function setupEvents(
  gameId: string,
  decks: Partial<Record<Seat, Deck>>,
  opts: SetupOptions = {},
): DraftEvent[] {
  const layout = buildInitialLayout(
    gameId,
    decks,
    opts.firstPlayer ?? "A",
    opts,
  );
  layout.rng.masterSeedHash = opts.masterSeedHash ?? "";
  const events: DraftEvent[] = [
    { actor: "system", type: "GAME_STARTED", payload: { state: layout } },
  ];
  const seats = Object.keys(decks) as Seat[];

  for (const seat of seats) {
    const size = layout.seats[seat]?.pioche.length ?? 0;
    if (size > 1) {
      const seed =
        (opts as Record<string, string | undefined>)[`seed${seat}`] ??
        `${gameId}:${seat}:${Math.random().toString(36).slice(2)}`;
      events.push(
        shuffle("system", { zone: "pioche", owner: seat }, size, seed),
      );
    }
  }
  return events;
}

/** Crée une partie prête : journal initial + état dérivé (mélangé). */
export function createGame(
  gameId: string,
  decks: Partial<Record<Seat, Deck>>,
  opts: SetupOptions = {},
): { events: PersistedEvent[]; state: GameState } {
  const events = sequence(setupEvents(gameId, decks, opts), gameId);
  return { events, state: deriveState(events) };
}
