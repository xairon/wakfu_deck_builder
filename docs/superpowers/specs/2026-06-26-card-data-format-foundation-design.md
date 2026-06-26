# Format de données des cartes — Fondation robuste (design)

**Date** : 2026-06-26
**Statut** : design validé, prêt pour plan d'implémentation
**Approche retenue** : C — Hybride/couches

## Contexte & problème

L'application stocke ses cartes dans `public/data/*.json` (un tableau par
extension, ~1585 cartes). Les types canoniques vivent dans `src/types/cards.ts`
et ne servent qu'à la **compilation TypeScript** : les JSON sur disque ne sont
**jamais** confrontés à ces types. Un champ manquant, un enum invalide ou un
effet malformé passe inaperçu jusqu'à un crash runtime. C'est le trou de
robustesse n°1.

Les effets sont stockés en texte libre (`description`) + une forme machine
optionnelle (`effects[].compiled`) générée hors-ligne par
`scripts/compileEffects.ts` via un DSL strict (`src/game/rules/effects/dsl.ts`,
~25 ops + `StaticAbility`) et des overrides manuels « style XMage »
(`src/game/rules/effects/cardScripts.ts`). Quand le texte n'est pas compris,
`compiled` est **absent** — indistinguable d'un oubli, et invisible au reste de
l'app.

L'objectif global (à terme) est une pile à quatre couches :

1. **Schéma robuste** (fondation — CE spec)
2. Catalogue d'effets structuré (couche ultérieure)
3. Interactions entre effets (couche ultérieure)
4. Automatisation moteur maximale (couche ultérieure)

Les usages cibles à servir : moteur de jeu, recherche/filtres, synergies/combos,
doc/wiki. La donnée scrapée (wtcg-return.fr) est jugée **fiable, à nettoyer** —
on part de l'existant, pas de re-scrape. Les fichiers sont en UTF-8 valide
(pas de dette d'encodage).

**Ce spec ne couvre que la fondation (couche 1).** Les couches 2-4 réutiliseront
les crochets posés ici et feront l'objet de specs séparés.

## Approche retenue : C — Hybride/couches

On garde les cartes dans les JSON par extension (bons diffs git, pipeline
existant, compat collection/partage/cache). On ajoute :

1. Un **schéma Zod = source de vérité unique** (types ET validation).
2. Un **gate de validation** appliqué à l'écriture (pipeline) et en CI.
3. Un **statut de couverture explicite** par effet (au lieu d'un `compiled?`
   silencieux).
4. Un **registre de mécaniques léger** + dérivation automatique des tags depuis
   les ops compilées.

Approches écartées :

- **A — Évolutive** : enrichir en place sans Zod ; relations restent implicites,
  pas de source de vérité unique types/validation.
- **B — Normalisée** : source canonique séparée + interactions first-class +
  JSON par extension dérivés. Plus puissant mais migration big-bang et
  sur-ingénierie au regard du besoin actuel (YAGNI).

## Architecture & flux de données

```
                ┌─────────────────────────────┐
                │  src/schema/  (Zod)         │  ← SOURCE DE VÉRITÉ unique
                │  cardSchema, effectSchema,  │     (types ET validation)
                │  mechanicsSchema            │
                └───────────┬─────────────────┘
              z.infer ↓                  ↓ .parse()
        src/types/cards.ts        validation runtime/CI
        (types dérivés,            ┌──────────────────────┐
         imports inchangés)        │ compile-effects (gate)│
                                   │ + test CI "tout parse"│
                                   └──────────┬────────────┘
                                              ↓ écrit
                              public/data/*.json (inchangés en forme)
                                              ↓ lus par
                              cardLoader → stores → moteur/UI

        src/data/mechanics.ts  ← registre contrôlé de mécaniques (glossaire,
                                  tags, relatesTo) — rempli incrémentalement
```

**Idée maîtresse** : `src/types/cards.ts` n'est plus écrit à la main — il
devient `z.infer<>` des schémas Zod. Une seule définition donne à la fois les
types statiques (tous les imports `import type { Card } from "@/types/cards"`
restent identiques) **et** la validation runtime. Impossible que types et
validation divergent.

La **forme JSON sur disque ne change pas** (compat collection, partage base64,
cache localStorage) — on ajoute seulement des champs optionnels et un gardien
qui refuse les données non conformes.

## Composant 1 — Zod, source de vérité

- Nouveau dossier `src/schema/` contenant les schémas Zod (cartes par type,
  effets, ops compilées, mécaniques). Découpé par responsabilité (un fichier par
  famille de schéma), pas un monolithe.
- `src/types/cards.ts` réexporte les types via `z.infer` :
  `export type Card = z.infer<typeof cardSchema>` etc. Les noms de types
  exportés restent identiques → aucun import consommateur ne change.
- Les type guards existants (`isAllyCard`, etc.) restent, sur les types dérivés.
- **Gate** : `npm run type-check` (vue-tsc) doit rester vert — c'est le seul
  gardien de types, branché en CI (job « Lint & Types »). `tsconfig` reste
  ESNext/Bundler.

Dépendance : ajouter `zod` aux dépendances de prod (la validation tourne aussi
côté script de build ; léger, tree-shakeable).

## Composant 2 — Gate de validation

- Test CI `tests/data/schema.test.ts` : charge les 11 `public/data/*.json` et
  `cardSchema.parse()` chaque carte. Révèle d'un coup toute non-conformité
  actuelle. C'est le vrai test de robustesse.
- `scripts/compileEffects.ts` devient le point où la validation est appliquée à
  **l'écriture** : il refuse d'émettre un fichier non conforme. Il reste
  idempotent.

## Composant 3 — Statut de couverture des effets

On change la posture : `compiled` devient la cible exigée, avec un statut
explicite remplaçant le `compiled?`/`kind` silencieux.

```ts
interface CardEffect {
  description: string; // texte imprimé (inchangé)
  elements?: CardElement[];
  // … champs existants conservés …
  compiled?: CompiledEffect; // forme machine (DSL auto OU override manuel)

  // NOUVEAU
  coverage: "auto" | "manual" | "uncovered" | "ruling";
  mechanics?: MechanicTag[]; // tags rattachés (voir Composant 4)
}
```

- `auto` : compilé par le DSL.
- `manual` : compilé via `cardScripts.ts`.
- `uncovered` : effet imprimé que ni le DSL ni un script ne couvrent → manuel à
  la table, mais **visible et comptabilisé**.
- `ruling` : note de règle/errata du site (exclue du comptage). Remplace le
  champ `kind` actuel.

**Gain** : un rapport de couverture mesurable (% structuré, restes par
extension / par op manquante) = feuille de route d'automatisation.

**Pas de réécriture du moteur** : `CompiledEffectOp`, le DSL, `cardScripts`,
`StaticAbility` restent inchangés. Le moteur consomme `compiled` comme avant.
On ajoute seulement la traçabilité autour.

## Composant 4 — Registre de mécaniques & interactions

Nouveau `src/data/mechanics.ts` : registre contrôlé (liste `as const`, pas
d'enum, conforme aux conventions) de mécaniques atomiques.

```ts
interface Mechanic {
  id: MechanicTag; // ex: "draw", "damage-hero", "search-deck"
  label: string; // « Pioche », « Dégâts au Héros »
  glossary: string; // définition lisible (doc/wiki)
  category: "ressource" | "dégâts" | "soin" | "contrôle" | "tempo" | "autre";
  relatesTo?: {
    tag: MechanicTag;
    kind: "feeds" | "counters" | "synergizes";
    note?: string;
  }[];
}
```

**Rattachement sans double saisie** : chaque `CompiledEffectOp` a une signature
connue (`op: "draw"` → `draw`, `op: "damageOppHero"` → `damage-hero`…). Une
table `op → MechanicTag` permet au pipeline de **dériver automatiquement**
`effects[].mechanics` depuis les ops. Les effets `uncovered` (sans ops) peuvent
être taggés à la main dans `cardScripts` (un effet manuel reste cherchable).

Débloque :

- **Recherche/filtres** : filtre sur `effects[].mechanics` (gratuit une fois
  dérivé).
- **Synergies/combos** : `relatesTo` (« `gain-xp` _feeds_ `level-up` ») croisé
  avec les mécaniques présentes dans un deck. Première version simple,
  extensible.
- **Doc/wiki** : `glossary` + `relatesTo` → page de mécanique générée.

**Périmètre de CE spec** : poser la structure (`Mechanic`, `MechanicTag`, table
`op→tag`, dérivation auto) et peupler les ~25 mécaniques correspondant aux ops
existantes. Le graphe `relatesTo` complet et le tagging exhaustif des
`uncovered` sont des couches ultérieures — la fondation expose les crochets.

## Migration & rollout (incrémental, réversible)

1. **Zod source de vérité** : `src/types/cards.ts` → `src/schema/*.ts` + réexport
   `z.infer`. `npm run type-check` reste vert.
2. **Validation des données** : `tests/data/schema.test.ts` parse les 11 JSON.
   Corriger le pipeline pour produire du 100 % conforme.
3. **Champ `coverage`** : `compileEffects` le pose (migration du `kind` actuel).
   Idempotent.
4. **Registre de mécaniques + dérivation** : `src/data/mechanics.ts` + table
   `op→tag` ; `compileEffects` dérive `effects[].mechanics`. Script
   `report-coverage` pour le tableau de bord.
5. **Bump `CACHE_KEY`** dans `cardLoader.ts` (forme des données enrichie →
   invalider le cache localStorage).

## Tests

Vitest, conventions `it('devrait …')` :

- `schema.test.ts` : toutes les cartes réelles parsent (robustesse).
- Dérivation `op → MechanicTag` : chaque op connue → bonne mécanique.
- Idempotence de `compileEffects` (relancer = no-op).
- Invariant couverture : aucun effet imprimé sans `coverage`.

## Non-régression

La **forme stockée** d'une carte ne change pas (mêmes champs + ajouts
optionnels) : collection, partage base64, decks officiels, decks Dofus Mag et
cache restent compatibles. Aucun impact attendu sur le moteur (il consomme
`compiled` à l'identique).

## Hors périmètre (couches ultérieures)

- Graphe `relatesTo` complet (interactions exhaustives entre mécaniques).
- Tagging manuel exhaustif des effets `uncovered`.
- Extension de la couverture DSL vers de nouvelles ops (automatisation moteur).
- UI de recherche/filtres par mécanique et détecteur de synergies de deck.
- Pages doc/wiki générées depuis le glossaire.

```

```
