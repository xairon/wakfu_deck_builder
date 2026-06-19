# Deck Builder — Filters + Zoom-Before-Add (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the deck builder advanced filters (extension, level range, force range, keyword-in-effect-text) and let the user zoom a card to read it fully before adding it — ending the current "click a tile = instantly add" trap.

**Architecture:** Extract the collection's `memoizedFilter`/`memoizedSort` into a shared `useCardFilter` composable, extend it with force-range + effect-text predicates, and reuse it + an extended `CollectionFilters` in the deck builder. Reuse `CardZoomModal` (Grimoire-faithful card detail) as the zoom; give it an optional `#actions` slot so the deck builder can inject Add/×3/Reserve buttons without coupling the modal to the deck store. The deck-builder gallery tile: body-click + a loupe button open the zoom (read), and a distinct explicit `+` does the express add.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Pinia, `@vueuse/core` `useMemoize`, Tailwind + DaisyUI ("Grimoire" theme), Vitest 3 + @vue/test-utils, `vue-tsc` gate.

**Spec:** `docs/superpowers/specs/2026-06-19-deck-builder-rework-design.md` (first-slice scope).

---

## File Structure

- **Create** `src/composables/useCardFilter.ts` — the shared filter/sort engine: `filterCards(cards, criteria)` + `sortCards(...)` (memoized, cache cap 50), extended with `minForce`/`maxForce` + `effectQuery`. One clear responsibility: turn a card list + criteria into a filtered/sorted list. Pure of any view.
- **Create** `src/composables/__tests__/useCardFilter.spec.ts` — unit tests.
- **Modify** `src/views/CollectionView.vue` — replace its inline `memoizedFilter`/`memoizedSort` with `useCardFilter` (no behaviour change for existing filters).
- **Modify** `src/components/collection/CollectionFilters.vue` — add force-range (`minForce`/`maxForce`) + `effectQuery` inputs, following its existing prop/emit/local-ref/watch pattern.
- **Modify** `src/components/card/CardZoomModal.vue` — add an optional `#actions` slot in the fiche footer (backward compatible: no slot = unchanged).
- **Modify** `src/views/DeckBuilderView.vue` — drive the pool with `useCardFilter` + `CollectionFilters` (4 new filters); body-click + loupe open `CardZoomModal` with an injected add footer; keep an explicit express `+`; **remove `@click="addToDeck"` on the tile**.
- **Create** `src/components/collection/__tests__/CollectionFilters.spec.ts` — emit tests for the 2 new filters.

---

### Task 1: `useCardFilter` composable (extract + extend)

**Files:**

- Create: `src/composables/useCardFilter.ts`
- Create: `src/composables/__tests__/useCardFilter.spec.ts`
- Reference (read, do not yet edit): `src/views/CollectionView.vue` (`memoizedFilter`/`memoizedSort`, ~lines 762–951), `src/utils/text.ts` (`matchesSearch`), `src/types/cards.ts` (`Card`, `HeroCard` recto/verso).

- [ ] **Step 1: Read the current engine.** Open `CollectionView.vue` and copy the EXACT bodies of `memoizedFilter` and `memoizedSort` (the 12-arg filter: cards, query, extension, mainType, subType, rarity, element, minLvl, maxLvl, minCst, maxCst, hideNotOwned; and the sort). Note the element lowercase-normalisation and the `useMemoize` cache-cap-at-50 + `.clear()` pattern.

- [ ] **Step 2: Write the failing tests** in `src/composables/__tests__/useCardFilter.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterCards, type FilterCriteria } from "../useCardFilter";
import {
  createMockAllyCard,
  createMockHeroCard,
  createMockActionCard,
} from "tests/factories/card";

const base: FilterCriteria = {
  query: "",
  extension: "",
  mainType: "",
  subType: "",
  rarity: "",
  element: "",
  minLevel: null,
  maxLevel: null,
  minCost: null,
  maxCost: null,
  minForce: null,
  maxForce: null,
  effectQuery: "",
  hideNotOwned: false,
  ownedIds: new Set<string>(),
};

describe("useCardFilter — filterCards", () => {
  it("force range : ne garde que les cartes dont la force est dans [min,max]", () => {
    const weak = createMockAllyCard({
      id: "w",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 2, element: "Feu" },
      },
    });
    const strong = createMockAllyCard({
      id: "s",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 9, element: "Feu" },
      },
    });
    const out = filterCards([weak, strong], { ...base, minForce: 5 });
    expect(out.map((c) => c.id)).toEqual(["s"]);
  });

  it("force range : exclut les cartes sans valeur de force quand une borne est posée", () => {
    const noForce = createMockActionCard({ id: "a" }); // pas de stats.force
    const withForce = createMockAllyCard({
      id: "b",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 4, element: "Feu" },
      },
    });
    const out = filterCards([noForce, withForce], { ...base, minForce: 1 });
    expect(out.map((c) => c.id)).toEqual(["b"]);
  });

  it("effectQuery : filtre sur le texte d'effet (insensible casse/accents)", () => {
    const hit = createMockAllyCard({
      id: "h",
      effects: [{ description: "Piochez une carte." }],
    });
    const miss = createMockAllyCard({
      id: "m",
      effects: [{ description: "Gagnez 1 XP." }],
    });
    const out = filterCards([hit, miss], { ...base, effectQuery: "piochez" });
    expect(out.map((c) => c.id)).toEqual(["h"]);
  });

  it("effectQuery : pour un Héros, cherche dans recto/verso (pas card.effects)", () => {
    const hero = createMockHeroCard({ id: "hero" });
    hero.recto = { ...hero.recto, effects: [{ description: "Trêve sacrée." }] };
    const out = filterCards([hero], { ...base, effectQuery: "treve" });
    expect(out.map((c) => c.id)).toEqual(["hero"]);
  });
});
```

- [ ] **Step 3: Run to verify it fails.** `npx vitest run src/composables/__tests__/useCardFilter.spec.ts` → FAIL (module not found).

- [ ] **Step 4: Implement `src/composables/useCardFilter.ts`.** Move the `memoizedFilter`/`memoizedSort` logic out of `CollectionView`. Define a `FilterCriteria` interface (the 12 existing fields + `minForce`/`maxForce`/`effectQuery`), keep the `useMemoize` cache with the **same 50-entry cap + `.clear()`**, and add the two predicates. Skeleton (fill the existing predicates verbatim from Step 1):

```ts
import { useMemoize } from "@vueuse/core";
import type { Card } from "@/types/cards";
import { matchesSearch } from "@/utils/text";

export interface FilterCriteria {
  query: string;
  extension: string;
  mainType: string;
  subType: string;
  rarity: string;
  element: string;
  minLevel: number | null;
  maxLevel: number | null;
  minCost: number | null;
  maxCost: number | null;
  minForce: number | null;
  maxForce: number | null;
  effectQuery: string;
  hideNotOwned: boolean;
  ownedIds: Set<string>;
}

/** Effets imprimés d'une carte, Héros inclus (effets dans recto/verso). */
function cardEffectTexts(card: Card): string[] {
  const out: string[] = [];
  for (const e of (card as { effects?: { description?: string }[] }).effects ??
    [])
    if (e?.description) out.push(e.description);
  const hero = card as {
    recto?: { effects?: { description?: string }[] };
    verso?: { effects?: { description?: string }[] };
  };
  for (const face of [hero.recto, hero.verso])
    for (const e of face?.effects ?? [])
      if (e?.description) out.push(e.description);
  return out;
}

const memoFilter = useMemoize((cards: Card[], c: FilterCriteria): Card[] =>
  cards.filter((card) => {
    // ── predicates existants (à recopier depuis CollectionView, lignes ~762-951) :
    //    query (matchesSearch name+subTypes), extension, mainType, subType, rarity,
    //    element (lowercase-normalisé), minLevel/maxLevel (stats.niveau.value),
    //    minCost/maxCost (stats.pa), hideNotOwned (ownedIds).
    // ── NOUVEAUX predicates :
    const force = card.stats?.force?.value;
    if (c.minForce != null && (force == null || force < c.minForce))
      return false;
    if (c.maxForce != null && (force == null || force > c.maxForce))
      return false;
    if (
      c.effectQuery &&
      !cardEffectTexts(card).some((t) => matchesSearch(t, c.effectQuery))
    )
      return false;
    return true;
  }),
);

export function filterCards(cards: Card[], c: FilterCriteria): Card[] {
  if ((memoFilter.cache as Map<unknown, unknown>).size > 50) memoFilter.clear();
  return memoFilter(cards, c);
}

// sortCards: move memoizedSort here unchanged (same signature/cache cap).
```

(Implementer: paste the real existing predicate bodies for the 12 original fields from Step 1 — do not approximate them; the two NEW predicates are shown above. Keep `sortCards` identical to the current `memoizedSort`.)

- [ ] **Step 5: Run to verify it passes.** `npx vitest run src/composables/__tests__/useCardFilter.spec.ts` → PASS (4). Adjust the factory `stats` overrides if `createMockAllyCard` shapes differ (read `tests/factories/card.ts`).

- [ ] **Step 6: Refactor `CollectionView.vue` to consume `useCardFilter`.** Replace its inline `memoizedFilter`/`memoizedSort` calls with `filterCards`/`sortCards`, passing the new fields as `null`/`""` (collection UI doesn't expose force/effect yet — behaviour unchanged). Run the FULL suite + type-check.

Run: `npm run type-check` then `npx vitest run`
Expected: clean + all green (collection filtering unchanged).

- [ ] **Step 7: Commit.**

```bash
git add src/composables/useCardFilter.ts src/composables/__tests__/useCardFilter.spec.ts src/views/CollectionView.vue
git commit -m "refactor(filters): extract useCardFilter; add force-range + effect-text predicates"
```

---

### Task 2: Extend `CollectionFilters.vue` (force range + effect-text)

**Files:**

- Modify: `src/components/collection/CollectionFilters.vue`
- Create: `src/components/collection/__tests__/CollectionFilters.spec.ts`

- [ ] **Step 1: Read** `CollectionFilters.vue` to learn its exact pattern: each filter has a local `ref` synced from a prop via `watch`, an `emit('update:xxx', value)`, and an `emitXxx()` handler. Note where the level (`minLevel`/`maxLevel`) and PA (`minCost`/`maxCost`) number inputs live.

- [ ] **Step 2: Write the failing emit test** `src/components/collection/__tests__/CollectionFilters.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CollectionFilters from "../CollectionFilters.vue";

const requiredProps = {
  extensions: [],
  mainTypes: [],
  subTypes: [],
  rarities: [],
  elements: [],
  searchQuery: "",
  selectedExtension: "",
  hideNotOwned: false,
  selectedSortField: "number",
  isDescending: false,
  selectedMainType: "",
  selectedSubType: "",
  selectedRarity: "",
  selectedElement: "",
  minLevel: null,
  maxLevel: null,
  minCost: null,
  maxCost: null,
  minForce: null,
  maxForce: null,
  effectQuery: "",
};

describe("CollectionFilters — filtres ajoutés", () => {
  it("émet update:effectQuery quand on tape un mot-clé d'effet", async () => {
    const w = mount(CollectionFilters, { props: requiredProps });
    const input = w.get('[data-testid="filter-effect-query"]');
    await input.setValue("piochez");
    expect(w.emitted("update:effectQuery")?.at(-1)).toEqual(["piochez"]);
  });

  it("émet update:minForce / update:maxForce", async () => {
    const w = mount(CollectionFilters, { props: requiredProps });
    await w.get('[data-testid="filter-min-force"]').setValue("3");
    await w.get('[data-testid="filter-max-force"]').setValue("8");
    expect(w.emitted("update:minForce")?.at(-1)).toEqual([3]);
    expect(w.emitted("update:maxForce")?.at(-1)).toEqual([8]);
  });
});
```

- [ ] **Step 3: Run to verify it fails.** `npx vitest run src/components/collection/__tests__/CollectionFilters.spec.ts` → FAIL (inputs missing).

- [ ] **Step 4: Add the inputs.** Following the file's existing pattern, add props `minForce: number | null`, `maxForce: number | null`, `effectQuery: string` (with defaults), local refs + `watch` + `emit('update:minForce'|'update:maxForce'|'update:effectQuery', ...)`. Render:

  - an effect-text input beside the name search, with an `.eyebrow` label "Dans les effets" and `data-testid="filter-effect-query"`;
  - two number inputs beside the level range, `data-testid="filter-min-force"` / `filter-max-force"`, parsing to `number | null` exactly like the level inputs do.
    Match the existing classes (`input input-bordered`, `select`, mono labels).

- [ ] **Step 5: Run to verify it passes + type-check.** `npx vitest run src/components/collection/__tests__/CollectionFilters.spec.ts` → PASS; `npm run type-check` clean. Update `CollectionView.vue`'s `<CollectionFilters>` usage to pass/bind the 3 new props (force from new refs, effectQuery) and wire the `update:` handlers into its `filterCards` criteria — or pass them inert (`:min-force="null"` etc.) if not surfacing in the collection yet. (Surfacing in the collection too is free value and keeps props non-optional; prefer wiring them.)

- [ ] **Step 6: Commit.**

```bash
git add src/components/collection/CollectionFilters.vue src/components/collection/__tests__/CollectionFilters.spec.ts src/views/CollectionView.vue
git commit -m "feat(filters): force range + effect-text inputs in CollectionFilters"
```

---

### Task 3: `CardZoomModal` optional `#actions` slot

**Files:**

- Modify: `src/components/card/CardZoomModal.vue`

- [ ] **Step 1: Read** `CardZoomModal.vue` — confirm the fiche (right) column structure (name/spine header, stats `dl`, effects list, keywords, errata, flavor) and the `{ card, open }` props / `close` emit.

- [ ] **Step 2: Add a footer slot.** At the bottom of the fiche column (after keywords/flavor, inside the scrollable fiche `div`), add:

```vue
<div v-if="$slots.actions" class="mt-4 border-t border-base-content/15 pt-3">
  <slot name="actions" />
</div>
```

This is backward compatible: existing usages (CollectionView) pass no slot → nothing renders. Keep the modal store-agnostic (no deck logic inside).

- [ ] **Step 3: Type-check.** `npm run type-check` → clean. (No test needed for an optional slot; covered by Task 4's deck-builder test.)

- [ ] **Step 4: Commit.**

```bash
git add src/components/card/CardZoomModal.vue
git commit -m "feat(card): optional #actions footer slot in CardZoomModal"
```

---

### Task 4: Deck builder — wire filters + zoom-before-add

**Files:**

- Modify: `src/views/DeckBuilderView.vue`
- Create: `src/views/__tests__/DeckBuilderView.spec.ts`

- [ ] **Step 1: Read** `DeckBuilderView.vue` — locate: the 3 inline filters (`typeFilter`/`elementFilter`/`rarityFilter`) and the `filteredPool` computed; the pool tile `<button>` and its `@click="addToDeck(card)"` (~line 146); `addToDeck`, `deckStore` usage, and `cardStore` for owned quantities; the `canAddCard`-style guard if present (else the over-limit toast in `addToDeck`).

- [ ] **Step 2: Write the failing component test** `src/views/__tests__/DeckBuilderView.spec.ts` (mount with Pinia + stubbed router; seed `cardStore.cards`; assert zoom-before-add behaviour). Concretely:

```ts
import { setActivePinia, createPinia } from "pinia";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import DeckBuilderView from "../DeckBuilderView.vue";
import { useCardStore } from "@/stores/cardStore";
import { useDeckStore } from "@/stores/deckStore";
import { createMockAllyCard, createMockDeck } from "tests/factories/card";

describe("DeckBuilderView — zoom avant ajout", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    Element.prototype.scrollIntoView = vi.fn();
  });

  function mountBuilder() {
    const cardStore = useCardStore();
    const ally = createMockAllyCard({ id: "ally-x", name: "Bouftou" });
    cardStore.cards = [ally];
    const deckStore = useDeckStore();
    deckStore.createDeck?.("Test"); // or set currentDeck via the store's real API
    return {
      wrapper: mount(DeckBuilderView, {
        global: { stubs: { RouterLink: true } },
      }),
      deckStore,
      ally,
    };
  }

  it("cliquer une tuile OUVRE le zoom et n'ajoute PAS", async () => {
    const { wrapper, deckStore } = mountBuilder();
    const before = deckStore.cardCount;
    await wrapper.get('[data-testid="pool-tile"]').trigger("click");
    expect(
      wrapper.find('[data-testid="card-zoom"]').exists() ||
        wrapper.html().includes("card-zoom"),
    ).toBe(true);
    expect(deckStore.cardCount).toBe(before); // pas d'ajout
  });

  it("le bouton + express ajoute la carte", async () => {
    const { wrapper, deckStore } = mountBuilder();
    const before = deckStore.cardCount;
    await wrapper.get('[data-testid="pool-add"]').trigger("click");
    expect(deckStore.cardCount).toBe(before + 1);
  });
});
```

(Implementer: adapt the deck-store setup to its real "create/select current deck" API — read `deckStore.ts`. If full mount is too heavy, narrow to a focused sub-component, but the body-click-opens-zoom + express-+-adds assertions are the lock.)

- [ ] **Step 3: Run to verify it fails.** `npx vitest run src/views/__tests__/DeckBuilderView.spec.ts` → FAIL.

- [ ] **Step 4: Implement.**

  - Replace the 3 inline filters with `<CollectionFilters>` bound to refs (extension, level range, force range, effect-text + existing type/element/rarity/sort), and compute the pool via `filterCards`/`sortCards` from `useCardFilter`. Build the dropdown option lists (extensions/types/subtypes/rarities/elements) from `cardStore.cards` as the collection does.
  - Pool tile: keep the existing tile visuals (deck-qty + owned badges, element spine). Set `data-testid="pool-tile"`. Change its click to **open the zoom** (`openZoom(card)` → sets `zoomCard.value` + `zoomOpen.value = true`); add a loupe `⊕` button (`aria-label="Lire la carte"`) that also opens the zoom; add an explicit express add button `data-testid="pool-add"` (`aria-label="Ajouter au deck"`, the small `+`) calling the existing `addToDeck(card)`. **Remove the `@click="addToDeck(card)"` from the tile body.**
  - Mount one `<CardZoomModal :card="zoomCard" :open="zoomOpen" @close="zoomOpen=false" data-testid="card-zoom">` with the `#actions` slot containing `+ Ajouter` / `+ ×3` / `+ Réserve` buttons (mono uppercase `.btn`), each calling `deckStore`/`addToDeck` with the right qty/zone, disabled with a title reason when the copy/48/reserve limit is hit (reuse the existing guard logic from `addToDeck`). Add desktop keyboard shortcuts (`a`=add, `e`=×3, `r`=reserve, `Esc`=close) as a bonus (guard: only when zoom open).

- [ ] **Step 5: Run to verify it passes.** `npx vitest run src/views/__tests__/DeckBuilderView.spec.ts` → PASS. Then full suite + type-check + lint:

Run: `npm run type-check` && `npx vitest run` && `npm run lint`
Expected: clean, all green, no new lint warnings in touched files.

- [ ] **Step 6: Commit.**

```bash
git add src/views/DeckBuilderView.vue src/views/__tests__/DeckBuilderView.spec.ts
git commit -m "feat(deck-builder): advanced filters + zoom-before-add; remove accidental add-on-click"
```

---

### Task 5: Browser verification + final gates

**Files:** none (verification).

- [ ] **Step 1: Gates.** `npm run type-check` && `npx vitest run` && `npm run lint` → all green.
- [ ] **Step 2: Browser** (preview tools; `/deck-builder` requires auth — bypass per memory `testing-play-table-in-preview`: `pinia._s.get('auth').user = {...}` then `$router.push('/deck-builder')`; seed `cardStore.cards` if needed). Verify: (a) filter by **effect keyword** narrows the pool; (b) filter by **force range** and **extension** and **level range** work; (c) clicking a card **opens the zoom and does NOT add**; (d) the zoom footer **Ajouter** adds (respecting limits); (e) the express **+** adds. Capture a screenshot.
- [ ] **Step 3: Finish.** Invoke superpowers:finishing-a-development-branch.

---

## Self-Review

**Spec coverage (first slice):**

- Advanced filters extension/level/force/effect-text → Task 1 (composable predicates) + Task 2 (inputs) + Task 4 (wired into builder). Extension/level already existed in `CollectionFilters`; force + effect-text are the new predicates/inputs.
- Zoom-before-add → Task 3 (`#actions` slot) + Task 4 (tile body/loupe open zoom, footer adds).
- Kill accidental add → Task 4 removes `@click="addToDeck"`.
- No deck-logic change → Tasks touch filters/UI only; `validateDeck`/`deckStore` mutations untouched (full suite must stay green).
- `useCardFilter` extraction + `CollectionView` regression-safety → Task 1 Steps 6.

**Placeholder scan:** New code (composable predicates, filter inputs, slot, tests) is concrete. Two intentional "read the current file then paste the existing predicate bodies / adapt deck-store setup" instructions are explicit and bounded (moving existing verbatim code + adapting to a real store API the implementer reads) — not vague TODOs. No "add error handling"/"etc." placeholders.

**Type consistency:** `FilterCriteria` fields (Task 1) match the props added to `CollectionFilters` (Task 2: `minForce`/`maxForce`/`effectQuery`) and the criteria built in `DeckBuilderView` (Task 4). `filterCards`/`sortCards` names used consistently across Tasks 1, 2, 4. `CardZoomModal` `#actions` slot (Task 3) consumed in Task 4. `data-testid`s (`pool-tile`, `pool-add`, `card-zoom`, `filter-effect-query`, `filter-min-force`, `filter-max-force`) are defined where rendered and asserted in the matching tests.
