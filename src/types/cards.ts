import { EXTENSION_LEVELS } from "@/config/cards";

// Types de base
export type CardRarity =
  | "Commune"
  | "Peu Commune"
  | "Rare"
  | "Mythique"
  | "Légendaire"
  | "Krosmaster";
export type CardElement = "Air" | "Eau" | "Feu" | "Terre" | "Neutre";

// Types principaux de cartes
export type CardMainType =
  | "Allié"
  | "Action"
  | "Équipement"
  | "Zone"
  | "Salle"
  | "Dofus"
  | "Héros"
  | "Protecteur"
  | "Havre-Sac"
  | "Allié Élémentaire";

// Interface pour les ressources élémentaires
export interface ElementalCost {
  element: CardElement;
  count: number;
}

// ── Effets compilés (moteur de règles) ──────────────────────────────────────
// Forme machine d'un effet, générée hors-ligne par `scripts/compileEffects.ts`
// (parsing STRICT du texte : si une phrase n'est pas comprise, pas de
// `compiled` — l'effet reste manuel à la table).
export type CompiledEffectOp =
  | { op: "gainXp"; n: number }
  | { op: "draw"; n: number }
  | { op: "heroGainPv"; n: number }
  | { op: "heroLosePv"; n: number }
  | { op: "damageOppHero"; n: number }
  | { op: "havreSacGainResistance"; n: number }
  /** « Détruisez [quoi] de votre choix » — le joueur cible à la table. */
  | {
      op: "destroyTarget";
      what: "Allié" | "Zone" | "Équipement";
      zones: ("monde" | "havreSac")[];
    }
  /** « [X] inflige N Dommages à l'Allié (ou Héros) de votre choix » —
   *  élément de la source figé à la compilation (Résistance de la cible). */
  | {
      op: "damageTarget";
      n: number;
      element: string;
      heroes: boolean;
      zones: ("monde" | "havreSac")[];
    }
  /** « Le Héros de votre choix regagne N PV ». */
  | { op: "healHeroTarget"; n: number }
  /** « L'Allié (ou Héros) de votre choix gagne +N en Force jusqu'à la fin
   *  du tour » — compteur temporaire purgé à la fin du tour. */
  | {
      op: "buffForceTarget";
      n: number;
      heroes: boolean;
      /** Famille requise de la cible (normalisée, ex. "monstre"). */
      sub?: string;
      zones: ("monde" | "havreSac")[];
    }
  /** « [Cette carte] gagne +N en Force jusqu'à la fin du tour ». */
  | { op: "buffForceSelf"; n: number }
  /** « Recyclez N carte(s) [Élément] de votre Défausse » — choix dans la
   *  pile, remise SOUS la Pioche du propriétaire (3389). `element` :
   *  seules les cartes de cet Élément sont éligibles. */
  | { op: "recycleFromDiscard"; n: number; element?: string }
  /** « Défaussez-vous de N carte(s) » — choix dans sa main. */
  | { op: "discardFromHand"; n: number }
  /** « Cherchez un [type] [Famille] [de Niveau ≤ N] dans votre Pioche … » —
   *  choix filtré dans la Pioche, vers la main ou le jeu. */
  | {
      op: "searchDeck";
      what: "Dofus" | "Action" | "Équipement" | "Zone" | "Salle" | "Allié";
      /** Sous-type/famille requis (normalisé minuscules, ex. "wabbit"). */
      sub?: string;
      /** Niveau maximal de la carte cherchée. */
      maxLevel?: number;
      /** « Il apparaît incliné. » — la carte mise en jeu arrive inclinée. */
      tapped?: boolean;
      dest: "main" | "monde";
    }
  /** « … puis mélangez votre Pioche ». */
  | { op: "shuffleDeck" }
  /** Détruit la carte source de l'effet (branche « ou détruisez X »). */
  | { op: "destroySelf" }
  /** « Perdez N PA/PM jusqu'à la fin du tour » — modificateur temporaire. */
  | { op: "loseStatTurn"; stat: "pa" | "pm"; n: number }
  /** Incline la carte source (« [X] apparaît incliné »). */
  | { op: "tapSelf" }
  /** « Quand [self] attaque, il gagne +F en Force[, +PM PM][ et Géant]
   *  jusqu'à la fin du combat » (Bruss Ouilis) — jetons `forceCombatMod` /
   *  `pmCombatMod` / `geantCombatMod` posés sur la source, purgés à la fin
   *  du combat (et à l'annulation, et en fin de tour). */
  | { op: "combatModSelf"; force?: number; pm?: number; geant?: boolean }
  /** « Vos Alliés dans le Monde gagnent +N en Force jusqu'à la fin du
   *  tour » (Stratégie de Groupe) — jeton de SIÈGE `teamForceMod` sur le
   *  Héros : ensemble dynamique (812.3b), valeur figée à la résolution
   *  (`"heroLevel"` = Niveau du Héros au moment de résoudre). */
  | { op: "buffForceAlliesMondeTurn"; n: number | "heroLevel" }
  /** « Jusqu'au début de votre prochain tour, tous les Dommages sont
   *  réduits à 0 » (Trêve) — jeton `treveUntilTurn` sur le Héros. */
  | { op: "globalDamageShield" };

// ── Pouvoirs continus (805 / 812.2) — couche dérivée, jamais d'événement ────
export type StaticAbility =
  | { kind: "forceAura"; n: number; sub: string } // Chef de Guerre Bouftou
  | { kind: "forceWhileBlocking"; n: number } // Maître Bolet
  | { kind: "forceEqualsHandSize" } // Vrombyx
  | { kind: "cannotBlock" } // Jicé Aouaire
  | { kind: "combatDamageReduction"; n: number }; // Poum Ondacié

export interface CompiledEffect {
  /** onArrive : entrée en jeu ; onTap : pouvoir incliné ; onPlay : Action
   *  résolue au moment où elle est jouée (puis défaussée, 302.1) ;
   *  onTurnStart : début du tour de son contrôleur (602) ;
   *  static : pouvoir continu (couche dérivée, `static` requis, ops vides) ;
   *  onSelfAttacks : « Quand [self] attaque » (804.5, bus RuleEvents) ;
   *  onDamageToBearer : riposte du Porteur (804.3) — déclaré ici, collecté
   *  par le bus, mais DORMANT tant que le modèle Équipement (lot F) n'existe
   *  pas (`bearerOf` absent → aucune frame). */
  trigger:
    | "onArrive"
    | "onTap"
    | "onPlay"
    | "onTurnStart"
    | "static"
    | "onSelfAttacks"
    | "onDamageToBearer";
  /** « Vous pouvez … » : le joueur confirme avant exécution. */
  optional?: boolean;
  /** « Détruisez [cette carte] : … » — le coût remplace l'inclinaison. */
  cost?: "sacrificeSelf";
  /** « … ou détruisez [cette carte] » : refuser `ops` détruit la source. */
  orElse?: "destroySelf";
  /** Pouvoir continu — présent ssi `trigger === "static"`. */
  static?: StaticAbility;
  ops: CompiledEffectOp[];
}

// Interface pour les effets
export interface CardEffect {
  description: string;
  elements?: CardElement[];
  isOncePerTurn?: boolean;
  requiresIncline?: boolean;
  /** Texte NON imprimé sur la carte (note de règle / errata du site,
   *  scrapé dans effects[] à tort) : exclu du comptage d'effets et de
   *  toute compilation. Posé par `npm run compile-effects`. */
  kind?: "ruling" | "errata";
  /** Présent uniquement si le texte est entièrement compris par le DSL. */
  compiled?: CompiledEffect;
  linkedTokens?: {
    name: string;
    type: string[];
    force?: number;
    elements?: CardElement[];
  }[];
}

// Interface pour les mots-clés
export interface CardKeywordInfo {
  name: CardKeyword;
  description: string;
  elements?: CardElement[];
}

// Interface pour les statistiques élémentaires
export interface ElementalStat {
  value: number;
  element: CardElement;
}

// Stats de base étendues
export interface BaseStats {
  niveau?: ElementalStat;
  force?: ElementalStat;
  pa?: number;
  pm?: number;
  pv?: number;
  cost?: number;
  /** Havre-Sac : capacité d'accueil (Héros + Alliés + Salles, 2315). */
  taille?: number;
  /** Havre-Sac : points de Résistance imprimés (2303). */
  resistance?: number;
}

// Interface pour les métiers
export interface Profession {
  name: string;
  level: number;
  specialization?: string;
}

// Interface pour les informations d'extension
export interface ExtensionInfo {
  name: keyof typeof EXTENSION_LEVELS;
  id: string;
  number?: string;
  shortUrl?: string;
}

// Interface de base pour toutes les cartes
export interface BaseCard {
  id: string;
  name: string;
  mainType: CardMainType;
  subTypes: string[];
  extension: ExtensionInfo;
  rarity: CardRarity;
  stats?: BaseStats;
  effects?: CardEffect[];
  keywords?: CardKeywordInfo[];
  experience?: number;
  artists: string[];
  notes?: string[];
  flavor?: {
    text: string;
    attribution?: string;
  };
  imageUrl?: string;
  url?: string;
}

// Interface pour les cartes de type Allié
export interface AllyCard extends BaseCard {
  mainType: "Allié";
  stats: BaseStats;
  effects?: CardEffect[];
  keywords?: CardKeywordInfo[];
  race?: string;
  tribe?: string;
}

// Interface pour les cartes de type Action
export interface ActionCard extends BaseCard {
  mainType: "Action";
  effects: CardEffect[];
  keywords?: CardKeywordInfo[];
  spellSchool?: string;
}

// Interface pour les cartes de type Équipement
export interface EquipmentCard extends BaseCard {
  mainType: "Équipement";
  stats?: BaseStats;
  effects?: CardEffect[];
  keywords?: CardKeywordInfo[];
  equipmentType:
    | "Arme"
    | "Armure"
    | "Bijou"
    | "Chapeau"
    | "Bottes"
    | "Cape"
    | "Ceinture"
    | "Amulette"
    | "Anneau";
  durability?: number;
  requirements?: {
    level?: number;
    professions?: string[];
    elements?: CardElement[];
  };
}

// Interface pour les cartes de type Zone
export interface ZoneCard extends BaseCard {
  mainType: "Zone";
  effects: CardEffect[];
  keywords?: CardKeywordInfo[];
  zoneType?: string;
}

// Interface pour les cartes de type Salle
export interface RoomCard extends BaseCard {
  mainType: "Salle";
  effects: CardEffect[];
  keywords?: CardKeywordInfo[];
  roomType?: string;
}

// Interface pour les cartes de type Dofus
export interface DofusCard extends BaseCard {
  mainType: "Dofus";
  effects: CardEffect[];
  keywords?: CardKeywordInfo[];
  requirements?: {
    level?: number;
    elements?: CardElement[];
  };
}

// Interface pour les cartes de type Héros
export interface HeroCard extends BaseCard {
  mainType: "Héros";
  class: string;
  recto: {
    stats: BaseStats;
    effects: CardEffect[];
    keywords: CardKeywordInfo[];
  };
  verso?: {
    stats: BaseStats;
    effects: CardEffect[];
    keywords: CardKeywordInfo[];
  };
}

// Interface pour les cartes de type Protecteur
export interface ProtectorCard extends BaseCard {
  mainType: "Protecteur";
  stats: BaseStats;
  effects: CardEffect[];
  keywords?: CardKeywordInfo[];
  protectorType?: string;
}

// Interface pour les cartes de type Havre-Sac
export interface HavenBagCard extends BaseCard {
  mainType: "Havre-Sac";
  effects: CardEffect[];
  keywords?: CardKeywordInfo[];
  capacity?: number;
}

// Interface pour les cartes de type Allié Élémentaire
export interface ElementalAllyCard extends BaseCard {
  mainType: "Allié Élémentaire";
  stats: BaseStats;
  effects?: CardEffect[];
  keywords?: CardKeywordInfo[];
  elements: CardElement[];
  elementalAffinity?: {
    primary: CardElement;
    secondary?: CardElement;
  };
}

// Type union pour toutes les cartes possibles
export type Card =
  | AllyCard
  | ActionCard
  | EquipmentCard
  | ZoneCard
  | RoomCard
  | DofusCard
  | HeroCard
  | ProtectorCard
  | HavenBagCard
  | ElementalAllyCard;

// Type guard functions
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

// Types utilitaires
export type CardKeyword =
  | "Inclinaison"
  | "Riposte"
  | "Portée"
  | "Critique"
  | "Parade"
  | "Résistance"
  | "Recette"
  | "Géant"
  | "Unique";

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
  /** Catégorie : « Création » | « Starter » | « Dofus Mag » | « Tournoi »… */
  source?: string;
  /** Accroche courte (1 phrase). */
  tagline?: string;
  /** Guide « comment jouer » (texte libre). */
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
  /** Publié dans la galerie communautaire (decks.is_public, migration 0003). */
  isPublic?: boolean;
  /** Fiche éditoriale (source, accroche, guide) — migration 0005. */
  publication?: DeckPublication;
  _officialData?: OfficialDeckData;
}
