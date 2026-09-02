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
  CreateTokenPayload,
  LookRevealPayload,
} from "../types/events";
import type { CombatState, GameState, TurnPhase } from "../types/state";
import type { Seat, ZoneRef } from "../types/zones";
import { permutationFromSeed } from "./rng.ts";

const top: Position = { at: "top" };
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

/** Recycle une carte de la Main vers le sommet de la Pioche (face cachée). */
export function recycleToPiocheTop(
  seat: Seat,
  instanceId: InstanceId,
): DraftEvent<MovePayload> {
  return move(seat, {
    instanceId,
    from: { zone: "main", owner: seat },
    to: { zone: "pioche", owner: seat },
    position: top,
    visibility: { faceDown: true, visibleTo: "none" },
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

/**
 * Attache un Équipement / une Monture à un Porteur (305.3) : l'équipement est
 * co-localisé avec le Porteur et poussé dans `bearer.attachments` (reducer).
 */
export function attach(
  seat: Seat,
  equipmentId: InstanceId,
  bearerId: InstanceId,
): DraftEvent {
  return { actor: seat, type: "ATTACH", payload: { equipmentId, bearerId } };
}

/**
 * Détache un Équipement / une Monture (le retire des `attachments` de tout
 * Porteur) et le déplace vers `to` (typiquement la Défausse à la destruction du
 * Porteur, 305.x).
 */
export function detach(
  seat: Seat,
  equipmentId: InstanceId,
  to: ZoneRef,
  position: Position = top,
): DraftEvent {
  return {
    actor: seat,
    type: "DETACH",
    payload: { equipmentId, to, position },
  };
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
  value: number | string | null,
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

export function setController(
  actor: Seat | "system",
  instanceId: InstanceId,
  controller: Seat,
): DraftEvent<{ instanceId: InstanceId; controller: Seat }> {
  return {
    actor,
    type: "SET_CONTROLLER",
    payload: { instanceId, controller },
  };
}

/**
 * Mise en jeu d'un JETON de créature (« Mettez en jeu un jeton "Monstre - X" de
 * Force N [Élément] »). Minte une instance dans le Monde du contrôleur,
 * référençant un `cardId` synthétique (registre de jetons). L'`instanceId` est
 * fourni par l'appelant (déterministe : le reducer reste pur, sans aléa).
 */
export function createToken(
  actor: Seat,
  p: CreateTokenPayload,
): DraftEvent<CreateTokenPayload> {
  return { actor, type: "CREATE_TOKEN", payload: p };
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

/** Texte JOURNAL d'un jet de dé partagé (même rendu client/serveur).
 *  d3 = Chi-Fu-Mi (✊✋✌), sinon dN numérique. */
export function formatRoll(sides: number, value: number): string {
  if (sides === 3) {
    const signs = ["✊ Pierre", "✋ Feuille", "✌ Ciseaux"] as const;
    return `🎲 Chi-Fu-Mi : ${signs[(value - 1) % 3]}`;
  }
  return `🎲 lance un d${sides} : ${value}`;
}

/**
 * RÉVÉLATION de main (Filouterie / « montrer sa main ») : marque `instanceIds`
 * comme révélés à `to`. Monotone (le reducer n'ajoute qu'au `revealedTo`) → geste
 * one-shot : les cartes révélées le restent jusqu'au prochain mélange de la zone.
 * Les cartes piochées APRÈS ne sont pas incluses (snapshot à l'émission).
 */
export function revealHand(
  actor: Seat,
  instanceIds: InstanceId[],
  to: Seat[],
): DraftEvent<LookRevealPayload> {
  return { actor, type: "REVEAL", payload: { instanceIds, to } };
}

export function unrevealHand(
  actor: Seat,
  instanceIds: InstanceId[],
  to: Seat[],
): DraftEvent<LookRevealPayload> {
  return { actor, type: "UNREVEAL", payload: { instanceIds, to } };
}

/**
 * CONSULTATION privée (« chercher dans sa Pioche », regarder des cartes) :
 * marque `instanceIds` comme vus par `to` SEULEMENT (LOOK — l'adversaire ne
 * voit rien). Autorisé côté serveur pour ses propres cartes (anti-peek pour
 * celles de l'adversaire). Un SHUFFLE de la zone purge ces révélations.
 */
export function lookCards(
  actor: Seat,
  instanceIds: InstanceId[],
  to: Seat[],
): DraftEvent<LookRevealPayload> {
  return { actor, type: "LOOK", payload: { instanceIds, to } };
}

/** Met à jour le tour (joueur actif, numéro, phase) — assistance non bloquante. */
export function setPhase(
  actor: Seat | "system",
  turn: { active?: Seat; number?: number; phase?: TurnPhase },
): DraftEvent {
  return { actor, type: "SET_PHASE", payload: turn };
}

/**
 * Pose (ou efface avec `null`) le combat en cours dans le journal (P3). Émis à
 * la déclaration d'attaque, au blocage et à la résolution → les deux clients
 * dérivent le même combat. `recordedAttackBy` (à la clôture après résolution)
 * enregistre l'attaque du tour pour la règle « une attaque par tour » (603).
 */
export function setCombat(
  actor: Seat | "system",
  combat: CombatState | null,
  recordedAttackBy?: Seat,
): DraftEvent {
  return { actor, type: "SET_COMBAT", payload: { combat, recordedAttackBy } };
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
