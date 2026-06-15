# Roadmap — Bêta « starters full auto » + onboarding

> Pilotage : ce document est la feuille de route de la verticale décidée avec
> la communauté (stratégie « XMage » validée le 2026-06-11) : **les deux decks
> starter Incarnam (Feca & Iop) entièrement automatisés et testés**, branchés
> sur un onboarding qui apprend à jouer. Backlog carte par carte :
> `docs/AUDIT-STARTERS.md`. Design moteur unifié :
> `docs/superpowers/specs/2026-06-12-beta-starters-moteur-design.md`.

## Équipe (profils mobilisés)

| Rôle                                    | Mission                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Chef de projet**                      | Roadmap, arbitrages entre architectes, recette des lots, commits                                                        |
| **Ingénieurs données** (×4)             | Reconstituer les textes complets (icônes perdues au scraping) depuis `raw-card-data/pages/`, classifier rulings/erratas |
| **Architecte « effets continus »**      | Bus d'événements de règles, déclencheurs « Chaque fois que », auras « Tant que », stats dynamiques                      |
| **Architecte « coûts & restrictions »** | Coûts composés (Défaussez/Recyclez/Inclinez :), X, limites par tour, restrictions de jeu, pouvoirs à ressource          |
| **Architecte « combat & équipements »** | Fenêtre de réaction en combat, modificateurs de Dommages, Porteur d'Équipement, Panoplies                               |
| **Devs moteur**                         | Implémentation des lots (couche `src/game/rules` pure + accroches `gameStore`)                                          |
| **QA / SDET**                           | Tests vitest par lot, partie d'intégration scriptée Feca vs Iop, E2E onboarding                                         |
| **Relecteurs adverses**                 | Panel de review par lot (fidélité aux règles, régressions, conventions)                                                 |

## Constat de départ (audit du 2026-06-12)

- Feca : 5 auto · 9 vanille · 1 partiel · **16 manuel** — Iop : 1 auto · 12 vanille · 2 partiel · **17 manuel**.
- Deux problèmes transverses avant toute mécanique :
  1. **Textes troués** : les icônes inline (éléments, PA/PM/PV, Résistance) ont
     été perdues au scraping (« gagne le \_\_\_ de votre choix »). Source de
     vérité : le HTML brut de `raw-card-data/pages/`.
  2. **Rulings comptés comme effets** : les paragraphes de clarification et les
     erratas bloquent le verdict AUTO alors qu'ils ne sont pas du gameplay.

## Jalons

| #   | Jalon                                 | Contenu                                                                                                                                                              | Critère de sortie                                                                                               |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| J0  | **Données fiables**                   | Textes complets réinjectés, champ `kind` (effet/pouvoir/ruling/errata/panoplie), erratas appliqués (Trêve Unique, Bouftou Royal, pouvoirs Prespic XP+1, Chacha Noir) | Audit régénéré : les rulings ne comptent plus, textes sans trous                                                |
| J1  | **Effets continus & déclenchés**      | Bus d'événements de règles, triggers « Chaque fois que », auras « Tant que », Force dynamique (Vrombyx), létalité à 0 Force                                          | Cape/Anneau Prespic, Chef de Guerre, Maître Bolet, Jicé, Bruss, Vrombyx, Stratégie de Groupe verts + tests      |
| J2  | **Coûts composés & X**                | cost structuré (défausser/recycler/incliner), X lié aux ops, limites par tour, restrictions de jeu, pouvoirs à ressource des Pious                                   | Bwork Mage, Parchemins, Agression, Katsou Mee, Repos, Prospection, Fécaline, Coup Critique, Pious verts + tests |
| J3  | **Combat : fenêtre & Dommages**       | Jouer des Actions pendant le combat, passe unique de modificateurs de Dommages (Trêve, Glyphes, Poum Ondacié), Exclusion/Bond/Colère de Iop                          | Cartes de combat des deux decks vertes + tests                                                                  |
| J4  | **Équipements : Porteur & Panoplies** | Attachement Équipement→Porteur, bonus statiques du porteur, bonus de panoplie (sets Prespic & Bouftou), Dora, Marcassin                                              | Tous les équipements starter verts + tests                                                                      |
| J5  | **Audit vert**                        | CARD_SCRIPTS complété pour le reliquat, recompilation, audit régénéré                                                                                                | **0 carte « manuel »** sur les 2 starters (exceptions documentées et motivées, ex. Défi si infidèle)            |
| J6  | **Partie d'intégration testée**       | Tests vitest d'intégration : scénarios complets Feca vs Iop (mulligan→combat→victoire), garde anti-crash                                                             | Scénarios verts en CI                                                                                           |
| J7  | **Onboarding final**                  | Tutoriel revu pour s'appuyer sur les starters full-auto, E2E Playwright du parcours d'apprentissage                                                                  | Un nouveau joueur apprend à jouer de bout en bout                                                               |

## Règles de fonctionnement

- **Fidélité d'abord** : une approximation de gameplay est pire qu'un effet
  laissé manuel. Le principe « never-blocking » reste inviolable.
- Un commit par lot, tests verts exigés, cache cartes versionné
  (`CACHE_KEY`) à chaque recompilation des données.
- Ce document et `docs/CDC-MODULE-JEU-ETAT.md` sont tenus à jour à chaque
  jalon franchi.

## Tutoriels par mécanique (onboarding avancé)

Le tutoriel actuel (`tutorialStore` / `TutorialCoach`) apprend la boucle de base
(mulligan → jouer un Allié → attaquer). À étendre avec des **mini-tutoriels
focalisés, déclenchables à la demande**, un par mécanique — chacun ancré sur le
plateau réel (spotlight) et validé par l'état du jeu, comme l'existant :

- **Combat** : déclarer attaquants / bloqueurs, choix du bloqueur frappé (6105),
  Géant, Résistance, létalité, XP des Alliés détruits.
- **Équiper un Équipement** : attacher au Porteur, bonus statiques, panoplies.
- **Familiers / Alliés** : invocation (mal d'invocation 1821), inclinaison pour
  produire des Ressources, redressement en début de tour.
- **Jouer une carte & payer le coût** : Niveau = coût en Ressources, inclinaison
  des producteurs (Héros + Havre-Sac inclus).
- **Havre-Sac & Monde** : échange Monde↔Havre-Sac, Résistance du Havre-Sac.
- **Montée de niveau du Héros** : 6 XP → Niveau 2 (face verso), 18 XP → victoire.
- **Actions / Salles / Zones** : quand et comment les jouer.

Cadre : réutiliser l'infra existante (étapes ancrées, `advanceWhen`, texte
dynamique) + un sélecteur « Apprendre une mécanique » dans le lobby. À planifier
après stabilisation de la v1 (combat + onboarding).
