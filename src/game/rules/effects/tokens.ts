/**
 * JETONS DE CRÉATURE (« Mettez en jeu un jeton "Monstre - X" de Force N
 * [Élément] »). Un jeton n'a PAS de carte de deck : il est minté DIRECTEMENT en
 * jeu par un pouvoir (Abraknyde, Vampyro…). Pour rester FIDÈLE, un jeton doit
 * être un participant de combat à part entière — distribuer sa Force, attaquer /
 * bloquer / subir des Dommages, mourir quand les Dommages ≥ sa Force — sans
 * réécrire les lecteurs de stats / combat.
 *
 * REPRÉSENTATION CHOISIE : carte SYNTHÉTIQUE en registre.
 * Toutes les lectures de carte du moteur passent par `getCard(cardId)`
 * (effectiveForce, destruction, combat, ciblage, masse…). On fabrique donc une
 * `Card` synthétique (mainType "Allié", subType "Monstre" + Famille, Force /
 * Élément imprimés) qu'on enregistre sous un `cardId` synthétique DÉTERMINISTE,
 * et on branche `getCard` du store pour qu'il consulte ce registre en repli. Les
 * lecteurs honorent alors le jeton SANS modification (un jeton EST une carte
 * Allié de Force connue). Aucune carte de deck, aucune entrée de collection.
 *
 * Le registre est volontairement un module-singleton process-wide : un jeton de
 * mêmes (nom, Force, Élément, Famille) partage UNE entrée de carte (les jetons
 * « portant le même nom » se reconnaissent par `name`). Le `cardId` encode le
 * gabarit → idempotent (re-créer le même jeton ne pollue pas le registre ;
 * relancer le moteur sur le même journal redonne le même état).
 */
import type { AllyCard, Card, CardElement } from "@/types/cards";

/** Préfixe des `cardId` synthétiques de jeton (jamais un id de carte réelle). */
export const TOKEN_CARD_PREFIX = "__token__";

/** Un `cardId` désigne-t-il une carte de JETON synthétique ? */
export function isTokenCardId(cardId: string | null | undefined): boolean {
  return (
    typeof cardId === "string" && cardId.startsWith(TOKEN_CARD_PREFIX + ":")
  );
}

/** Spécification minimale d'un jeton de créature. */
export interface TokenSpec {
  /** Nom affiché / « jetons portant le même nom » (ex. « Monstre - Arakne »). */
  name: string;
  /** Force imprimée (dommages infligés ET seuil de létalité, 204.4). */
  force: number;
  /** Élément des Dommages (204/410.1). Texte libre (canonicalisé) ; défaut Neutre. */
  element?: string;
  /** Famille de créature (subType d'Allié, ex. « Arakne », « Vampyre »). */
  sub?: string;
}

/** Élément canonique (capitalisé) — repli Neutre. */
function canonElement(el: string | undefined): CardElement {
  const map: Record<string, CardElement> = {
    air: "Air",
    eau: "Eau",
    feu: "Feu",
    terre: "Terre",
    neutre: "Neutre",
  };
  return el ? (map[el.trim().toLowerCase()] ?? "Neutre") : "Neutre";
}

/**
 * `cardId` synthétique DÉTERMINISTE d'un gabarit de jeton : encode (nom, Force,
 * Élément, Famille). Deux jetons de même gabarit partagent ce cardId (donc une
 * entrée de registre) — comportement voulu pour « portant le même nom » et pour
 * l'idempotence (re-mint = même clé). Les `:` du préfixe séparent les champs ;
 * le nom est laissé tel quel (pas de collision attendue : les gabarits sont peu
 * nombreux et fermés au jeu de données).
 */
export function tokenCardId(spec: TokenSpec): string {
  const element = canonElement(spec.element);
  return [
    TOKEN_CARD_PREFIX,
    spec.name,
    String(spec.force),
    element,
    spec.sub ?? "",
  ].join(":");
}

// Registre process-wide : cardId synthétique → Card synthétique.
const registry = new Map<string, Card>();

/**
 * Construit (si absente) et renvoie la carte SYNTHÉTIQUE d'un gabarit de jeton.
 * mainType "Allié", subTypes ["Monstre", <Famille>] (« jeton "Monstre - X" »),
 * Force / Élément imprimés via `stats.force` (lu par forceValue → effectiveForce
 * → distribution de Force, létalité, dommages). Aucun effet (les jetons n'ont
 * pas d'effet d'apparition). Idempotent (même cardId = même entrée).
 */
export function ensureTokenCard(spec: TokenSpec): Card {
  const id = tokenCardId(spec);
  const existing = registry.get(id);
  if (existing) return existing;
  const element = canonElement(spec.element);
  const subTypes = ["Monstre", ...(spec.sub ? [spec.sub] : [])];
  const card: AllyCard = {
    id,
    name: spec.name,
    mainType: "Allié",
    subTypes,
    extension: { name: "Token", id: "token", number: "0", shortUrl: "token" },
    rarity: "Commune",
    stats: { force: { value: spec.force, element } },
    effects: [],
    keywords: [],
    artists: [],
    notes: [],
    imageUrl: "",
  } as AllyCard;
  registry.set(id, card);
  return card;
}

/** Carte synthétique d'un `cardId` de jeton, ou null si inconnu / non-jeton. */
export function getTokenCard(cardId: string | null | undefined): Card | null {
  if (!isTokenCardId(cardId)) return null;
  return registry.get(cardId as string) ?? null;
}

/** @internal — vide le registre (tests). */
export function resetTokenRegistry(): void {
  registry.clear();
}
