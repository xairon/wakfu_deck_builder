/**
 * Reducer pur & déterministe — Module de jeu (L1). Réf. §4.3.
 *
 * `state = events.reduce(applyEvent, …)`. Aucun Date.now / Math.random : tout
 * non-déterminisme (permutation de mélange, valeur absolue) est capturé DANS
 * l'event. Rejouer la même séquence produit un état strictement identique.
 *
 * NB : la concurrence optimiste (parentSeq) et l'ordre total (seq) sont validés
 * côté serveur (L2) ; le fold pur ne les ré-impose pas (sinon l'undo casserait).
 */
import type {
  PersistedEvent,
  MovePayload,
  ShufflePayload,
  OrientationPayload,
  LevelPayload,
  SetCounterPayload,
  IncCounterPayload,
  AttachPayload,
  DetachPayload,
  LookRevealPayload,
  UndonePayload,
  Position,
  InstanceId,
} from "../types/events";
import type { CardInstance, GameState } from "../types/state";
import type { ZoneRef } from "../types/zones";

export class EngineError extends Error {
  constructor(
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "EngineError";
  }
}

// ── Helpers de zone ──────────────────────────────────────────────────────────

export function getZoneArray(s: GameState, ref: ZoneRef): InstanceId[] {
  if (!("owner" in ref)) {
    // Zone commune (Monde / File d'Attente).
    return ref.zone === "monde" ? s.monde : s.fileAttente;
  }
  const b = s.seats[ref.owner];
  switch (ref.zone) {
    case "pioche":
      return b.pioche;
    case "main":
      return b.main;
    case "havreSac":
      return b.havreSac;
    case "defausse":
      return b.defausse;
    case "reserve":
      return b.reserve;
    case "exil":
      return b.exil;
    case "limbo":
      return b.limbo;
  }
}

function removeFromZone(s: GameState, inst: CardInstance): void {
  const arr = getZoneArray(s, inst.location);
  const i = arr.indexOf(inst.instanceId);
  if (i >= 0) arr.splice(i, 1);
}

function insertIntoZone(
  s: GameState,
  inst: CardInstance,
  to: ZoneRef,
  position: Position,
): void {
  const arr = getZoneArray(s, to);
  const id = inst.instanceId;
  switch (position.at) {
    case "top":
      arr.unshift(id);
      break;
    case "bottom":
    case "any":
    case "free":
      arr.push(id);
      break;
    case "index":
      arr.splice(Math.max(0, Math.min(arr.length, position.index)), 0, id);
      break;
  }
}

function getInstance(s: GameState, id: InstanceId): CardInstance {
  const inst = s.instances[id];
  if (!inst) throw new EngineError("UNKNOWN_INSTANCE", { id });
  return inst;
}

// ── Application des events ───────────────────────────────────────────────────

function applyMove(s: GameState, p: MovePayload): void {
  const inst = getInstance(s, p.instanceId);
  removeFromZone(s, inst);

  const isWorldHavenSwap =
    (p.from.zone === "monde" && p.to.zone === "havreSac") ||
    (p.from.zone === "havreSac" && p.to.zone === "monde");

  // 501.5 : seuls les échanges Monde↔Havre-Sac conservent compteurs/marqueurs.
  if (!(p.preservesIdentity && isWorldHavenSwap)) {
    inst.counters = {};
  }

  const arrivesInPlay = p.to.zone === "monde" || p.to.zone === "havreSac";
  inst.orientation = arrivesInPlay
    ? (p.orientationOnArrival ?? "upright")
    : null; // 106.3

  inst.face = p.visibility.faceDown
    ? "hidden"
    : inst.face === "hidden"
      ? "recto"
      : inst.face;

  inst.revealedTo =
    p.visibility.visibleTo === "all"
      ? ["A", "B"]
      : p.visibility.visibleTo === "none"
        ? []
        : [...p.visibility.visibleTo];

  inst.location = p.to;
  insertIntoZone(s, inst, p.to, p.position);
}

function applyShuffle(s: GameState, p: ShufflePayload): void {
  const arr = getZoneArray(s, p.zone);
  // Mélange REDACTÉ : diffusé/pullé sans permutation (l'ordre est SECRET pour ce
  // viewer — cf. redactEventForBroadcast). La zone (Pioche) lui est opaque, donc
  // on n'altère pas l'ordre local ; on invalide quand même la connaissance
  // d'ordre (C3), exactement comme un vrai mélange.
  if (p.permutation.length === 0 && arr.length > 0) {
    for (const id of arr) s.instances[id].revealedTo = [];
    return;
  }
  if (p.permutation.length !== arr.length) {
    throw new EngineError("BAD_PERMUTATION", {
      expected: arr.length,
      got: p.permutation.length,
    });
  }
  const reordered = p.permutation.map((i) => arr[i]);
  arr.splice(0, arr.length, ...reordered);
  // C3 : un mélange invalide toute connaissance d'ordre acquise par un LOOK.
  for (const id of arr) s.instances[id].revealedTo = [];
}

function setCounterValue(
  inst: CardInstance,
  counter: string,
  value: number,
  token: boolean | undefined,
): void {
  if (token) {
    inst.counters.tokens = { ...inst.counters.tokens, [counter]: value };
  } else {
    (inst.counters as Record<string, number>)[counter] = value;
  }
}

export function applyEvent(state: GameState, ev: PersistedEvent): GameState {
  // GAME_STARTED installe l'état initial complet.
  if (ev.type === "GAME_STARTED") {
    const next = structuredClone((ev.payload as { state: GameState }).state);
    next.seq = ev.seq;
    return next;
  }
  // UNDONE & SAID : pas de mutation d'état (gérés au fold / log).
  if (ev.type === "UNDONE" || ev.type === "SAID") {
    const passthrough = structuredClone(state);
    passthrough.seq = ev.seq;
    return passthrough;
  }

  const next = structuredClone(state);
  switch (ev.type) {
    case "MOVE":
      applyMove(next, ev.payload as MovePayload);
      break;
    case "SHUFFLE":
      applyShuffle(next, ev.payload as ShufflePayload);
      break;
    case "SET_ORIENTATION": {
      const p = ev.payload as OrientationPayload;
      getInstance(next, p.instanceId).orientation = p.orientation;
      break;
    }
    case "SET_LEVEL": {
      const p = ev.payload as LevelPayload;
      const inst = getInstance(next, p.instanceId);
      inst.face = p.face;
      if (p.level !== undefined) inst.counters.level = p.level;
      if (p.xp !== undefined) inst.counters.xp = p.xp;
      break;
    }
    case "SET_COUNTER": {
      const p = ev.payload as SetCounterPayload;
      setCounterValue(
        getInstance(next, p.instanceId),
        p.counter,
        p.value,
        p.token,
      );
      break;
    }
    case "INC_COUNTER": {
      const p = ev.payload as IncCounterPayload;
      const inst = getInstance(next, p.instanceId);
      const cur = p.token
        ? (inst.counters.tokens?.[p.counter] ?? 0)
        : ((inst.counters as Record<string, number>)[p.counter] ?? 0);
      setCounterValue(inst, p.counter, cur + p.delta, p.token);
      break;
    }
    case "ATTACH": {
      const p = ev.payload as AttachPayload;
      const equip = getInstance(next, p.equipmentId);
      const bearer = getInstance(next, p.bearerId);
      removeFromZone(next, equip);
      equip.location = bearer.location; // co-localisé avec son porteur
      if (!bearer.attachments.includes(p.equipmentId)) {
        bearer.attachments.push(p.equipmentId);
      }
      break;
    }
    case "DETACH": {
      const p = ev.payload as DetachPayload;
      const equip = getInstance(next, p.equipmentId);
      for (const inst of Object.values(next.instances)) {
        const i = inst.attachments.indexOf(p.equipmentId);
        if (i >= 0) inst.attachments.splice(i, 1);
      }
      equip.counters = {};
      equip.location = p.to;
      insertIntoZone(next, equip, p.to, p.position);
      break;
    }
    case "LOOK":
    case "REVEAL": {
      const p = ev.payload as LookRevealPayload;
      for (const id of p.instanceIds) {
        const inst = getInstance(next, id);
        for (const seat of p.to) {
          if (!inst.revealedTo.includes(seat)) inst.revealedTo.push(seat);
        }
      }
      break;
    }
    case "SET_PHASE": {
      const p = ev.payload as Partial<GameState["turn"]>;
      next.turn = { ...next.turn, ...p };
      break;
    }
  }
  next.seq = ev.seq;
  return next;
}

/**
 * Repli COMPLET du journal depuis l'état vide. Gère l'undo : un event `UNDONE`
 * { targetSeq } fait ignorer l'event ciblé (journal immuable, §4.5).
 */
function fullDerive(events: PersistedEvent[]): GameState {
  const undone = new Set<number>();
  for (const e of events) {
    if (e.type === "UNDONE") undone.add((e.payload as UndonePayload).targetSeq);
  }
  let state = emptyState();
  for (const e of events) {
    if (e.type === "UNDONE") continue;
    if (undone.has(e.seq)) continue;
    state = applyEvent(state, e);
  }
  return state;
}

// Mémoïsation incrémentale du repli. Le journal est append-only (l'undo AJOUTE
// un marqueur UNDONE, il ne tronque jamais) : un appel qui prolonge EXACTEMENT
// le préfixe mémoïsé (même event-borne, par référence) n'applique alors que la
// nouvelle queue à l'état mémoïsé — au lieu de re-replier tout le journal à
// chaque dispatch (coût O(N²) → O(taille de la queue)). Référentiellement
// transparent : même journal ⇒ même état. Invalidation conservatrice (recalcul
// complet) si l'extension n'est pas garantie, ou si la queue contient un UNDONE
// (qui pourrait neutraliser un event déjà appliqué dans le préfixe). Sûr car
// AUCUN consommateur ne mute l'état dérivé (toute mutation passe par un event).
let deriveMemo: {
  boundary: PersistedEvent;
  len: number;
  state: GameState;
} | null = null;

/** @internal — réinitialise le cache de `deriveState` (tests). */
export function resetDeriveMemo(): void {
  deriveMemo = null;
}

export function deriveState(events: PersistedEvent[]): GameState {
  const n = events.length;
  if (
    deriveMemo &&
    deriveMemo.len <= n &&
    events[deriveMemo.len - 1] === deriveMemo.boundary
  ) {
    // Journal identique au préfixe mémoïsé : état déjà calculé.
    if (deriveMemo.len === n) return deriveMemo.state;
    // Extension append-only : on n'applique que la queue, sauf si elle contient
    // un UNDONE (qui peut cibler un event du préfixe → recalcul complet).
    const tail = events.slice(deriveMemo.len);
    if (!tail.some((e) => e.type === "UNDONE")) {
      let state = deriveMemo.state;
      for (const e of tail) state = applyEvent(state, e);
      deriveMemo = { boundary: events[n - 1], len: n, state };
      return state;
    }
  }
  const state = fullDerive(events);
  deriveMemo = n > 0 ? { boundary: events[n - 1], len: n, state } : null;
  return state;
}

export function emptyState(): GameState {
  const board = (seat: "A" | "B") => ({
    seat,
    pioche: [],
    main: [],
    havreSac: [],
    defausse: [],
    reserve: [],
    exil: [],
    limbo: [],
  });
  return {
    gameId: "",
    status: "lobby",
    seats: { A: board("A"), B: board("B") },
    monde: [],
    fileAttente: [],
    instances: {},
    turn: { active: "A", number: 0, phase: "principale", firstPlayer: "A" },
    rng: { masterSeedHash: "" },
    seq: 0,
  };
}

/** Validation de concurrence optimiste, utilisée par la couche serveur (L2). */
export function assertAppendable(state: GameState, parentSeq: number): void {
  if (parentSeq !== state.seq) {
    throw new EngineError("OUT_OF_ORDER", {
      expected: state.seq,
      got: parentSeq,
    });
  }
}
