# Spec — Table de jeu v3 : polish « niveau MTGA » (DnD pointer, éventail, animations)

Date : 2026-06-09 · Statut : approuvé (demande directe : « reprend tout le module
de combat et rend le polish, un équivalent de MTGA, avec drag n drop etc, ça
doit être parfait en UI »). Succède à `2026-06-09-table-jeu-mtga-design.md`.

## Objectif

La table hot-seat fonctionne (lobby → mulligan → tours), mais l'UI du plateau
reste « HTML brut » : drag & drop natif (image fantôme grise, aucune
surbrillance des zones — la classe `.drag-over` n'était jamais appliquée), main
à plat, zéro animation de déplacement, aucun signal de tour. Cette v3 réécrit
la **couche interaction + motion** pour atteindre le standard MTGA, sans
toucher au moteur d'événements ni aux règles.

## Direction esthétique

« Table de grimoire » : bois sombre + braises (palette feu `#F04E22`, or
`#F0A62B`), Fraunces pour les titres, Space Mono pour les chiffres. En match,
**tout l'écran passe sombre** (topbar et journal compris) — immersion totale,
contraste avec le reste de l'app papier.

## Architecture (nouveaux modules)

- `src/composables/useBoardDnd.ts` — état global du drag (comme
  `useCardPreview`) : `armDrag()` au pointerdown (seuil 6 px pour distinguer le
  clic), suivi pointer (souris **et** tactile), registre des zones de drop
  (rects snapshotés au début du drag, hit-test au move), `hoveredZoneId`,
  callback de drop, animation de retour si lâché hors zone, inclinaison de la
  carte selon la vitesse (effet MTGA).
- `src/components/game/DragLayer.vue` — clone de la carte téléporté dans
  `<body>`, suit le pointeur (scale 1.06, tilt, ombre portée), transition de
  retour vers l'origine en cas d'annulation.
- `src/components/game/HandFan.vue` — main en **éventail arqué** (rotation +
  parabole verticale), survol = carte qui se redresse et monte au-dessus des
  autres, variante dos-de-carte pour la main adverse.
- `src/components/game/SeatHud.vue` — HUD de siège en SFC (remplace le
  composant fonctionnel `h()`), PV en évidence, lueur « joueur actif ».
- `src/components/game/PileStack.vue` — pioche/défausse/réserve en SFC,
  épaisseur de pile proportionnelle, compteur.
- `src/components/game/TurnBanner.vue` — bannière « TOUR N — À toi, X » qui
  traverse l'écran à chaque révélation de tour (façon « Your Turn » MTGA).
- `GameBoard.vue` réécrit : TransitionGroup FLIP sur toutes les zones,
  enregistrement des zones de drop, **bouton rond « Fin du tour »** flottant à
  droite (pulsation), barre d'action contextuelle re-stylée (verre sombre).
- `GameCard.vue` : drag pointer (plus de `draggable` natif), rotation d'
  inclinaison animée, pop des badges de compteur, état « fantôme » pendant le
  drag.
- `PlayTableView.vue` : en match, **plein écran fixe** (`position: fixed;
inset: 0` au-dessus du shell de l'app — immersion totale, zéro scroll),
  topbar verre sombre, mulligan en éventail, overlays re-stylés et animés.
- Suppression : `GameZone.vue` (mort, importé nulle part).

## Anatomie du plateau (issue de la vérification navigateur)

Champ de bataille **pleine largeur** (sinon il se fait manger par HUD/socle/
piles et les alliés wrappent verticalement) ; chaque siège est une **bande**
compacte façon MTGA :

```
[ bande adverse : HUD · Socle · main (dos, éventail) · Piles ]
[ champ adverse — pleine largeur ]
═══ LE MONDE / file d'attente ═══            ( Fin du tour ◯ à droite )
[ mon champ — pleine largeur, cible de drop principale ]
[ ma bande : HUD · Socle · MA MAIN (éventail) · Piles ]
```

Pièges rencontrés : `flex: 1 1 0%` sur les champs collapse en hauteur auto
(mobile) → `min-height` carte + `flex: none` ≤1024px ; l'anneau conique du
bouton Fin du tour doit garder un parent positionné en mode empilé ; après un
drop, le navigateur émet le `click` sur l'ancêtre commun (pas la carte) → le
drapeau anti-clic expire via `setTimeout(0)`.

## Interactions DnD

- Sources : main, alliés, socle (cartes du joueur en perspective).
- Cibles (les miennes uniquement) : Monde (alliés), Socle (Havre-Sac), Main,
  Défausse (dessus), Pioche (dessus), Réserve.
- Pendant le drag : toutes les cibles s'allument (liseré pointillé animé),
  la cible survolée s'embrase ; l'aperçu hover est désactivé.
- Lâcher hors cible : la carte revole à sa position d'origine (180 ms).
- Clic court inchangé : sélection → barre d'action (compat tests).

## Motion

- FLIP `TransitionGroup` (`.zone-move`, enter scale/fade, leave fade) sur main,
  alliés, socle, file d'attente.
- Tap/redresse : rotation 90° animée (cubic-bezier avec léger rebond).
- Badges dommages/PV : « pop » à chaque changement (keyframe scale).
- Bannière de tour : slide-in clip-path 1,6 s, auto-masquée.
- `prefers-reduced-motion` : tout désactivé proprement.

## Compatibilité / contraintes

- Aucune modification du moteur (`src/game/**`) ni du store (API identique ;
  seuls des appels UI s'ajoutent).
- Classes conservées pour les tests : `.gtable`, `.game-card`, `.gactionbar`,
  texte « Le Monde ».
- Tactile : `touch-action: none` sur les cartes draggables, pointer events.
- A11y : rôles/labels conservés, sélection clavier + barre d'action restent le
  chemin alternatif complet au DnD.

## Tests

- Unitaires existants (GameBoard, gameStore, moteur) : inchangés et verts.
- Nouveaux : `useBoardDnd.spec.ts` (seuil clic/drag, hit-test des zones,
  drop → callback, annulation) ; `HandFan.spec.ts` (répartition en éventail).
- Vérification navigateur (preview) sur le flux complet lobby → mulligan →
  drag d'une carte de la main vers le Monde.

## Hors scope

- Effets de cartes automatisés, IA, en-ligne (inchangé).
- Sons.
