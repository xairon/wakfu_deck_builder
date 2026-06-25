# Unification de l'affichage des cartes — « Mes decks » ↔ « Decks officiels »

Date : 2026-06-25
Statut : design validé (en attente de relecture utilisateur)

## Problème

Deux pages de détail de deck affichent les cartes de façon incohérente :

- **`OfficialDeckDetailView`** (decks officiels à importer) — grille d'images via
  `DeckCardGrid` : tuiles illustrées, badge ×N, aperçu au survol
  (`CardHoverPreview`), clic → modale zoom, toggle grille/liste.
- **`DeckDetailView`** (mes decks) — liste **texte seule** (nom + quantité +
  « PA · Élément »), **aucune image de carte** (seuls le héros et le havre-sac
  ont une vignette). Pas d'aperçu au survol.

L'utilisateur veut voir **les images des cartes** dans « mes decks », et que les
deux pages soient cohérentes, via un **composant d'affichage partagé**.

## Objectif

Réutiliser `DeckCardGrid` (grille d'images + badges + survol + clic-zoom +
toggle grille/liste) sur **les deux** pages. `DeckDetailView` conserve ses outils
propres (répartition élémentaire, courbe de PA, simulateur de pioche,
en-tête/actions, modale zoom) ; seule la **zone d'affichage des cartes** (cartes
principales + réserve) passe au composant partagé.

Hors-scope : refonte de la mise en page globale de `DeckDetailView`, modification
des listes de decks (`DecksView` / `OfficialDecksView`), de l'atelier
(`DeckBuilderView`).

## Architecture

### 1. `DeckCardGrid` devient neutre (réutilisable)

- Découpler le type de prop de `ResolvedDeckGroup` (couplé aux decks officiels)
  vers une interface neutre `DeckGalleryGroup`, déclarée dans un petit module
  partagé `src/components/deck/deckGallery.ts` :

  ```ts
  export interface DeckGalleryEntry {
    name: string;
    quantity: number;
    card: Card | null;
  }
  export interface DeckGalleryGroup {
    section: string;
    total: number;
    entries: DeckGalleryEntry[];
  }
  ```

- `ResolvedDeckGroup` (dans `allOfficialDecks.ts`) reste **structurellement
  compatible** avec `DeckGalleryGroup` → `OfficialDeckDetailView` n'est pas
  modifié, et `DeckCardGrid.spec.ts` reste vert sans changement.

### 2. Liste enrichie (bénéficie aux deux pages)

La **vue liste** de `DeckCardGrid` est enrichie : pour chaque entrée dont la
carte est **résolue**, afficher le label « PA · Élément » et une couleur d'encre
élémentaire (spine), à droite du nom. Entrée non résolue (`card: null`) → nom
seul en couleur `warning`, comme aujourd'hui. La **vue grille** (images) est
inchangée.

Logique d'affichage centralisée dans un util pur `src/utils/cardDisplay.ts` :

```ts
export function cardElement(card: Card): string; // élément en minuscule, repli 'neutre'
export function cardPaLabel(card: Card): string; // ex. « 3 PA · Feu » / « Feu »
export function cardSpineColor(card: Card): string; // elementColor(cardElement(card))
```

Réutilise `elementColor` / `elementColors` de `@/config/elementColors` (source
unique des couleurs). `DeckDetailView` abandonne sa copie locale du dictionnaire
`elementColors` et ses fonctions `cardElement` / `cardColor` / `paLabel` au
profit de cet util.

### 3. `DeckDetailView` branche la grille partagée

- Remplacer les `<ul>` texte-seul (cartes principales groupées par type **et**
  vue plate triée) par `<DeckCardGrid :groups="galleryGroups" @select="openZoom" />`.
- La **réserve** passe aussi par `<DeckCardGrid>` (un groupe « Réserve »).
- Ajouter `<CardHoverPreview />` à la page (aperçu flottant au survol, comme la
  page officielle ; composant autonome, nettoyage `onUnmounted(hide)` déjà géré).
- Conserver le toggle de tri existant (Par type / Par PA / Par nom) : il pilote
  le **regroupement/ordre** ; le toggle interne de la grille pilote
  **images ↔ liste texte**.

### 4. Adaptateur pur `buildGalleryGroups`

Fonction pure (testable), dans `src/components/deck/deckGallery.ts` (auprès du
type `DeckGalleryGroup`) :

```ts
export function buildGalleryGroups(
  cards: DeckCard[],
  sortMode: "type" | "cost" | "name",
): DeckGalleryGroup[];
```

- `type` → un groupe par `mainType` (ordre = effectif décroissant, cartes triées
  par PA), entrées `{ name: card.name, quantity, card }` — réplique la logique
  actuelle `cardsByType`.
- `cost` → un seul groupe « Cartes du deck », trié par PA croissant.
- `name` → un seul groupe « Cartes du deck », trié par nom (`localeCompare`).

`section` du groupe = nom du type (mode `type`) ou « Cartes du deck » (modes
plats). `total` = somme des quantités.

## Flux de données

```
DeckDetailView
  deck.cards (DeckCard[])
    ├─ mainCards ──buildGalleryGroups(mode)──▶ DeckGalleryGroup[] ─▶ <DeckCardGrid @select=openZoom>
    └─ reserveCards ─({section:'Réserve', …})─▶ DeckGalleryGroup[] ─▶ <DeckCardGrid @select=openZoom>
  survol carte ──useCardPreview (singleton)──▶ <CardHoverPreview/>
  clic carte  ──openZoom──▶ <CardZoomModal/>

OfficialDeckDetailView (inchangé)
  resolveDeckCardGroups ──▶ ResolvedDeckGroup[] (≡ DeckGalleryGroup[]) ─▶ <DeckCardGrid>
```

## Tests

- `DeckCardGrid.spec.ts` — reste vert (compatibilité structurelle). Ajout d'un
  cas : la vue liste affiche « PA · Élément » pour une entrée résolue portant des
  stats, et n'affiche que le nom pour une entrée non résolue.
- `deckGallery.spec.ts` (nouveau) — `buildGalleryGroups` : modes type/cost/name
  → groupes/ordres attendus.
- `cardDisplay.spec.ts` (nouveau) — `cardPaLabel` / `cardElement` /
  `cardSpineColor` (incluant repli neutre, carte sans PA).
- Smoke (optionnel) — montage de `DeckDetailView` rend des tuiles d'images et
  émet le zoom au clic.

## Risques / points d'attention

- **Double toggle** sur « mes decks » : tri (type/PA/nom) **et** grille/liste de
  la grille. Acceptable (deux axes distincts), à surveiller visuellement.
- **Singleton `useCardPreview`** : un seul calque actif à la fois ; `DeckDetailView`
  et `OfficialDeckDetailView` sont sur des routes distinctes → pas de conflit.
  `CardHoverPreview` nettoie déjà au démontage.
- **Enrichissement liste côté page officielle** : les entrées résolues y
  gagnent le label PA · Élément — changement voulu et cohérent.

```

```
