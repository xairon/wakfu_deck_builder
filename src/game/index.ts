/**
 * Module de jeu « La Table des Douze » — moteur (L0+L1).
 * Table virtuelle event-sourcée, libre de règles, à serveur autoritatif.
 * Conception : docs/GAME-MODULE-V1.md & docs/CDC-MODULE-JEU-V1.md.
 */
export * from "./types/zones";
export * from "./types/events";
export * from "./types/state";
export type { GameIntent } from "./types/intents";
export {
  applyEvent,
  deriveState,
  resetDeriveMemo,
  emptyState,
  assertAppendable,
  EngineError,
  getZoneArray,
} from "./engine/reducer";
export { redactStateFor, omniscientView, canSeeCardId } from "./engine/redact";
export {
  resolveDraft,
  redactEventForBroadcast,
  authorizeDraft,
  redactEventForSeat,
  type AuthorityContext,
} from "./engine/authority";
export { permutationFromSeed, makeRng } from "./engine/rng";
export {
  move,
  drawTop,
  recycleToPiocheTop,
  playToWorld,
  discard,
  worldHavenSwap,
  tap,
  untap,
  flipLevel,
  setCounter,
  incCounter,
  shuffle,
  undo,
  say,
  setPhase,
  sequence,
} from "./engine/verbs";
export { buildInitialLayout, setupEvents, createGame } from "./engine/setup";
export { resolveIntent, type IntentResult } from "./actions/resolveIntent";
