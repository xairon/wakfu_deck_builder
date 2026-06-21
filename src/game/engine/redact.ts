/**
 * Redaction — Module de jeu (L1). Réf. §5.2.
 *
 * La visibilité est une PROJECTION, pas un champ masqué : l'information cachée
 * est ABSENTE de la vue (rien à inspecter dans les devtools pour tricher).
 * - Pioche : jamais de cardId ni d'ordre, pour PERSONNE (le serveur seul connaît
 *   l'ordre via la masterSeed) → `{ count }`.
 * - Main adverse : `{ count }` (aucun cardId, aucun instanceId, aucun ordre).
 * - Réserve adverse : absente.
 * - Zones publiques : complètes, sauf cartes face cachée non révélées.
 */
import type {
  CardInstance,
  GameState,
  RedactedBoard,
  RedactedGameState,
  RedactedInstance,
  RedactedZone,
} from "../types/state";
import type { InstanceId } from "../types/events";
import type { Seat, Viewer } from "../types/zones";
import { ZONE_SPECS } from "../types/zones.ts";

/** Le viewer connaît-il l'identité (cardId) de cette occurrence ? */
export function canSeeCardId(inst: CardInstance, viewer: Viewer): boolean {
  if (viewer !== "spectator" && inst.revealedTo.includes(viewer)) return true;
  const zone = inst.location.zone;
  // Pioche & Limbo : opaques pour tout le monde (y compris le propriétaire).
  if (zone === "pioche" || zone === "limbo") return false;
  // Main & Réserve : seul le propriétaire.
  if (zone === "main" || zone === "reserve") {
    return "owner" in inst.location && inst.location.owner === viewer;
  }
  // Zones publiques : visible sauf face cachée non révélée.
  if (ZONE_SPECS[zone].public) return inst.face !== "hidden";
  return inst.owner === viewer;
}

function redactInstance(inst: CardInstance, viewer: Viewer): RedactedInstance {
  return {
    instanceId: inst.instanceId,
    cardId: canSeeCardId(inst, viewer) ? inst.cardId : null,
    owner: inst.owner,
    controller: inst.controller,
    face: inst.face,
    orientation: inst.orientation,
    counters: inst.counters,
    attachments: inst.attachments,
  };
}

function fullZone(
  state: GameState,
  ids: InstanceId[],
  viewer: Viewer,
): RedactedZone {
  return {
    kind: "full",
    instances: ids.map((id) => redactInstance(state.instances[id], viewer)),
  };
}

function countZone(ids: InstanceId[]): RedactedZone {
  return { kind: "count", count: ids.length, faceDown: true };
}

function redactBoard(
  state: GameState,
  seat: Seat,
  viewer: Viewer,
): RedactedBoard {
  const b = state.seats[seat];
  const isSelf = seat === viewer;
  return {
    seat,
    // L'ordre de la Pioche est secret pour TOUS → jamais de contenu.
    pioche: countZone(b.pioche),
    main: isSelf ? fullZone(state, b.main, viewer) : countZone(b.main),
    havreSac: fullZone(state, b.havreSac, viewer),
    defausse: fullZone(state, b.defausse, viewer),
    reserve: isSelf ? fullZone(state, b.reserve, viewer) : null,
    exil: fullZone(state, b.exil, viewer),
    heroInstanceId: b.heroInstanceId,
    havreSacInstanceId: b.havreSacInstanceId,
  };
}

export function redactStateFor(
  state: GameState,
  viewer: Viewer,
): RedactedGameState {
  return {
    gameId: state.gameId,
    status: state.status,
    viewer,
    seats: {
      A: redactBoard(state, "A", viewer),
      B: redactBoard(state, "B", viewer),
    },
    monde: fullZone(state, state.monde, viewer),
    fileAttente: fullZone(state, state.fileAttente, viewer),
    turn: state.turn,
    seq: state.seq,
  };
}

/**
 * Vue OMNISCIENTE — tout est visible (Pioche & ordre compris). Réservée au jeu
 * LOCAL (bac à sable / hot-seat, une seule machine) ; à NE JAMAIS diffuser.
 */
export function omniscientView(state: GameState): RedactedGameState {
  const reveal = (ids: InstanceId[]): RedactedZone => ({
    kind: "full",
    instances: ids.map((id) => {
      const i = state.instances[id];
      return {
        instanceId: i.instanceId,
        cardId: i.cardId,
        owner: i.owner,
        controller: i.controller,
        face: i.face,
        orientation: i.orientation,
        counters: i.counters,
        attachments: i.attachments,
      };
    }),
  });
  const board = (seat: Seat): RedactedBoard => {
    const b = state.seats[seat];
    return {
      seat,
      pioche: reveal(b.pioche),
      main: reveal(b.main),
      havreSac: reveal(b.havreSac),
      defausse: reveal(b.defausse),
      reserve: reveal(b.reserve),
      exil: reveal(b.exil),
      heroInstanceId: b.heroInstanceId,
      havreSacInstanceId: b.havreSacInstanceId,
    };
  };
  return {
    gameId: state.gameId,
    status: state.status,
    viewer: "spectator",
    seats: { A: board("A"), B: board("B") },
    monde: reveal(state.monde),
    fileAttente: reveal(state.fileAttente),
    turn: state.turn,
    seq: state.seq,
  };
}
