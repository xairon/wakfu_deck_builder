# Spec — Moteur de règles R1 : coûts, légalité, combat, progression

Date : 2026-06-09 · Statut : approuvé (demande : « commence à travailler sur
l'implémentation du moteur de règles »). Suit l'étape A→B du chemin
d'automatisation du doc `GAME-MODULE-V1.md` §8.4.

## Principe (invariant du projet)

Le moteur de règles est un **producteur d'événements + des requêtes de légalité
pures** au-dessus du moteur d'événements **inchangé** (`src/game/engine`). Un
effet automatisé émet les mêmes events qu'un joueur. Toute situation non
couverte retombe sur le **mode manuel** (la table reste libre) : un toggle
« assisté / libre » contrôle l'enforcement, et rien ne bloque jamais une partie.

## Règles couvertes par R1 (vérifiées dans `_incoming/rules-reference.txt`)

- **Ressources & coûts** (4261/4316/4356/4381/4398) : toute carte en jeu
  redressée (sauf Protecteur) produit en s'inclinant 1 Ressource de son
  Élément ; coût de lancement = Niveau de la carte ; pour un **Allié**, au
  moins une Ressource de l'Élément de la carte ; non-Allié : éléments libres.
- **Jouer une carte** : tour actif + Phase Principale + carte dans sa main +
  coût payable. Destination par type : Salle → Havre-Sac, le reste → Monde.
  **Premier tour de la partie** (4943) : aucune carte ne peut être jouée dans
  le Monde au tour 1.
- **Mal d'invocation** (1821) : un Allié ne peut **attaquer** que s'il est
  apparu avant le début du tour courant de son contrôleur (il peut produire de
  la Ressource / bloquer dès son arrivée). Suivi via un compteur token
  `arrivedTurn` posé à l'entrée en jeu (préservé par l'échange Monde↔Havre-Sac
  qui conserve les compteurs, 501.5).
- **Combat** (603.2, 702–708) : une seule attaque par tour, pas d'attaque à
  son premier tour. Cible unique : Héros adverse, Allié adverse dans le Monde
  ou Havre-Sac adverse. Attaquants ≤ PM (redressés, sans mal d'invocation) ;
  bloqueurs ≤ PM du défenseur (Alliés redressés du Monde, hors cible ; les
  Alliés Élémentaires ne bloquent ni n'attaquent, 303.6). Duels : l'attaquant
  bloqué inflige sa Force à **un** bloqueur (R1 : le premier assigné), tous
  les bloqueurs lui infligent leur Force simultanément. Attaquants libres →
  Dommages sur la cible. Fin de combat : attaquants inclinés.
- **Dommages** (204.6, 410.8) : Allié → compteur `damage`, létal si
  damage ≥ Force → Défausse du propriétaire. Héros → perte de PV (`hp`).
  Havre-Sac → perte de `resistance`. La purge des Dommages en fin de tour
  existe déjà (gameStore.nextTurn).
- **XP & niveaux** (415.1, 307.4/307.5, 103.2) : détruire un Allié adverse
  donne son Expérience au Héros ; 6ᵉ XP → verso Niveau 2 (PA/PM ajustés, PV
  courants augmentés du delta de PV max) ; 18ᵉ XP → Niveau 3 = victoire.
  Défaite si PV du Héros ≤ 0.

## Étape C (livrée en partie) — mots-clés data-driven

Audit des données (1613 cartes, 2479 effets) : les seuls mots-clés de combat
réellement présents sont **Résistance** (185 cartes, structuré dans
`keywords[]` : `{name, description: '<N>', elements: ['terre']}`) et
**Géant** (93 cartes, texte d'effet strictement égal à « Géant »). Les autres
entrées du type `CardKeyword` (Riposte, Portée, Critique, Parade) n'existent
pas dans les données scrapées. Implémenté dans
`src/game/rules/effects/keywords.ts` + `combat.ts` :

- **Résistance [Élément] N** (7469) : prévention de N Dommages de cet
  Élément, appliquée par infliction (duels, attaquants libres, cible Allié,
  Héros — pas le Havre-Sac dont la Résistance est un compteur, 306.3).
- **Géant** (6135) : l'attaquant répartit sa Force entre tous ses bloqueurs ;
  politique automatique = maximiser les bloqueurs détruits (parts létales les
  moins chères d'abord, reliquat sur un survivant).

## Hors périmètre (assumé, reste manuel)

Effets de cartes texte libre (DSL carte-par-carte à venir : triggers
apparition / début / fin de tour mesurés à 200-270 cartes chacun),
Réactions/File d'Attente (timing), Tacle (pas de Phase d'Actions modélisée),
capacité (Taille) du Havre-Sac, redressement gratuit du Havre-Sac du 2ᵉ
joueur (2342), Challenges/Quêtes, choix manuel du bloqueur frappé,
égalité 103.3.

## Architecture — `src/game/rules/` (pur, zéro dépendance UI)

- `types.ts` — `RulesCtx { state; getCard }`, `CombatTarget`, `CombatPlan`,
  `CombatResult`, `PlanCost`.
- `cardAttrs.ts` — extraction défensive d'une `Card` : `levelCost`,
  `requiredElement` (Allié uniquement), `producedElement` (élément de Force,
  repli Niveau), `forceValue`, `xpValue`, `heroStats(side)`, prédicats
  `canProduceResource` / `canAttackCard` / `canBlockCard`.
- `resources.ts` — `resourceProducers(ctx, seat)` (en jeu, contrôlées,
  redressées, non-Protecteur) ; `planCost(ctx, seat, card)` → sélection
  automatique de producteurs (satisfait d'abord l'exigence élémentaire, puis
  complète en préservant les éléments requis) ou raison d'échec.
- `legality.ts` — `whyCannotPlay(ctx, seat, instanceId)` → `null` ou raison
  (FR, affichable) ; `playDestination(card)` ; `arrivedTurnOf(inst)` ;
  `canDeclareAttack(ctx, seat, attackedOnTurn)` ; `eligibleAttackers` ;
  `eligibleTargets` ; `eligibleBlockers`.
- `combat.ts` — `resolveCombat(ctx, plan)` : calcule duels + dommages cible en
  pur, émet la rafale de `DraftEvent` (tap, INC damage/hp/resistance, MOVE →
  défausse du owner, XP, SET_LEVEL) + `CombatResult { events, log,
destroyed, winner }`.
- `progress.ts` — `grantXpEvents(ctx, seat, amount)` (flip verso à 6, stats
  ajustées, victoire à 18) ; `victoryFromState(ctx)` (PV ≤ 0 / Niveau 3).
- `index.ts` — barrel `@/game/rules`.

## Intégration store/UI (R1)

- `gameStore` : `assist` (défaut **on**) ; `ruleError` (toast UI) ;
  `playFromHand(instanceId)` (légalité → auto-inclinaison des producteurs →
  MOVE vers la bonne zone → stamp `arrivedTurn`) ; stamp `arrivedTurn` aussi
  dans `moveTo` pour toute entrée en jeu manuelle ; machine de combat
  (`beginCombat` → cible → attaquants → bloqueurs → `resolveCombat`) avec
  `attackedOnTurn` ; `checkVictory()` après combat et compteurs manuels →
  `matchPhase = finished` + `winner`.
- `GameBoard` : un drop main → Monde/Socle passe par `playFromHand` quand
  l'assistance est active (toast si refus) ; pendant un combat, clics routés
  vers la sélection cible/attaquants/bloqueurs avec surbrillances dédiées ;
  bandeau de combat (étape, confirmer/annuler) ; bouton « ⚔ Attaquer » dans
  la barre d'action ; toggle « Règles assistées » dans la topbar.

## Tests

- `resources.spec.ts` : producteurs (inclinées/Protecteur exclus), exigence
  élémentaire Allié, manque de ressources, conservation des éléments requis.
- `legality.spec.ts` : tour/phase/main, Monde interdit au tour 1, mal
  d'invocation, attaque unique/premier tour, cibles et bloqueurs légaux.
- `combat.spec.ts` : duel létal mutuel, duel non létal (damage persiste),
  attaquant libre → PV Héros / résistance Havre-Sac, XP → montée verso à 6,
  victoire à 18 XP et à PV ≤ 0, défausse chez le propriétaire.
- `progress.spec.ts` : flip verso (stats ajustées), pas de double flip.
