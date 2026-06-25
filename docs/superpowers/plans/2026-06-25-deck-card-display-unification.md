# Unification de l'affichage des cartes (Mes decks ↔ Decks officiels) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher les cartes d'un deck personnel (`DeckDetailView`) avec images, survol et clic-zoom, via le même composant `DeckCardGrid` que la page des decks officiels.

**Architecture:** `DeckCardGrid` est rendu neutre (type de groupe partagé `DeckGalleryGroup`) et sa vue liste enrichie (PA · Élément + encre élémentaire). `DeckDetailView` construit ses groupes via une fonction pure `buildGalleryGroups` et délègue l'affichage des cartes principales + réserve au composant partagé, en gardant ses outils (analytics, simulateur, export). Les helpers d'affichage carte sont centralisés dans `src/utils/cardDisplay.ts`.

**Tech Stack:** Vue 3.3 (`<script setup lang="ts">`), TypeScript, Vitest + @vue/test-utils, Tailwind/DaisyUI.

**Référence spec :** `docs/superpowers/specs/2026-06-25-deck-card-display-unification-design.md`

---

## Structure des fichiers

- **Créer** `src/utils/cardDisplay.ts` — helpers purs `cardElement`, `cardPaLabel`, `cardSpineColor`.
- **Créer** `src/components/deck/deckGallery.ts` — types `DeckGalleryEntry` / `DeckGalleryGroup` + fonction pure `buildGalleryGroups`.
- **Créer** `tests/utils/cardDisplay.spec.ts`.
- **Créer** `tests/components/deck/deckGallery.spec.ts`.
- **Modifier** `src/components/deck/DeckCardGrid.vue` — prop typée `DeckGalleryGroup[]`, vue liste enrichie.
- **Modifier** `tests/components/deck/DeckCardGrid.spec.ts` — cas vue liste enrichie.
- **Modifier** `src/views/DeckDetailView.vue` — grille partagée pour cartes + réserve, `CardHoverPreview`, suppression des helpers locaux.

---

## Task 1 : Helpers d'affichage carte (`cardDisplay.ts`)

**Files:**

- Create: `src/utils/cardDisplay.ts`
- Test: `tests/utils/cardDisplay.spec.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/utils/cardDisplay.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { cardElement, cardPaLabel, cardSpineColor } from "@/utils/cardDisplay";
import { elementColors } from "@/config/elementColors";
import type { Card } from "@/types/cards";

const fire = {
  id: "x",
  name: "X",
  mainType: "Action",
  stats: { pa: 3, niveau: { value: 1, element: "feu" } },
} as Card;
const neutral = { id: "y", name: "Y", mainType: "Action" } as Card;

describe("cardDisplay", () => {
  it("cardElement renvoie l'élément en minuscule, repli neutre", () => {
    expect(cardElement(fire)).toBe("feu");
    expect(cardElement(neutral)).toBe("neutre");
  });

  it("cardPaLabel formate « PA · Élément », ou l'élément seul sans PA", () => {
    expect(cardPaLabel(fire)).toBe("3 PA · Feu");
    expect(cardPaLabel(neutral)).toBe("Neutre");
  });

  it("cardSpineColor mappe sur la couleur d'élément", () => {
    expect(cardSpineColor(fire)).toBe(elementColors.feu);
    expect(cardSpineColor(neutral)).toBe(elementColors.neutre);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run tests/utils/cardDisplay.spec.ts`
Expected: FAIL — `Failed to resolve import "@/utils/cardDisplay"`.

- [ ] **Step 3 : Implémenter le module**

Créer `src/utils/cardDisplay.ts` :

```ts
/**
 * Helpers d'affichage carte partagés (decklists, grilles). Source unique pour
 * l'élément dominant, le libellé « PA · Élément » et la couleur d'encre.
 */
import type { Card } from "@/types/cards";
import { elementColor } from "@/config/elementColors";

/** Élément dominant d'une carte, en minuscule. Repli « neutre ». */
export function cardElement(card: Card): string {
  return (
    card.stats?.niveau?.element ||
    card.stats?.force?.element ||
    "neutre"
  ).toLowerCase();
}

/** Couleur d'encre élémentaire (spine) d'une carte. */
export function cardSpineColor(card: Card): string {
  return elementColor(cardElement(card));
}

/** Libellé court : « 3 PA · Feu », ou « Feu » si la carte n'a pas de PA. */
export function cardPaLabel(card: Card): string {
  const el = cardElement(card);
  const elName = el.charAt(0).toUpperCase() + el.slice(1);
  const pa = card.stats?.pa;
  if (pa === undefined) return elName;
  return `${pa} PA · ${elName}`;
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npx vitest run tests/utils/cardDisplay.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/utils/cardDisplay.ts tests/utils/cardDisplay.spec.ts
git commit -m "feat(card-display): helpers purs cardElement/cardPaLabel/cardSpineColor"
```

---

## Task 2 : Types + adaptateur `deckGallery.ts`

**Files:**

- Create: `src/components/deck/deckGallery.ts`
- Test: `tests/components/deck/deckGallery.spec.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/components/deck/deckGallery.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { buildGalleryGroups } from "@/components/deck/deckGallery";
import type { DeckCard } from "@/types/cards";

function dc(
  name: string,
  mainType: string,
  pa: number,
  quantity = 1,
): DeckCard {
  return {
    card: { id: name, name, mainType, stats: { pa } },
    quantity,
    isReserve: false,
  } as DeckCard;
}

describe("buildGalleryGroups", () => {
  it("renvoie [] pour un deck vide", () => {
    expect(buildGalleryGroups([], "type")).toEqual([]);
  });

  it("mode type : un groupe par mainType, ordonné par effectif décroissant", () => {
    const cards = [
      dc("A", "Action", 2, 1),
      dc("B", "Allié", 1, 3),
      dc("C", "Allié", 3, 2),
    ];
    const groups = buildGalleryGroups(cards, "type");
    expect(groups.map((g) => g.section)).toEqual(["Allié", "Action"]); // 5 vs 1
    expect(groups[0].total).toBe(5);
    expect(groups[0].entries.map((e) => e.name)).toEqual(["B", "C"]); // tri PA croissant
  });

  it("mode cost : un seul groupe « Cartes du deck » trié par PA croissant", () => {
    const cards = [dc("A", "Action", 3), dc("B", "Allié", 1)];
    const groups = buildGalleryGroups(cards, "cost");
    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBe("Cartes du deck");
    expect(groups[0].entries.map((e) => e.name)).toEqual(["B", "A"]);
  });

  it("mode name : un seul groupe trié par nom", () => {
    const cards = [dc("Zelda", "Action", 1), dc("Arthur", "Allié", 1)];
    const groups = buildGalleryGroups(cards, "name");
    expect(groups[0].entries.map((e) => e.name)).toEqual(["Arthur", "Zelda"]);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run tests/components/deck/deckGallery.spec.ts`
Expected: FAIL — `Failed to resolve import "@/components/deck/deckGallery"`.

- [ ] **Step 3 : Implémenter le module**

Créer `src/components/deck/deckGallery.ts` :

```ts
/**
 * Modèle d'affichage partagé pour les grilles de cartes (DeckCardGrid). Les
 * decks officiels (ResolvedDeckGroup) y sont structurellement compatibles ; les
 * decks personnels passent par buildGalleryGroups.
 */
import type { Card, DeckCard } from "@/types/cards";

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

const FLAT_SECTION = "Cartes du deck";

const toEntry = (c: DeckCard): DeckGalleryEntry => ({
  name: c.card.name,
  quantity: c.quantity,
  card: c.card,
});

const sumQty = (entries: DeckGalleryEntry[]): number =>
  entries.reduce((s, e) => s + e.quantity, 0);

/**
 * Construit les groupes d'affichage depuis les cartes d'un deck personnel.
 *  - « type » : un groupe par mainType (effectif décroissant, cartes triées PA)
 *  - « cost » : un seul groupe trié par PA croissant
 *  - « name » : un seul groupe trié par nom (localeCompare)
 */
export function buildGalleryGroups(
  cards: DeckCard[],
  sortMode: "type" | "cost" | "name",
): DeckGalleryGroup[] {
  if (!cards.length) return [];

  if (sortMode === "type") {
    const byType = new Map<string, DeckCard[]>();
    for (const c of cards) {
      const t = c.card.mainType;
      const bucket = byType.get(t);
      if (bucket) bucket.push(c);
      else byType.set(t, [c]);
    }
    return [...byType.entries()]
      .map(([section, group]) => {
        const entries = [...group]
          .sort((a, b) => (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0))
          .map(toEntry);
        return { section, total: sumQty(entries), entries };
      })
      .sort((a, b) => b.total - a.total);
  }

  const entries = [...cards]
    .sort((a, b) =>
      sortMode === "cost"
        ? (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0)
        : a.card.name.localeCompare(b.card.name),
    )
    .map(toEntry);
  return [{ section: FLAT_SECTION, total: sumQty(entries), entries }];
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npx vitest run tests/components/deck/deckGallery.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/components/deck/deckGallery.ts tests/components/deck/deckGallery.spec.ts
git commit -m "feat(deck): type DeckGalleryGroup + adaptateur pur buildGalleryGroups"
```

---

## Task 3 : `DeckCardGrid` neutre + vue liste enrichie

**Files:**

- Modify: `src/components/deck/DeckCardGrid.vue`
- Test: `tests/components/deck/DeckCardGrid.spec.ts`

- [ ] **Step 1 : Écrire le test qui échoue (vue liste enrichie)**

Dans `tests/components/deck/DeckCardGrid.spec.ts`, ajouter un cas. D'abord enrichir la fixture `groups` existante en ajoutant une carte porteuse de stats à la fin du tableau `entries` de la section « Alliés » (juste après l'entrée `Carte B`) :

```ts
      { name: "Carte B", quantity: 2, card: null },
      {
        name: "Carte C",
        quantity: 1,
        card: {
          id: "c",
          name: "Carte C",
          mainType: "Action",
          stats: { pa: 3, niveau: { value: 1, element: "Feu" } },
        } as Card,
      },
```

Puis ajouter ce test dans le `describe` :

```ts
it("affiche « PA · Élément » en vue liste pour une carte résolue, nom seul sinon", async () => {
  const w = mount(DeckCardGrid, { props: { groups } });
  await w.get('[data-testid="toggle-view"]').trigger("click");
  expect(w.text()).toContain("3 PA · Feu"); // Carte C (résolue)
  expect(w.text()).toContain("Carte B"); // non résolue : nom seul
  expect(w.text()).not.toContain("undefined PA");
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run tests/components/deck/DeckCardGrid.spec.ts`
Expected: FAIL — le texte ne contient pas « 3 PA · Feu » (la vue liste n'affiche que nom + ×N).

- [ ] **Step 3 : Brancher le type neutre + enrichir la vue liste**

Dans `src/components/deck/DeckCardGrid.vue`, remplacer le bloc `<!-- LISTE -->` (le `<ul v-else …>`) par :

```html
<!-- LISTE -->
<ul v-else class="mt-3 space-y-1">
  <li
    v-for="e in g.entries"
    :key="e.name"
    class="flex items-baseline text-sm"
    :class="e.card ? 'spine cursor-pointer hover:text-primary' : ''"
    :style="e.card ? { '--spine': cardSpineColor(e.card) } : undefined"
    @mouseenter="e.card && preview.show(e.card)"
    @mouseleave="preview.hide()"
    @click="e.card && emit('select', e.card)"
  >
    <span :class="e.card ? 'text-base-content/85' : 'text-warning'"
      >{{ e.name }}</span
    >
    <span class="leader"></span>
    <span
      v-if="e.card"
      class="shrink-0 font-mono text-[11px] uppercase tracking-wide text-base-content/55"
      >{{ cardPaLabel(e.card) }}</span
    >
    <span class="ml-3 shrink-0 font-mono tabular text-base-content/70"
      >×{{ e.quantity }}</span
    >
  </li>
</ul>
```

Puis dans le `<script setup>`, remplacer l'import de type et la déclaration de prop. Supprimer :

```ts
import type { ResolvedDeckGroup } from "@/data/allOfficialDecks";
```

…et remplacer la ligne `defineProps` par :

```ts
import type { DeckGalleryGroup } from "./deckGallery";
import { cardSpineColor, cardPaLabel } from "@/utils/cardDisplay";

defineProps<{ groups: DeckGalleryGroup[] }>();
```

(Conserver l'import `import type { Card } from "@/types/cards";` — toujours utilisé par `defineEmits<{ (e: "select", card: Card): void }>()`.)

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npx vitest run tests/components/deck/DeckCardGrid.spec.ts`
Expected: PASS (5 tests — les 4 existants + le nouveau).

- [ ] **Step 5 : Type-check**

Run: `npm run type-check`
Expected: aucune erreur (le `ResolvedDeckGroup[]` de `OfficialDeckDetailView` reste assignable à `DeckGalleryGroup[]`).

- [ ] **Step 6 : Commit**

```bash
git add src/components/deck/DeckCardGrid.vue tests/components/deck/DeckCardGrid.spec.ts
git commit -m "feat(deck-card-grid): prop neutre DeckGalleryGroup + vue liste enrichie (PA · Élément + encre)"
```

---

## Task 4 : `DeckDetailView` — grille partagée pour cartes + réserve

**Files:**

- Modify: `src/views/DeckDetailView.vue`

> Pas de test unitaire dédié (câblage de vue : router + pinia + stores → fragile).
> La logique sous-jacente est couverte par Tasks 1–2. Vérification finale par
> type-check (Step 5) + aperçu navigateur (Task 5).

- [ ] **Step 1 : Template — cartes principales via la grille partagée**

Dans `src/views/DeckDetailView.vue`, remplacer les trois blocs de rendu des cartes principales (le `<div v-if="!deck.cards.length">…</div>`, le `<template v-else-if="cardSortMode === 'type'">…</template>` et le `<template v-else>…</template>`) par :

```html
<div
  v-if="!galleryGroups.length"
  class="mt-8 border-y border-base-content/15 py-12 text-center font-mono text-[12px] uppercase text-base-content/45"
>
  Aucune carte dans ce deck.
</div>
<DeckCardGrid v-else :groups="galleryGroups" class="mt-7" @select="openZoom" />
```

- [ ] **Step 2 : Template — réserve via la grille partagée + aperçu survol**

Remplacer le bloc `<section v-if="reserveCards.length"> … </section>` (en-tête « Réserve · N / 12 » + `<ul>`) par :

```html
<!-- Réserve -->
<section v-if="reserveGroups.length">
  <DeckCardGrid :groups="reserveGroups" @select="openZoom" />
</section>
```

Puis, juste avant le commentaire `<!-- Modal détail carte -->` (au-dessus de `<CardZoomModal …>`), ajouter :

```html
<!-- Aperçu flottant au survol -->
<CardHoverPreview />
```

- [ ] **Step 3 : Script — imports**

Dans le `<script setup>`, ajouter ces imports (après les imports de composants existants comme `DeckDrawSimulator`) :

```ts
import DeckCardGrid from "@/components/deck/DeckCardGrid.vue";
import CardHoverPreview from "@/components/card/CardHoverPreview.vue";
import {
  buildGalleryGroups,
  type DeckGalleryGroup,
} from "@/components/deck/deckGallery";
import { cardElement, cardSpineColor } from "@/utils/cardDisplay";
import { elementColor } from "@/config/elementColors";
```

Et modifier l'import de types canoniques (retirer `DeckCard`, devenu inutilisé) :

```ts
import type { Card, Deck } from "@/types/cards";
```

- [ ] **Step 4 : Script — remplacer les helpers locaux et computeds**

(a) Remplacer le bloc des couleurs/élément/heroColor/paLabel (le `const elementColors: Record<…> = { … }` jusqu'à la fonction `paLabel`) par le seul `heroColor` réécrit :

```ts
const heroColor = computed(() =>
  deck.value?.hero ? cardSpineColor(deck.value.hero) : elementColor("neutre"),
);
```

(b) Dans le computed `elementDist`, remplacer la ligne `color:` par l'appel centralisé :

```ts
      color: elementColor(name),
```

(`cardElement` y est désormais l'import depuis `@/utils/cardDisplay` ; le reste du computed est inchangé.)

(c) Supprimer les computeds `cardsByType` et `flatSortedCards` (remplacés par la grille), et ajouter à la place :

```ts
const galleryGroups = computed<DeckGalleryGroup[]>(() =>
  buildGalleryGroups(mainCards.value, cardSortMode.value),
);

const reserveGroups = computed<DeckGalleryGroup[]>(() => {
  if (!reserveCards.value.length) return [];
  const entries = reserveCards.value.map((c) => ({
    name: c.card.name,
    quantity: c.quantity,
    card: c.card,
  }));
  return [
    {
      section: "Réserve",
      total: entries.reduce((s, e) => s + e.quantity, 0),
      entries,
    },
  ];
});
```

- [ ] **Step 5 : Type-check**

Run: `npm run type-check`
Expected: aucune erreur. (Si « `paLabel`/`cardColor`/`cardsByType`/`flatSortedCards` is declared but never read » ou « `DeckCard` unused » apparaît, supprimer le résidu correspondant.)

- [ ] **Step 6 : Commit**

```bash
git add src/views/DeckDetailView.vue
git commit -m "feat(deck-detail): cartes + réserve en grille d'images partagée + survol (cohérence avec decks officiels)"
```

---

## Task 5 : Vérification globale

**Files:** aucun (validation).

- [ ] **Step 1 : Suite de tests complète**

Run: `npx vitest run`
Expected: PASS (tous les tests existants + les nouveaux ; aucun échec, aucun warning de rejet non géré).

- [ ] **Step 2 : Type-check final**

Run: `npm run type-check`
Expected: aucune erreur.

- [ ] **Step 3 : Vérification visuelle (aperçu)**

Lancer le serveur de dev (`preview_start` / `npm run dev`), ouvrir un deck personnel (`/deck/:id`) et vérifier :

- Les cartes principales s'affichent en **grille d'images** avec badge ×N.
- Le toggle **grille ↔ liste** fonctionne ; en liste, chaque carte montre « PA · Élément » + barre d'encre.
- Le **survol** d'une carte ouvre l'aperçu flottant ; le **clic** ouvre la modale zoom.
- La **réserve** (si 12 cartes) s'affiche aussi en grille d'images.
- Répartition élémentaire, courbe de PA, simulateur, en-tête/actions : intacts.
- Recharger la page d'un **deck officiel** (`/decks/official/:id`) : affichage inchangé (non-régression).

- [ ] **Step 4 : Mettre à jour la mémoire (optionnel)**

Si pertinent, noter dans la mémoire projet que l'affichage des cartes des deux pages de détail est désormais unifié via `DeckCardGrid` + `deckGallery.buildGalleryGroups`.

---

## Notes / arbitrages

- **Perte mineure** : l'en-tête de réserve passe de « Réserve · N / 12 » à « Réserve · {total} » (la grille gère son propre en-tête de section). Acceptable ; la validité 0/12 reste reflétée par le badge « Prêt à jouer / En cours ».
- **Double contrôle** sur « mes decks » : tri (type/PA/nom) **et** toggle grille/liste de la grille — deux axes distincts, voulu.
- **Deux grilles** (principale + réserve) ont chacune leur propre toggle grille/liste — accepté pour rester minimal (pas de nouvelle API sur `DeckCardGrid`).

```

```
