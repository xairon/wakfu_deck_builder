/**
 * Taxonomie d'events — event-sourcing du module de jeu (L0).
 * Réf. : docs/GAME-MODULE-V1.md §4. Tout déplacement dérive de MOVE ; le
 * mélange (SHUFFLE) est le seul point d'aléa, autoritatif serveur.
 */
import type { Seat, ZoneRef } from "./zones";

export type InstanceId = string; // ex. "ci_A_007" — stable toute la partie, ≠ cardId

export type Position =
  | { at: "top" }
  | { at: "bottom" }
  | { at: "index"; index: number }
  | { at: "any" }
  | { at: "free"; x: number; y: number }; // placement libre dans le Monde

export interface FaceDirective {
  faceDown: boolean;
  /** À qui l'identité réelle est révélée (en plus de la visibilité de zone). */
  visibleTo: Seat[] | "all" | "none";
}

export interface MovePayload {
  instanceId: InstanceId;
  from: ZoneRef;
  to: ZoneRef;
  position: Position;
  visibility: FaceDirective;
  /** 501.5 : true UNIQUEMENT pour Monde↔Havre-Sac → conserve compteurs/marqueurs. */
  preservesIdentity: boolean;
  orientationOnArrival?: "upright" | "tapped" | null;
}

/** Permutation : nouvel ordre = anciens[permutation[i]] (perm de 0..n-1). */
export interface ShufflePayload {
  zone: ZoneRef;
  permutation: number[];
}

export interface OrientationPayload {
  instanceId: InstanceId;
  orientation: "upright" | "tapped";
}

export interface LevelPayload {
  instanceId: InstanceId;
  face: "recto" | "verso";
  level?: number;
  xp?: number;
}

export interface SetCounterPayload {
  instanceId: InstanceId;
  counter: string; // hp|resistance|damage|level|xp ou nom de jeton
  value: number;
  token?: boolean;
}

export interface IncCounterPayload {
  instanceId: InstanceId;
  counter: string;
  delta: number;
  token?: boolean;
}

export interface AttachPayload {
  equipmentId: InstanceId;
  bearerId: InstanceId;
}

export interface DetachPayload {
  equipmentId: InstanceId;
  to: ZoneRef;
  position: Position;
}

export interface LookRevealPayload {
  instanceIds: InstanceId[];
  to: Seat[]; // sièges à qui on révèle l'identité (look privé / recherche)
}

export interface UndonePayload {
  targetSeq: number;
}

export interface SaidPayload {
  text: string;
}

export interface MulliganDonePayload {
  seat: Seat;
}

export type EventType =
  | "GAME_STARTED"
  | "MOVE"
  | "SHUFFLE"
  | "SET_ORIENTATION"
  | "SET_LEVEL"
  | "SET_COUNTER"
  | "INC_COUNTER"
  | "ATTACH"
  | "DETACH"
  | "LOOK"
  | "REVEAL"
  | "SET_PHASE"
  | "SAID"
  | "MULLIGAN_DONE"
  | "UNDONE";

/**
 * Event persisté. `seq`/`parentSeq` sont AUTORITATIFS (séquence Postgres, L2) ;
 * en moteur pur on les assigne via `sequence()`. `payloadPrivate[seat]` porte
 * les fragments secrets (jamais diffusés à l'autre siège).
 */
export interface PersistedEvent<P = unknown> {
  gameId: string;
  seq: number;
  parentSeq: number;
  actor: Seat | "system";
  type: EventType;
  payload: P;
  payloadPrivate?: Partial<Record<Seat, unknown>>;
  ts: number; // timestamp serveur (source unique de temps)
}

/** Event « brouillon » avant assignation de seq/parentSeq/ts (cf. sequence()). */
export type DraftEvent<P = unknown> = {
  actor: Seat | "system";
  type: EventType;
  payload: P;
  payloadPrivate?: Partial<Record<Seat, unknown>>;
};

/** Event diffusé à un client : event persisté redacté + identités nouvellement
 *  visibles pour CE siège (cardId d'une carte qu'on pioche/qu'on joue). */
export type RedactedEvent = PersistedEvent & {
  reveals?: Record<InstanceId, string>;
};
