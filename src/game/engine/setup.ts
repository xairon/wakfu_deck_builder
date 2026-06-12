/**
 * Mise en place initiale — Module de jeu (L1). Réf. §5, règles 102.1/306.1/307.1.
 * Havre-Sac → Monde ; Héros → Havre-Sac ; 48 cartes → Pioche (face cachée) ;
 * réserve → Réserve. Puis mélange autoritatif de chaque Pioche.
 */
import type { Deck } from "@/types/cards";
import type { CardInstance, GameState } from "../types/state";
import type { DraftEvent, PersistedEvent } from "../types/events";
import type { Seat } from "../types/zones";
import { emptyState } from "./reducer";
import { deriveState } from "./reducer";
import { shuffle, sequence } from "./verbs";

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

export interface SetupOptions {
  firstPlayer?: Seat;
  masterSeedHash?: string;
  seedA?: string;
  seedB?: string;
}

/** Layout déterministe AVANT mélange (Pioche dans l'ordre du deck). */
export function buildInitialLayout(
  gameId: string,
  decks: Record<Seat, Deck>,
  firstPlayer: Seat = "A",
): GameState {
  const state = emptyState();
  state.gameId = gameId;
  state.status = "active";
  state.turn = {
    active: firstPlayer,
    number: 1,
    phase: "principale",
    firstPlayer,
  };

  for (const seat of ["A", "B"] as Seat[]) {
    const deck = decks[seat];
    const board = state.seats[seat];
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
          pa: 6,
          pm: 3,
          ...(pv !== undefined ? { hp: pv } : {}),
        },
        attachments: [],
        revealedTo: ["A", "B"],
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
        revealedTo: ["A", "B"],
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
  }
  return state;
}

/** Events de mise en place : GAME_STARTED (layout) + un SHUFFLE par Pioche. */
export function setupEvents(
  gameId: string,
  decks: Record<Seat, Deck>,
  opts: SetupOptions = {},
): DraftEvent[] {
  const layout = buildInitialLayout(gameId, decks, opts.firstPlayer ?? "A");
  layout.rng.masterSeedHash = opts.masterSeedHash ?? "";
  const events: DraftEvent[] = [
    { actor: "system", type: "GAME_STARTED", payload: { state: layout } },
  ];
  const seeds: Record<Seat, string> = {
    A: opts.seedA ?? `${gameId}:A`,
    B: opts.seedB ?? `${gameId}:B`,
  };
  for (const seat of ["A", "B"] as Seat[]) {
    const size = layout.seats[seat].pioche.length;
    if (size > 1) {
      events.push(
        shuffle("system", { zone: "pioche", owner: seat }, size, seeds[seat]),
      );
    }
  }
  return events;
}

/** Crée une partie prête : journal initial + état dérivé (mélangé). */
export function createGame(
  gameId: string,
  decks: Record<Seat, Deck>,
  opts: SetupOptions = {},
): { events: PersistedEvent[]; state: GameState } {
  const events = sequence(setupEvents(gameId, decks, opts), gameId);
  return { events, state: deriveState(events) };
}
