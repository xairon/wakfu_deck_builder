# Combat complet — design

## But

Corriger les 5 lacunes de **règles de base** du combat confirmées par l'audit
adversarial (20 agents) + rejeu live, sans toucher aux effets de carte (v1
« Cockatrice » : règles automatisées, effets manuels). Périmètre figé :

| Id                     | Règle                                                         | Gravité    |
| ---------------------- | ------------------------------------------------------------- | ---------- |
| 707.1                  | Riposte de la Cible non bloquée                               | 🔴 haute   |
| BLK-01 (704)           | Assignation multi-bloqueurs par le défenseur                  | 🟠 moyenne |
| GEANT-OVERFLOW (6135)  | Débordement du Géant vers la Cible + Géant actif à 1 bloqueur | 🟠 moyenne |
| BLOCKER-NO-TAP (708.3) | Inclinaison des bloqueurs en fin de combat                    | 🟠 moyenne |
| ZONE-01 (101.x)        | Revalidation du deck à l'entrée en partie                     | 🟠 moyenne |

Hors périmètre : fenêtre de réaction (705/706.5/707.3, tâche J3), HS-ZERO
(410.7), PHASE-01, RES-1/2, att-01, LVL-01, ZONE-02 (suivis séparément).

## Principe directeur — interactivité « seulement si ambigu »

Quand le défenseur a un VRAI choix, on ouvre une mini sous-étape (calquée sur
l'étape `strikes` existante) ; sinon on auto-résout. **0/1 option → auto ;
≥2 options → on demande.** Zéro friction dans le cas courant.

## 1. Modèle de résolution : simultanéité (chirurgical)

`resolveCombat` ([src/game/rules/combat.ts](../../../src/game/rules/combat.ts))
accumule déjà tous les dégâts de duel dans une map `dmg` AVANT d'appliquer la
létalité — la simultanéité existe pour les duels. On **n'ouvre pas** de refactor
en phases : la riposte (707.1) et le débordement Géant (6135) sont ajoutés comme
des `inflict()` supplémentaires **dans la même map `dmg`**, calculés sur la Force
PRÉ-combat (les compteurs ne sont appliqués qu'après). Tout est résolu d'un coup,
létalité ensuite. Un seul point d'application, risque minimal.

_Alternative écartée : réécriture en phases explicites — plus propre mais risque
de régression élevé sur du code déjà couvert par `combat.spec.ts`._

## 2. Riposte de la Cible (707.1)

Quand la cible est un **Allié ou un Héros** et reçoit des Dommages d'attaquants
non bloqués, elle **inflige sa Force à UN attaquant** parmi ceux qui l'ont
frappée (attaquants libres + Géant débordant). Simultané : la cible riposte même
si elle est détruite par les Dommages reçus.

- Cible **Havre-Sac** : pas de riposte (aucune Force).
- Candidats à la riposte = attaquants libres ayant infligé > 0 + tout Géant dont
  le reliquat a débordé sur la cible.
- **0 candidat** → pas de riposte. **1 candidat** → auto. **≥2 candidats** →
  nouvelle sous-étape `riposte`.
- La Force de riposte passe par `reduceDamage` (donc Résistance de l'attaquant /
  Trêve s'appliquent comme pour toute infliction) et s'accumule dans `dmg`.

  707.1 exclut la riposte si la cible a déjà infligé des Dommages en duel ; par
  construction la cible n'est jamais bloqueuse (legality l'exclut), donc elle
  n'a jamais frappé en duel → elle riposte toujours. Pas de garde supplémentaire
  nécessaire.

## 3. Assignation des bloqueurs (BLK-01, 704)

Signature étendue : `combatToggleBlock(blockerId, attackerId?)`.

Dans l'étape `blockers` du store
([src/stores/gameStore.ts](../../../src/stores/gameStore.ts)) :

- **1 seul attaquant déclaré** → clic d'un bloqueur = assignation automatique à
  cet attaquant (comportement actuel conservé).
- **≥2 attaquants** → clic d'un bloqueur pose `combat.pendingBlocker` et
  surligne les attaquants ; le clic suivant sur un attaquant réalise
  l'assignation `blocks[blocker] = attacker` et efface `pendingBlocker`.
- Re-clic d'un bloqueur déjà assigné = retrait (toggle conservé).

Le moteur sait déjà résoudre une assignation libre (`blockersOf` est construit
depuis `plan.blocks`), donc **`combat.ts` est inchangé** pour ce point — seules
l'entrée store et l'UI évoluent.

## 4. Géant : débordement + 1 bloqueur (GEANT-OVERFLOW, 6135)

Dans la branche Géant de `combat.ts` :

- (a) Retirer la garde `blockers.length > 1` : le Géant répartit sa Force dès
  **1** bloqueur.
- (b) Si `pool > 0` après avoir tué **tous** les bloqueurs, infliger le reliquat
  à la **cible** (Héros → PV, Havre-Sac → Résistance, Allié → `dmg`) ET inscrire
  ce Géant comme candidat à la riposte de la cible.

La répartition entre bloqueurs reste automatique (pas de choix Géant — conforme
au design v1 existant `moteur-regles-r1`).

## 5. Inclinaison des bloqueurs (BLOCKER-NO-TAP, 708.3)

En fin de `resolveCombat`, émettre `SET_ORIENTATION "tapped"` pour les
**bloqueurs survivants** (les détruits partent en défausse, orientation null).
Les attaquants sont déjà inclinés à la déclaration (A6) — symétrie rétablie.
Émis dans le moteur (rafale `events`) pour rester pur et testable.

## 6. Validation du deck à l'entrée (ZONE-01, 101.x)

Dans `launch()` ([src/views/PlayTableView.vue](../../../src/views/PlayTableView.vue)) :
appeler `validateDeck` ([src/validators/deck.ts](../../../src/validators/deck.ts))
sur les deux decks sélectionnés ; si l'un est invalide → toast explicite (raison)
et on **ne démarre pas** la partie. Garde côté UI uniquement : le tutoriel
conserve son chemin `startMatch` direct (decks générés valides).

## 7. Machine d'étapes & UI

Flux : `attackers → blockers (+ assignation si ≥2 attaquants) → strikes
(existant) → riposte (si ≥2 candidats) → resolve`.

Nouveaux états sur `combat` :

- `pendingBlocker?: InstanceId` — bloqueur en attente d'un attaquant (étape
  blockers, ≥2 attaquants).
- `step` accepte `"riposte"` ; `riposteFrom: InstanceId` (la cible) et
  `riposteCandidates: InstanceId[]` ; choix stocké dans `ripostes` (cible →
  attaquant frappé) consommé par `resolveCombat`.

Bannière `.gcombat` ([GameBoard.vue](../../../src/components/game/GameBoard.vue)) :
deux libellés ajoutés — « Choisis l'attaquant à bloquer » (mode pendingBlocker),
« La Cible riposte : choisis l'attaquant frappé ». Surlignages via les classes
existantes `.gslot--atk/--target/--blk`.

## 8. Tests

Unitaires `combat.spec.ts` :

- Riposte : cible Allié (Force 3) frappée par attaquant libre (Force 1) → la
  cible survit, l'attaquant est détruit.
- Riposte mortelle réciproque (simultanéité) : cible et attaquant meurent.
- Riposte multi-candidats : `plan.ripostes` honoré.
- Cible Héros riposte sa Force à un attaquant libre.
- Géant à 1 bloqueur : répartit (pas de sur-tuage perdu).
- Géant overflow → cible quand tous les bloqueurs meurent.
- Bloqueurs survivants inclinés après combat ; bloqueurs détruits en défausse.

Validation : test `launch()`/`validateDeck` (deck sans Héros refusé).

Live (preview) : rejouer le repro de l'audit — petit attaquant (Héros F1) vs
gros Allié cible (F3) non bloqué → l'attaquant doit mourir, la cible survit.

## 9. Edge cases tranchés

- Cible Héros : riposte avec la Force du Héros (face courante).
- Cible détruite : riposte quand même (simultané, Force pré-combat).
- Plusieurs attaquants libres : riposte sur UN seul, choisi par le défenseur
  (≥2) ou auto (1).
- Trêve : la riposte passe par `reduceDamage`, donc annulée comme tout Dommage.
- Cible Havre-Sac : aucune riposte.

## Fichiers touchés

- `src/game/rules/combat.ts` — riposte, Géant overflow + 1 bloqueur, tap des
  bloqueurs survivants.
- `src/game/rules/types.ts` — `CombatPlan.ripostes?`.
- `src/stores/gameStore.ts` — `combatToggleBlock(blockerId, attackerId?)`,
  `pendingBlocker`, étape `riposte` + getters/actions, passage de `ripostes` au
  plan.
- `src/components/game/GameBoard.vue` — libellés + surlignages des deux
  sous-étapes.
- `src/views/PlayTableView.vue` — garde `validateDeck` dans `launch()`.
- `src/game/rules/__tests__/combat.spec.ts` — nouveaux cas.
