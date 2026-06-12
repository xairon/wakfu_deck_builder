# Spec — Tutoriel interactif de la table (« Apprendre à jouer »)

Date : 2026-06-10 · Statut : approuvé (demande : « faudra faire un
onboarding/tuto de départ aussi pour apprendre à jouer »).

## Principe

Pas de page de texte : un **tutoriel guidé sur la vraie table**, façon MTGA.
L'apprenant joue une vraie partie (decks réels choisis pour la simplicité),
des **coach-marks** ancrés sur les vrais éléments du plateau expliquent
chaque notion, et la progression est validée par **l'état réel du jeu**
(la carte est jouée, le tour est fini, l'attaque est résolue) — pas par des
« Suivant » passifs, sauf pour les étapes purement informatives.

## Architecture

- `src/stores/tutorialStore.ts` — machine à étapes :
  - `steps[]` : `{ text, anchor (sélecteur CSS), advanceWhen?: () => boolean,
manual?: boolean }` ; `current`, `start()`, `next()`, `skip()`.
  - **Adversaire auto-piloté** : pendant le tutoriel, le siège B est joué par
    un watcher (révèle la passation, garde sa main au mulligan, finit son
    tour après une courte pause) — l'apprenant ne joue que le siège A.
    B est **premier joueur** : son tour 1 absorbe la restriction « pas de
    Monde au premier tour », l'apprenant joue dès le tour 2.
  - Decks du tutoriel : héros + havre-sac réels, 16 Alliés Niveau 1 de
    l'élément du héros **sans effets compilés** (aucun overlay parasite).
  - Fin : drapeau `localStorage` `wakfu-tutorial-done`.
- `src/components/game/TutorialCoach.vue` — bulle fixe positionnée près de
  l'ancre (rect recalculé périodiquement), **spotlight** sur l'élément ciblé
  (`pointer-events: none` — ne bloque jamais l'interaction), bouton
  « Suivant » (étapes manuelles) et « Passer le tutoriel » permanent,
  z-index au-dessus des overlays de la table.
- `PlayTableView` : bouton « 🎓 Apprendre à jouer » dans le lobby ;
  `<TutorialCoach />` monté en match.

## Parcours (≈ 11 étapes)

But du jeu → passation → mulligan (garder) → HUD (PV/PA/PM/XP) → main &
Ressources (coût = Niveau, inclinaison auto) → jouer un Allié (glisser sur
le Monde, validé par l'état) → mal d'invocation + Fin du tour → re-passation
→ attaque guidée (sélection → ⚔ → cible Héros → résolution, validé par
`attackedOnTurn`) → journal & effets automatiques → conclusion (continuer
librement ou quitter).

## Hors scope

Tutoriel des effets avancés (ciblage, entretien), IA réelle, localisation.
