# « Cadre » — mode online unique (allègement du 1v1)

**Date** : 2026-07-17 — **Statut** : approuvé (option A + pioche auto)

## Problème

Le 1v1 online proposait deux modes : « règles assistées » (gates stricts : coûts
auto, conditions par carte, restrictions de réaction…) et « table libre »
(manuel). Or les effets de cartes ne sont PAS automatisés en ligne : chaque gate
assisté qui ignore un effet joué à la main refuse un coup légitime et bloque le
joueur (classe de bugs constatée par les playtesters). Deux modes = double
surface de code et d'effets de bord.

## Décision

**Un seul mode online : le Cadre.** Structure + combat serveur + anti-triche,
tout le reste manuel. Le mode 100 % assisté (MTGA-like) reste réservé au
solo/tutoriel/vs bot (périmètre starters).

### Le Cadre (imposé par le serveur — existe déjà)

- Identité/anti-triche : sièges authentifiés, propriété, jetons moteur
  verrouillés, mains secrètes (redaction), validation de deck, append atomique.
- Structure de tour : joueur actif (Fin du tour / Attaque), **pioche
  automatique en fin de tour** (complétée jusqu'aux PA), recyclage de la
  Défausse (deck-out).
- 506.3 + routage Allié/Salle → Havre-Sac au 1er tour ; Taille du Havre-Sac ;
  mouvements 414.x ; mal d'invocation et 1 attaque/tour (déclaration).
- **Combat automatisé** : déclaration → blocages → frappes/Géant → riposte →
  résolution calculée serveur (dégâts, morts, XP/Niveau, victoire).

### Manuel (liberté du joueur — existe déjà, table libre)

Coûts (le joueur incline ses producteurs), conditions par carte, effets de
cartes (à la main), compteurs nommés ajustables sur ses cartes, gestes
hors-tour (réactions), Équiper / Piocher / Montrer sa main / Défausser.
RuleAssistant = conseils non bloquants.

## Changements

1. **Lobby** : suppression du choix « règles assistées » ; toute partie online
   est créée `assisted=false`. La colonne/plomberie serveur reste (compat
   parties en cours et vieux clients).
2. **Client** : `connectOnline` force `assist=false` (le 1v1 online est
   toujours le Cadre) — une seule voie de code online.
3. **Combat débloqué en online** : les gates client du HUD de combat
   (Attaquer, blocages, frappes, Géant, résolution, aperçu dégâts) qui
   exigeaient `assist` acceptent désormais `online`.
4. **Nettoyage** : suppression des branches client `online && assist`
   (prompt de Porteur online-assisté de playFromHand, etc.). Les intents
   serveur (PLAY_CARD…) restent — compat vieux clients.

## Limites assumées

- Le combat serveur calcule avec les Forces imprimées (+ équipements). Un
  effet manuel « +2 Force » n'est pas représentable (jetons verrouillés,
  anti-triche) → les joueurs corrigent après coup via les compteurs
  dégâts/PV (libres). Follow-up possible : compteur « Force ± » visible lu
  par le combat en partie manuelle.
- Parties assistées EN COURS au moment du déploiement : le client les traite
  en Cadre ; le serveur (manual=false) garde ses gates de tour → gestes
  hors-tour refusés jusqu'à la fin de ces parties (fenêtre courte, assumé).
- Chi-Fu-Mi (Kanigrou) reste local-only ; en ligne, bouclier joué à la main.

## Tests

- Unitaires : gates combat débloqués online (Attaquer visible/fonctionnel en
  non-assisté via transport mock ; DECLARE_ATTACK/RESOLVE_COMBAT émis).
- Suite existante : verrouille déjà le Cadre serveur (506.3, Taille,
  compteurs, hors-tour, anti-triche) — doit rester verte.
