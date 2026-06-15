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
} from "../types/events";
import type { GameState, CardInstance } from "../types/state";
import type { Seat, Viewer } from "../types/zones";
import { permutationFromSeed } from "./rng";
import { EngineError, getZoneArray } from "./reducer";

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
