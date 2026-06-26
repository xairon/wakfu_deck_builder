# Interopérabilité des réimpressions — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La règle des copies (max 3 / 1 pour Unique) compte par _carte_ (nom canonique) et non par impression, et on peut permuter l'édition d'une carte déjà dans un deck.

**Architecture:** Séparer le **comptage des copies** (canonique, par nom) de l'**identité d'entrée** (par `card.id`). Un util `cardIdentity` fournit la clé canonique ; le validateur, le store et le pool comptent par cette clé ; une action `setEntryEdition` + un chip UI gèrent la permutation. Aucun changement au modèle `Deck`/`DeckCard`, à la collection, ni au partage.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, TypeScript, Vitest + @vue/test-utils.

**Spec:** `docs/superpowers/specs/2026-06-26-reprint-interop-design.md`

**Note clé :** les noms de cartes sont **déjà normalisés au chargement** (`cardLoader` appelle `fixSpecialCharacters`). Donc `canonicalKey` n'a besoin que de `trim().toLowerCase()` — pas d'import de `cardLoader` (évite toute dépendance circulaire).

---

## Fichiers touchés

| Fichier                                             | Rôle                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/utils/cardIdentity.ts` (créer)                 | `canonicalKey(card)`, `samePrinting`, `printingsOf(cards, card)`                          |
| `src/utils/__tests__/cardIdentity.spec.ts` (créer)  | Tests de l'util                                                                           |
| `src/validators/deck.ts` (modifier)                 | `getCardCopies` + `validateCardCopies` → clé canonique                                    |
| `src/validators/__tests__/deck.spec.ts` (modifier)  | Tests copies inter-éditions                                                               |
| `src/stores/deckStore.ts` (modifier)                | `addCard` `totalCopies` canonique ; nouvelle action `setEntryEdition` + export            |
| `src/stores/__tests__/deckStore.spec.ts` (modifier) | Tests blocage 4ᵉ + `setEntryEdition`                                                      |
| `src/stores/cardStore.ts` (modifier)                | `printingsIndex` mémoïsé + `printingsOf(card)` + export                                   |
| `src/stores/__tests__/cardStore.spec.ts` (modifier) | Test `printingsOf`                                                                        |
| `src/components/deck/CardPool.vue` (modifier)       | `inDeckQty`/`canAddCard`/`addBlockReason` réutilisent le comptage canonique du validateur |
| `src/components/deck/DeckCardRow.vue` (modifier)    | Chip d'édition + emit `set-edition`                                                       |
| `src/components/deck/ReserveRow.vue` (modifier)     | Chip d'édition + emit `set-edition`                                                       |
| `src/components/deck/DeckPanel.vue` (modifier)      | Câble `@set-edition` → `deckStore.setEntryEdition`                                        |

---

## Task 1 : Util d'identité canonique

**Files:**

- Create: `src/utils/cardIdentity.ts`
- Test: `src/utils/__tests__/cardIdentity.spec.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// src/utils/__tests__/cardIdentity.spec.ts
import { describe, it, expect } from "vitest";
import { canonicalKey, printingsOf } from "@/utils/cardIdentity";
import { createMockAllyCard } from "../../../tests/factories/card";

describe("cardIdentity", () => {
  it("devrait produire la même clé pour deux impressions de même nom", () => {
    const incarnam = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
    const dofus = createMockAllyCard({
      id: "tofu-dofus-collection",
      name: "Tofu",
    });
    expect(canonicalKey(incarnam)).toBe(canonicalKey(dofus));
  });

  it("devrait ignorer la casse et les espaces autour du nom", () => {
    const a = createMockAllyCard({ name: "Bworky" });
    const b = createMockAllyCard({ name: "  bworky " });
    expect(canonicalKey(a)).toBe(canonicalKey(b));
  });

  it("devrait distinguer des noms différents", () => {
    const a = createMockAllyCard({ name: "Tofu" });
    const b = createMockAllyCard({ name: "Bouftou" });
    expect(canonicalKey(a)).not.toBe(canonicalKey(b));
  });

  it("printingsOf devrait retourner toutes les impressions du même nom", () => {
    const a = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
    const b = createMockAllyCard({ id: "tofu-dofus-collection", name: "Tofu" });
    const c = createMockAllyCard({ id: "bouftou-amakna", name: "Bouftou" });
    const result = printingsOf([a, b, c], a);
    expect(result.map((x) => x.id).sort()).toEqual([
      "tofu-dofus-collection",
      "tofu-incarnam",
    ]);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/utils/__tests__/cardIdentity.spec.ts`
Expected: FAIL — `Failed to resolve import "@/utils/cardIdentity"`.

- [ ] **Step 3 : Implémenter l'util**

```ts
// src/utils/cardIdentity.ts
/**
 * Identité canonique d'une carte = regroupement des réimpressions.
 *
 * Vérifié sur les données : deux cartes de même nom dans des extensions
 * différentes sont la même carte au sens des règles (les écarts résiduels sont
 * des artefacts de scraping). Le nom est donc une clé fiable.
 *
 * Les noms sont DÉJÀ normalisés au chargement (cardLoader.fixSpecialCharacters),
 * donc on se contente ici de trim + lowercase (aucun import de cardLoader →
 * pas de dépendance circulaire).
 */
import type { Card } from "@/types/cards";

/** Clé regroupant les impressions d'une même carte (nom normalisé). */
export function canonicalKey(card: Card): string {
  return card.name.trim().toLowerCase();
}

/** Vrai si `a` et `b` sont la même carte au sens canonique (mêmes copies). */
export function sameCanonicalCard(a: Card, b: Card): boolean {
  return canonicalKey(a) === canonicalKey(b);
}

/** Toutes les impressions de `cards` partageant la clé canonique de `card`. */
export function printingsOf(cards: Card[], card: Card): Card[] {
  const key = canonicalKey(card);
  return cards.filter((c) => canonicalKey(c) === key);
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/utils/__tests__/cardIdentity.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/utils/cardIdentity.ts src/utils/__tests__/cardIdentity.spec.ts
git commit -m "feat(card-identity): clé canonique par nom + printingsOf (regroupement des réimpressions)"
```

---

## Task 2 : Comptage canonique dans le validateur

**Files:**

- Modify: `src/validators/deck.ts` (`getCardCopies` ~l. 45-49 ; `validateCardCopies` ~l. 124-145)
- Test: `src/validators/__tests__/deck.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter ce bloc dans `src/validators/__tests__/deck.spec.ts` (adapter l'import des factories à celui déjà utilisé en haut du fichier) :

```ts
import { canonicalKey } from "@/utils/cardIdentity";
import { getCardCopies } from "@/validators/deck";

describe("règle des copies — réimpressions (canonique)", () => {
  it("getCardCopies devrait additionner les copies de toutes les éditions", () => {
    const incarnam = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
    const dofus = createMockAllyCard({
      id: "tofu-dofus-collection",
      name: "Tofu",
    });
    const deck = createMockDeck({
      cards: [
        { card: incarnam, quantity: 2 },
        { card: dofus, quantity: 1 },
      ],
    });
    expect(getCardCopies(deck, incarnam)).toBe(3);
    expect(getCardCopies(deck, dofus)).toBe(3);
  });

  it("validateDeck devrait refuser 4 copies réparties sur 2 éditions", () => {
    const incarnam = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
    const dofus = createMockAllyCard({
      id: "tofu-dofus-collection",
      name: "Tofu",
    });
    const deck = createMockDeck({
      hero: createMockHeroCard(),
      havreSac: createMockHavreSacCard(),
      cards: [
        { card: incarnam, quantity: 2 },
        { card: dofus, quantity: 2 },
      ],
    });
    const result = validateDeck(deck);
    expect(result.errors.some((e) => e.includes("Tofu"))).toBe(true);
  });

  it("ne devrait émettre qu'UNE violation par carte canonique", () => {
    const incarnam = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
    const dofus = createMockAllyCard({
      id: "tofu-dofus-collection",
      name: "Tofu",
    });
    const deck = createMockDeck({
      cards: [
        { card: incarnam, quantity: 2 },
        { card: dofus, quantity: 2 },
      ],
    });
    const result = validateDeck(deck);
    const tofuErrors = result.errors.filter((e) => e.includes("Tofu"));
    expect(tofuErrors.length).toBe(1);
  });
});
```

> Vérifier en tête de fichier que `validateDeck`, `getCardCopies`, `createMockDeck`, `createMockHeroCard`, `createMockHavreSacCard` sont importés ; ajouter ceux qui manquent.

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `npx vitest run src/validators/__tests__/deck.spec.ts`
Expected: FAIL — `getCardCopies` renvoie 2 et 1 (compte par `id`), pas 3.

- [ ] **Step 3 : Implémenter le comptage canonique**

Dans `src/validators/deck.ts`, ajouter l'import en tête :

```ts
import { canonicalKey } from "@/utils/cardIdentity";
```

Remplacer `getCardCopies` :

```ts
/**
 * Compte les copies d'une carte dans le deck, TOUTES ÉDITIONS confondues
 * (regroupement canonique par nom). Inclut la réserve (pas de filtre isReserve).
 */
export function getCardCopies(deck: Deck, card: Card): number {
  const key = canonicalKey(card);
  return deck.cards
    .filter((c) => canonicalKey(c.card) === key)
    .reduce((total, c) => total + c.quantity, 0);
}
```

Dans `validateCardCopies`, remplacer la déduplication par `id` par la clé canonique :

```ts
function validateCardCopies(deck: Deck, errors: string[]): boolean {
  let valid = true;
  const seen = new Set<string>();
  for (const deckCard of deck.cards) {
    const key = canonicalKey(deckCard.card);
    if (seen.has(key)) continue; // une carte canonique = une violation max
    seen.add(key);
    const copies = getCardCopies(deck, deckCard.card);
    const unique = isUniqueCard(deckCard.card);
    const maxCopies = unique ? 1 : DECK_RULES.MAX_COPIES;

    if (copies > maxCopies) {
      errors.push(
        unique
          ? `${deckCard.card.name} est une carte unique et ne peut être présente qu'en un seul exemplaire`
          : `Le deck ne peut pas contenir plus de ${maxCopies} copies de ${deckCard.card.name}`,
      );
      valid = false;
    }
  }
  return valid;
}
```

- [ ] **Step 4 : Lancer pour vérifier que ça passe**

Run: `npx vitest run src/validators/__tests__/deck.spec.ts`
Expected: PASS (anciens tests + 3 nouveaux).

- [ ] **Step 5 : Commit**

```bash
git add src/validators/deck.ts src/validators/__tests__/deck.spec.ts
git commit -m "feat(deck-rules): limite de copies comptée par carte canonique (toutes éditions)"
```

---

## Task 3 : `addCard` du store — limite canonique

**Files:**

- Modify: `src/stores/deckStore.ts` (`addCard`, `totalCopies` ~l. 510-513)
- Test: `src/stores/__tests__/deckStore.spec.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `src/stores/__tests__/deckStore.spec.ts` (suivre le pattern de setup Pinia déjà présent dans le fichier) :

```ts
import { canonicalKey } from "@/utils/cardIdentity"; // si besoin pour assert

it("addCard devrait refuser une 4ᵉ copie répartie sur deux éditions", () => {
  const store = useDeckStore();
  store.createDeck("Test");
  const incarnam = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
  const dofus = createMockAllyCard({
    id: "tofu-dofus-collection",
    name: "Tofu",
  });

  store.addCard(incarnam, 3);
  store.addCard(dofus, 1); // doit être bloquée (déjà 3 Tofu)

  const total = store
    .currentDeck!.cards.filter((c) => canonicalKey(c.card) === "tofu")
    .reduce((a, c) => a + c.quantity, 0);
  expect(total).toBe(3);
});
```

> Adapter le nom de l'action de création de deck à celle réellement exportée par le store (ex. `createDeck`/`createNewDeck`) — vérifier dans `src/stores/deckStore.ts` le bloc `return { ... }`.

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `npx vitest run src/stores/__tests__/deckStore.spec.ts -t "4ᵉ copie"`
Expected: FAIL — total = 4 (le compte par `id` autorise l'ajout).

- [ ] **Step 3 : Implémenter le comptage canonique dans `addCard`**

Dans `src/stores/deckStore.ts`, ajouter en tête l'import :

```ts
import { canonicalKey } from "@/utils/cardIdentity";
```

Remplacer le calcul de `totalCopies` (~l. 511-513) :

```ts
const key = canonicalKey(card);
const totalCopies = currentDeck.value.cards
  .filter((c) => canonicalKey(c.card) === key)
  .reduce((a, c) => a + c.quantity, 0);
```

> Ne PAS toucher `existingCard` (l. 521-523) : l'incrément reste lié à l'impression précise (`c.card.id === card.id`). C'est volontaire — deux éditions = deux lignes.

- [ ] **Step 4 : Lancer pour vérifier que ça passe**

Run: `npx vitest run src/stores/__tests__/deckStore.spec.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/stores/deckStore.ts src/stores/__tests__/deckStore.spec.ts
git commit -m "feat(deck-store): addCard borne les copies par carte canonique"
```

---

## Task 4 : Action `setEntryEdition`

**Files:**

- Modify: `src/stores/deckStore.ts` (nouvelle action + ajout dans le `return {}` ~l. 962)
- Test: `src/stores/__tests__/deckStore.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
it("setEntryEdition devrait permuter l'édition en gardant la quantité", () => {
  const store = useDeckStore();
  store.createDeck("Test");
  const incarnam = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
  const dofus = createMockAllyCard({
    id: "tofu-dofus-collection",
    name: "Tofu",
  });
  store.addCard(incarnam, 2);

  store.setEntryEdition("tofu-incarnam", false, dofus);

  const entries = store.currentDeck!.cards;
  expect(entries.length).toBe(1);
  expect(entries[0].card.id).toBe("tofu-dofus-collection");
  expect(entries[0].quantity).toBe(2);
});

it("setEntryEdition devrait fusionner si l'édition cible existe déjà (même zone)", () => {
  const store = useDeckStore();
  store.createDeck("Test");
  const incarnam = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
  const dofus = createMockAllyCard({
    id: "tofu-dofus-collection",
    name: "Tofu",
  });
  store.addCard(incarnam, 2);
  store.addCard(dofus, 1);

  store.setEntryEdition("tofu-incarnam", false, dofus);

  const entries = store.currentDeck!.cards;
  expect(entries.length).toBe(1);
  expect(entries[0].card.id).toBe("tofu-dofus-collection");
  expect(entries[0].quantity).toBe(3);
});
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `npx vitest run src/stores/__tests__/deckStore.spec.ts -t "setEntryEdition"`
Expected: FAIL — `store.setEntryEdition is not a function`.

- [ ] **Step 3 : Implémenter l'action**

Ajouter dans `src/stores/deckStore.ts`, après `moveCardZone` (~l. 600) :

```ts
/**
 * Permute l'édition (impression) d'une entrée de deck en gardant la quantité.
 * Si une entrée de l'édition cible existe déjà dans la MÊME zone, on fusionne
 * les quantités (l'entrée source disparaît). La carte cible doit être une
 * réimpression de la carte source (même nom canonique) — non vérifié ici, la
 * garantie vient de l'UI qui ne propose que `printingsOf`.
 */
function setEntryEdition(
  cardId: string,
  isReserve: boolean,
  newPrinting: Card,
) {
  if (!currentDeck.value) return;
  if (newPrinting.id === cardId) return;

  const src = currentDeck.value.cards.find(
    (c) => c.card.id === cardId && !!c.isReserve === isReserve,
  );
  if (!src) return;

  const prepared = prepareCardForDeck(newPrinting);
  const existing = currentDeck.value.cards.find(
    (c) => c.card.id === newPrinting.id && !!c.isReserve === isReserve,
  );

  if (existing) {
    existing.quantity += src.quantity;
    currentDeck.value.cards.splice(currentDeck.value.cards.indexOf(src), 1);
  } else {
    src.card = prepared;
  }

  currentDeck.value.updatedAt = new Date().toISOString();
  saveDecks();
}
```

Ajouter `setEntryEdition,` dans le bloc `return { ... }` du store (à côté de `moveCardZone,` ~l. 994).

- [ ] **Step 4 : Lancer pour vérifier que ça passe**

Run: `npx vitest run src/stores/__tests__/deckStore.spec.ts -t "setEntryEdition"`
Expected: PASS (2 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/stores/deckStore.ts src/stores/__tests__/deckStore.spec.ts
git commit -m "feat(deck-store): action setEntryEdition (permutation d'édition + fusion)"
```

---

## Task 5 : `printingsOf` dans le cardStore

**Files:**

- Modify: `src/stores/cardStore.ts` (index mémoïsé ~l. 37 ; getter ; `return {}` ~l. 507)
- Test: `src/stores/__tests__/cardStore.spec.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `src/stores/__tests__/cardStore.spec.ts` (suivre le setup Pinia du fichier ; injecter `cards` via la même méthode que les tests existants — souvent `store.cards = [...]` ou un helper de chargement) :

```ts
it("printingsOf devrait retourner toutes les impressions d'un même nom", () => {
  const store = useCardStore();
  const incarnam = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
  const dofus = createMockAllyCard({
    id: "tofu-dofus-collection",
    name: "Tofu",
  });
  const other = createMockAllyCard({ id: "bouftou-amakna", name: "Bouftou" });
  store.cards = [incarnam, dofus, other];

  const printings = store.printingsOf(incarnam);
  expect(printings.map((c) => c.id).sort()).toEqual([
    "tofu-dofus-collection",
    "tofu-incarnam",
  ]);
});
```

> Si `store.cards` n'est pas assignable directement dans les tests, utiliser le même mécanisme d'injection que les autres tests de `cardStore.spec.ts` (vérifier en tête de fichier).

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `npx vitest run src/stores/__tests__/cardStore.spec.ts -t "printingsOf"`
Expected: FAIL — `store.printingsOf is not a function`.

- [ ] **Step 3 : Implémenter l'index + getter**

Dans `src/stores/cardStore.ts`, ajouter l'import en tête :

```ts
import { canonicalKey } from "@/utils/cardIdentity";
```

Après le `cardIndex` mémoïsé (~l. 41), ajouter un index canonique mémoïsé :

```ts
// Index clé-canonique → impressions, mémoïsé (évite un filtre O(n) par ligne
// de deck affichée). Recalculé seulement quand `cards` est réassigné.
const printingsIndex = computed(() => {
  const map = new Map<string, Card[]>();
  for (const card of cards.value) {
    const key = canonicalKey(card);
    const list = map.get(key);
    if (list) list.push(card);
    else map.set(key, [card]);
  }
  return map;
});

/** Toutes les impressions chargées partageant la clé canonique de `card`. */
function printingsOf(card: Card): Card[] {
  return printingsIndex.value.get(canonicalKey(card)) ?? [card];
}
```

Ajouter `printingsOf,` (et, si utile ailleurs, `printingsIndex,`) dans le `return { ... }` du store, à côté de `getCardByIdSync`.

- [ ] **Step 4 : Lancer pour vérifier que ça passe**

Run: `npx vitest run src/stores/__tests__/cardStore.spec.ts -t "printingsOf"`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/stores/cardStore.ts src/stores/__tests__/cardStore.spec.ts
git commit -m "feat(card-store): getter printingsOf (index canonique mémoïsé)"
```

---

## Task 6 : Pool — comptage canonique partagé

**Files:**

- Modify: `src/components/deck/CardPool.vue` (`inDeckQty` ~l. 292-296 ; `canAddCard` ~l. 298-305 ; `addBlockReason` ~l. 307-317)

**But :** réutiliser le comptage canonique du validateur plutôt que de réimplémenter par `id`, pour que toutes les impressions d'un nom soient grisées ensemble à la limite. (Pas de test composant : la logique déléguée est couverte par les tests du validateur, Task 2.)

- [ ] **Step 1 : Importer les helpers du validateur**

En tête du `<script setup>` de `CardPool.vue`, ajouter :

```ts
import { getCardCopies } from "@/validators/deck";
import { maxCopiesForCard } from "@/utils/cardRules";
```

- [ ] **Step 2 : Remplacer `inDeckQty` par un comptage canonique**

```ts
function inDeckQty(card: Card): number {
  const deck = deckStore.currentDeck;
  if (!deck) return 0;
  return getCardCopies(deck, card);
}
```

> `inDeckQty` prend désormais une `Card` et non un `id`. Mettre à jour ses appels dans le template / le script (recherche `inDeckQty(` dans le fichier) pour passer la carte.

- [ ] **Step 3 : Mettre `canAddCard` / `addBlockReason` sur la base canonique**

```ts
function canAddCard(card: Card): boolean {
  if (!deckStore.currentDeck) return false;
  if (card.mainType === "Héros" || card.mainType === "Havre-Sac") return true;
  if (inDeckQty(card) >= maxCopiesForCard(card)) return false;
  return deckStore.cardCount < 48;
}

function addBlockReason(card: Card): string {
  if (!deckStore.currentDeck) return "Aucun deck actif";
  if (card.mainType === "Héros" || card.mainType === "Havre-Sac") return "";
  const max = maxCopiesForCard(card);
  if (inDeckQty(card) >= max)
    return max === 1
      ? `${card.name} est unique (1 exemplaire max)`
      : `Maximum ${max} exemplaires de ${card.name}`;
  return "Le deck contient déjà 48 cartes";
}
```

- [ ] **Step 4 : Vérifier le type-check + tests**

Run: `npm run type-check && npx vitest run src/components/deck`
Expected: type-check OK ; tests existants verts.

- [ ] **Step 5 : Commit**

```bash
git add src/components/deck/CardPool.vue
git commit -m "refactor(card-pool): comptage de copies canonique (réutilise getCardCopies/maxCopiesForCard)"
```

---

## Task 7 : Chip d'édition sur les lignes de deck

**Files:**

- Modify: `src/components/deck/DeckCardRow.vue`
- Modify: `src/components/deck/ReserveRow.vue`

- [ ] **Step 1 : `DeckCardRow.vue` — props/emit + chip**

Dans le `<script setup>`, remplacer le bloc props/emit et ajouter le calcul des éditions :

```ts
import type { Card, DeckCard } from "@/types/cards";
import { computed } from "vue";
import { useCardPreview } from "@/composables/useCardPreview";
import { useCardStore } from "@/stores/cardStore";

const preview = useCardPreview();
const cardStore = useCardStore();

const props = defineProps<{
  dc: DeckCard;
  spineColor: string;
}>();

defineEmits<{
  "move-to-reserve": [id: string];
  remove: [id: string];
  add: [card: Card];
  "set-edition": [cardId: string, printing: Card];
}>();

const editions = computed(() => cardStore.printingsOf(props.dc.card));
const hasMultipleEditions = computed(() => editions.value.length > 1);
```

Dans le `<template>`, insérer le chip juste avant le bloc des boutons (`<span class="ml-1 flex ...">`) :

```html
<span v-if="hasMultipleEditions" class="shrink-0" @mouseenter="preview.hide()">
  <select
    class="select select-ghost select-xs h-6 min-h-0 max-w-[7.5rem] truncate font-mono text-[10px] uppercase tracking-wider"
    :value="dc.card.id"
    :title="`Édition : ${dc.card.extension.name}`"
    :aria-label="`Édition de ${dc.card.name}`"
    @change="
          $emit(
            'set-edition',
            dc.card.id,
            editions.find((e) => e.id === ($event.target as HTMLSelectElement).value)!,
          )
        "
  >
    <option v-for="e in editions" :key="e.id" :value="e.id">
      {{ e.extension.name }}
    </option>
  </select>
</span>
```

- [ ] **Step 2 : `ReserveRow.vue` — mêmes ajouts**

Reproduire exactement les mêmes ajouts dans `ReserveRow.vue` : importer `computed`, `useCardStore`, `Card` ; passer `defineProps` en `const props = defineProps<...>()` ; ajouter l'emit `"set-edition": [cardId: string, printing: Card]` ; ajouter les computed `editions` / `hasMultipleEditions` ; insérer le même chip `<select>` avant le bloc de boutons.

- [ ] **Step 3 : Vérifier le type-check**

Run: `npm run type-check`
Expected: OK (aucune erreur vue-tsc).

- [ ] **Step 4 : Commit**

```bash
git add src/components/deck/DeckCardRow.vue src/components/deck/ReserveRow.vue
git commit -m "feat(deck-rows): sélecteur d'édition (affiché si >1 impression) + emit set-edition"
```

---

## Task 8 : Câblage dans DeckPanel

**Files:**

- Modify: `src/components/deck/DeckPanel.vue` (rendu `DeckCardRow` ~l. 188-196 ; `ReserveRow` ~l. 227-234)

- [ ] **Step 1 : Brancher l'emit sur l'action du store**

Sur `<DeckCardRow ...>` (~l. 188), ajouter :

```html
@set-edition="(id, printing) => deckStore.setEntryEdition(id, false, printing)"
```

Sur `<ReserveRow ...>` (~l. 227), ajouter :

```html
@set-edition="(id, printing) => deckStore.setEntryEdition(id, true, printing)"
```

- [ ] **Step 2 : Vérifier le type-check + tests deck**

Run: `npm run type-check && npx vitest run src/components/deck src/stores/__tests__/deckStore.spec.ts`
Expected: OK et verts.

- [ ] **Step 3 : Commit**

```bash
git add src/components/deck/DeckPanel.vue
git commit -m "feat(deck-panel): câble set-edition → deckStore.setEntryEdition (deck + réserve)"
```

---

## Task 9 : Vérification globale

- [ ] **Step 1 : Suite complète + type-check**

Run: `npm run type-check && npx vitest run`
Expected: type-check OK ; toute la suite verte (les ~711 tests existants + les nouveaux).

- [ ] **Step 2 : Vérification manuelle (preview)**

Lancer le dev server, ouvrir le deck builder :

- ajouter 3 copies d'une carte ayant ≥2 éditions (ex. Tofu) → toutes les impressions de Tofu dans le pool se grisent ;
- sur la ligne du deck, changer l'édition via le `<select>` → l'art change, la quantité est conservée ;
- ajouter une 2ᵉ édition puis permuter vers la 1ʳᵉ → les lignes fusionnent.

- [ ] **Step 3 : Commit final éventuel (rien à committer si tout est déjà fait)**

```bash
git status
```

---

## Notes de revue (self-review)

- **Couverture spec** : identité canonique (T1) ✓ ; règle copies validateur (T2) ✓ ; store addCard (T3) ✓ ; permutation `setEntryEdition` (T4) ✓ ; `printingsOf` (T5) ✓ ; pool grisé partagé (T6) ✓ ; chip UI (T7) ✓ ; câblage (T8) ✓ ; hors-périmètre (collection/partage/modèle) non touché par construction.
- **Cohérence des types** : `canonicalKey(card: Card): string`, `printingsOf(cards, card)` (util) vs `cardStore.printingsOf(card)` (getter) — noms volontairement homonymes mais signatures distinctes (util pur vs getter du store). `setEntryEdition(cardId, isReserve, newPrinting)` cohérent entre store, emit `set-edition` et DeckPanel.
- **DRY** : CardPool réutilise `getCardCopies`/`maxCopiesForCard` au lieu de réimplémenter ; le validateur reste l'unique source du comptage.
- **Identité vs comptage** : les chemins d'incrément/retrait/déplacement (`existingCard`, `removeCard`, `moveCardZone`) restent par `card.id` — non modifiés, c'est la garantie « deux éditions = deux lignes ».
