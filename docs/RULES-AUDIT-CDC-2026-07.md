# Cahier des charges — Règles & interactions non implémentées (audit 2026-07-09)

Audit du module de jeu (`src/game/`) contre le rulebook officiel WTCG
(wtcg-return.fr/regles/completes). Établi après une session de corrections rules
(réactions, protection Havre-Sac, placement/mouvement des Alliés). Sert de feuille
de route priorisée. **NB** : les anciens docs (`AUDIT-STARTERS.md`, `CDC-MODULE-JEU-*`)
sont partiellement périmés — cette page fait foi pour l'état 2026-07-09.

## 0. État actuel (mesuré)

- **Effets automatisés** : 416 `auto` + 69 `manual-légitime` = **485 / 1794 structurés (27 %)** ; 1309 `uncovered` (rappel manuel). Métrique : `npm run report-coverage`, invariant `tests/data/coverage.spec.ts`.
- **~1936 tests unitaires**, type-check `vue-tsc` vert, build ~11 s.
- **Fait récemment (session 2026-07)** : réactions de combat ergonomiques (défenseur auto + bot réagit), protection du Héros/Alliés embagés (508.x), placement Allié → Havre-Sac au 1er tour (303.1), **mouvement des Alliés Havre-Sac↔Monde (414.1/414.2)**, restriction d'attaque au Monde (503.1), bannissement Havre-Sac (410.7) expulse les Alliés, dé de 1er joueur, coûts payés (Agression), Kanigrou/Défi/Amar Casto/Glyphe/Katsou (formes bornées).

---

## 1. VOLET A — Règles systémiques manquantes (priorisé)

### P1 — Impactant, tractable (à faire en premier)

| #   | Règle                                                          | Manque                                                                                                                                                                                                                                                                                                                                                                                                                       | Spec courte     | Effort |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------ |
| A1  | ✅ **FAIT 2026-07-09** — Choix de zone Allié tours ≥ 2 (303.1) | `playDestination(preferred)` + `resolvedPlayDestination` (préférence ignorée en combat) + intent `PLAY_CARD.destination` (online) + UI : zone de drop / boutons « → Monde / → Socle » portent le choix (défaut Monde). Vérifié en preview.                                                                                                                                                                                   | commit a8e8d09b | —      |
| A2  | ✅ **FAIT 2026-07-09** — Mal d'invocation à la sortie          | Rulebook vérifié (**303.3** : lié à l'APPARITION, pas au mouvement) → `arrivedTurn` non reposé à la sortie = **correct par les règles** ; test de verrou ajouté (legality.spec).                                                                                                                                                                                                                                             | commit a8e8d09b | —      |
| A3  | ✅ **FAIT 2026-07-09** — 414.2/414.3 pour le Héros             | Héros incliné refusé (414.2), entrée au Havre-Sac plein refusée (414.3) ; contrôles communs extraits dans `whyCannotMoveCommon` (une seule source Héros/Allié).                                                                                                                                                                                                                                                              | commit a8e8d09b | —      |
| A4  | ✅ **FAIT (W26, verrouillé 2026-07-09)** — Ciblage de JOUEUR   | Déjà câblé bout-en-bout par W26 (choix de joueur = ciblage de Héros, Monde ET Havre-Sac — un Héros embagué reste choisissable EN TANT QUE JOUEUR, 508.x ne s'applique pas) ; verrou d'intégration store ajouté (playerChoiceIntegration.spec). Le reliquat des ~29 effets « joueur » = VARIANTES DE PHRASES (durée « son prochain tour », clauses composées, défausse aléatoire) → vagues Volet B, pas un manque systémique. | —               | —      |

### P2 — Sous-systèmes de combat (moyen, risque modéré)

| #   | Règle                                                                | Manque                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A5  | ✅ **FAIT 2026-07-09** — Choix du joueur en combat (6105/6135/707.1) | Géant : étape « geant » (plan.geantAssign validé `whyBadGeantAssign`, préremplie `autoGeantAssign`, UI ±/clic, online + bot ; commit caae5210). Frappe 6105 et riposte 707.1 : étapes « strikes »/« riposte » préexistantes. Les défauts auto restent en FALLBACK moteur (jamais bloquant).                                                                                                                                                                |
| A6  | ✅ **FAIT (constaté + nettoyé 2026-07-09)** — DamageMods lot E       | Entrée périmée : Glyphe Revigorant était DÉJÀ auto (jeton d'équipe `teamDmgRedCombatMod` dans reduceDamage) et Glyphe Incandescent auto sur la déclaration (W70, marqueur `glypheDamage`). Les variantes `protectCombatants`/`tapTrap` jamais produites ont été SUPPRIMÉES (code mort) — `treve` reste le seul DamageMod global.                                                                                                                           |
| A7  | ✅ **FAIT 2026-07-09** — Inclinaison mid-combat (bus « tapped »)     | Nouveau RuleEvent `tapped` émis par resolveTapTarget (vraie inclinaison par EFFET) → `tappedFrames` : si un combat est déclaré et que la créature en est attaquant/bloqueur, le Glyphe inflige ses paquets. Fin de combat 708.3 exclue PAR CONSTRUCTION (resolveCombat n'émet pas `tapped` — ruling respecté). Reliquat conservateur documenté : inclinaisons par COÛT (paiement de Ressources / pouvoir) mid-combat non couvertes (aucune approximation). |

### P3 — Timing / triggers (gros, structurel)

| #   | Règle                                                                           | Manque                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A8  | ⚙️ **PARTIEL (entrée périmée constatée 2026-07-10)** — Bus « sujet ≠ soi »      | Le bus d'APPARITION existe depuis W12/W15/W24 (onOtherAppears + veille queueArrivalEffects + actor-binding « appeared » + clauses de lieu). A8.2 étend la grammaire : préfixe « Tant que <self> est dans le Monde » (verrou watcherInMonde) + sujet possessif « un(e) [autre] de vos <Famille>s » (controller self) — Gelée Royale Bleue + Grasmera promues auto. Corpus restant mesuré : ~7 apparitions à corps non supportés (tuteurs, protections, flottants) + les AUTRES familles d'événements (« chaque fois qu'un joueur pioche/défausse », « quand un Équipement apparaît chez un autre joueur »…) → un bus RuleEvent par famille, une vague chacune. |
| A9  | **Continu « Tant que… »** (~133)                                                | Modèle de layers de modificateurs limité à 5 auras statiques ; « Tant qu'Alibert est en jeu, +1 PA » non modélisé.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| A10 | ⚙️ **PARTIEL 2026-07-10** — Trigger onTurnEnd                                   | Les DÉCLENCHÉS DE MORT du balayage de fin de tour tournent désormais (turnEndDestroyEvents émet les RuleEvents `destroyed`, collectés AVANT dispatch dans nextTurn — « Quand détruit » + hand-watchers). Reste : bus onTurnEnd GÉNÉRIQUE (effets « à la fin du tour » arbitraires, datamodel multi-trigger) — feature project.                                                                                                                                                                                                                                                                                                                                |
| A11 | **Pile de résolution / annulation (606)**                                       | Résolution immédiate ; pas de file de priorité générale. Échec Critique = hack `pendingResolution` profondeur 1 (`cardScripts.ts:1041`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A12 | **Conditions de jeu/trigger (« Si vous contrôlez… », « qui vient de subir… »)** | Rejet strict aujourd'hui (sauf cas bâtis : `heroInZone`, récence). Parseur de condition générique manquant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### P4 — Modèles de données (structurel)

| #   | Règle                                         | Manque                                                                                                                                                                                 |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A13 | **Équipement/Porteur dynamique** (~148)       | Attachement + riposte + Force/Résistance/Géant conférés OK ; bonus dynamiques « le Porteur gagne X tant que… », +PV, panoplies/sets NON (`keywords.ts:200-219`, `cardScripts.ts:191`). |
| A14 | **Magnitude dynamique `ValueExpr`** (~100)    | « soin = Dommages infligés », « égal au nombre de… » → nœuds AST `statOf`/`mirror`/`plus` manquants.                                                                                   |
| A15 | **Restriction ciblée « ne peut pas… »** (~81) | `cannotBlock` self OK ; interdiction posée sur une cible adverse (attaquer/bloquer/redresser) non modélisée.                                                                           |
| A16 | **Octroi/retrait de mot-clé arbitraire**      | Seuls Géant/Agilité/Agressivité/Tacle octroyables ; « gagne Fantôme », « perd Agilité » = no-op → manuel (`keywords.ts:270-278`).                                                      |

### P5 — Modes & méta (hors table de combat)

| #   | Sujet                                         | Manque                                                                                                            |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A17 | **Réserve & échange entre manches (101.4)**   | Réserve non piochable, pas de flux inter-manches.                                                                 |
| A18 | **Draft / Scellé (101.2)**                    | Seul le Construit 48+2 validé.                                                                                    |
| A19 | **Fabrication / Recette (4429, ~232 cartes)** | Système d'Artisans + recyclage typé absent.                                                                       |
| A20 | **Machine de phases (602/605)**               | `turn.phase` plat « principale » + libellés ; pas de Redressement/Pioche/Fin distinctes (choix de design assumé). |

---

## 2. VOLET B — Couverture d'effets (1309 `uncovered`)

Goulot mesuré = **vocabulaire d'ops d'action fidèles**, PAS le moteur ni les triggers.
Étendre les ops débloque simultanément tous les cadres (apparition/tour/inclinaison/onPlay).

**Vagues d'encodage mécanique (faible risque, plusieurs effets/vague)** :

- Variantes `damageTarget` (~160), `draw` (~86), destruction multi-type/conditionnel (~81), Force (~66), `tap/untapTarget` (~53), renvoi en main (~14), ciblage-joueur (~29), extensions `ValueExpr` (~100).

**Feature projects (un sous-système chacun, cf. Volet A)** : bus sujet≠soi (A8), Porteur dynamique (A13), pile de résolution (A11), continu-layers (A9), négociation/professions/RNG (formes bornées livrées → généralisation ouverte).

Principe non négociable : **« une approximation de gameplay est PIRE qu'un effet manuel »** — un effet n'est promu `auto` que si le moteur l'exécute fidèlement ; sinon rappel manuel non bloquant.

---

## 3. Ordre d'exécution recommandé

1. **A1** (choix de zone Allié) — complète le volet Alliés déjà commencé.
2. **A2/A3** (mal d'invocation sortie + 414.2 Héros) — cohérence mouvement, faible risque.
3. **A4** (ciblage-joueur) + vagues d'ops damageTarget/draw (Volet B) — beaucoup d'effets débloqués vite.
4. **A5/A6/A7** (choix combat + lot E) — profondeur du combat.
5. **A8** (bus sujet≠soi) — le grand déblocage transverse (~331 effets).
6. **A13/A14** (Porteur dynamique + ValueExpr).
7. **A11/A9** (pile de résolution + continu-layers).
8. Méta (A17-A19) selon la demande produit.

Chaque item = une PR test-first, suite verte + type-check, avant de passer au suivant.
