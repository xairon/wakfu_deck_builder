/**
 * Moteur de RÉSOLUTION D'EFFETS — orchestrateur à états extrait de gameStore.
 * Possède la file d'exécution et le modèle d'interaction pause/reprise
 * (ciblage / pile / choix). Toutes les dépendances couplées au store sont
 * INJECTÉES (EffectEngineDeps) ; les helpers purs (@/game, @/game/rules) sont
 * importés directement. Voir
 * docs/superpowers/plans/2026-06-18-effect-engine-extraction.md.
 */
import { ref } from "vue";
import type { Card } from "@/types/cards";
import type { DraftEvent, GameState, Position, Seat, ZoneRef } from "@/game";
import type { EffectOp, RulesCtx } from "@/game/rules";

/** Une « frame » de la file : la suite d'ops d'un effet à résoudre. */
export interface EffectFrame {
  seat: Seat;
  cardName: string;
  ops: EffectOp[];
  sourceId?: string;
}

/** Filtre de recherche dans une pile (type, famille, niveau max, élément). */
export interface PickFilter {
  mainType?: string;
  sub?: string;
  maxLevel?: number;
  /** « une carte [Feu] » : seules les cartes de cet Élément. */
  element?: string;
}

/**
 * Couplages au store, injectés pour découpler le moteur. Les fonctions
 * `getXxx` lisent l'état réactif au moment de l'appel (pas de capture figée).
 */
export interface EffectEngineDeps {
  getState: () => GameState;
  rulesCtx: () => RulesCtx;
  getCard: (cardId: string | null) => Card | null;
  isAssist: () => boolean;
  isAssistEffects: () => boolean;
  getMatchPhase: () => "lobby" | "mulligan" | "playing" | "finished";
  playerName: (seat: Seat) => string;
  paOf: (seat: Seat) => number;
  dispatch: (...drafts: DraftEvent[]) => void;
  moveTo: (instanceId: string, to: ZoneRef, position?: Position) => void;
  shufflePioche: (seat: Seat) => void;
  checkVictory: () => void;
  draw: (seat: Seat, n: number) => void;
  adjustCounter: (instanceId: string, counter: string, delta: number) => void;
  /** Fin de partie immédiate (gainXp gagnant) : pose winner + matchPhase. */
  onMatchWon: (seat: Seat) => void;
}

/**
 * Fabrique le moteur d'effets pour un store donné. Le corps (file, runFrame,
 * interactions) est rempli par les étapes B2/B3 du plan.
 */
export function createEffectEngine(deps: EffectEngineDeps) {
  void deps; // les dépendances sont consommées à partir de l'étape B2
  const effectQueue = ref<EffectFrame[]>([]);
  return { effectQueue };
}
