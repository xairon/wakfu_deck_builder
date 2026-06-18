# Starter automation v2 — Foundation: manual-effect reminder + re-enable `assistEffects`

**Date:** 2026-06-18
**Status:** Design approved, ready for implementation plan.

## Context

v1 shipped "Cockatrice-style": rules automated (`assist`), card effects resolved
by hand (`assistEffects = false`, forced at `PlayTableView.launch()`). The card-
effect DSL exists and is data-driven (`effects[].compiled`, compiled offline by
`scripts/compileEffects.ts`); at runtime the engine (`createEffectEngine` in
`src/game/rules/effects/engine.ts`) only enqueues **compiled** atoms.

Coverage on the two Incarnam starter decks today (per `scripts/auditStarters.ts`
→ `docs/AUDIT-STARTERS.md`): Feca 9 auto / 13 manual / 9 vanilla; Iop 7 auto /
12 manual / 1 partial / 12 vanilla. ~25 cards across both decks have effects the
DSL does not cover, in tiers: easy "script manuel candidat", "ciblage qualifié /
coût d'activation", and hard "condition de combat / déclencheur continu".

**The problem this spec solves:** if we simply flip `assistEffects` on, an
uncovered effect produces **no atom and silently does nothing** — worse UX than
full-manual, where the player at least knows to act. We need a per-card signal
that flags uncovered effects as "resolve manually" before (and while) we
incrementally automate more of them.

## Goal

Make local assisted games auto-resolve the **already-covered** effects and
**clearly flag the uncovered ones** as manual, via a non-blocking reminder.
Re-enable `assistEffects` for local assisted games. Zero new ops in this
sub-project — it is the safe foundation that de-risks the switch.

## Decomposition (this is sub-project 1 of a sequence)

1. **This spec — Foundation:** manual-effect reminder UX + re-enable `assistEffects`.
2. Tier-1 op sweep: easy "script manuel candidat" ops (produce Resource, "redressez
   tous vos Bouftous", heal-if-in-havreSac, static Géant…). _(own spec/plan)_
3. Tier-2 op sweep: qualified targeting / activation costs. _(own spec/plan)_
4. Hard combat-window / continuous-trigger effects stay manual indefinitely —
   handled by the reminder, out of scope.

## Non-goals

- No new `CompiledEffectOp` / no DSL grammar changes in this sub-project.
- No change to online play (stays `assistEffects` off, trusted-client).
- No change to the tutorial's scripted `assistEffects = false`.
- No blocking/modal prompt — the reminder is non-blocking by decision.
- No per-trigger timing of reminders (entry-time only — see Design §3).

## Design

### 1. Detection (pure, rules layer)

A printed effect is "manual / uncovered" iff it has no compiled form. Add to
`src/game/rules/effects/dsl.ts`, beside `printedEffects`:

```ts
/** Effets IMPRIMÉS non automatisés (aucune forme compilée) → à jouer à la main. */
export function manualEffects(card: Card | null): CardEffect[] {
  return printedEffects(card).filter((e) => !e.compiled);
}
```

`printedEffects` already excludes rulings/erratas (`e.kind`) and empty
descriptions, and handles the hero recto fallback. Static abilities, combat
triggers, onTurnStart, onTap etc. all carry `compiled` when recognized, so
`!e.compiled` is precisely "no recognized automation of any trigger".

Export `manualEffects` from `src/game/rules` (barrel) so the store/engine and
the audit can use it. (Refactoring `auditStarters.ts` to consume it is optional
polish; it reads raw JSON, not `Card`, so reuse is partial — skip if it adds
friction.)

### 2. Reminder state (engine-owned)

The reminder is interaction state about effects the engine does _not_ resolve, so
it lives alongside the other interaction state in `createEffectEngine`:

```ts
interface ManualReminder {
  id: string;
  seat: Seat;
  cardName: string;
  text: string;
}
const manualReminders = ref<ManualReminder[]>([]);
let reminderSeq = 0;

/** Note les effets non automatisés d'une carte (rappel manuel non bloquant). */
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

`reset()` also clears `manualReminders.value = []`. The id is a local counter
(no `Date.now`/`Math.random` needed). Reminders persist until dismissed or reset
(they are "you still need to do this"); they are NOT auto-cleared on turn change
in this sub-project.

Returned from the factory and re-exported by the store: `manualReminders`,
`noteManualEffects`, `dismissManualReminder`.

### 3. Surfacing (timing-agnostic, entry-time)

For an uncovered effect we do not know its trigger (it didn't compile), so we
cannot time the reminder per-trigger. We surface it when the card **enters play
or an Action is played** — the moment the player commits it — listing its manual
effects for the player to apply per their condition. Call sites:

- `queueArrivalEffects(seat, card, sourceId)` (engine): after handling compiled
  arrival atoms, call `noteManualEffects(seat, card)`. This is the chokepoint for
  allies/cards entering play AND for uncovered Actions (an uncovered Action has no
  `playEffects` atoms, so `playFromHand` falls through to `queueArrivalEffects`).
- `playFromHand` Action branch (store): a **partial** Action (some atoms compiled,
  some not) takes the `actionAtoms.length > 0` path and skips
  `queueArrivalEffects`. To cover it, also call `engine.noteManualEffects(seat,
card)` in that branch. (Rare on starters — only robustness.)

`noteManualEffects` is gated by `isAssistEffects()`, so nothing fires in v1
manual mode. Tap-power activation and onTurnStart uncovered effects are NOT
separately flagged in this sub-project (no regression vs today — they were
silently manual before too); entry-time coverage is the improvement.

### 4. UI

- New component `src/components/game/ManualEffectReminders.vue` (the play board
  components live in `src/components/game/`): renders `store.manualReminders` as a
  small non-blocking stack on the board — each item shows `cardName` + `text` + a **Fait** button
  calling `store.dismissManualReminder(id)`. Styled to match the dark-felt board
  (do not theme-convert — see memory `play-board-intentional-darkfelt-and-keyboard`).
- Mounted in `PlayTableView.vue` near the other board overlays (`TurnBanner`,
  `CardPreviewLayer`, …).
- The existing static topbar hint (`PlayTableView.vue:265`,
  `data-testid="topbar-effects-manual-hint"`): keep it shown only when
  `assistEffects` is OFF (its current `!store.assistEffects` guard already does
  this) — the per-card stack replaces it when ON. No change needed there beyond
  verifying it hides when ON.

### 5. Re-enable `assistEffects`

`PlayTableView.launch()` currently sets `store.assistEffects = false` (v1). For
local assisted games (hot-seat + starter), remove that forced-off so the default
(`true`) applies. Online (`connectOnline`) already runs with `assist`/effects off
independently; the tutorial sets its own `false` in `tutorialStore` — both
unaffected. Net: a local assisted table now auto-resolves covered effects and
shows manual reminders for the rest.

### 6. Tests

- **Unit (engine):** extend the isolated `engine.spec.ts` or the
  `effectPipeline.spec.ts` harness — a card with an uncovered printed effect
  entering play pushes a `manualReminders` entry; a fully-covered card pushes
  none; a vanilla card pushes none; `dismissManualReminder` removes it;
  `isAssistEffects()` false → no reminders; `reset()` clears them.
- **Unit (rules):** `manualEffects(card)` returns printed-uncovered effects only
  (excludes compiled, rulings, empty).
- **Integration risk (must manage):** flipping `assistEffects` on at launch
  changes what the **26 Playwright e2e + table unit tests** observe (covered
  effects now auto-resolve; the topbar manual hint no longer shows on the assisted
  table). The plan MUST run `npm run build && npm run test:e2e` and update the
  affected table specs' expectations, keeping CI green.
- **Gates:** `npm run type-check` + `npx vitest run` + e2e.

### 7. Browser verification

Per memory `testing-play-table-in-preview`: launch `/play/table` (auth bypass via
`pinia._s`, fake decks), start an assisted hot-seat game, play a starter card with
a covered effect (auto-resolves) and one with an uncovered effect (reminder
appears, Fait dismisses it). Screenshot as proof.

## Acceptance criteria

1. `manualEffects(card)` returns exactly the printed effects with no `compiled` form.
2. In a local assisted game (`assistEffects` ON), a card with an uncovered effect
   entering play produces a non-blocking reminder showing its text; Fait dismisses it.
3. Fully-covered and vanilla cards produce no reminder; covered effects still
   auto-resolve exactly as before.
4. `assistEffects` is ON for local assisted games, OFF for online and tutorial.
5. The old static topbar hint shows only when `assistEffects` is OFF.
6. `npm run type-check`, `npx vitest run`, and the e2e suite are all green;
   reminders verified in the browser.
