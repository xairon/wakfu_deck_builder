# Page dédiée par deck officiel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliquer sur un deck de `/decks/official` ouvre une page dédiée `/decks/official/:id` montrant tous les champs (lore, conseil, cartes maîtresses, méta) et les cartes en grille de vignettes (avec bascule liste + survol-zoom).

**Architecture:** Sélecteur partagé `ALL_OFFICIAL_DECKS` + `getOfficialDeckById`. Logique d'import extraite en composable. Résolution nom→`Card` en fonction pure testable. Grille de cartes présentationnelle. Nouvelle vue `OfficialDeckDetailView` + route publique. La vue liste pointe vers la page.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, vue-router, Pinia (`deckStore.findCardByName`, `cardStore`), Vitest + @vue/test-utils.

**Spec:** [docs/superpowers/specs/2026-06-25-official-deck-detail-page-design.md](../specs/2026-06-25-official-deck-detail-page-design.md)

---

## File Structure

| Fichier                                                   | Rôle                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/data/allOfficialDecks.ts` (créer)                    | `ALL_OFFICIAL_DECKS`, `getOfficialDeckById`, `EXTENSION_NAME_BY_SLUG` (déplacé ici), `resolveDeckCardGroups` (pur). |
| `src/composables/useOfficialDeckImport.ts` (créer)        | `buildOfficialDeck` (pur) + `useOfficialDeckImport()` (stores + toasts).                                            |
| `src/components/deck/DeckCardGrid.vue` (créer)            | Présentationnel : groupes résolus en props, bascule grille/liste, survol-zoom.                                      |
| `src/views/OfficialDeckDetailView.vue` (créer)            | La page.                                                                                                            |
| `src/router/index.ts` (modifier)                          | Route `/decks/official/:id`.                                                                                        |
| `src/views/OfficialDecksView.vue` (modifier)              | Lien « Voir le deck », sélecteur + composable partagés, retrait de l'expand inline.                                 |
| `tests/data/allOfficialDecks.spec.ts` (créer)             | `getOfficialDeckById`, `resolveDeckCardGroups`.                                                                     |
| `tests/composables/useOfficialDeckImport.spec.ts` (créer) | `buildOfficialDeck` (pur).                                                                                          |
| `tests/components/deck/DeckCardGrid.spec.ts` (créer)      | Rendu grille/liste, badge ×N, survol.                                                                               |

---

## Task 1: Sélecteur partagé `allOfficialDecks.ts`

**Files:**

- Create: `src/data/allOfficialDecks.ts`
- Test: `tests/data/allOfficialDecks.spec.ts`

- [ ] **Step 1: Test (échoue — module absent)**

Créer `tests/data/allOfficialDecks.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import {
  ALL_OFFICIAL_DECKS,
  getOfficialDeckById,
  resolveDeckCardGroups,
} from "@/data/allOfficialDecks";
import type { Card } from "@/types/cards";

describe("allOfficialDecks", () => {
  it("fusionne starters + dofus-mag", () => {
    const exts = new Set(ALL_OFFICIAL_DECKS.map((d) => d.extension));
    expect(exts.has("incarnam")).toBe(true);
    expect(exts.has("dofus-mag")).toBe(true);
  });

  it("getOfficialDeckById trouve / renvoie undefined", () => {
    const first = ALL_OFFICIAL_DECKS[0];
    expect(getOfficialDeckById(first.id)?.id).toBe(first.id);
    expect(getOfficialDeckById("nope-xyz")).toBeUndefined();
  });

  it("resolveDeckCardGroups groupe par section, ordonne, compte, résout", () => {
    const fakeResolve = (name: string): Card | null =>
      name === "Carte A"
        ? ({ id: "a", name, mainType: "Allié" } as Card)
        : null;
    const deck = {
      id: "x",
      name: "X",
      description: "",
      extension: "dofus-mag",
      hero: "H",
      havreSac: "HS",
      cards: [
        { name: "Zone Z", quantity: 1, type: "card", section: "Zones" },
        { name: "Carte A", quantity: 3, type: "card", section: "Alliés" },
        { name: "Carte B", quantity: 2, type: "card", section: "Alliés" },
      ],
    } as const;
    const groups = resolveDeckCardGroups(deck, fakeResolve);
    // Alliés avant Zones (ordre), total Alliés = 5
    expect(groups.map((g) => g.section)).toEqual(["Alliés", "Zones"]);
    expect(groups[0].total).toBe(5);
    expect(groups[0].entries[0]).toMatchObject({
      name: "Carte A",
      quantity: 3,
    });
    expect(groups[0].entries[0].card?.id).toBe("a");
    expect(groups[0].entries[1].card).toBeNull(); // Carte B non résolue
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npx vitest run tests/data/allOfficialDecks.spec.ts`
Expected: FAIL — module `@/data/allOfficialDecks` introuvable.

- [ ] **Step 3: Implémenter `src/data/allOfficialDecks.ts`**

```ts
import { OFFICIAL_DECKS, type OfficialDeck } from "./officialDecks";
import { DOFUS_MAG_DECKS } from "./dofusMagDecks";
import type { Card } from "@/types/cards";

/** Liste unique des decks officiels (starters + Dofus Mag). */
export const ALL_OFFICIAL_DECKS: OfficialDeck[] = [
  ...OFFICIAL_DECKS,
  ...DOFUS_MAG_DECKS,
];

export function getOfficialDeckById(id: string): OfficialDeck | undefined {
  return ALL_OFFICIAL_DECKS.find((d) => d.id === id);
}

/**
 * Slug d'extension → nom d'extension en base, pour épingler la résolution des
 * cartes réimprimées. Dofus-mag non listé = résolution non pinnée (voulu).
 */
export const EXTENSION_NAME_BY_SLUG: Record<string, string> = {
  incarnam: "Incarnam",
  "bonta-brakmar": "Bonta & Brâkmar",
};

export interface ResolvedDeckEntry {
  name: string;
  quantity: number;
  card: Card | null;
}
export interface ResolvedDeckGroup {
  section: string;
  total: number;
  entries: ResolvedDeckEntry[];
}

const SECTION_ORDER = [
  "Alliés",
  "Allié Élémentaire",
  "Sorts",
  "Actions",
  "Équipements",
  "Équipement",
  "Zones",
  "Zone",
  "Salle",
  "Salles",
  "Protecteur",
  "Dofus",
];

function sectionRank(s: string): number {
  const i = SECTION_ORDER.indexOf(s);
  return i === -1 ? SECTION_ORDER.length : i;
}

/**
 * Résout chaque carte d'un deck (nom → Card via `resolve`) et regroupe par
 * section imprimée (repli sur le mainType résolu, sinon « Autres »). Fonction
 * pure : `resolve` est injecté pour la testabilité.
 */
export function resolveDeckCardGroups(
  deck: OfficialDeck,
  resolve: (name: string) => Card | null,
): ResolvedDeckGroup[] {
  const bySection = new Map<string, ResolvedDeckEntry[]>();
  for (const c of deck.cards) {
    const card = resolve(c.name);
    const section = c.section || card?.mainType || "Autres";
    const entry: ResolvedDeckEntry = {
      name: c.name,
      quantity: c.quantity,
      card,
    };
    const bucket = bySection.get(section);
    if (bucket) bucket.push(entry);
    else bySection.set(section, [entry]);
  }
  return [...bySection.entries()]
    .map(([section, entries]) => ({
      section,
      entries,
      total: entries.reduce((s, e) => s + e.quantity, 0),
    }))
    .sort((a, b) => sectionRank(a.section) - sectionRank(b.section));
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npx vitest run tests/data/allOfficialDecks.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Type-check + commit**

```bash
npm run type-check
git add src/data/allOfficialDecks.ts tests/data/allOfficialDecks.spec.ts
git commit -m "feat(official-deck-page): sélecteur partagé + résolution de cartes (pur)"
```

---

## Task 2: Composable d'import `useOfficialDeckImport.ts`

> Extraction (comportement préservé) de la logique d'import de `OfficialDecksView`. Le cœur `buildOfficialDeck` est PUR (injecte `resolve`) et testé ; le composable câble stores + toasts.

**Files:**

- Create: `src/composables/useOfficialDeckImport.ts`
- Test: `tests/composables/useOfficialDeckImport.spec.ts`

- [ ] **Step 1: Test du cœur pur (échoue)**

Créer `tests/composables/useOfficialDeckImport.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { buildOfficialDeck } from "@/composables/useOfficialDeckImport";
import type { Card } from "@/types/cards";
import type { OfficialDeck } from "@/data/officialDecks";

const card = (id: string, name: string, mainType = "Allié"): Card =>
  ({ id, name, mainType }) as Card;

const deck: OfficialDeck = {
  id: "d",
  name: "D",
  description: "desc",
  extension: "dofus-mag",
  hero: "Héros X",
  havreSac: "Havre Sac Y",
  cards: [
    { name: "Carte A", quantity: 2, type: "card" },
    { name: "Fantôme", quantity: 1, type: "card" },
  ],
};

describe("buildOfficialDeck", () => {
  it("résout héros, havre-sac, cartes ; liste les manquants", () => {
    const db: Record<string, Card> = {
      "Héros X": card("h", "Héros X", "Héros"),
      "Havre Sac Y": card("hs", "Havre Sac Y", "Havre-Sac"),
      "Carte A": card("a", "Carte A"),
    };
    const r = buildOfficialDeck(deck, (n) => db[n] ?? null);
    expect(r.heroCard?.id).toBe("h");
    expect(r.havreSacCard?.id).toBe("hs");
    expect(r.deckCards).toHaveLength(1);
    expect(r.deckCards[0]).toMatchObject({ quantity: 2 });
    expect(r.missing).toEqual(["Fantôme"]);
    expect(r.heroMissing).toBe(false);
  });

  it("signale héros/havre-sac manquants", () => {
    const r = buildOfficialDeck(deck, () => null);
    expect(r.heroMissing).toBe(true);
    expect(r.havreMissing).toBe(true);
    expect(r.missing).toContain("Carte A");
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npx vitest run tests/composables/useOfficialDeckImport.spec.ts`
Expected: FAIL — export `buildOfficialDeck` introuvable.

- [ ] **Step 3: Implémenter `src/composables/useOfficialDeckImport.ts`**

```ts
import { ref } from "vue";
import type { Card } from "@/types/cards";
import type { OfficialDeck } from "@/data/officialDecks";
import { EXTENSION_NAME_BY_SLUG } from "@/data/allOfficialDecks";
import { useDeckStore } from "@/stores/deckStore";
import { useToast } from "@/composables/useToast";

export interface BuiltOfficialDeck {
  heroCard: Card | null;
  havreSacCard: Card | null;
  deckCards: { card: Card; quantity: number }[];
  missing: string[];
  heroMissing: boolean;
  havreMissing: boolean;
}

/**
 * Construit (sans effet de bord) les cartes résolues d'un deck officiel.
 * `resolve` est injecté → testable sans store.
 */
export function buildOfficialDeck(
  deck: OfficialDeck,
  resolve: (name: string) => Card | null,
): BuiltOfficialDeck {
  const heroCard = resolve(deck.hero);
  const havreSacCard = resolve(deck.havreSac);
  const deckCards: { card: Card; quantity: number }[] = [];
  const missing: string[] = [];
  for (const c of deck.cards) {
    const card = resolve(c.name);
    if (card) deckCards.push({ card, quantity: c.quantity });
    else missing.push(c.name);
  }
  return {
    heroCard,
    havreSacCard,
    deckCards,
    missing,
    heroMissing: !heroCard,
    havreMissing: !havreSacCard,
  };
}

/** Import d'un deck officiel dans les decks utilisateur (stores + toasts). */
export function useOfficialDeckImport() {
  const deckStore = useDeckStore();
  const toast = useToast();
  const importingId = ref<string | null>(null);

  function isDeckImported(officialDeck: OfficialDeck): boolean {
    return deckStore.decks.some(
      (d) =>
        d.name === officialDeck.name ||
        ((d as any).isOfficial && d.name === officialDeck.name),
    );
  }

  function resolverFor(deck: OfficialDeck) {
    const ext = EXTENSION_NAME_BY_SLUG[deck.extension];
    return (name: string) => deckStore.findCardByName(name, undefined, ext);
  }

  async function importDeck(officialDeck: OfficialDeck): Promise<void> {
    if (importingId.value) return;
    importingId.value = officialDeck.id;
    try {
      // Remplace toute version officielle existante du même nom (réimport).
      const existing = deckStore.decks.filter(
        (d) => (d as any).isOfficial && d.name === officialDeck.name,
      );
      for (const d of existing) if (d.id) deckStore.deleteDeck(d.id);

      const built = buildOfficialDeck(officialDeck, resolverFor(officialDeck));
      const newDeck = {
        id: `official-${officialDeck.id}-${Date.now()}`,
        name: officialDeck.name,
        description: officialDeck.description,
        hero: built.heroCard || null,
        havreSac: built.havreSacCard || null,
        cards: built.deckCards,
        reserve: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOfficial: true,
        extension: officialDeck.extension,
      };
      deckStore.decks.push(newDeck as any);
      deckStore.saveDecks();

      if (built.missing.length === 0) {
        toast.success(
          `Deck « ${officialDeck.name} » importé ! ${built.deckCards.length} cartes.`,
          { title: "Import réussi", duration: 4000 },
        );
      } else {
        toast.warning(
          `Deck « ${officialDeck.name} » importé avec ${built.missing.length} carte(s) manquante(s) : ${built.missing.slice(0, 5).join(", ")}${built.missing.length > 5 ? "…" : ""}`,
          { title: "Import partiel", duration: 6000 },
        );
      }
    } catch (err) {
      toast.error(`Erreur d'import : ${err}`, {
        title: "Erreur",
        duration: 6000,
      });
    } finally {
      importingId.value = null;
    }
  }

  return { importDeck, isDeckImported, importingId };
}
```

- [ ] **Step 4: Lancer → succès + type-check**

Run: `npx vitest run tests/composables/useOfficialDeckImport.spec.ts`
Expected: PASS (2 tests).
Run: `npm run type-check`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useOfficialDeckImport.ts tests/composables/useOfficialDeckImport.spec.ts
git commit -m "feat(official-deck-page): composable d'import (cœur pur testé)"
```

---

## Task 3: Composant `DeckCardGrid.vue` (présentationnel)

**Files:**

- Create: `src/components/deck/DeckCardGrid.vue`
- Test: `tests/components/deck/DeckCardGrid.spec.ts`

- [ ] **Step 1: Test (échoue — composant absent)**

Créer `tests/components/deck/DeckCardGrid.spec.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

const show = vi.fn();
const hide = vi.fn();
vi.mock("@/composables/useCardPreview", () => ({
  useCardPreview: () => ({
    show,
    hide,
    card: { value: null },
    mouseX: { value: 0 },
    mouseY: { value: 0 },
  }),
}));

import DeckCardGrid from "@/components/deck/DeckCardGrid.vue";

const groups = [
  {
    section: "Alliés",
    total: 5,
    entries: [
      {
        name: "Carte A",
        quantity: 3,
        card: { id: "a", name: "Carte A", mainType: "Allié" },
      },
      { name: "Carte B", quantity: 2, card: null },
    ],
  },
];

describe("DeckCardGrid", () => {
  it("affiche les sections, totaux et badges ×N en grille par défaut", () => {
    const w = mount(DeckCardGrid, { props: { groups } });
    expect(
      w.get('[data-testid="deck-card-grid"]').attributes("data-view"),
    ).toBe("grid");
    expect(w.text()).toContain("Alliés");
    expect(w.text()).toContain("5");
    expect(w.text()).toContain("×3");
    expect(w.text()).toContain("Carte B"); // tuile placeholder nommée
  });

  it("bascule en liste", async () => {
    const w = mount(DeckCardGrid, { props: { groups } });
    await w.get('[data-testid="toggle-view"]').trigger("click");
    expect(
      w.get('[data-testid="deck-card-grid"]').attributes("data-view"),
    ).toBe("list");
  });

  it("déclenche le survol-zoom sur une carte résolue", async () => {
    show.mockClear();
    const w = mount(DeckCardGrid, { props: { groups } });
    await w.get('[data-testid="card-tile-a"]').trigger("mouseenter");
    expect(show).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npx vitest run tests/components/deck/DeckCardGrid.spec.ts`
Expected: FAIL — composant introuvable.

- [ ] **Step 3: Implémenter `src/components/deck/DeckCardGrid.vue`**

```vue
<template>
  <div data-testid="deck-card-grid" :data-view="view">
    <div class="mb-4 flex items-center justify-end">
      <button
        type="button"
        class="btn btn-ghost btn-xs gap-2"
        data-testid="toggle-view"
        @click="view = view === 'grid' ? 'list' : 'grid'"
      >
        {{ view === "grid" ? "Vue liste" : "Vue grille" }}
      </button>
    </div>

    <section v-for="g in groups" :key="g.section" class="mb-8">
      <p class="section-rule eyebrow">
        {{ g.section }} ·
        <span class="tabular text-base-content">{{ g.total }}</span>
      </p>

      <!-- GRILLE -->
      <div
        v-if="view === 'grid'"
        class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
      >
        <div
          v-for="e in g.entries"
          :key="e.name"
          class="relative"
          :data-testid="e.card ? `card-tile-${e.card.id}` : undefined"
          @mouseenter="e.card && preview.show(e.card)"
          @mouseleave="preview.hide()"
        >
          <div class="aspect-[7/10] overflow-hidden bg-base-200">
            <img
              v-if="e.card"
              :src="cardImg(e.card)"
              :alt="e.name"
              class="h-full w-full object-cover"
              loading="lazy"
              @error="onImgError"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-base-content/60"
            >
              {{ e.name }}
            </div>
          </div>
          <span
            class="absolute bottom-1 right-1 bg-base-100/90 px-1 font-mono text-[11px] font-bold tabular"
            >×{{ e.quantity }}</span
          >
        </div>
      </div>

      <!-- LISTE -->
      <ul v-else class="mt-3 space-y-1">
        <li
          v-for="e in g.entries"
          :key="e.name"
          class="flex items-baseline text-sm"
          @mouseenter="e.card && preview.show(e.card)"
          @mouseleave="preview.hide()"
        >
          <span :class="e.card ? 'text-base-content/85' : 'text-warning'">{{
            e.name
          }}</span>
          <span class="leader"></span>
          <span class="font-mono tabular text-base-content/70"
            >×{{ e.quantity }}</span
          >
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { Card } from "@/types/cards";
import type { ResolvedDeckGroup } from "@/data/allOfficialDecks";
import { getThumbPath } from "@/utils/imagePaths";
import { useCardPreview } from "@/composables/useCardPreview";

defineProps<{ groups: ResolvedDeckGroup[] }>();

const view = ref<"grid" | "list">("grid");
const preview = useCardPreview();

function cardImg(card: Card): string {
  if (card.imageUrl) return card.imageUrl;
  const full =
    card.mainType === "Héros"
      ? `/images/cards/${card.id}_recto.webp`
      : `/images/cards/${card.id}.webp`;
  return getThumbPath(full);
}

function onImgError(e: Event) {
  const img = e.target as HTMLImageElement;
  if (img.src.includes("/thumbs/")) {
    img.src = img.src.replace("/thumbs/", "/");
    return;
  }
  img.src = "/images/card-back.webp";
}
</script>
```

- [ ] **Step 4: Lancer → succès**

Run: `npx vitest run tests/components/deck/DeckCardGrid.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/deck/DeckCardGrid.vue tests/components/deck/DeckCardGrid.spec.ts
git commit -m "feat(official-deck-page): DeckCardGrid (grille/liste + survol-zoom)"
```

---

## Task 4: Vue `OfficialDeckDetailView.vue` + route

**Files:**

- Create: `src/views/OfficialDeckDetailView.vue`
- Modify: `src/router/index.ts`

> Vue dépendante des stores → vérifiée en preview (Task 6), pas de test unitaire de montage. Câblage déclaratif.

- [ ] **Step 1: Ajouter la route dans `src/router/index.ts`**

Juste après le bloc de la route `officialDecks` (`path: "/decks/official"`), ajouter :

```ts
    {
      path: "/decks/official/:id",
      name: "officialDeckDetail",
      component: () => import("@/views/OfficialDeckDetailView.vue"),
      meta: { guest: true },
    },
```

- [ ] **Step 2: Créer `src/views/OfficialDeckDetailView.vue`**

```vue
<template>
  <div class="space-y-10">
    <router-link to="/decks/official" class="btn btn-ghost btn-sm gap-2">
      ← Decks officiels
    </router-link>

    <div v-if="!deck" class="border border-base-content/15 p-12 text-center">
      <h1 class="font-display text-2xl">Deck introuvable</h1>
      <p class="mt-2 text-base-content/70">Ce deck n'existe pas (ou plus).</p>
    </div>

    <template v-else>
      <!-- Bandeau héros -->
      <header class="flex flex-col gap-6 sm:flex-row">
        <div class="w-40 shrink-0">
          <div class="plate-frame">
            <img
              :src="heroImage"
              :alt="deck.hero"
              class="aspect-[7/10] object-cover object-[50%_18%]"
              @error="onHeroError"
            />
          </div>
          <p class="plate-caption text-center">{{ deck.hero }}</p>
        </div>

        <div class="min-w-0 flex-1">
          <p class="eyebrow text-primary">
            {{ formatExtensionName(deck.extension) }}
          </p>
          <h1 class="mt-2 font-display text-4xl leading-tight">
            {{ deck.name }}
          </h1>
          <p class="mt-2 text-base-content/70">{{ deck.description }}</p>

          <dl class="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div v-if="deck.alignment">
              <dt class="eyebrow">Alignement</dt>
              <dd>{{ deck.alignment }}</dd>
            </div>
            <div>
              <dt class="eyebrow">Havre-Sac</dt>
              <dd>{{ deck.havreSac }}</dd>
            </div>
            <div>
              <dt class="eyebrow">Cartes</dt>
              <dd class="font-mono tabular">{{ cardCount }}</dd>
            </div>
          </dl>

          <span
            v-if="deck.formatNote"
            class="mt-3 inline-flex items-center gap-1 border border-warning/50 bg-warning/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-warning"
            :title="deck.formatNote"
          >
            ⚠ Incohérence magazine
          </span>

          <div class="mt-6">
            <button
              class="btn btn-primary btn-sm gap-2"
              :disabled="importingId === deck.id"
              @click="importDeck(deck)"
            >
              {{
                importingId === deck.id
                  ? "Import en cours…"
                  : "Importer ce deck"
              }}
            </button>
          </div>
        </div>
      </header>

      <!-- Récit (lore / conseil / méta) -->
      <section class="max-w-3xl border-t border-base-content/15 pt-6">
        <DeckMagMeta :deck="deck" />
      </section>

      <!-- Cartes -->
      <section class="border-t border-base-content/15 pt-6">
        <p class="eyebrow mb-4">Cartes du deck</p>
        <DeckCardGrid :groups="groups" />
      </section>
    </template>

    <CardHoverPreview />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import {
  getOfficialDeckById,
  EXTENSION_NAME_BY_SLUG,
  resolveDeckCardGroups,
} from "@/data/allOfficialDecks";
import { useCardStore } from "@/stores/cardStore";
import { useDeckStore } from "@/stores/deckStore";
import { useOfficialDeckImport } from "@/composables/useOfficialDeckImport";
import DeckMagMeta from "@/components/deck/DeckMagMeta.vue";
import DeckCardGrid from "@/components/deck/DeckCardGrid.vue";
import CardHoverPreview from "@/components/card/CardHoverPreview.vue";

const route = useRoute();
const cardStore = useCardStore();
const deckStore = useDeckStore();
const { importDeck, importingId } = useOfficialDeckImport();

const ready = ref(false);
const deck = computed(() => getOfficialDeckById(String(route.params.id)));

const cardCount = computed(
  () => deck.value?.cards.reduce((s, c) => s + c.quantity, 0) ?? 0,
);

const groups = computed(() => {
  if (!deck.value || !ready.value) return [];
  const ext = EXTENSION_NAME_BY_SLUG[deck.value.extension];
  return resolveDeckCardGroups(deck.value, (name) =>
    deckStore.findCardByName(name, undefined, ext),
  );
});

const heroImage = computed(() => {
  if (!deck.value || !ready.value) return "/images/card-back.webp";
  const ext = EXTENSION_NAME_BY_SLUG[deck.value.extension];
  const c = deckStore.findCardByName(deck.value.hero, undefined, ext);
  if (!c) return "/images/card-back.webp";
  if (c.imageUrl) return c.imageUrl;
  return `/images/cards/${c.id}_recto.webp`;
});

function onHeroError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}

function formatExtensionName(ext: string): string {
  const names: Record<string, string> = {
    incarnam: "Incarnam",
    "bonta-brakmar": "Bonta & Brakmar",
    "dofus-mag": "Dofus Mag",
  };
  return names[ext] || ext;
}

onMounted(async () => {
  if (!cardStore.isInitialized) await cardStore.initialize();
  deckStore.initialize();
  ready.value = true;
});
</script>
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/views/OfficialDeckDetailView.vue src/router/index.ts
git commit -m "feat(official-deck-page): vue détail + route /decks/official/:id"
```

---

## Task 5: Câbler la vue liste `OfficialDecksView.vue`

**Files:**

- Modify: `src/views/OfficialDecksView.vue`

> Lien vers la page + retrait de l'expand inline + consommation du sélecteur/composable partagés. Vérifié en preview + e2e + type-check.

- [ ] **Step 1: Imports**

Dans `<script setup>`, remplacer les imports de `OFFICIAL_DECKS`/`DOFUS_MAG_DECKS` (et l'import de `DeckMagMeta` s'il n'est plus utilisé) par :

```ts
import { type OfficialDeck } from "@/data/officialDecks";
import {
  ALL_OFFICIAL_DECKS,
  EXTENSION_NAME_BY_SLUG,
} from "@/data/allOfficialDecks";
import { useOfficialDeckImport } from "@/composables/useOfficialDeckImport";
```

- [ ] **Step 2: Source des decks + suppression du `EXTENSION_NAME_BY_SLUG` local**

Remplacer `const officialDecks = computed(() => [...OFFICIAL_DECKS, ...DOFUS_MAG_DECKS]);` par :

```ts
const officialDecks = computed(() => ALL_OFFICIAL_DECKS);
```

Supprimer la déclaration locale `const EXTENSION_NAME_BY_SLUG: Record<string, string> = { … };` (désormais importée).

- [ ] **Step 3: Lien « Voir le deck » + nom cliquable**

Remplacer le titre `<h3>{{ deck.name }}</h3>` par un lien :

```html
<h3 class="font-display text-xl leading-tight">
  <router-link :to="`/decks/official/${deck.id}`" class="hover:text-primary"
    >{{ deck.name }}</router-link
  >
</h3>
```

Remplacer le bouton « Détails » (toute la balise `<button … @click="toggleDeckDetails(deck.id)"> … Détails </button>`) par :

```html
<router-link
  :to="`/decks/official/${deck.id}`"
  class="btn btn-ghost btn-sm gap-2"
>
  Voir le deck
</router-link>
```

- [ ] **Step 4: Retirer l'expand inline + le code mort**

Supprimer le bloc `<!-- Détails expandables --> <div v-if="expandedDeckId === deck.id" …> … </div>` du template. Dans le script, supprimer `expandedDeckId`, `toggleDeckDetails`, et l'import + usage de `DeckMagMeta` s'ils ne servent plus ailleurs. (Garder `getCardTypeBreakdown`, `getCardCount`, etc.)

- [ ] **Step 5: Remplacer la logique d'import locale par le composable**

Si `OfficialDecksView` garde un bouton « Importer »/« Tout importer », router ses handlers vers le composable :

```ts
const { importDeck, importingId } = useOfficialDeckImport();
```

Brancher le bouton « Importer » d'une carte sur `@click="importDeck(deck)"` et son état désactivé sur `:disabled="importingId === deck.id"`. Conserver « Tout importer » en bouclant `importDeck` sur les decks non importés (ou retirer si hors périmètre — garder le comportement existant le plus simple). Supprimer le `buildAndAddDeck`/`importOfficialDeck` local désormais inutile.

- [ ] **Step 6: Type-check + tests + commit**

Run: `npm run type-check && npx vitest run tests/data tests/components tests/composables`
Expected: aucune erreur de type ; tests verts.

```bash
git add src/views/OfficialDecksView.vue
git commit -m "feat(official-deck-page): liste → lien page détail + sélecteur/import partagés"
```

---

## Task 6: Vérification finale + clôture

- [ ] **Step 1: Suite complète + type-check + build**

Run: `npm run type-check && npx vitest run && npm run build`
Expected: type-check OK ; tous les tests verts ; build OK.

- [ ] **Step 2: Preuve visuelle (preview)**

Démarrer le preview (`preview_start` « dev »). Naviguer sur `/decks/official`, cliquer un deck Dofus Mag (ex. Gelées Royales) → vérifier la page : bandeau héros, lore + conseil, grille de cartes avec vignettes + badges ×N, bascule liste, survol-zoom. Vérifier un deck à `formatNote` (badge). Vérifier un starter (Incarnam) : page sans lore mais cartes en grille. Capturer un screenshot (ou snapshot DOM si le screenshot timeout).

- [ ] **Step 3: Commit éventuel des ajustements puis clôture**

Invoquer superpowers:finishing-a-development-branch pour décider de l'intégration (merge master / PR).

---

## Self-Review

- **Couverture spec :** route `/decks/official/:id` (T4) ✓ ; tous decks officiels (T1 `ALL_OFFICIAL_DECKS`) ✓ ; grille vignettes + bascule liste + survol-zoom (T3) ✓ ; tous les champs / récit (T4 via `DeckMagMeta`) ✓ ; bandeau héros + import (T2/T4) ✓ ; badge incohérence magazine (T4) ✓ ; lien depuis la liste + retrait expand (T5) ✓ ; id inconnu → écran dédié (T4) ✓ ; carte non résolue → tuile placeholder (T3) ✓ ; tests `allOfficialDecks`/`buildOfficialDeck`/`DeckCardGrid` (T1/T2/T3) ✓ ; preview (T6) ✓.
- **Placeholders :** aucun ; code complet par étape.
- **Cohérence des types :** `ResolvedDeckGroup`/`ResolvedDeckEntry` définis en T1, consommés en T3/T4 ; `buildOfficialDeck`/`useOfficialDeckImport` définis en T2, consommés en T4/T5 ; `EXTENSION_NAME_BY_SLUG` déplacé en T1, consommé en T2/T4/T5 ; `CardHoverPreview` monté dans la vue (T4) car le layer n'est pas global.
- **Note :** la résolution dofus-mag reste non pinnée (pas d'entrée dans `EXTENSION_NAME_BY_SLUG`) — comportement voulu, identique à l'existant.
