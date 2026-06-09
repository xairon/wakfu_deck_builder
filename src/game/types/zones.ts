/**
 * Zones de jeu & visibilité — Module de jeu « La Table des Douze » (L0).
 *
 * Six zones officielles (règle 501.1) + zones de méta-jeu (Réserve 101.4, Exil,
 * Limbo technique). Réf. : docs/GAME-MODULE-V1.md §3, src/data/rules.ts.
 *
 * Identifiants TS en camelCase anglais, libellés FR dans l'UI.
 */

export type Seat = "A" | "B";
export type Viewer = Seat | "spectator";

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
  return seat === "A" ? "B" : "A";
}
