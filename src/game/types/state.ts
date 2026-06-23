/**
 * GameState omniscient (serveur) — Module de jeu (L0).
 * Réf. : docs/GAME-MODULE-V1.md §5. On ne transporte JAMAIS l'objet `Card`,
 * seulement le `cardId` (string) ; la résolution cardId→Card reste client.
 */
import type { Seat, ZoneRef } from "./zones";
import type { InstanceId } from "./events";

export interface CardCounters {
  hp?: number; // PV courant (Héros, 410.2)
  pa?: number; // Points d'Action disponibles (suivi de table)
  pm?: number; // Points de Mouvement disponibles (suivi de table)
  resistance?: number; // Résistance (Havre-Sac, 306.3)
  damage?: number; // Dommages cumulés, purgés fin de tour (410.8)
  level?: number; // 1→2→3 (307.4/307.5)
  xp?: number; // 6→N2, 18→N3
  tokens?: Record<string, number>; // jetons génériques nommés
}

export interface CardInstance {
  instanceId: InstanceId;
  cardId: string | null; // null pour token pur ; sinon Card.id
  owner: Seat; // propriétaire (immuable, 501.2)
  controller: Seat; // contrôleur courant (peut différer dans le Monde)
  location: ZoneRef;
  face: "hidden" | "recto" | "verso";
  orientation: "upright" | "tapped" | null; // null hors monde/havreSac (106.3)
  counters: CardCounters;
  attachments: InstanceId[]; // équipements/Dofus attachés (305.3/304.5)
  revealedTo: Seat[]; // révélations ciblées (look/recherche)
}

export type TurnPhase = "redressement" | "principale" | "pioche" | "fin";

/** Cible unique d'une attaque (702.2) — structurellement = rules/types CombatTarget. */
export interface CombatTargetRef {
  kind: "hero" | "ally" | "havreSac";
  instanceId: InstanceId;
}

/**
 * Combat EN COURS, dérivé du journal (702–708). Sous-ensemble GAME-STATE de
 * l'ancien `gameStore.combat` (les curseurs d'UI — strikeFor/pendingBlocker/… —
 * restent côté client). Présent uniquement entre la déclaration d'attaque et la
 * résolution ; `null` sinon. Folé par le reducer via l'event SET_COMBAT.
 */
export interface CombatState {
  attackerSeat: Seat;
  step: "blockers" | "strikes" | "riposte";
  target: CombatTargetRef;
  attackers: InstanceId[];
  /** blockerId → attackerId bloqué. */
  blocks: Record<InstanceId, InstanceId>;
  /** 6105 : attackerId → bloqueur frappé (duels multi-bloqueurs sans Géant). */
  strikes?: Record<InstanceId, InstanceId>;
  /** 707.1 : targetId → attaquant frappé par la riposte de la Cible. */
  ripostes?: Record<InstanceId, InstanceId>;
  /** 706.5 : siège réagissant HORS de son tour (le défenseur, fenêtre de blocage). */
  reactingSeat: Seat | null;
}

export interface PlayerBoard {
  seat: Seat;
  pioche: InstanceId[];
  main: InstanceId[];
  havreSac: InstanceId[];
  defausse: InstanceId[];
  reserve: InstanceId[];
  exil: InstanceId[];
  limbo: InstanceId[];
  heroInstanceId?: InstanceId;
  havreSacInstanceId?: InstanceId;
}

export interface GameState {
  gameId: string;
  status: "lobby" | "active" | "finished";
  seats: Record<Seat, PlayerBoard>;
  monde: InstanceId[]; // commune — contient les 2 Havre-Sac
  fileAttente: InstanceId[]; // commune, ordonnée (503)
  instances: Record<InstanceId, CardInstance>; // registre central omniscient
  turn: { active: Seat; number: number; phase: TurnPhase; firstPlayer: Seat };
  /** Combat en cours (702–708) ou null — dérivé du journal (SET_COMBAT). */
  combat?: CombatState | null;
  /** Dernier tour où chaque siège a attaqué (règle 1 attaque/tour, 603). */
  lastAttackTurn?: Partial<Record<Seat, number>>;
  rng: { masterSeedHash: string };
  seq: number; // dernier event appliqué
}

// ── Vue redactée (ce qu'un client reçoit) ────────────────────────────────────

export interface RedactedInstance {
  instanceId: InstanceId;
  cardId: string | null; // null si non visible par le viewer
  owner: Seat;
  controller: Seat;
  face: "hidden" | "recto" | "verso";
  orientation: "upright" | "tapped" | null;
  counters: CardCounters;
  attachments: InstanceId[];
}

export type RedactedZone =
  | { kind: "full"; instances: RedactedInstance[] }
  | { kind: "count"; count: number; faceDown: true };

export interface RedactedBoard {
  seat: Seat;
  pioche: RedactedZone;
  main: RedactedZone;
  havreSac: RedactedZone;
  defausse: RedactedZone;
  reserve: RedactedZone | null; // null = caché au viewer
  exil: RedactedZone;
  heroInstanceId?: InstanceId;
  havreSacInstanceId?: InstanceId;
}

export interface RedactedGameState {
  gameId: string;
  status: GameState["status"];
  viewer: Seat | "spectator";
  seats: Record<Seat, RedactedBoard>;
  monde: RedactedZone;
  fileAttente: RedactedZone;
  turn: GameState["turn"];
  /** Combat en cours (public : attaquants/bloqueurs/cible sont sur le plateau). */
  combat?: CombatState | null;
  lastAttackTurn?: Partial<Record<Seat, number>>;
  seq: number;
}
