# Design unifié — Bêta « starters Incarnam » : moteur d'effets complet (Feca + Iop)

> Fusion arbitrée des trois specs d'architectes (J1 effets continus/déclenchés,
> J2 coûts/restrictions, J3 combat/équipements), vérifiée contre le code réel
> au 2026-06-12. Objectif : **les 40 cartes à problème des 2 decks starter
> Incarnam (Poum Ondacié/Feca + Bruss Ouilis/Iop) 100 % automatisées et
> testées, branchées sur l'onboarding** — zéro carte hors périmètre.
>
> Invariants : `src/game/engine` **intouché** (les types d'événements
> `ATTACH`/`DETACH` et `counters.tokens` existent déjà — reducer l. 218–240) ;
> couche `src/game/rules/**` PURE productrice de `DraftEvent` ; principe
> **never-blocking** (l'assistance refuse avec raison ou propose, le mode libre
> reste toujours jouable) ; pas de classes, pas d'enum, TS strict, UI en
> français. Règles citées = lignes de `_incoming/rules-reference.txt`.

---

## 1. Décisions d'arbitrage

Les trois specs se recouvrent sur quatre mécanismes. Une seule implémentation
de chaque est retenue :

| #      | Sujet                                                               | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Justification                                                                                                                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1** | **Bus d'événements de règles**                                      | Le `RuleEvent` + `collectTriggeredEffects` + `processRuleEvents` de J1 est **l'unique** mécanisme de déclenchement. La riposte Prespic devient un trigger compilé `onDamageToBearer` (CARD_SCRIPTS) ; le champ `retaliate` du registre `EQUIPMENT_ATTRS` de J3 est **abandonné**.                                                                                                                                                                                                                                                                                                                                            | Deux chemins de déclenchement (bus + ripostes inline dans `resolveCombat`) divergeraient tôt ou tard ; le bus est conforme 804.7 (déclenché APRÈS résolution complète) et accueille le `tapped` du Glyphe Incandescent sans refonte.                                                          |
| **A2** | **Passe unique de modificateurs de Dommages**                       | `reduceDamage()` de J3 (`damageMods.ts`) est **l'unique** point de prévention : Résistance (7469, via `effectiveKeywords`) → réductions continues (`StaticAbility.combatDamageReduction`, Poum) → `protectCombatants` (Glyphe Revigorant) → `treve`, plancher 0 (7482). Le registre `SELF_COMBAT_DAMAGE_REDUCTION` de J3 est **abandonné** : Poum est compilé par la grammaire statique de J1.                                                                                                                                                                                                                               | La grammaire est le seul chemin qui atteint les faces recto/verso des Héros (`CARD_SCRIPTS` ne touche que `card.effects`, vérifié `compileEffects.ts` l. 221) ; un registre dupliquerait une donnée compilable. L'ordre des soustractions est commutatif, Trêve absorbante — pas d'ambiguïté. |
| **A3** | **Couche unique de stats effectives**                               | `effectiveForce(ctx, id, stance?)` (signature existante + paramètre optionnel) compose TOUT : base (imprimée ou `forceEqualsHandSize`, 812.2) + auras 805.2 + `teamForceMod` de siège (812.3b) + `forceWhileBlocking` (805.1) + **`equipmentForceBonus` + bonus de panoplies** (J3, 403.1a) + jetons `forceMod`/`forceCombatMod`, clamp ≥ 0. `effectiveKeywords(ctx, id)` (un seul, dans `effects/keywords.ts`) fusionne mots-clés imprimés (en ignorant `keywords[]` des cartes Équipement — faux positif Scaranneau) + jetons (`resMod_<el>`, `geantMod`, `geantCombatMod`) + Résistances/Géant conférés par l'équipement. | J1 et J3 étendaient chacun `effectiveForce` ; J1, J2 et J3 définissaient chacun un `effectiveKeywords`/`instanceCombatKeywords`. Une seule fonction par stat, trois sources additives.                                                                                                        |
| **A4** | **Format unique de coût structuré et de X**                         | `CompiledCostPart[]` + `x?: { from: "levelPaid" }` + `EffectFrame.x` + `bindX` de J2, intégralement. Le drapeau `xCost?: boolean` de J3 est **abandonné** : Colère de Iop compile avec `x: { from: "levelPaid" }`, exactement comme Repos (207.3/808.2c).                                                                                                                                                                                                                                                                                                                                                                    | Pas deux représentations de X. Le staging `costPicking`/`xPrompt` (rien n'est dispatché avant confirmation, 418.8/808.2) couvre les deux specs.                                                                                                                                               |
| **A5** | **Classification rulings/erratas**                                  | Champ `CardEffect.kind?: "ruling" \| "errata"` écrit DANS les données par `compileEffects.ts` : (1) **auto-détection** — un `effects[i].description` dont le texte normalisé figure aussi dans `card.notes[]` est un ruling (errata si préfixé « Cette carte a reçu un … errata ») ; (2) entrées explicites `CARD_SCRIPTS` de forme `{ kind: "ruling" \| "errata" }` pour les cas non dupliqués. `printedEffects(card)` (dsl.ts) filtre sur `kind` et remplace le comptage actuel de `playFromHand` (l. 542).                                                                                                                | Remplace à la fois le filtre runtime « description ∈ notes[] » de J1 (devient trivial) et le `null` de J3 (explicite > null). C'est un fix de données (J0), pas une défense runtime.                                                                                                          |
| **A6** | **Inclinaison des attaquants à la déclaration**                     | Les `tap()` des attaquants sont dispatchés par `combatConfirmAttackers()` et **retirés** de `resolveCombat` (l. 80).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Prérequis de fidélité d'Exclusion (705.6 : « retourne incliné ») et de l'ordre Bruss (jetons posés avant résolution) ; conforme 703. Adapter `combat.spec.ts` (les events changent d'endroit, pas de sémantique).                                                                             |
| **A7** | **Glyphe Incandescent automatisé** (J1 le déclarait hors périmètre) | Avec la fenêtre d'actions de J3 (step `"actions"`), le déclencheur « chaque fois qu'un attaquant ou bloqueur s'incline dans ce combat, jusqu'à la fin de la Phase d'Actions » a une portée temporelle **exacte** : le mod `tapTrap` vit dans `combat.value.mods`, naît quand le Glyphe est joué (forcément pendant la fenêtre), meurt au passage en `strikes` (couvre le ruling « pas pendant la Fin de Combat »). Les inclinaisons de déclaration d'attaquants précèdent la fenêtre — exclues par construction.                                                                                                             | Zéro approximation : la carte sort du périmètre « manuel ».                                                                                                                                                                                                                                   |
| **A8** | **Choix du Porteur**                                                | `whyCannotPlay` refuse un Équipement sans Porteur légal (305.3, mode assisté) ; après paiement, pause de ciblage existante (`effectTargeting`) avec op `chooseBearer` sur les `eligibleBearers` de J3 (slots 305.5, non-Monstre) ; le bouton « Passer » existant reste (never-blocking — Équipement orphelin toléré, ses triggers dorment via la garde `bearerOf`).                                                                                                                                                                                                                                                          | Fusion J1 (réutilisation du mode ciblage, Passer) + J3 (éligibilité slots, refus pré-paiement).                                                                                                                                                                                               |

Divergences mineures tranchées : `element` des formes compilées en casse
canonique `"Feu"`/`"Terre"` (comme les 136 effets existants), comparaisons via
`normElement` ; `EffectCondition` structurée (`{ kind: "bearerInCombat" }`,
pas la string littérale de J3) ; `bearerOf` vit dans `equipment.ts` (J3),
`heroLevel`/`staticAbilitiesOf`/`cannotBlock`/`attackPmBonus` dans
`modifiers.ts` (J1) ; la purge de fin de tour devient le prédicat
`isTurnToken(name)` de J2 (remplace la liste en dur de `nextTurn` l. 1395).

---

## 2. Corrections des specs contre le code réel

Vérifié fichier par fichier ; les specs sont corrigées comme suit :

1. **`EffectResolution` vit dans `effects/targeting.ts`** (l. 79), pas dans
   `rules/types.ts` (J1 §1.2 le plaçait au mauvais endroit). `ruleEvents?` s'y
   ajoute en optionnel (non cassant). `RuleEvent`, `CombatStance`, `DamageMod`
   vont dans `rules/types.ts`, ré-exportés par le barrel `rules/index.ts`.
2. **`CombatStance` unifié** : `{ attackers, blocks, targetId }` (J1). Le
   `CombatRoles` de J3 (avec `blockers[]`) est abandonné — les bloqueurs se
   dérivent de `blocks`.
3. **`CARD_SCRIPTS` ne touche que `card.effects`** (`compileEffects.ts`
   l. 221–230) — confirmé : Poum/Bruss (faces Héros) passent
   OBLIGATOIREMENT par les grammaires `compileStaticEffectText` /
   `compileCombatTriggerText`, appliquées aussi à `recto.effects` /
   `verso.effects` (déjà le cas pour les autres grammaires, l. 211–218).
4. **`activateTapPower` actuel** (gameStore l. 1037) : exige `upright`,
   n'exécute que `atoms[0]`, exige son tour. Devient `activatePower(instanceId,
atomIdx = 0)` (alias conservé) : redressée exigée **seulement si** le coût
   contient `tapSelf` (802.4) ; hors-tour autorisé **uniquement** pour les
   pouvoirs `condition: { kind: "bearerInCombat" }` pendant la fenêtre de
   combat (cas Dora-bloqueur).
5. **`pendingStrikes` du store** (l. 1182) lit `combatKeywords(card)` sans
   face ni contexte : migrer vers `effectiveKeywords(ctx, id)` — sinon le
   Géant du Marcassin et le `geantCombatMod` de Bruss verso sont invisibles
   au choix de frappe.
6. **`GameCard.vue` lit `tokens.forceMod` en direct** (l. 128) : migrer vers
   un `effectiveForceOf(instanceId)` exposé par le store (delta total affiché)
   — sinon auras, Vrombyx, équipements et Stratégie de Groupe sont invisibles.
7. **`ATTACH` retire l'Équipement de sa zone** et le co-localise avec son
   Porteur (reducer l. 222–226) : après `ATTACH`, l'Équipement n'est plus dans
   `state.monde`. Conséquences : (a) la destruction d'un Équipement attaché
   passe par **`DETACH` (avec `to: defausse`)**, pas par `MOVE` ; (b) le
   rendu UI des Équipements attachés se fait via `attachments` du Porteur,
   pas via la zone ; (c) après un déplacement Monde↔Havre-Sac du Porteur,
   re-dispatcher `ATTACH` (idempotent) pour re-co-localiser.
8. **`resolveDestroyTarget` crédite toujours l'XP** à l'adversaire du
   contrôleur (targeting.ts l. 101). Les auto-destructions (op `destroySelf`,
   `overuse` Katsou, entretien Chacha/Forêts/Marcassin) ne passent **pas**
   par lui (déjà le cas pour `destroySelf` dans `runFrame`) — cohérent avec
   la lecture J2 de 415.1. Question de règle consignée (§9.6).
9. **« 136 effets compilés »** (J2) : exact (`grep -c '"compiled"'
public/data/*.json` = 136). Toute extension reste additive : aucun champ
   existant ne change de sens.
10. **`matchesPickFilter`** : `filter.mainType` doit devenir réellement
    optionnel dans `runFrame.searchDeck` (`...(op.what ? { mainType: op.what }
: {})`) pour le Bouftou Royal (`searchDeck` sans `what`, ruling famille).
11. **`combat.value` n'est pas événementiel** (mods, fenêtre, challenge) — un
    undo pendant un combat peut désynchroniser l'UI : limitation préexistante,
    documentée au CDC, aggravée à la marge seulement (§9.5).

---

## 3. Architecture unifiée

```
                     ┌──────────────────────────────────────────────────────┐
                     │  DONNÉES public/data/*.json (compileEffects.ts)      │
                     │  effects[].compiled  +  effects[].kind (ruling/…)    │
                     │  + CARD_SCRIPTS (manuel) + grammaires DSL (auto)     │
                     └──────────────────────────────────────────────────────┘
   COUCHE DÉRIVÉE (recalculée à chaque lecture — jamais d'événement)
   • staticAbilitiesOf(card, face)      modifiers.ts   (812.2 / 805)
   • effectiveForce(ctx, id, stance?)   stats.ts       = base|handSize + auras
       + teamForceMod + whileBlocking + équipement/panoplies + forceMod + forceCombatMod
   • effectiveKeywords(ctx, id)         keywords.ts    = imprimé + resMod_/geantMod + équipement
   • cannotBlock / heroLevel / bearerOf / completePanoplies / xpGainBonus
   JETONS DÉFINIS (posés par events, donc undo/replay-compatibles)
   • forceMod, paMod, pmMod (existants) · teamForceMod (Héros) ·
     forceCombatMod/pmCombatMod/geantCombatMod (fin de combat + tour) ·
     resMod_<el>, geantMod, coupCritique, powerUses<i>, metier_<nom>,
     treveUntilTurn — purge : isTurnToken() dans nextTurn / clearCombatMods()
   PASSE UNIQUE DE DOMMAGES        damageMods.ts
   • reduceDamage(ctx, hit, mods, stance) : Résistance → réductions continues
     (Poum) → protectCombatants (Glyphe Revigorant) → treve → plancher 0
   • consultée par resolveCombat, resolveDamageTarget, damageOppHero, resolveDuel
   BUS DE DÉCLENCHEMENT            triggers.ts
   • RuleEvent { damageDealt | attackerDeclared | tapped } émis par les
     résolutions pures à côté de leurs DraftEvent (jamais persisté)
   • collectTriggeredEffects (pur) → store.processRuleEvents → effectQueue
   COÛTS STRUCTURÉS                costs.ts / limits.ts / range.ts
   • CompiledCostPart[] payé AVANT résolution, atomiquement (418.8/808.2) ;
     X annoncé (levelPaid) ou lié (bindX) ; portée 508.1 opt-in (respectRange)
   ORCHESTRATION                   gameStore.ts
   • effectQueue/pumpEffects/runFrame (existants) + pauses : costPicking,
     xPrompt, effectOptions, combatInteraction, challenge, chooseBearer
   • machine de combat : attackers → blockers → ACTIONS (705) → strikes → resolve
```

### 3.1 Extensions de types consolidées (`src/types/cards.ts`)

```ts
// ── Pouvoirs continus (805 / 812.2) — couche dérivée ────────────────────────
export type StaticAbility =
  | { kind: "forceAura"; n: number; sub: string } // Chef de Guerre
  | { kind: "forceWhileBlocking"; n: number } // Maître Bolet
  | { kind: "forceEqualsHandSize" } // Vrombyx
  | { kind: "cannotBlock" } // Jicé Aouaire
  | { kind: "combatDamageReduction"; n: number }; // Poum Ondacié

// ── Coûts composés (802.1 / 418.8) ──────────────────────────────────────────
export type CompiledCostPart =
  | { pay: "tapSelf" }
  | { pay: "sacrificeSelf" }
  | { pay: "discardFromHand"; n: number } // Bwork Mage
  | {
      pay: "recycleFromDiscard";
      n: number;
      upTo?: boolean;
      element?: CardElement;
      bindX?: true;
    } // Parchemins
  | { pay: "tapOwnAllyOrHero"; bindX?: "force" } // Agression, Défi
  | { pay: "resources"; n: number; element?: CardElement }; // Katsou, Amar

export type EffectCondition =
  | { kind: "heroInHavreSac" } // Repos
  | { kind: "justPlayedSub"; anyOf: string[] } // Fécaline
  | { kind: "bearerInCombat" }; // Dora

// ── Nouvelles ops (ajouts à l'union CompiledEffectOp) ───────────────────────
//   [lot C] combatModSelf{force?,pm?,geant?} · damageTriggerSource{n,element}
//           · buffForceAlliesMondeTurn{n:number|"heroLevel"} · globalDamageShield
//   [lot D] produceResource{element} · tapTarget{heroes,requireNoEquipment?,zones,respectRange?}
//           · drawXpOfTarget{zones,respectRange?} · doubleForceTarget{heroes,zones,
//             respectRange?,oncePerTargetToken?} · grantResistanceTurnTarget{n,
//             element:CardElement|"choice",heroes,zones,respectRange?}
//           · untapAllOwn{sub,zones} · gainProfessionTurnSelf
//   [lot E] removeFromCombat · placeBlocker · distributeDamage{element}
//           · combatDamageShield{n} · combatTapTrap{n,element} · duelChallenge
//   [lot F] chooseBearer
// ── Extensions d'ops EXISTANTES (champs optionnels, rétro-compatibles) ──────
//   recycleFromDiscard  + element?: CardElement                       [lot A]
//   damageTarget        + nX?: true ; respectRange?: true             [lot D]
//   buffForceTarget     + nX?: true ; respectRange?: true ; geantIfSub?: string
//   heroGainPv          + nX?: true
//   searchDeck          : `what` devient optionnel (famille seule)    [lot D]

export interface CompiledEffect {
  trigger:
    | "onArrive"
    | "onTap"
    | "onPlay"
    | "onTurnStart" // existants
    | "static" // pouvoir continu : `static` requis, ops: []  [B]
    | "onSelfAttacks" // « Quand [self] attaque » (804.5)            [C]
    | "onDamageToBearer" // riposte Prespic (804.3)                     [C/F]
    | "onPay"; // pouvoir à paiement sans inclinaison (802.1) [D]
  optional?: boolean;
  cost?: "sacrificeSelf" | CompiledCostPart[]; // union rétro-compatible [D]
  orElse?: "destroySelf";
  static?: StaticAbility; // ssi trigger === "static"
  oncePerTurn?: boolean; // 802.6, par instance   [D]
  overuse?: { over: number; then: "destroySelfAtEndOfTurn" }; // Katsou   [D]
  x?: { from: "levelPaid" }; // 207.3/808.2c          [D]
  condition?: EffectCondition; //                       [D]
  reaction?: true; // informatif (809.1)    [D]
  window?: "combat"; // jouable en 705.1 seult [E]
  ops: CompiledEffectOp[];
}

export interface CardEffect {
  // … champs existants …
  /** Texte NON imprimé (note de règle / errata du site) : exclu du comptage
   *  d'effets et de toute compilation. Posé par compileEffects (lot A). */
  kind?: "ruling" | "errata";
}
```

`CARD_SCRIPTS` devient `Record<string, Record<number, CompiledEffect | {
kind: "ruling" | "errata" }>>`.

### 3.2 `src/game/rules/types.ts`

```ts
export type RuleEvent =
  | {
      kind: "damageDealt";
      source: InstanceId | null;
      target: InstanceId;
      amount: number;
      element: string;
      combat: boolean;
    } // jamais émis à ≤ 0 (811.4)
  | { kind: "attackerDeclared"; seat: Seat; instanceId: InstanceId }
  | { kind: "tapped"; instanceId: InstanceId; duringCombatActions: boolean }; // [E]

export interface CombatStance {
  attackers: InstanceId[];
  blocks: Record<InstanceId, InstanceId>; // blockerId → attackerId
  targetId: InstanceId | null; // null = Havre-Sac / aucune
}

export type DamageMod =
  | { kind: "treve" } // token Héros
  | { kind: "protectCombatants"; seat: Seat; n: number } // combat.mods
  | {
      kind: "tapTrap";
      seat: Seat;
      n: number;
      element: string; // combat.mods
      sourceName: string;
    };

// CombatResult gagne `ruleEvents: RuleEvent[]` ;
// EffectResolution (targeting.ts) gagne `ruleEvents?: RuleEvent[]`.
```

### 3.3 Nouveaux modules (tous purs)

| Module                            | Contenu (signatures clés)                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules/modifiers.ts` [B]          | `staticAbilitiesOf(card, side)`, `cannotBlock(ctx,id)`, `heroLevel(ctx,seat): 1\|2\|3`, `attackPmBonus(ctx, attackerIds)`                                                                                                                                                                                                                                                                                                                             |
| `rules/destruction.ts` [B]        | `stateBasedDestroyEvents(ctx, stance?)` — Allié à Force 0 (1414) ou Dommages ≥ Force (3019), une passe ; le store reboucle (point fixe ≤ 32)                                                                                                                                                                                                                                                                                                          |
| `rules/effects/damageMods.ts` [C] | `reduceDamage(ctx, hit, mods, stance)`, `activeGlobalMods(ctx)` (token `treveUntilTurn`)                                                                                                                                                                                                                                                                                                                                                              |
| `rules/effects/triggers.ts` [C]   | `collectTriggeredEffects(ctx, evts): TriggeredFrame[]` — frames du joueur actif d'abord (approx. 804.6) ; `onDamageToBearer` filtre source Allié/Héros (pas de boucle Cape↔Cape : la riposte a un Équipement pour source)                                                                                                                                                                                                                            |
| `rules/effects/costs.ts` [D]      | `costPartsOf`, `whyCannotPayCost`, `costEligibleIds`, `payCostEvents` (recycles SOUS la pioche 3389, `x` lié, `rangeFrom`), `costLabel`                                                                                                                                                                                                                                                                                                               |
| `rules/effects/range.ts` [D]      | `rangeAllows(ctx, source, targetId, reachOppHavreSac?)` — 508.1a/b/c + 508.4, **opt-in** via `respectRange` (les 136 effets existants inchangés)                                                                                                                                                                                                                                                                                                      |
| `rules/effects/limits.ts` [D]     | `powerUsesToken(idx)`, `whyPowerLimited(…, justPlayed)`, `isTurnToken(name)` (forceMod, paMod, pmMod, geantMod, coupCritique, teamForceMod, \*CombatMod, préfixes resMod*/powerUses/metier*, treveUntilTurn expiré)                                                                                                                                                                                                                                   |
| `rules/equipment.ts` [F]          | `slotOf`, `eligibleBearers` (305.3/305.5, 2 Anneaux ≠), `bearerOf`, `completePanoplies` (pièces différentes, l. 3148), `equipmentForceBonus`, `equipmentResistances` (registres SEULS, jamais `keywords[]`), `equipmentGrantsGeant`, `xpGainBonus` (l. 4091, gains > 0 seulement), `destroyEquipmentEvents` (DETACH→défausse + retrait PV 403.2c + létalité 403.2a), `bearerLeavesPlayEvents` (2237) + registres `EQUIPMENT_ATTRS` / `PANOPLIES` (§5) |

Modules étendus : `dsl.ts` (+ `compileStaticEffectText`,
`compileCombatTriggerText` — regex de J1 §2.3 —, `printedEffects`,
`resourcePowerElements`, `activablePowers` ; `tapPowers` délègue),
`stats.ts` (`effectiveForce` composée, §A3), `keywords.ts`
(`effectiveKeywords(ctx,id)` ; `combatKeywords` ignore les `keywords[]` des
Équipements), `combat.ts` (stance, `reduceDamage`, `ruleEvents`, tap retiré),
`targeting.ts` (`opts {sourceId, stance, mods}`, nouveaux résolveurs,
`resolveDuel`), `legality.ts` (`cannotBlock` dans `eligibleBlockers`,
`playConditionOf`/`whyConditionFails`, coût additionnel dans `whyCannotPlay`,
`whyCannotPlayInCombat`), `resources.ts` (`powerElements`, `planCostN`),
`progress.ts` (`grantXpEvents` + `xpGainBonus` si amount > 0).

### 3.4 Points d'accroche `gameStore.ts` (consolidés)

| Fonction                                                    | Lot     | Modification                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EffectFrame`                                               | C/D     | + `x?: number`, `rangeFrom?: string`, `triggerCtx?: { otherId?: string }` (préservés par `holdRest`, qui spreade déjà)                                                                                                                                                                                                                                       |
| `processRuleEvents(evts)` **nouveau**                       | C       | entonnoir unique : `collectTriggeredEffects` → `say` + `enqueueEffect` ; no-op si `!assist` ou file morte                                                                                                                                                                                                                                                    |
| `combatConfirmAttackers`                                    | C       | + dispatch des `tap()` des attaquants (A6) ; + `processRuleEvents(attackerDeclared…)` (Bruss pose ses jetons AVANT résolution)                                                                                                                                                                                                                               |
| `combatToggleAttacker`                                      | C       | plafond `pm + attackPmBonus(ctx, [...attackers, id])` (ruling Bruss : avant vérification de légalité)                                                                                                                                                                                                                                                        |
| `doResolveCombat`                                           | C       | passe `stance` + `mods` au plan ; `clearCombatMods()` (aussi dans `combatCancel`/`quitMatch`) ; `processRuleEvents(result.ruleEvents)` puis `checkVictory()`                                                                                                                                                                                                 |
| `runFrame`                                                  | C–F     | nouvelles branches d'ops (§3.1) ; n effectif `= op.nX ? frame.x ?? 0 : op.n` (≤ 0 → « X = 0, effet sans objet ») ; gardes anti-softlock : tout pick `mandatory` ouvert sur liste FILTRÉE non vide ; `produceResource` ignoré avec journal défensif (803.3 : jamais en file)                                                                                  |
| `playFromHand`                                              | A,D,E,F | `effectsCount` via `printedEffects` [A] ; garde 808.1 (file vide) ; `xPrompt` si `x:{from:"levelPaid"}` ; `pendingPlay` + `costPicking` si coût interactif (annulation = zéro event) ; pose `justPlayed` ; fenêtre de combat → `whyCannotPlayInCombat` [E] ; Équipement → refus sans Porteur légal puis ciblage `chooseBearer` + `ATTACH` + PV éventuels [F] |
| `activatePower(id, atomIdx)` (ex-`activateTapPower`, alias) | D       | `activablePowers` (exclut les Pious) ; `whyPowerLimited` (802.6, conditions) ; `whyCannotPayCost` ; redressée ssi coût `tapSelf` ; `INC powerUses<idx>` ; hors-tour ssi `bearerInCombat` + fenêtre ouverte [F]                                                                                                                                               |
| `effectTargetChoose`                                        | C,D,F   | passe `{ sourceId, stance: currentStance(), mods }` à `resolveDamageTarget` ; branche les nouveaux résolveurs ; cas `chooseBearer` → `resolveChooseBearer` ; `processRuleEvents(res.ruleEvents ?? [])`                                                                                                                                                       |
| `fireTurnStartEffects`                                      | D       | payabilité AVANT le choix `orElse` : défausse filtrée (élément) vide → `declineOps` directs + journal (804.8, exemple officiel = Chacha)                                                                                                                                                                                                                     |
| `endTurn`                                                   | D       | contrôle `overuse` (Katsou : > 3 activations → défausse SANS XP) ; reset `justPlayed`                                                                                                                                                                                                                                                                        |
| `nextTurn`                                                  | C/D     | purge par `isTurnToken(name)` (remplace la liste en dur)                                                                                                                                                                                                                                                                                                     |
| `checkVictory`                                              | B       | boucle point-fixe `stateBasedDestroyEvents` (≤ 32) AVANT égalité/victoire ; nouveaux sites d'appel : fin de `moveTo`, fin de `pumpEffects` (file vide, avant `enforceHandLimit`)                                                                                                                                                                             |
| `combat.value`                                              | E       | + `step: "actions"`, `mods: DamageMod[]`, `actionTurn: Seat`, `passes: number`, `orphanBlockers: string[]` ; nouvelles fns `combatConfirmBlockers`, `combatPassAction` (2 passes → résolution, 705.5), `combatReassignBlocker` (705.4)                                                                                                                       |
| Pauses nouvelles                                            | D,E,F   | `costPicking`, `xPrompt`, `effectOptions`, `pendingPlay`/`pendingActivation`, `combatInteraction` (exclude/distribute), `challenge` (Défi), ciblage `chooseBearer` — toutes réinitialisées dans `startMatch`/`quitMatch` ; `pumpEffects` s'arrête aussi sur `effectOptions`                                                                                  |
| `moveTo`                                                    | F       | re-dispatch `ATTACH` des attachements après déplacement Monde↔Havre-Sac du Porteur (l. 3948, idempotent)                                                                                                                                                                                                                                                    |
| Destructions                                                | F       | tout chemin détruisant un Allié/Héros enchaîne `bearerLeavesPlayEvents` ; un Équipement → `destroyEquipmentEvents`                                                                                                                                                                                                                                           |
| Hook `tapped`                                               | E       | tout dispatch `SET_ORIENTATION→tapped` sur un combattant pendant `step === "actions"` émet `RuleEvent tapped` → mods `tapTrap` de `combat.mods` enfilent une frame de dommages (Glyphe Incandescent)                                                                                                                                                         |

---

## 4. UI minimale (français)

Composants : `GameBoard.vue`, `GameCard.vue`, `PlayTableView.vue`.

1. **Force effective** : `effectiveForceOf(id)` exposé par le store ;
   pastille de delta total (vert/rouge) remplaçant la pastille `forceMod`.
2. **Bouton de pouvoir généralisé** (onTap + onPay) avec `costLabel` et motif
   de refus en clair (« Déjà utilisé ce tour », « Jouez d'abord une Quête ou
   un Parchemin », « Coût impayable », « Pas pendant une résolution »).
3. **Mode paiement** (`costPicking`) : surbrillance des éligibles, compteur
   « 2 / 3 », boutons « Payer et résoudre » / « Annuler » (rien n'est joué).
4. **Stepper X** (`xPrompt`), **choix d'option** (`effectOptions` : éléments
   pour Temple Féca, Métiers pour Amar Casto — pas de bouton Passer, 804.4).
5. **Fenêtre de combat** : bandeau « Phase d'Actions — au tour de {nom} »,
   « Passer » (705.2), passation d'appareil si `actionTurn ≠ perspective` ;
   double passe → résolution. Bloqueurs orphelins en pulsation (705.4).
6. **Défi** : bannière « {Nom}, acceptez-vous le Défi ? » Accepter / Refuser
   (l'adversaire gagne 1 XP). **Colère** : overlay de répartition avec badges.
7. **Équipements** : mini-cartes empilées sous le Porteur (rendu via
   `attachments` — ils ne sont plus dans la zone, §2.7), « Choisissez le
   Porteur de … » au ciblage, pastille « Panoplie complète ».
8. **Badges d'état** : « Trêve active (Dommages → 0) », « Glyphe Revigorant
   −1 », « +1 Rés. [Feu] (fin du tour) », « Géant (fin du tour) », « Métier :
   Forgeron », « Produit [Feu] » (Pious — plus de bouton Activer pour eux).
9. **Jicé** : `combatToggleBlock` explique le refus au clic (aujourd'hui
   silencieux).

---

## 5. Registres (source de vérité tant que J0-données n'a pas réinjecté les stats perdues au scraping)

```ts
// rules/equipment.ts — bonus PERDUS dans incarnam.json (vérifié : stats.niveau seul)
export const EQUIPMENT_ATTRS: Record<string, EquipmentAttrs> = {
  "dora-incarnam": { force: 2 },
  "marcassin-incarnam": { force: 1, grantsGeant: true },
  "cape-du-prespic-incarnam": { panoplie: "Prespic" }, // riposte → CARD_SCRIPTS (A1)
  "anneau-du-prespic-incarnam": { panoplie: "Prespic" },
  "ceinture-du-prespic-incarnam": { pv: 2, panoplie: "Prespic" },
  "coiffe-du-bouftou-incarnam": { force: 2, panoplie: "Bouftou" },
  "marteau-du-bouftou-incarnam": { force: 1, panoplie: "Bouftou" },
  "scaranneau-blanc-incarnam": { pv: 2, panoplie: "Scarafeuille Blanc" },
  "chacha-noir-incarnam": { force: 2 },
};
export const PANOPLIES: Record<string, PanoplieBonus> = {
  Prespic: { pieces: 3, xpGainBonus: 1 }, // errata officiel
  Bouftou: { pieces: 3, force: 2 },
  "Scarafeuille Blanc": { pieces: 3, force: 1, pv: 4, resistances: { air: 1 } },
};
```

⚠ Le `keywords[1] « Résistance 1 Air »` du Scaranneau dans les données est un
morceau de bonus de panoplie scrapé à tort sur la carte seule :
`combatKeywords` ignore les `keywords[]` des Équipements (lot A), seules les
panoplies COMPLÈTES confèrent la Résistance via `equipmentResistances`.

---

## 6. Récapitulatif par carte (40 cartes des 2 starters)

Légende voie : **DSL** = grammaire auto-compilée · **SCRIPT** = `CARD_SCRIPTS`
· **REG** = registres équipement · **KIND** = classification ruling/errata
(auto-détection notes[] sauf mention). Lot = lot qui rend la carte 100 % auto.

### Deck Feca (Poum Ondacié)

| Carte                        | Voie                | Forme compilée cible (résumé)                                                                                                                                                                                               | Lot                 |
| ---------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **Poum Ondacié** (Héros)     | DSL                 | recto/verso : `{trigger:"static", static:{kind:"combatDamageReduction", n:1\|2}}` — consommé par `reduceDamage`                                                                                                             | B (compil.) → **C** |
| **Piou Rouge**               | SCRIPT              | `0: {trigger:"onTap", ops:[{op:"produceResource", element:"Feu"}]}` — hors file (803.3), intégré à `planCost` ; `1: {kind:"ruling"}`                                                                                        | **D**               |
| **Vrombyx**                  | DSL                 | `{trigger:"static", static:{kind:"forceEqualsHandSize"}}` + destruction d'état 1414                                                                                                                                         | **B**               |
| **Bwork Mage**               | SCRIPT              | `{trigger:"onPay", cost:[{pay:"discardFromHand", n:1}], oncePerTurn:true, ops:[{op:"damageTarget", n:1, element:"Feu", heroes:true, zones:[…], respectRange:true}]}` (le `isOncePerTurn:false` des données est un artefact) | **D**               |
| **Amar Casto**               | SCRIPT              | `{trigger:"onPay", cost:[{pay:"resources", n:1}], ops:[{op:"gainProfessionTurnSelf"}]}` — marqueur informatif (fabrication 418.6 = manuelle, hors bêta)                                                                     | **D**               |
| **Fécaline la Sage**         | SCRIPT              | `{trigger:"onTap", reaction:true, condition:{kind:"justPlayedSub", anyOf:["quete","parchemin"]}, ops:[{op:"gainXp", n:1}]}` — fenêtre = son tour, juste après SA Quête/Parchemin (réaction au tour adverse : manuelle, §8)  | **D**               |
| **Parchemin d'Intelligence** | SCRIPT              | `{trigger:"onPlay", cost:[{pay:"recycleFromDiscard", n:3, upTo:true, element:"Feu", bindX:true}], ops:[{op:"damageTarget", n:0, nX:true, element:"Feu", heroes:true, respectRange:true, …}]}`                               | **D**               |
| **Défi**                     | SCRIPT              | `{trigger:"onPlay", ops:[{op:"duelChallenge"}]}` — incline un des vôtres, cible, bannière Accepter/Refuser, `resolveDuel` (Forces simultanées) ou +1 XP                                                                     | **E**               |
| **Prospection**              | SCRIPT + KIND       | `0: {trigger:"onPlay", ops:[{op:"drawXpOfTarget", zones:["monde"], respectRange:true}]}` ; `1` ruling                                                                                                                       | **D**               |
| **Glyphe Revigorant**        | SCRIPT              | `{trigger:"onPlay", window:"combat", ops:[{op:"combatDamageShield", n:1}]}` — mod du combat courant, meurt avec lui                                                                                                         | **E**               |
| **Glyphe Incandescent**      | SCRIPT + KIND       | `0: {trigger:"onPlay", window:"combat", ops:[{op:"combatTapTrap", n:2, element:"Feu"}]}` (A7) ; `1` ruling                                                                                                                  | **E**               |
| **Trêve**                    | SCRIPT + KIND       | `0: {trigger:"onPlay", ops:[{op:"globalDamageShield"}]}` — token `treveUntilTurn = tour + (actif ? 2 : 1)` sur le Héros ; pertes de PV/PR directes non affectées (410.3/410.6) ; `1` errata (Unique déjà dans subTypes)     | **C**               |
| **Temple Féca**              | SCRIPT              | `{trigger:"onTap", ops:[{op:"grantResistanceTurnTarget", n:1, element:"choice", heroes:true, respectRange:true, …}]}` — `effectOptions` pour l'élément, token `resMod_<el>`                                                 | **D**               |
| **Dora**                     | SCRIPT + REG        | `{trigger:"onTap", condition:{kind:"bearerInCombat"}, ops:[{op:"draw", n:1}]}` + `EQUIPMENT_ATTRS {force: 2}` ; activable hors tour pendant la fenêtre                                                                      | **F**               |
| **Cape du Prespic**          | SCRIPT + REG + KIND | `0: {trigger:"onDamageToBearer", ops:[{op:"damageTriggerSource", n:1, element:"Feu"}]}` (bus A1) + panoplie Prespic ; `1,2` errata                                                                                          | **F**               |
| **Anneau du Prespic**        | SCRIPT + REG + KIND | idem Cape ; `1` errata                                                                                                                                                                                                      | **F**               |
| **Ceinture du Prespic**      | REG                 | aucun effet imprimé ; `{pv: 2, panoplie: "Prespic"}` (PV au Héros porteur, 403.1d)                                                                                                                                          | **F**               |
| **Chacha Noir**              | SCRIPT + REG + KIND | `0: {trigger:"onTurnStart", orElse:"destroySelf", ops:[{op:"recycleFromDiscard", n:1, element:"Feu"}]}` (élément réinjecté, lot A) + `{force: 2}` ; défausse Feu vide → destruction d'office (804.8) ; `1` errata           | A → D → **F**       |

### Deck Iop (Bruss Ouilis)

| Carte                      | Voie          | Forme compilée cible (résumé)                                                                                                                                                                                                                                                 | Lot                                |
| -------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Bruss Ouilis** (Héros)   | DSL + KIND    | recto : `{trigger:"onSelfAttacks", ops:[{op:"combatModSelf", force:1, pm:1}]}` ; verso : `+ geant:true` ; jetons `*CombatMod` purgés fin de combat/annulation/tour ; PM compté AVANT légalité (`attackPmBonus`) ; `effects[1]` ruling                                         | **C**                              |
| **Piou Vert**              | SCRIPT + KIND | `0: produceResource Terre` ; `1` ruling                                                                                                                                                                                                                                       | **D**                              |
| **Chef de Guerre Bouftou** | DSL           | `{trigger:"static", static:{kind:"forceAura", n:1, sub:"bouftou"}}` — vos AUTRES Bouftous du Monde                                                                                                                                                                            | **B**                              |
| **Bouftou Royal**          | SCRIPT + KIND | `0` Géant (déjà promu mot-clé) ; `1: {trigger:"onArrive", ops:[{op:"untapAllOwn", sub:"bouftou", zones:["monde"]}]}` ; `2: {trigger:"onTap", ops:[{op:"searchDeck", sub:"bouftou", dest:"main"},{op:"shuffleDeck"}]}` (sans `what` — ruling famille) ; `3` ruling, `4` errata | **D**                              |
| **Maître Bolet**           | DSL           | `{trigger:"static", static:{kind:"forceWhileBlocking", n:2}}` — vaut duel ET seuil de létalité (204.4)                                                                                                                                                                        | **B**                              |
| **Jicé Aouaire**           | DSL + KIND    | `{trigger:"static", static:{kind:"cannotBlock"}}` ; `1` ruling                                                                                                                                                                                                                | **B**                              |
| **Katsou Mee**             | SCRIPT        | `{trigger:"onPay", cost:[{pay:"resources", n:1, element:"Terre"}], overuse:{over:3, then:"destroySelfAtEndOfTurn"}, ops:[{op:"buffForceSelf", n:1}]}` — 4ᵉ activation = destruction fin de tour, sans XP                                                                      | **D**                              |
| **Forêts d'Astrub**        | SCRIPT        | `0: {trigger:"onTurnStart", orElse:"destroySelf", ops:[{op:"recycleFromDiscard", n:1, element:"Terre"}]}` ; `1: {trigger:"onArrive", ops:[{op:"tapSelf"}]}` (même script que Mines d'Astrub)                                                                                  | **A** (complet en D pour le choix) |
| **Marcassin**              | SCRIPT + REG  | `0:` entretien Terre (comme Forêts) ; `1` (« gagne Géant ») couvert par `{force:1, grantsGeant:true}` — marqué non-comptable pour l'audit                                                                                                                                     | A → **F**                          |
| **Coiffe du Bouftou**      | REG           | aucun effet imprimé ; `{force: 2, panoplie: "Bouftou"}`                                                                                                                                                                                                                       | **F**                              |
| **Marteau du Bouftou**     | REG           | aucun effet imprimé ; `{force: 1, panoplie: "Bouftou"}`                                                                                                                                                                                                                       | **F**                              |
| **Scaranneau Blanc**       | REG           | aucun effet imprimé ; `{pv: 2, panoplie: "Scarafeuille Blanc"}` + fix faux positif `keywords[]` (lot A)                                                                                                                                                                       | A → **F**                          |
| **Parchemin de Force**     | SCRIPT        | comme Parchemin d'Intelligence avec `element:"Terre"` et `buffForceTarget nX`                                                                                                                                                                                                 | **D**                              |
| **Coup Critique**          | SCRIPT        | `{trigger:"onPlay", ops:[{op:"doubleForceTarget", heroes:true, respectRange:true, oncePerTargetToken:"coupCritique", …}]}` — bonus = Force effective FIGÉE à la résolution (ruling officiel)                                                                                  | **D**                              |
| **Exclusion**              | SCRIPT + KIND | `0: {trigger:"onPlay", window:"combat", ops:[{op:"removeFromCombat"}]}` — retire + incline, bloqueurs orphelins réaffectables (705.4/705.6) ; `1` ruling                                                                                                                      | **E**                              |
| **Stratégie de Groupe**    | SCRIPT + KIND | `0: {trigger:"onPlay", ops:[{op:"buffForceAlliesMondeTurn", n:"heroLevel"}]}` — jeton de SIÈGE `teamForceMod` sur le Héros, ensemble dynamique (812.3b), valeur figée (analogie ruling Coup Critique) ; `1` ruling                                                            | **C**                              |
| **Boon Attitude**          | SCRIPT        | `{trigger:"onPlay", ops:[{op:"tapTarget", heroes:true, requireNoEquipment:true, respectRange:true, …}]}` — cibles redressées uniquement (simplification déclarée)                                                                                                             | **D**                              |
| **Agression**              | SCRIPT + KIND | `0: {trigger:"onPlay", cost:[{pay:"tapOwnAllyOrHero", bindX:"force"}], ops:[{op:"damageTarget", n:0, nX:true, element:"Neutre", heroes:true, respectRange:true, …}]}` — `rangeFrom` = payeur (508.1b, ex. 5099) ; `1,2` rulings                                               | **D**                              |
| **Repos**                  | SCRIPT        | `{trigger:"onPlay", x:{from:"levelPaid"}, condition:{kind:"heroInHavreSac"}, ops:[{op:"heroGainPv", n:0, nX:true}]}`                                                                                                                                                          | **D**                              |
| **Charge**                 | SCRIPT        | `{trigger:"onPlay", ops:[{op:"buffForceTarget", n:2, heroes:true, geantIfSub:"iop", respectRange:true, …}]}` — token `geantMod` si la cible est Iop (« Géant » perdu au scraping, réinjecté ici)                                                                              | **D**                              |
| **Bond**                   | SCRIPT + KIND | `0: {trigger:"onPlay", window:"combat", ops:[{op:"placeBlocker"}]}` — défenseur seul (ruling), Héros plaçable, sans contrôle de PM ; `1,2` rulings                                                                                                                            | **E**                              |
| **Colère de Iop**          | SCRIPT + KIND | `0: {trigger:"onPlay", window:"combat", x:{from:"levelPaid"}, ops:[{op:"distributeDamage", element:"Terre"}]}` — X=0 jouable sans effet (ruling), chaque choisi ≥ 1 ; `1,2` rulings                                                                                           | **E**                              |

---

## 7. Lots séquentiels

> Correspondance avec le backlog existant : Lot A = tâche J0 · Lots B+C = J1 ·
> Lot D = J2 · Lot E = J3 · Lot F = J4 · Lot G = J5+J6+J7. Chaque lot finit
> par `npm run compile-effects` + **bump `CACHE_KEY` de `cardLoader`** quand
> les données changent, et `npx vitest run` vert.

### Lot A — Données fiables : rulings classifiés, éléments réinjectés

- **Périmètre** : `CardEffect.kind` + auto-classification dans
  `compileEffects.ts` (description normalisée ∈ `notes[]` → `ruling` ;
  préfixe « Cette carte a reçu un … errata » → `errata` ; suppression du
  `compiled` éventuel) ; `CARD_SCRIPTS` accepte `{kind}` ; `printedEffects()`
  dans `dsl.ts` + `playFromHand.effectsCount` migré ; op
  `recycleFromDiscard.element` + `PickFilter.element` (comparé via
  `producedElement`) ; scripts Chacha Noir / Forêts d'Astrub / Marcassin
  (entretien avec élément + `tapSelf` onArrive des Forêts) ;
  `combatKeywords` ignore `keywords[]` des Équipements (faux positif
  Scaranneau).
- **Fichiers** : `src/types/cards.ts`, `scripts/compileEffects.ts`,
  `src/game/rules/effects/{dsl,cardScripts,keywords}.ts`,
  `src/stores/gameStore.ts` (effectsCount, PickFilter), `public/data/*.json`
  (recompilés), `src/services/cardLoader` (CACHE_KEY).
- **Cartes débloquées** : Forêts d'Astrub (complet hors choix interactif
  parfait), entretiens Chacha/Marcassin fidèles ; toutes les Actions à
  rulings scrapés (Agression, Prospection, Exclusion, Bond, Colère, Stratégie,
  Glyphe Incandescent…) deviennent éligibles à l'auto-résolution dès que leurs
  ops existeront.
- **Acceptation** : `auditStarters` ne compte plus aucun ruling/errata comme
  effet ; aucun des 136 `compiled` existants ne change de comportement ;
  un Piou ne confère plus jamais sa note de règle.
- **Tests** : « printedEffects exclut les effets dupliqués dans notes[] » ;
  « recycleFromDiscard filtré sur l'Élément requis » ; « le Scaranneau seul ne
  confère pas Résistance 1 Air » ; « les Forêts d'Astrub apparaissent
  inclinées ».

### Lot B — Modificateurs continus & destructions d'état

- **Périmètre** : `StaticAbility` + grammaire `compileStaticEffectText` (+
  `compileCombatTriggerText`, compilée ici, branchée en C) chaînée dans
  `compileEffects` (atteint les faces Héros) ; `modifiers.ts`
  (`staticAbilitiesOf`, `cannotBlock`, `heroLevel`) ; `effectiveForce(ctx, id,
stance?)` (base/handSize + auras 805.2 + `teamForceMod` lu + whileBlocking +
  jetons) ; `destruction.ts` + point-fixe dans `checkVictory` + appels
  `moveTo`/`pumpEffects` ; `eligibleBlockers` exclut `cannotBlock` ;
  UI `effectiveForceOf` + delta + refus expliqué au clic bloqueur.
- **Fichiers** : `cards.ts`, `dsl.ts`, `modifiers.ts` (nouveau),
  `destruction.ts` (nouveau), `stats.ts`, `legality.ts`, `gameStore.ts`,
  `GameCard.vue`, `compileEffects.ts`, données.
- **Cartes débloquées** : **Vrombyx, Chef de Guerre Bouftou, Maître Bolet,
  Jicé Aouaire** (Poum compilé, effectif en C).
- **Acceptation** : Vrombyx meurt main vide (1414, XP à l'adversaire) ;
  l'aura Bouftou suit les entrées/sorties du Monde en cascade (3019) ; le
  test existant « effectiveForce additionne Force imprimée et forceMod »
  reste vert (signature inchangée).
- **Tests** : plan J1 §6 `modifiers.spec.ts` + `dsl-static.spec.ts` intégral.

### Lot C — Bus RuleEvents, passe unique de Dommages, déclenchés de combat

- **Périmètre** : `RuleEvent`/`CombatStance`/`DamageMod` dans
  `rules/types.ts` ; `damageMods.ts` (`reduceDamage` : Résistance → réductions
  statiques → mods → plancher 0 ; `activeGlobalMods`) ; `combat.ts` (stance,
  `inflict` via `reduceDamage`, émission `damageDealt` (> 0 seulement, 811.4),
  `keywordsOf` → `effectiveKeywords`, tap déplacé [A6], cible Héros/Havre-Sac
  couverte) ; `resolveDamageTarget(…, opts)` + `damageOppHero` routés ;
  `triggers.ts` ; store : `processRuleEvents`, hooks
  `combatConfirmAttackers`/`combatToggleAttacker`/`doResolveCombat`,
  `clearCombatMods`, ops `combatModSelf`/`buffForceAlliesMondeTurn`/
  `globalDamageShield`/`damageTriggerSource`, purge `isTurnToken`.
- **Fichiers** : `rules/types.ts`, `damageMods.ts` + `triggers.ts` (nouveaux),
  `combat.ts`, `targeting.ts`, `keywords.ts`, `limits.ts` (isTurnToken,
  anticipé), `gameStore.ts`, `cardScripts.ts` (Trêve, Stratégie), données.
- **Cartes débloquées** : **Poum Ondacié, Bruss Ouilis, Stratégie de Groupe,
  Trêve**. (Triggers Prespic compilés mais dormants sans Porteur → F.)
- **Acceptation** : réduction Poum sur attaquant/bloqueur/cible, pas hors
  combat ; Bruss +1F/+1PM posés avant résolution, purgés à la fin du combat
  ET à l'annulation ; un attaquant de plus autorisé quand Bruss est
  sélectionné ; `teamForceMod` profite à un Allié arrivé APRÈS la résolution
  (812.3b) ; Trêve réduit tout à 0 mais laisse passer pertes de PV/PR
  directes ; `damageDealt` jamais émis à 0.
- **Tests** : plans J1 §6 (`combat-modifiers`, `triggers`,
  `gameStore.triggers`) + J3 `damageMods.spec.ts` (Trêve/Glyphe partiel).

### Lot D — Coûts composés, X, limites, conditions, pouvoirs à ressource

- **Périmètre** : intégralité de la spec J2 amendée (A4, A5) : `costs.ts`,
  `range.ts`, `limits.ts` ; `CompiledCostPart`/`EffectCondition`/`onPay`/
  `oncePerTurn`/`overuse`/`x`/`reaction` ; nouvelles ops de ciblage + leurs
  résolveurs ; `resources.ts` (`powerElements`, `planCostN`, politique
  d'auto-choix) ; `legality.ts` (conditions, coût additionnel) ;
  store : `costPicking`/`xPrompt`/`effectOptions`/`pendingPlay`/
  `pendingActivation`, `activatePower`, garde 808.1, `justPlayed`,
  `fireTurnStartEffects` payabilité, `endTurn` overuse ; 17 entrées
  `CARD_SCRIPTS` (§6) ; UI §4.2–4.4 + 4.8.
- **Fichiers** : `cards.ts`, `costs.ts`/`range.ts`/`limits.ts` (nouveaux),
  `dsl.ts`, `resources.ts`, `legality.ts`, `targeting.ts`, `keywords.ts`,
  `cardScripts.ts`, `gameStore.ts`, `GameBoard.vue`, données.
- **Cartes débloquées** : **Piou Rouge, Piou Vert, Bwork Mage, Katsou Mee,
  Amar Casto, Fécaline la Sage, Temple Féca, Parchemin d'Intelligence,
  Parchemin de Force, Agression, Repos, Prospection, Coup Critique,
  Boon Attitude, Charge, Bouftou Royal, Chacha Noir** (17).
- **Acceptation** : annulation d'un paiement = zéro event (808.2) ; X=0
  résolu sans ciblage ; Katsou détruit après la 4ᵉ activation, pas la 3ᵉ,
  sans XP ; Chacha détruit d'office si défausse sans carte Feu (804.8) ;
  les Pious satisfont l'exigence élémentaire dans `planCost` et n'ont pas de
  bouton « Activer » ; deux instances du même nom ont chacune leur limite
  (802.6) ; table 100 % jouable en mode libre pour les 17 cartes.
- **Tests** : plan J2 §6 intégral (costs, range, limits, resources,
  targeting, gameStore — ~35 cas).

### Lot E — Fenêtre d'actions de combat

- **Périmètre** : step `"actions"` (`actionTurn`, `passes`, `orphanBlockers`,
  `mods`) ; `combatConfirmBlockers`/`combatPassAction`/
  `combatReassignBlocker` ; `whyCannotPlayInCombat` + `window: "combat"` ;
  ops `removeFromCombat`/`placeBlocker`/`distributeDamage`/
  `combatDamageShield`/`combatTapTrap`/`duelChallenge` ; `resolveDuel`
  (instantané unique, ripostes, XP 415.1) ; `RuleEvent tapped` + hook
  tapTrap (A7) ; passation hot-seat du défenseur ; UI §4.5–4.6 ; scripts
  Exclusion/Bond/Colère/Glyphes/Défi.
- **Fichiers** : `gameStore.ts`, `legality.ts`, `targeting.ts`,
  `cardScripts.ts`, `rules/types.ts` (tapped), `GameBoard.vue`,
  `TurnBanner.vue`, données.
- **Cartes débloquées** : **Exclusion, Bond, Colère de Iop, Glyphe
  Revigorant, Glyphe Incandescent, Défi**.
- **Acceptation** : fenêtre ouverte après les bloqueurs, fermée à 2 passes
  (705.5) ; Exclusion retire/incline et libère les bloqueurs (705.6/705.4) ;
  Bond réservé au défenseur, dépasse les PM (ruling) ; Glyphe Incandescent
  inflige 2 [Feu] à chaque combattant qui s'incline PENDANT la fenêtre
  seulement ; Action `window:"combat"` refusée hors combat (jouable en mode
  libre) ; Trêve jouable aussi pendant la fenêtre (705.1).
- **Tests** : plan J3 §7 (fenêtre, exclusion, bond, colère, défi, glyphes) +
  adaptation `combat.spec.ts` (tap à la déclaration).

### Lot F — Équipements : Porteur, registres, panoplies

- **Périmètre** : `equipment.ts` complet + `EQUIPMENT_ATTRS`/`PANOPLIES`
  (§5) ; flux de pose (`whyCannotPlay` Porteur légal → paiement → ciblage
  `chooseBearer` → `MOVE` puis `ATTACH` → PV éventuels 403.1d) ;
  `moveTo` re-ATTACH ; `effectiveForce` += `equipmentForceBonus` ;
  `effectiveKeywords` += équipement ; `grantXpEvents` += `xpGainBonus` ;
  destructions chaînées (`bearerLeavesPlayEvents` 2237,
  `destroyEquipmentEvents` 403.2) ; condition `bearerInCombat` activable
  hors tour pendant la fenêtre (Dora) ; triggers Prespic vivants (bus C) ;
  UI §4.7.
- **Fichiers** : `equipment.ts` (nouveau), `stats.ts`, `keywords.ts`,
  `progress.ts`, `targeting.ts` (resolveChooseBearer), `gameStore.ts`,
  `GameCard.vue`/`GameBoard.vue`, `cardScripts.ts` (Cape/Anneau/Dora),
  données.
- **Cartes débloquées** : **Dora, Cape du Prespic, Anneau du Prespic,
  Ceinture du Prespic, Coiffe du Bouftou, Marteau du Bouftou, Scaranneau
  Blanc, Marcassin (complet), Chacha Noir (Force +2)**.
- **Acceptation** : Porteur Monstre refusé (305.3) ; slots 305.5 (2 Anneaux
  de noms ≠) ; panoplie Bouftou active à 3 pièces DIFFÉRENTES, retirée à la
  destruction d'une pièce ; Prespic riposte 1 [Feu] au cogneur Allié/Héros,
  jamais à 0 Dommage (811.4, ex. l. 8157), jamais en chaîne ; +1 XP Prespic
  sauf gains de 0 (l. 4091) ; Équipements détruits avec leur Porteur (2237) ;
  létalité à la perte d'un bonus de Force (403.2a).
- **Tests** : plan J3 §7 `equipment.spec.ts` + extensions combat (riposte) +
  plan J1 (Porteur/Prespic côté store).

### Lot G — Intégration : audit vert, partie scriptée, onboarding

- **Périmètre** : `scripts/auditStarters.ts` apprend `kind` + couverture par
  registres (`EQUIPMENT_ATTRS`/`PANOPLIES` = effets couverts) → **objectif
  0 carte ❌ MANUEL sur les 2 starters** ; test d'intégration « partie
  scriptée Feca vs Iop » (gameStore : mulligan → tours → combats → un usage
  de CHAQUE carte automatisée → victoire), recompilation finale + bump
  `CACHE_KEY` ; onboarding (`TutorialCoach.vue`) pointé sur les 2 starters
  full-auto ; E2E Playwright (lancer une partie guidée depuis l'onboarding,
  jouer 2 tours assistés).
- **Acceptation** : audit régénéré : 0 manuel, 0 partiel non justifié ;
  `npx vitest run` et `npm run test:e2e` verts ; CDC mis à jour
  (`docs/CDC-MODULE-JEU-ETAT.md` : limitations §8 consignées).

---

## 8. Hors périmètre bêta / limitations assumées (pas des exclusions de cartes)

**Aucune des 40 cartes n'est hors périmètre.** Trois limitations de
fidélité, jamais bloquantes :

1. **Fécaline la Sage — réaction au tour adverse** (809.1) : la pile de
   réactions n'existe pas ; la fenêtre automatisée est STRICTE (son tour,
   juste après sa propre Quête/Parchemin). Au tour adverse : inclinaison +
   XP à la main. Chantier « Réactions » post-bêta (le mot-clé `reaction` et
   le bus sont déjà en place pour l'accueillir).
2. **Amar Casto — usage du Métier** : le token `metier_<nom>` est posé
   fidèlement ; la fabrication (418.6, Recettes) reste manuelle (aucun état
   de jeu faussé). Chantier « Fabrication » post-bêta.
3. **PV max non suivis** : le bonus PV d'Équipement ajuste `hp` courant sans
   plafond (cohérent avec `resolveHealHeroTarget` V1) — écart 403.1d
   documenté.
4. **Ciblage après paiement** (807.1 voudrait les choix au moment de jouer) :
   sans fenêtre de réaction la différence est inobservable ; annulation
   gratuite avant paiement. Documenté, pas corrigé.
5. **File FIFO vs LIFO** (4728/804.6) : frames du joueur actif d'abord —
   aucune carte du périmètre n'a d'interaction d'ordre inter-joueurs.

---

## 9. Risques transverses

1. **Recompilation oubliée** : toute évolution de grammaire/scripts est
   inerte sans `npm run compile-effects` + bump `CACHE_KEY` (`cardLoader`) —
   à inscrire dans la checklist de chaque lot (mémoire projet).
2. **Portée 508.1 opt-in** : transitoirement, les 136 anciennes ops
   l'ignorent quand les nouvelles l'appliquent. Généraliser = recompilation
   globale + revalidation (chantier dédié post-bêta).
3. **Undo pendant combat/fenêtre/challenge** : `combat.value` et les pauses
   ne sont pas événementiels — un undo peut désynchroniser l'UI du journal.
   Limitation préexistante, consignée au CDC ; mitigation possible :
   désactiver « Annuler le coup » pendant une pause interactive.
4. **Élément de carte absent des données** (« Élément : [X] » non scrapé,
   ex. Forêts d'Astrub) : le filtre `element` du recyclage lit
   `producedElement` → cartes légitimes possiblement absentes du picker.
   Jamais bloquant (déclin possible, recyclage manuel) ; vrai fix = re-scrape
   J0-données ultérieur.
5. **Performance `effectiveForce`** : O(n²) par lecture (n < 30 instances) —
   aucun memo nécessaire ; surveiller seulement si l'UI le lit dans une
   boucle de rendu par frame.
6. **Question de règle 415.1** (XP des auto-destructions) : convention
   retenue = les destructions par coût/entretien/overuse ne rapportent pas
   d'XP ; les destructions par combat/effet adverse oui. À re-vérifier contre
   le texte officiel si une carte future paie en sacrifice d'Allié adverse.
7. **Détection « Monstre »** via `subTypes` : valide sur Incarnam ; à
   re-vérifier avant d'ouvrir d'autres extensions (Porteur 305.3).
8. **Données rarity « Fixe » des Héros** (Poum/Bruss : HTML « Fixe », JSON
   « Commune ») : sans impact moteur ; backlog données.

---

_Fichiers de référence vérifiés : `src/types/cards.ts`,
`src/game/rules/{types,stats,combat,legality,resources,progress,cardAttrs}.ts`,
`src/game/rules/effects/{dsl,targeting,keywords,cardScripts}.ts`,
`src/stores/gameStore.ts` (1508 l.), `src/game/engine/reducer.ts`
(ATTACH/DETACH l. 218–240), `scripts/compileEffects.ts`,
`src/components/game/GameCard.vue`, `docs/AUDIT-STARTERS.md`._
