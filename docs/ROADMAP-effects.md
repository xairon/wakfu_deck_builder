# Roadmap — Encodage des effets (à reprendre ensemble)

**Dernière mise à jour : 2026-07-01.** État : **429 / 1802 effets imprimés structurés (23,8 %)** — `auto 383 · manual 46 · uncovered 1373 · ruling 452 · keyword 256 · trait 60`. Mesure : `npm run report-coverage`.

Ce document liste **tout ce qui reste** et **comment le reprendre**. Il complète le backlog d'origine (`docs/superpowers/plans/2026-06-27-effect-encoding-backlog.md`) et la note d'architecture SOTA (`docs/superpowers/specs/2026-07-01-effect-value-expressions-sota-design.md`).

---

## 1. Principes (non négociables)

1. **« Une approximation de gameplay est PIRE qu'un effet manuel. »** On n'encode un effet que si le moteur l'exécute **fidèlement**. Sinon il reste `uncovered` → rappel manuel non bloquant à la table (le jeu est jouable).
2. **Le goulot n'est PAS le moteur** (déjà aligné SOTA : effet = donnée structurée, comme Forge/XMage). C'est le **modelage fidèle** de mécaniques hétérogènes.
3. **Motif MULTI-GAPS (mesuré cette session)** : le reliquat est bloqué par **plusieurs gaps simultanés par effet** (cadre + filtre + op-de-corps + magnitude). **Toute addition unique rend ~0 en isolation** ; un effet ne compile que quand TOUS ses gaps sont comblés. Corollaire : ne pas s'attendre à de gros bonds ; viser 1-4 effets par sous-système.
4. **Stratégie retenue : DECK-DRIVEN.** On automatise d'abord les effets des **decks réellement joués** (objectif fini et motivant), pas le % brut. Le reste vit en rappel manuel.
5. **Discipline par vague** : type-check (`npm run type-check`) + suite complète (`npx vitest run`) + idempotence (`npm run compile-effects` puis `git diff --stat public/data` vide). Bump `CACHE_KEY` (cardLoader.ts) si la forme des données change. Tout nouvel **op** doit être ajouté à `OP_TO_MECHANIC` (src/data/mechanics.ts) ET `mechanicTagSchema` (src/schema/mechanics.ts), sinon `compile-effects` throw.

---

## 2. Fondations SOTA déjà bâties (réutilisables)

- **Valeur = expression (`ValueExpr`)** — AST de magnitude évalué par `evalValue` (moteur), modèle Forge `Count$`. Nœuds câblés : `fixed`, `count` (« nombre de X que vous contrôlez »). À venir : `boundCount` (replier le legacy `fromCount`), `statOf` (Force/Niveau de cible), `mirror`, `plus`.
- **Effets de remplacement (prévention de Dommages)** au choke point unique `reduceDamage` : `damagePreventionAura` (réduction entrante continue), `damageUnpreventable` (« ne peuvent pas être réduits »).
- **Coûts payés** : `costTapControlled`, `costDestroyControlled`, `costRecycle{max}`, `costRecycleControlled`, **`costDiscard{max}`** (nouveau), `sacrificeSelf`, `banishSelf(FromDiscard)`. Machinerie de pick interactif + binding `upTo → boundCount` (magnitude du corps via `fromCount`).
- **Ciblage** contrôleur-aware (`controller: "adverse"` sur damage/tap/destroy/banish/grant), filtres `sub`/`maxLevel`/`exactLevel`/`orientation`/`combatRole`/`equipType`/`requiresAttachment`/**`noEquipment`**.
- **Déclencheurs** : `onArrive`/`onOtherAppears` (watchers), `onSelfDestroyed`, `onSelfAttacks`, `onTurnStart`, statiques (`forceAura`/`keywordAura`/`costAura`/`combatDamageReduction`/`bearerBonus`). Bus `collectTriggeredEffects`.
- **Divers** : `createToken`, `chooseOne`, `conditional`, mass ops (`tap/untap/damage/destroyAll`), `damageMultiTarget`, player-choice (`playerDraw/LoseStat/GainStat`), `promoteKeywords`, jetons de tour (`isTurnToken`).

---

## 3. Deck-driven — worklist des 4 starters Incarnam (44 restants)

Cible en cours : `incarnam-feca / -cra / -iop / -xelor` (ids dans `src/data/officialDecks.ts`). Croisement decks × data : script jetable `/tmp/starter.mjs` (à recréer — voir §6). **48 → 44** cette session. Restants, groupés par **sous-système à bâtir** :

| Sous-système à bâtir                              | Effets starters concernés                                                                                               | Notes                                                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Verrou once-per-turn** (`powerUses`)            | bwork-mage*, crapaud-mufle*                                                                                             | \*aussi coût-défausse. Prefix jeton déjà réservé (limits.ts), purge OK. À câbler dans `activateTapPower` (gate + incrément). **+0 seul** — à combiner. |
| **Modèle de Ressources** (pool)                   | piou-rouge/-jaune/-vert/-bleu (« Produisez une Ressource »), fecaline (condition)                                       | Ressource = entité produite/dépensée. Gros.                                                                                                            |
| **Magnitude dynamique** (étendre `ValueExpr`)     | repos (X PV), merelyne (Niveau X), coup-critique (Force doublée), colere-de-iop (X répartis), prospection (XP de cible) | `statOf`/`plus`/valeur-X.                                                                                                                              |
| **Porteur / riposte** (`onDamageToBearer`)        | cape-du-prespic, anneau-du-prespic, dora                                                                                | Bus dormant existant, données à parser.                                                                                                                |
| **Récence** (« qui vient de subir / s'incliner ») | fleche-d-immolation, wa-wabbit, crapaud-mufle                                                                           | counters.damage est TURN-scoped, pas combat-scoped → besoin d'un marqueur de récence fidèle.                                                           |
| **Each-player optionnel**                         | coffre-malveillant, djakky-chwan, smare                                                                                 | « chaque joueur PEUT … » (par-joueur optionnel).                                                                                                       |
| **Placement en combat**                           | bond, exclusion                                                                                                         | Déclarer bloqueur / retirer du combat.                                                                                                                 |
| **Annulation / File** (réaction)                  | echec-critique (« Annulez … qui vient d'être joué »)                                                                    | Interaction avec la file d'attente.                                                                                                                    |
| **Look-N pile**                                   | bonne-affaire (« Regardez les 2 premières… »)                                                                           | Révélation ordonnée + choix.                                                                                                                           |
| **Actor-bind même-cible**                         | jeunesse-d-ogrest (« Redressez X. Il gagne +2 »)                                                                        | Deux ops sur la MÊME cible choisie.                                                                                                                    |
| **Double coût** (tap + défausse)                  | amulette-akwadala                                                                                                       | requiresIncline + costDiscard.                                                                                                                         |
| **Tap-multi (fromCount)**                         | choc-temporel (« Inclinez le même nombre »)                                                                             | op « incline N cibles » liée à boundCount.                                                                                                             |
| **Icône perdue au scrape**                        | charge (« il gagne [.] en plus »)                                                                                       | Re-scrape source (wtcg-return.fr) avant d'encoder.                                                                                                     |

> **ROI le plus propre à reprendre** : (a) `once-per-turn` + il complète bwork-mage/crapaud-mufle (avec costDiscard déjà bâti) ; (b) `tap-multi fromCount` → choc-temporel (réutilise costDiscard + boundCount) ; (c) magnitude dynamique `statOf`/valeur-X (transverse, plusieurs cartes).

Après les 4 starters Incarnam : passer aux **starters Bonta-Brâkmar** (`bonta-brakmar-sadida/-sram`) puis aux decks Dofus Mag joués.

---

## 4. Backlog global (hors starters) — par fréquence mesurée

Incidence dans les ~1373 `uncovered` (chevauchante) — priorise les sous-systèmes transverses :

| Cluster                                           | ~Effets                                             | Type                                                           |
| ------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Déclencheurs sujet ≠ soi (« Quand un autre X … ») | 331 (dont 151 = « self apparaît » à corps manquant) | bus veilleur (onOther\*) — le corps est souvent déjà encodable |
| Continu « Tant que … » (au-delà des auras faites) | ~145                                                | modèle continu « layers » étendu                               |
| Porteur / Équipement dynamique                    | ~112                                                | modèle Porteur (riposte, bonus dynamique)                      |
| Magnitude dynamique (« égal à … »)                | ~100                                                | étendre `ValueExpr`                                            |
| Restriction « ne peut pas … » ciblée              | ~81                                                 | restriction continue                                           |
| Aléatoire / Chi-Fu-Mi                             | ~40                                                 | RNG rejouable (seed)                                           |
| Ressource                                         | ~38                                                 | pool de Ressources                                             |
| Réaction / Annuler                                | ~37                                                 | file d'attente                                                 |
| Data-bloqués (icônes perdues)                     | variable                                            | **re-scrape** wtcg-return.fr requis (ne jamais deviner)        |

> **Insight** : parmi les 331 triggers, **151 sont « Quand [self] apparaît »** dont le cadre est DÉJÀ reconnu — seul le **corps (op d'action)** manque. Étendre les ops d'action débloque là ET sur tous les cadres à la fois (le meilleur levier transverse structurel).

---

## 5. Accélérateur (à évaluer ensemble)

**Harnais LLM → schéma** : un LLM traduit le texte de carte → ops structurées, **sous garde-fous durs** (schéma Zod strict + toutes ops exécutables + passe de fidélité + revue humaine avant `auto`). Mesure de cette session : l'authoring par lot naïf a un **faible taux** sur le reste (goulot = vocabulaire manquant, pas débit). Donc l'apport réel du LLM = (a) **générer le backlog de mécaniques manquantes classé par fréquence** (pilote §4), (b) éponger la fine queue « phrasé raté ». **Pas** une baguette de couverture. Décider si on le construit.

---

## 6. Comment reprendre (recette)

1. `npm run report-coverage` — état actuel.
2. Choisir la cible (deck-driven : recréer le croisement decks × uncovered). Script jetable type :
   ```js
   // lit src/data/officialDecks.ts (noms de cartes) × public/data/*.json (coverage)
   // → liste des effets uncovered du/des deck(s) visé(s), avec id/index/élément.
   ```
3. Trier par sous-système (§3/§4). Prendre **un** sous-système.
4. Vague : type+Zod (schéma) → OP_TO_MECHANIC + mechanicTagSchema si nouvel op → parse DSL → handler moteur fidèle → tests (DSL + moteur isolé) → `compile-effects` → `report-coverage` → type-check + suite + idempotence.
5. Commit atomique. `CACHE_KEY` bump si forme données changée.

**Garde-fous vérifiés** : `scripts/` n'est pas type-checké par vue-tsc (vigilance manuelle). Toujours lancer la suite COMPLÈTE post-merge (a déjà attrapé des désyncs CACHE_KEY et des intrications git). Destruction d'un Allié (même le sien) donne l'XP à l'adversaire (415.1).
