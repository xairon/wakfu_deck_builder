# Format de données des cartes — Fondation robuste : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire des schémas Zod la source de vérité unique (types + validation) du format de cartes, ajouter un gate de validation des données, un statut de couverture par effet et un registre de mécaniques dérivé des ops.

**Architecture:** `src/schema/*.ts` (Zod) devient la source de vérité ; `src/types/cards.ts` ré-exporte les types via `z.infer` (imports consommateurs inchangés). Un test CI valide chaque carte de `public/data/*.json`. `scripts/compileEffects.ts` pose un champ `coverage` explicite par effet et dérive `effects[].mechanics` depuis les ops compilées via un registre de mécaniques contrôlé.

**Tech Stack:** TypeScript ~5.3, Zod, Vitest 3, tsx (scripts), vue-tsc (gate de types).

**Findings d'audit intégrés au plan (dérives type↔données réelles, surfacées par l'absence de gate) :**

- `extension.name` ne correspond pas aux clés `EXTENSION_LEVELS` (ex. `'Bonta & Brâkmar'`) → modélisé `z.string()`.
- `extension.id` typé requis mais **absent** des données → optionnel.
- `equipmentType` réel = `Arme | Armure | Bijou | Bouclier | Dofus | Familier | Objet` (l'enum TS actuel est fictif) → enum corrigé.
- Protecteur utilise `guardianType` (12/12), jamais `protectorType` → champ renommé.
- Héros ont un `level` numérique top-level non typé → ajouté.
- `coverage`/`mechanics` rendus **optionnels** dans le type (aucune casse des factories/consommateurs) ; leur présence sur les données réelles est imposée par un test invariant, pas par le type.

---

## Structure des fichiers

**Créés :**

- `src/schema/primitives.ts` — enums + petites formes (rareté, élément, type, stats, extension, requirements, profession, coût élémentaire).
- `src/schema/mechanics.ts` — `mechanicTagSchema`, `mechanicSchema` (vocabulaire des mécaniques).
- `src/schema/effects.ts` — ops compilées, pouvoir continu, effet compilé, effet de carte (`coverage`/`mechanics`), info mot-clé.
- `src/schema/cards.ts` — carte de base + 10 sous-types + union discriminée.
- `src/schema/index.ts` — barrel.
- `src/data/mechanics.ts` — registre `MECHANICS` + table `OP_TO_MECHANIC` + `mechanicsForOps()`.
- `tests/data/cardSchema.spec.ts` — toutes les cartes réelles parsent.
- `tests/data/mechanics.spec.ts` — complétude/cohérence de la table + dérivation.
- `tests/data/coverage.spec.ts` — invariant de couverture + point fixe mécaniques.
- `scripts/reportCoverage.ts` — tableau de bord de couverture.

**Modifiés :**

- `src/types/cards.ts` — devient des ré-exports `z.infer` + type guards + types de deck conservés.
- `scripts/compileEffects.ts` — pose `coverage` + dérive `mechanics`.
- `src/services/cardLoader.ts:6` — bump `CACHE_KEY` v17 → v18.
- `package.json` — dépendance `zod` + script `report-coverage`.
- `public/data/*.json` — régénérés (ajout de `coverage`/`mechanics`).

---

## Task 1: Ajouter la dépendance Zod

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Installer zod en dépendance de prod**

Run: `npm install zod`
Expected: `zod` apparaît dans `dependencies` de `package.json`.

- [ ] **Step 2: Vérifier la résolution du type**

Run: `node -e "require('zod'); console.log('zod ok')"`
Expected: `zod ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(deps): ajoute zod (source de vérité du schéma de cartes)"
```

---

## Task 2: Schémas primitifs

**Files:**

- Create: `src/schema/primitives.ts`

- [ ] **Step 1: Écrire `src/schema/primitives.ts`**

```ts
import { z } from "zod";

export const cardRaritySchema = z.enum([
  "Commune",
  "Peu Commune",
  "Rare",
  "Mythique",
  "Légendaire",
  "Krosmaster",
]);

export const cardElementSchema = z.enum([
  "Air",
  "Eau",
  "Feu",
  "Terre",
  "Neutre",
]);

export const cardMainTypeSchema = z.enum([
  "Allié",
  "Action",
  "Équipement",
  "Zone",
  "Salle",
  "Dofus",
  "Héros",
  "Protecteur",
  "Havre-Sac",
  "Allié Élémentaire",
]);

export const cardKeywordSchema = z.enum([
  "Inclinaison",
  "Riposte",
  "Portée",
  "Critique",
  "Parade",
  "Résistance",
  "Recette",
  "Géant",
  "Unique",
]);

export const elementalCostSchema = z.object({
  element: cardElementSchema,
  count: z.number(),
});

export const elementalStatSchema = z.object({
  value: z.number(),
  element: cardElementSchema,
});

export const baseStatsSchema = z.object({
  niveau: elementalStatSchema.optional(),
  force: elementalStatSchema.optional(),
  pa: z.number().optional(),
  pm: z.number().optional(),
  pv: z.number().optional(),
  cost: z.number().optional(),
  taille: z.number().optional(),
  resistance: z.number().optional(),
});

export const professionSchema = z.object({
  name: z.string(),
  level: z.number(),
  specialization: z.string().optional(),
});

// `name` : z.string() (les noms scrapés ne correspondent pas toujours aux clés
// EXTENSION_LEVELS) ; `id` : optionnel (absent des données).
export const extensionInfoSchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  number: z.string().optional(),
  shortUrl: z.string().optional(),
});

export const requirementsSchema = z.object({
  level: z.number().optional(),
  professions: z.array(z.string()).optional(),
  elements: z.array(cardElementSchema).optional(),
});
```

- [ ] **Step 2: Vérifier le type-check**

Run: `npm run type-check`
Expected: PASS (aucune erreur introduite).

- [ ] **Step 3: Commit**

```bash
git add src/schema/primitives.ts
git commit -m "feat(schema): schémas Zod primitifs (enums, stats, extension)"
```

---

## Task 3: Schéma des mécaniques

**Files:**

- Create: `src/schema/mechanics.ts`

- [ ] **Step 1: Écrire `src/schema/mechanics.ts`**

```ts
import { z } from "zod";

export const mechanicTagSchema = z.enum([
  "gain-xp",
  "draw",
  "hero-gain-pv",
  "hero-lose-pv",
  "damage-opp-hero",
  "bag-gain-resistance",
  "destroy-target",
  "damage-target",
  "heal-hero-target",
  "buff-force-target",
  "buff-force-self",
  "recycle-from-discard",
  "discard-from-hand",
  "search-deck",
  "shuffle-deck",
  "destroy-self",
  "lose-stat-turn",
  "tap-self",
  "combat-mod-self",
  "buff-force-allies-monde",
  "global-damage-shield",
]);

export const mechanicCategorySchema = z.enum([
  "ressource",
  "dégâts",
  "soin",
  "contrôle",
  "tempo",
  "autre",
]);

export const mechanicRelationSchema = z.object({
  tag: mechanicTagSchema,
  kind: z.enum(["feeds", "counters", "synergizes"]),
  note: z.string().optional(),
});

export const mechanicSchema = z.object({
  id: mechanicTagSchema,
  label: z.string(),
  glossary: z.string(),
  category: mechanicCategorySchema,
  relatesTo: z.array(mechanicRelationSchema).optional(),
});
```

- [ ] **Step 2: Vérifier le type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/schema/mechanics.ts
git commit -m "feat(schema): schéma Zod des mécaniques (tags + relations)"
```

---

## Task 4: Schéma des effets

**Files:**

- Create: `src/schema/effects.ts`

- [ ] **Step 1: Écrire `src/schema/effects.ts`**

```ts
import { z } from "zod";
import { cardElementSchema, cardKeywordSchema } from "./primitives";
import { mechanicTagSchema } from "./mechanics";

const zonesSchema = z.array(z.enum(["monde", "havreSac"]));

export const compiledEffectOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("gainXp"), n: z.number() }),
  z.object({ op: z.literal("draw"), n: z.number() }),
  z.object({ op: z.literal("heroGainPv"), n: z.number() }),
  z.object({ op: z.literal("heroLosePv"), n: z.number() }),
  z.object({ op: z.literal("damageOppHero"), n: z.number() }),
  z.object({ op: z.literal("havreSacGainResistance"), n: z.number() }),
  z.object({
    op: z.literal("destroyTarget"),
    what: z.enum(["Allié", "Zone", "Équipement"]),
    zones: zonesSchema,
  }),
  z.object({
    op: z.literal("damageTarget"),
    n: z.number(),
    element: z.string(),
    heroes: z.boolean(),
    zones: zonesSchema,
  }),
  z.object({ op: z.literal("healHeroTarget"), n: z.number() }),
  z.object({
    op: z.literal("buffForceTarget"),
    n: z.number(),
    heroes: z.boolean(),
    sub: z.string().optional(),
    zones: zonesSchema,
  }),
  z.object({ op: z.literal("buffForceSelf"), n: z.number() }),
  z.object({
    op: z.literal("recycleFromDiscard"),
    n: z.number(),
    element: z.string().optional(),
  }),
  z.object({ op: z.literal("discardFromHand"), n: z.number() }),
  z.object({
    op: z.literal("searchDeck"),
    what: z.enum(["Dofus", "Action", "Équipement", "Zone", "Salle", "Allié"]),
    sub: z.string().optional(),
    maxLevel: z.number().optional(),
    tapped: z.boolean().optional(),
    dest: z.enum(["main", "monde"]),
  }),
  z.object({ op: z.literal("shuffleDeck") }),
  z.object({ op: z.literal("destroySelf") }),
  z.object({
    op: z.literal("loseStatTurn"),
    stat: z.enum(["pa", "pm"]),
    n: z.number(),
  }),
  z.object({ op: z.literal("tapSelf") }),
  z.object({
    op: z.literal("combatModSelf"),
    force: z.number().optional(),
    pm: z.number().optional(),
    geant: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("buffForceAlliesMondeTurn"),
    n: z.union([z.number(), z.literal("heroLevel")]),
  }),
  z.object({ op: z.literal("globalDamageShield") }),
]);

export const staticAbilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("forceAura"), n: z.number(), sub: z.string() }),
  z.object({ kind: z.literal("forceWhileBlocking"), n: z.number() }),
  z.object({ kind: z.literal("forceEqualsHandSize") }),
  z.object({ kind: z.literal("cannotBlock") }),
  z.object({ kind: z.literal("combatDamageReduction"), n: z.number() }),
]);

export const compiledEffectSchema = z.object({
  trigger: z.enum([
    "onArrive",
    "onTap",
    "onPlay",
    "onTurnStart",
    "static",
    "onSelfAttacks",
    "onDamageToBearer",
  ]),
  optional: z.boolean().optional(),
  cost: z.literal("sacrificeSelf").optional(),
  orElse: z.literal("destroySelf").optional(),
  static: staticAbilitySchema.optional(),
  ops: z.array(compiledEffectOpSchema),
});

export const effectCoverageSchema = z.enum([
  "auto",
  "manual",
  "uncovered",
  "ruling",
]);

export const cardEffectSchema = z.object({
  description: z.string(),
  elements: z.array(cardElementSchema).optional(),
  isOncePerTurn: z.boolean().optional(),
  requiresIncline: z.boolean().optional(),
  kind: z.enum(["ruling", "errata"]).optional(),
  compiled: compiledEffectSchema.optional(),
  // Optionnels dans le TYPE (factories/consommateurs ne cassent pas) ; leur
  // présence sur les données réelles est imposée par tests/data/coverage.spec.ts.
  coverage: effectCoverageSchema.optional(),
  mechanics: z.array(mechanicTagSchema).optional(),
  linkedTokens: z
    .array(
      z.object({
        name: z.string(),
        type: z.array(z.string()),
        force: z.number().optional(),
        elements: z.array(cardElementSchema).optional(),
      }),
    )
    .optional(),
});

export const cardKeywordInfoSchema = z.object({
  name: cardKeywordSchema,
  description: z.string(),
  elements: z.array(cardElementSchema).optional(),
});
```

- [ ] **Step 2: Vérifier le type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/schema/effects.ts
git commit -m "feat(schema): schéma Zod des effets (ops, statique, coverage, mechanics)"
```

---

## Task 5: Schéma des cartes (union discriminée)

**Files:**

- Create: `src/schema/cards.ts`
- Create: `src/schema/index.ts`

- [ ] **Step 1: Écrire `src/schema/cards.ts`**

```ts
import { z } from "zod";
import {
  baseStatsSchema,
  cardElementSchema,
  cardMainTypeSchema,
  cardRaritySchema,
  extensionInfoSchema,
  requirementsSchema,
} from "./primitives";
import { cardEffectSchema, cardKeywordInfoSchema } from "./effects";

// Champs partagés par toutes les cartes (mainType redéfini par chaque sous-type).
export const baseCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  mainType: cardMainTypeSchema,
  subTypes: z.array(z.string()),
  extension: extensionInfoSchema,
  rarity: cardRaritySchema,
  stats: baseStatsSchema.optional(),
  effects: z.array(cardEffectSchema).optional(),
  keywords: z.array(cardKeywordInfoSchema).optional(),
  experience: z.number().optional(),
  artists: z.array(z.string()),
  notes: z.array(z.string()).optional(),
  flavor: z
    .object({ text: z.string(), attribution: z.string().optional() })
    .optional(),
  imageUrl: z.string().optional(),
  url: z.string().optional(),
});

const heroFaceSchema = z.object({
  stats: baseStatsSchema,
  effects: z.array(cardEffectSchema),
  keywords: z.array(cardKeywordInfoSchema),
});

export const allyCardSchema = baseCardSchema.extend({
  mainType: z.literal("Allié"),
  stats: baseStatsSchema,
  race: z.string().optional(),
  tribe: z.string().optional(),
});

export const actionCardSchema = baseCardSchema.extend({
  mainType: z.literal("Action"),
  effects: z.array(cardEffectSchema),
  spellSchool: z.string().optional(),
});

export const equipmentCardSchema = baseCardSchema.extend({
  mainType: z.literal("Équipement"),
  equipmentType: z.enum([
    "Arme",
    "Armure",
    "Bijou",
    "Bouclier",
    "Dofus",
    "Familier",
    "Objet",
  ]),
  durability: z.number().optional(),
  requirements: requirementsSchema.optional(),
});

export const zoneCardSchema = baseCardSchema.extend({
  mainType: z.literal("Zone"),
  effects: z.array(cardEffectSchema),
  zoneType: z.string().optional(),
});

export const roomCardSchema = baseCardSchema.extend({
  mainType: z.literal("Salle"),
  effects: z.array(cardEffectSchema),
  roomType: z.string().optional(),
});

export const dofusCardSchema = baseCardSchema.extend({
  mainType: z.literal("Dofus"),
  effects: z.array(cardEffectSchema),
  requirements: requirementsSchema.optional(),
});

export const heroCardSchema = baseCardSchema.extend({
  mainType: z.literal("Héros"),
  class: z.string(),
  level: z.number().optional(),
  recto: heroFaceSchema,
  verso: heroFaceSchema.optional(),
});

export const protectorCardSchema = baseCardSchema.extend({
  mainType: z.literal("Protecteur"),
  stats: baseStatsSchema,
  effects: z.array(cardEffectSchema),
  guardianType: z.string().optional(),
});

export const havenBagCardSchema = baseCardSchema.extend({
  mainType: z.literal("Havre-Sac"),
  effects: z.array(cardEffectSchema),
  capacity: z.number().optional(),
});

export const elementalAllyCardSchema = baseCardSchema.extend({
  mainType: z.literal("Allié Élémentaire"),
  stats: baseStatsSchema,
  elements: z.array(cardElementSchema),
  elementalAffinity: z
    .object({
      primary: cardElementSchema,
      secondary: cardElementSchema.optional(),
    })
    .optional(),
});

export const cardSchema = z.discriminatedUnion("mainType", [
  allyCardSchema,
  actionCardSchema,
  equipmentCardSchema,
  zoneCardSchema,
  roomCardSchema,
  dofusCardSchema,
  heroCardSchema,
  protectorCardSchema,
  havenBagCardSchema,
  elementalAllyCardSchema,
]);
```

- [ ] **Step 2: Écrire le barrel `src/schema/index.ts`**

```ts
export * from "./primitives";
export * from "./mechanics";
export * from "./effects";
export * from "./cards";
```

- [ ] **Step 3: Vérifier le type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/schema/cards.ts src/schema/index.ts
git commit -m "feat(schema): schéma Zod des cartes (union discriminée mainType)"
```

---

## Task 6: Faire de `src/types/cards.ts` des ré-exports `z.infer`

**Files:**

- Modify: `src/types/cards.ts`

- [ ] **Step 1: Remplacer le contenu de `src/types/cards.ts`**

Remplacer TOUT le fichier par ce qui suit (les noms de types exportés sont
identiques à l'actuel ; les ~600 imports consommateurs ne changent pas) :

```ts
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
```

- [ ] **Step 2: Vérifier le type-check sur tout le projet**

Run: `npm run type-check`
Expected: PASS. Si une erreur apparaît, c'est un site consommateur s'appuyant
sur un champ corrigé. Diagnostics rapides :

- `grep -rn "protectorType" src/` → remplacer par `guardianType`.
- `grep -rn "\.equipmentType" src/` → la valeur doit être dans
  `Arme | Armure | Bijou | Bouclier | Dofus | Familier | Objet`.
- `grep -rn "extension\.id" src/` → `id` est maintenant `string | undefined`.

- [ ] **Step 3: Lancer la suite de tests existante (non-régression)**

Run: `npx vitest run`
Expected: tous les tests passent (la forme des données n'a pas encore changé ;
les types dérivés sont structurellement identiques).

- [ ] **Step 4: Commit**

```bash
git add src/types/cards.ts
git commit -m "refactor(types): cards.ts dérive ses types des schémas Zod (z.infer)"
```

---

## Task 7: Registre de mécaniques + table op→tag

**Files:**

- Create: `src/data/mechanics.ts`
- Create: `tests/data/mechanics.spec.ts`

- [ ] **Step 1: Écrire le test `tests/data/mechanics.spec.ts`**

```ts
import { describe, it, expect } from "vitest";
import { MECHANICS, OP_TO_MECHANIC, mechanicsForOps } from "@/data/mechanics";
import type { CompiledEffectOp, MechanicTag } from "@/types/cards";

// Les 21 ops du DSL (CompiledEffectOp). Toute nouvelle op DOIT être ajoutée ici
// ET dans OP_TO_MECHANIC (ce test échoue sinon).
const ALL_OPS: CompiledEffectOp["op"][] = [
  "gainXp",
  "draw",
  "heroGainPv",
  "heroLosePv",
  "damageOppHero",
  "havreSacGainResistance",
  "destroyTarget",
  "damageTarget",
  "healHeroTarget",
  "buffForceTarget",
  "buffForceSelf",
  "recycleFromDiscard",
  "discardFromHand",
  "searchDeck",
  "shuffleDeck",
  "destroySelf",
  "loseStatTurn",
  "tapSelf",
  "combatModSelf",
  "buffForceAlliesMondeTurn",
  "globalDamageShield",
];

describe("registre de mécaniques", () => {
  it("devrait mapper chaque op du DSL vers une mécanique", () => {
    for (const op of ALL_OPS) {
      expect(OP_TO_MECHANIC[op], `op ${op}`).toBeTruthy();
    }
  });

  it("devrait n'utiliser que des tags définis dans MECHANICS", () => {
    const known = new Set<MechanicTag>(MECHANICS.map((m) => m.id));
    for (const tag of Object.values(OP_TO_MECHANIC)) {
      expect(known.has(tag), `tag ${tag}`).toBe(true);
    }
  });

  it("devrait avoir des ids de mécanique uniques", () => {
    const ids = MECHANICS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("devrait dériver des tags uniques dans l'ordre d'apparition", () => {
    const tags = mechanicsForOps([
      { op: "draw" },
      { op: "draw" },
      { op: "gainXp" },
    ]);
    expect(tags).toEqual(["draw", "gain-xp"]);
  });

  it("devrait n'avoir de relatesTo que vers des tags connus", () => {
    const known = new Set<MechanicTag>(MECHANICS.map((m) => m.id));
    for (const m of MECHANICS) {
      for (const rel of m.relatesTo ?? []) {
        expect(known.has(rel.tag), `${m.id} -> ${rel.tag}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run tests/data/mechanics.spec.ts`
Expected: FAIL (module `@/data/mechanics` introuvable).

- [ ] **Step 3: Écrire `src/data/mechanics.ts`**

```ts
/**
 * REGISTRE DE MÉCANIQUES — vocabulaire contrôlé des effets (fondation, couche 1).
 * Une mécanique = un concept de jeu nommé, indépendant des cartes. Les tags des
 * effets sont dérivés automatiquement des ops compilées via OP_TO_MECHANIC
 * (cf. scripts/compileEffects.ts). Le graphe `relatesTo` complet et le tagging
 * des effets `uncovered` (sans ops) viendront dans des couches ultérieures.
 */
import type { CompiledEffectOp, Mechanic, MechanicTag } from "@/types/cards";

export const MECHANICS: Mechanic[] = [
  {
    id: "gain-xp",
    label: "Gain d'XP",
    category: "ressource",
    glossary: "Donne de l'expérience au Héros (progression de Niveau).",
  },
  {
    id: "draw",
    label: "Pioche",
    category: "ressource",
    glossary: "Pioche une ou plusieurs cartes.",
  },
  {
    id: "hero-gain-pv",
    label: "Héros regagne des PV",
    category: "soin",
    glossary: "Votre Héros regagne des points de vie.",
  },
  {
    id: "hero-lose-pv",
    label: "Héros perd des PV",
    category: "dégâts",
    glossary: "Votre Héros perd des points de vie (coût d'effet).",
  },
  {
    id: "damage-opp-hero",
    label: "Dégâts au Héros adverse",
    category: "dégâts",
    glossary: "Inflige des Dommages directs au Héros adverse.",
  },
  {
    id: "bag-gain-resistance",
    label: "Havre-Sac gagne en Résistance",
    category: "contrôle",
    glossary: "Augmente la Résistance du Havre-Sac.",
  },
  {
    id: "destroy-target",
    label: "Destruction ciblée",
    category: "contrôle",
    glossary: "Détruit une carte ciblée (Allié, Zone ou Équipement).",
  },
  {
    id: "damage-target",
    label: "Dégâts ciblés",
    category: "dégâts",
    glossary: "Inflige des Dommages à un Allié ou Héros ciblé.",
  },
  {
    id: "heal-hero-target",
    label: "Soin de Héros ciblé",
    category: "soin",
    glossary: "Un Héros ciblé regagne des points de vie.",
  },
  {
    id: "buff-force-target",
    label: "Bonus de Force ciblé",
    category: "tempo",
    glossary: "Donne un bonus de Force temporaire à une cible.",
  },
  {
    id: "buff-force-self",
    label: "Bonus de Force (soi)",
    category: "tempo",
    glossary: "La carte source gagne un bonus de Force temporaire.",
  },
  {
    id: "recycle-from-discard",
    label: "Recyclage de Défausse",
    category: "ressource",
    glossary: "Remet des cartes de la Défausse sous la Pioche.",
    relatesTo: [
      {
        tag: "discard-from-hand",
        kind: "feeds",
        note: "La défausse alimente le recyclage.",
      },
    ],
  },
  {
    id: "discard-from-hand",
    label: "Défausse de main",
    category: "ressource",
    glossary: "Défausse une ou plusieurs cartes de sa main.",
  },
  {
    id: "search-deck",
    label: "Recherche dans la Pioche",
    category: "ressource",
    glossary: "Cherche une carte filtrée dans la Pioche.",
  },
  {
    id: "shuffle-deck",
    label: "Mélange de Pioche",
    category: "autre",
    glossary: "Mélange la Pioche.",
  },
  {
    id: "destroy-self",
    label: "Auto-destruction",
    category: "contrôle",
    glossary: "Détruit la carte source de l'effet.",
  },
  {
    id: "lose-stat-turn",
    label: "Perte de PA/PM",
    category: "contrôle",
    glossary: "Réduit temporairement les PA ou PM jusqu'à la fin du tour.",
  },
  {
    id: "tap-self",
    label: "Inclinaison (soi)",
    category: "tempo",
    glossary: "Incline la carte source.",
  },
  {
    id: "combat-mod-self",
    label: "Modificateur de combat (soi)",
    category: "tempo",
    glossary: "Bonus de combat (Force/PM/Géant) jusqu'à la fin du combat.",
  },
  {
    id: "buff-force-allies-monde",
    label: "Bonus de Force d'équipe",
    category: "tempo",
    glossary:
      "Bonus de Force à tous vos Alliés du Monde jusqu'à la fin du tour.",
  },
  {
    id: "global-damage-shield",
    label: "Réduction globale des Dommages",
    category: "contrôle",
    glossary: "Réduit tous les Dommages à 0 temporairement.",
  },
];

/** op compilée → mécanique (déterministe, 1:1). */
export const OP_TO_MECHANIC: Record<CompiledEffectOp["op"], MechanicTag> = {
  gainXp: "gain-xp",
  draw: "draw",
  heroGainPv: "hero-gain-pv",
  heroLosePv: "hero-lose-pv",
  damageOppHero: "damage-opp-hero",
  havreSacGainResistance: "bag-gain-resistance",
  destroyTarget: "destroy-target",
  damageTarget: "damage-target",
  healHeroTarget: "heal-hero-target",
  buffForceTarget: "buff-force-target",
  buffForceSelf: "buff-force-self",
  recycleFromDiscard: "recycle-from-discard",
  discardFromHand: "discard-from-hand",
  searchDeck: "search-deck",
  shuffleDeck: "shuffle-deck",
  destroySelf: "destroy-self",
  loseStatTurn: "lose-stat-turn",
  tapSelf: "tap-self",
  combatModSelf: "combat-mod-self",
  buffForceAlliesMondeTurn: "buff-force-allies-monde",
  globalDamageShield: "global-damage-shield",
};

/** Tags uniques dérivés d'une liste d'ops, dans l'ordre d'apparition. */
export function mechanicsForOps(
  ops: { op: CompiledEffectOp["op"] }[],
): MechanicTag[] {
  return [...new Set(ops.map((o) => OP_TO_MECHANIC[o.op]))];
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npx vitest run tests/data/mechanics.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/mechanics.ts tests/data/mechanics.spec.ts
git commit -m "feat(mechanics): registre de mécaniques + table op→tag + dérivation"
```

---

## Task 8: Poser `coverage` + dériver `mechanics` dans le pipeline

**Files:**

- Modify: `scripts/compileEffects.ts`
- Modify: `src/services/cardLoader.ts:6`

- [ ] **Step 1: Étendre l'interface `RawEffect` dans `scripts/compileEffects.ts`**

Repérer la déclaration (vers la ligne 86) :

```ts
interface RawEffect {
  description?: string;
  compiled?: unknown;
  requiresIncline?: boolean;
  kind?: "ruling" | "errata";
}
```

La remplacer par :

```ts
interface RawEffect {
  description?: string;
  compiled?: unknown;
  requiresIncline?: boolean;
  kind?: "ruling" | "errata";
  coverage?: "auto" | "manual" | "uncovered" | "ruling";
  mechanics?: string[];
}
```

- [ ] **Step 2: Importer la table op→tag**

Sous l'import de `CARD_SCRIPTS` (vers la ligne 27), ajouter :

```ts
import { OP_TO_MECHANIC } from "../src/data/mechanics";
```

- [ ] **Step 3: Marquer les effets scriptés comme `manual`**

Dans la boucle d'overrides (branche `ops`), repérer :

```ts
if (!eff.compiled) stats.compiled++;
delete eff.kind;
eff.compiled = entry;
stats.scripted++;
```

et y ajouter le marquage `manual` :

```ts
if (!eff.compiled) stats.compiled++;
delete eff.kind;
eff.compiled = entry;
eff.coverage = "manual";
stats.scripted++;
```

- [ ] **Step 4: Ajouter la passe finale couverture + mécaniques**

Ajouter cette fonction juste avant la boucle `for (const file of EXTENSION_FILES)` :

```ts
/**
 * Passe finale : pose un statut de couverture EXPLICITE sur chaque effet et
 * dérive ses mécaniques depuis les ops compilées. `manual` est déjà posé par
 * la boucle d'overrides ; le reste est dérivé de l'état final (kind/compiled).
 */
function assignCoverageAndMechanics(card: RawCard): void {
  const visit = (effects: RawEffect[] | undefined) => {
    for (const e of effects ?? []) {
      if (e.coverage !== "manual") {
        e.coverage = e.kind ? "ruling" : e.compiled ? "auto" : "uncovered";
      }
      const ops = (e.compiled as { ops?: { op: string }[] } | undefined)?.ops;
      if (ops && ops.length) {
        e.mechanics = [
          ...new Set(
            ops.map((o) => OP_TO_MECHANIC[o.op as keyof typeof OP_TO_MECHANIC]),
          ),
        ];
      } else {
        delete e.mechanics;
      }
    }
  };
  visit(card.effects);
  visit(card.recto?.effects);
  visit(card.verso?.effects);
}
```

- [ ] **Step 5: Appeler la passe finale par carte**

Dans la boucle `for (const card of cards)`, juste APRÈS le bloc
`if (overrides) { ... }` et AVANT la fin de la boucle, ajouter :

```ts
assignCoverageAndMechanics(card);
```

- [ ] **Step 6: Bump du cache dans `src/services/cardLoader.ts`**

Repérer la ligne 6 :

```ts
const CACHE_KEY = "wakfu-cards-cache-v17"; // v17 : bus de declenchement + passe de Dommages + ops de combat (lot C)
```

la remplacer par :

```ts
const CACHE_KEY = "wakfu-cards-cache-v18"; // v18 : champ coverage + mechanics dérivées par effet
```

- [ ] **Step 7: Régénérer les données**

Run: `npm run compile-effects`
Expected: `✓ <fichier> (<n> cartes)` pour les 11 extensions, sans erreur.

- [ ] **Step 8: Vérifier qu'un effet compilé porte coverage + mechanics**

Run: `node -e "const c=require('./public/data/ile-des-wabbits.json'); const e=c.flatMap(x=>x.effects||[]).find(e=>e.compiled); console.log(JSON.stringify({coverage:e.coverage,mechanics:e.mechanics}))"`
Expected: un objet du type `{"coverage":"auto","mechanics":["..."]}`.

- [ ] **Step 9: Commit (script + données régénérées)**

```bash
git add scripts/compileEffects.ts src/services/cardLoader.ts public/data/*.json
git commit -m "feat(data): coverage explicite + mechanics dérivées par effet (régénéré)"
```

---

## Task 9: Test de validation du schéma sur les données réelles

**Files:**

- Create: `tests/data/cardSchema.spec.ts`

- [ ] **Step 1: Écrire `tests/data/cardSchema.spec.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cardSchema } from "@/schema";

const DATA_DIR = join(process.cwd(), "public", "data");
const EXTENSION_FILES = [
  "amakna.json",
  "ankama-convention-5.json",
  "astrub.json",
  "bonta-brakmar.json",
  "chaos-dogrest.json",
  "dofus-collection.json",
  "draft.json",
  "ile-des-wabbits.json",
  "incarnam.json",
  "otomai.json",
  "pandala.json",
];

describe("validation du schéma de cartes (public/data)", () => {
  for (const file of EXTENSION_FILES) {
    it(`devrait valider toutes les cartes de ${file}`, () => {
      const raw = readFileSync(join(DATA_DIR, file), "utf8");
      const cards = JSON.parse(raw) as unknown[];
      expect(Array.isArray(cards)).toBe(true);
      const failures: string[] = [];
      for (const card of cards) {
        const res = cardSchema.safeParse(card);
        if (!res.success) {
          const id = (card as { id?: string }).id ?? "?";
          failures.push(`${id}: ${res.error.issues[0]?.message ?? "invalide"}`);
        }
      }
      expect(failures, failures.slice(0, 5).join(" | ")).toHaveLength(0);
    });
  }
});
```

- [ ] **Step 2: Lancer le test**

Run: `npx vitest run tests/data/cardSchema.spec.ts`
Expected: PASS (les schémas ont été calés sur la forme réelle des données ;
findings d'audit déjà intégrés). En cas d'échec, le message liste les premiers
`id` fautifs et le champ en cause — ajuster le schéma concerné pour refléter la
donnée réelle (ou corriger le pipeline si la donnée est erronée).

- [ ] **Step 3: Commit**

```bash
git add tests/data/cardSchema.spec.ts
git commit -m "test(data): gate de validation Zod sur toutes les cartes public/data"
```

---

## Task 10: Test d'invariant de couverture (point fixe)

**Files:**

- Create: `tests/data/coverage.spec.ts`

- [ ] **Step 1: Écrire `tests/data/coverage.spec.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mechanicsForOps } from "@/data/mechanics";
import type { CompiledEffectOp } from "@/types/cards";

const DATA_DIR = join(process.cwd(), "public", "data");
const EXTENSION_FILES = [
  "amakna.json",
  "ankama-convention-5.json",
  "astrub.json",
  "bonta-brakmar.json",
  "chaos-dogrest.json",
  "dofus-collection.json",
  "draft.json",
  "ile-des-wabbits.json",
  "incarnam.json",
  "otomai.json",
  "pandala.json",
];

interface RawEffect {
  description?: string;
  coverage?: string;
  mechanics?: string[];
  compiled?: { ops?: { op: CompiledEffectOp["op"] }[] };
}
interface RawCard {
  id?: string;
  effects?: RawEffect[];
  recto?: { effects?: RawEffect[] };
  verso?: { effects?: RawEffect[] };
}

function allEffects(card: RawCard): RawEffect[] {
  return [
    ...(card.effects ?? []),
    ...(card.recto?.effects ?? []),
    ...(card.verso?.effects ?? []),
  ];
}

const COVERAGE = new Set(["auto", "manual", "uncovered", "ruling"]);

const cards: RawCard[] = EXTENSION_FILES.flatMap(
  (f) => JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as RawCard[],
);

describe("invariant de couverture des effets", () => {
  it("devrait poser un coverage valide sur chaque effet", () => {
    const bad: string[] = [];
    for (const card of cards) {
      for (const e of allEffects(card)) {
        if (!e.coverage || !COVERAGE.has(e.coverage)) {
          bad.push(`${card.id}: coverage=${e.coverage}`);
        }
      }
    }
    expect(bad, bad.slice(0, 5).join(" | ")).toHaveLength(0);
  });

  it("devrait dériver mechanics depuis les ops (point fixe, idempotent)", () => {
    const bad: string[] = [];
    for (const card of cards) {
      for (const e of allEffects(card)) {
        const ops = e.compiled?.ops;
        if (ops && ops.length) {
          const expected = mechanicsForOps(ops);
          if (JSON.stringify(e.mechanics) !== JSON.stringify(expected)) {
            bad.push(`${card.id}: ${JSON.stringify(e.mechanics)}`);
          }
        } else if (e.mechanics !== undefined) {
          bad.push(`${card.id}: mechanics inattendues`);
        }
      }
    }
    expect(bad, bad.slice(0, 5).join(" | ")).toHaveLength(0);
  });

  it("devrait classer auto/manual/uncovered de façon cohérente avec compiled", () => {
    for (const card of cards) {
      for (const e of allEffects(card)) {
        if (e.coverage === "auto" || e.coverage === "manual") {
          expect(e.compiled, `${card.id}`).toBeTruthy();
        }
        if (e.coverage === "uncovered") {
          expect(e.compiled, `${card.id}`).toBeFalsy();
        }
      }
    }
  });
});
```

- [ ] **Step 2: Lancer le test**

Run: `npx vitest run tests/data/coverage.spec.ts`
Expected: PASS. Le test « point fixe » vérifie que les données régénérées sont
le point fixe du pipeline (donc qu'une re-dérivation ne change rien =
idempotence des mécaniques).

- [ ] **Step 3: Commit**

```bash
git add tests/data/coverage.spec.ts
git commit -m "test(data): invariant coverage + point fixe des mechanics"
```

---

## Task 11: Script de rapport de couverture

**Files:**

- Create: `scripts/reportCoverage.ts`
- Modify: `package.json`

- [ ] **Step 1: Écrire `scripts/reportCoverage.ts`**

```ts
/**
 * Tableau de bord de couverture des effets — `npm run report-coverage`.
 * Lit public/data/*.json (régénéré par compile-effects) et résume la
 * répartition auto/manual/uncovered/ruling, plus le top des effets `uncovered`
 * pour orienter la prochaine tranche d'automatisation. Lecture seule.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(__dirname, "..", "public", "data");
const EXTENSION_FILES = [
  "amakna.json",
  "ankama-convention-5.json",
  "astrub.json",
  "bonta-brakmar.json",
  "chaos-dogrest.json",
  "dofus-collection.json",
  "draft.json",
  "ile-des-wabbits.json",
  "incarnam.json",
  "otomai.json",
  "pandala.json",
];

interface RawEffect {
  description?: string;
  coverage?: string;
}
interface RawCard {
  effects?: RawEffect[];
  recto?: { effects?: RawEffect[] };
  verso?: { effects?: RawEffect[] };
}

const tally: Record<string, number> = {
  auto: 0,
  manual: 0,
  uncovered: 0,
  ruling: 0,
  unknown: 0,
};
const uncovered: string[] = [];

for (const file of EXTENSION_FILES) {
  const cards = JSON.parse(
    readFileSync(join(DATA_DIR, file), "utf8"),
  ) as RawCard[];
  for (const card of cards) {
    const effects = [
      ...(card.effects ?? []),
      ...(card.recto?.effects ?? []),
      ...(card.verso?.effects ?? []),
    ];
    for (const e of effects) {
      const c = e.coverage ?? "unknown";
      tally[c] = (tally[c] ?? 0) + 1;
      if (c === "uncovered" && e.description) uncovered.push(e.description);
    }
  }
}

const printed = tally.auto + tally.manual + tally.uncovered;
const structured = tally.auto + tally.manual;
const pct = printed ? ((structured / printed) * 100).toFixed(1) : "0.0";

console.log("── Couverture des effets ──");
console.log(`  auto:      ${tally.auto}`);
console.log(`  manual:    ${tally.manual}`);
console.log(`  uncovered: ${tally.uncovered}`);
console.log(`  ruling:    ${tally.ruling}`);
if (tally.unknown) console.log(`  unknown:   ${tally.unknown} (à régénérer)`);
console.log(
  `  → ${structured}/${printed} effets imprimés structurés (${pct} %)`,
);
console.log("\n── Échantillon d'effets uncovered (10) ──");
for (const d of uncovered.slice(0, 10)) console.log(`  • ${d}`);
```

- [ ] **Step 2: Ajouter le script npm**

Dans `package.json`, sous `"compile-effects"`, ajouter l'entrée :

```json
    "report-coverage": "tsx scripts/reportCoverage.ts",
```

- [ ] **Step 3: Lancer le rapport**

Run: `npm run report-coverage`
Expected: un récapitulatif avec les compteurs et un `% structuré`, sans
`unknown` (sinon relancer `npm run compile-effects`).

- [ ] **Step 4: Commit**

```bash
git add scripts/reportCoverage.ts package.json
git commit -m "feat(tooling): rapport de couverture des effets (report-coverage)"
```

---

## Task 12: Vérification finale & garde CI

**Files:** aucune (vérification)

- [ ] **Step 1: type-check complet**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 2: Suite de tests complète**

Run: `npx vitest run`
Expected: tous les tests passent, dont `tests/data/cardSchema.spec.ts`,
`tests/data/mechanics.spec.ts`, `tests/data/coverage.spec.ts`.

- [ ] **Step 3: Idempotence du pipeline**

Run: `npm run compile-effects` puis `git diff --stat public/data`
Expected: aucun changement (`git diff` vide) — le pipeline est idempotent.

- [ ] **Step 4: Build de production**

Run: `npm run build`
Expected: build OK (~10s).

- [ ] **Step 5: Commit éventuel**

Si un ajustement a été nécessaire :

```bash
git add -A
git commit -m "chore: vérification finale fondation format de données"
```

---

## Notes d'exécution

- **Ordre impératif** : Task 6 (ré-export `z.infer`) doit précéder tout test
  important sur les schémas ; Task 8 (régénération `coverage`/`mechanics`) doit
  précéder Tasks 9-10 (tests sur données régénérées).
- **DRY** : la liste `EXTENSION_FILES` est répétée dans plusieurs fichiers
  (déjà le cas dans le repo) ; ne pas factoriser ici pour rester aligné sur le
  pattern existant de `scripts/compileEffects.ts`.
- **Hors périmètre** (couches ultérieures, ne PAS faire ici) : graphe
  `relatesTo` complet, tagging manuel des effets `uncovered`, extension de la
  couverture DSL, UI de recherche/synergies, pages doc générées.

```

```
