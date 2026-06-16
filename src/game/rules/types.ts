/**
 * Moteur de règles R1 — types partagés.
 * Réf. docs/superpowers/specs/2026-06-09-moteur-regles-r1-design.md.
 *
 * Le moteur de règles est une couche PURE au-dessus du moteur d'événements :
 * requêtes de légalité + producteurs de `DraftEvent`. Il ne dispatch rien.
 */
import type { Card } from "@/types/cards";
import type { DraftEvent, InstanceId } from "../types/events";
import type { GameState } from "../types/state";
import type { Seat } from "../types/zones";

export interface RulesCtx {
  state: GameState;
  getCard: (cardId: string | null) => Card | null;
}

/** Producteur de ressource disponible (carte en jeu redressée). */
export interface ResourceProducer {
  instanceId: InstanceId;
  element: string; // CardElement — élément produit en s'inclinant
}

export type PlanCost =
  | { ok: true; producers: InstanceId[] }
  | { ok: false; reason: string };

/** Cible unique d'une attaque (702.2). */
export interface CombatTarget {
  kind: "hero" | "ally" | "havreSac";
  instanceId: InstanceId;
}

export interface CombatPlan {
  attackerSeat: Seat;
  target: CombatTarget;
  attackers: InstanceId[];
  /** blockerId → attackerId bloqué. */
  blocks: Record<InstanceId, InstanceId>;
  /**
   * 6105 : attackerId → bloqueur choisi pour encaisser sa Force (duels
   * multi-bloqueurs sans Géant). Absent → premier bloqueur assigné.
   */
  strikes?: Record<InstanceId, InstanceId>;
  /**
   * 707.1 : targetId (Cible Allié/Héros) → attaquant frappé par la riposte
   * de la Cible. Absent → premier attaquant l'ayant frappée.
   */
  ripostes?: Record<InstanceId, InstanceId>;
}

export interface CombatResult {
  events: DraftEvent[];
  /** Lignes lisibles pour le journal. */
  log: string[];
  destroyed: InstanceId[];
  winner: Seat | null;
  /** Événements de RÈGLES émis par la résolution (bus de déclenchement). */
  ruleEvents: RuleEvent[];
}

// ── Bus d'événements de règles (804.7) ──────────────────────────────────────
// Émis par les résolutions PURES à côté de leurs DraftEvent, consommés par
// `collectTriggeredEffects` → `store.processRuleEvents`. Jamais persistés.
// (La variante `tapped` du Glyphe Incandescent arrive avec la fenêtre
// d'actions de combat, lot E.)
export type RuleEvent =
  | {
      kind: "damageDealt";
      source: InstanceId | null;
      target: InstanceId;
      amount: number;
      /** Élément des Dommages, normalisé minuscules (410.1). */
      element: string;
      /** Dommages de combat (duels/frappes) vs effet ciblé. */
      combat: boolean;
    } // jamais émis à ≤ 0 (811.4)
  | { kind: "attackerDeclared"; seat: Seat; instanceId: InstanceId };

/**
 * Posture COMPLÈTE d'un combat (702–706) : qui attaque, qui bloque qui, et
 * la cible de l'attaque. Sert aux rôles de `reduceDamage` (Poum : attaquant,
 * bloqueur ou cible) et dérive les `blockers` de la `ForceStance` du lot B.
 */
export interface CombatStance {
  attackers: InstanceId[];
  /** blockerId → attackerId bloqué. */
  blocks: Record<InstanceId, InstanceId>;
  /** Cible de l'attaque — null = Havre-Sac / aucune. */
  targetId: InstanceId | null;
}

/**
 * Modificateurs GLOBAUX de Dommages consommés par `reduceDamage`.
 * Seul `treve` est implémenté au lot C ; `protectCombatants` (Glyphe
 * Revigorant) et `tapTrap` (Glyphe Incandescent) vivent dans `combat.mods`
 * et arrivent avec la fenêtre d'actions (lot E).
 */
export type DamageMod =
  | { kind: "treve" } // token treveUntilTurn du Héros
  | { kind: "protectCombatants"; seat: Seat; n: number } // [E] combat.mods
  | {
      kind: "tapTrap"; // [E] combat.mods
      seat: Seat;
      n: number;
      element: string;
      sourceName: string;
    };
