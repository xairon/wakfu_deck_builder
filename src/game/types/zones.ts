/**
 * Zones de jeu & visibilité — Module de jeu « La Table des Douze » (L0).
 *
 * Six zones officielles (règle 501.1) + zones de méta-jeu (Réserve 101.4, Exil,
 * Limbo technique). Réf. : docs/GAME-MODULE-V1.md §3, src/data/rules.ts.
 *
 * Identifiants TS en camelCase anglais, libellés FR dans l'UI.
 */

export type Seat = "A" | "B" | "A1" | "B1" | "A2" | "B2";
export type Viewer = Seat | "spectator";
export type Team = "team1" | "team2";

export const TURN_ORDER_2V2: Seat[] = ["A1", "B1", "A2", "B2"];

export function getTeam(seat: Seat): Team {
  return seat === "B" || seat === "B1" || seat === "B2" ? "team2" : "team1";
}

export function getTeammate(seat: Seat): Seat | null {
  if (seat === "A1") return "A2";
  if (seat === "A2") return "A1";
  if (seat === "B1") return "B2";
  if (seat === "B2") return "B1";
  return null;
}

export function isTeammate(seatA: Seat, seatB: Seat): boolean {
  if (seatA === seatB) return true;
  return getTeam(seatA) === getTeam(seatB);
}

export function getOpponents(seat: Seat, mode: "1v1" | "2v2" = "1v1"): Seat[] {
  if (mode === "2v2") {
    return getTeam(seat) === "team1" ? ["B1", "B2"] : ["A1", "A2"];
  }
  return [seat === "A" ? "B" : "A"];
}

export function getNextSeat(
  current: Seat,
  mode: "1v1" | "2v2" = "1v1",
  eliminatedSeats: Seat[] = [],
): Seat {
  if (mode === "2v2") {
    const order = TURN_ORDER_2V2;
    const currentIndex = order.indexOf(current);
    const startIdx = currentIndex >= 0 ? currentIndex : 0;
    for (let i = 1; i <= 4; i++) {
      const next = order[(startIdx + i) % 4];
      if (!eliminatedSeats.includes(next)) {
        return next;
      }
    }
    return current;
  }
  return current === "A" ? "B" : "A";
}

/** Les six zones de jeu officielles (501.1). */
export const ZONE = {
  Pioche: "pioche",
  Main: "main",
  Monde: "monde", // commune (506.1)
  HavreSac: "havreSac",
  Defausse: "defausse",
  FileAttente: "fileAttente", // commune (503.2)
} as const;
export type GameZone = (typeof ZONE)[keyof typeof ZONE];

/** Hors des six zones : Réserve (tournoi 101.4), Exil (banni), Limbo (transit). */
export const META_ZONE = {
  Reserve: "reserve",
  Exil: "exil",
  Limbo: "limbo",
} as const;
export type MetaZone = (typeof META_ZONE)[keyof typeof META_ZONE];

export type AnyZone = GameZone | MetaZone;

/** Référence d'une zone : commune (sans owner) ou personnelle (avec owner). */
export type ZoneRef =
  | { zone: "monde" | "fileAttente" }
  | { zone: Exclude<AnyZone, "monde" | "fileAttente">; owner: Seat };

export interface ZoneSpec {
  scope: "shared" | "per-player";
  ordered: boolean;
  /** Contenu visible de tous par défaut. */
  public: boolean;
  /** Seuls Monde & Havre-Sac portent l'inclinaison (106.3). */
  tracksOrientation: boolean;
  defaultFace: "recto" | "hidden";
}

export const ZONE_SPECS: Record<AnyZone, ZoneSpec> = {
  pioche: {
    scope: "per-player",
    ordered: true,
    public: false,
    tracksOrientation: false,
    defaultFace: "hidden",
  },
  main: {
    scope: "per-player",
    ordered: false,
    public: false,
    tracksOrientation: false,
    defaultFace: "recto",
  },
  monde: {
    scope: "shared",
    ordered: false,
    public: true,
    tracksOrientation: true,
    defaultFace: "recto",
  },
  havreSac: {
    scope: "per-player",
    ordered: false,
    public: true,
    tracksOrientation: true,
    defaultFace: "recto",
  },
  defausse: {
    scope: "per-player",
    ordered: false,
    public: true,
    tracksOrientation: false,
    defaultFace: "recto",
  },
  fileAttente: {
    scope: "shared",
    ordered: true,
    public: true,
    tracksOrientation: false,
    defaultFace: "recto",
  },
  reserve: {
    scope: "per-player",
    ordered: false,
    public: false,
    tracksOrientation: false,
    defaultFace: "recto",
  },
  exil: {
    scope: "per-player",
    ordered: false,
    public: true,
    tracksOrientation: false,
    defaultFace: "recto",
  },
  limbo: {
    scope: "per-player",
    ordered: true,
    public: false,
    tracksOrientation: false,
    defaultFace: "hidden",
  },
} as const;

/** Owner d'une ZoneRef (null pour les zones communes). */
export function zoneOwner(ref: ZoneRef): Seat | null {
  return "owner" in ref ? ref.owner : null;
}

export function isCommonZone(zone: AnyZone): boolean {
  return zone === "monde" || zone === "fileAttente";
}

export function sameZoneRef(a: ZoneRef, b: ZoneRef): boolean {
  return a.zone === b.zone && zoneOwner(a) === zoneOwner(b);
}

export function otherSeat(seat: Seat): Seat {
  if (seat === "A1") return "B1";
  if (seat === "A2") return "B2";
  if (seat === "B1") return "A1";
  if (seat === "B2") return "A2";
  return seat === "A" ? "B" : "A";
}
