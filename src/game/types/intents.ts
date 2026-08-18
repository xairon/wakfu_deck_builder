import type { InstanceId, Position } from "./events";
import type { ZoneRef } from "./zones";
import type { CombatTargetRef } from "./state";

/** Intentions de jeu de HAUT NIVEAU (le serveur les valide + les résout en
 *  events autoritatifs). L'acteur est imposé serveur, jamais dans le payload. */
export type GameIntent =
  | {
      kind: "PLAY_CARD";
      instanceId: InstanceId;
      position?: Position;
      /** 303.1 — choix du contrôleur pour un ALLIÉ aux tours ≥ 2 (défaut :
       *  Monde). Ignoré pour les autres types (zone imposée par la règle). */
      destination?: "monde" | "havreSac";
      /** 305.x (lot F) — PORTEUR choisi pour un ÉQUIPEMENT / une Monture :
       *  OBLIGATOIRE quand la carte se joue attachée (requiresBearer), validé
       *  serveur (eligibleBearers) puis événement ATTACH autoritatif. */
      bearerId?: InstanceId;
    }
  | {
      kind: "MOVE_CARD";
      instanceId: InstanceId;
      to: ZoneRef;
      position?: Position;
    }
  | {
      /** A19 / lot F — FABRICATION (305.4/418.6) : soumission ATOMIQUE des
       *  choix, ENTIÈREMENT revalidée serveur (Artisan du Métier dressé,
       *  cartes recyclées de l'Élément dans la Défausse, Porteur éligible). */
      kind: "CRAFT";
      equipmentId: InstanceId;
      artisanId: InstanceId;
      recycledIds: InstanceId[];
      bearerId?: InstanceId;
      destination?: "monde" | "havreSac";
    }
  | { kind: "TAP"; instanceId: InstanceId }
  | { kind: "UNTAP"; instanceId: InstanceId }
  | {
      kind: "SET_COUNTER";
      instanceId: InstanceId;
      counter: string;
      value: number | string | null;
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
  | { kind: "DRAW" }
  | {
      /** TABLE MANUELLE (Cadre) — geste « Mettez en jeu un jeton "Monstre - X"
       *  de Force N [Élément] » : le serveur dérive le cardId synthétique du
       *  GABARIT (jamais fourni par le client) et mint l'instance dans le
       *  Monde. Refusé hors table manuelle (en assisté, les jetons dérivent
       *  des effets). */
      kind: "CREATE_TOKEN";
      name: string;
      force: number;
      element?: string;
      sub?: string;
      tapped?: boolean;
    }
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
      /** 6135 : attackerId Géant → répartition { bloqueur|cible → n } (choix
       *  de l'attaquant ; invalide → politique auto côté moteur). */
      geantAssign?: Record<InstanceId, Record<InstanceId, number>>;
    }
  | { kind: "CANCEL_COMBAT" };
