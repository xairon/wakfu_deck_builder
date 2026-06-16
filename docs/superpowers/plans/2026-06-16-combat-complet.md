# Combat complet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les 5 lacunes de règles de base du combat confirmées par l'audit (707.1 riposte, BLK-01 assignation, Géant overflow, tap des bloqueurs, validation deck au lancement).

**Architecture:** Le moteur `resolveCombat` est pur et accumule déjà les dégâts dans une map `dmg` avant la létalité. On ajoute la riposte (707.1) et le débordement Géant comme des inflictions supplémentaires dans cette même map (simultanéité), on incline les bloqueurs survivants en fin de résolution, et on expose deux sous-étapes interactives (assignation bloqueur, riposte) côté store/UI calquées sur l'étape `strikes` existante. La validation deck est une garde UI dans `launch()`.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vitest, moteur event-sourced TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-16-combat-complet-design.md`

**Vérification globale (à exécuter à chaque fin de tâche moteur) :** `npx vitest run src/game/rules/__tests__/combat.spec.ts`. Vérif finale : `npx vitest run` + `npm run build` + rejeu live preview (port 3000, `window.__G`/`window.__snap`).

---

## Task 1: Type `CombatPlan.ripostes`

**Files:**

- Modify: `src/game/rules/types.ts:44`

- [ ] **Step 1: Ajouter le champ `ripostes` au plan**

Dans `src/game/rules/types.ts`, dans l'interface `CombatPlan`, juste après le champ `strikes?` (ligne 44), ajouter :

```ts
  /**
   * 707.1 : targetId (Cible Allié/Héros) → attaquant frappé par la riposte
   * de la Cible. Absent → premier attaquant l'ayant frappée.
   */
  ripostes?: Record<InstanceId, InstanceId>;
```

- [ ] **Step 2: Vérifier la compilation des types**

Run: `npx tsc --noEmit -p tsconfig.json` (ou `npm run build`)
Expected: aucune nouvelle erreur (champ optionnel, non encore consommé).

- [ ] **Step 3: Commit**

```bash
git add src/game/rules/types.ts
git commit -m "feat(combat): champ CombatPlan.ripostes (707.1)"
```

---

## Task 2: Riposte de la Cible (707.1) — moteur

**Files:**

- Modify: `src/game/rules/combat.ts` (section dégâts à la cible, ~117-259)
- Test: `src/game/rules/__tests__/combat.spec.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter ce bloc à la fin de `src/game/rules/__tests__/combat.spec.ts` :

```ts
describe("rules/combat — riposte de la Cible (707.1)", () => {
  it("Cible Allié non bloquée riposte sa Force et tue l'attaquant plus faible", () => {
    const f = fixture(
      [makeAlly("atk", { force: 1 })],
      [makeAlly("cible", { force: 3, xp: 1 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    const { result, state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "ally", instanceId: instId("B", 0) },
      attackers: [instId("A", 0)],
      blocks: {},
    });
    // l'attaquant (F1) prend la riposte 3 ≥ 1 → détruit ; la cible prend 1 < 3 → survit
    expect(result.destroyed).toContain(instId("A", 0));
    expect(state.seats.B.defausse).not.toContain(instId("B", 0));
    expect(state.instances[instId("B", 0)].counters.damage).toBe(1);
    // B gagne l'XP de l'attaquant A détruit (415.1)
    expect(state.instances[HERO_B].counters.xp).toBe(0); // atk n'a pas d'xp
  });

  it("riposte mortelle réciproque : Cible et attaquant meurent ensemble (simultané)", () => {
    const f = fixture(
      [makeAlly("atk", { force: 3, xp: 1 })],
      [makeAlly("cible", { force: 3, xp: 2 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    const { result } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "ally", instanceId: instId("B", 0) },
      attackers: [instId("A", 0)],
      blocks: {},
    });
    expect(result.destroyed.sort()).toEqual(
      [instId("A", 0), instId("B", 0)].sort(),
    );
  });

  it("riposte multi-attaquants : plan.ripostes désigne l'attaquant frappé", () => {
    const f = fixture(
      [makeAlly("atk1", { force: 1 }), makeAlly("atk2", { force: 1 })],
      [makeAlly("cible", { force: 2 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    const { result } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "ally", instanceId: instId("B", 0) },
      attackers: [instId("A", 0), instId("A", 1)],
      blocks: {},
      ripostes: { [instId("B", 0)]: instId("A", 1) },
    });
    // la cible (F2) frappe atk2 (F1) → atk2 détruit, atk1 intact
    expect(result.destroyed).toEqual([instId("A", 1)]);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run src/game/rules/__tests__/combat.spec.ts -t "riposte"`
Expected: les 3 tests ÉCHOUENT (pas de riposte ⇒ attaquants intacts).

- [ ] **Step 3: Restructurer la section dégâts-à-la-cible + ajouter la riposte**

Dans `src/game/rules/combat.ts`, juste après la fonction `inflict` (après la ligne 117, avant `// bloqueurs par attaquant`), ajouter l'accumulateur de cible et le helper :

```ts
// 707/6135 — dégâts portés à la CIBLE (attaquants libres + débordement Géant)
// et liste des attaquants l'ayant frappée (candidats à la riposte 707.1).
const targetStrikers: InstanceId[] = [];
let targetDamageTotal = 0;
function hitTarget(source: InstanceId, base: number): void {
  const eff = reduceDamage(
    ctx,
    {
      targetId: plan.target.instanceId,
      amount: base,
      element: damageElementOf(ctx, source),
      combat: true,
      sourceId: source,
    },
    mods,
    stance,
  );
  prevented += base - eff;
  if (eff <= 0) return;
  targetStrikers.push(source);
  targetDamageTotal += eff;
  ruleEvents.push({
    kind: "damageDealt",
    source,
    target: plan.target.instanceId,
    amount: eff,
    element: damageElementOf(ctx, source),
    combat: true,
  });
  // Cible Allié : les Dommages passent par la map dmg (létalité unifiée).
  if (plan.target.kind === "ally") addDmg(plan.target.instanceId, eff);
}
```

Puis REMPLACER tout le bloc « 707 — attaquants libres » (lignes ~173-220, du `const freeAttackers` jusqu'au `}` fermant le `if (freeDamage > 0)`) par :

```ts
// 707 — attaquants libres → Dommages sur la cible, individuellement (6179)
const freeAttackers = plan.attackers.filter(
  (id) => !blockersOf.get(id)?.length,
);
for (const id of freeAttackers) hitTarget(id, forceOf(ctx, id, stance));

// 707.1 — la Cible (Allié/Héros) qui n'a pas frappé en duel riposte sa Force
// à UN attaquant l'ayant frappée (choix du défenseur via plan.ripostes,
// sinon le premier). Simultané : la riposte va dans dmg, létalité après.
if (plan.target.kind !== "havreSac" && targetStrikers.length) {
  const tId = plan.target.instanceId;
  const chosen = plan.ripostes?.[tId];
  const struck =
    chosen && targetStrikers.includes(chosen) ? chosen : targetStrikers[0];
  inflict(tId, struck, forceOf(ctx, tId, stance));
  log.push(`Riposte : ${nameOf(ctx, tId)} frappe ${nameOf(ctx, struck)}.`);
}

// Application du total à la Cible Héros (PV) / Havre-Sac (Résistance) ;
// la Cible Allié est déjà dans dmg (via hitTarget).
if (targetDamageTotal > 0) {
  if (plan.target.kind === "hero") {
    events.push(
      incCounter(atk, plan.target.instanceId, "hp", -targetDamageTotal),
    );
    log.push(`${targetDamageTotal} Dommage(s) au Héros adverse.`);
  } else if (plan.target.kind === "havreSac") {
    events.push(
      incCounter(atk, plan.target.instanceId, "resistance", -targetDamageTotal),
    );
    log.push(`${targetDamageTotal} Dommage(s) au Havre-Sac adverse.`);
  } else {
    log.push(
      `${targetDamageTotal} Dommage(s) sur ${nameOf(ctx, plan.target.instanceId)}.`,
    );
  }
}
```

Puis, dans le bloc d'application des Héros touchés (~252-259), REMPLACER l'usage de `freeDamage` par `targetDamageTotal` :

```ts
if (plan.target.kind === "hero" && targetDamageTotal > 0) {
  const hero = ctx.state.instances[plan.target.instanceId];
  if (hero) {
    const base =
      heroHpAfter.get(plan.target.instanceId) ?? hero.counters.hp ?? 0;
    heroHpAfter.set(plan.target.instanceId, base - targetDamageTotal);
  }
}
```

- [ ] **Step 4: Lancer les tests**

Run: `npx vitest run src/game/rules/__tests__/combat.spec.ts`
Expected: les 3 nouveaux tests PASSENT et les anciens (Héros cible −3, Havre-Sac −3, duels) PASSENT toujours.

- [ ] **Step 5: Commit**

```bash
git add src/game/rules/combat.ts src/game/rules/__tests__/combat.spec.ts
git commit -m "feat(combat): riposte de la Cible non bloquée (707.1)"
```

---

## Task 3: Géant — débordement + actif à 1 bloqueur (6135)

**Files:**

- Modify: `src/game/rules/combat.ts` (branche Géant, ~135-158)
- Test: `src/game/rules/__tests__/combat.spec.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `combat.spec.ts`. NB : le mot-clé Géant se pose via `compiled.static.kind` ; reproduire le motif du test Maître Bolet existant.

```ts
describe("rules/combat — Géant (6135)", () => {
  const geant = (name: string, force: number) => {
    const a = makeAlly(name, { force });
    a.effects = [
      {
        description: "Géant.",
        compiled: { trigger: "static", static: { kind: "geant" }, ops: [] },
      },
    ];
    return a;
  };

  it("Géant à 1 bloqueur : déborde le reliquat sur la Cible Héros", () => {
    const f = fixture([geant("colosse", 4)], [makeAlly("b1", { force: 1 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    const { state, result } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0)],
      blocks: { [instId("B", 0)]: instId("A", 0) },
    });
    // bloqueur (F1) tué par 1, reliquat 3 déborde sur le Héros : 16 − 3 = 13
    expect(result.destroyed).toContain(instId("B", 0));
    expect(state.instances[HERO_B].counters.hp).toBe(13);
  });
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npx vitest run src/game/rules/__tests__/combat.spec.ts -t "Géant"`
Expected: ÉCHEC — Héros B reste à 16 (pas de débordement ; Géant inactif à 1 bloqueur).

- [ ] **Step 3: Modifier la branche Géant**

Dans `src/game/rules/combat.ts`, dans la boucle des duels :

1. Ligne ~135, retirer la garde de cardinalité :

```ts
    if (effectiveKeywords(ctx, attacker).geant) {
```

2. Ligne ~157, remplacer le versement du reliquat (qui n'allait qu'à un survivant) par : reliquat au survivant le moins cher s'il en reste, sinon débordement sur la Cible (6135). `hitTarget` (Task 2) gère déjà les trois genres de Cible (Allié→`dmg`, Héros/Havre-Sac→`targetDamageTotal`) et inscrit le Géant dans `targetStrikers` (candidat riposte) :

```ts
if (pool > 0) {
  if (unkilled.length) inflict(attacker, unkilled[0], pool);
  else hitTarget(attacker, pool); // 6135 : débordement sur la Cible
}
```

- [ ] **Step 4: Lancer les tests**

Run: `npx vitest run src/game/rules/__tests__/combat.spec.ts`
Expected: le test Géant PASSE ; le test Géant existant de `keywords.spec.ts` (2 bloqueurs, Force 4) PASSE toujours — vérifier aussi : `npx vitest run src/game/rules/__tests__/keywords.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/game/rules/combat.ts src/game/rules/__tests__/combat.spec.ts
git commit -m "feat(combat): Géant déborde sur la Cible + actif dès 1 bloqueur (6135)"
```

---

## Task 4: Inclinaison des bloqueurs survivants (708.3)

**Files:**

- Modify: `src/game/rules/combat.ts` (fin de `resolveCombat`, avant `return`)
- Test: `src/game/rules/__tests__/combat.spec.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
describe("rules/combat — inclinaison des bloqueurs (708.3)", () => {
  it("un bloqueur survivant est incliné en fin de combat", () => {
    const f = fixture(
      [makeAlly("atk", { force: 1 })],
      [makeAlly("blk", { force: 5 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    const { state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0)],
      blocks: { [instId("B", 0)]: instId("A", 0) },
    });
    expect(state.instances[instId("B", 0)].orientation).toBe("tapped");
  });
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npx vitest run src/game/rules/__tests__/combat.spec.ts -t "inclinaison des bloqueurs"`
Expected: ÉCHEC — le bloqueur reste `upright`.

- [ ] **Step 3: Émettre le tap des bloqueurs survivants**

Dans `src/game/rules/combat.ts`, émettre l'événement `SET_ORIENTATION` brut — même forme que `combatConfirmAttackers`/`combatCancel` du store, sans dépendre d'un helper. Insérer ce bloc juste avant `return { events, log, destroyed, winner, ruleEvents };` (`DraftEvent` est déjà importé) :

```ts
// 708.3 — Fin de Combat : les bloqueurs SURVIVANTS sont inclinés (les
// attaquants l'ont été à la déclaration, A6). Les détruits sont en défausse.
for (const blocker of Object.keys(plan.blocks)) {
  if (destroyed.includes(blocker)) continue;
  const inst = ctx.state.instances[blocker];
  if (!inst || inst.orientation === "tapped") continue;
  events.push({
    actor: atk,
    type: "SET_ORIENTATION",
    payload: { instanceId: blocker, orientation: "tapped" },
  });
}
```

- [ ] **Step 4: Lancer les tests**

Run: `npx vitest run src/game/rules/__tests__/combat.spec.ts`
Expected: tous PASSENT (le test Maître Bolet : le bloqueur survivant est désormais `tapped` — il n'asserte pas l'orientation, donc OK).

- [ ] **Step 5: Commit**

```bash
git add src/game/rules/combat.ts src/game/rules/__tests__/combat.spec.ts
git commit -m "feat(combat): incline les bloqueurs survivants en fin de combat (708.3)"
```

---

## Task 5: Sous-étape `riposte` interactive (store)

**Files:**

- Modify: `src/stores/gameStore.ts` (ref `combat` ~1424, `combatResolve` ~1650, `doResolveCombat` ~1662, exports ~1860)
- Test: `src/stores/__tests__/gameStore.spec.ts`

- [ ] **Step 1: Étendre le type de la ref `combat`**

Dans `src/stores/gameStore.ts`, remplacer le type de `combat` (lignes 1424-1433) par :

```ts
const combat = ref<{
  step: "attackers" | "blockers" | "strikes" | "riposte";
  target: CombatTarget | null;
  attackers: string[];
  blocks: Record<string, string>;
  /** 6105 : attackerId → bloqueur choisi pour encaisser sa Force. */
  strikes: Record<string, string>;
  /** Attaquant dont on choisit actuellement le bloqueur frappé. */
  strikeFor: string | null;
  /** 707.1 : targetId → attaquant frappé par la riposte de la Cible. */
  ripostes: Record<string, string>;
  /** Cible en train de choisir sa riposte (étape riposte). */
  riposteFrom: string | null;
  /** Attaquants candidats à la riposte (≥2 → choix demandé). */
  riposteCandidates: string[];
  /** Bloqueur en attente d'assignation à un attaquant (≥2 attaquants). */
  pendingBlocker: string | null;
} | null>(null);
```

- [ ] **Step 2: Initialiser les nouveaux champs dans `beginCombat`**

Trouver l'initialisation de `combat.value = { step: "attackers", ... }` dans `beginCombat` (~1520-1530). Y ajouter les champs : `ripostes: {}, riposteFrom: null, riposteCandidates: [], pendingBlocker: null`. Run d'aide :

Run: `grep -n "combat.value = {" src/stores/gameStore.ts`

Exemple de forme attendue après édition :

```ts
combat.value = {
  step: "attackers",
  target: null,
  attackers: firstAttacker ? [firstAttacker] : [],
  blocks: {},
  strikes: {},
  strikeFor: null,
  ripostes: {},
  riposteFrom: null,
  riposteCandidates: [],
  pendingBlocker: null,
};
```

- [ ] **Step 3: Ajouter le helper `riposteCandidates` + le getter, et brancher `combatResolve`**

Après `pendingStrikes` (~1446), ajouter :

```ts
/** 707.1 — attaquants libres l'ayant frappée si la Cible est Allié/Héros. */
function riposteCandidatesOf(c: NonNullable<typeof combat.value>): string[] {
  if (!c.target || c.target.kind === "havreSac") return [];
  const blocked = new Set(Object.values(c.blocks));
  return c.attackers.filter((a) => !blocked.has(a));
}

const combatRiposteIds = computed(() =>
  combat.value?.step === "riposte" ? combat.value.riposteCandidates : [],
);
```

Modifier `combatResolve` (~1650-1660) — insérer la décision riposte APRÈS la décision strikes :

```ts
function combatResolve(): void {
  const c = combat.value;
  if (!c || !c.target) return;
  const pending = pendingStrikes(c);
  if (pending.length) {
    c.step = "strikes";
    c.strikeFor = pending[0];
    return;
  }
  // 707.1 — riposte : si ≥2 attaquants libres et pas encore choisi, demander.
  const cands = riposteCandidatesOf(c);
  if (cands.length >= 2 && !c.ripostes[c.target.instanceId]) {
    c.step = "riposte";
    c.riposteFrom = c.target.instanceId;
    c.riposteCandidates = cands;
    return;
  }
  doResolveCombat();
}

/** Le défenseur choisit l'attaquant frappé par la riposte de la Cible (707.1). */
function combatChooseRiposte(attackerId: string): void {
  const c = combat.value;
  if (!c || c.step !== "riposte" || !c.riposteFrom) return;
  if (!c.riposteCandidates.includes(attackerId)) return;
  c.ripostes = { ...c.ripostes, [c.riposteFrom]: attackerId };
  doResolveCombat();
}
```

- [ ] **Step 4: Passer `ripostes` au plan dans `doResolveCombat`**

Dans `doResolveCombat` (~1665), ajouter `ripostes: c.ripostes` à l'objet plan :

```ts
const result = resolveCombat(
  rulesCtx(),
  {
    attackerSeat: turn.value.active,
    target: c.target,
    attackers: c.attackers,
    blocks: c.blocks,
    strikes: c.strikes,
    ripostes: c.ripostes,
  },
  activeGlobalMods(rulesCtx()),
);
```

- [ ] **Step 5: Exporter les nouveaux membres**

Dans le `return { ... }` du store (~1860-1880), ajouter `combatRiposteIds` et `combatChooseRiposte` à côté de `combatStrikeIds`/`combatChooseStrike`.

- [ ] **Step 6: Écrire le test store**

Ajouter à `src/stores/__tests__/gameStore.spec.ts` (réutiliser le motif des tests combat existants ~260-330) un test : deux attaquants libres + cible Allié → `combatResolve()` ouvre l'étape `riposte` ; `combatChooseRiposte(atk2)` résout et atk2 est détruit. Modèle :

```ts
it("riposte : ≥2 attaquants libres ouvrent l'étape riposte, le défenseur choisit", () => {
  // arrange : startSandbox, 2 attaquants A redressés (arrivedTurn passé),
  // 1 Allié B (cible). beginCombat(atk1); combatToggleAttacker(atk2);
  // combatChooseTarget(allyB); combatConfirmAttackers();
  // act : combatResolve()
  expect(store.combat?.step).toBe("riposte");
  // act : combatChooseRiposte(atk2)
  // assert : combat null + atk2 détruit (Force cible ≥ Force atk2)
});
```

> Si le harnais de `gameStore.spec.ts` ne permet pas de poser 2 attaquants redressés simplement, couvrir ce cas en live (Task 9) et garder ici un test minimal : `combatResolve()` avec 1 seul attaquant libre n'ouvre PAS l'étape riposte (auto-résolu).

- [ ] **Step 7: Lancer les tests**

Run: `npx vitest run src/stores/__tests__/gameStore.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts src/stores/__tests__/gameStore.spec.ts
git commit -m "feat(combat): sous-étape riposte interactive si ≥2 attaquants libres (707.1)"
```

---

## Task 6: Assignation des bloqueurs par le défenseur (BLK-01)

**Files:**

- Modify: `src/stores/gameStore.ts` (`combatToggleBlock` ~1613-1644, exports)
- Test: `src/stores/__tests__/gameStore.spec.ts`

- [ ] **Step 1: Remplacer l'auto-assignation par le choix du défenseur**

Dans `combatToggleBlock` (~1613-1644), remplacer la fin de fonction (le bloc `const counts = ...; const least = ...; if (least) c.blocks = ...`) par :

```ts
    // 704 — assignation : 1 seul attaquant → auto ; sinon le défenseur choisit
    // (clic du bloqueur puis clic de l'attaquant via combatChooseBlockTarget).
    if (c.attackers.length === 1) {
      c.blocks = { ...c.blocks, [blockerId]: c.attackers[0] };
    } else {
      c.pendingBlocker = blockerId;
    }
  }

  /** Le défenseur assigne le bloqueur en attente à un attaquant (704). */
  function combatChooseBlockTarget(attackerId: string): void {
    const c = combat.value;
    if (!c || c.step !== "blockers" || !c.pendingBlocker) return;
    if (!c.attackers.includes(attackerId)) return;
    c.blocks = { ...c.blocks, [c.pendingBlocker]: attackerId };
    c.pendingBlocker = null;
  }
```

Et dans la branche de retrait (re-clic d'un bloqueur déjà posé, ~1616-1621), effacer aussi `pendingBlocker` s'il pointe ce bloqueur :

```ts
if (c.blocks[blockerId]) {
  const rest = { ...c.blocks };
  delete rest[blockerId];
  c.blocks = rest;
  if (c.pendingBlocker === blockerId) c.pendingBlocker = null;
  return;
}
```

- [ ] **Step 2: Exporter `combatChooseBlockTarget`**

Ajouter `combatChooseBlockTarget` au `return { ... }` du store, à côté de `combatToggleBlock`.

- [ ] **Step 3: Écrire le test store**

Ajouter à `gameStore.spec.ts` : avec 2 attaquants déclarés, `combatToggleBlock(blk)` ne pose PAS encore le bloc mais arme `pendingBlocker` ; `combatChooseBlockTarget(atk2)` assigne `blocks[blk] === atk2`. (Réutiliser le motif d'arrangement de combat des tests existants.)

```ts
it("multi-bloqueurs : le défenseur choisit l'attaquant gang-bloqué (704)", () => {
  // arrange combat 2 attaquants A + 1 bloqueur B éligible, step 'blockers'
  // act : combatToggleBlock(blk)
  expect(store.combat?.pendingBlocker).toBe(blk);
  expect(store.combat?.blocks[blk]).toBeUndefined();
  // act : combatChooseBlockTarget(atk2)
  expect(store.combat?.blocks[blk]).toBe(atk2);
  expect(store.combat?.pendingBlocker).toBeNull();
});
```

> Si l'arrangement à 2 attaquants est trop lourd dans le harnais store, garder le test du cas simple (1 attaquant → assignation auto, `pendingBlocker` jamais armé) et couvrir le multi en live (Task 9).

- [ ] **Step 4: Lancer les tests**

Run: `npx vitest run src/stores/__tests__/gameStore.spec.ts`
Expected: PASS (et le test multi-bloqueurs existant `combatToggleBlock` toujours vert au cas à 1 attaquant).

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts src/stores/__tests__/gameStore.spec.ts
git commit -m "feat(combat): le défenseur choisit l'assignation multi-bloqueurs (704, BLK-01)"
```

---

## Task 7: UI — routage des clics, surlignages, libellés (GameBoard.vue)

**Files:**

- Modify: `src/components/game/GameBoard.vue` (`select` ~693-705, `slotCls` ~716-731, bannière `.gcombat__step` ~382-390)

- [ ] **Step 1: Router les clics des deux sous-étapes**

Dans `select` (~693-705), remplacer le bloc combat par :

```ts
if (store.combat) {
  if (store.combat.step === "attackers") {
    if (store.combatTargetIds.includes(instanceId))
      store.combatChooseTarget(instanceId);
    else store.combatToggleAttacker(instanceId);
  } else if (store.combat.step === "strikes") {
    store.combatChooseStrike(instanceId);
  } else if (store.combat.step === "riposte") {
    store.combatChooseRiposte(instanceId);
  } else {
    // blockers : si un bloqueur attend, le clic sur un attaquant l'assigne
    if (
      store.combat.pendingBlocker &&
      store.combat.attackers.includes(instanceId)
    )
      store.combatChooseBlockTarget(instanceId);
    else store.combatToggleBlock(instanceId);
  }
  return;
}
```

- [ ] **Step 2: Surlignages des sous-étapes**

Dans `slotCls` (~716-731), remplacer l'objet retourné par :

```ts
return {
  "gslot--atk-can":
    c.step === "attackers" && store.combatAttackerIds.includes(instanceId),
  "gslot--atk":
    c.attackers.includes(instanceId) ||
    (c.step === "strikes" && c.strikeFor === instanceId) ||
    (c.step === "riposte" && c.riposteFrom === instanceId),
  "gslot--target-can":
    (c.step === "attackers" && store.combatTargetIds.includes(instanceId)) ||
    (c.step === "strikes" && store.combatStrikeIds.includes(instanceId)) ||
    (c.step === "riposte" && store.combatRiposteIds.includes(instanceId)) ||
    (c.step === "blockers" &&
      !!c.pendingBlocker &&
      c.attackers.includes(instanceId)),
  "gslot--target": c.target?.instanceId === instanceId,
  "gslot--blk-can":
    c.step === "blockers" && store.combatBlockerIds.includes(instanceId),
  "gslot--blk":
    (c.step === "blockers" && !!c.blocks[instanceId]) ||
    c.pendingBlocker === instanceId,
};
```

- [ ] **Step 3: Libellés de la bannière**

Dans le template, `.gcombat__step` (~382-390), remplacer l'expression par une chaîne couvrant les deux nouveaux cas :

```html
<span class="gcombat__step">
  {{ store.combat.step === "attackers" ? "⚔ Choisis tes attaquants puis une
  cible adverse" : store.combat.step === "strikes" ? "🎯 Choisis le bloqueur qui
  encaisse la Force de l'attaquant en vert" : store.combat.step === "riposte" ?
  "↩ La Cible riposte : choisis l'attaquant qu'elle frappe" :
  store.combat.pendingBlocker ? "🛡 Choisis l'attaquant que ce bloqueur
  affronte" : `🛡 Déclare les bloqueurs de ${store.players[opp].name} (ou «
  Résoudre le combat » pour laisser passer)` }}
</span>
```

- [ ] **Step 4: Garder le bouton « Résoudre » visible pendant `riposte` ? Non.**

Vérifier la condition du bouton « Résoudre le combat » (~v-else-if `store.combat.step === 'blockers'`) : elle reste sur `blockers` uniquement. Pendant `riposte`/`strikes`/`pendingBlocker`, la résolution se fait au clic — aucun changement requis. Vérifier qu'aucun bouton d'action ne s'affiche à tort pendant `riposte`.

- [ ] **Step 5: Vérifier le build**

Run: `npm run build`
Expected: build OK, aucune erreur de type (toutes les propriétés `combat.*` existent).

- [ ] **Step 6: Commit**

```bash
git add src/components/game/GameBoard.vue
git commit -m "feat(combat): UI sous-étapes assignation bloqueur + riposte (BLK-01, 707.1)"
```

---

## Task 8: Validation du deck à l'entrée en partie (ZONE-01)

**Files:**

- Modify: `src/views/PlayTableView.vue` (imports + `launch` ~572-582)

- [ ] **Step 1: Importer `validateDeck`**

Dans `src/views/PlayTableView.vue`, ajouter aux imports (près des autres `@/...`) :

```ts
import { validateDeck } from "@/validators/deck";
```

- [ ] **Step 2: Garder `launch()`**

Remplacer `launch()` (~572-582) par :

```ts
function launch(): void {
  const dA = decks.value.find((d) => d.id === pickA.value);
  const dB = decks.value.find((d) => d.id === pickB.value);
  if (!dA || !dB) return;
  // 101.x — un deck non conforme (≠48, sans Héros/Havre-Sac, copies, réserve)
  // ne peut pas entrer en partie.
  const errs = [...validateDeck(dA).errors, ...validateDeck(dB).errors];
  if (errs.length) {
    toast.addToast(`Deck invalide : ${errs.join(" · ")}`, { type: "warning" });
    return;
  }
  // v1 « Cockatrice » : règles assistées, effets de cartes résolus à la main.
  store.assistEffects = false;
  store.startMatch(dA, dB, { nameA: nameA.value, nameB: nameB.value });
}
```

- [ ] **Step 3: Vérifier le build**

Run: `npm run build`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/views/PlayTableView.vue
git commit -m "feat(jeu): refuse un deck non conforme à l'entrée en partie (101.x, ZONE-01)"
```

---

## Task 9: Vérification globale + rejeu live

**Files:** aucun (vérification).

- [ ] **Step 1: Suite complète**

Run: `npx vitest run`
Expected: tous les tests PASSENT (≥ 601 + nouveaux).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: OK.

- [ ] **Step 3: Rejeu live du repro d'audit (riposte)**

Dans le preview (port 3000, `window.__G`/`window.__snap` en place ; sinon relancer le harnais de la session) : monter un combat où l'attaquant (Héros F1) frappe un Allié cible (F3) non bloqué via `beginCombat`/`combatChooseTarget`/`combatConfirmAttackers`/`combatResolve`. Vérifier que l'attaquant est **détruit** (riposte 3 ≥ 1) et la cible **survit** (1 < 3) — comportement inverse du bug constaté avant la campagne.

- [ ] **Step 4: Rejeu live multi-bloqueurs + riposte multi (interactivité)**

Vérifier qu'avec 2 attaquants libres, `combatResolve()` met `combat.step === "riposte"` et que le clic sur un attaquant résout. Vérifier qu'avec 2 attaquants, cliquer un bloqueur arme `pendingBlocker` puis le clic d'un attaquant l'assigne.

- [ ] **Step 5: Commit (si ajustements) + note finale**

Mettre à jour la mémoire / le suivi : les 5 lacunes traitées. Restent hors périmètre : HS-ZERO, PHASE-01, RES-1/2, att-01, LVL-01, ZONE-02 (suivi séparé).

---

## Self-review (couverture spec)

- Spec §1 simultanéité → Task 2 (map `dmg` + `targetDamageTotal`). ✓
- Spec §2 riposte 707.1 → Task 2 (moteur) + Task 5 (sous-étape). ✓
- Spec §3 BLK-01 → Task 6 (store) + Task 7 (UI). ✓
- Spec §4 Géant overflow + 1 bloqueur → Task 3. ✓
- Spec §5 BLOCKER-NO-TAP 708.3 → Task 4. ✓
- Spec §6 ZONE-01 → Task 8. ✓
- Spec §7 machine d'étapes/UI → Task 5/6/7. ✓
- Spec §8 tests → Tasks 2/3/4 (unit) + 5/6 (store) + 9 (live). ✓
- Spec §9 edge cases → couverts par les tests riposte (cible meurt, multi, Héros) + Géant. ✓

Cohérence de nommage : `ripostes` (plan + ref), `riposteFrom`, `riposteCandidates`, `combatRiposteIds`, `combatChooseRiposte`, `pendingBlocker`, `combatChooseBlockTarget`, `hitTarget`, `targetStrikers`, `targetDamageTotal`, `riposteCandidatesOf`. ✓
