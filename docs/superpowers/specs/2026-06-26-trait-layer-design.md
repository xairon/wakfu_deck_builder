# Couche traits — métier & restriction (design)

**Date** : 2026-06-26
**Statut** : design validé (délégation « fais au mieux / enchaîne »), prêt pour plan
**Dépend de** : [[keyword-layer]], [[card-data-format-foundation]]

## Contexte & problème

Après la couche mots-clés, `uncovered` = 1718. L'analyse montre qu'il reste
exactement **60 tokens qui ne sont pas des effets** — des **traits** déversés
dans `effects[]` par le scrape :

- **« Héros : X » (35)** : restriction de jeu (classe ou alignement). `X` est
  une classe (Iop, Sadida, Sacrieur…) ou un alignement (Bonta, Brâkmar).
  **Toujours redondant avec `subTypes`** (vérifié : chaque carte porte déjà `X`
  dans `subTypes`).
- **Métier (25)** : Bricoleur (9), Forgeron (8), Bijoutier (4), Armurier (4).
  Trait Artisan (glossaire « Métier »). **Non structuré ailleurs** ;
  uniquement sur des Alliés.

Après cette tranche, plus aucun token non-effet ne reste : `uncovered` ne
contiendra que de **vrais effets en phrase**, rendant la métrique de couverture
honnête (c'est le but principal — la valeur d'automatisation viendra des couches
suivantes).

## Périmètre

**Dans la tranche** (données seules) : reconnaître les 60 tokens, extraire le
métier en champ typé, reclasser les 60 effets `coverage:"trait"`.

**Hors périmètre (différé)** : modélisation explicite des restrictions de jeu
(« nécessite un Héros de classe/alignement X ») — info déjà dans `subTypes`,
sa consommation est du ressort du moteur/deck-building. Wiring moteur du métier
(Recette/Fabrication). Traits déjà couverts ailleurs (classe, alignement, tribe).

## Approche

Même mécanique que `promoteKeywords` : une passe `promoteTraits(card)` dans
`scripts/compileEffects.ts`, exécutée **après** `classifyKinds` (qui efface
`coverage`) et **préservée** par la passe finale. L'entrée d'effet **reste**
(indices stables → `CARD_SCRIPTS`).

## Composant 1 — Schéma & types (source de vérité Zod)

- `src/schema/cards.ts` → `baseCardSchema` : ajouter
  `metier: z.enum(["Bricoleur", "Forgeron", "Bijoutier", "Armurier"]).optional()`.
  (Sur `baseCardSchema` pour simplicité ; les données ne le posent que sur des
  Alliés. Nom distinct du `professionSchema` existant — concept différent.)
- `src/schema/effects.ts` → `effectCoverageSchema` : ajouter `"trait"`
  (`auto | manual | uncovered | ruling | keyword | trait`).

Types via `z.infer`. Le gate strict accepte `metier` car ajouté à la forme de
base avant `.strict()`.

## Composant 2 — Reconnaissance & reclassement (pipeline)

Passe `promoteTraits(card)` :

- **Métier** : si une description d'effet **est** exactement un des 4 métiers
  (`Bricoleur|Forgeron|Bijoutier|Armurier`), poser `card.metier = <valeur>` (si
  pas déjà défini → idempotent) et `e.coverage = "trait"`.
- **« Héros : X »** : si la description normalisée matche `^héros\s*:\s*.+$`,
  poser `e.coverage = "trait"` (aucun champ — `X` déjà dans `subTypes`).
- Ignorer les effets `kind` (ruling/errata) et les descriptions vides.

**Ordre & idempotence** : appel après `promoteKeywords` (donc après
`classifyKinds`). Le garde de `assignCoverageAndMechanics` devient
`if (e.coverage !== "manual" && e.coverage !== "keyword" && e.coverage !== "trait")`.
Dédup du métier (set-if-absent) → re-run = no-op (vérifié par le test point-fixe).

## Composant 3 — Tests & rapport

- **Nouveau** `tests/data/traits.spec.ts` : (a) tout token métier exact → la
  carte a `metier` égal à la valeur ET l'effet `coverage:"trait"` ; (b) tout
  token « Héros : X » → effet `coverage:"trait"` ; (c) aucune fausse promotion
  (un effet en phrase contenant « forgeron »/« héros » n'est pas reclassé) ;
  (d) `metier` ∈ aux 4 valeurs.
- `tests/data/coverage.spec.ts` : ajouter `"trait"` à l'ensemble `COVERAGE`.
- `tests/data/cardSchema.spec.ts` : passe toujours (gate strict accepte `metier`).
- `scripts/reportCoverage.ts` : bucket `trait` au tableau de bord (exclu du
  `% structuré` comme `keyword`/`ruling`).

## Résultat attendu

`uncovered` ~1718 → ~1658 ; nouveau bucket `trait` ~60 ; le métier de ~25 Alliés
désormais répertorié en données typées ; plus aucun token non-effet dans
`uncovered`.

## Hors périmètre (tranches ultérieures)

- Restrictions de jeu explicites (classe/alignement requis) + leur validation.
- Wiring moteur du métier (Recette/Fabrication, familiers).
- Couche effets longue traîne + modèle Équipement/Porteur (lot F).
