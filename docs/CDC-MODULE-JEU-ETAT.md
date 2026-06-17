# Cahier des charges & état d'avancement — Module de jeu

> Document de suivi vivant. Mis à jour : 2026-06-17. Légende : ✅ fait ·
> 🟡 partiel · ❌ à faire. Le « comment » technique vit dans
> `docs/GAME-MODULE-V1.md` (conception) et `docs/superpowers/specs/*`
> (un spec par lot livré) ; le CDC formel du mode en ligne dans
> `docs/CDC-MODULE-JEU-V1.md`. Les numéros (ex. 702.2) renvoient aux règles
> officielles (`_incoming/rules-reference.txt`).

## 1. Socle technique

| Exigence                                                             | Statut | Notes                                                             |
| -------------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| Moteur event-sourcé pur (reducer, replay, undo, redaction par siège) | ✅     | `src/game/engine`, 100 % testé hors réseau                        |
| Couche serveur autoritative (Postgres + Edge + RNG, RLS)             | ✅     | Lot L2 livré (`supabase/`), **non branché** à la table            |
| Données cartes normalisées (éléments canoniques, mots-clés purgés)   | ✅     | migration `npm run compile-effects`, cache loader versionné (v11) |
| Effets compilés dans les données (`effects[].compiled`)              | ✅     | 132 / 2570 effets entièrement compris (parsing strict hors-ligne) |

## 2. Cycle de partie (table locale hot-seat)

| Exigence                                                                                                              | Statut | Notes                                                                             |
| --------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| Lobby : choix des decks + noms (J1/J2)                                                                                | ✅     |                                                                                   |
| Tirage du premier joueur                                                                                              | ✅     | aléatoire (ou forcé en option)                                                    |
| Main de départ = PA, mulligan officiel (−1 carte par refus, 102.4)                                                    | ✅     |                                                                                   |
| Écran de passation (cache la main de l'autre)                                                                         | ✅     |                                                                                   |
| Structure de tour : Redressement auto, Principale, Pioche auto (fin de tour jusqu'aux PA), purge des Dommages (410.8) | ✅     | phases Pioche/Fin non distinctes à l'écran (assistées)                            |
| Fin de partie : PV ≤ 0 / Niveau 3 (103.2) **même en mode libre**                                                      | ✅     | corrigé suite retour utilisateur                                                  |
| Abandonner la partie (concession → victoire adverse)                                                                  | ✅     | bouton topbar, confirmation 2 temps — retour utilisateur                          |
| Égalité 103.3 (double 0 PV simultané → 1 PV chacun)                                                                   | ✅     | `equalityRescueEvents` / `victoryFromState` (src/game/rules/progress.ts)          |
| Limite de main = PA (4873 : défausse de l'excédent, à tout instant)                                                   | ✅     | choix obligatoire (sans « Passer »), fin de tour bloquée tant que la main déborde |
| Réserve : échange entre manches (101.4)                                                                               | 🟡     | zone gérée à la main, aucun flux « entre parties »                                |
| Mode Scellé/Draft (30 cartes, 101.2)                                                                                  | ❌     | seul le Construit 48+2 est validé                                                 |

## 3. Règles de jeu (mode assisté)

| Exigence                                                                                     | Statut | Notes                                                                                             |
| -------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| Coûts en Ressources : inclinaison auto, coût = Niveau, élément requis des Alliés (4316/4381) | ✅     | sélection automatique des producteurs                                                             |
| Légalité : tour/phase/main, Monde fermé au tour 1 (4943)                                     | ✅     | refus motivés (toast)                                                                             |
| Mal d'invocation (1821) : attaque interdite le tour d'arrivée                                | ✅     | token `arrivedTurn`, préservé par l'échange Monde↔Havre-Sac                                      |
| Toggle « Règles assistées » → table libre (Cockatrice)                                       | ✅     | rien ne bloque jamais                                                                             |
| Taille du Havre-Sac (capacité, 2315/2626/4806 — le Héros compte)                             | ✅     | extraite des données ; Salle/déplacement vers un sac plein refusés                                |
| Résistance du Havre-Sac initialisée au setup (2303)                                          | ✅     | compteur + badge 🛡 sur la carte                                                                  |
| Redressement gratuit du Havre-Sac du 2ᵉ joueur (2342)                                        | ✅     | `freeUntap` (src/game/rules/resources.ts) — bonus à usage unique au tour 2                        |
| Coûts d'utilisation élémentaires des pouvoirs (« [Eau][Eau] : … », 4329)                     | ❌     | seuls inclinaison et sacrifice-self sont gérés                                                    |
| Modificateurs temporaires de PA/PM (« perd 1 PA jusqu'à la fin du tour »)                    | ✅     | op `loseStatTurn` (dsl.ts) ; tokens `paMod`/`pmMod` purgés en fin de tour (limits.ts/legality.ts) |

## 4. Combat

| Exigence                                                                         | Statut | Notes                                                                           |
| -------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| 1 attaque/tour, pas au premier tour (603.2)                                      | ✅     |                                                                                 |
| Cibles légales : Héros / Allié du Monde / Havre-Sac adverses (702.2/702.3)       | ✅     |                                                                                 |
| Attaquants/bloqueurs ≤ PM, redressés, Élémentaires exclus (303.6)                | ✅     |                                                                                 |
| Duels simultanés, dommages élémentaires, létalité damage ≥ Force (204.6)         | ✅     | Force effective = imprimée + modificateurs                                      |
| Dommages sur cible libre : PV Héros / Résistance Havre-Sac / Allié               | ✅     |                                                                                 |
| XP sur Alliés détruits, verso à 6 XP (stats ajustées), victoire à 18 (307/415)   | ✅     |                                                                                 |
| Mots-clés : Résistance (prévention par élément, 7469), Géant (répartition, 6135) | ✅     | data-driven ; Géant promu en mot-clé STRUCTURÉ dans les données (90 cartes)     |
| Choix manuel du bloqueur frappé par l'attaquant (6105)                           | ✅     | `plan.strikes` honoré, repli sur le premier bloqueur (src/game/rules/combat.ts) |
| Réactions pendant le combat (Phase d'Actions, 705)                               | ❌     | voir §6 timing                                                                  |
| Tacle / Agilité / Agressivité (mots-clés de blocage)                             | ❌     | absents des données scrapées, à scripter à la main                              |

## 5. Effets de cartes (DSL strict, compilation hors-ligne)

**Couverture : 132 effets entièrement automatisés / 2570** (un effet
partiellement compris n'est JAMAIS automatisé ; une Action ne s'auto-résout
que si TOUS ses effets compilent).

| Exigence                                                                                                                                                                                                               | Statut | Notes                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Déclencheurs : apparition, pouvoir incliné, Action jouée, début de tour                                                                                                                                                | ✅     | + optionnel (« vous pouvez »), coût sacrifice-self, entretien « ou détruisez » |
| Ops : XP, pioche, soins (direct/ciblé), pertes de PV, dommages ciblés (Résistance déduite), destruction ciblée, buffs de Force, recyclage, défausse, recherche Pioche (type/famille/niveau, arrivée inclinée), mélange | ✅     | 15 types d'ops                                                                 |
| Modalités UI : direct, confirmation, ciblage plateau, sélection en pile                                                                                                                                                | ✅     | + file d'exécution avec cascades (carte mise en jeu → son effet part)          |
| Recherches à zone alternative (« Pioche **ou** Défausse »)                                                                                                                                                             | ❌     | choix de zone à modéliser                                                      |
| Conditions (« Si vous contrôlez… », « qui vient de subir… »)                                                                                                                                                           | ❌     | rejet strict aujourd'hui                                                       |
| Déclencheurs continus (« Chaque fois que… », « Tant que… »)                                                                                                                                                            | ❌     | 66 effets, 59 formes uniques — nécessite un bus d'événements moteur            |
| Fin de tour (« À la fin du tour, … »)                                                                                                                                                                                  | ❌     | trigger non câblé (purges Dommages/Force déjà autos)                           |
| Challenges / Quêtes / Réactions (texte « Réaction : »)                                                                                                                                                                 | ❌     | dépend du timing §6                                                            |
| Fabrication / Recette (4429, 232 cartes)                                                                                                                                                                               | ❌     | artisans + recyclage typé                                                      |

## 6. Timing (File d'Attente / Réactions) — grand chantier A

| Exigence                                                                   | Statut | Notes                                                              |
| -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| File d'exécution séquentielle des effets (embryon de 503)                  | ✅     | `effectQueue` du gameStore (frames, pauses interactives, cascades) |
| File d'Attente officielle : insertion FIFO, résolution inverse (4715/4728) | ❌     |                                                                    |
| Fenêtres de priorité / Réactions (705)                                     | ❌     |                                                                    |

## 7. UI de la table

| Exigence                                                               | Statut | Notes                                                          |
| ---------------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| Drag & drop pointer (souris+tactile), zones lumineuses, retour si raté | ✅     |                                                                |
| Main en éventail, FLIP, bannière de tour, plein écran immersif         | ✅     |                                                                |
| Combat guidé (surbrillances, bandeau d'étapes)                         | ✅     |                                                                |
| Journal complet lisible (anti-triche sociale du mode libre)            | ✅     |                                                                |
| Aperçu grand format au survol                                          | ✅     |                                                                |
| Indicateur de Ressources disponibles (compteur avant de jouer)         | ❌     | l'inclinaison auto rend le coût visible a posteriori seulement |
| Attaque au drag (glisser l'Allié sur la cible, façon MTGA)             | ❌     | aujourd'hui clic + bouton ⚔                                   |
| Mobile : utilisable (layout empilé)                                    | 🟡     | non optimisé (cible V1 desktop)                                |
| A11y : clavier complet, ARIA, reduced-motion                           | 🟡     | chemins alternatifs présents, audit complet à faire            |
| Sons / vibrations                                                      | ❌     |                                                                |

## 8. Onboarding

| Exigence                                                              | Statut | Notes                                                                                  |
| --------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Tutoriel interactif sur la vraie table (coach-marks, adversaire auto) | 🟡     | implémenté (11 étapes, decks auto, spotlight) — fiabilisation du séquencement en cours |
| Page règles statique                                                  | ✅     | `/regles` existante                                                                    |
| Aides contextuelles hors tutoriel (premier match)                     | ❌     |                                                                                        |

## 9. Mode en ligne — grand chantier B

| Exigence                                                            | Statut | Notes                  |
| ------------------------------------------------------------------- | ------ | ---------------------- |
| L0-L1 moteur + redaction                                            | ✅     |                        |
| L2 serveur autoritatif (schéma, RLS, Edge, RNG)                     | ✅     | non vérifié en déployé |
| L3 sync temps réel (signal seq + pull RLS, optimistic, reconnexion) | ❌     |                        |
| L4 lobby en ligne (code 6 caractères, sièges, spectateurs)          | ❌     |                        |
| L5 confort (replay, presence, undo collaboratif)                    | ❌     |                        |

## 10. Qualité

| Exigence                                       | Statut | Notes                                           |
| ---------------------------------------------- | ------ | ----------------------------------------------- |
| Tests unitaires moteur + règles + UI critiques | ✅     | ~556 tests verts                                |
| Vérification navigateur de chaque lot          | ✅     | flux réels joués en preview                     |
| E2E Playwright de la table (lobby→combat)      | ❌     | la suite e2e ne couvre pas `/play/table` (auth) |
| Compteurs CLAUDE.md/README à jour              | ❌     | chiffres périmés                                |

## Priorités proposées

1. **Finir la fiabilisation du tutoriel** (en cours) — porte d'entrée des
   nouveaux joueurs.
2. **Petites règles à fort impact perçu** : indicateur de Ressources. (Limite de main, Taille du Havre-Sac, égalité 103.3, redressement gratuit 2342, modificateurs PA/PM et choix du bloqueur frappé : faits.)
3. **Trancher le grand chantier** : timing (fidélité règles) **ou** en ligne
   (produit). Recommandation : en ligne — le serveur est déjà prêt et le
   mode assisté local est largement jouable.
4. E2E de la table + mise à jour de la doc.
