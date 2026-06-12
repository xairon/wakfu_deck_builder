/**
 * Verbes — sucre au-dessus de la primitive MOVE + events d'état (L1). Réf. §4.1.
 * Chaque verbe construit un `DraftEvent` ; `sequence()` leur assigne seq/ts.
 */
import type {
  DraftEvent,
  MovePayload,
  Position,
  PersistedEvent,
  InstanceId,
  ShufflePayload,
} from "../types/events";
import type { GameState, TurnPhase } from "../types/state";
import type { Seat, ZoneRef } from "../types/zones";
import { permutationFromSeed } from "./rng";

const top: Position = { at: "top" };
const bottom: Position = { at: "bottom" };
const anyPos: Position = { at: "any" };

export function move(
  actor: Seat | "system",
  p: MovePayload,
  payloadPrivate?: DraftEvent["payloadPrivate"],
): DraftEvent<MovePayload> {
  return { actor, type: "MOVE", payload: p, payloadPrivate };
}

/** Piocher : sommet de la Pioche → Main (révélée au seul propriétaire). 507.4 */
export function drawTop(state: GameState, seat: Seat): DraftEvent<MovePayload> {
  const id = state.seats[seat].pioche[0];
  if (!id) throw new Error("PIOCHE_VIDE");
  return move(seat, {
    instanceId: id,
    from: { zone: "pioche", owner: seat },
    to: { zone: "main", owner: seat },
    position: anyPos,
    visibility: { faceDown: false, visibleTo: [seat] },
    preservesIdentity: false,
  });
}

/** Jouer une carte de la main vers le Monde (publique). */
export function playToWorld(
  seat: Seat,
  instanceId: InstanceId,
  position: Position = anyPos,
): DraftEvent<MovePayload> {
  return move(seat, {
    instanceId,
    from: { zone: "main", owner: seat },
    to: { zone: "monde" },
    position,
    visibility: { faceDown: false, visibleTo: "all" },
    preservesIdentity: false,
    orientationOnArrival: "upright",
  });
}

/** Défausser (502.1) : * → Défausse (publique). */
export function discard(
  seat: Seat,
  instanceId: InstanceId,
  from: ZoneRef,
): DraftEvent<MovePayload> {
  return move(seat, {
    instanceId,
    from,
    to: { zone: "defausse", owner: seat },
    position: top,
    visibility: { faceDown: false, visibleTo: "all" },
    preservesIdentity: false,
  });
}

/** Échange Monde↔Havre-Sac : conserve compteurs/marqueurs (501.5). */
export function worldHavenSwap(
  seat: Seat,
  instanceId: InstanceId,
  from: "monde" | "havreSac",
): DraftEvent<MovePayload> {
  const to = from === "monde" ? "havreSac" : "monde";
  return move(seat, {
    instanceId,
    from:
      from === "monde" ? { zone: "monde" } : { zone: "havreSac", owner: seat },
    to: to === "monde" ? { zone: "monde" } : { zone: "havreSac", owner: seat },
    position: anyPos,
    visibility: { faceDown: false, visibleTo: "all" },
    preservesIdentity: true,
    orientationOnArrival: "upright",
  });
}

export function tap(seat: Seat, instanceId: InstanceId): DraftEvent {
  return {
    actor: seat,
    type: "SET_ORIENTATION",
    payload: { instanceId, orientation: "tapped" },
  };
}
export function untap(seat: Seat, instanceId: InstanceId): DraftEvent {
  return {
    actor: seat,
    type: "SET_ORIENTATION",
    payload: { instanceId, orientation: "upright" },
  };
}

export function flipLevel(
  seat: Seat,
  instanceId: InstanceId,
  face: "recto" | "verso",
  level?: number,
  xp?: number,
): DraftEvent {
  return {
    actor: seat,
    type: "SET_LEVEL",
    payload: { instanceId, face, level, xp },
  };
}

export function setCounter(
  seat: Seat,
  instanceId: InstanceId,
  counter: string,
  value: number,
  token = false,
): DraftEvent {
  return {
    actor: seat,
    type: "SET_COUNTER",
    payload: { instanceId, counter, value, token },
  };
}

export function incCounter(
  seat: Seat,
  instanceId: InstanceId,
  counter: string,
  delta: number,
  token = false,
): DraftEvent {
  return {
    actor: seat,
    type: "INC_COUNTER",
    payload: { instanceId, counter, delta, token },
  };
}

/** Mélange autoritatif : permutation dérivée d'une graine serveur. */
export function shuffle(
  actor: Seat | "system",
  zone: ZoneRef,
  size: number,
  seed: string,
): DraftEvent<ShufflePayload> {
  return {
    actor,
    type: "SHUFFLE",
    payload: { zone, permutation: permutationFromSeed(size, seed) },
  };
}

export function undo(actor: Seat, targetSeq: number): DraftEvent {
  return { actor, type: "UNDONE", payload: { targetSeq } };
}

export function say(actor: Seat | "system", text: string): DraftEvent {
  return { actor, type: "SAID", payload: { text } };
}

/** Met à jour le tour (joueur actif, numéro, phase) — assistance non bloquante. */
export function setPhase(
  actor: Seat | "system",
  turn: { active?: Seat; number?: number; phase?: TurnPhase },
): DraftEvent {
  return { actor, type: "SET_PHASE", payload: turn };
}

/**
 * Assigne seq (1,2,3…), parentSeq et ts à une suite de brouillons.
 * En production ces valeurs viennent du serveur (Postgres) ; ici le moteur est
 * pur, donc `ts` est déterministe (= seq) sauf si fourni.
 */
export function sequence(
  drafts: DraftEvent[],
  gameId: string,
  startSeq = 1,
): PersistedEvent[] {
  return drafts.map((d, i) => {
    const seq = startSeq + i;
    return {
      gameId,
      seq,
      parentSeq: seq - 1,
      actor: d.actor,
      type: d.type,
      payload: d.payload,
      payloadPrivate: d.payloadPrivate,
      ts: seq,
    };
  });
}
