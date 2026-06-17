# Fenêtre de réaction de combat (J3 v1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une fenêtre de réaction manuelle après le blocage (706.5) où le défenseur (et l'attaquant) peut jouer une carte hors de son tour avant la résolution des Dommages.

**Architecture:** Sous-mode `combat.reactingSeat` sur l'étape `blockers` (pas de nouvelle étape, pas de clic en plus pour le chemin par défaut). Deux actions de store (`combatOfferReaction`/`combatEndReaction`) basculent la perspective vers le défenseur via l'overlay de passation existant ; `whyCannotPlay` gagne un drapeau `reaction` qui relâche le seul contrôle « c'est ton tour ». Aucune automatisation d'effet (les effets restent manuels), aucune pile.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vitest. v1 « Cockatrice » : `assist=true`, `assistEffects=false`.

**Spec:** `docs/superpowers/specs/2026-06-17-combat-reaction-window-design.md`

**Vérif globale (fin de chaque tâche moteur/store) :** `npx vitest run src/game/rules/__tests__/legality.spec.ts src/stores/__tests__/gameStore.spec.ts`. Finale : `npx vitest run` + `npm run build` + rejeu live preview (port 3000, `window.__G`/`window.__snap`).

---

## Task 1 : `whyCannotPlay` — drapeau réaction (relâche le contrôle de tour)

**Files:**

- Modify: `src/game/rules/legality.ts:31-55`
- Test: `src/game/rules/__tests__/legality.spec.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `legality.spec.ts` (réutilise `handFixture`/`ctxOf`/`instId` déjà présents dans ce fichier ; un deck B vide place une carte en main de B via le helper du fichier — sinon utiliser le motif `handFixture()` existant et viser le siège qui n'est pas actif) :

```ts
it("réaction : autorise à jouer hors de son tour quand reaction=true (706)", () => {
  const f = handFixture();
  // tour de A (actif) ; B veut jouer en réaction une carte de SA main
  // handFixture met une carte jouable en main de A à l'index 0 ; on teste donc
  // le relâchement du SEUL contrôle de tour : sans reaction → refus de tour,
  // avec reaction=true → null (les autres contrôles passent).
  const id = instId("A", 0);
  // forcer le tour sur B pour que A soit hors-tour
  setTurn(f, "B", 3);
  expect(whyCannotPlay(ctxOf(f), "A", id)).toBe("Ce n'est pas votre tour.");
  expect(whyCannotPlay(ctxOf(f), "A", id, true)).toBeNull();
});
```

> Vérifier les imports en tête du fichier : `whyCannotPlay`, `setTurn`, `instId`, `handFixture`/`ctxOf`. Ajouter `setTurn` à l'import depuis `./harness` s'il manque.

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `npx vitest run src/game/rules/__tests__/legality.spec.ts -t "réaction"`
Expected: ÉCHEC — `whyCannotPlay` ne prend pas encore 4 arguments (ou le contrôle de tour bloque).

- [ ] **Step 3 : Ajouter le paramètre `reaction`**

Dans `src/game/rules/legality.ts`, modifier la signature et le contrôle de tour :

```ts
export function whyCannotPlay(
  ctx: RulesCtx,
  seat: Seat,
  instanceId: InstanceId,
  reaction = false,
): string | null {
  const { state } = ctx;
  const inst = state.instances[instanceId];
  if (!inst) return "Carte introuvable.";
  if (inst.location.zone !== "main" || inst.owner !== seat)
    return "Cette carte n'est pas dans votre main.";
  // 706 — en fenêtre de réaction, on joue HORS de son tour (contrôle relâché).
  if (!reaction && state.turn.active !== seat)
    return "Ce n'est pas votre tour.";
  if (!reaction && state.turn.phase !== "principale")
    return "On ne joue des cartes qu'en Phase Principale.";
  const card = ctx.getCard(inst.cardId);
  if (!card) return "Carte inconnue — jouez-la en mode libre.";
  const dest = playDestination(card, seat);
  if (dest.zone === "monde" && state.turn.number === 1)
    return "Aucune carte ne peut entrer dans le Monde au premier tour de la partie.";
  if (dest.zone === "havreSac" && !havreSacHasRoom(ctx, seat))
    return "Le Havre-Sac est plein (Taille atteinte).";
  const plan = planCost(ctx, seat, card);
  if (!plan.ok) return plan.reason;
  return null;
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npx vitest run src/game/rules/__tests__/legality.spec.ts`
Expected: le nouveau test PASSE ; les anciens (dont « interdit le Monde au premier tour », « pas votre tour ») PASSENT toujours (param optionnel, défaut `false`).

- [ ] **Step 5 : Commit**

```bash
git add src/game/rules/legality.ts src/game/rules/__tests__/legality.spec.ts
git commit -m "feat(combat): whyCannotPlay accepte un mode réaction (hors-tour, 706)"
```

---

## Task 2 : Store — `reactingSeat` + actions de réaction

**Files:**

- Modify: `src/stores/gameStore.ts` (ref `combat` ~1444, `reveal` ~476, `playFromHand` ~680, `combatResolve` ~1674, exports ~1919)
- Test: `src/stores/__tests__/gameStore.spec.ts`

- [ ] **Step 1 : Ajouter `reactingSeat` au type de `combat`**

Dans la ref `combat` (objet `ref<{...}>`), ajouter après `pendingBlocker` :

```ts
/** 706.5 : siège qui réagit HORS de son tour (fenêtre de réaction). */
reactingSeat: Seat | null;
```

Et dans `beginCombat`, l'initialisation `combat.value = { … }` : ajouter `reactingSeat: null,`.

- [ ] **Step 2 : `reveal` conscient de la réaction**

Remplacer `reveal` (~476-479) par :

```ts
function reveal(): void {
  passPending.value = false;
  // En fenêtre de réaction, le hand-off ne déclenche PAS les effets de début
  // de tour (ce n'est pas un nouveau tour, juste une passation de réaction).
  if (combat.value?.reactingSeat) return;
  fireTurnStartEffects();
}
```

- [ ] **Step 3 : `playFromHand` passe le mode réaction**

Dans `playFromHand`, à l'appel de `whyCannotPlay` (~680), passer le drapeau :

```ts
const reason = whyCannotPlay(
  ctx,
  seat,
  instanceId,
  combat.value?.reactingSeat === seat,
);
```

- [ ] **Step 4 : Actions `combatOfferReaction` / `combatEndReaction`**

Juste après `combatResolve` (avant `doResolveCombat` ou après, dans la section combat), ajouter :

```ts
/** 706.5 — l'attaquant cède la main au défenseur pour réagir avant résolution. */
function combatOfferReaction(): void {
  const c = combat.value;
  if (!c || c.step !== "blockers") return;
  const def = otherSeat(turn.value.active);
  c.reactingSeat = def;
  perspective.value = def;
  passPending.value = true; // overlay de passation (cache l'écran)
}

/** Fin de la réaction du défenseur : retour à l'attaquant pour résoudre. */
function combatEndReaction(): void {
  const c = combat.value;
  if (!c) return;
  c.reactingSeat = null;
  perspective.value = turn.value.active;
  passPending.value = false;
}
```

Dans `combatResolve`, en toute première ligne après le garde `if (!c || !c.target) return;`, neutraliser une réaction résiduelle :

```ts
if (c.reactingSeat) {
  c.reactingSeat = null;
  perspective.value = turn.value.active;
}
```

- [ ] **Step 5 : Exporter les nouvelles actions**

Dans le `return { … }` du store, à côté de `combatResolve`, ajouter `combatOfferReaction,` et `combatEndReaction,`.

- [ ] **Step 6 : Écrire les tests store**

Ajouter à `gameStore.spec.ts` (motif des tests combat existants : `smallDeck`, `instOf`, `startSandbox`, `moveTo`, `nextTurn`) :

```ts
it("réaction : l'attaquant cède la main, le défenseur joue hors-tour, puis retour (706.5)", () => {
  const atk = createMockAllyCard({
    id: "ratk",
    name: "RAtk",
    stats: {
      niveau: { value: 1, element: "Feu" },
      force: { value: 2, element: "Feu" },
    },
  });
  const react = createMockActionCard
    ? createMockActionCard({
        id: "rcard",
        name: "RCard",
        stats: { niveau: { value: 1, element: "Terre" } },
      })
    : createMockAllyCard({
        id: "rcard",
        name: "RCard",
        stats: {
          niveau: { value: 1, element: "Terre" },
          force: { value: 1, element: "Terre" },
        },
      });
  useCardStore().cards = [atk, react];
  const store = useGameStore();
  store.startSandbox(smallDeck([atk]), smallDeck([react]), "A");
  const a = instOf(store, "ratk");
  const rc = instOf(store, "rcard");
  store.moveTo(a, { zone: "monde" });
  // mettre la carte de réaction dans la MAIN de B
  store.moveTo(rc, { zone: "main", owner: "B" });
  store.nextTurn();
  store.nextTurn(); // tour 3 (A)
  store.beginCombat(a);
  store.combatChooseTarget(store.state.seats.B.heroInstanceId);
  store.combatConfirmAttackers(); // step blockers
  // l'attaquant cède la main
  store.combatOfferReaction();
  expect(store.combat?.reactingSeat).toBe("B");
  expect(store.perspective).toBe("B");
  expect(store.passPending).toBe(true);
  store.reveal(); // hand-off réaction : pas d'effets de début de tour
  expect(store.passPending).toBe(false);
  // B joue sa carte HORS de son tour → acceptée (légalité de tour relâchée)
  const ok = store.playFromHand(rc);
  expect(ok).toBe(true);
  expect(store.state.instances[rc].location.zone).not.toBe("main");
  // fin de réaction → retour à l'attaquant
  store.combatEndReaction();
  expect(store.combat?.reactingSeat).toBeNull();
  expect(store.perspective).toBe("A");
});
```

> Si `createMockActionCard` n'existe pas dans `tests/factories/card`, le ternaire retombe sur un Allié — le test reste valide (jeu hors-tour d'une carte de la main de B). Vérifier l'import de `createMockAllyCard` (déjà présent) en tête du fichier.

- [ ] **Step 7 : Lancer les tests**

Run: `npx vitest run src/stores/__tests__/gameStore.spec.ts`
Expected: PASS.

- [ ] **Step 8 : Commit**

```bash
git add src/stores/gameStore.ts src/stores/__tests__/gameStore.spec.ts
git commit -m "feat(combat): fenêtre de réaction store — reactingSeat + offer/end (706.5)"
```

---

## Task 3 : UI — boutons & bannière de réaction (GameBoard)

**Files:**

- Modify: `src/components/game/GameBoard.vue` (bannière `.gcombat` ~382-420)

- [ ] **Step 1 : Libellé de bannière + boutons**

Dans le bloc `.gcombat`, remplacer le libellé d'étape pour couvrir le mode réaction, et les boutons pour ajouter « Laisser réagir l'adversaire » (étape blockers, hors réaction) et « Fini de réagir » (mode réaction). Lire d'abord la région exacte, puis :

Libellé (`.gcombat__step`) — ajouter une branche en TÊTE :

```html
store.combat.reactingSeat ? `↩ Réaction de
${store.players[store.combat.reactingSeat].name} — joue puis « Fini de réagir »`
: store.combat.step === "attackers" ? "⚔ Choisis tes attaquants puis une cible
adverse" : /* … branches existantes inchangées … */
```

Boutons (`.gcombat__btns`) — structure :

```html
<div class="gcombat__btns">
  <button
    v-if="store.combat.reactingSeat"
    class="gbtn gbtn--accent"
    @click="store.combatEndReaction()"
  >
    Fini de réagir
  </button>
  <template v-else>
    <button
      v-if="store.combat.step === 'attackers'"
      class="gbtn gbtn--accent"
      :disabled="!store.combat.attackers.length || !store.combat.target"
      @click="store.combatConfirmAttackers()"
    >
      Confirmer l'attaque
    </button>
    <template v-else-if="store.combat.step === 'blockers'">
      <button class="gbtn gbtn--accent" @click="store.combatResolve()">
        Résoudre le combat
      </button>
      <button class="gbtn gbtn--ghost" @click="store.combatOfferReaction()">
        Laisser réagir l'adversaire
      </button>
    </template>
    <button class="gbtn gbtn--ghost" @click="store.combatCancel()">
      {{ store.combat.step === "attackers" ? "Annuler" : "Annuler l'attaque" }}
    </button>
  </template>
</div>
```

> Le `.gcombat__info` existant reste inchangé. En mode réaction, seul « Fini de réagir » s'affiche (pas de Résoudre/Annuler), ce qui évite que le défenseur résolve/annule le combat de l'attaquant.

- [ ] **Step 2 : Vérifier le build**

Run: `npm run build`
Expected: OK (toutes les propriétés `combat.reactingSeat` / actions existent).

- [ ] **Step 3 : Commit**

```bash
git add src/components/game/GameBoard.vue
git commit -m "feat(combat): UI fenêtre de réaction — boutons « Laisser réagir » / « Fini de réagir »"
```

---

## Task 4 : Vérification globale + rejeu live

**Files:** aucun.

- [ ] **Step 1 : Suite complète**

Run: `npx vitest run`
Expected: tous PASSENT (610 + nouveaux).

- [ ] **Step 2 : Build**

Run: `npm run build`
Expected: OK.

- [ ] **Step 3 : Rejeu live (preview port 3000)**

Monter un combat (sandbox via `window.__G`), atteindre l'étape `blockers`, vérifier dans l'UI réelle :

1. La bannière montre « Résoudre le combat » + « Laisser réagir l'adversaire ».
2. Clic « Laisser réagir » → `combat.reactingSeat === 'B'`, `perspective === 'B'`, overlay de passation visible.
3. `reveal()` → overlay disparaît ; depuis la main de B, jouer une carte (drop / `playFromHand`) → acceptée hors-tour.
4. Bannière montre « Fini de réagir » ; clic → retour perspective A.
5. « Résoudre le combat » → résolution normale. Console propre.

- [ ] **Step 4 : Note finale**

Mettre à jour la mémoire si pertinent. Hors périmètre confirmé : pile auto, filtre instant, fenêtres 705/707.3 (v2).

---

## Self-review (couverture spec)

- Spec « pause manuelle / une fenêtre après blocage » → Tasks 2+3 (mode réaction sur l'étape blockers). ✓
- Spec « friction minimale (Résoudre par défaut) » → bouton Résoudre inchangé, « Laisser réagir » optionnel (Task 3). ✓
- Spec « mode réaction relâche le contrôle de tour » → Task 1 (`whyCannotPlay` reaction). ✓
- Spec « passation défenseur via overlay existant » → Task 2 (`combatOfferReaction` pose passPending ; `reveal` reaction-aware). ✓
- Spec « mods appliqués à la résolution » → aucun changement requis (`combatResolve`/`activeGlobalMods` inchangés) ; couvert par la note + rejeu live. ✓
- Spec « hors périmètre v2 » → aucune tâche (assumé). ✓

Cohérence de nommage : `reactingSeat`, `combatOfferReaction`, `combatEndReaction`, `whyCannotPlay(…, reaction)`. ✓
