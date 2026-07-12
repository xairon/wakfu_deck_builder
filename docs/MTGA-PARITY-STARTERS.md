# Parité MTGA — table de jeu, périmètre 4 starters Incarnam (solo)

État au 2026-07-11 (commit 2ffed149). Référence : l'expérience d'une partie
MTGA standard, transposée aux règles du Wakfu TCG. Chaque ligne cite sa
preuve (test, commit ou vérification navigateur documentée en mémoire de
session `starter-ux-audit`).

## Règles (« TOUTES les règles » du périmètre starter)

| Domaine                                                                                                           | État                                         | Preuve                                                           |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| Effets des 121 cartes des 4 decks                                                                                 | ✅ 0 non couvert (63 auto DSL + 28 scriptés) | croisement officialDecks × data (script starterCheck)            |
| Structure de tour, coûts, légalité                                                                                | ✅                                           | suite unitaire (~2100), moteur event-sourcé                      |
| Combat complet (702–708 : déclaration, cibles, blocages, frappes 6105, Géant 6135, riposte 707.1, réaction 706.5) | ✅                                           | specs combat + matrice bot-vs-bot 16 matchups à chaque commit    |
| Mort du Porteur → Équipements suivent (305.x)                                                                     | ✅ au reducer (tous chemins)                 | dacccbcc + attachmentsFollowBearer.spec                          |
| Destructions d'état 1414/3019, double-KO 103.3, Havre-Sac 410.7                                                   | ✅                                           | destruction.ts + specs                                           |
| Mal d'invocation, limite de main, mulligan, 2342 (sac doublé)                                                     | ✅                                           | specs dédiées ; 2342 aussi dans le paiement manuel (71a716de)    |
| Métier / Artisan / Fabrication (Recette)                                                                          | ✅ local                                     | vagues Fabrication (4 lots), 232 cartes fabricables              |
| Pile de résolution générale (A11)                                                                                 | ⚠️ fenêtre Échec Critique uniquement         | hors besoin starter : 0 carte starter ne l'exige (0 non couvert) |
| Zone Exil affichée                                                                                                | ⚠️ non affichée                              | 0 carte starter ne touche l'Exil (vérifié 2026-07-11)            |

## Expérience de jeu (parité MTGA)

| Fonctionnalité MTGA                                              | Chez nous                                                                               | Preuve                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| Mulligan (main de départ)                                        | ✅ overlay Garder/Mulligan                                                              | e2e + flux vsbot                           |
| Tirage au sort animé du 1er joueur                               | ✅ dé partagé, bot en pause pendant l'animation                                         | f0796ade                                   |
| Paiement auto **avec choix manuel**                              | ✅ invite producteurs (clics, re-clic, ⚡ Auto, Annuler) + surlignage éligibles/choisis | 71a716de + 408f0bb2                        |
| Cartes jouables surlignées en main                               | ✅ affordance `playable` (HandFan)                                                      | GameBoard.handList                         |
| Ciblage : cibles légales surlignées + libellé fidèle de l'effet  | ✅ targetingLabel exhaustif, repli neutre                                               | e56869d8 (bug Amal Odoua)                  |
| Combat : flèches, aperçu de dégâts (dry-run), bandeaux par étape | ✅                                                                                      | combat-intuitiveness pack + audit 4805478d |
| Priorité/réaction fluide (auto-pass)                             | ✅ défenseur auto-réactif, bannière skip-si-vide                                        | 7b75e6a6                                   |
| Tour adverse lisible                                             | ✅ assistant « Au tour de l'adversaire », badge actif, journal nommé                    | useRuleAssistant                           |
| Journal de partie propre                                         | ✅ événements nommés, bruit interne masqué                                              | journalNoise.spec                          |
| Cimetière consultable (les 2 joueurs)                            | ✅ panneau complet, zoom par carte                                                      | dacccbcc                                   |
| Piles toujours cliquables sous la main                           | ✅ z-index MTGA-like (main devant au survol seul)                                       | cedef31c                                   |
| Limite de main en fin de tour                                    | ✅ picker obligatoire                                                                   | flux vérifié                               |
| Sons de jeu                                                      | ✅ 14 repères (pose, combat, dégâts, victoire…)                                         | vague sons                                 |
| Musique de fond                                                  | ✅ ON par défaut si playlist locale (droits : aucune piste embarquée)                   | 2ffed149                                   |
| Lecture de carte (survol desktop, zoom explicite tactile)        | ✅                                                                                      | 0dbfbfb2                                   |
| Mobile / responsive                                              | ✅ 375×812 sans scroll horizontal, panneaux adaptés                                     | audit mobile                               |
| Accessibilité clavier                                            | ✅ sélection → barre d'action, Échap, ARIA                                              | play-board keyboard (mémoire)              |
| Bot adverse compétent                                            | ✅ IA heuristique > glouton (>55 % sur 60 parties, testé en CI)                         | botVsBot.spec                              |

## Validation de bout en bout

- **Matrice store** : 16 matchups (4×4, miroirs inclus) joués entièrement à
  chaque commit — un vainqueur, jamais de blocage (botVsBot.spec).
- **Matrice UI réelle** : 4 parties complètes par le vrai store de
  l'interface (lobby → sélecteurs → partie entière), 4 decks couverts des
  deux côtés — vainqueurs aux tours 29/30/35/45, 0 stall, 0 erreur console
  (outil : matchupMatrixUI.mjs ; c'est CE chemin qui a exposé le gel de
  perspective corrigé en 4805478d, invisible à la matrice store).
- 2100 tests unitaires, e2e 29/29 (navigation, thème, decks, partage, PWA,
  a11y, table), type-check strict en CI.

## Hors périmètre (délibéré, re-confirmé par l'utilisateur 2026-07-11)

- **1v1 en ligne** : périmètre arrêté sur décision utilisateur (« on ne
  travaille que sur le module starter, pas le 1 vs 1 »). Livré quand même :
  Porteur autoritatif (44d6b853) + serveur CRAFT (737d4769) ; la Fabrication
  y est proprement refusée côté client (message clair, zéro triche).
- **Encodage du pool général** (~1245 effets hors starters) : suspendu sur
  décision utilisateur (2026-07-10).
