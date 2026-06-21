/**
 * Autorité serveur — Module de jeu (L2). Réf. §4.4, §6.3.
 *
 * Transforme l'INTENTION d'un joueur (DraftEvent) en event AUTORITATIF :
 * - SHUFFLE : la permutation est (re)calculée depuis la `masterSeed` SECRÈTE du
 *   serveur — la valeur éventuellement fournie par le client est ignorée
 *   (anti-triche : le client ne peut pas choisir l'ordre du deck).
 * - `redactEventForBroadcast` retire ce qui ne doit pas circuler (ordre de
 *   mélange, fragments privés d'un autre siège) AVANT diffusion aux clients.
 *
 * 100 % pur & testable : aucune dépendance réseau/Supabase ici.
 */
import type {
  DraftEvent,
  PersistedEvent,
  ShufflePayload,
  MovePayload,
  InstanceId,
  EventType,
  AttachPayload,
  DetachPayload,
  LookRevealPayload,
  RedactedEvent,
} from "../types/events";
import type { GameState, CardInstance } from "../types/state";
import type { Seat, Viewer } from "../types/zones";
import { ZONE_SPECS } from "../types/zones.ts"; // value import → .ts for Deno
import { permutationFromSeed } from "./rng.ts";
import { EngineError, getZoneArray } from "./reducer.ts";
import { canSeeCardId } from "./redact.ts"; // value import → .ts for Deno

export interface AuthorityContext {
  gameId: string;
  seq: number; // numéro attribué par la base (Postgres)
  ts: number; // horodatage serveur (source unique de temps)
  masterSeed: string; // secret serveur, jamais exposé
}

/** Le siège est-il un joueur légitime de la partie ? (validation minimale, table libre). */
function assertActor(draft: DraftEvent): asserts draft is DraftEvent & {
  actor: Seat | "system";
} {
  if (draft.actor !== "A" && draft.actor !== "B" && draft.actor !== "system") {
    throw new EngineError("BAD_ACTOR", { actor: draft.actor });
  }
}

/**
 * Produit l'event persisté autoritatif à partir d'un brouillon + de l'état
 * courant. Le `seq`/`ts` viennent de la couche serveur (ctx).
 */
export function resolveDraft(
  state: GameState,
  draft: DraftEvent,
  ctx: AuthorityContext,
): PersistedEvent {
  assertActor(draft);

  let payload = draft.payload;

  // RNG AUTORITATIF : on ignore toute permutation cliente, on la dérive de la
  // masterSeed serveur (déterministe, reproductible, vérifiable en fin de partie).
  if (draft.type === "SHUFFLE") {
    const p = draft.payload as ShufflePayload;
    const size = getZoneArray(state, p.zone).length;
    const seedKey = `${ctx.masterSeed}|${ctx.gameId}|${ctx.seq}|${p.zone.zone}|${
      "owner" in p.zone ? p.zone.owner : "-"
    }`;
    payload = { zone: p.zone, permutation: permutationFromSeed(size, seedKey) };
  }

  // Garde-fou minimal pour MOVE : l'instance doit exister (table libre : on ne
  // valide pas la légalité d'effet, seulement la cohérence structurelle).
  if (draft.type === "MOVE") {
    const m = draft.payload as MovePayload;
    if (!state.instances[m.instanceId]) {
      throw new EngineError("UNKNOWN_INSTANCE", { id: m.instanceId });
    }
  }

  return {
    gameId: ctx.gameId,
    seq: ctx.seq,
    parentSeq: state.seq,
    actor: draft.actor,
    type: draft.type,
    payload,
    payloadPrivate: draft.payloadPrivate,
    ts: ctx.ts,
  };
}

/**
 * Redacte un event AVANT diffusion à un client (broadcast/pull).
 * - SHUFFLE : la permutation est retirée (l'ordre de la Pioche est secret pour
 *   tous ; le client ne voit qu'un compteur, donc rien à appliquer).
 * - payloadPrivate : on ne conserve que le fragment du destinataire.
 * (Le journal complet, lui, reste stocké côté serveur pour re-dérivation/audit.)
 */
export function redactEventForBroadcast(
  event: PersistedEvent,
  viewer: Viewer,
): PersistedEvent {
  let payload = event.payload;
  if (event.type === "SHUFFLE") {
    const p = event.payload as ShufflePayload;
    payload = { zone: p.zone, permutation: [] }; // ordre masqué
  }

  // GAME_STARTED transporte l'état initial COMPLET (tous les cardId). Avant
  // diffusion, on masque le cardId des cartes non révélées au destinataire
  // (Pioche de tous, Main/Réserve adverses) : l'instanceId et la zone restent
  // publics — l'identité, non. Sans quoi l'adversaire connaîtrait le deck
  // entier et donc chaque tirage (instanceId → cardId).
  if (event.type === "GAME_STARTED") {
    const p = event.payload as { state: GameState };
    const instances: Record<string, CardInstance> = {};
    for (const [id, inst] of Object.entries(p.state.instances)) {
      const seen =
        viewer !== "spectator" && (inst.revealedTo ?? []).includes(viewer);
      instances[id] = seen ? inst : { ...inst, cardId: "" };
    }
    payload = {
      ...(event.payload as object),
      state: { ...p.state, instances },
    };
  }

  let payloadPrivate: PersistedEvent["payloadPrivate"];
  if (
    event.payloadPrivate &&
    viewer !== "spectator" &&
    event.payloadPrivate[viewer] !== undefined
  ) {
    payloadPrivate = { [viewer]: event.payloadPrivate[viewer] };
  }

  return { ...event, payload, payloadPrivate };
}

const ALLOWED_TYPES = new Set<EventType>([
  // NB: "GAME_STARTED" est SYSTEM-ONLY — émis par le serveur lors du setup
  // (laissé passer par le early-return `actor === "system"`). Un joueur ne doit
  // jamais pouvoir le déclencher (sinon reset parasite de la partie).
  "MOVE",
  "SHUFFLE",
  "SET_ORIENTATION",
  "SET_LEVEL",
  "SET_COUNTER",
  "INC_COUNTER",
  "ATTACH",
  "DETACH",
  "LOOK",
  "REVEAL",
  "SET_PHASE",
  "SAID",
  "UNDONE",
]);

/** Instances ciblées par un brouillon (pour les vérifs de propriété). */
function targetedIds(draft: DraftEvent): InstanceId[] {
  const p = draft.payload as Record<string, unknown>;
  switch (draft.type) {
    case "MOVE":
    case "SET_ORIENTATION":
    case "SET_LEVEL":
    case "SET_COUNTER":
    case "INC_COUNTER":
      return p.instanceId ? [p.instanceId as InstanceId] : [];
    case "ATTACH": {
      const a = p as unknown as AttachPayload;
      return [a.equipmentId, a.bearerId];
    }
    case "DETACH":
      return [(p as unknown as DetachPayload).equipmentId];
    case "LOOK":
    case "REVEAL":
      return (p as unknown as LookRevealPayload).instanceIds ?? [];
    default:
      return [];
  }
}

/** Une instance est-elle dans une zone PRIVÉE de l'ADVERSAIRE de `actor` ? */
function inOpponentPrivateZone(inst: CardInstance, actor: Seat): boolean {
  const spec = ZONE_SPECS[inst.location.zone];
  const owner = "owner" in inst.location ? inst.location.owner : null;
  return !spec.public && owner !== null && owner !== actor;
}

/** Sièges à qui un brouillon prétend révéler l'identité. */
function revealTargets(draft: DraftEvent): Seat[] {
  if (draft.type === "MOVE") {
    const v = (draft.payload as MovePayload).visibility.visibleTo;
    return v === "all" ? ["A", "B"] : Array.isArray(v) ? v : [];
  }
  if (draft.type === "LOOK" || draft.type === "REVEAL") {
    return (draft.payload as LookRevealPayload).to ?? [];
  }
  return [];
}

/**
 * Autorise (ou rejette) une INTENTION côté serveur. Table libre : on NE valide
 * PAS la légalité d'effet — seulement qu'un siège (1) n'émet pas un type inconnu,
 * (2) ne touche pas une zone PRIVÉE adverse (main/pioche/réserve), (3) ne se
 * révèle pas une carte qu'il ne possède pas et ne voit pas déjà.
 */
export function authorizeDraft(state: GameState, draft: DraftEvent): void {
  assertActor(draft);
  if (draft.actor === "system") return; // events serveur (setup)
  const actor = draft.actor as Seat;

  if (!ALLOWED_TYPES.has(draft.type)) {
    throw new EngineError("BAD_EVENT_TYPE", { type: draft.type });
  }

  // SHUFFLE ne cible pas d'instanceId (sa payload porte un ZoneRef), donc la
  // vérif `targetedIds` ne le couvre pas : on garde explicitement un joueur de
  // mélanger une zone PRIVÉE de l'adversaire (pioche/réserve). Les zones communes
  // (monde/fileAttente) n'ont pas d'`owner` → autorisées.
  if (draft.type === "SHUFFLE") {
    const payload = draft.payload as ShufflePayload;
    if ("owner" in payload.zone && payload.zone.owner !== actor) {
      throw new EngineError("FORBIDDEN", { reason: "shuffle-foreign-zone" });
    }
  }

  const ids = targetedIds(draft);
  for (const id of ids) {
    const inst = state.instances[id];
    if (inst && inOpponentPrivateZone(inst, actor)) {
      throw new EngineError("FORBIDDEN", { id, zone: inst.location.zone });
    }
  }

  if (revealTargets(draft).includes(actor)) {
    for (const id of ids) {
      const inst = state.instances[id];
      if (
        inst &&
        inst.owner !== actor &&
        !canSeeCardId(inst, actor as Viewer)
      ) {
        throw new EngineError("FORBIDDEN", { id, reason: "peek" });
      }
    }
  }
}

/**
 * Redacte un event POUR UN SIÈGE avant diffusion + joint les `reveals` :
 * les cardId des instances qui deviennent visibles à ce siège du fait de cet
 * event (carte piochée / jouée). `pre`/`post` = état avant/après l'event.
 */
export function redactEventForSeat(
  event: PersistedEvent,
  viewer: Seat,
  pre: GameState,
  post: GameState,
): RedactedEvent {
  const base = redactEventForBroadcast(event, viewer);
  const reveals: Record<string, string> = {};
  for (const [id, inst] of Object.entries(post.instances)) {
    if (!inst.cardId) continue;
    const wasVisible =
      !!pre.instances[id] && canSeeCardId(pre.instances[id], viewer);
    if (!wasVisible && canSeeCardId(inst, viewer)) reveals[id] = inst.cardId;
  }
  return Object.keys(reveals).length ? { ...base, reveals } : base;
}
