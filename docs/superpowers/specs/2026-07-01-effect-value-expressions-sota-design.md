# Effets — alignement SOTA : « valeur = expression » (ValueExpr) et feuille de route

**Date** : 2026-07-01 · **Statut** : fondation livrée (nœuds `fixed` + `count`), reste en incréments.

## Contexte & décision

Question posée : « utilise-t-on les bons paradigmes / un moteur SOTA ? existe-t-il des
moteurs paramétrables, systèmes à graphe/chaîne ? »

Recherche (Forge, XMage, règles MTG) → **notre modèle est déjà aligné SOTA** : un effet
est de la **donnée structurée** (`compiled.ops`), pas du texte parsé au runtime — exactement
comme les abilities de Forge (`DB$Draw | NumCards$ 3`, triggers `T:Mode$ …`, valeurs
dynamiques `Count$…`). Le compile-effects hors-ligne = leur script d'ability.

**Le goulot n'est pas l'architecture de résolution** — c'est le modelage fidèle de ~1400
effets hétérogènes + la qualité des données (icônes droppées). Aucun moteur ne fait
s'auto-encoder du langage naturel. Donc : **pas de réécriture.** On adopte proprement les
primitives que les gros moteurs formalisent et qu'on avait en ad-hoc.

### Fausses pistes écartées

- **Drools / RETE / moteurs de règles génériques / behavior-trees** : mauvais fit. Un effet
  de carte = AST typé + petit interpréteur + bus d'événements, pas du forward-chaining. Les
  « graphes/chaînes » existent _dans_ l'interpréteur (pile de résolution, ordre de dépendance
  des effets continus), pas comme moteur externe à adopter.
- **LLM au runtime** : non. Mais **LLM→schéma pour l'authoring** (traduire le texte de carte
  → `ops` structurées, sous gate Zod strict + tests de fidélité) = le seul levier nouveau pour
  la longue traîne per-carte (cf. « ForgeScribe » côté Forge).

## Les 4 primitives SOTA (ordre d'adoption)

| #   | Primitive                         | Modèle                                             | Notre état avant                                         | Cluster visé                            |
| --- | --------------------------------- | -------------------------------------------------- | -------------------------------------------------------- | --------------------------------------- |
| 1   | **Valeur = expression**           | Forge `Count$`                                     | ad-hoc (`fromCount`, `damageTargetByForce`, `count` W34) | magnitude dynamique ~100                |
| 2   | **Effets continus « layers »**    | MTG CR 613 (timestamps + dépendances)              | plat / cas-par-cas                                       | « Tant que… » ~145                      |
| 3   | **Effets de remplacement**        | MTG CR 614/616 (intercepte l'événement, hors pile) | inexistant                                               | « à la place / réduits à 0 »            |
| 4   | **Pile de résolution + priorité** | la _stack_ + fenêtres de réaction                  | file de frames + bus (embryon)                           | Réaction/Annuler ~37, triggers≠soi ~331 |

## Primitive 1 — `ValueExpr` (LIVRÉE)

**Invariant** : toute magnitude numérique d'op est soit un **littéral `n`**, soit une
**`value: ValueExpr`** — un petit AST évalué à la résolution par **UN seul** évaluateur moteur
`evalValue(expr, frame)`. (Comme Forge : `NumCards$ 3` littéral vs `NumCards$ X` + `Count$…`.)

```
ValueExpr =
  | { kind: "fixed", n }              // littéral (composable)   ✅ câblé
  | { kind: "count", of: CountSpec }  // « nombre de X que vous contrôlez »  ✅ câblé
  // ── à venir, 1 incrément = 1 nœud + SON effet réel (jamais spéculatif) ──
  | { kind: "boundCount", perCount? } // remplace le legacy fromCount (coûts « Recyclez jusqu'à N »)
  | { kind: "statOf", stat, of }      // généralise damageTargetByForce (Force/Niveau de cible/soi)
  | { kind: "mirror" }                // « le même nombre »
  | { kind: "plus", base, add }       // « 1 plus le nombre de … »
```

`CountSpec` (source `controlled`) = nb d'instances EN JEU (Monde + Havre-Sac) contrôlées par
l'acteur du type `what` (+ Famille `sub`). Un Équipement attaché est co-localisé avec son
Porteur (`ATTACH` → `equip.location = bearer.location`) donc compté — fidèle au ruling
« portés par votre Héros / vos Alliés » + standalone. Miroir exact de la condition `controlsAlly`.

**Implémentation** : `valueExprSchema`/`countSpecSchema` (`src/schema/effects.ts`), types
`ValueExpr`/`CountSpec` (`src/types/cards.ts`), `evalValue` + `opMagnitude` + `countControlled`
(`src/game/rules/effects/engine.ts`), parse `countType` (`dsl.ts`). Effet couvert : Enutrof
Incarnam « Piochez un nombre de cartes égal au nombre d'Équipements que vous contrôlez ».

**Règles** :

- `value` est un CHAMP, pas un op → **ne pas** toucher `OP_TO_MECHANIC` / `mechanicTagSchema`.
- `opMagnitude` : `value`→`evalValue` prioritaire ; sinon legacy `fromCount`×`perCount`
  (73 occurrences NON migrées, repli reconnu) ; sinon `n`. Migration de `fromCount` vers
  `{kind:"boundCount"}` = incrément ultérieur, pas de big-bang.
- AST plat pour l'instant (typage exact) ; passer `valueExprSchema` en `z.lazy` dès qu'un nœud
  (ex. `plus`) imbriquera une `ValueExpr`.

## Primitive 3 — effets de remplacement (incrément 1 LIVRÉ)

Point d'insertion : le **choke point unique** `reduceDamage` (`src/game/rules/effects/damageMods.ts`)
par lequel passe TOUTE infliction de Dommages (combat + effet). On n'a PAS bâti de pile MTG
from-scratch : on étend ce point avec des effets de prévention continus.

Nœud livré : `StaticAbility` `damagePreventionAura` (`amount = all | n`, `to = controllerHero |
controlledAllies{sub?}`), active tant que la source est en jeu, appliquée HORS combat aussi
(contrairement à `combatDamageReduction`, gaté combat). DSL : « [Tant que <self> dans le Monde,]
tous les Dommages sur le point d'être infligés à <bénéf> sont réduits <montant> ». **+2 auto**
(Allister = bouclier Héros total ; Donjon des Craqueleurs = −1 aux Craqueleurs) → 416/1802.

Incréments #3 suivants (même choke point, même prédicat) : sens SORTANT (« que devrait
infliger … réduits à 0 »), durée TOUR (jetons temporaires), cible CHOISIE, filtre par SOURCE,
flag inverse « ne peuvent pas être réduits », redirection « à la place ». ~41 effets adressables.

## Discipline (inchangée)

« Une approximation de gameplay est PIRE qu'un effet manuel. » On n'émet une op/valeur QUE si
le moteur l'exécute fidèlement, tests à l'appui. Chaque incrément : type-check + suite complète

- idempotence (`compile-effects` puis `git diff --stat public/data` vide) + bump `CACHE_KEY`.
