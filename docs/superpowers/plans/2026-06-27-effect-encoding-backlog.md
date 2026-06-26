# Encodage des effets pour le module de combat — backlog de campagne

**But (objectif utilisateur)** : tous les effets de toutes les cartes répertoriés
(modèle béton) **puis** encodés à l'état de l'art pour le module de combat.

**État au 2026-06-27**

- ✅ **Répertoriage / modèle béton — FAIT.** Chaque effet porte un `coverage`
  (`auto|manual|uncovered|ruling|keyword|trait`), schéma Zod strict + validation
  à l'écriture, mécaniques dérivées. Voir [[card-data-format-foundation]],
  [[keyword-layer]], couche traits.
- 🔄 **Encodage combat — campagne en cours.** Couverture actuelle :
  `auto 148 · manual 7 · uncovered 1655 · keyword 256 · trait 60 · ruling 444`.
  Les **1655 `uncovered`** sont de vrais effets en phrase à encoder.

## Principe directeur (non négociable)

« Une approximation de gameplay est PIRE qu'un effet manuel. » On n'encode un
effet que si le moteur peut l'exécuter **fidèlement**. Chaque op nouvelle =
DSL parse + type/Zod + handler moteur (`runFrame`/targeting) + tests, fidèle aux
règles. Tant qu'une op n'est pas exécutable fidèlement, l'effet reste `uncovered`
(rappel manuel non bloquant à la table).

## Structure du problème : 2 axes

Un effet = **DÉCLENCHEUR/condition** (quand/comment) × **ACTION** (ops). La
campagne doit étendre les deux. Comptes par axe (classification primaire,
premier match) :

### Axe A — Déclencheurs & cadres (le « quand/comment »)

| Cluster                             | Count | Capacité requise                                                                                                                                 | Tier       |
| ----------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Déclenché « Quand / Chaque fois »   | 340   | **Parseur de condition de déclenchement** (sujet ≠ self, événements : apparition d'un autre, destruction, gain Chi-Fu-Mi, Dommages subis…) + bus | Structurel |
| Pouvoir à paiement « Coût : effet » | 148   | Parseur de coût générique (au-delà de `sacrificeSelf`) : inclinaison d'autres, paiement de ressources, défausse                                  | Structurel |
| Continu « Tant que … »              | 133   | Vocabulaire de modificateurs continus étendu (au-delà des 5 `StaticAbility`)                                                                     | Moyen      |

### Axe B — Actions (les ops), prérequis moteur

| Cluster                                   | Count | Op / capacité                                                                                             | Tier         |
| ----------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------- | ------------ |
| Bearer / Équipement « le Porteur … »      | 148   | **Modèle Équipement/Porteur (lot F, dormant)** : `bearerOf`, bonus au porteur, riposte `onDamageToBearer` | Structurel   |
| Dommages (variantes ciblage)              | 160   | étendre `damageTarget` (cibles multiples, « tous les Alliés », « qui vient de subir… »)                   | Moyen        |
| Draw (variantes/conditionnel)             | 86    | étendre `draw` (conditionnel, « chaque joueur pioche »)                                                   | Moyen        |
| Destruction (variantes/conditionnel)      | 81    | étendre `destroyTarget` (multi-type « Équipement ou Zone », condition « qui ne porte aucun Équipement »)  | Moyen        |
| Restriction « ne peut pas … »             | 78    | restriction continue ciblée (au-delà de `cannotBlock` self)                                               | Moyen        |
| Force (variantes)                         | 66    | étendre `buffForce*` (cibles, durées, malus)                                                              | Faible       |
| Inclinaison/redressement d'une cible      | 53    | nouvelle op `tapTarget`/`untapTarget` (cible)                                                             | Faible-Moyen |
| Mise en jeu / invocation / jetons         | 47    | modèle de **jetons** + put-in-play hors recherche                                                         | Moyen        |
| Défausse (adverse/conditionnel)           | 46    | étendre `discardFromHand` (adverse, conditionnel)                                                         | Moyen        |
| « Le joueur de votre choix perd N PA/PM » | 29    | **ciblage de JOUEUR** (le moteur ne cible que des instances)                                              | Moyen        |
| Annuler / Réaction                        | 26    | **interaction avec la File d'Attente** (annulation d'un effet/carte joués)                                | Structurel   |
| Produire une Ressource                    | 26    | **modèle de Ressources** comme entité jouable                                                             | Structurel   |
| Contrôle (« prenez le contrôle »)         | 13    | transfert de contrôleur                                                                                   | Moyen        |
| Renvoi en main                            | 14    | ciblage contrôleur-aware + `move` → main                                                                  | Faible-Moyen |
| Chi-Fu-Mi / aléatoire                     | 7     | **modèle d'aléatoire** déterministe (seed rejouable)                                                      | Structurel   |
| Recherche/révélation, déplacement         | 5     | étendre `searchDeck` / `move`                                                                             | Faible       |
| OTHER (cas par cas)                       | 149   | analyse unitaire (scripts manuels `CARD_SCRIPTS`)                                                         | Variable     |

> Les comptes des deux axes se recoupent (un « Quand X, infligez N » compte en
> Axe A). Le total `uncovered` = 1655 ; les tableaux servent à prioriser, pas à
> additionner.

## Plan de vagues (ordre = ROI × sécurité × déblocage)

Chaque vague : implémentée, testée (compile gate strict + suite), commitée,
mergée localement (pas de push = pas de déploiement). Mesure de progrès :
`npm run report-coverage`.

1. **Vagues « ops sûres » (faible risque, op existante)** — formulations non
   parsées mappées à une op existante & testée. _Déjà commencé_ : « [Héros]
   regagne N PV » → `heroGainPv` (auto 145→148). Continuer : variantes draw/XP/
   dégâts au Héros adverse au phrasé proche.
2. **Ciblage générique étendu** (Axe B Faible/Moyen sans prérequis structurel) :
   `tapTarget`/`untapTarget`, `returnToHand`, `destroyTarget` multi-type &
   conditionnel, `buffForce` variantes. Nécessite de rendre `effectTargetIds`
   **contrôleur-aware** (passer le `seat`) — refactor contenu, rétro-compatible.
3. **Ciblage de joueur** : PA/PM de l'adversaire (29) — petite extension
   d'interaction (cible joueur en 1v1 = l'adversaire).
4. **Parseur de condition de déclenchement** (Axe A, 340) : le plus gros
   déblocage. Étendre `compileEffectText` aux sujets ≠ self et aux événements du
   bus (`collectTriggeredEffects` existe déjà). Vague majeure, sous-découpée par
   type d'événement.
5. **Pouvoirs à paiement génériques** (148) : coûts au-delà de `sacrificeSelf`.
6. **Modèle Équipement/Porteur (lot F)** (148) : feature structurelle ; débloque
   bearer + ripostes (déjà câblé en dormant dans le bus).
7. **Modèles structurels restants** : Ressources (26), Annulation/File (26),
   aléatoire rejouable (7), contrôle (13).
8. **OTHER / longue traîne** (149) : scripts manuels `CARD_SCRIPTS` carte par
   carte (approche XMage), uniquement quand les ops expriment fidèlement.

## Garde-fous de campagne

- Suite verte (872) + `type-check` + idempotence à chaque vague.
- Le gate strict (`cardSchema`) + la validation à l'écriture empêchent toute
  donnée non conforme.
- `scripts/` n'est pas type-checké par `vue-tsc` → vigilance manuelle sur les
  types du pipeline.
- Aucune op n'est émise sans handler moteur fidèle (sinon = pire que manuel).

## Definition of Done (objectif)

`uncovered` → 0 **ou** chaque `uncovered` résiduel documenté comme
intentionnellement manuel (règle non fidèlement automatisable). Tous les effets
encodés exécutés fidèlement par le moteur, sous tests.
