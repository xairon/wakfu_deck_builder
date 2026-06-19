# Deck builder rework — design

**Date:** 2026-06-19
**Status:** Direction chosen (multi-agent judge panel + synthesis). Spec covers the FIRST SLICE in detail; later slices are a roadmap.

## Context & goal

The user wants the deck builder ("atelier de deck") reworked into a practical, ergonomic, beautiful module. Three explicit asks:

1. **Zoom a card to read it fully BEFORE adding it** to the deck.
2. **Advanced filters**: by extension, by level (range), by force (range), by **keyword in the effect text**.
3. Overall **polished, ergonomic UI**.

Today `DeckBuilderView.vue` is a **905-line monolith** with a two-pane layout (gallery left, sticky deck sidebar right at ≥xl), only **3 filters** (type/element/rarity), and **no card zoom** — clicking a tile immediately calls `addToDeck()` (the accidental-add trap). Much of what's needed already exists in the **collection** module and is reusable.

## Chosen direction (decided by judge panel, not preference)

A 4-lens adversarial panel (ergonomics / mobile / implementation-risk / design-fidelity) + a synthesis agent evaluated three directions. Verdict:

**Direction A "L'Atelier à deux pupitres" (two-pane) as the skeleton, grafted with direction C's key idea (reading as a _state_, not a modal).**

- A won 2/4 lenses (effort/risk **9**, design **8**) and had **no weak lens** (floor 7). Decisive: the two-pane layout **already exists** in `DeckBuilderView.vue` and `CardZoomModal.vue` is **already** Grimoire-faithful — minimal risk, maximal reuse, ~676 tests protected (business logic untouched).
- C won ergonomics + design but **collapsed on mobile (4)** and effort/risk (4) — its "permanent reader" degrades to a full-screen modal on mobile anyway, and it requires rewriting the reader + abandoning the image gallery.
- B won only mobile (8) but needs a **bottom-sheet primitive absent from the design system** + a 3-pane layout that compresses at 1280px.

**The graft (neutralises A's only weakness — reading-in-a-modal):** on desktop (≥xl), the loupe/click opens the `CardZoomModal` content mounted as a **non-modal pinned panel** at the top of the right pupitre (sticky, above the deck). The focused card stays readable at full size **while you stack 1→3 copies**, and the deck stays visible below. Below xl / mobile, the same component falls back to a full-screen modal with a pinned `Ajouter / ×3 / Réserve` footer (tabs + drawer + FAB — no new primitive). The accidental-add trap (`@click=addToDeck` on the tile) is removed; adding goes through the loupe/footer or an explicit `+`.

## Reusable assets (from codebase analysis — do NOT reinvent)

- **`CardZoomModal.vue`** (`src/components/card/`) — props `{ card, open }`, emits `close`. Shows image (handles HeroCard recto/verso), stats, effects via `highlightEffectHtml`, keywords, errata, flavor. Grimoire-faithful. Reuse for the zoom; later gains a `variant: 'modal' | 'panel'` prop for the pinned panel.
- **`CollectionFilters.vue`** (`src/components/collection/`) — already offers search, extension, mainType, subType, rarity, element, **level range (minLevel/maxLevel → stats.niveau.value)**, **PA range (minCost/maxCost → stats.pa)**, sort (number/rarity/type/element/force + asc/desc). Pattern: local refs synced to props via `watch` + one `update:` emit per filter.
- **`memoizedFilter` / `memoizedSort`** (`CollectionView.vue` ~lines 762–951) — the authoritative filter/sort engine (12-arg, cache capped at 50). **Extract to `src/composables/useCardFilter.ts`** for reuse.
- **`matchesSearch`** (`src/utils/text.ts`) — accent/case-insensitive substring match. Reuse for the effect-text predicate.
- **`highlightEffectHtml` / `cleanEffectText`** (`src/utils/effectText.ts`) — effect rendering.
- **`deckStore`** — `addCard(card, qty=1, isReserve=false)`, `removeCard`, `moveCardZone`, `setHero`, `setHavreSac`, `removeHero/HavreSac`, `clearDeck`; getters `cardCount`, `reserveCount`, `isValid`, `elementDistribution`, `typeDistribution`, `costCurve`. Enforces max 3 copies (1 if Unique, counted main+reserve), main ≤ 48, reserve ≤ 12.
- **`validateDeck` / `DECK_RULES`** — source of truth: 1 Héros, 1 Havre-Sac, exactly 48 main, reserve exactly 0 or 12, max 3 (1 if Unique).

## Design-system constraints ("Grimoire")

Editorial flat aesthetic. **No gradients** (except `.sheen` foil), **no shadows** beyond `.plate-frame` lift + `.seal`, **border-radius ~0** (≤3px on plates, full only on `.seal`). Structure via **hairlines** (`border-base-content/15` faint, `/80` strong). Fonts: `font-display` (Fraunces ~440) for headings/card names, `font-mono` (Space Mono) **tabular** for all numbers/labels/buttons, `font-sans` (Hanken Grotesk) body. Accent: cinnabar `#F04E22` (single dominant). Element colours via `--el-*` / inline `--spine`. Buttons: `.btn` mono uppercase. Modals: DaisyUI `<dialog>` + `modalPop`, `border-base-content/30`, `bg-base-100`. Reuse classes: `.plate-frame`, `.sheen`, `.plate-caption`, `.spine`, `.seal`, `.eyebrow`, `.section-rule`, `.contact-sheet`. **Do not** introduce new patterns that break this (no bottom-sheet).

---

## FIRST SLICE (this spec's implementable scope)

**Title:** Advanced filters + zoom-before-add (end the click=add trap).

The smallest slice that delivers the user's two central asks, kills the dangerous accidental-add, reuses `CardZoomModal` as-is, and **does not touch deck business logic** (so the ~676 tests stay green). Orthogonal to the re-layout.

### 1. `useCardFilter` composable

- **Create `src/composables/useCardFilter.ts`** by extracting `memoizedFilter` + `memoizedSort` from `CollectionView.vue` (lines ~762–951), preserving the 50-entry cache cap + `.clear()`.
- Extend the filter signature with **two new predicates**:
  - **Force range** — `minForce`/`maxForce` against `card.stats?.force?.value` (cards without a force value are excluded when a bound is set, matching the existing level-range behaviour).
  - **Effect-text keyword** — `effectQuery`: `card.effects?.some(e => matchesSearch(e.description, effectQuery))`, **and for HeroCard** also `card.recto?.effects` + `card.verso?.effects` (HeroCard has no top-level `card.effects`).
- Element comparison stays **lowercase-normalised** (feu/eau/air/terre/neutre).
- **`CollectionView.vue` is refactored to consume the composable** (no behaviour change — characterize/verify its existing filtering first).

### 2. Extend `CollectionFilters.vue`

- Add **force range** (`minForce`/`maxForce`, number|null) inputs beside the existing level inputs, and an **effect-text** input (`effectQuery`, string) beside the name search (eyebrow "Dans les effets"), following the existing local-ref + `watch` + `update:` emit pattern. Extension/level/PA/sort already exist.

### 3. Deck builder: wire filters + zoom-before-add

- In `DeckBuilderView.vue`, replace the 3 inline filters with `CollectionFilters` driven by `useCardFilter` (extension, level range, force range, effect-text keyword + the existing type/element/rarity/sort).
- **Mount `CardZoomModal` on the gallery**: a **loupe `⊕`** button on each tile AND **clicking the tile body** open the modal (read first). The modal gets an **action footer** (`+ Ajouter` / `+ ×3` / `+ Réserve`) wired to `deckStore` via emitted events (keep the modal store-agnostic — parent calls the store), gated by the existing copy/48/reserve limits with a clear disabled reason. Desktop keyboard shortcuts `a`/`z`/`r`/`e` (bonus, desktop-only).
- **Remove `@click=addToDeck` direct on the tile** (the accidental-add trap). Keep an **explicit express `+`** distinct from the body click for fast adding.
- At this slice the reader is the **modal** (the pinned-panel `variant` comes in a later slice).

### Acceptance criteria (first slice)

1. `useCardFilter` produces identical results to the current `CollectionView` filtering for the existing filters (verified), plus force-range and effect-text filtering work (incl. HeroCard recto/verso).
2. In the deck builder, the four requested filters (extension, level range, force range, effect-text keyword) work.
3. Clicking a card in the deck-builder gallery **opens the zoom** (does not add); the modal footer adds (Ajouter/×3/Réserve), respecting limits; an explicit `+` still allows express add. **No path adds on a plain body click.**
4. Deck business logic unchanged: `validateDeck`/`deckStore` untouched; full unit suite green; `vue-tsc` clean.

### Tests (first slice)

- Unit: `useCardFilter` — force range, effect-text (Card + HeroCard), element normalisation, cache cap.
- Component: deck-builder gallery — body click opens zoom (no add); footer Ajouter calls `deckStore.addCard`; express `+` adds; limits disable with reason.
- Regression: `CollectionView` filtering unchanged after extraction.
- Browser: verify on `/deck-builder` (auth bypass per memory) — filter by effect keyword, open a card, read it, add via footer.

---

## Later slices (roadmap, separate specs/plans)

1. **Split the 905-line monolith** into `CardPool` / `DeckPanel` / `DeckCardRow` / `ReserveList`; factor shared `elementColors`/`cardImg`/`onImgError`.
2. **Pinned reading panel (the C graft):** `CardZoomModal` `variant='panel'` mounted non-modal at the top of the right pupitre on ≥xl; persistent focus (↑/↓ moves focus in the gallery; adding doesn't eject focus); deck visible below; <xl falls back to the slice-1 modal.
3. **Styled confirmations + reserve 0/12 continuous:** replace the 2 `window.confirm` with a reusable Grimoire confirm dialog; show reserve 0/12 progressively.
4. **Mobile fallback in the design system:** segmented Bestiaire/Deck tabs, filters drawer, FAB counter, pinned add bar (no bottom-sheet).
5. **Polish:** a11y/focus-trap/keyboard, gallery perf (infinite scroll / virtualization if needed), deck-builder E2E.

## Top risks

- Pinned-panel variant (slice 2) risks layout divergence between modal/panel — one `variant` prop changing only the container, shared body, snapshot both.
- Removing `@click=addToDeck` must leave an obvious add path (loupe/footer + explicit `+`) — cover by E2E.
- Effect-text filter must handle HeroCard (recto/verso) or it silently misses heroes; keep the predicate inside the memoized pipeline + debounce (~150–250ms) for ~1585 cards.
- Extracting `memoizedFilter` touches `CollectionView` (existing consumer) — characterize before moving; replicate the 50-entry cache cap.
- Hover/keyboard shortcuts are desktop bonuses — never depend on hover for a destructive action; mobile uses the pinned add bar.
