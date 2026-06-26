# Couche mots-clés — automatisation moteur, tranche 1 (design)

**Date** : 2026-06-26
**Statut** : design validé (délégation utilisateur « fais au mieux »), prêt pour plan
**Dépend de** : [[card-data-format-foundation]] (Zod source de vérité, `coverage`, registre de mécaniques)

## Contexte & problème

Après la fondation du format de données, 1974 effets sont `uncovered`. L'analyse
montre que **~316 d'entre eux ne sont pas des effets** : ce sont des mots-clés et
traits déversés dans `effects[]` par le scrape. Détail :

- **~270 tokens mots-clés** : Géant (déjà promu), Agilité, Agressivité, Tacle,
  Renfort, Défense, Fantôme, Capture (« Capture : N »), Éthérée (« Éthérée N »).
- ~24 tokens **métier** (Bricoleur, Forgeron, Bijoutier, Armurier).
- ~34 tokens **« Héros : X »** (mélange restriction de classe ET alignement).

Le vocabulaire de mots-clés actuel (`Inclinaison, Riposte, Portée, Critique,
Parade, Résistance, Recette, Géant, Unique`) ignore les 8 mots-clés ci-dessus,
qui sont pourtant de **vrais mots-clés définis au glossaire officiel**
(`src/data/glossary.ts`). Ils restent donc en `uncovered`, ce qui gonfle la
métrique et masque la vraie matière à automatiser (les effets en phrase).

## Périmètre

**Dans cette tranche** : les **8 mots-clés** (les ~270 tokens propres,
glossaire-définis). Données seules — **pas de wiring moteur** (le jeu n'applique
pas encore Agilité/Tacle ; ce sera une tranche ultérieure).

**Hors périmètre (suivi séparé)** : les traits métier / restriction de classe /
alignement (~58 tokens). Sémantique mêlée (Bonta/Brâkmar déjà dans `subTypes`
32/33 ; « Héros : Sadida » = restriction, pas alignement ; métier non structuré
ailleurs) → plus basse confiance, mérite son propre cadrage.

## Approche retenue : A — promouvoir + reclasser

Pour chaque token mot-clé reconnu dans `effects[]` :

1. l'ajouter à `card.keywords[]` sous forme structurée (nom + valeur éventuelle +
   définition glossaire), avec dédup par nom (idempotent) ;
2. marquer l'effet source `coverage: "keyword"` (l'entrée d'effet **reste** :
   indices stables → ne casse pas `CARD_SCRIPTS`, qui clé par index d'effet).

C'est exactement le pattern existant de `promoteTextKeywords` (Géant), généralisé.

Approches écartées :

- **B** — supprimer l'entrée d'effet : décale les indices → casse `CARD_SCRIPTS`.
- **C** — reclasser sans structurer : perd valeur/glossaire, ne sert pas le but
  « répertorier les effets/mots-clés ».

## Composant 1 — Schéma & types (source de vérité Zod)

- `src/schema/primitives.ts` → `cardKeywordSchema` : ajouter `Agilité`,
  `Agressivité`, `Tacle`, `Renfort`, `Défense`, `Fantôme`, `Capture`, `Éthérée`.
- `src/schema/effects.ts` → `cardKeywordInfoSchema` : ajouter
  `value: z.number().optional()` (Capture/Éthérée portent un nombre — champ typé
  propre plutôt que de le mettre dans `description`).
- `src/schema/effects.ts` → `effectCoverageSchema` : ajouter `"keyword"`
  (`auto | manual | uncovered | ruling | keyword`).

Types dérivés via `z.infer` — aucun import consommateur cassé.

## Composant 2 — Reconnaissance & reclassement (pipeline)

Nouvelle passe `promoteKeywords(card)` dans `scripts/compileEffects.ts`,
remplaçant `promoteTextKeywords` :

- **Table de reconnaissance** `KEYWORD_TOKENS` : token normalisé →
  `{ name: CardKeyword; glossaryTerm?: string; valued?: boolean }`. Entrées :
  Géant, Agilité, Agressivité, Tacle, Renfort, Défense, Fantôme (non valués) ;
  Capture, Éthérée (valués).
- **Match strict sur la description ENTIÈRE** : promotion seulement si la
  description normalisée **est** le token — mot seul, ou `Mot : N` / `Mot N`
  pour les valués. Jamais un mot-clé noyé dans une phrase.
- **Promotion** : si `card.keywords[]` n'a pas déjà ce nom, y pousser
  `{ name, value?, description }` ; poser `e.coverage = "keyword"`.

**Ordre & idempotence** : `classifyKinds` efface déjà `coverage`/`mechanics` en
tête de run. `promoteKeywords` tourne ensuite et pose `"keyword"`. La passe
finale `assignCoverageAndMechanics` doit **préserver** `keyword` au même titre
que `manual` : garde élargi à
`if (e.coverage !== "manual" && e.coverage !== "keyword")`. La dédup par nom rend
la promotion idempotente (re-run = no-op, vérifié par le test point-fixe).

## Composant 3 — Lien glossaire

Index `term → definition` construit depuis `GLOSSARY` (`src/data/glossary.ts`,
« Ne pas éditer à la main ») au début du script. La `description` du mot-clé
promu = sa définition officielle.

- Les 7 mots-clés présents au glossaire (Géant, Agilité, Agressivité, Tacle,
  Renfort, Défense, Fantôme, Capture) reçoivent leur texte de règle exact.
  Conséquence attendue : la description de Géant passe de l'actuel
  « Répartit sa Force… (6135) » au texte glossaire (diff de données normal ;
  `combatKeywords()` lit Géant par `name`, pas par description → pas de
  régression).
- **Éthérée** n'est pas au glossaire → promu **sans** description
  (`description: ""`), commentaire dans la table notant que la règle reste à
  récupérer (on n'invente pas). Sort quand même de `uncovered`, porte sa `value`.

## Composant 4 — Tests & outillage

- **Nouveau** `tests/data/keywords.spec.ts` : sur les données régénérées,
  (a) tout token mot-clé connu apparaît dans `keywords[]` de sa carte avec le bon
  `name` (+ `value` pour Capture/Éthérée) ; (b) l'effet source a
  `coverage === "keyword"` ; (c) aucune fausse promotion (un effet en phrase
  contenant « tacle » n'est pas promu) — cas négatif.
- `tests/data/coverage.spec.ts` : étendre l'ensemble `COVERAGE` valide avec
  `"keyword"` ; les effets `keyword` n'ont pas de `mechanics`.
- `tests/data/cardSchema.spec.ts` : passe toujours (nouveaux noms + `value`
  valides ; gate strict inchangé).
- `scripts/reportCoverage.ts` : ajouter le bucket `keyword` au tableau de bord ;
  le `% structuré` reste calculé sur les effets imprimés (auto+manual sur
  auto+manual+uncovered ; `keyword` et `ruling` exclus comme non-effets).

## Résultat attendu

`uncovered` baisse d'environ 270 (≈1704 restants) ; nouveau bucket `keyword`
≈270 ; ~8 mots-clés de combat désormais répertoriés en données structurées,
prêts pour un futur wiring moteur. Pipeline idempotent, gate vert.

## Hors périmètre (tranches ultérieures)

- Wiring moteur de la sémantique des mots-clés (blocage Agilité, inclinaison
  Tacle, timing Agressivité/Renfort/Défense, récursion Fantôme).
- Traits métier / restriction de classe / alignement.
- Définition de règle d'Éthérée (à récupérer à la source).
