# Dofus Mag — Extraction OCR des decks & intégration dans l'appli

**Date:** 2026-06-24
**Statut:** Design validé (en attente de relecture utilisateur)
**Branche:** `feat/dofus-mag-decks`

## Contexte

L'utilisateur a extrait **73 photos** (`dofus_mag_decks/`) de pages du magazine
**Dofus Mag** présentant des « idées de deck » WAKFU TCG. Objectif : en extraire
**tous les decks** avec **toutes les infos visibles** (liste de cartes, lore,
manière de les jouer, méta) et les intégrer **proprement** dans l'application,
sur la page existante `/decks/official`.

### Réalités du matériel source

- Photos prises au téléphone, **pivotées ~180°** (texte à l'envers).
- **Overlap** : une même photo montre souvent le bas d'un deck et le haut du
  suivant ; un même deck apparaît sur plusieurs photos. → étape de
  **réconciliation / dédoublonnage** nécessaire.
- **Structure riche et variable** par page : nom du deck, paragraphe de lore,
  Héros, Havre-Sac, parfois Alignement, listes de cartes par catégorie
  (Alliés / Sorts / Actions / Équipements / Zones / Protecteur…) avec quantités,
  bloc « Le conseil d'Adamaï » (comment jouer) **ou** « Cartes maîtresses », et
  parfois un crédit d'illustrateur + n° de mag.

### Faisabilité (vérifiée)

- L'extraction **vision (par Claude)** lit ces pages proprement malgré la
  rotation et les noms propres français (2 pages déjà transcrites avec succès) —
  bien supérieure à un OCR programmatique (Tesseract) sur ce type de photos.
- Les cartes citées **existent dans la base** : « Klore Ofil », « Karey Dass »,
  « Tomla Klass », « Smare »… toutes présentes dans `public/data/incarnam.json`.
  → le matching via `deckStore.findCardByName` (même résolveur que l'import des
  starters) est réaliste, avec fuzzy-matching pour les erreurs d'OCR et un
  rapport pour les non-résolus.

## Décisions (validées avec l'utilisateur)

1. **Surfacing** : étendre la page existante `/decks/official` avec un nouveau
   groupe d'extension `"dofus-mag"`. Réutilise le flux d'import/réimport et la
   résolution de cartes.
2. **Contenu** : capturer **tout ce qui est visible** dans un schéma flexible à
   champs optionnels.
3. **Exécution** : **pilote** (~3 decks) pour valider le format, **puis workflow
   multi-agents** pour le run complet sur les 73 photos (parallélisé).
4. **Légalité** : importer les decks **tels quels** (historiques), même s'ils ne
   font pas exactement 48 cartes ou ne sont pas conformes aux règles actuelles.
   Les avertissements du validateur de deck sont acceptés/attendus.

## Architecture

### 1. Modèle de données

Nouveau fichier `src/data/dofusMagDecks.ts` exportant `DOFUS_MAG_DECKS:
OfficialDeck[]`. Concaténé aux `OFFICIAL_DECKS` côté vue (ou via un sélecteur
partagé) avec `extension: "dofus-mag"`.

`OfficialDeck` ([src/data/officialDecks.ts](../../../src/data/officialDecks.ts))
est étendu avec des champs **optionnels** (les starters existants restent
inchangés) :

```ts
export interface OfficialDeck {
  // … champs existants (id, name, description, extension, hero, havreSac, cards)
  lore?: string; // paragraphe d'intro narratif
  howToPlay?: string; // « Le conseil d'Adamaï » (comment jouer)
  alignment?: string; // ex. « Neutre »
  keyCards?: string[]; // « Cartes maîtresses »
  protector?: string; // « Protecteur : … »
  illustrator?: string; // crédit illustration/deck
  magIssue?: string; // ex. « Dofus Mag 124 »
  source?: "dofus-mag"; // provenance
}

export interface OfficialDeckCard {
  name: string;
  quantity: number;
  type: "hero" | "havre-sac" | "card";
  section?: string; // libellé de catégorie imprimé (ex. « Alliés »)
}
```

**Frontière :** ce module est purement déclaratif (données). Il ne dépend de
rien et est consommé par la vue et les tests. On peut le comprendre et le tester
isolément.

### 2. Résolution de cartes & honnêteté

- Les noms sont **toujours stockés verbatim** depuis le magazine.
- Résolution via le **même** `deckStore.findCardByName(name, undefined, ext)`
  que l'import des starters — **non pinné** pour Dofus Mag (les cartes couvrent
  plusieurs extensions). `findCardByName` accepte `ext` undefined (déjà le cas
  dans la vue).
- **Rapport de matching** produit pendant l'extraction (artefact hors-appli,
  ex. `docs/dofus-mag-matching-report.md`) : par deck → noms résolus,
  fuzzy-résolus (avec la correction appliquée), et **non résolus** (signalés
  pour relecture). Rien n'est silencieusement perdu.

### 3. UI (minimale, dans `OfficialDecksView.vue`)

- `formatExtensionName` + ordre des extensions : ajouter
  `"dofus-mag" → "Dofus Mag"`.
- Panneau **Détails** : rendre conditionnellement `lore`, `howToPlay`,
  `keyCards`, `alignment`, `illustrator`, `magIssue` quand présents. Les
  starters (sans ces champs) n'affichent rien de nouveau.
- Aucun changement au flux d'import : ces decks s'importent comme decks
  utilisateur via `buildAndAddDeck` (cartes manquantes déjà signalées par toast).

## Flux d'extraction (vision-par-Claude, deck-centric)

1. **Passe d'indexation** — survol des 73 photos → manifeste _deck → photos_
   (quelles photos couvrent quel deck). Résout l'overlap.
2. **Passe d'extraction par deck** — pour chaque deck, lire **toutes** ses photos
   ensemble pour remplir le schéma (les clichés qui se chevauchent lèvent les
   flous/coupures).
3. **Résolution + rapport** — matching des noms, génération du rapport.
4. **Émission** — écriture de `DOFUS_MAG_DECKS` dans `src/data/dofusMagDecks.ts`.

### Exécution

- **Pilote** : ~3 decks de bout en bout (extraction → résolution → fichier +
  rapport) → **validation du format par l'utilisateur**.
- **Run complet** : workflow multi-agents (opt-in utilisateur confirmé)
  parallélisant l'extraction des photos restantes ; un agent par deck (ou par
  lot de photos), schéma structuré en sortie, puis fusion + résolution + rapport.

## Gestion d'erreurs / cas limites

- **Nom non résolu** → stocké verbatim, listé dans le rapport ; le deck reste
  importable (carte simplement absente, déjà géré par l'import).
- **Deck ≠ 48 cartes / non conforme** → accepté tel quel (décision 4). Pas de
  blocage à l'import.
- **Photo illisible / deck partiel** → si un deck ne peut être complété depuis
  aucune de ses photos, il est listé comme **incomplet** dans le rapport plutôt
  que deviné.
- **Reprints (même nom, plusieurs extensions)** → non pinné ; ambiguïté
  signalée dans le rapport pour arbitrage manuel.

## Tests

- **Intégrité des données** (`tests/data/dofusMagDecks.test.ts`) : ids uniques,
  `quantity >= 1`, chaque deck a `hero` + `havreSac` + ≥1 carte, champs
  optionnels bien typés.
- **Résolution** : test qui signale tout deck dont hero/havreSac/cartes ne se
  résolvent pas (allowlist pour les non-résolubles connus) — garde-fou contre
  les régressions silencieuses de matching.
- **Rendu** : un test de montage du panneau Détails vérifiant l'affichage
  conditionnel des nouveaux champs.
- **E2E** : réutilise les tests existants de la page decks officiels.

## Hors périmètre (YAGNI)

- Pas de pipeline OCR programmatique (Tesseract) — l'extraction vision suffit.
- Pas d'édition/normalisation des images sources (rotation auto, etc.).
- Pas de modification du moteur de jeu ni du validateur de deck.
- Les 73 photos sources **ne sont pas commitées** dans git (volumineuses ;
  matériel de travail, pas un asset applicatif) — à `.gitignore` si besoin.

## Séquence de build (haut niveau)

1. Étendre les types `OfficialDeck` / `OfficialDeckCard` (champs optionnels).
2. Câbler le groupe `"dofus-mag"` dans `OfficialDecksView` (nom + ordre +
   concat des données + rendu Détails enrichi).
3. **Pilote** : extraire ~3 decks → `dofusMagDecks.ts` + rapport → validation.
4. Tests d'intégrité/résolution/rendu.
5. **Run complet** via workflow multi-agents → compléter `dofusMagDecks.ts` +
   rapport final.
6. Vérification : `npm run type-check`, `npx vitest run`, revue du rapport de
   matching.
