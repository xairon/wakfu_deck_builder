import type { InstanceId, Position } from "./events";
import type { ZoneRef } from "./zones";
import type { CombatTargetRef } from "./state";

/** Intentions de jeu de HAUT NIVEAU (le serveur les valide + les résout en
 *  events autoritatifs). L'acteur est imposé serveur, jamais dans le payload. */
export type GameIntent =
  | { kind: "PLAY_CARD"; instanceId: InstanceId; position?: Position }
  | {
      kind: "MOVE_CARD";
      instanceId: InstanceId;
      to: ZoneRef;
      position?: Position;
    }
  | { kind: "TAP"; instanceId: InstanceId }
  | { kind: "UNTAP"; instanceId: InstanceId }
  | {
      kind: "SET_COUNTER";
      instanceId: InstanceId;
      counter: string;
      value: number;
      token?: boolean;
    }
  | {
      kind: "INC_COUNTER";
      instanceId: InstanceId;
      counter: string;
      delta: number;
      token?: boolean;
    }
  | {
      kind: "SET_LEVEL";
      instanceId: InstanceId;
      face: "recto" | "verso";
      level?: number;
      xp?: number;
    }
  | { kind: "ATTACH"; equipmentId: InstanceId; bearerId: InstanceId }
  | { kind: "DETACH"; equipmentId: InstanceId; to: ZoneRef; position: Position }
  | { kind: "END_TURN" }
  // ── Combat (P3) — combat-au-journal, le serveur l'adjuge (702–708) ──────────
  // L'acteur est imposé serveur : DECLARE_ATTACK/RESOLVE/CANCEL = l'attaquant
  // (joueur actif) ; DECLARE_BLOCK = le défenseur (HORS de son tour, légitime).
  | { kind: "DECLARE_ATTACK"; attackers: InstanceId[]; target: CombatTargetRef }
  | {
      kind: "DECLARE_BLOCK";
      /** blockerId → attackerId bloqué (carte complète, remplace l'état). */
      blocks: Record<InstanceId, InstanceId>;
      /** 707.1 : targetId → attaquant frappé par la riposte (choix du défenseur). */
      ripostes?: Record<InstanceId, InstanceId>;
    }
  | {
      kind: "RESOLVE_COMBAT";
      /** 6105 : attackerId → bloqueur frappé (choix de l'attaquant). */
      strikes?: Record<InstanceId, InstanceId>;
    }
  | { kind: "CANCEL_COMBAT" };
