# Starter Manual-Effect Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `assistEffects` is ON, auto-resolve the already-covered card effects and surface every _uncovered_ printed effect as a non-blocking "à résoudre à la main" reminder; re-enable `assistEffects` for local assisted games.

**Architecture:** A pure `manualEffects(card)` helper (printed effects with no `compiled` form) feeds an engine-owned reactive `manualReminders` list, populated at card-enters-play / Action-played chokepoints and rendered by a non-blocking board component with a "Fait" dismiss. `PlayTableView` stops forcing `assistEffects = false`.

**Tech Stack:** Vue 3 (`<script setup>`, Pinia composable store), TypeScript ~5.3 (`vue-tsc` gate), Vitest 3 + @vue/test-utils, Playwright e2e. Effect engine in `src/game/rules/effects/engine.ts`.

**Spec:** `docs/superpowers/specs/2026-06-18-starter-manual-reminder-design.md`

---

## File Structure

- **Modify:** `src/game/rules/effects/dsl.ts` — add pure `manualEffects(card)` after `printedEffects` (line 338). Auto-exported via the `export * from "./effects/dsl"` barrel.
- **Modify:** `src/game/rules/effects/engine.ts` — `ManualReminder` type, `manualReminders` ref, `noteManualEffects`/`dismissManualReminder`, wire into `queueArrivalEffects` (line 576) + `reset` (line 679) + factory return (line 686).
- **Modify:** `src/stores/gameStore.ts` — re-export `manualReminders`/`dismissManualReminder` (return ~line 1430); call `engine.noteManualEffects` in the `playFromHand` Action branch (line 756).
- **Create:** `src/components/game/ManualEffectReminders.vue` — non-blocking reminder stack.
- **Modify:** `src/views/PlayTableView.vue` — mount `<ManualEffectReminders />` (near `<TurnBanner />`, line 304); remove forced `store.assistEffects = false` (line 612).
- **Create:** `src/game/rules/effects/__tests__/manualEffects.spec.ts` — pure helper test.
- **Modify:** `src/game/rules/effects/__tests__/engine.spec.ts` — isolation tests for reminders.
- **Modify:** `src/stores/__tests__/effectPipeline.spec.ts` — integration test (uncovered card → store reminder).

---

### Task 1: `manualEffects` pure helper

**Files:**

- Modify: `src/game/rules/effects/dsl.ts` (after `printedEffects`, line 346)
- Create: `src/game/rules/effects/__tests__/manualEffects.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/game/rules/effects/__tests__/manualEffects.spec.ts
import { describe, it, expect } from "vitest";
import { manualEffects } from "../dsl";
import { createMockAllyCard } from "tests/factories/card";

describe("manualEffects", () => {
  it("ne retourne que les effets imprimés sans forme compilée", () => {
    const card = createMockAllyCard({
      effects: [
        {
          description: "Effet auto",
          compiled: { trigger: "onArrive", ops: [] },
        },
        { description: "Effet manuel" },
        { description: "Note de règle", kind: "ruling" },
        { description: "   " },
      ],
    });
    expect(manualEffects(card).map((e) => e.description)).toEqual([
      "Effet manuel",
    ]);
  });

  it("carte vanille ou nulle → liste vide", () => {
    expect(manualEffects(createMockAllyCard({ effects: [] }))).toEqual([]);
    expect(manualEffects(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/rules/effects/__tests__/manualEffects.spec.ts`
Expected: FAIL — `manualEffects` is not exported from `../dsl`.

- [ ] **Step 3: Implement the helper**

In `src/game/rules/effects/dsl.ts`, immediately after the `printedEffects` function (it ends at line 346 with `}`), add:

```ts
/**
 * Effets IMPRIMÉS non automatisés (aucune forme `compiled`) : à résoudre à la
 * main. Même critère que l'audit des starters — un effet « couvert » porte une
 * forme compilée, tout trigger confondu (onArrive/onPlay/onTap/onTurnStart/
 * static/onSelfAttacks). Sert au rappel manuel non bloquant de la table.
 */
export function manualEffects(card: Card | null): CardEffect[] {
  return printedEffects(card).filter((e) => !e.compiled);
}
```

(`Card` and `CardEffect` are already imported at the top of the file; no import change.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/rules/effects/__tests__/manualEffects.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/rules/effects/dsl.ts src/game/rules/effects/__tests__/manualEffects.spec.ts
git commit -m "feat(effects): manualEffects(card) — printed effects with no compiled form"
```

---

### Task 2: Engine reminder state + wiring

**Files:**

- Modify: `src/game/rules/effects/engine.ts`
- Modify: `src/game/rules/effects/__tests__/engine.spec.ts`

- [ ] **Step 1: Write the failing isolation tests**

Append inside the existing `describe("createEffectEngine — isolation …")` block in `src/game/rules/effects/__tests__/engine.spec.ts` (before its closing `});`):

```ts
it("noteManualEffects : pousse un rappel par effet non compilé (assistEffects ON)", () => {
  const engine = createEffectEngine(mockDeps());
  const card = {
    name: "Carte Manuelle",
    mainType: "Allié",
    effects: [
      { description: "Auto", compiled: { trigger: "onArrive", ops: [] } },
      { description: "À jouer à la main" },
    ],
  } as unknown as import("@/types/cards").Card;
  engine.noteManualEffects("A", card);
  expect(engine.manualReminders.value).toHaveLength(1);
  expect(engine.manualReminders.value[0]).toMatchObject({
    seat: "A",
    cardName: "Carte Manuelle",
    text: "À jouer à la main",
  });
});

it("noteManualEffects : ne pousse rien si assistEffects OFF", () => {
  const engine = createEffectEngine(mockDeps({ isAssistEffects: () => false }));
  const card = {
    name: "X",
    mainType: "Allié",
    effects: [{ description: "Manuel" }],
  } as unknown as import("@/types/cards").Card;
  engine.noteManualEffects("A", card);
  expect(engine.manualReminders.value).toHaveLength(0);
});

it("dismissManualReminder retire l'entrée ; reset vide tout", () => {
  const engine = createEffectEngine(mockDeps());
  const card = {
    name: "X",
    mainType: "Allié",
    effects: [{ description: "Manuel" }],
  } as unknown as import("@/types/cards").Card;
  engine.noteManualEffects("A", card);
  const id = engine.manualReminders.value[0].id;
  engine.dismissManualReminder(id);
  expect(engine.manualReminders.value).toHaveLength(0);
  engine.noteManualEffects("A", card);
  engine.reset();
  expect(engine.manualReminders.value).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/rules/effects/__tests__/engine.spec.ts`
Expected: FAIL — `engine.noteManualEffects`/`manualReminders`/`dismissManualReminder` undefined.

- [ ] **Step 3: Add the import**

In `src/game/rules/effects/engine.ts`, add `manualEffects` to the existing `@/game/rules` import block (lines 25-39), e.g. alongside `isTargetingOp`:

```ts
  isTargetingOp,
  manualEffects,
  normElement,
```

- [ ] **Step 4: Add the reminder type + state**

In `engine.ts`, just before `export interface EffectEngineDeps` (line 84), add:

```ts
/** Rappel non bloquant : un effet imprimé non automatisé, à jouer à la main. */
export interface ManualReminder {
  id: string;
  seat: Seat;
  cardName: string;
  text: string;
}
```

Inside `createEffectEngine`, right after the `effectQueue` ref (line 153), add:

```ts
/**
 * Rappels d'effets NON automatisés (assistEffects ON) : la file ne les résout
 * pas, on les signale au joueur qui les applique à la main. Non bloquant.
 */
const manualReminders = ref<ManualReminder[]>([]);
let reminderSeq = 0;

function noteManualEffects(seat: Seat, card: Card | null): void {
  if (!deps.isAssistEffects() || !card) return;
  for (const e of manualEffects(card)) {
    const text = String(e.description ?? "").trim();
    if (!text) continue;
    manualReminders.value = [
      ...manualReminders.value,
      { id: `mr${++reminderSeq}`, seat, cardName: card.name, text },
    ];
  }
}

function dismissManualReminder(id: string): void {
  manualReminders.value = manualReminders.value.filter((r) => r.id !== id);
}
```

- [ ] **Step 5: Wire into `queueArrivalEffects` and `reset`**

In `queueArrivalEffects` (line 576), the function currently begins:

```ts
  function queueArrivalEffects(
    seat: Seat,
    card: Card | null,
    sourceId?: string,
  ): void {
    if (!deps.isAssistEffects() || !card) return;
    for (const atom of arrivalEffects(card)) {
```

Add the reminder note as the first statement after the early-return guard:

```ts
    if (!deps.isAssistEffects() || !card) return;
    noteManualEffects(seat, card);
    for (const atom of arrivalEffects(card)) {
```

In `reset()` (line 679), add the clear line:

```ts
function reset(): void {
  effectChoices.value = [];
  effectTargeting.value = null;
  effectPicking.value = null;
  effectQueue.value = [];
  manualReminders.value = [];
}
```

- [ ] **Step 6: Export from the factory**

In the factory `return { … }` (line 686), add to the "état réactif" group and a new "rappels manuels" line:

```ts
    effectQueue,
    effectPickIds,
    effectTargetIdsList,
    manualReminders,
```

and alongside the other entries:

```ts
    enforceHandLimit,
    noteManualEffects,
    dismissManualReminder,
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx vitest run src/game/rules/effects/__tests__/engine.spec.ts`
Expected: PASS (existing 8 + 3 new = 11 tests).

- [ ] **Step 8: Commit**

```bash
git add src/game/rules/effects/engine.ts src/game/rules/effects/__tests__/engine.spec.ts
git commit -m "feat(engine): non-blocking manualReminders state + noteManualEffects"
```

---

### Task 3: Store re-export + Action wiring + integration test

**Files:**

- Modify: `src/stores/gameStore.ts`
- Modify: `src/stores/__tests__/effectPipeline.spec.ts`

- [ ] **Step 1: Write the failing integration test**

Append a new `describe` block at the end of `src/stores/__tests__/effectPipeline.spec.ts` (before the file's final EOF):

```ts
describe("pipeline d'effets — rappels manuels (effets non couverts)", () => {
  it("une carte à effet non compilé entrant en jeu pousse un rappel", () => {
    const { store, deck, cardStore } = makeEffectSandbox({
      first: "A",
      allAllies: true,
    });
    // effet imprimé NON compilé (pas de champ `compiled`) sur chaque allié
    for (const dc of deck.cards)
      dc.card.effects = [{ description: "Produisez une Ressource." }];
    cardStore.cards = [
      deck.hero!,
      deck.havreSac!,
      ...deck.cards.map((dc) => dc.card),
    ];
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "searchDeck", what: "Allié", dest: "monde" }],
    });
    store.effectPick(store.effectPickIds[0]);
    expect(store.manualReminders.length).toBe(1);
    expect(store.manualReminders[0].text).toBe("Produisez une Ressource.");
    store.dismissManualReminder(store.manualReminders[0].id);
    expect(store.manualReminders.length).toBe(0);
  });

  it("une carte vanille (sans effet imprimé) ne pousse aucun rappel", () => {
    const { store, deck, cardStore } = makeEffectSandbox({
      first: "A",
      allAllies: true,
    });
    for (const dc of deck.cards) dc.card.effects = [];
    cardStore.cards = [
      deck.hero!,
      deck.havreSac!,
      ...deck.cards.map((dc) => dc.card),
    ];
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "searchDeck", what: "Allié", dest: "monde" }],
    });
    store.effectPick(store.effectPickIds[0]);
    expect(store.manualReminders.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/stores/__tests__/effectPipeline.spec.ts`
Expected: FAIL — `store.manualReminders` / `store.dismissManualReminder` undefined.

- [ ] **Step 3: Re-export from the store**

In `src/stores/gameStore.ts`, in the `return { … }` object, after `enqueueEffect: engine.enqueueEffect,` (line 1442), add:

```ts
    enqueueEffect: engine.enqueueEffect,
    manualReminders: engine.manualReminders,
    dismissManualReminder: engine.dismissManualReminder,
```

- [ ] **Step 4: Note manual effects when an Action is played**

In `playFromHand`, the Action branch (line 756) currently reads:

```ts
if (actionAtoms.length) {
  for (const atom of actionAtoms) {
    dispatch(say(seat, `Action résolue — ${card.name} : « ${atom.text} »`));
    engine.enqueueEffect({ seat, cardName: card.name, ops: atom.ops });
  }
} else {
  engine.queueArrivalEffects(seat, card, instanceId);
}
```

Add a `noteManualEffects` call in the `if` branch so a PARTIAL Action (some atoms compiled, some not) still flags its uncovered effects (the `else` branch already notes via `queueArrivalEffects`):

```ts
if (actionAtoms.length) {
  for (const atom of actionAtoms) {
    dispatch(say(seat, `Action résolue — ${card.name} : « ${atom.text} »`));
    engine.enqueueEffect({ seat, cardName: card.name, ops: atom.ops });
  }
  engine.noteManualEffects(seat, card);
} else {
  engine.queueArrivalEffects(seat, card, instanceId);
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/stores/__tests__/effectPipeline.spec.ts`
Expected: PASS (all existing + 2 new).

- [ ] **Step 6: Type-check + full suite**

Run: `npm run type-check` then `npx vitest run`
Expected: type-check clean; all tests green.

- [ ] **Step 7: Commit**

```bash
git add src/stores/gameStore.ts src/stores/__tests__/effectPipeline.spec.ts
git commit -m "feat(store): expose manualReminders; note manual effects on Action play"
```

---

### Task 4: `ManualEffectReminders.vue` component

**Files:**

- Create: `src/components/game/ManualEffectReminders.vue`
- Modify: `src/views/PlayTableView.vue`

- [ ] **Step 1: Create the component**

```vue
<!-- src/components/game/ManualEffectReminders.vue -->
<script setup lang="ts">
import { useGameStore } from "@/stores/gameStore";

const store = useGameStore();
</script>

<template>
  <div
    v-if="store.manualReminders.length"
    class="manual-reminders"
    data-testid="manual-reminders"
  >
    <div class="manual-reminders__title">Effets à résoudre à la main</div>
    <ul class="manual-reminders__list">
      <li
        v-for="r in store.manualReminders"
        :key="r.id"
        class="manual-reminder"
        data-testid="manual-reminder"
      >
        <span class="manual-reminder__text">
          <strong>{{ r.cardName }}</strong> : « {{ r.text }} »
        </span>
        <button
          class="manual-reminder__done"
          data-testid="manual-reminder-done"
          @click="store.dismissManualReminder(r.id)"
        >
          Fait
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.manual-reminders {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 30;
  max-width: 22rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.6rem;
  background: rgba(20, 16, 10, 0.92);
  border: 1px solid rgba(245, 197, 66, 0.5);
  color: #f4ead2;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  font-size: 0.85rem;
}
.manual-reminders__title {
  font-weight: 700;
  color: #f5c542;
  margin-bottom: 0.4rem;
}
.manual-reminders__list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.manual-reminder {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
}
.manual-reminder__text {
  line-height: 1.25;
}
.manual-reminder__done {
  flex: none;
  padding: 0.2rem 0.6rem;
  border-radius: 0.4rem;
  background: #f5c542;
  color: #1a140a;
  font-weight: 700;
  cursor: pointer;
}
.manual-reminder__done:hover {
  background: #ffd45f;
}
</style>
```

- [ ] **Step 2: Mount it in the board**

In `src/views/PlayTableView.vue`, the overlay block (line 304) reads:

```html
<CardPreviewLayer />
<DragLayer />
<TurnBanner />
<TutorialCoach />
```

Add the component after `<TurnBanner />`:

```html
<CardPreviewLayer />
<DragLayer />
<TurnBanner />
<ManualEffectReminders />
<TutorialCoach />
```

And add the import beside the other `@/components/game/*` imports (near line 524):

```ts
import ManualEffectReminders from "@/components/game/ManualEffectReminders.vue";
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS. (`store.manualReminders` / `dismissManualReminder` resolve from Task 3.)

- [ ] **Step 4: Commit**

```bash
git add src/components/game/ManualEffectReminders.vue src/views/PlayTableView.vue
git commit -m "feat(play): ManualEffectReminders board component (non-blocking)"
```

---

### Task 5: Re-enable `assistEffects` for local assisted games

**Files:**

- Modify: `src/views/PlayTableView.vue` (line 612)

- [ ] **Step 1: Remove the forced-off line**

In `src/views/PlayTableView.vue`, the lobby launch handler (line 609-613) reads:

```ts
// v1 « à la Cockatrice » : règles assistées (combat, coûts, légalité,
// limites, victoire) mais effets de cartes résolus À LA MAIN. La file
// d'effets DSL (Lots A–C) reste en backlog v2.
store.assistEffects = false;
store.startMatch(dA, dB, { nameA: nameA.value, nameB: nameB.value });
```

Replace the comment + assignment with the v2 rationale (the store default is already `true`):

```ts
// v2 : effets de cartes AUTOMATISÉS quand ils sont compilés ; les effets non
// couverts apparaissent en rappels « à résoudre à la main » (non bloquants).
// assistEffects reste à sa valeur par défaut (true) pour les parties locales.
store.startMatch(dA, dB, { nameA: nameA.value, nameB: nameB.value });
```

(The online path and `tutorialStore` set their own `assistEffects = false` independently — unchanged.)

- [ ] **Step 2: Run the unit suite + type-check**

Run: `npm run type-check` then `npx vitest run`
Expected: all green (the store default `assistEffects = true` already governs unit tests).

- [ ] **Step 3: Run the e2e suite**

Run: `npm run build && npm run test:e2e`
Expected: PASS. The only e2e that exercises the changed lobby path is "devrait lancer une partie sandbox depuis le lobby" (`e2e/app.spec.ts:237`), which drains passation/mulligan to the "Fin du tour" button and **plays no cards** — so no effect overlays appear. The tutorial and combat e2e use the tutorial path (`assistEffects = false`, unaffected). If a turn-start effect on a seeded card unexpectedly surfaces an overlay and blocks the flow, capture it and adjust that test (e.g. dismiss the overlay); do not revert the re-enable.

- [ ] **Step 4: Commit**

```bash
git add src/views/PlayTableView.vue
git commit -m "feat(play): re-enable assistEffects for local assisted games (v2)"
```

---

### Task 6: Browser verification + final gates

**Files:** none (verification)

- [ ] **Step 1: Final gates**

Run: `npm run type-check` && `npx vitest run` && `npm run lint`
Expected: all green; no new ESLint warnings in the touched files.

- [ ] **Step 2: Browser verify** (memory `testing-play-table-in-preview`)

`preview_start`, navigate `/play/table`, auth bypass via `pinia._s`, inject fake decks, launch a hot-seat game. Play (or `searchDeck`-into-play via console) a card with a covered effect → it auto-resolves; a card with an uncovered printed effect → a reminder appears bottom-right; click **Fait** → it dismisses. Check `preview_console_logs` for errors. `preview_screenshot` as proof.

- [ ] **Step 3: Finish the branch**

Invoke superpowers:finishing-a-development-branch to choose merge/PR/cleanup. Do not touch master until Steps 1-2 pass.

---

## Self-Review

**Spec coverage:**

- Detection `manualEffects` (spec §1) → Task 1.
- Engine reminder state + note/dismiss/reset (spec §2) → Task 2.
- Surfacing at enters-play / Action-played (spec §3) → Task 2 (`queueArrivalEffects`) + Task 3 (Action branch).
- UI component + topbar-hint behavior (spec §4) → Task 4. (Topbar hint at `PlayTableView.vue:265` already guards on `!store.assistEffects`, so it auto-hides when ON — verified during exploration; no edit needed, noted here so it isn't "missing".)
- Re-enable `assistEffects` (spec §5) → Task 5.
- Tests (spec §6): pure (Task 1), engine isolation (Task 2), store integration (Task 3), e2e (Task 5), gates (Task 6).
- Browser verification (spec §7) → Task 6.
- Acceptance criteria 1-6 all map to Tasks 1-6.

**Placeholder scan:** No TBD/TODO. Every code step shows full code. The only discovery-driven step is Task 5 Step 3 (e2e), bounded with the concrete expectation that the sole changed-path test plays no cards and should stay green, plus an explicit "adjust the test, don't revert" instruction — not a vague placeholder.

**Type consistency:** `ManualReminder { id, seat, cardName, text }` defined in Task 2, used identically in Tasks 3 (`store.manualReminders[0].text/.id`) and 4 (`r.id`, `r.cardName`, `r.text`). `noteManualEffects(seat, card)` / `dismissManualReminder(id)` signatures consistent across engine (Task 2), store re-export (Task 3), Action call (Task 3 `engine.noteManualEffects(seat, card)`), and component (`store.dismissManualReminder(r.id)`). `manualEffects(card): CardEffect[]` (Task 1) consumed by `noteManualEffects` (Task 2).
