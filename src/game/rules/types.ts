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
}

export interface CombatResult {
  events: DraftEvent[];
  /** Lignes lisibles pour le journal. */
  log: string[];
  destroyed: InstanceId[];
  winner: Seat | null;
}
