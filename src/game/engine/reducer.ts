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
  SetCombatPayload,
  CreateTokenPayload,
  Position,
  InstanceId,
} from "../types/events";
import type { CardInstance, GameState } from "../types/state";
import type { ZoneRef } from "../types/zones";
import { isTokenCardId } from "../rules/effects/tokens.ts";
import { makeRng } from "./rng.ts";


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

/**
 * 305.x — les cartes PORTÉES suivent leur Porteur. Un porté n'est dans AUCUNE
 * pile (retiré à l'ATTACH) : sans ce suivi, un Porteur tué au combat ou par
 * un effet laissait ses Équipements ORPHELINS invisibles (bug 2026-07-10).
 * Appliqué AU REDUCER (règle déterministe du flux d'événements, comme la
 * disparition des jetons) pour couvrir TOUS les chemins d'un coup : combat,
 * destruction ciblée, bannissement, retour en main, recyclage, online.
 *  - le Porteur RESTE en jeu (échange Monde↔Havre-Sac…) → co-localisation ;
 *  - le Porteur QUITTE le jeu → chaque porté est détaché puis DÉFAUSSÉ chez
 *    son propriétaire (un jeton porté cesse d'exister, 502.x).
 */
function settleAttachments(
  s: GameState,
  bearer: CardInstance,
  bearerStaysInPlay: boolean,
): void {
  // `?.` : des états de test hand-craftés peuvent omettre le champ.
  if (!bearer.attachments?.length) return;
  if (bearerStaysInPlay) {
    for (const eid of bearer.attachments) {
      const eq = s.instances[eid];
      if (eq) eq.location = bearer.location;
    }
    return;
  }
  const worn = [...bearer.attachments];
  bearer.attachments = [];
  for (const eid of worn) {
    const eq = s.instances[eid];
    if (!eq) continue;
    if (isTokenCardId(eq.cardId)) {
      delete s.instances[eid];
      continue;
    }
    eq.counters = {};
    eq.orientation = null; // 106.3 : hors jeu, pas d'orientation
    eq.face = eq.face === "hidden" ? "recto" : eq.face;
    eq.revealedTo = ["A", "B"];
    eq.location = { zone: "defausse", owner: eq.owner };
    insertIntoZone(s, eq, eq.location, { at: "top" });
  }
}

function applyMove(s: GameState, p: MovePayload): void {
  const inst = getInstance(s, p.instanceId);
  removeFromZone(s, inst);

  // Si cette carte était attachée à un Porteur (Équipement/Sort), la détacher de l'hôte
  for (const other of Object.values(s.instances)) {
    if (other.attachments) {
      const idx = other.attachments.indexOf(p.instanceId);
      if (idx >= 0) {
        other.attachments.splice(idx, 1);
      }
    }
  }

  // JETON quittant le jeu (502.x / glossaire « jeton ») : un jeton n'a pas de
  // carte de deck — il CESSE D'EXISTER dès qu'il quitte le Monde / un Havre-Sac
  // (jamais de Défausse, Pioche, Exil…). On le retire complètement des instances
  // au lieu de l'insérer dans la zone cible. (Les déplacements EN JEU — échange
  // Monde↔Havre-Sac — restent normaux, gérés par la branche standard ci-dessous.)
  const arrivesInPlayZone = p.to.zone === "monde" || p.to.zone === "havreSac";
  if (isTokenCardId(inst.cardId) && !arrivesInPlayZone) {
    // Ses portés éventuels sont défaussés AVANT que le jeton-Porteur disparaisse.
    settleAttachments(s, inst, false);
    delete s.instances[p.instanceId];
    return;
  }

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
  // 305.x : les portés suivent (co-localisés en jeu, défaussés à la sortie).
  settleAttachments(s, inst, arrivesInPlay);
}

/**
 * Mise en jeu d'un JETON : minte une instance dans le Monde du contrôleur,
 * référençant le `cardId` synthétique du registre de jetons. Le jeton arrive
 * dressé (par défaut), public, propriétaire = contrôleur (un jeton n'a pas de
 * propriétaire de deck — owner = controller). Idempotent au niveau reducer :
 * une `instanceId` déjà présente n'est pas écrasée (rejouer = même état).
 */
function applyCreateToken(s: GameState, p: CreateTokenPayload): void {
  if (s.instances[p.instanceId]) return;
  const inst: CardInstance = {
    instanceId: p.instanceId,
    cardId: p.cardId,
    owner: p.controller,
    controller: p.controller,
    location: { zone: "monde" },
    face: "recto",
    orientation: p.orientation ?? "upright",
    // 303.3 — mal d'invocation : un jeton (Allié) arrive CE tour, comme toute
    // créature jouée ; sans ce marqueur (arrivedTurn = 0 par défaut) il pouvait
    // attaquer le tour même de sa création. eligibleAttackers lit ce jeton.
    counters: { tokens: { arrivedTurn: s.turn.number } },
    attachments: [],
    revealedTo: ["A", "B"],
  };
  s.instances[p.instanceId] = inst;
  s.monde.push(p.instanceId);
}

function applyShuffle(s: GameState, p: ShufflePayload): void {

  const arr = getZoneArray(s, p.zone);
  if (arr.length <= 1) return;

  if (p.permutation.length === 0) {
    // Si la permutation est omise ou masquée, mélanger la pioche localement avec makeRng
    const rng = makeRng(`${s.gameId}|${s.seq}|${p.zone.zone}|${"owner" in p.zone ? p.zone.owner : "-"}`);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
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

    // Sécurité anti-tri : si la pioche d'un siège est dans son ordre d'association initial
    // (ci_A_001, ci_A_002, ci_A_003...), la mélanger immédiatement avec makeRng
    for (const seat of ["A", "B"] as const) {
      const pioche = next.seats[seat]?.pioche ?? [];
      if (pioche.length > 1) {
        const isSequential = pioche.every((id, idx) => {
          const expectedNum = String(idx + 1).padStart(3, "0");
          return id.endsWith(`_${expectedNum}`);
        });
        if (isSequential) {
          const rng = makeRng(`${ev.gameId}:${seat}:game-started-fallback`);
          for (let i = pioche.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const tmp = pioche[i];
            pioche[i] = pioche[j];
            pioche[j] = tmp;
          }
        }
      }
    }

    return next;
  }

  // UNDONE, SAID, MULLIGAN_DONE & GAME_OVER : pas de mutation d'état (gérés au
  // fold / log / dérivation de matchPhase + issue depuis le journal).
  if (
    ev.type === "UNDONE" ||
    ev.type === "SAID" ||
    ev.type === "MULLIGAN_DONE" ||
    ev.type === "GAME_OVER"
  ) {
    const passthrough = structuredClone(state);
    passthrough.seq = ev.seq;
    return passthrough;
  }

  const next = structuredClone(state);
  switch (ev.type) {
    case "MOVE":
      applyMove(next, ev.payload as MovePayload);
      break;
    case "CREATE_TOKEN":
      applyCreateToken(next, ev.payload as CreateTokenPayload);
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
      // Idempotence : si le reducer a DÉJÀ défaussé ce porté au départ de son
      // Porteur (settleAttachments), un DETACH explicite qui suit (passe
      // d'état 1414/3019) ne doit pas dupliquer l'entrée de pile.
      removeFromZone(next, equip);
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
    case "UNREVEAL": {
      const p = ev.payload as LookRevealPayload;
      for (const id of p.instanceIds) {
        const inst = getInstance(next, id);
        for (const seat of p.to) {
          const idx = inst.revealedTo.indexOf(seat);
          if (idx >= 0) inst.revealedTo.splice(idx, 1);
        }
      }
      break;
    }

    case "SET_PHASE": {
      const p = ev.payload as Partial<GameState["turn"]>;
      next.turn = { ...next.turn, ...p };
      break;
    }
    case "SET_COMBAT": {
      // Combat-au-journal (P3) : pose/efface le combat en cours. Effacer après
      // une résolution porte `recordedAttackBy` → enregistre l'attaque du tour
      // (603, « une attaque par tour ») ; une simple annulation ne le pose pas.
      const p = ev.payload as SetCombatPayload;
      next.combat = p.combat;
      if (p.recordedAttackBy) {
        next.lastAttackTurn = {
          ...next.lastAttackTurn,
          [p.recordedAttackBy]: next.turn.number,
        };
      }
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
    combat: null,
    lastAttackTurn: {},
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
