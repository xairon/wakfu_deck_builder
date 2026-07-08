# Hero Movement & Havre-Sac Protection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a Hero protected inside its Havre-Sac (unreachable by the opponent) and targetable only when it is in the Monde — which it reaches by explicitly moving out to attack, or by being expelled when its bag is destroyed.

**Architecture:** Add an explicit `moveHero` action (reuses the existing `move` verb, no new event kind). Enforce zone-based reachability in combat eligibility (`eligibleAttackers`, `eligibleTargets`) and in a single central predicate for effect targeting (rule 508.x). Expulsion (410.7) already works. Bot v1 keeps its Hero home; UI adds Sortir/Rentrer.

**Tech Stack:** Vue 3 + TS, Pinia, Vitest. Event-sourced engine in `src/game/`. Rules in `src/game/rules/`. Spec: `docs/superpowers/specs/2026-07-08-hero-movement-design.md`.

**Already done (do NOT reimplement):** Havre-Sac 0-Résistance ⇒ ban + expel Hero to Monde (`src/game/rules/destruction.ts`, tested in `destruction.spec.ts`).

---

## Task 1: Hero movement — legality + action

**Files:**

- Modify: `src/game/rules/legality.ts` (add `whyCannotMoveHero`)
- Modify: `src/stores/gameStore.ts` (add `moveHero` action; expose it)
- Test: `src/game/rules/__tests__/legality.spec.ts`
- Test: `src/stores/__tests__/heroMovement.spec.ts` (new)

- [ ] **Step 1: Failing test for `whyCannotMoveHero`** — add to `legality.spec.ts`. Import `whyCannotMoveHero`. Use the file's existing fixture helpers (`fixture`/`ctxOf`/`setTurn` as in `repos-play-condition-w61.spec.ts` or the local ones in `legality.spec.ts`). Cases:

```ts
// hero starts in havreSac; A's turn, phase principale
it("refuse la sortie au tour 1 (506.3), l'autorise ensuite", () => {
  const f = fixture([]); // hero A in havreSac by setup
  setTurn(f, "A", 1);
  expect(whyCannotMoveHero(ctxOf(f), "A", "monde")).toBe(
    "Aucune sortie dans le Monde au premier tour de la partie.",
  );
  setTurn(f, "A", 3);
  expect(whyCannotMoveHero(ctxOf(f), "A", "monde")).toBeNull();
});
it("refuse hors de son tour / hors phase principale / déjà dans la zone", () => {
  const f = fixture([]);
  setTurn(f, "B", 3);
  expect(whyCannotMoveHero(ctxOf(f), "A", "monde")).toBe(
    "Ce n'est pas votre tour.",
  );
  setTurn(f, "A", 3);
  expect(whyCannotMoveHero(ctxOf(f), "A", "havreSac")).toBe(
    "Ton Héros est déjà dans son Havre-Sac.",
  );
});
```

- [ ] **Step 2: Run — expect FAIL** (`whyCannotMoveHero` undefined). Run: `npx vitest run src/game/rules/__tests__/legality.spec.ts`

- [ ] **Step 3: Implement `whyCannotMoveHero`** in `legality.ts` (near `whyCannotDeclareAttack`). Read the hero via `ctx.state.seats[seat].heroInstanceId` then `ctx.state.instances[heroId].location.zone`.

```ts
/** Mouvement du Héros Havre-Sac↔Monde (414.1) : Phase Principale, à son tour,
 *  pas de sortie dans le Monde au 1er tour de la partie (506.3), zone différente. */
export function whyCannotMoveHero(
  ctx: RulesCtx,
  seat: Seat,
  to: "monde" | "havreSac",
): string | null {
  const { turn } = ctx.state;
  if (turn.active !== seat) return "Ce n'est pas votre tour.";
  if (turn.phase !== "principale")
    return "On déplace le Héros en Phase Principale.";
  const heroId = ctx.state.seats[seat].heroInstanceId;
  const cur = heroId ? ctx.state.instances[heroId]?.location.zone : undefined;
  if (cur === to)
    return to === "monde"
      ? "Ton Héros est déjà dans le Monde."
      : "Ton Héros est déjà dans son Havre-Sac.";
  if (to === "monde" && turn.number === 1)
    return "Aucune sortie dans le Monde au premier tour de la partie.";
  return null;
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run src/game/rules/__tests__/legality.spec.ts`

- [ ] **Step 5: Failing test for the store `moveHero`** — create `src/stores/__tests__/heroMovement.spec.ts`. Mirror `tutorialStore.spec.ts` setup (`setActivePinia`, `useCardStore`, `useGameStore`, `startSandbox` with two mock decks; import `createMockHeroCard` etc.). It starts A's hero in `havreSac`.

```ts
it("moveHero déplace le Héros havreSac↔monde (tour 2+, phase principale)", () => {
  // startSandbox first="B" then endTurn → A's turn 2, phase principale
  store.startSandbox(a.deck, b.deck, "B");
  store.endTurn(); // → A, turn 2
  const heroId = store.state.seats.A.heroInstanceId!;
  expect(store.state.instances[heroId].location.zone).toBe("havreSac");
  store.moveHero("A", "monde");
  expect(store.state.instances[heroId].location.zone).toBe("monde");
  expect(store.state.monde).toContain(heroId);
  store.moveHero("A", "havreSac");
  expect(store.state.instances[heroId].location.zone).toBe("havreSac");
  expect(store.state.monde).not.toContain(heroId);
});
it("moveHero refuse au tour 1 (ruleError posé, pas de déplacement)", () => {
  store.startSandbox(a.deck, b.deck, "A"); // A turn 1
  const heroId = store.state.seats.A.heroInstanceId!;
  store.ruleError = null;
  store.moveHero("A", "monde");
  expect(store.state.instances[heroId].location.zone).toBe("havreSac");
  expect(store.ruleError).toContain("premier tour");
});
```

- [ ] **Step 6: Run — expect FAIL** (`moveHero` undefined). Run: `npx vitest run src/stores/__tests__/heroMovement.spec.ts`

- [ ] **Step 7: Implement `moveHero`** in `gameStore.ts`. Check legality via `whyCannotMoveHero(rulesCtx(), seat, to)`, `rejectMove` on failure, else dispatch a `move` of `heroInstanceId` to the target zone (interior for havreSac). Read how `playFromHand`/`moveTo` build the `move` verb (verbs.ts `move`) and the havreSac destination `{ zone: "havreSac", owner: seat }`. Add `moveHero` to the store's returned object.

```ts
function moveHero(seat: Seat, to: "monde" | "havreSac"): void {
  const reason = whyCannotMoveHero(rulesCtx(), seat, to);
  if (reason) {
    rejectMove(reason);
    return;
  }
  const heroId = state.value.seats[seat].heroInstanceId;
  const inst = heroId ? state.value.instances[heroId] : null;
  if (!heroId || !inst) return;
  dispatch(
    move(seat, {
      instanceId: heroId,
      from: inst.location,
      to:
        to === "monde" ? { zone: "monde" } : { zone: "havreSac", owner: seat },
      position: { at: "any" },
      visibility: { faceDown: false, visibleTo: "all" },
      preservesIdentity: true,
      orientationOnArrival: inst.orientation, // conserve dressé/incliné
    }),
  );
}
```

(Import `whyCannotMoveHero`; `move` is already imported for playFromHand. Verify the `move` payload shape against an existing `dispatch(move(...))` call in gameStore.)

- [ ] **Step 8: Run — expect PASS.** Run: `npx vitest run src/stores/__tests__/heroMovement.spec.ts src/game/rules/__tests__/legality.spec.ts`

- [ ] **Step 9: Commit.**

```bash
git add src/game/rules/legality.ts src/stores/gameStore.ts src/game/rules/__tests__/legality.spec.ts src/stores/__tests__/heroMovement.spec.ts
git commit -m "feat(rules): mouvement du Héros Havre-Sac↔Monde (414.1, whyCannotMoveHero + moveHero)"
```

---

## Task 2: Combat eligibility — Hero attacks/targeted only in the Monde

**Files:**

- Modify: `src/game/rules/legality.ts` (`eligibleAttackers` ~L207; `eligibleTargets` ~L237; check `eligibleBlockers` ~L285)
- Test: `src/game/rules/__tests__/legality.spec.ts`

- [ ] **Step 1: Failing tests** — add to `legality.spec.ts`:

```ts
it("le Héros n'est attaquant/cible que dans le Monde (protégé au Havre-Sac)", () => {
  const f = fixture([]);
  setTurn(f, "A", 3);
  const heroA = ctxOf(f).state.seats.A.heroInstanceId!;
  const heroB = ctxOf(f).state.seats.B.heroInstanceId!;
  // au Havre-Sac : ni attaquant côté A, ni cible côté A (héros B protégé)
  expect(eligibleAttackers(ctxOf(f), "A")).not.toContain(heroA);
  expect(eligibleTargets(ctxOf(f), "A").map((t) => t.instanceId)).not.toContain(
    heroB,
  );
  // sorti dans le Monde : attaquant + cible
  moveHeroTo(f, "A", "monde");
  moveHeroTo(f, "B", "monde");
  expect(eligibleAttackers(ctxOf(f), "A")).toContain(heroA);
  expect(eligibleTargets(ctxOf(f), "A").map((t) => t.instanceId)).toContain(
    heroB,
  );
});
```

(Add a local `moveHeroTo(f, seat, zone)` test helper that dispatches a `move` of the hero, or reuse the fixture's dispatch + `move` verb.)

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run src/game/rules/__tests__/legality.spec.ts`

- [ ] **Step 3: Fix `eligibleAttackers`** (L207-234): a Hero is eligible only in `monde`. The current loop accepts `zone === "monde" || zone === "havreSac"`. Change so that for a Hero card the zone MUST be `monde`; allies keep the current zones. Concretely, after resolving `card`, add: `if (card.mainType === "Héros" && zone !== "monde") continue;`.

- [ ] **Step 4: Fix `eligibleTargets`** (L237-244): only push the opponent Hero if it is in the Monde. Replace the unconditional hero push with:

```ts
const heroInst = board.heroInstanceId
  ? ctx.state.instances[board.heroInstanceId]
  : null;
if (heroInst && heroInst.location.zone === "monde")
  out.push({ kind: "hero", instanceId: board.heroInstanceId! });
```

(Keep the Havre-Sac and Monde-ally pushes as-is.)

- [ ] **Step 5: Verify `eligibleBlockers`** (L285) — a Hero in the Havre-Sac must not be a legal blocker. If it iterates `state.monde`/upright creatures, a bagged Hero is already excluded (not in monde). Add a test asserting a bagged Hero is not in `eligibleBlockers`; if it leaks, add the same `monde`-only guard for heroes.

- [ ] **Step 6: Run — expect PASS.** Run: `npx vitest run src/game/rules/__tests__/legality.spec.ts`

- [ ] **Step 7: Commit.**

```bash
git add src/game/rules/legality.ts src/game/rules/__tests__/legality.spec.ts
git commit -m "feat(rules): le Héros n'attaque/n'est ciblé qu'exposé dans le Monde (protégé au Havre-Sac)"
```

---

## Task 3: Effect targeting range (508.x) — no reaching into the opponent's bag

**Files:**

- Modify: `src/game/rules/effects/targeting.ts` (effect target eligibility ~L240-300; add central `canReachTarget`)
- Modify: `src/game/rules/effects/engine.ts` (`damageOppHero` branch ~L1591 — guard protected Hero)
- Test: `src/game/rules/__tests__/targeting.spec.ts`
- Test: `src/game/rules/effects/__tests__/havresac-range-508.spec.ts` (new — the Tirlangue repro)

- [ ] **Step 1: Failing test — the reported bug** — create `havresac-range-508.spec.ts`. Build the real Tirlangue op (`damageTarget n:2 element:Air heroes:true zones:["monde","havreSac"]`) with an engine sandbox (mirror `recycle-count-w22.spec.ts`'s `mockDeps`/`makeState`, giving `hero-A` in `havreSac` and `hero-B` (opponent) in `havreSac`). Assert the opponent Hero is NOT an eligible target while in its bag, and IS once moved to `monde`.

```ts
it("un effet ne peut pas cibler le Héros ADVERSE dans son Havre-Sac (508.b/c), mais le peut dans le Monde", () => {
  // state: hero-A (seat A) in havreSac (source side), hero-B (seat B) in havreSac
  // enqueue damageTarget heroes:true zones:[monde,havreSac] from seat A
  // → effectTargeting open; effectTargetIds must EXCLUDE hero-B (opponent bag)
  // move hero-B to monde → effectTargetIds must INCLUDE hero-B
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run src/game/rules/effects/__tests__/havresac-range-508.spec.ts`

- [ ] **Step 3: Add `canReachTarget`** in `targeting.ts` and apply it in the eligible-ids builder (the function that lists targets for `damageTarget`/`buffForceTarget`/`tapTarget`/`destroyTarget`/`damageMultiTarget`, ~L246-297). A source in a Havre-Sac/Monde can never affect an object in an OPPONENT's Havre-Sac (508.1b/c). Since every offensive op source is in the Monde or a Havre-Sac, the rule reduces to: **exclude any candidate whose `location.zone === "havreSac"` and whose `owner`/`controller` ≠ the acting seat.**

```ts
/** 508.1b/c : l'adversaire ne peut atteindre un objet dans VOTRE Havre-Sac.
 *  (La source d'un effet offensif est au Monde ou dans un Havre-Sac ; dans les
 *   deux cas, le Havre-Sac ADVERSE est hors de portée.) */
function isReachable(inst: CardInstance, actor: Seat): boolean {
  if (inst.location.zone !== "havreSac") return true;
  return inst.controller === actor; // seul VOTRE propre Havre-Sac est atteignable
}
```

Filter the candidate list with `isReachable(inst, actorSeat)` in the eligible-ids builder. (Check the exact local variable names for the instance + acting seat in that function.)

- [ ] **Step 4: Guard `damageOppHero`** in `engine.ts` (~L1591): if the opponent's Hero is protected in its Havre-Sac, the op is a no-op (508.x — you cannot reach it there). Before applying damage:

```ts
const oppHero = oppHeroId ? deps.getState().instances[oppHeroId] : null;
if (!oppHero || oppHero.location.zone === "havreSac") {
  // Héros adverse protégé dans son Havre-Sac (508.x) → aucun effet.
} else {
  /* existing damage logic */
}
```

- [ ] **Step 5: Run — expect PASS** (repro + targeting). Run: `npx vitest run src/game/rules/effects/__tests__/havresac-range-508.spec.ts src/game/rules/__tests__/targeting.spec.ts`

- [ ] **Step 6: Commit.**

```bash
git add src/game/rules/effects/targeting.ts src/game/rules/effects/engine.ts src/game/rules/effects/__tests__/havresac-range-508.spec.ts
git commit -m "fix(rules): portée 508.x — un effet ne peut pas atteindre le Héros/objet du Havre-Sac adverse (repro Tirlangue)"
```

---

## Task 4: Bot AI — defensive Hero + target exposed Hero + termination

**Files:**

- Modify: `src/game/ai/botPolicy.ts` (`declareAttack` target ranking; `mainPhase` must NOT move the Hero out)
- Test: `src/stores/__tests__/botVsBot.spec.ts` (termination), `src/game/ai/__tests__/botPolicy.spec.ts`

- [ ] **Step 1: Confirm no hero-move in the bot.** The bot never calls `moveHero`, so its Hero stays in the bag by default — correct for v1. No change needed there; verify by reading `mainPhase`.

- [ ] **Step 2: Failing/■ termination test** — the existing `botVsBot.spec.ts` runs all 16 starter pairings to a winner. With Heroes now unattackable in the bag, games must still end via grind-the-bag→expel→kill or 18 XP. Run the suite:

Run: `npx vitest run src/stores/__tests__/botVsBot.spec.ts`
Expected: all pass (a winner every game). If any game hits `MAX_TURNS` without a winner, the bot isn't grinding the Havre-Sac — fix Step 3.

- [ ] **Step 3: Ensure the bot grinds the Havre-Sac and targets exposed Heroes.** In `declareAttack` (botPolicy.ts ~L115), the target set comes from `store.combatTargetIds` (which now reflects Task 2: opponent Hero only if in Monde, plus the Havre-Sac). Verify the ranking still picks a legal target (it sorts by defender hero HP; when the Hero isn't a target, it should fall back to the Havre-Sac / allies). If `combatTargetIds` can be non-empty with only the Havre-Sac, the bot will grind it → expel → then the Hero becomes targetable. Add a targeted test if ranking needs a tweak:

```ts
it("le bot cible le Havre-Sac quand le Héros adverse est protégé, le Héros une fois exposé", () => {
  /* sandbox: opp hero in bag → target is havreSac; move opp hero to monde → hero becomes a target */
});
```

- [ ] **Step 4: Run — expect PASS** (bot tests + termination). Run: `npx vitest run src/stores/__tests__/botVsBot.spec.ts src/game/ai/__tests__/botPolicy.spec.ts`

- [ ] **Step 5: Commit.**

```bash
git add src/game/ai/botPolicy.ts src/stores/__tests__/botVsBot.spec.ts src/game/ai/__tests__/botPolicy.spec.ts
git commit -m "feat(ai): bot défensif — grind le Havre-Sac, cible le Héros une fois exposé (terminaison garantie)"
```

---

## Task 5: UI — render Hero location + Sortir/Rentrer + RuleAssistant hint

**Files:**

- Modify: `src/components/game/GameBoard.vue` (action-bar buttons; the Hero already renders in the havreSac interior via `interiorCards`, and in the Monde via `allies`/`mondeOwned` once its zone is `monde`)
- Modify: `src/composables/useRuleAssistant.ts` (playing-phase hint)
- Test: manual/preview + `e2e/app.spec.ts` optional smoke

- [ ] **Step 1: Add Sortir/Rentrer to the action bar.** In `GameBoard.vue`, the selected-card action bar (`v-if="selectedInst"`, ~L754) — when `selectedInst` is the controller's Hero, show one button: "⚔ Sortir dans le Monde" if `whyCannotMoveHero(...,'monde')` is null and the Hero is in the bag, or "🛡 Rentrer au Havre-Sac" if in the Monde. Wire `@click="store.moveHero(me, 'monde'|'havreSac'); selectedId = null"`. Add a computed `heroMoveTarget` (null | "monde" | "havreSac") using `store.moveHero` legality (expose `whyCannotMoveHero` on the store or a `store.heroCanMove(to)` helper). The Hero renders in its zone automatically (interior list vs `allies(me)`), so no separate render change is needed — verify a Hero moved to `monde` appears among `allies(me)` (it must be included; `allies` filters `mondeOwned` minus the havre-sac card, and the Hero is not the havre-sac card, so it appears — confirm and adjust if `allies` explicitly excludes the hero).

- [ ] **Step 2: RuleAssistant hint.** In `useRuleAssistant.ts`, the playing-phase action hint (~L205) — append guidance when the player's Hero is in the bag: "Ton Héros est protégé dans son Havre-Sac ; sors-le pour attaquer (il devient alors vulnérable)."

- [ ] **Step 3: Verify in preview.** Start dev preview; drive a sandbox (inject auth per prior sessions), move the Hero out, confirm it renders in the Monde and becomes a target; confirm a bagged opponent Hero can't be targeted. Screenshot/inspect.

- [ ] **Step 4: Type-check + full suite.** Run: `npm run type-check` then `npx vitest run`. Update any remaining tests that assumed always-targetable Heroes.

- [ ] **Step 5: Commit + deploy.**

```bash
git add src/components/game/GameBoard.vue src/composables/useRuleAssistant.ts
git commit -m "feat(play): Sortir/Rentrer du Héros + rappel de protection du Havre-Sac"
git push origin master
```

---

## Self-review notes

- **Spec coverage:** movement (T1), protection/range in combat (T2) + effects (T3), expulsion (already done — noted), bot (T4), UI (T5), testing (throughout), termination guard (T4). ✓
- **Type consistency:** `whyCannotMoveHero(ctx, seat, to)` and `moveHero(seat, to)` share the `to: "monde" | "havreSac"` shape across T1/T5. `isReachable(inst, actor)` (T3) is internal to targeting.ts.
- **Known verification points flagged inline** (exact `move` payload shape, `allies()` hero inclusion, `eligibleBlockers` hero guard, targeting eligible-ids variable names) — resolve by reading the cited code during execution, not left as behavioral placeholders.
