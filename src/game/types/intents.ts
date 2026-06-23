import type { InstanceId, Position } from "./events";
import type { ZoneRef } from "./zones";

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
  | { kind: "END_TURN" };
