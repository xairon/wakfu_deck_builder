# Tutoriels par mécanique — design

## But

Étendre l'onboarding au-delà du tutoriel « Apprendre à jouer » (la boucle de
base) avec des **leçons focalisées par mécanique**, lançables à la demande, qui
réutilisent l'infra existante (coach spotlight, étapes ancrées, `advanceWhen`,
bot adverse). Première leçon livrée : **Combat complet** (attaque + blocage +
résolution du duel). Elle sert de patron pour les suivantes.

## Architecture — registre de leçons (Option A)

On généralise `tutorialStore` : la machinerie partagée (pilotage du
`TutorialCoach`, `tick`, watcher d'avancement des étapes, minuterie du bot) reste
commune ; ce qui change d'une leçon à l'autre est isolé dans un objet `Lesson`.

```ts
interface Lesson {
  id: string; // 'decouverte' | 'combat' | …
  title: string; // « Apprendre à jouer », « Le combat »
  summary: string; // une ligne pour le sélecteur du lobby
  setup: () => void; // arrange le plateau (decks + placement + tour)
  steps: TutorialStep[]; // étapes coachées (anchor/text/advanceWhen/manual)
  botPolicy?: { blocks?: boolean }; // comportement du bot adverse
}
```

- `LESSONS` : registre `Record<string, Lesson>`.
- `activeLesson` : ref vers la leçon en cours ; `steps`/`step`/`stepText`/`total`
  dérivent de `activeLesson`.
- `startLesson(id)` : `lesson.setup()` → `stepIndex = 0`, `active = true`, démarre
  `tick` et le bot. L'actuel `start()` devient `startLesson('decouverte')`
  (rétro-compat : `?tutorial=1` et le bouton « Apprendre à jouer » inchangés).
- Le **bot** consulte `activeLesson.botPolicy` : la leçon combat ajoute le blocage.

La leçon `decouverte` = le parcours actuel **tel quel** (mêmes `steps`, même
`buildDecks`, même setup `startMatch(first:'B')` + pré-jeu de B résolu d'emblée,
même bot révèle/finit-le-tour). Comportement identique — juste enveloppé. Risque
sur le tuto de base : minimal.

## Leçon « Combat » (scénario pré-arrangé)

Pas une partie depuis le tour 1 : on arrange un plateau via `startSandbox` puis
placement.

**Setup :** `startSandbox(deckA, deckB, 'A')`, `assist = true`,
`assistEffects = false`. Placer **1 Allié de A** dans le Monde au tour 1 (donc
`arrivedTurn = 1`, attaque légale plus tard), avancer à un tour où A peut
attaquer (tour ≥ 3), placer **1 Allié de B** dans le Monde (bloqueur ; un Allié
fraîchement arrivé PEUT bloquer — le mal d'invocation ne concerne que l'attaque).
Réinitialiser `attackedOnTurn`. Choisir des Force/Résistance qui rendent le duel
**instructif** (l'attaquant détruit le bloqueur → XP, ou échange mutuel) ; texte
des étapes calculé dynamiquement sur le résultat réel.

**Étapes coachées :**

1. (ancre : Allié de A) « Clique ton Allié, puis **⚔ Attaquer**. »
   `advanceWhen`: `combat?.step === 'attackers'`.
2. « Désigne la cible : le **Héros adverse** (en haut). »
   `advanceWhen`: `combat?.target != null`.
3. « **Confirme l'attaque**. » `advanceWhen`: `combat?.step === 'blockers'`.
4. (info, le bot bloque automatiquement) « L'adversaire **bloque** avec son
   Allié. » `advanceWhen`: `Object.keys(combat?.blocks ?? {}).length > 0`.
5. « **Résous le combat**. » `advanceWhen`: `attackedOnTurn !== null`.
6. (manual) Lecture du résultat : létalité (**dégâts ≥ Force**), **Résistance**,
   qui meurt, **XP gagné** — pointe le journal.

**Bot bloqueur :** aujourd'hui le bot n'agit que quand `perspective === 'B'`
(son tour). Pendant l'attaque de A, `perspective === 'A'` et `combat.step ===
'blockers'`. Nouveau : si `activeLesson.botPolicy?.blocks` et
`combat?.step === 'blockers'` sans bloqueur encore déclaré, le bot appelle
`combatToggleBlock(<Allié B éligible>)` après un court délai. Le joueur résout.

## Accès — sélecteur dans le lobby

Dans le lobby de `PlayTableView` (sous « Apprendre à jouer »), une section
**« Apprendre une mécanique »** qui itère `LESSONS` (hors `decouverte`) et affiche
un bouton par leçon (`title` + `summary`). Clic → `tutorial.startLesson(id)`.

## Fichiers

- `src/stores/tutorialStore.ts` : registre `LESSONS`, `Lesson`, `activeLesson`,
  `startLesson(id)`, `start()` = `startLesson('decouverte')` ; bot lesson-aware
  (blocage) ; extraire la leçon combat (`setup` + `steps`).
- `src/views/PlayTableView.vue` : section « Apprendre une mécanique » + handlers.
- `TutorialCoach.vue` : aucun changement (consomme `step`/`stepText`/`total`).
- Pas de modif du moteur de règles ni de `combat.ts` (le blocage passe par les
  actions existantes `combatToggleBlock`).

## Hors périmètre (itérations suivantes)

Les autres leçons (équiper, familiers, jouer&payer, Havre-Sac, montée de
niveau…) : mêmes `Lesson` ajoutées au registre une fois le patron validé. Pas de
persistance « leçon terminée » par mécanique pour l'instant (juste le lancement).
