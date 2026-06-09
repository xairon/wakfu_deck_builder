# Spec — « La Table des Douze » v2 : partie guidée hot-seat (façon MTGA)

Date : 2026-06-09 · Statut : approuvé (hot-seat « passe la main » + table assistée, max MTGA).

## Objectif

Transformer le bac à sable omniscient déroutant en une **vraie partie guidée**,
hot-seat 2 joueurs sur un écran, aux **emplacements canoniques Wakfu TCG**, avec
une ergonomie **au plus proche de MTGA** : choix de deck par joueur, tirage,
mulligan, tours/phases clairs, perspective qui bascule, aperçu au survol.

## Règles Wakfu retenues (source : wtcg-return.fr/regles/completes)

- **Main de départ** = nombre de cartes égal aux **PA** (6 au niveau 1).
- **Mulligan (rollback)** avant le tour 1 : recycler toute la main, re-mélanger,
  re-piocher **−1 carte** par tentative, jusqu'à 0.
- **Pioche en FIN de tour** (jusqu'aux PA), pas au début.
- **Phases** : Redressement → Principale → Pioche → Fin.
- **Emplacements** : Havre-Sac + Héros (arrière), Monde commun (centre),
  File d'Attente (centre), Main (devant soi), Pioche/Défausse (arrière).

## Flux (machine à états du match)

`lobby → coinflip → mulligan → playing → finished`

1. **Lobby** : 2 sélecteurs de deck illustrés (J1, J2) + noms ; bouton Lancer.
2. **Coin flip** : premier joueur aléatoire, annonce.
3. **Mulligan** : pour chaque joueur à tour de rôle, écran de **passation**
   (« passe l'appareil ») puis main de 6 + Garder / Mulligan (−1).
4. **Playing** : perspective = joueur actif (en bas, main révélée) ; adversaire
   en haut (main cachée = dos). TurnBar (tour, joueur, phase) + « Finir le tour ».
5. **Finir le tour** : pioche auto jusqu'aux PA → passation → bascule perspective.

## Disposition (perspective unique, « moi » en bas)

```
[ Main adverse — dos comptés ]
[ arrière adverse : Pioche · Havre-Sac+Héros · Défausse ]   (HUD adverse PV/PA/PM)
[ Monde — alliés adverses ]
═══════ FILE D'ATTENTE (centre) ═══════
[ Monde — mes alliés ]
[ mon arrière : Pioche · Havre-Sac+Héros · Défausse ]       (mon HUD)
[ MA MAIN — éventail révélé ]
```

## Interactions (max MTGA)

- **Hover** → gros aperçu de la carte sur le côté (panneau fixe).
- **Clic** → actions contextuelles (jouer au Monde, incliner, défausser…).
- Phases assistées : Redressement (redresse + purge dommages auto), Principale
  (jeu libre), Pioche (auto jusqu'aux PA), Fin.

## Changements techniques

- **Vue redactée par perspective** : `redactStateFor(perspective)` au lieu de
  `omniscientView` → main adverse = dos. L'écran de passation couvre la bascule.
- **gameStore** : machine à états du match (lobby/mulligan/playing/finished),
  `perspective`, `passPending`, `mulliganSeat`, `dealOpening(seat)`,
  `mulligan(seat)`, `keepHand`, `endTurn` (pioche fin + bascule).
- **GameBoard** paramétré par `me`/`opp` (perspective), « moi » en bas.
- Nouveaux composants : `MatchLobby`, `CoinFlip` (inline), `MulliganPanel`,
  `PassDevice` (passation), `TurnBar`, `CardHoverPreview`.

## Hors scope (assumé)

- Pas d'automatisation des effets de cartes (table **assistée**, pas moteur de règles).
- Pas d'IA. Le vrai 1v1 en ligne caché = serveur L2 déjà construit, à brancher plus tard.
