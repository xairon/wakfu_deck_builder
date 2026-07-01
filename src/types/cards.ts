import type { z } from "zod";
import {
  actionCardSchema,
  allyCardSchema,
  baseCardSchema,
  baseStatsSchema,
  cardEffectSchema,
  cardElementSchema,
  cardKeywordInfoSchema,
  cardKeywordSchema,
  cardMainTypeSchema,
  cardRaritySchema,
  cardSchema,
  compiledEffectOpSchema,
  compiledEffectSchema,
  condSpecSchema,
  countSpecSchema,
  valueExprSchema,
  dofusCardSchema,
  effectCoverageSchema,
  elementalAllyCardSchema,
  elementalCostSchema,
  elementalStatSchema,
  equipmentCardSchema,
  extensionInfoSchema,
  havenBagCardSchema,
  heroCardSchema,
  mechanicSchema,
  mechanicTagSchema,
  professionSchema,
  protectorCardSchema,
  roomCardSchema,
  staticAbilitySchema,
  zoneCardSchema,
} from "@/schema";

// ── Types primitifs (dérivés des schémas Zod) ──────────────────────────────
export type CardRarity = z.infer<typeof cardRaritySchema>;
export type CardElement = z.infer<typeof cardElementSchema>;
export type CardMainType = z.infer<typeof cardMainTypeSchema>;
export type CardKeyword = z.infer<typeof cardKeywordSchema>;
export type ElementalCost = z.infer<typeof elementalCostSchema>;
export type ElementalStat = z.infer<typeof elementalStatSchema>;
export type BaseStats = z.infer<typeof baseStatsSchema>;
export type Profession = z.infer<typeof professionSchema>;
export type ExtensionInfo = z.infer<typeof extensionInfoSchema>;

// ── Effets & mécaniques ────────────────────────────────────────────────────
export type CompiledEffectOp = z.infer<typeof compiledEffectOpSchema>;
export type CondSpec = z.infer<typeof condSpecSchema>;
export type CountSpec = z.infer<typeof countSpecSchema>;
export type ValueExpr = z.infer<typeof valueExprSchema>;
export type StaticAbility = z.infer<typeof staticAbilitySchema>;
export type CompiledEffect = z.infer<typeof compiledEffectSchema>;
export type EffectCoverage = z.infer<typeof effectCoverageSchema>;
export type CardEffect = z.infer<typeof cardEffectSchema>;
export type CardKeywordInfo = z.infer<typeof cardKeywordInfoSchema>;
export type MechanicTag = z.infer<typeof mechanicTagSchema>;
export type Mechanic = z.infer<typeof mechanicSchema>;

// ── Cartes ─────────────────────────────────────────────────────────────────
export type BaseCard = z.infer<typeof baseCardSchema>;
export type AllyCard = z.infer<typeof allyCardSchema>;
export type ActionCard = z.infer<typeof actionCardSchema>;
export type EquipmentCard = z.infer<typeof equipmentCardSchema>;
export type ZoneCard = z.infer<typeof zoneCardSchema>;
export type RoomCard = z.infer<typeof roomCardSchema>;
export type DofusCard = z.infer<typeof dofusCardSchema>;
export type HeroCard = z.infer<typeof heroCardSchema>;
export type ProtectorCard = z.infer<typeof protectorCardSchema>;
export type HavenBagCard = z.infer<typeof havenBagCardSchema>;
export type ElementalAllyCard = z.infer<typeof elementalAllyCardSchema>;
export type Card = z.infer<typeof cardSchema>;

// ── Type guards ────────────────────────────────────────────────────────────
export function isAllyCard(card: Card): card is AllyCard {
  return card.mainType === "Allié";
}
export function isActionCard(card: Card): card is ActionCard {
  return card.mainType === "Action";
}
export function isEquipmentCard(card: Card): card is EquipmentCard {
  return card.mainType === "Équipement";
}
export function isZoneCard(card: Card): card is ZoneCard {
  return card.mainType === "Zone";
}
export function isRoomCard(card: Card): card is RoomCard {
  return card.mainType === "Salle";
}
export function isDofusCard(card: Card): card is DofusCard {
  return card.mainType === "Dofus";
}
export function isHeroCard(card: Card): card is HeroCard {
  return card.mainType === "Héros";
}
export function isProtectorCard(card: Card): card is ProtectorCard {
  return card.mainType === "Protecteur";
}
export function isHavenBagCard(card: Card): card is HavenBagCard {
  return card.mainType === "Havre-Sac";
}
export function isElementalAllyCard(card: Card): card is ElementalAllyCard {
  return card.mainType === "Allié Élémentaire";
}

// ── Types de deck (non issus des données de cartes : interfaces conservées) ──
export interface DeckCard {
  card: Card;
  quantity: number;
  isReserve?: boolean;
}

export interface OfficialDeckData {
  name: string;
  hero?: string;
  havreSac?: string;
  cards: { name: string; quantity: number; type?: string }[];
}

/** Fiche éditoriale d'un deck publié dans la galerie communautaire. */
export interface DeckPublication {
  source?: string;
  tagline?: string;
  guide?: string;
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  hero: Card | null;
  havreSac: Card | null;
  cards: DeckCard[];
  reserve?: DeckCard[];
  extension?: string;
  createdAt: string;
  updatedAt: string;
  isOfficial?: boolean;
  isPublic?: boolean;
  publication?: DeckPublication;
  _officialData?: OfficialDeckData;
}
