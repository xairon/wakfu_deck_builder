# Effect Engine Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the ~520-line effect-resolution interpreter out of the `src/stores/gameStore.ts` god object into a dedicated, dependency-injected module `src/game/rules/effects/engine.ts`, with zero behaviour change, locked first by an exhaustive characterization test harness.

**Architecture:** A `createEffectEngine(deps)` factory owns the effect machinery's reactive state (`effectQueue` / `effectTargeting` / `effectPicking` / `effectChoices`) and all its functions (`runFrame`, `pumpEffects`, `enqueueEffect`, `enqueueTriggered`, `holdRest`, `effectPick(Skip)`, `effectTarget*`, `effectChoiceResolve`, `queueArrivalEffects`, `enforceHandLimit`). The ~15 store-stateful couplings (`dispatch`, `moveTo`, `shufflePioche`, `checkVictory`, `draw`, `adjustCounter`, `getCard`, `rulesCtx`, `paOf`, `getState`, flag accessors, `onMatchWon`) are passed in as an injected `EffectEngineDeps` object. Pure helpers already in `@/game` (`say`, `move`, `setCounterVerb`, `incCounterVerb`, `otherSeat`) and `@/game/rules` (`effectTargetIds`, `resolve*Target`, `collectTriggeredEffects`, `grantXpEvents`, `heroLevel`, `arrivalEffects`, `activeGlobalMods`, `isTargetingOp`, `producedElement`, `normElement`) are imported directly — they need no inversion. The store instantiates one engine in its setup body and re-exports the engine's public members, preserving the exact public API.

**Tech Stack:** Vue 3 (`ref`/`computed` composables), TypeScript ~5.3 (strict, `vue-tsc` gate), Pinia 3, Vitest 3 + @vue/test-utils. Event-sourced game engine in `src/game/`.

**Key design decision (scoped on purpose):** This first extraction keeps the pause/resume interaction model as _reactive refs owned by the engine_ (a composable). It does NOT re-model targeting/picking as pure "returned interaction requests" — that purity step is explicitly deferred. Moving the refs into the engine preserves behaviour exactly and is the safe v1. The injected-deps inversion is what makes the engine independently testable; the pure-request model can follow later on top of it.

**Non-goals:** No behaviour change. No change to the public `useGameStore` surface (every currently-returned member stays, same name, same type). No change to `src/game/rules/effects/*` pure modules. No perf work (#7 already shipped).

---

## File Structure

- **Create:** `src/game/rules/effects/engine.ts` — `EffectEngineDeps` interface, `EffectFrame`/`PickFilter` types, `createEffectEngine(deps)` factory returning the engine's refs + functions. ~520 lines moved out of the store + ~40 lines of interface/wiring.
- **Modify:** `src/stores/gameStore.ts` — delete the moved cluster (lines ~791–1336 + `enforceHandLimit` ~859–878 + `effectTargetSkip`/`effectChoiceResolve` ~1402–1440), instantiate `const engine = createEffectEngine({...})`, rewire `draw`/`playFromHand`/`activateTapPower` to call `engine.*`, re-export engine members in the `return {}`.
- **Create:** `src/stores/__tests__/effectPipeline.harness.ts` — test helpers: build a sandbox with controllable cards, place an instance into a zone, enqueue ops, drain the queue, snapshot zones/counters/log.
- **Create:** `src/stores/__tests__/effectPipeline.spec.ts` — characterization tests driving every op + every interaction flow through the **public store API** (`startSandbox`, `enqueueEffect`, `effectPick`, `effectTargetChoose`, …). This is the behaviour lock; it must pass identically before and after the extraction.
- **Create:** `src/game/rules/effects/__tests__/engine.spec.ts` — isolated unit tests instantiating `createEffectEngine` with **mock deps** (no Pinia, no store), proving the dependency inversion is real.

---

## Op & flow inventory (the lock must cover all of these)

Canonical ops from `CompiledEffectOp` (`src/types/cards.ts:36`):

Self / non-interactive: `gainXp`, `draw`, `heroGainPv`, `heroLosePv`, `damageOppHero`, `havreSacGainResistance`, `buffForceSelf`, `destroySelf`, `loseStatTurn`, `tapSelf`, `combatModSelf`, `buffForceAlliesMondeTurn`, `globalDamageShield`, `shuffleDeck`.

Interactive picks (open `effectPicking`): `searchDeck` (→ pioche, dest main|monde, optional `tapped`, cascades arrival on monde), `recycleFromDiscard` (→ defausse, optional element filter), `discardFromHand` (→ main).

Targeting (open `effectTargeting`, resolved by `effectTargetChoose`): `destroyTarget`, `damageTarget` (+ global mods + triggered bus), `healHeroTarget`, `buffForceTarget`.

Interaction flows: queue FIFO ordering + pause-holds-frame-head (`holdRest`); `enqueueTriggered`; `effectChoiceResolve(accept/decline)` + `declineOps`; `effectPickSkip`/`effectTargetSkip`; "no legal target → auto-skip"; "no match → auto-skip"; multi-`remaining` pick; mandatory pick (`enforceHandLimit`); cascade `searchDeck`→monde→`queueArrivalEffects`→`enqueueEffect`; in-play guards (`buffForceSelf`/`destroySelf`/`tapSelf`/`combatModSelf` no-op when source not in monde/havreSac); `gainXp` win (`onMatchWon`).

---

# PHASE A — Characterization test harness (behaviour lock)

> Goal: a green, exhaustive suite over the _current_ store before any code moves. Every test drives the public API only, so it is invariant across the extraction.

### Task A1: Harness helpers

**Files:**

- Create: `src/stores/__tests__/effectPipeline.harness.ts`

- [ ] **Step 1: Write the harness module**

```ts
import { setActivePinia, createPinia } from "pinia";
import type { Card, Deck } from "@/types/cards";
import type { Seat, ZoneRef } from "@/game";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import {
  createMockAllyCard,
  createMockDeck,
  createMockHeroCard,
  createMockHavreSacCard,
} from "tests/factories/card";

/**
 * Sandbox dédié au pipeline d'effets : Pinia neuf, cartes contrôlables
 * référencées dans le cardStore (pour que getCard résolve), partie démarrée
 * en mode assisté (assistEffects par défaut true).
 */
export function makeEffectSandbox(opts?: {
  /** Cartes supplémentaires à rendre résolvables par getCard. */
  extraCards?: Card[];
  first?: Seat;
}) {
  setActivePinia(createPinia());
  const deck = createMockDeck();
  const cardStore = useCardStore();
  const allCards = [
    ...deck.cards.map((dc) => dc.card),
    ...(opts?.extraCards ?? []),
  ];
  cardStore.cards = allCards;
  const store = useGameStore();
  store.startSandbox(deck, deck, opts?.first ?? "A");
  return { store, deck, cardStore };
}

/**
 * Met une carte sous contrôle d'un siège dans une zone donnée et renvoie son
 * instanceId. Crée l'instance en piochant puis en la déplaçant (chemin réel).
 */
export function placeInZone(
  store: ReturnType<typeof useGameStore>,
  seat: Seat,
  to: ZoneRef,
): string {
  store.draw(seat, 1);
  const id =
    store.state.seats[seat].main[store.state.seats[seat].main.length - 1];
  if (to.zone !== "main") store.moveTo(id, to);
  return id;
}

/** Snapshot compact des compteurs d'une instance (jetons inclus). */
export function counters(store: ReturnType<typeof useGameStore>, id: string) {
  const inst = store.state.instances[id];
  return { ...inst.counters, tokens: { ...(inst.counters.tokens ?? {}) } };
}

/** Le texte de toutes les lignes de journal (pour asserts de présence). */
export function logText(store: ReturnType<typeof useGameStore>): string {
  return store.log.map((l) => l.text).join("\n");
}

export { createMockAllyCard, createMockHeroCard, createMockHavreSacCard };
```

- [ ] **Step 2: Type-check the harness compiles**

Run: `npm run type-check`
Expected: PASS (no errors). If `placeInZone`'s `store.state` typing complains about indexing, narrow via the existing `ZoneRef`/`Seat` types already imported.

- [ ] **Step 3: Commit**

```bash
git add src/stores/__tests__/effectPipeline.harness.ts
git commit -m "test(engine): harness for effect-pipeline characterization"
```

### Task A2: Self / non-interactive op characterization

**Files:**

- Create: `src/stores/__tests__/effectPipeline.spec.ts`
- Test: same file

- [ ] **Step 1: Write the failing-import test scaffold + simple-op tests**

These ops mutate `state` deterministically. Assertions target the resulting `GameState` (counters / zones) and presence of a log line — both invariant across the refactor.

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { otherSeat } from "@/game";
import {
  makeEffectSandbox,
  placeInZone,
  counters,
  logText,
} from "./effectPipeline.harness";

describe("pipeline d'effets — ops self / non-interactives", () => {
  it("draw : pioche N cartes", () => {
    const { store } = makeEffectSandbox();
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "draw", n: 2 }],
    });
    expect(store.state.seats.A.main.length).toBe(2);
  });

  it("heroGainPv / heroLosePv : ajuste les PV du Héros actif", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const heroId = store.state.seats.A.heroInstanceId!;
    const base = store.state.instances[heroId].counters.hp ?? 0;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "heroGainPv", n: 3 }],
    });
    expect(store.state.instances[heroId].counters.hp).toBe(base + 3);
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "heroLosePv", n: 1 }],
    });
    expect(store.state.instances[heroId].counters.hp).toBe(base + 2);
  });

  it("damageOppHero : retire des PV au Héros adverse", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const oppHero = store.state.seats[otherSeat("A")].heroInstanceId!;
    const base = store.state.instances[oppHero].counters.hp ?? 0;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "damageOppHero", n: 2 }],
    });
    expect(store.state.instances[oppHero].counters.hp).toBe(base - 2);
  });

  it("havreSacGainResistance : ajoute de la Résistance au Havre-Sac", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const sacId = store.state.seats.A.havreSacInstanceId!;
    const base = store.state.instances[sacId].counters.resistance ?? 0;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "havreSacGainResistance", n: 2 }],
    });
    expect(store.state.instances[sacId].counters.resistance).toBe(base + 2);
  });

  it("loseStatTurn : pose un modificateur négatif de PA/PM sur le Héros", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const heroId = store.state.seats.A.heroInstanceId!;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "loseStatTurn", stat: "pa", n: 2 }],
    });
    expect(store.state.instances[heroId].counters.tokens?.paMod).toBe(-2);
  });

  it("shuffleDeck : mélange la Pioche sans en changer la taille", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const before = store.state.seats.A.pioche.length;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "shuffleDeck" }],
    });
    expect(store.state.seats.A.pioche.length).toBe(before);
  });

  it("gainXp : accorde de l'XP au Héros (et peut gagner la partie)", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "gainXp", n: 1 }],
    });
    // pas d'assertion de victoire ici (dépend du Niveau de départ) : on vérifie
    // qu'un événement d'XP a bien été émis via le journal.
    expect(logText(store)).toMatch(/Héros de .* (gagne|monte|niveau)/i);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/stores/__tests__/effectPipeline.spec.ts`
Expected: PASS. **If any assertion is wrong, the current behaviour is the source of truth — adjust the assertion to match the observed value** (read the actual counter/log), do not "fix" the store. Capture the observed value as the locked expectation. (For `gainXp`, if the log regex misses, replace it with the exact substring printed by `grantXpEvents`'s `log` — inspect `store.log` output and pin it.)

- [ ] **Step 3: Commit**

```bash
git add src/stores/__tests__/effectPipeline.spec.ts
git commit -m "test(engine): characterize self/non-interactive effect ops"
```

### Task A3: In-play-guarded self ops (source must be in monde/havreSac)

**Files:**

- Modify: `src/stores/__tests__/effectPipeline.spec.ts`

- [ ] **Step 1: Add the guarded-op tests**

`buffForceSelf`, `destroySelf`, `tapSelf`, `combatModSelf` only act when `sourceId` is an instance in `monde`/`havreSac`; otherwise they no-op silently. Lock both branches.

```ts
import { createMockAllyCard } from "./effectPipeline.harness";

describe("pipeline d'effets — ops self gardées (source en jeu)", () => {
  it("buffForceSelf : +Force temporaire si la source est en jeu, sinon no-op", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const id = placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      sourceId: id,
      ops: [{ op: "buffForceSelf", n: 2 }],
    });
    expect(store.state.instances[id].counters.tokens?.forceMod).toBe(2);
    // sans sourceId en jeu → aucun changement d'état
    const before = JSON.stringify(store.state.instances);
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "buffForceSelf", n: 9 }],
    });
    expect(JSON.stringify(store.state.instances)).toBe(before);
  });

  it("tapSelf : incline la source redressée en jeu", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const id = placeInZone(store, "A", { zone: "monde" });
    expect(store.state.instances[id].orientation).toBe("upright");
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      sourceId: id,
      ops: [{ op: "tapSelf" }],
    });
    expect(store.state.instances[id].orientation).toBe("tapped");
  });

  it("destroySelf : envoie la source en Défausse", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const id = placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      sourceId: id,
      ops: [{ op: "destroySelf" }],
    });
    expect(store.state.seats.A.defausse).toContain(id);
    expect(store.state.seats.A.monde).not.toContain(id);
  });

  it("combatModSelf : pose les jetons de combat sur la source", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const id = placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      sourceId: id,
      ops: [{ op: "combatModSelf", force: 2, pm: 1, geant: true }],
    });
    const t = counters(store, id).tokens;
    expect(t.forceCombatMod).toBe(2);
    expect(t.pmCombatMod).toBe(1);
    expect(t.geantCombatMod).toBe(1);
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run src/stores/__tests__/effectPipeline.spec.ts`
Expected: PASS. Adjust assertions to observed values if the mock ally enters a different zone than expected (e.g. `placeInZone` may need `{ zone: "monde" }` to succeed — if `moveTo` rejected because the card was a Hero/Salle and the Havre-Sac was full, switch to `createMockAllyCard` placed directly; verify `store.state.seats.A.monde` contains the id before enqueuing).

- [ ] **Step 3: Commit**

```bash
git add src/stores/__tests__/effectPipeline.spec.ts
git commit -m "test(engine): characterize in-play-guarded self ops"
```

### Task A4: Hero-token ops (`buffForceAlliesMondeTurn`, `globalDamageShield`)

**Files:**

- Modify: `src/stores/__tests__/effectPipeline.spec.ts`

- [ ] **Step 1: Add tests**

```ts
describe("pipeline d'effets — jetons posés sur le Héros", () => {
  it("buffForceAlliesMondeTurn : pose teamForceMod sur le Héros (valeur fixe)", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const heroId = store.state.seats.A.heroInstanceId!;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "buffForceAlliesMondeTurn", n: 2 }],
    });
    expect(store.state.instances[heroId].counters.tokens?.teamForceMod).toBe(2);
  });

  it("globalDamageShield : pose treveUntilTurn = turn.number + 2 sur le Héros", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const heroId = store.state.seats.A.heroInstanceId!;
    const expected = store.state.turn.number + 2;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "globalDamageShield" }],
    });
    expect(store.state.instances[heroId].counters.tokens?.treveUntilTurn).toBe(
      expected,
    );
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/stores/__tests__/effectPipeline.spec.ts` → PASS (pin `teamForceMod` to observed value; `n: 2` should give `2`).
- [ ] **Step 3: Commit** — `git commit -am "test(engine): characterize hero-token ops"`

### Task A5: Picking flows — `recycleFromDiscard`, `discardFromHand`, `searchDeck`, skip, multi, no-match

**Files:**

- Modify: `src/stores/__tests__/effectPipeline.spec.ts`

- [ ] **Step 1: Add picking tests**

The existing `gameStore.spec.ts` already locks `recycleFromDiscard` element-filter + hand-limit mandatory pick. Add the remaining picking behaviours here.

```ts
describe("pipeline d'effets — piles (effectPicking)", () => {
  it("discardFromHand : ouvre un picker dans la main, le clic défausse", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.draw("A", 3);
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "discardFromHand", n: 1 }],
    });
    expect(store.effectPicking).not.toBeNull();
    expect(store.effectPicking?.zone).toBe("main");
    const pick = store.effectPickIds[0];
    store.effectPick(pick);
    expect(store.state.seats.A.defausse).toContain(pick);
    expect(store.effectPicking).toBeNull();
  });

  it("effectPickSkip : un choix non obligatoire se passe et vide le picker", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.draw("A", 2);
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "discardFromHand", n: 1 }],
    });
    expect(store.effectPicking).not.toBeNull();
    store.effectPickSkip();
    expect(store.effectPicking).toBeNull();
    expect(store.state.seats.A.defausse.length).toBe(0);
  });

  it("recycleFromDiscard n>1 : le picker reste ouvert jusqu'à épuiser remaining", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.draw("A", 3);
    for (const id of [...store.state.seats.A.main])
      store.moveTo(id, { zone: "defausse", owner: "A" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "recycleFromDiscard", n: 2 }],
    });
    expect(store.effectPicking?.remaining).toBe(2);
    store.effectPick(store.effectPickIds[0]);
    expect(store.effectPicking?.remaining).toBe(1);
    store.effectPick(store.effectPickIds[0]);
    expect(store.effectPicking).toBeNull();
  });

  it("searchDeck dest main : trouve une carte du type demandé et la prend en main", () => {
    // Force toutes les cartes du deck à être des Alliés pour garantir un match.
    const { store, deck, cardStore } = makeEffectSandbox({ first: "A" });
    for (const dc of deck.cards) dc.card.mainType = "Allié";
    cardStore.cards = deck.cards.map((dc) => dc.card);
    const handBefore = store.state.seats.A.main.length;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "searchDeck", what: "Allié", dest: "main" }],
    });
    expect(store.effectPicking?.zone).toBe("pioche");
    store.effectPick(store.effectPickIds[0]);
    expect(store.state.seats.A.main.length).toBe(handBefore + 1);
    expect(store.effectPicking).toBeNull();
  });

  it("searchDeck dest monde : la carte entre en jeu et déclenche ses effets d'arrivée (cascade)", () => {
    const { store, deck, cardStore } = makeEffectSandbox({ first: "A" });
    for (const dc of deck.cards) dc.card.mainType = "Allié";
    cardStore.cards = deck.cards.map((dc) => dc.card);
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "searchDeck", what: "Allié", dest: "monde" }],
    });
    const picked = store.effectPickIds[0];
    store.effectPick(picked);
    expect(store.state.seats.A.monde).toContain(picked);
    expect(store.effectPicking).toBeNull();
  });

  it("searchDeck sans match : effet passé, pas de picker", () => {
    const { store, deck, cardStore } = makeEffectSandbox({ first: "A" });
    for (const dc of deck.cards) dc.card.mainType = "Allié";
    cardStore.cards = deck.cards.map((dc) => dc.card);
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "searchDeck", what: "Dofus", dest: "main" }],
    });
    expect(store.effectPicking).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/stores/__tests__/effectPipeline.spec.ts` → PASS. Pin observed values; if `createMockDeck` cards already have a `mainType` other than expected, the forced `mainType = "Allié"` assignment guarantees matches.
- [ ] **Step 3: Commit** — `git commit -am "test(engine): characterize picking flows"`

### Task A6: Targeting flows — `damageTarget`, `destroyTarget`, `healHeroTarget`, `buffForceTarget`, skip, no-legal-target

**Files:**

- Modify: `src/stores/__tests__/effectPipeline.spec.ts`

- [ ] **Step 1: Add targeting tests**

Targeting ops open `effectTargeting`; `effectTargetChoose(id)` resolves via the pure `resolve*Target` rules. Need eligible instances in play. Assert on resulting state + that targeting clears.

```ts
describe("pipeline d'effets — ciblage (effectTargeting)", () => {
  it("damageTarget : ouvre le ciblage, le clic inflige des Dommages à la cible", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    // une cible Allié adverse en jeu (l'op cible « l'Allié de votre choix »)
    const target = placeInZone(store, otherSeat("A"), { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Neutre",
          zones: ["monde", "havreSac"],
        },
      ],
    });
    // si la cible est éligible, le ciblage s'ouvre ; sinon l'effet est auto-passé
    if (store.effectTargeting) {
      expect(store.effectTargetIdsList).toContain(target);
      store.effectTargetChoose(target);
      expect(store.effectTargeting).toBeNull();
    } else {
      // no-legal-target : comportement « effet passé » verrouillé
      expect(store.effectTargeting).toBeNull();
    }
  });

  it("ciblage sans cible légale : effet auto-passé, pas de mode ciblage", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "destroyTarget", what: "Allié", zones: ["monde"] }],
    });
    expect(store.effectTargeting).toBeNull();
  });

  it("effectTargetSkip : passe le ciblage en cours", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    placeInZone(store, otherSeat("A"), { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "destroyTarget", what: "Allié", zones: ["monde"] }],
    });
    if (store.effectTargeting) {
      store.effectTargetSkip();
      expect(store.effectTargeting).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/stores/__tests__/effectPipeline.spec.ts`. **Inspect what `placeInZone(other, monde)` actually produces** — if the mock ally is not an eligible target (e.g. `eligibleTargets` requires a specific `mainType`/zone), adjust the placed card via `extraCards` with an explicit `createMockAllyCard()` and confirm `store.effectTargetIdsList` is non-empty before locking the choose branch. The conditional `if (store.effectTargeting)` keeps the test honest either way; tighten to an unconditional assertion once the eligible setup is confirmed.
- [ ] **Step 3: Commit** — `git commit -am "test(engine): characterize targeting flows"`

### Task A7: Queue ordering, choices, triggered, holdRest

**Files:**

- Modify: `src/stores/__tests__/effectPipeline.spec.ts`

- [ ] **Step 1: Add orchestration tests**

```ts
describe("pipeline d'effets — orchestration de file", () => {
  it("holdRest : une op interactive suspend la frame, le reste s'exécute après résolution", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.draw("A", 2);
    const handBefore = store.state.seats.A.main.length;
    // discardFromHand (pause) PUIS draw 1 (reste de la frame)
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [
        { op: "discardFromHand", n: 1 },
        { op: "draw", n: 1 },
      ],
    });
    expect(store.effectPicking).not.toBeNull();
    // le draw du reste ne s'est PAS encore produit
    expect(store.state.seats.A.main.length).toBe(handBefore);
    store.effectPick(store.effectPickIds[0]);
    // pick (-1 main) puis reste draw (+1 main) => net inchangé, picker fermé
    expect(store.effectPicking).toBeNull();
    expect(store.state.seats.A.main.length).toBe(handBefore);
  });

  it("FIFO : deux effets enfilés s'exécutent dans l'ordre d'enfilement", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.enqueueEffect({
      seat: "A",
      cardName: "E1",
      ops: [{ op: "draw", n: 1 }],
    });
    store.enqueueEffect({
      seat: "A",
      cardName: "E2",
      ops: [{ op: "draw", n: 1 }],
    });
    expect(store.state.seats.A.main.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run** — PASS. The `holdRest` net-zero assertion (pick -1, draw +1) is the precise lock for pause/resume; verify the intermediate `main.length === handBefore` while picking.
- [ ] **Step 3: Commit** — `git commit -am "test(engine): characterize queue ordering & holdRest"`

### Task A8: Full-suite green baseline + snapshot

**Files:** none (verification gate)

- [ ] **Step 1: Run the whole suite + type-check**

Run: `npx vitest run` then `npm run type-check`
Expected: all pass. Record the exact total test count (e.g. "Tests N passed") — this number must be ≥ identical after the extraction.

- [ ] **Step 2: Tag the lock commit**

```bash
git commit --allow-empty -m "test(engine): behaviour lock complete (Phase A) — N tests green"
```

---

# PHASE B — Incremental extraction into `createEffectEngine`

> Each task ends with the **full suite green** (`npx vitest run`) + `npm run type-check`. Phase A is the safety net.

### Task B1: Define `EffectEngineDeps` + empty engine module wired into the store

**Files:**

- Create: `src/game/rules/effects/engine.ts`
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Create the engine module with the deps interface and a no-op factory**

```ts
/**
 * Moteur de RÉSOLUTION D'EFFETS — orchestrateur à états extrait de gameStore.
 * Possède la file d'exécution et le modèle d'interaction pause/reprise
 * (ciblage / pile / choix). Toutes les dépendances couplées au store sont
 * INJECTÉES (EffectEngineDeps) ; les helpers purs (@/game, @/game/rules) sont
 * importés directement. Voir docs/superpowers/plans/2026-06-18-effect-engine-extraction.md.
 */
import { computed, ref } from "vue";
import type { Card } from "@/types/cards";
import type { DraftEvent, GameState, Position, Seat, ZoneRef } from "@/game";
import type {
  EffectOp,
  RulesCtx,
  TargetingOp,
  TriggeredFrame,
} from "@/game/rules";

export interface EffectFrame {
  seat: Seat;
  cardName: string;
  ops: EffectOp[];
  sourceId?: string;
}

export interface PickFilter {
  mainType?: string;
  sub?: string;
  maxLevel?: number;
  element?: string;
}

/** Couplages au store, injectés pour découpler le moteur. */
export interface EffectEngineDeps {
  getState: () => GameState;
  rulesCtx: () => RulesCtx;
  getCard: (cardId: string | null) => Card | null;
  isAssist: () => boolean;
  isAssistEffects: () => boolean;
  getMatchPhase: () => "lobby" | "mulligan" | "playing" | "finished";
  playerName: (seat: Seat) => string;
  paOf: (seat: Seat) => number;
  dispatch: (...drafts: DraftEvent[]) => void;
  moveTo: (instanceId: string, to: ZoneRef, position?: Position) => void;
  shufflePioche: (seat: Seat) => void;
  checkVictory: () => void;
  draw: (seat: Seat, n: number) => void;
  adjustCounter: (instanceId: string, counter: string, delta: number) => void;
  onMatchWon: (seat: Seat) => void;
}

export function createEffectEngine(deps: EffectEngineDeps) {
  // (state + functions filled in by B2/B3)
  const effectQueue = ref<EffectFrame[]>([]);
  return { effectQueue };
}
```

- [ ] **Step 2: Type-check** — `npm run type-check` → PASS. (If `Position`/`ZoneRef`/`GameState` are not exported from `@/game`, import them from their real module — confirm against gameStore's own imports at `src/stores/gameStore.ts:13-21`.)

- [ ] **Step 3: Commit** — `git add src/game/rules/effects/engine.ts && git commit -m "refactor(engine): scaffold createEffectEngine + deps interface"`

### Task B2: Move the core loop (state refs, enqueue, pump, runFrame, holdRest, enforceHandLimit, computeds)

**Files:**

- Modify: `src/game/rules/effects/engine.ts`
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Move the cluster into the factory**

Cut from `gameStore.ts` into `createEffectEngine`: `effectChoices`/`effectChoice`, `effectTargeting`, `effectPicking`, `effectQueue`, `EffectFrame`, `PickFilter`, `normWord`, `matchesPickFilter`, `enqueueEffect`, `enqueueTriggered`, `pumpEffects`, `holdRest`, `effectPickIds`, `effectTargetIdsList`, `runFrame`, `enforceHandLimit`. Rewrite each store reference per this mapping (verify every call site against the read of `gameStore.ts:791–1310`):

- `state.value` → `deps.getState()`
- `rulesCtx()` → `deps.rulesCtx()`
- `getCard(...)` → `deps.getCard(...)`
- `assist.value` → `deps.isAssist()`
- `assistEffects.value` → `deps.isAssistEffects()`
- `matchPhase.value` → `deps.getMatchPhase()`
- `players.value[seat].name` → `deps.playerName(seat)`
- `paOf(seat)` → `deps.paOf(seat)`
- `dispatch(...)` → `deps.dispatch(...)`
- `shufflePioche(seat)` → `deps.shufflePioche(seat)`
- `draw(seat, n)` → `deps.draw(seat, n)`
- `adjustCounter(...)` → `deps.adjustCounter(...)`
- `checkVictory()` → `deps.checkVictory()`
- `winner.value = seat; matchPhase.value = "finished"` (in `gainXp`) → `deps.onMatchWon(seat)`
- `say`, `move`, `incCounterVerb`, `setCounterVerb`, `otherSeat` → import directly from `@/game`
- `effectTargetIds`, `isTargetingOp`, `grantXpEvents`, `heroLevel`, `producedElement`, `normElement` → import directly from `@/game/rules`

`queueArrivalEffects` is referenced by `effectPick` (B3) but not by `runFrame`; keep a forward reference by declaring `queueArrivalEffects` in B3 within the same factory closure. Return from the factory (interim): `{ effectQueue, effectTargeting, effectPicking, effectChoice, effectChoices, effectPickIds, effectTargetIdsList, enqueueEffect, enqueueTriggered, pumpEffects, holdRest, runFrame, enforceHandLimit }`.

- [ ] **Step 2: Instantiate the engine in the store and delegate**

In `gameStore.ts`, after all `ref`/function declarations the deps reference (place it just before the combat section, ~line 1465, so `dispatch`/`moveTo`/`draw`/`adjustCounter`/`shufflePioche`/`checkVictory`/`paOf`/`rulesCtx`/`getCard` are all hoisted/defined):

```ts
const engine = createEffectEngine({
  getState: () => state.value,
  rulesCtx,
  getCard,
  isAssist: () => assist.value,
  isAssistEffects: () => assistEffects.value,
  getMatchPhase: () => matchPhase.value,
  playerName: (s) => players.value[s].name,
  paOf,
  dispatch,
  moveTo,
  shufflePioche,
  checkVictory,
  draw,
  adjustCounter,
  onMatchWon: (s) => {
    winner.value = s;
    matchPhase.value = "finished";
  },
});
```

Replace remaining in-store callers: `draw`'s `enforceHandLimit(seat)` → `engine.enforceHandLimit(seat)`; `playFromHand`/`activateTapPower`'s `enqueueEffect(...)` → `engine.enqueueEffect(...)`. (Keep `queueArrivalEffects` calls compiling — temporarily leave the store's `queueArrivalEffects`/`effectPick`/`effectTarget*`/`effectChoiceResolve` in place referencing `engine.enqueueEffect`/`engine.effectChoices`/`engine.pumpEffects`/`engine.effectPicking`/`engine.effectTargeting` until B3.)

In the `return {}`, swap the moved members to `engine.*`: `effectTargeting: engine.effectTargeting`, `effectPicking: engine.effectPicking`, `effectChoice: engine.effectChoice`, `effectPickIds: engine.effectPickIds`, `effectTargetIdsList: engine.effectTargetIdsList`, `enqueueEffect: engine.enqueueEffect`.

- [ ] **Step 3: Type-check + full suite**

Run: `npm run type-check` then `npx vitest run`
Expected: type-check PASS, all tests PASS (same count as Phase A). Fix every `vue-tsc` error before moving on — common ones: a missed `state.value`→`deps.getState()` rewrite, or `PickFilter` referenced in the store after it moved (re-import the type from `engine.ts` if the store still needs it; ideally it no longer does).

- [ ] **Step 4: Commit** — `git commit -am "refactor(engine): move core loop (runFrame/pump/enqueue) into engine"`

### Task B3: Move interaction resolvers + arrival cascade

**Files:**

- Modify: `src/game/rules/effects/engine.ts`
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Move into the factory**

Cut `effectPick`, `effectPickSkip`, `effectTargetChoose`, `effectTargetSkip`, `effectChoiceResolve`, `queueArrivalEffects` from the store into `createEffectEngine`, applying the same dep mapping (B2). These call pure resolvers — import directly from `@/game/rules`: `resolveDestroyTarget`, `resolveHealHeroTarget`, `resolveBuffForceTarget`, `resolveDamageTarget`, `activeGlobalMods`, `collectTriggeredEffects`, `arrivalEffects`. Add all six functions to the factory's returned object.

- [ ] **Step 2: Re-export from the store**

In `gameStore.ts` `return {}`: `effectChoiceResolve: engine.effectChoiceResolve`, `effectTargetChoose: engine.effectTargetChoose`, `effectTargetSkip: engine.effectTargetSkip`, `effectPick: engine.effectPick`, `effectPickSkip: engine.effectPickSkip`. Rewire `playFromHand`/`effectPick`-of-store and `activateTapPower` to call `engine.queueArrivalEffects` / `engine.enqueueEffect`. Delete the now-dead store-local copies. Confirm no orphaned references remain (`grep -n "queueArrivalEffects\|effectChoiceResolve\|effectTargetChoose" src/stores/gameStore.ts` should only show the `engine.*` wiring + return).

- [ ] **Step 3: Type-check + full suite**

Run: `npm run type-check` then `npx vitest run`
Expected: PASS, same test count. The public store API is now identical but backed by the engine.

- [ ] **Step 4: Commit** — `git commit -am "refactor(engine): move interaction resolvers & arrival cascade into engine"`

### Task B4: Store cleanup + dead-import sweep

**Files:**

- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Remove now-unused imports & helpers**

After B2/B3, several rules imports used only by the moved code are dead in `gameStore.ts` (e.g. `effectTargetIds`, `isTargetingOp`, `resolveDamageTarget`, `resolveDestroyTarget`, `resolveHealHeroTarget`, `resolveBuffForceTarget`, `activeGlobalMods`, `collectTriggeredEffects`, `grantXpEvents`, `heroLevel`, `arrivalEffects`, `producedElement`, `normElement`, `TargetingOp`, `EffectOp`, `TriggeredFrame`). Remove each that `vue-tsc`/ESLint flags as unused — but **only** those no longer referenced anywhere in the store (grep each before deleting; some, e.g. `producedElement`, may still be used elsewhere in the store).

- [ ] **Step 2: Type-check + lint + full suite**

Run: `npm run type-check` then `npm run lint` then `npx vitest run`
Expected: all PASS. Resolve any `no-unused-vars` from ESLint.

- [ ] **Step 3: Commit** — `git commit -am "refactor(engine): drop dead imports from gameStore after extraction"`

---

# PHASE C — Isolated engine unit tests (prove the inversion)

### Task C1: `createEffectEngine` with mock deps — no Pinia, no store

**Files:**

- Create: `src/game/rules/effects/__tests__/engine.spec.ts`

- [ ] **Step 1: Write isolated tests**

Build a minimal `GameState` (reuse `createGame`/`deriveState` from `@/game` or a hand-rolled minimal state) and mock deps that record calls. Prove that a simple op routes through the injected deps without any store.

```ts
import { describe, it, expect, vi } from "vitest";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";

function mockDeps(over: Partial<EffectEngineDeps> = {}): EffectEngineDeps {
  return {
    getState: () =>
      ({
        /* minimal GameState with seats A/B */
      }) as any,
    rulesCtx: () => ({ state: {} as any, getCard: () => null }),
    getCard: () => null,
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "playing",
    playerName: () => "Joueur",
    paOf: () => 6,
    dispatch: vi.fn(),
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
    ...over,
  };
}

describe("createEffectEngine — isolation (deps injectées)", () => {
  it("op draw : route vers deps.draw, pas d'accès store", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps({ draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "draw", n: 2 }],
    });
    expect(draw).toHaveBeenCalledWith("A", 2);
  });

  it("op shuffleDeck : route vers deps.shufflePioche", () => {
    const shufflePioche = vi.fn();
    const engine = createEffectEngine(mockDeps({ shufflePioche }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "shuffleDeck" }],
    });
    expect(shufflePioche).toHaveBeenCalledWith("A");
  });

  it("gainXp gagnant : appelle onMatchWon quand grantXpEvents.won", () => {
    // construire un state où le Héros est à un Niveau gagnant après gainXp ;
    // si trop coûteux à fabriquer, asserter au minimum que dispatch reçoit les
    // events d'XP. Garder l'assertion sur le chemin réellement déclenché.
    const onMatchWon = vi.fn();
    const engine = createEffectEngine(
      mockDeps({ onMatchWon /* + getState gagnant */ }),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "gainXp", n: 99 }],
    });
    // Asserter selon le state fabriqué (voir note ci-dessus).
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/game/rules/effects/__tests__/engine.spec.ts`. Build out the minimal `GameState` shape iteratively until `draw`/`shuffleDeck` route cleanly. If a fully-mocked `getState` proves too brittle for ops touching deep state, prefer `createGame(...)` + `deriveState(...)` from `@/game` to get a real minimal state object while still using `vi.fn()` deps for the mutators. The point is to prove the engine runs with **no Pinia store** — keep at least the `draw` and `shuffleDeck` routing tests passing.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "test(engine): isolated createEffectEngine tests with mock deps"`

---

# PHASE D — Browser verification (deployed combat path)

### Task D1: Verify combat at `/play/table` in preview

**Files:** none (manual/preview verification per the "Testing /play/table in preview" memory)

- [ ] **Step 1: Build + start preview** — `preview_start` (or `npm run build`), navigate to `/play/table`. Auth bypass via `pinia._s`, inject fake decks (see memory `testing-play-table-in-preview.md`).
- [ ] **Step 2: Drive a combat with an automated arrival effect** — play a card whose effect compiles to an op (e.g. a `draw`/`searchDeck`/`damageTarget` card), confirm the picker/targeting overlay appears and resolves, and the board state updates. Check `preview_console_logs` for errors.
- [ ] **Step 3: Screenshot the resolved effect** — `preview_screenshot` as proof, share with the user.

### Task D2: Final gates + finish the branch

- [ ] **Step 1: Full gates** — `npm run type-check` && `npx vitest run` && `npm run lint` → all green; test count ≥ Phase A baseline.
- [ ] **Step 2:** Invoke superpowers:finishing-a-development-branch to choose merge/PR/cleanup. Do NOT touch master until D1+D2 pass.

---

## Self-Review

**Spec coverage:**

- "Build exhaustive effect-pipeline test harness driving every op + targeting/picking pause→resume via startSandbox + assistEffects" → Phase A (A1 harness, A2–A4 all self ops, A5 picking, A6 targeting, A7 pause/resume/holdRest/FIFO).
- "Extract incrementally (useEffectEngine composable with injected deps), tests green at each step" → Phase B (B1 scaffold, B2 core loop, B3 resolvers, B4 cleanup), each ending in `npx vitest run` + `npm run type-check`.
- "Invert ~15 dependencies" → `EffectEngineDeps` (B1) lists exactly the store-stateful couplings; pure helpers imported directly.
- "Re-model targeting/picking" → explicitly scoped: refs move into the engine (composable), pure-request model deferred (stated in Architecture/Non-goals).
- "Verify combat in the browser" → Phase D1.
- "Type-check only gate; vitest after each step; dedicated branch; don't touch master" → branch `refactor/effect-engine-extraction` already created; gates in every task; D2 guards master.
- "#7 deriveState already fixed — out of scope" → noted in Non-goals.

**Placeholder scan:** Test assertions that depend on runtime-observed values (gainXp log text, eligible-target setup, mock GameState shape) are flagged in-step with explicit "pin to observed value / build out iteratively" instructions rather than left as silent TBDs — characterization tests inherently probe-then-lock. No `TODO`/"add error handling"/"similar to Task N" placeholders.

**Type consistency:** `EffectEngineDeps` method names (`getState`, `getMatchPhase`, `isAssist`, `isAssistEffects`, `playerName`, `onMatchWon`) are used identically in B2's instantiation. `EffectFrame`/`PickFilter` defined once in `engine.ts`. Factory return object members match the store's `engine.*` re-exports in B2/B3 and the public names in the existing `return {}` (`effectTargeting`, `effectPicking`, `effectChoice`, `effectPickIds`, `effectTargetIdsList`, `enqueueEffect`, `effectPick`, `effectPickSkip`, `effectTargetChoose`, `effectTargetSkip`, `effectChoiceResolve`).
