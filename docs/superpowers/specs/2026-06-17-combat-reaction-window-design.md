# Fenêtre de réaction de combat (J3, v1) — design

## But

Donner au combat une **fenêtre de réaction manuelle** après le blocage (706.5),
dans le modèle v1 « Cockatrice » (règles auto, effets joués À LA MAIN). Avant la
résolution des Dommages, chaque joueur peut jouer une Action / activer un pouvoir
/ ajuster ses compteurs à la main (Trêve, pump, protection, Glyphe…), puis on
résout. **Aucune automatisation d'effet, aucune pile de priorité.**

## Décisions verrouillées (issues du brainstorm)

- **Forme** : pause MANUELLE (structure de timing + possibilité d'agir), pas de
  pile automatisée.
- **Granularité** : UNE seule fenêtre, **après blocage, avant résolution**
  (706.5). Les fenêtres 705 / 707.3 restent v2.
- **Friction minimale** : le chemin par défaut reste **un seul clic
  « Résoudre le combat »** (identique à aujourd'hui). La réaction est une OPTION.

## Flux

`attackers → blockers → resolve` devient, à l'étape `blockers` (blocs déclarés) :

1. **Bannière** : « 🛡 Bloqueurs déclarés — réagis (Action / pouvoir / compteurs)
   ou résous. » + boutons **« Résoudre le combat »** et
   **« Laisser réagir l'adversaire »**.
2. L'**attaquant** (perspective courante) peut réagir sur son écran : jouer une
   carte, activer un pouvoir incliné, ajuster ses compteurs. Puis :
   - **« Résoudre le combat »** → enchaîne strikes / riposte / résolution
     (inchangé). Chemin par défaut, 1 clic.
   - **« Laisser réagir l'adversaire »** → passation vers le défenseur.
3. **Défenseur** (via l'overlay de passation existant) : même capacité de
   réaction sur sa perspective, puis **« Fini de réagir »** → retour à
   l'attaquant (qui résout).

Pas de boucle de priorité : un aller-retour borné suffit en v1.

## Mode réaction (cœur technique)

Nouveau champ `combat.reactingSeat: Seat | null` (le siège qui réagit hors de son
tour, `null` hors fenêtre). Quand il est posé :

- **Perspective** basculée sur `reactingSeat` (l'overlay de passation masque le
  jeu pendant le hand-off, comme entre les tours).
- **Légalité relâchée HORS-TOUR** : `whyCannotPlay` et l'activation de pouvoir
  ignorent le contrôle « c'est ton tour » **uniquement** quand
  `combat.reactingSeat === seat` (réaction = action hors de son tour, 705/706).
  Les autres contrôles (carte en main, coût, zone) restent actifs. Pas de filtre
  « carte instant » : le joueur s'auto-arbitre (table libre).
- **Actions ré-activées en combat** : `canActivateSelected` et le jeu depuis la
  main sont actuellement coupés par `!store.combat` ; on les autorise quand
  `reactingSeat` est défini (pour ce siège). Les compteurs manuels du HUD restent
  disponibles comme aujourd'hui.

## Store — actions

- `combatOfferReaction()` : depuis l'étape `blockers`, pose
  `reactingSeat = otherSeat(turn.active)` (le défenseur), bascule `perspective`
  et `passPending = true` (overlay « À l'adversaire de réagir »).
- `combatEndReaction()` : `reactingSeat = null`, `perspective = turn.active`,
  `passPending = false` (retour à l'attaquant). (Bouton « Fini de réagir ».)
- `combatResolve()` inchangé (déjà déclenché par « Résoudre le combat ») :
  efface tout `reactingSeat` résiduel par sécurité avant de résoudre.
- L'attaquant n'a pas besoin d'un `reactingSeat` : sur SA perspective pendant son
  tour, jouer/activer est déjà légal — il suffit de lever le verrou `!combat`.

## Interaction avec les modificateurs de Dommages

Aucune plomberie nouvelle. `resolveCombat` lit déjà `activeGlobalMods` (Trêve via
le jeton `treveUntilTurn`) **au moment de la résolution**. Une Trêve / un pump /
une protection posés à la main pendant la fenêtre s'appliquent donc
automatiquement quand on clique « Résoudre ». Les `DamageMod`
`protectCombatants` / `tapTrap` (scaffolding « lot E ») se posent de la même
façon plus tard, sans changement ici.

## UI (GameBoard.vue)

- Bannière `.gcombat` : libellé d'étape « blockers » enrichi + boutons
  « Résoudre le combat » / « Laisser réagir l'adversaire » (ce dernier visible
  seulement à l'étape blockers, hors mode réaction).
- En mode réaction (`reactingSeat`), l'overlay de passation s'affiche puis, une
  fois révélé, la bannière indique « ↩ Réaction de {joueur} — joue puis
  « Fini de réagir » » avec le bouton **« Fini de réagir »**.
- Le routage des clics du combat (attackers/strikes/riposte/blockers) est
  inchangé ; en mode réaction, les clics sur SES cartes/HUD passent par les
  chemins manuels normaux (play / activate / bump).

## Hors périmètre (assumé v2)

- Pile de priorité / résolution automatique d'effets instantanés.
- Filtre d'éligibilité « instant » (le joueur s'auto-arbitre en v1).
- Fenêtres 705 (après déclaration d'attaque) et 707.3 (pendant les frappes).
- Réactions imbriquées / boucle de priorité (un aller-retour borné en v1).

## Tests

**Store** (`gameStore.spec.ts`) :

- `combatOfferReaction()` à l'étape blockers → `reactingSeat = défenseur`,
  `perspective = défenseur`, `passPending = true`.
- En mode réaction, le défenseur joue une carte de SA main hors de son tour →
  acceptée (légalité de tour relâchée) ; un autre contrôle (zone/coût) reste
  appliqué.
- `combatEndReaction()` → `reactingSeat = null`, `perspective = attaquant`.
- Réaction posant une Trêve (jeton `treveUntilTurn`) → après « Résoudre », la
  résolution applique 0 Dommage (Trêve lue par `activeGlobalMods`).
- Hors mode réaction (tour normal), la légalité « ton tour » reste appliquée
  (non-régression).

**Live (preview)** : combat → « Laisser réagir l'adversaire » → passation →
le défenseur active un pouvoir / pose une Trêve → « Fini de réagir » →
« Résoudre » → Dommages réduits. Console propre.

## Fichiers touchés

- `src/stores/gameStore.ts` — `combat.reactingSeat`, `combatOfferReaction`,
  `combatEndReaction`, garde `combatResolve`, dé-verrouillage `canActivate`/play
  en réaction.
- `src/game/rules/legality.ts` — `whyCannotPlay` (et activation de pouvoir) :
  paramètre/branche « réaction » qui ignore le contrôle de tour.
- `src/components/game/GameBoard.vue` — boutons + bannière + overlay de réaction.
- `src/components/game/SeatHud.vue` — (vérifier) compteurs manuels accessibles en
  combat ; ajuster si gatés.
- Tests : `src/stores/__tests__/gameStore.spec.ts`,
  `src/game/rules/__tests__/legality.spec.ts`.
