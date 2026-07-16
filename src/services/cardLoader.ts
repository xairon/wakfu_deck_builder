import type { Card } from "@/types/cards";

// Version du cache : à incrémenter quand la forme/normalisation des cartes
// change (sinon les anciens caches servent des données obsolètes — ex. mots-clés
// pollués, éléments en minuscules).
const CACHE_KEY = "wakfu-cards-cache-v111"; // v111 : sous-type « Potion » restauré sur les impressions Incarnam de Potion d'Oubli de Sort + Potion de Rappel (perdu au scrape). v97 : gate de CLASSE du Héros — préfixe « <Classe>. » sur pouvoir (Gzenah « Iop. [Incliner] : … ») → playCondition heroClass (allowlist des 12 Classes, heroClassOf exporté, lecteurs legality+engine, refus expliqué avant toute consommation). v96 : onceNamePerTurn — « Vous ne pouvez jouer qu'une seule <Nom> par tour » (Puissance d'Ogrest) : flag compilé + jeton oncePlayed_<slug> sur le Héros (préfixe TURN_TOKEN, purge au tour), gate whyCannotPlay par NOM (rééditions partagées), écrivains local+online. v95 : LÉOPARDO — coûts-icônes NUS « [Neutre][Neutre] : » (costTapResource générique ×N, sans tapsSource) + once-per-turn RÉEL (flag, jeton powerUses0) + prédicat de routage isIconCostText ; script leopardo-incarnam SUPPRIMÉ (infidèle depuis la récup : sous-facturait 2 Ressources, Géant absent, inclinaison supposée à tort) → compile auto fidèle. v94 : op de masse buffAllTurn — « Tous vos/les [autres] <X> gagnent +N en Force et <Mot-clé> jusqu'à la fin du tour » (jetons forceMod+<kw>TurnMod PAR INSTANCE à la résolution, sans choix ; others exclut la source ; « les » = deux camps). +3 auto : Rat Batteur, La Dernière Rasade, Apioucalypse. v93 : COMPOSÉS Force+Mot-clé — alsoKeyword sur buffForceTarget/buffForceSelf (jetons forceMod + <kw>TurnMod sur la MÊME cible/source) ; coûts-icônes DSL « [Incliner][, [Élément]+] : » sur pouvoirs requiresIncline (redondance strippée / costTapResource+tapsSource, généralise Yomtella) ; GARDE subjectIsSelf : sujet contenant [ ou : refusé (le self-buff avalait silencieusement un préfixe de coût — hazard latent fermé). +5 auto : Blops Royaux ×3, Kabrok, Yokaï Firefoux. v92 : RÉCUP <strong> perdus au scrape (34 textes réparés depuis raw-card-data/pages — « gagne +N en Force et [Mot-clé] », coûts [Incliner]/[Neutre] restaurés) + composé bearerBonus {force, keyword} (8 Dragodindes auto) + FIX préexistant : Agilité/Agressivité/Tacle conférés par le PORTEUR alimentent enfin effectiveKeywords (seul Géant l'était). v91 : static déclaratif craftingRule — « <self> ne peut (pas) être fabriqué(e/s) » (19 effets) : propriété de FABRICATION (A19, hors moteur de table), structurellement garantie (le moteur ne fabrique pas) → suppression de 19 rappels manuels inutiles, zéro incidence gameplay. v90 : récence kind « unique » (Sagesse de Silouate — « une carte Unique » = subType Unique, jeton recentPlayUnique) + effet RESTRICTION-ONLY {playCondition, ops:[]} pour les clauses de jeu en effet séparé (Démons et Merveilles — le gate compile, le corps reste manuel). +2 auto (432→434). v89 : RÉCENCE PAR CATÉGORIE — jetons recentPlay<Kind> (action/sort/parchemin/equipement/allie) posés sur le Héros du joueur à CHAQUE jeu (écrasés, purgés au tour — généralisation Fécaline), gate playCondition recentlyPlayedKind{kinds,who} (who:other lit le Héros ADVERSE — fenêtres de réaction 706.5). +3 auto : Bébé Crocodaille, Buveur, Tolot. v88 : TUTEURS vague 2 — searchDeck whatIn/subIn (« une carte Équipement ou Zone » / « Potion ou Parchemin », unions homogènes seulement), queue-mélange absorbée aussi en début-de-tour conditionnel (Uk'Not'Allag), « apparaît sous votre contrôle » → watch controller self (Caravane Marchande — sans quoi la veille serait sur-large). +3 auto (426→429). v87 : TUTEURS D'APPARITION — searchDeck gagne name (nom exact normalisé — « une Gelée Menthe » n'est PAS la famille Gelée), levelIn, what OPTIONNEL (catégories par subType seul : Quête/Parchemin/Potion/Arme/Monture/Donjon/Sort) ; corps infinitifs « chercher …, la révéler et la prendre en main » ; queue « Si vous le faites, mélangez [ensuite] vot(t)re Pioche » absorbée (shuffleDeck) UNIQUEMENT sur un corps de recherche (garde W47 intact). +8 auto : Gelées Royales ×4, Crail, Ganymède, Jékïde, Festino. v86 : A8.2 — grammaire onOtherAppears étendue (préfixe « Tant que <self> est dans le Monde » → watcherInMonde ; sujet possessif « un(e) [autre] de vos <Famille>s » → controller self). Gelée Royale Bleue + Grasmera promues auto. v85 : RÉCUP NIVEAU — 67 Équipements/Dofus avaient perdu leur Niveau au scrape (parser ratait « Niveau : N » hors <strong>) → jouables à coût 0 ; re-parsés depuis raw-card-data/pages (audit 2026-07-06). v84 : KANIGROU — CHI-FU-MI + PRÉVENTION PRÉ-DÉGÂTS (W75, deck-driven starter Incarnam Kanigrou « Quand sur le point de recevoir des Dommages, jouez à Chi-Fu-Mi ; gagné → réduits à 0, sinon détruisez-le »). DERNIER effet starter Incarnam — sous-système autorisé par l'utilisateur. Op MARQUEUR `chifumiPrevention` (trigger "static", jamais exécuté ; détecté par hasChifumiPower). Jeton `chifumiShield` lu par reduceDamage (damageMods.ts) → prévention TOTALE (0), one-shot. Store gameStore : mini-jeu Chi-Fu-Mi DÉTERMINISTE (2 choix, pas RNG) — `pendingChifumi{phase:offer|reveal,oppChoice}` + chifumiAccept/Decline/Choose ; intercepté dans doResolveCombat via `kanigrouUnderFire` (DRY-RUN pur de resolveCombat → repère les Kanigrous prenant des Dommages) → openChifumi ; le contrôleur joue/subit, puis pierre-feuille-ciseaux caché (adversaire engage d'abord, égalité→rejeu). GAGNÉ → chifumiShield (0 dmg). PERDU → chifumiShield (blocage RESTE valide, attaquant NON redirigé vers le Héros) + `chifumiDoomed` → détruit APRÈS le combat par son propre pouvoir (resolveDestroyTarget noXpFor=adversaire → aucun XP, ruling). Boucliers retirés + declined/doomed purgés en fin de résolution (one-shot). BORNÉ : sans Kanigrou sous le feu, doResolveCombat inchangé → 0 régression /1862 tests. LOCAL uniquement (assistEffects ; combat en ligne = resolveCombat serveur-atomique, comme les Réactions). Couverture combat (cas primaire d'une créature) ; les dégâts d'EFFET direct sur un Kanigrou (rare, hors starter) réutiliseraient le même bouclier (offre pré-dégât d'effet = extension). UI GameBoard : bandeau offre + ✊✋✌. 485/1794 (27,0 %), **starters Incarnam 1→0 : les 4 decks starter Incarnam sont ENTIÈREMENT couverts (chaque effet AUTO ou CARD_SCRIPTS)**. v83 : ÉCHEC CRITIQUE — PILE DE RÉSOLUTION / FENÊTRE D'ANNULATION (W74, deck-driven starter Incarnam Échec Critique « Annulez les effets de l'Action, du Sort ou du pouvoir qui vient d'être joué »). Sous-système autorisé par l'utilisateur. Op marqueur `cancelLastPlayed` + reactionOnly. Store (gameStore) ref `pendingResolution` : quand un joueur joue une Action/pouvoir À EFFETS et que l'adversaire tient Échec Critique (LOCAL uniquement), les effets sont mis EN ATTENTE (frames) au lieu d'être résolus, la perspective bascule vers l'adversaire (fenêtre), qui joue Échec Critique (resolveEchecCancel : paie le coût, carte→Défausse, frames ABANDONNÉES) OU passe (passPendingResolution : frames enfilées). Helper `enqueuePlayed` wrappe les 5 sites d'enfilage de cartes ACTIVEMENT jouées (actionAtoms playFromHand + 4 sites activateTapPower) ; les effets DÉCLENCHÉS (apparition/onArrive, début de tour ~943/974) N'appellent PAS ce chemin → non annulables (ruling « Quand … » non joués). BORNÉ : opponentCancelCardId ne s'ouvre QUE si l'adversaire tient réellement Échec Critique (+ garde online/assist/pas d'imbrication) → les ~1850 tests existants gardent la résolution IMMÉDIATE, 0 régression. Intercept isCancelCard dans playFromHand (avant whyCannotPlay) : Échec jouable UNIQUEMENT dans la fenêtre par le réacteur (sinon refus reactionOnly). ONLINE : Actions serveur-autoritatif atomiques → fenêtre jamais ouverte, cancelLastPlayed = no-op moteur. UI GameBoard : bandeau « Passer ». 483/1794 (26,9 %), starters Incarnam 2→1 (reste Kanigrou). v82 : DÉFI — DUEL AVEC CONSENTEMENT ADVERSE (W73, deck-driven starter Incarnam Défi « Inclinez l'un de vos Alliés ou Héros et proposez un défi à l'Allié ou Héros de votre choix : si l'adversaire accepte, les deux cartes s'infligent simultanément leur Force en Dommages ; s'il refuse, vous gagnez 1 XP »). Sous-système DÉCISION ADVERSE bâti (autorisé par l'utilisateur). 4 ops : duelTapDuelist (ciblage-COÛT : incline un de VOS Alliés/Héros dressés → lie duelistId ; aucun dressé = abandon), duelChooseChallenged (ciblage : lie le défié ADVERSE challengedId), duelOffer (propose le duel via effectChoices Accepter/Refuser — frame de décision seat=LANCEUR pour que « refuser → +1 XP » crédite le lanceur ; ids liés EMBARQUÉS dans l'op resolveDuel car le choix crée une frame neuve sans les champs liés), resolveDuel (dégâts mutuels de Force SIMULTANÉS : 2 paquets calculés depuis effectiveForce AVANT application — Force ≠ PV donc pur — dispatchés ENSEMBLE + checkVictory unique → double KO possible ; élément = liveSourceElement de chaque carte 410.1 ; XP de mort auto-crédité par contrôleur). Champs de frame duelistId/challengedId. Décision adverse = effectChoices seat=otherSeat (comme eachPlayerOptional) ; hot-seat écran partagé, cohérent avec l'existant. Défi CARD_SCRIPTS onPlay [duelTapDuelist, duelChooseChallenged, duelOffer]. 482/1794 (26,9 %), starters Incarnam 3→2. v81 : SYSTÈME DE MÉTIER / ARTISAN (W72, deck-driven starter Incarnam Amar Casto « gagne le Métier de votre choix jusqu'à la fin du tour »). USER a autorisé la construction de VRAIS sous-systèmes pour les 4 derniers effets starter (verdict manuel-légitime renversé par décision produit). Nouvel op `setMetierSelf{metier}` : pose un jeton TURN-scoped `metier_<métier>` sur la SOURCE (uniquement en jeu, purgé fin de tour via le préfixe metier_ déjà dans TURN_TOKEN_PREFIXES) → la source devient Artisan. Helper `metierOf(inst,card)` = source unique de possession (subTypes innés ∪ jetons metier_*) ; condSpec `selfIsArtisan` (lu par tout futur consommateur, ex. aura Artisan de l'Île d'Otomaï). Amar Casto (2 éditions incarnam+dofus-collection) : onPlay chooseOne à 4 branches (W56 N-aire, une par Métier), chaque branche → setMetierSelf. +2 (auto-résolus). 481/1794 (26,8 %), starters Incarnam 4→3. v80 : CIBLAGE « QUI VIENT DE S'INCLINER » (W71, deck-driven starter Incarnam Flèche d'Immolation « Réaction. … inflige 2 Dommages [Feu] à l'Allié ou Héros qui vient de s'incliner »). RE-CHALLENGE (6e verdict manuel-légitime renversé, après le Glyphe W70) : buildable via un marqueur borné. Jeton `justInclined` posé sur les attaquants qui s'inclinent RÉELLEMENT à la déclaration (set newlyInclined W70), RÉINITIALISÉ à chaque déclaration (efface les marques d'une déclaration antérieure) + purgé en fin de tour (TURN_TOKENS) — posé sur les DEUX chemins (gameStore.combatConfirmAttackers local + resolveIntent DECLARE_ATTACK online, leçon W68). Nouveau filtre `recentlyInclined` sur damageTarget (effectTargetIds : cible doit porter justInclined>0). Flèche CARD_SCRIPTS onPlay [damageTarget{2, Feu, explicitElement, recentlyInclined, heroes}] ; jouée en fenêtre de réaction locale (la Réaction ne se joue qu'après une déclaration → « vient de » borné à la déclaration courante). OMISSION CONSERVATRICE documentée : seules les inclinaisons de DÉCLARATION d'attaque sont marquées (pas les tap-powers ni les bloqueurs de fin de combat — rares, hors périmètre). +1 (manual, auto-résolu). 479/1794 (26,7 %), starters Incarnam 5→4. v79 : GLYPHE FLOTTANT SUR INCLINAISON D'ATTAQUANT (W70, deck-driven starter Incarnam Glyphe Incandescent « Jusqu'à la fin de la phase d'action, chaque fois qu'un attaquant/bloqueur s'incline dans ce combat, inflige 2 Dommages [Feu] »). RE-CHALLENGE (4e verdict manuel-légitime renversé cette session) : buildable via le bus `attackerDeclared` existant (les attaquants s'inclinent à la DÉCLARATION + émettent déjà ce RuleEvent) — le ruling EXCLUT les inclinaisons de FIN de combat (bloqueurs à la résolution) = exactement ce que le bus sépare. Nouvel op `incHeroTurnToken{token,n}` (marqueur sur le Héros de l'acteur, ≠ incTurnCounterSelf/source) → Glyphe onPlay pose `glypheDamage` (jeton turn-scoped = « fin de phase d'action », purgé début de tour). Nouveau `glypheFrames(ctx,evt)` (triggers.ts, branche attackerDeclared) : somme les glypheDamage des DEUX Héros (tout attaquant, y compris les vôtres), émet UN paquet de 2 Feu PAR Glyphe (Résistance par paquet) à l'attaquant via riposteTargetId + damageRiposteSource (réutilise W48, aucun picker). Piggyback sur le bus attackerDeclared existant = même couverture local/online qu'attackerFrames, AUCUNE nouvelle intégration online. OMISSION CONSERVATRICE documentée : inclinaison de bloqueur mid-combat via pouvoir (rare, hors périmètre) non couverte — under-fire jamais over-fire. +1 (manual, auto-résolu). 478/1794 (26,6 %), starters Incarnam 6→5. v78 : COMPTEUR DE DÉPENSE + AUTO-DESTRUCTION DE FIN DE TOUR (W69, deck-driven starter Incarnam Katsou Mee « [Terre] : +1 Force. Si vous dépensez plus de [Terre][Terre][Terre] … détruisez à la fin du tour »). RE-CHALLENGE : Katsou n'exigeait PAS la refonte modèle-données multi-trigger-per-effet (mon verdict W69 était faux) — évitée par un flag + balayage générique de fin de tour. Nouvel op `incTurnCounterSelf{counter}` (incrémente un jeton TURN-scoped sur la source, purgé début de tour). Nouveau condSpec `selfCounterAtLeast{counter,n}` (jeton source ≥ n). Pouvoir onTap RÉPÉTABLE : costTapResource{Terre} + buffForceSelf{1} + incTurnCounterSelf{katsouSpend} + conditional{selfCounterAtLeast{katsouSpend,4} → incTurnCounterSelf{destroyAtTurnEnd}} (seuil « plus de 3 » = 4e utilisation). Nouvelle fonction `turnEndDestroyEvents(ctx)` (turn.ts) : détruit FIDÈLEMENT (resolveDestroyTarget → Défausse + XP 415.1) les créatures du joueur sortant flaggées `destroyAtTurnEnd`, AVANT la transition ; câblée sur les DEUX chemins (gameStore.nextTurn local + resolveIntent END_TURN online — leçon W68). katsouSpend/destroyAtTurnEnd ∈ TURN_TOKENS. NB : le balayage ne fait pas tourner les déclenchés de mort (Katsou n'en a aucun). +1 (manual, auto-résolu). 477/1794 (26,6 %), starters Incarnam 7→6. v77 : RÉCENCE DE JEU (W68, deck-driven starter Incarnam Fécaline la Sage « Réaction. [Incliner] : Gagnez 1 XP. Ne jouez ce pouvoir que lorsque vous venez de jouer une carte Quête ou Parchemin »). Icônes « Réaction. [Incliner] : » récupérées du raw. Nouveau condSpec `recentlyPlayedQuestParch` — RESTRICTION DE POUVOIR (gate d'activation) sur une RÉCENCE de jeu : jeton TURN-scoped `recentQuestParch` posé sur le Héros à CHAQUE playFromHand (1 si la carte jouée est Quête/Parchemin, 0 sinon → stricte récence : rejouer autre chose annule), purgé en début de tour (ajouté à TURN_TOKENS). Évalué par `playConditionOk` (legality.ts, factorisé) : `powerConditionReason` gate activateTapPower (Fécaline, onTap) AVANT toute consommation ; `playConditionReason` (restrictions de PLAY, Repos) skippe désormais les effets onTap. evalCond (engine) gagne le cas symétrique. gainXp op pré-existant. Fécaline CARD_SCRIPTS onTap {playCondition:recentlyPlayedQuestParch, [gainXp{1}]}. +1 (manual, auto-résolu). 476/1794 (26,5 %), starters Incarnam 8→7. GOTCHA test : sandbox démarre tour 1 (« aucune carte dans le Monde au 1er tour ») → bump turn.number pour jouer. Réévaluation : Fécaline était mal classée manuel-légitime (récence = jeton borné + playCondition W61, PAS un système de tracking d'historique complet). v76 : DÉCLENCHÉ DEPUIS LA MAIN (W67, deck-driven starter Incarnam Tofu Céleste « Réaction. Quand un de vos Tofus est détruit, vous pouvez payer [Air][Air] pour mettre en jeu le Tofu Céleste de votre main. Il apparaît incliné »). Icônes [Air][Air] + « Réaction. » RÉCUPÉRÉES du raw (description corrigée). Nouveau trigger `onControlledDestroyedFromHand` + champ `watchSub` (Famille normalisée surveillée). handWatcherFrames (triggers.ts) scanne la MAIN du contrôleur sur le bus `destroyed` : quand une créature contrôlée de Famille watchSub est détruite, émet une frame OPTIONNELLE (« vous pouvez ») sourceId = la carte en main. RÉUTILISE costTapResource{Air}×2 (W64) + putSelfInPlay{tapped} (W66). DSL handWatcherEffects (compiled-only). GOTCHA : `ctx.state.seats?.[...]` (optional chaining — les ctx de test isolés n'ont pas seats). Tofu Céleste CARD_SCRIPTS effect[1] {onControlledDestroyedFromHand, watchSub:"tofu", optional, cost:paidOps, [costTapResource{Air}×2, putSelfInPlay{tapped}]} (effect[0]=Géant keyword). +1 (manual, auto-résolu). 475/1794 (26,5 %), starters Incarnam 9→8. Aucun nouvel op (trigger+champ). v75 : POUVOIR ACTIVÉ DEPUIS LA MAIN (W66, deck-driven starter Incarnam Polter Tofu « Détruisez un de vos Tofus : Mettez en jeu le Polter Tofu gratuitement de votre main. Il apparaît incliné »). NOUVELLE SURFACE D'ACTIVATION : un pouvoir dont la SOURCE est EN MAIN et qui se met elle-même en jeu. Nouveau trigger `onHandActivate` + op `putSelfInPlay{tapped}` (la source, en main, entre en Monde inclinée ; deps.moveTo pose le jeton d'arrivée = mal d'invocation ; queueArrivalEffects en cascade ; no-op si plus en main). DSL `handPowers(card)` (lit UNIQUEMENT la forme compilée CARD_SCRIPTS, trigger onHandActivate). activateTapPower route les cartes EN MAIN portant un onHandActivate AVANT le chemin en-jeu (garde tour/fenêtre de réaction comme playFromHand ; coût payé = 1re op, s'abandonne sans cible → carte reste en main, aucune pré-consommation). hasHandPower + canActivateSelected (GameBoard) proposent le bouton « activer » sur une carte en main. Polter Tofu CARD_SCRIPTS onHandActivate [costDestroyControlled{sub:"tofu",excludeSource}, putSelfInPlay{tapped}] (GOTCHA : op.sub doit être NORMALISÉ minuscule — la comparaison est `normWord(subType) === op.sub`). putSelfInPlay réutilise la mécanique put-in-play. +1 (manual, auto-résolu). 474/1794 (26,4 %), starters Incarnam 10→9. Tofu Céleste (même surface MAIS déclenché onOtherDestroyed depuis la main = watcher-en-main) reste à faire. v74 : BLOQUEUR BONUS (W65, deck-driven starter Incarnam Bond « Placez l'un de vos Alliés ou Héros en bloqueur devant l'attaquant de votre choix »). Nouvel op `grantBonusBlock{n}` — Action jouée par le DÉFENSEUR en fenêtre de réaction (combatOfferReaction 706.5 : perspective→défenseur) → relève de N la limite de bloqueurs du combat EN COURS (ruling : Bond peut dépasser les PM). combatToggleBlock lit désormais `pm + bonusBlocks` ; le joueur DÉCLARE ensuite le bloqueur bonus via l'UI de blocage habituelle (légalité Agilité 704 conservée par eligibleBlockers, gate défenseur conservé). Champ local `combat.bonusBlocks` (portée combat, recréé à chaque combat) ; deps.grantBonusBlock (mutation du ref local, no-op en ligne — combat serveur-autoritatif — sœur de deps.removeFromCombat W52). RÉUTILISE la machinerie de blocage à deux temps existante (pendingBlocker) → risque de régression minimal (additif). Bond CARD_SCRIPTS onPlay [grantBonusBlock{1}]. +1 (manual, auto-résolu). 473/1794 (26,4 %), starters Incarnam 11→10. Nouvelle mécanique grant-bonus-block (contrôle). v73 : SÉLECTION MULTI-POUVOIRS + coût multi-Ressource (W64, deck-driven starter Incarnam Guy Yomtella pwr1 « [Air][Air] : Redressez Guy Yomtella »). Une carte peut porter PLUSIEURS pouvoirs onTap (Guy : pwr0 tapsSource « [Incliner],[Air] : … » vs pwr1 « [Air][Air] : Redressez soi », 2 indices d'effets distincts → CARD_SCRIPTS {0,1}). activateTapPower ne prend plus atoms[0] en dur : il choisit le PREMIER pouvoir compatible avec l'ORIENTATION courante — un pouvoir qui INCLINE la source (incline par défaut cost==null, ou tapsSource W53) exige d'être dressé ; un pouvoir payé qui n'incline pas (untapSelf) reste activable une fois incliné (repli atoms[0] → zéro régression mono-pouvoir). Garde de payabilité GÉNÉRALISÉE : compte les costTapResource EN TÊTE de séquence par Élément (Guy pwr1 = 2 Air distincts requis) — refus AVANT toute consommation, plus de paiement partiel (message conserve le libellé d'Élément d'origine). pwr1 = CARD_SCRIPTS [costTapResource{Air}, costTapResource{Air}, untapSelf] (untapSelf pré-existant) sur les 2 éditions (incarnam + dofus-collection). +2 (manual, auto-résolus). 472/1794 (26,3 %), starters Incarnam 13→12. Aucun nouvel op/mécanique. v72 : RÉPARTITION LIBRE DE DÉGÂTS (W63, deck-driven starter Incarnam Colère de Iop). Nouvel op `distributeDamage{element, combatRole, heroes, zones, fromCount}` — « inflige X Dommages répartis librement entre les Alliés ou Héros attaquants ou bloqueurs de votre choix ». X = montant payé (costPayX → boundCount). Ciblage RÉPÉTÉ : chaque clic ACCUMULE +1 point sur la cible de combat choisie (répétable, ≥1 chacune) SANS rien infliger ; à `remaining` 0 (ou effectTargetSkip = arrêt anticipé), application EN BLOC (applyDistributedDamage : chaque cible reçoit la somme en UN paquet resolveDamageTarget → Résistance/destruction/XP ; déclenchés de mort collectés sur tous les paquets et enfilés APRÈS — fidèle au ruling « répartition effectuée au moment où l'on joue le Sort », aucune cascade ne change la répartition décidée). Élément = imprimé (Terre — Action sans source vivante). X=0 → no-op (jouable hors combat, ruling). multi gagne un accumulateur `assign` (cible→points). Éligibilité = participants du combat (combatRole:inCombat, projection combat local W52). Colère scriptée CARD_SCRIPTS : onPlay [costPayX, distributeDamage{Terre, inCombat, fromCount}]. Label UI GameBoard (points restants). +1. 470/1794 (26,2 %), starters Incarnam 14→13. Nouvelle mécanique distribute-damage (dégâts). v71 : FORCE DOUBLÉE (W62, deck-driven starter Incarnam Coup Critique, 2 éditions). Flag `buffForceTarget.doubleForce` : magnitude = Force EFFECTIVE de la cible AU MOMENT de la résolution (calculée après le choix de la cible via effectiveForce → le buff ajoute +Force → total ×2, fidèle même avec d'autres buffs de tour ; ≠ n/fromCount pré-figés). Flag `buffForceTarget.markTurnToken` (« Vous ne pouvez jouer qu'un seul Coup critique sur le même Allié/Héros par tour ») : jeton turn-scoped `coupCritique` (déjà dans TURN_TOKENS) posé sur la cible à la résolution ; l'éligibilité (effectTargetIds) exclut les cibles déjà marquées ce tour. Coup Critique scriptée CARD_SCRIPTS (2 éditions) : onPlay buffForceTarget{doubleForce, markTurnToken:"coupCritique", heroes, zones:[monde,havreSac]}. +2 (les 2 éditions, auto-résolues). 469/1794 (26,1 %), starters Incarnam 15→14. v70 : RESTRICTION DE JEU + X-HEAL (W61, deck-driven starter Incarnam Repos). NOUVELLE condSpec `heroInZone{zone}` (le Héros de l'acteur est-il dans le Monde / son Havre-Sac ? — lu sur seats[seat].heroInstanceId, distinct de selfInZone qui vise la SOURCE) + NOUVEAU champ `compiledEffect.playCondition` (condSpec) = RESTRICTION DE JEU « Ne jouez cette carte que si <cond> », évaluée au PLAY-TIME par whyCannotPlay (legality.ts, helper playConditionReason → raison FR ; ≠ résolution des ops). Repos scriptée CARD_SCRIPTS : onPlay, playCondition heroInZone:havreSac, ops [costPayX (le X de « Niveau : X » — RÉUTILISE le coût variable W60), heroGainPv{n:0,fromCount:true} (soigne X = boundCount au Héros)]. +1 (Repos, auto-résolu). 467/1794 (26,0 %), starters Incarnam 16→15. Le DSL ne gère ni le X payé à la mise en jeu ni la restriction → script direct. v69 : COÛT VARIABLE X (W60, deck-driven starter Incarnam Merelyne Manro, les 2 éditions). Nouvel op de COÛT `costPayX` — coût variable « X : … » (X-cost, 4262) : modèle SANS POOL, le joueur INCLINE X producteurs (0..disponibles, au choix ; réutilise resourceProducers comme costTapResource mais générique et RÉPÉTÉ « jusqu'à »), X = nombre incliné → posé sur la frame (boundCount), lu par le corps. Op de ciblage multi (isTargetingOp, PAS isCostTargetingOp → X=0 légal = paiement nul, corps résolu avec magnitude 0). Résolution : effectTargetChoose incline chaque producteur choisi, ré-ouvre tant qu'il en reste ; effectTargetSkip clôt et LIE boundCount = nombre incliné (bindCountToHeldFrame). NOUVEAU flag `destroyTarget.exactLevelFromCount` — Niveau EXACT DYNAMIQUE = X (boundCount), FIGÉ à l'ouverture du ciblage (op.exactLevel = frame.boundCount) → seuls les Équipements de Niveau X éligibles. Merelyne scriptée via CARD_SCRIPTS (les 2 éditions) : coût COMPOSÉ « [Incliner], X[Neutre] : » = tapsSource (inclinaison de soi, Merelyne exclue de resourceProducers) + costPayX (X Neutre générique) + destroyTarget{Équipement, exactLevelFromCount}. Descriptions RÉCUPÉRÉES verbatim du raw (« [Incliner], X[Neutre] : Détruisez l'Équipement de Niveau X de votre choix » — l'incarnam ne gardait que « X : … », dofus-collection rien du coût). +2 manual (les 2 éditions, auto-résolues — pas de rappel). 466/1794 (26,0 %), starters Incarnam 17→16. Nouvelle mécanique cost-pay-x. NB : le DSL « X : » nu a été volontairement ÉCARTÉ (aurait sous-facturé — manque l'inclinaison [Incliner] ; les 2 éditions passent par CARD_SCRIPTS, précédent Yomtella W53). v68 : RÉCUP D'ICÔNES DROPPÉES (W59, deck-driven starters Incarnam, données seulement). Deux descriptions corrigées VERBATIM du raw (icônes perdues au scrape) : Katsou Mee « [Terre] : … gagne +1 en Force … Si vous dépensez plus de [Terre][Terre][Terre] … détruisez … » (préfixe de coût [Terre] + seuil [Terre]×3 récupérés) ; Flèche d'Immolation « Réaction. … inflige 2 Dommages [Feu] à … qui vient de s'incliner » ([Feu] + apostrophe + timing Réaction récupérés). Restent MANUELS (uncovered) — sous-systèmes non bâtis : Katsou Mee = coût-Ressource répétable + seuil cumulatif → auto-destruction ; Flèche d'Immolation = fenêtre de RÉACTION + récence « qui vient de s'incliner » (marqueur combat-scoped, counters.damage est turn-scoped). Convention d'icône = crochets littéraux, comme la récup W52 (Guy Yomtella). v67 : COÛT DE MILL (W58, deck-driven starter Incarnam Crapaud Mufle). Nouvel op de COÛT `costMillTop{n}` — « Défaussez la/les N première(s) carte(s) de votre Pioche : CORPS » = mill DÉTERMINISTE du sommet (pioche[0..n-1] → Défausse, AUCUN choix, ≠ costDiscard qui pioche dans la MAIN au choix) ; impayable si Pioche < n → frame abandonnée (corps non exécuté), résolu direct dans runFrame (aucun picker). DSL compileMillTopCost « Défaussez la première carte de votre Pioche : CORPS » (STRICT n=1 ; multi-cartes/« jusqu'à » restent manuels) → cost:paidOps [costMillTop{1}, ...body] + flag oncePerTurn (verrou : la source n'incline pas — même traitement que le coût de défausse W40) ; câblé dans compileTapNormalized (après discardCount) ET dans la routing tapPowers (isMillTopCostText). Garde activateTapPower : coût de mill impayable (Pioche < n) refusé AVANT de consommer le verrou once-per-turn (sœur de la garde costDiscard). +1 auto (Crapaud Mufle : costMillTop{1} + buffForceSelf{2} + oncePerTurn). 464/1794 (25,9 %), starters Incarnam 18→17. Nouvelle mécanique cost-mill-top (OP_TO_MECHANIC+mechanicTagSchema+MECHANICS, category autre). v66 : ACTOR-BIND CONDITIONNEL PAR FAMILLE + RÉCUP D'ICÔNES (W57, deck-driven starter Incarnam Charge & Amar Casto). Deux icônes DROPPÉES récupérées du raw : Charge « … gagne +2 en Force. S'il s'agit d'un Iop, il gagne Géant en plus. » et Amar Casto « … gagne le Métier de votre choix … » (descriptions corrigées verbatim). NOUVEAU condSpec `selfIsFamily{sub}` — la SOURCE de la frame (ici la créature LIÉE par l'actor-binding) a-t-elle la Famille `sub` (subTypes) ? Évaluée EXACTEMENT (evalCond). NOUVELLE forme DSL compileActionEffectText « <tête de ciblage>. S'il s'agit d'un [Famille], il <corps> » (jumeau conditionnel de l'actor-binding « … Il … » W49) → actor:"target", ops=[tête, conditional{selfIsFamily, corps lié}] ; tête = op de ciblage whitelisté (buffForceTarget), corps via compileActorBoundBody. compileActorBoundBody gagne « gagne <Mot-clé> [en plus] » → grantKeywordSelf (mots-clés câblés : Géant/Agilité/Agressivité/Tacle). Charge devient AUTO (buff +2 puis Géant CONDITIONNEL à la Famille Iop de la cible liée) ; Amar Casto reste MANUEL (« gagne le Métier de votre choix » — octroi de profession non modélisé, approximation interdite). +1 auto (Charge). 463/1794 (25,8 %), starters Incarnam 19→18. v65 : CHOIX D'ÉLÉMENT (W56, deck-driven starters Incarnam — Tirlangue Portey verso + Temple Féca). chooseOne devient N-AIRE : au-delà de 2 options, effectChoices porte `options[{label,ops}]` (reste de frame aplati dans chaque branche) et l'UI rend UN bouton par branche (nouvelle méthode effectChoiceSelect(i) — choix obligatoire) ; le chemin historique à 2 branches (optionLabels/resolve) est INCHANGÉ. DSL : (a) « <self> inflige N Dommages Air, Terre, Feu, Eau ou Neutre à l'Allié ou Héros de votre choix » → chooseOne à une branche damageTarget PAR Élément listé ; (b) « L'Allié ou Héros de votre choix gagne Résistance N dans l'élément de votre choix » (Temple Féca — icône « Résistance 1 » RÉCUPÉRÉE du raw, description corrigée) → chooseOne à 5 branches grantResistanceTarget. NOUVEAU flag `explicitElement` sur damageTarget/damageAll : un Élément EXPLICITE du texte (choisi ou imprimé — Flèche Blizzard) n'est PLUS écrasé par l'Élément de la source vivante à la résolution — le LATENT W50 devenait un bug réel (Tirlangue est une source vivante Air : choisir Feu aurait résolu en Air), il est FERMÉ. tapPowers devient FACE-AWARE (param side) : le pouvoir du VERSO d'un Héros n'est activable que face verso (activateTapPower/hasTapPower/tapPowerNeedsCombat passent inst.face) — les effets top-level d'un Héros ne couvrent que le recto. La note verso de Tirlangue (« un seul type à la fois ») reste un rappel manuel (texte utile, non présent dans notes[]). +2 auto → 462/1794 (25,8 %), starters 21→19. v64 : LOOK-N (W55, deck-driven starter Incarnam Bonne Affaire !). Op `lookTopPick{n:2, dest:main, rest:recycle}` (« Regardez les deux premières cartes de votre Pioche. Prenez l'une de ces cartes en main, puis recyclez l'autre. ») : la machinerie effectPicking gagne `candidates` (liste EXPLICITE = les N du DESSUS, index 0 ; effectPickIds les restreint aux cartes encore dans la zone) et `restAction:"recycle"` (à la clôture du pick, le reste des candidats part SOUS la Pioche — glossaire « Recycler »). Choix IMPOSÉ (mandatory) ; Pioche vide → effet passé ; 1 carte → vue et prise (rien à recycler). DSL : combo DEUX phrases dans compileBody (STRICT : n=2 + reste singulier « l'autre » — les variantes anneau-fioutioure/faille-temporelle/jock-et-lack restent manuelles). +1 auto (Bonne Affaire). 460/1794 (25,6 %), starters 22→21. v63 : BONUS DE POUVOIR D'ALLIÉ (W54, deck-driven starter Incarnam Guma Bobeule — le design du workflow W52). « Les Dommages infligés par les POUVOIRS de vos Alliés sont augmentés de N jusqu'à la fin du tour » : op `buffTeamPowerDamageTurn{n}` → jeton de tour `teamPowerDmgMod` sur le Héros (cumulatif, TURN_TOKENS), lu par `allyPowerDamageBonus` (damageMods) au point de résolution — bonus PAR PAQUET, AVANT Résistance/préventions, seulement si paquet de base > 0 et provenance = un ALLIÉ. NOUVEAU champ `EffectFrame.powerSourceId` (provenance de POUVOIR — la carte dont le pouvoir imprimé se résout, posée à l'ENFILAGE sur TOUS les chemins de pouvoir : tap-power ×3, apparition, veilleurs [= le VEILLEUR, pas l'apparu actor-bindé], déclenchés de bus, début de tour ×3, propagée par effectChoices/effectTargeting/holdRest — JAMAIS réécrite, ≠ sourceId corrompu par l'actor-binding ; ABSENTE sur le chemin Action = pas un pouvoir, glossaire). DISCRIMINANTS Dommages vs perte de PV (410.3, prérequis fidélité) : flag `isDamage` sur damageOppHero (« inflige N Dommages au Héros adverse » — la forme « perd N PV » compile le même op SANS flag, jamais augmentée) et `pvLoss` sur damageTarget (« le Héros de votre choix perd N PV » — exclu du bonus). +1 auto (Guma). 459/1794 (25,6 %), starters 23→22. v62 : GUY YOMTELLA RE-COUVERT (W53, CARD_SCRIPTS — ferme le dossier ouvert en W52). Le pouvoir [0] est scripté FIDÈLEMENT : coût composé « [Incliner], [Air] » = tapsSource (inclinaison de soi, chemin paidOps d'Amulette Akwadala) + costTapResource{element:"Air"} (1ʳᵉ utilisation du filtre d'Élément W45 ; payeur naturel = producteur coloré W46, ex. Piou Jaune — Guy inclinée par l'activation est exclue de resourceProducers). NOUVELLE GARDE activateTapPower : coût de RESSOURCE impayable refusé AVANT de consommer l'inclinaison (resourceProducers filtrés par Élément, source exclue si tapsSource) — sœur de la garde costDiscard W40. Décliner APRÈS activation = inclinaison consommée, pouvoir annulé (même comportement qu'Akwadala). L'effet [1] (« [Air][Air] : Redressez » — activation payée SANS incliner) reste manuel (pas de voie pipeline). +2 manual (2 éditions) → 458/1794 (25,5 %), starters 24→23. v61 : COMBAT LOCAL PROJETÉ + EXCLUSION + DORA + YOMTELLA VERBATIM (W52, designs parallélisés par workflow). (1) FIX PRÉEXISTANT : rulesCtx PROJETTE le combat LOCAL (ref combat.value, jamais journalisé — SET_COMBAT n'est émis que par le serveur en ligne) dans ctx.state.combat quand il est DÉCLARÉ (step ≠ "attackers", cible posée) → les filtres combatRole (W11/W29) et la fenêtre Défense/Renfort (legality) prennent vie en partie locale (avant : state.combat toujours null → aucune cible). (2) EXCLUSION : op de ciblage `removeFromCombatTarget` (« retourne incliné dans le Monde » = CESSE d'être attaquant/bloqueur, ruling in-data ; aucun déplacement de zone) — éligibilité combatRole:inCombat, résolution = deps.removeFromCombat (mutation du ref local : attackers/blocks/strikes/ripostes/curseurs purgés ; no-op en ligne) PUIS SET_ORIENTATION tapped journalisé. Mécanique remove-from-combat. (3) DORA : flag compilé `requiresBearerInCombat` (« N'utilisez ce pouvoir que si le Porteur de <self> est attaquant ou bloqueur », strip gated requiresIncline + subjectIsSelf, TAP_BEARER_IN_COMBAT) ; garde activateTapPower AVANT toute consommation (Porteur = instance dont attachments contient la source ; combat DÉCLARÉ exigé) ; exception FENÊTRE DE RÉACTION 706.5 sur les checks de tour (combat.reactingSeat === seat, idiome playFromHand) → le bloqueur peut activer hors de son tour ; 2 retouches GameBoard (canActivateSelected autorise en combat si tapPowerNeedsCombat ; clic pendant blockers sélectionne l'Équipement gated au lieu de router vers le blocage). compileTapEffectText refactoré en wrapper + compileTapNormalized. (4) GUY YOMTELLA (2 éditions) : descriptions RÉCUPÉRÉES VERBATIM du raw (« [Incliner], [Air] : … inflige 1 Dommage [Air] … » / « [Air][Air] : Redressez … ») — l'effet [0] SOUS-FACTURAIT (compilé auto sans le coût 1 Ressource Air) → DÉMOUVU en manuel avec le texte vrai (fidélité > métrique) ; [1] est un 2ᵉ pouvoir distinct (2 Air, sans incliner), pas une suite. Net : +2 auto (Exclusion, Dora), −2 faux-auto (Yomtella ×2) → 456/1794 (25,4 %), starters 25→24. v60 : DÉCLENCHÉ DE DOMMAGES SUBIS PAR SOI (W51, deck-driven starter Incarnam Wa Wabbit). Nouveau trigger `onDamageToSelf` : « Chaque fois que <self> subit des Dommages, [vous pouvez] <corps> » — émis par le bus damageDealt (804.7) via selfDamagedFrames (triggers.ts), TOUTE provenance (combat, pouvoir, riposte : le texte ne restreint pas la source, contrairement à la riposte de Porteur qui exige un damager Allié/Héros). « vous pouvez » → frame optionnelle (effectChoices, déjà câblé par enqueueTriggered). Cible détruite par ces mêmes Dommages (en Défausse à la collecte) → pas de déclenché (omission conservatrice, cohérente avec bearerFrames). STRICT : sujet self exigé (Porteur → riposte, autre voie ; veille d'autrui → manuel), corps compilable — Kimbo (toggle incliner/redresser) et Prespic Royal (magnitude miroir) restent correctement manuels. +1 auto (Wa Wabbit : optional draw). 456/1794 (25,4 %), starters Incarnam 26→25. v59 : DOMMAGES DE MASSE SANS XP (W50, deck-driven starter Incarnam Flèche Blizzard). (1) Parse damageAll étendu : forme SUJET-EN-TÊTE (« <self> inflige … », subjectIsSelf requis — sujet ≠ soi reste manuel) + MOT D'ÉLÉMENT explicite (« 2 Dommages Air » → element:"Air", prioritaire sur l'Élément de la carte : Flèche Blizzard est Neutre aux Dommages Air). (2) Clause résiduelle « Vous ne gagnez pas d'XP » → flag noXp sur le damageAll précédent (STRICT : sans damageAll précédent → manuel). (3) Moteur : DamageOpts.noXpFor — les destructions en CASCADE des Dommages ne créditent pas d'XP au LANCEUR (415.1 l'aurait crédité pour un Allié adverse tué) ; resolveDestroyTarget(…, noXpFor) supprime le grant si le bénéficiaire = noXpFor ; les grants à l'ADVERSAIRE (propres Alliés tués) restent accordés (la clause ne parle que de « vous »). +1 auto (Flèche Blizzard : damageAll{n:2, Air, heroes, monde, noXp}). 455/1794 (25,4 %), starters Incarnam 27→26. v58 : ACTOR-BIND MÊME-CIBLE + FIX ZONES HÉROS (W49, deck-driven starter Incarnam Jeunesse d'Ogrest). (1) actor:"target" — « <op de ciblage de créature>. Il/Elle <corps lié> » : la créature CHOISIE par l'op de ciblage devient le sujet du corps « Il/Elle … » (le moteur réécrit sourceId à la résolution du ciblage, effectTargetChoose, puis lie UNE fois). Jumeau de actor:"costTarget" mais sur un op de ciblage NON payé. DSL compileActionEffectText détecte « <tête>. Il/Elle <corps> » (tête = UN op de ciblage mono-cible ∈ ACTOR_BIND_HEAD_OPS, corps via compileActorBoundBody) ; propagé au chemin Action (gameStore actionAtoms → actorBind). +2 auto (Jeunesse d'Ogrest : untapTarget+buffForceSelf ; Furie : damageTarget+buffForceSelf). (2) FIX FIDÉLITÉ ZONES : les cibles « … ou Héros de votre choix » (tapTarget/untapTarget, 5 formes : générique/adverse, combatRole, orientation, noEquipment, un-de-vos) incluent désormais le Havre-Sac quand heroes:true — le Héros y RÉSIDE (setup.ts zone:"havreSac"), sinon « ou Héros » était inciblable (bug pré-existant sur 10 cartes). Cas Allié-seul inchangé (Monde). 454/1794 (25,3 %), starters Incarnam 28→27. v57 : RIPOSTE DE PORTEUR (W48, deck-driven starters Incarnam — Cape + Anneau du Prespic). Bus `onDamageToBearer` (dormant) ACTIVÉ : quand un Allié/Héros inflige des Dommages au Porteur d'un Équipement portant une riposte, l'Équipement riposte N Dommages À LA CRÉATURE QUI A FRAPPÉ. Nouvel op `damageRiposteSource{n,element}` (cible PRÉ-LIÉE via frame.riposteTargetId = source de l'événement damageDealt, posée par bearerFrames ; résolu direct dans runFrame, aucun picker). Élément de riposte = icône RÉCUPÉRÉE de effect.elements (Feu), PAS l'Élément imprimé (Neutre) ; compileBearerRiposteText reçoit e.elements[0] via la chaîne de dispatch. GARDE ANTI-BOUCLE intrinsèque : bearerFrames n'émet que si le damager est Allié/Héros (une riposte est infligée par l'Équipement → ne re-déclenche jamais). Porteur détruit (hors jeu) → pas de riposte (omission conservatrice). Combat ET pouvoir passent par le bus (damageDealt émis des deux). +2 auto (Cape/Anneau du Prespic). Nouvelle mécanique riposte-bearer. Starters Incarnam 30→28. v56 : CONDITIONNEL OPTIONNEL (W47, deck-driven starter Incarnam Dollarawan) — l'op `conditional` gagne un flag `optional` : « Au début de votre tour, si <cond>, vous POUVEZ <corps> » → la condition GARDE l'offre (quand vraie, le corps est PROPOSÉ via effectChoices Oui/Non ; quand fausse, aucune proposition — pas de prompt inutile). Engine : cond vraie + optional → effectChoices {ops:[...corps,...reste], declineOps:[...reste]} return false ; sinon inline (inchangé). DSL compileTurnStartEffectText : « si <cond>, vous pouvez <corps> » n'est plus rejeté (strip « vous pouvez » → optional:true) ; STRICT : optionnel multi-phrases (« … Si vous le faites, … ») et condition « dans votre Défausse » restent manuels. +1 auto (Dollarawan : selfInZone havreSac + draw). 448/1794 (25,0 %), starters Incarnam 31→30. v55 : PRODUCTION DE RESSOURCE COLORÉE (W46, deck-driven starters Incarnam — les 4 Pious). Les Pious sont Neutre en Niveau/Force mais produisent une Ressource COLORÉE (Eau/Air/Feu/Terre — color-fixing). Champ dérivé `card.producesElement` (compileEffects.promoteResourceProducerTrait : mainType Allié + « Produisez une Ressource » mono-Élément → producesElement + coverage:"trait"), lu par la NOUVELLE fonction `resourceElement` (cardAttrs) utilisée par `resourceProducers`/`planCost` — le Piou Bleu satisfait désormais une exigence Eau. DISTINCT de `producedElement` (INCHANGÉ : Élément de Dommages de combat 410.1 + filtres de pile = Élément IMPRIMÉ, Neutre). Les producteurs BI-Élément (Otomaï = choix) et Zone/Équipement restent manuels (pas d'approximation). AUSSI : `manualEffects` exclut désormais `coverage:"trait"` (métier/classe/producteur = déjà modélisé → plus de rappel manuel). +8 Pious passent uncovered→trait (dont 4 starters Incarnam) : starters 35→31. v54 : SOUS-SYSTÈME RESSOURCES incrément 1 (W45, deck-driven starter Incarnam Smare) — op de COÛT `costTapResource` (« payer une Ressource »). Modèle SANS POOL, fidèle au rulebook 4261 : « produire une Ressource » = avoir une carte contrôlée DRESSÉE (Monde/Havre-Sac, sauf Protecteur) ; « payer » = l'INCLINER. L'op réutilise `resourceProducers` verbatim (même éligibilité que le coût de lancement planCost — aucune seconde source de vérité), dédupliquée par instanceId (le bonus Havre-Sac 2342 émet un doublon d'id, mais on n'incline qu'une carte réelle une fois), filtre d'Élément latent. Op de ciblage/coût (isCostTargetingOp) résolue par resolveTapTarget (SET_ORIENTATION tapped) ; skippable (« vous pouvez payer » → décliner = corps sauté). DSL : « payer pour <corps> » dans compileBody préfixe costTapResource puis compile <corps> (STRICT : corps non mappé → tout l'effet reste manuel). +4 auto (même construct « vous pouvez payer pour piocher une carte » : Smare onArrive, Le Kikoolarc onArrive, Champ Champ + Marlène Frimeur onSelfDestroyed) → 447/1802 (24,8 %), starters Incarnam 36→35. Le SELF-PAY du Smare tombe gratuitement (déjà en jeu et dressé à son apparition, il figure parmi ses propres producteurs). v53 : (W43) RÉDUCTION DE COMBAT DÉQUIPE — op teamCombatDmgReduction (« Jusquà la fin du combat, vos attaquants/bloqueurs subissent -N » → jeton teamDmgRedCombatMod sur le Héros, lu par reduceDamage pour les cibles en rôle de combat du siège). (W44) EACH-PLAYER OPTIONNEL — op eachPlayerOptional{ops} (« chaque joueur peut <corps> » → une confirmation effectChoices par siège, corps résolu du point de vue du joueur ; le « peut » est réel, pas mandatory) : Coffre Malveillant (onSelfDestroyed+draw), Djakky Chwan (onArrive+untapTarget controller:self). +6 auto → 443/1802 (24,6 %), starters Incarnam 39→36. v52 : MAGNITUDE DYNAMIQUE À CIBLE (W42, starter Incarnam Prospection) — op de ciblage drawTargetXp : « Piochez un nombre de cartes égal à la valeur d'XP de l'Allié [dans le Monde] de votre choix » → choisir un Allié en jeu, piocher xpValue(card)=card.experience. Éligibilité Allié seul. +1 auto → 437/1802 (24,3 %), starters 40→39. v51 : INCLINAISON/REDRESSEMENT MULTI-CIBLES À COMPTE LIÉ (W41, deck-driven starters Incarnam) — ops tapMultiTarget/untapMultiTarget (ciblage répété borné, nombre = boundCount via fromCount ; cibles distinctes ; jumeaux de damageMultiTarget mais action SET_ORIENTATION via resolveTapTarget/resolveUntapTarget). Mécaniques mappées sur tap-target/untap-target (pas de nouveau tag). DSL : corps « Inclinez/Redressez le même nombre d'Alliés ou Héros de votre choix [, dans l'ordre de votre choix] » dans compileRecycleCountBody → sert coût de défausse (Choc Temporel) ET de recyclage (Parchemin d'Agilité). Garde : compte 0 → no-op (pas de picker vide). +2 auto → 436/1802 (24,2 %), starters Incarnam 42→40. v50 : VERROU ONCE-PER-TURN + COÛT COMPOSÉ (W40, deck-driven starters Incarnam) — flags `oncePerTurn` (« N'utilisez ce pouvoir qu'une seule fois par tour » sur pouvoir NON-tap : la clause EST le verrou → jeton powerUses0 posé à l'activation, purgé fin de tour, gate dans activateTapPower) et `tapsSource` (requiresIncline + coût payé : l'activation incline AUSSI la source — Amulette Akwadala) sur compiledEffectSchema. compileDiscardCountCost : strip once-clause → flag + repli compileBody pour corps FIXE (« Piochez une carte », « <self> inflige N ») ; isDiscardCostText ajouté au repli tapPowers (parité compileEffects). Garde de fidélité : coût de défausse IMPOSÉ impayable (main < n) refusé AVANT de consommer inclinaison/verrou. +5 auto (Bwork Mage ×2, Abrakleur Clair, Chouquette, Amulette Akwadala) → 434/1802 (24,1 %), starters Incarnam 44→42. v49 : VALEUR DYNAMIQUE CANONIQUE (ValueExpr, modèle Forge « Count$ » / MTG) — toute magnitude d'op est un littéral `n` OU une `value: ValueExpr` (AST évalué à la résolution par UN évaluateur moteur `evalValue`). Variantes câblées : `fixed` (littéral) + `count` (« … égal au nombre de <X> que vous contrôlez » ; Équipement attaché co-localisé avec son Porteur → compté). DSL : « Piochez un nombre de cartes égal au nombre de <X> que vous contrôlez » → draw{value:{kind:"count",of:{source:"controlled",what,sub?}}}. +1 auto (Enutrof Incarnam) → 414/1802 (23,0 %). Fondation SOTA : les futurs nœuds (boundCount/statOf/mirror/plus) s'ajoutent AVEC leur effet consommateur. `fromCount`/`perCount` restent legacy reconnus (repli non migré). PUIS primitive #3 EFFETS DE REMPLACEMENT (W35) : StaticAbility `damagePreventionAura` (prévention de Dommages continue) lue au choke point `reduceDamage` (hors combat aussi) — `all`(« réduits à 0 ») / `n`(« de N »), bénéficiaire `controllerHero`(« à votre Héros ») / `controlledAllies{sub?}`(« à vos <Famille> »). DSL : « [Tant que <self> dans le Monde,] tous les Dommages sur le point d'être infligés à <bénéf> sont réduits <montant> ». +2 auto (Allister bouclier Héros total, Donjon des Craqueleurs −1) → 416/1802 (23,1 %). Incrément 2 : StaticAbility `damageUnpreventable` (self, sens dealer) — « Les Dommages infligés par <self> ne peuvent pas être réduits » → reduceDamage renvoie le montant BRUT (bypass Résistance/prévention/Trêve), lu sur hit.sourceId. +2 auto (Chevalier Ténèbres ×2 éditions) → 418/1802 (23,2 %). Reste manuel : sens sortant self/jeton (Actions, non modélisable), durée tour, cible choisie, forme Porteur, par-instance « Ces Dommages », redirection « à la place ». v48 : octroi de mot-clé au Porteur de SOI (op grantKeywordBearerSelf) — « Jusqu'à la fin du tour, le Porteur de <self> gagne A ou B » → chooseOne de deux grantKeywordBearerSelf (la source-équipement confère le mot-clé à SON Porteur, reverse-lookup via attachments ; no-op si non portée). +1 auto (Scarature Blanche : Agilité ou Tacle) → 413/1802 (22,9 %). Nouvelle mécanique « grant-keyword-bearer-self ». v47 : octroi de mot-clé au PORTEUR d'un Équipement choisi — « Jusqu'à la fin du tour, l'Équipement de votre choix fait gagner <Kw> à son Porteur » → grantKeywordTarget{requiresAttachment:true,heroes:true} : on cible directement la créature ayant ≥1 attachement (choisir l'équipement ne sert qu'à désigner son Porteur ; équivalent fidèle). +4 auto (Emma Tenl/Tacle, Fauvéa/Agressivité, Klozette Wateur/Agilité, Terril Hachterr/Géant) → 412/1802 (22,9 %). v46 : sous-système CHOIX EXCLUSIF « A ou B » — op chooseOne (deux branches étiquetées, présentées via effectChoices/deux boutons ; la branche choisie s'exécute, le RESTE de la frame reprend après — « … ou … Piochez une carte »). DSL : « <Cible> de votre choix gagne <A> ou <B> jusqu'à la fin du tour » → chooseOne, chaque branche = grantKeywordTarget (Géant/Agilité/Agressivité/Tacle) ou buffForceTarget (« +N en Force ») sur la MÊME cible (heroes / sub:Famille ALLIED_FAMILIES). STRICT : compilé seulement si les DEUX tokens sont des octrois câblés (sinon manuel). +4 auto débloqués par batch4 (Baguette du Bandit Ensorceleur, Dofus-Arena Max, La-Haine, Temple Osamodas) → 408/1802 (22,6 %). Nouvelle mécanique « choose-one ». v45 : re-scrape batch4 — récupération verbatim de 14 descriptions à icônes droppées (mots-clés/Résistance perdus au scrape) via shortUrl wtcg-return.fr : Emma Tenl/Tacle, Fauvéa/Agressivité, Klozette Wateur/Agilité, Terril Hachterr/Géant, Scarature Blanche/Agilité-ou-Tacle (octroi au Porteur jusqu'à fin du tour) ; Baguette du Bandit Ensorceleur, Dofus-Arena Max, La-Haine, Temple Osamodas, Koalak Farouche (« X gagne <Kw> ou <Kw/+Force> jusqu'à la fin du tour ») ; Tynril (ruling Résistance 2 (air)/(feu)) ; Hache de Feuhekel/Géant+Résistance, Épée du Khebab/Tacle+Résistance, Marteau de Cokelocu/Agressivité+Résistance (consommateurs Ether). Données SEULEMENT (modèle béton) : restent uncovered (octroi de mot-clé turn-scoped à un Porteur/cible avec CHOIX « ou », et coût Ether, pas encore encodés). v44 : déclenché de MORT DE SOI (onSelfDestroyed, 804.7). DSL compileSelfDestroyedText « Quand/Lorsque <self> est détruit(e), [vous pouvez] BODY » → trigger onSelfDestroyed + ops (compileBody). Bus : RuleEvent {kind:"destroyed",instanceId,controller} émis à la DESTRUCTION RÉELLE (→ Défausse) sur 3 chemins câblés — dommages létaux (stateBasedDestroyEvents/checkVictory), destroyTarget interactif + destroyAll (resolveDestroyTarget) ; collectTriggeredEffects → destroyedFrames lit la carte détruite (controller/cardName) AVANT le dispatch (info encore lisible), enfile APRÈS la destruction. JAMAIS sur bannissement (→ Exil) ni recyclage (→ Pioche). « vous pouvez … » → effectChoices (confirmé), pas exécution d'office. +3 auto (Xav le Boulanger/healHeroTarget 1, Nerbe/heroGainPv 2, Daguette/optional destroyTarget Zone|Équipement). SKIP (manuel, jamais d'approximation) : qualificatif de destructeur « par un joueur adverse » (Skrouj, Écumouth), mort du Porteur (Amukwak…), veilles de mort d'autrui « un autre de vos Tofus / un de vos Alliés » (watcher), corps de paiement « payer pour » (Marlène, Champ Champ), corps actor-bound « il/elle inflige » (Tofu Mutant) et bodies non mappables (Otomaï recycle-all, Folle perte PM, Coffre/Mandrine). v43 : trois gains fidèles. (1) createToken étendu — countFromRecycled (« Mettez en jeu LE MÊME NOMBRE de jetons … » : nombre = compte recyclé lié à la frame, boundCount) + tapped (« … inclinés dans le Monde » : entrée inclinée) → Classe de Vampyro (costRecycle{max,Monstres,Défausse} + createToken countFromRecycled tapped). (2) banishFromZone — bannissement depuis une PILE (Défausse adverse, publique) : « Bannissez la carte [l'Équipement…] de votre choix de/dans la Défausse d'un adversaire » → pick interactif dans seats[opponent].defausse, carte choisie → Exil de son propriétaire (aucun XP) → Snouffle, Poubelles d'Astrub (+draw). +3 auto. SKIP (manuel, jamais d'approximation) : Task « qui vient de subir des Dommages / s'incliner » (Bwork Archer, Flèche Harcelante, Alie Zéle, Pièges Sournois/Répulsif) — counters.damage est TURN-scoped (purgé au début de tour, persiste entre combats) PAS combat-scoped, et les Dommages d'un Héros sont en PV (hp) pas en counters.damage → « recentlyDamaged » exclurait les Héros et serait une approximation ; « vient de s'incliner/se redresser » exige une RÉCENCE de réaction qu'orientation:tapped/upright ne capture pas. v42 : sous-système BANNISSEMENT (« Bannir » = retirer de la partie → Exil). Op banishTarget (jumelle de destroyTarget MAIS sans XP ni destruction : la cible va en Exil de son propriétaire ; un jeton banni cesse d'exister) + cost:banishSelf / banishSelfFromDiscard (la SOURCE part en Exil au lieu de s'incliner ; variante « depuis votre Défausse »). DSL : « Bannissez l'Allié [Famille] [de Niveau ≤ N] de votre choix [dans le Monde] » / « Bannissez le <Famille> de votre choix » → banishTarget ; « Bannissez <self> [depuis votre Défausse] : BODY » → cost banishSelf + body (compileBody). +3 auto (Geôles d'Astrub : banishSelf+banishTarget Allié ; Têtes à Clic et à Clac : banishSelf+banishTarget Démon ; Carte du Grav'Mar'Av' : banishSelf+searchDeck Zone+shuffle). SKIP (manuel) : Arbre de Vie (« Réduisez à 0 les Dommages … » — pas d'op bouclier mappable), Bibliothèque de Barbok (recherche multi-type « Équipement ou Zone »), bannissement de Défausse adverse (Snouffle/Poubelles), jeton-name-matching (Faux), count dynamique (Parchemin de Sagesse), triggered (Crail/Brumaire), name-search (Bague d'Ombrage), play-restriction (Pleur Nycheuz). v41 : moisson « harvest-final » — DSL : phrasing « Détruisez l'Allié, la Zone ou l'Équipement de votre choix » (destruction multi-type à TROIS compléments, jumeau de « Renvoyez X, Y ou Z … ») → +2 auto (Otomaï incarnam/dofus-collection, onArrive). CARD_SCRIPTS : 8 créatures-jetons « Mettez [self] en jeu comme un Monstre … de Force N [Élément] » (Action → onPlay createToken ; Élément récupéré verbatim du raw, perdu au scraping : Aiguille Chercheuse/Feu, Coffre/Eau, Épée/Air, Chaton/Air, Lapin/Feu, Bloqueuse/Terre, Balise/Feu, Dragonnet/Feu) + Goultard « apparaît incliné » (onArrive tapSelf). +11 effets couverts (auto 351→353, manual 33→42). SKIP (manuel — sous-systèmes non bâtis) : icônes droppées (« gagne ou/et . »), magnitudes dynamiques « égal à », Bannissez, fenêtres de réaction « sur le point / vient de », déclencheurs flottants « chaque fois », Chi-Fu-Mi/hasard, production de Ressource, formes Porteur dynamiques. v40 : JETONS de créature — op createToken (« Mettez en jeu un jeton "Monstre - X" de Force N [Élément] ») : minte une créature SYNTHÉTIQUE (carte de registre, mainType Allié + subType Monstre/Famille, Force/Élément imprimés) participant de combat à part entière ; quitte le jeu = cesse d'exister (event CREATE_TOKEN, reducer). DSL : Abraknyde (tap-power once-per-turn → onTap createToken) + Vampyro (« Recyclez un Monstre de votre choix : … » → costRecycleControlled + createToken). SKIP (manuel) : Classe de Vampyro (« le même nombre de jetons »), Métaria/Isletate/Faux/Nemoh. +3 auto (2 Abraknyde, 1 Vampyro). v39 : clause once-per-turn redondante d'un pouvoir à inclinaison DE SOI retirée avant compilation (l'inclinaison de la source EST le verrou « une fois par tour », et la table n'autorise l'activation que pendant votre tour → « N'utilisez ce pouvoir qu'une (seule) fois par tour [et uniquement pendant votre tour] » est redondante, fidèle à retirer). Strictement gated sur requiresIncline (et coût d'inclinaison/sacrifice de soi) ; AUCUN strip sur effet non-tap (aucun verrou → manuel) ni sur rider à condition réelle (« après un combat … », « uniquement si … dans le Monde »). +1 auto (Papi Tsubi/draw 2). v38 : aura de mot-clé compilée — keywordAura{keyword,sub?,heroes?,excludeSource?} (« Tant que <self> est dans le Monde, vos [autres] Alliés [Famille] [et Héros] gagnent <Géant|Agilité|Agressivité|Tacle> ») : miroir exact de forceAura mais octroyant un mot-clé de COMBAT câblé, lu par effectiveKeywords (légalité/résolution). +3 auto (Bash Skwal/Agilité, Gelée Royale Citron/Agilité, Boomba/Tacle). SKIP (manuel) : mots-clés inertes (Fantôme/Défense/Renfort), formes Porteur. v37 : sous-système costModifier — statiques de RÉDUCTION DE COÛT compilés (planCost les consulte) : selfCostMod{n,ifHeroClass} (les 12 Dopeuls « Si votre Héros est <Classe>, le coût du <self> est réduit de N ») + costAura{n,scope} (« Tant que <self> est dans le Monde, le coût de vos <Allié [Famille]|Actions|cartes Uniques> est réduit de N » — Araknotanker Grouilleux). Plancher 0, « vos … » seulement. SKIP (manuel) : augmentation de coût adverse, formes Porteur (Cape Cérémoniale), scopes non calculables (Capture/Invocations/Sorts même Classe), planchers « minimum 1 ». +13 auto. v36 : re-scrape batch3 — récupération verbatim des descriptions à icônes perdues (65 effets sur 9 extensions : coûts « réduit/augmenté de N », éléments de Dommages/Ressources/jetons, mots-clés Géant/Agilité/Tacle/Agressivité/Capture/Défense, alignements Bonta/Brâkmar, glyphe « joué » d'Échec critique). Données seulement ; 8 reclassés en ruling, le reste reste uncovered (nécessite de futurs ops : modif de coût, octroi statique de mot-clé, production de Ressource élémentaire). v35 : Tacle câblé (verrou d'inclinaison relationnel dans resolveCombat — les bloqueurs en relation de blocage avec un possesseur de Tacle ne s'inclinent pas en fin de combat) → grantKeyword{Self,Target}{Tacle} compilé (jeton TURN tacleTurnMod → effectiveKeywords.tacle) ; +2 grants couverts (Petit Anneau de Chance, Ocehan Zileveun) ; BEARER/COMBAT/composite Tacle + mots-clés encore inertes (Fantôme/Défense/Renfort) restent manuels
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 heures

const EXTENSION_FILES = [
  "amakna",
  "ankama-convention-5",
  "astrub",
  "bonta-brakmar",
  "chaos-dogrest",
  "dofus-collection",
  "ile-des-wabbits",
  "incarnam",
  "otomai",
  "pandala",
  "draft",
];

interface CacheData {
  timestamp: number;
  cards: Card[];
}

function isValidCache(cache: CacheData): boolean {
  try {
    const now = Date.now();
    return now - cache.timestamp < CACHE_EXPIRATION;
  } catch {
    return false;
  }
}

async function loadFromCache(): Promise<Card[] | null> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cacheData: CacheData = JSON.parse(cached);
    if (!isValidCache(cacheData)) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return cacheData.cards;
  } catch (error) {
    console.error("Erreur lors du chargement du cache:", error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

async function saveToCache(cards: Card[]) {
  try {
    const cacheData: CacheData = {
      timestamp: Date.now(),
      cards,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error("Erreur lors de la sauvegarde dans le cache:", error);
  }
}

function normalizeCardType(type: string): string {
  const t = (type || "").trim();
  switch (t) {
    case "Havre Sac":
    case "Havre-sac":
    case "Havre-Sac":
      return "Havre-Sac"; // unifier en 'Havre-Sac' (capital S) pour correspondre aux types définis
    case "héros":
    case "Heros":
      return "Héros";
    default:
      return t;
  }
}

function capitalizeElement(element: string): string {
  if (!element) return element;
  const lower = element.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Mots-clés canoniques du Wakfu TCG. Les données scrappées contiennent des
// fragments de phrases mal parsés ("Le", ",", ":", "**Résistance"…) qu'on
// filtre pour ne pas les afficher comme mots-clés.
const CANONICAL_KEYWORDS = new Set([
  "Résistance",
  "Recette",
  "Géant",
  "Fabriquer",
  "Inclinaison",
  "Portée",
  "Critique",
  "Parade",
  "Riposte",
  "Soin",
  "Tacle",
  "Esquive",
  "Initiative",
  "Invocation",
  "Unique",
  "Poison",
  "Brûlure",
  "Vol de vie",
]);

function normalizeKeywordName(name: unknown): string {
  return String(name ?? "")
    .replace(/^[^\p{L}]+/u, "") // retire les "*", ":", "," en tête
    .trim();
}

function normalizeCardElements(card: any): void {
  if (card.stats?.niveau?.element) {
    card.stats.niveau.element = capitalizeElement(card.stats.niveau.element);
  }
  if (card.stats?.force?.element) {
    card.stats.force.element = capitalizeElement(card.stats.force.element);
  }
  // Normalise la casse des éléments dans les effets et mots-clés.
  for (const eff of card.effects || []) {
    if (eff && Array.isArray(eff.elements)) {
      eff.elements = eff.elements.map(capitalizeElement);
    }
  }
  // Filtre + normalise les mots-clés (noms canoniques uniquement).
  if (Array.isArray(card.keywords)) {
    card.keywords = card.keywords
      .map((kw: any) => {
        if (!kw) return null;
        const name = normalizeKeywordName(kw.name);
        if (Array.isArray(kw.elements))
          kw.elements = kw.elements.map(capitalizeElement);
        return { ...kw, name };
      })
      .filter((kw: any) => kw && CANONICAL_KEYWORDS.has(kw.name));
  }
}

function fixSpecialCharacters(str: string): string {
  if (!str) return str;

  // Remplacer les caractères spéciaux mal encodés
  return str
    .replace(/Alli\?\?/g, "Allié")
    .replace(/H\?\?ros/g, "Héros")
    .replace(/\?\?quipement/g, "Équipement")
    .replace(/Sort[\s]?\?\?mentaire/g, "Sort Élémentaire")
    .replace(/r\?\?serve/g, "réserve")
    .replace(/\?\?l\?\?ment/g, "élément")
    .replace(/\?\?l\?\?mentaire/g, "élémentaire")
    .replace(/d\?\?g\?\?ts/g, "dégâts")
    .replace(/\?\?nergie/g, "énergie")
    .replace(/\?\?/g, "é"); // Dernier recours pour les 'é' non reconnus
}

// IMPORTANT : cette fonction PROPAGE ses erreurs (fetch, parsing, format).
// Ne pas la « tolérer » en renvoyant [] : un catalogue partiel servi comme
// complet fait jeter les cartes des extensions manquantes lors de la
// reconstruction des decks cloud (perte de cartes constatée en prod).
async function loadExtensionCards(extension: string): Promise<Card[]> {
  try {
    const response = await fetch(`/data/${extension}.json`);
    if (!response.ok) {
      throw new Error(
        `Échec du chargement des cartes pour l'extension ${extension}: ${response.status} ${response.statusText}`,
      );
    }

    let cards;
    try {
      // On convertit d'abord en texte pour détecter les problèmes d'encodage
      const text = await response.text();

      // Si le texte ne contient aucune donnée valide
      if (!text || text.trim() === "" || text.trim() === "[]") {
        return [];
      }

      try {
        cards = JSON.parse(text);
      } catch (parseError) {
        throw parseError;
      }
    } catch (jsonError) {
      throw new Error(
        `Erreur de parsing JSON pour l'extension ${extension}: ${jsonError}`,
      );
    }

    if (!Array.isArray(cards)) {
      // Donnée corrompue ≠ extension vide : on échoue franchement plutôt que
      // de servir un catalogue amputé.
      throw new Error(
        `Format inattendu pour l'extension ${extension}: tableau attendu`,
      );
    }

    if (cards.length === 0) {
      return [];
    }

    // Validate and normalize each card
    const validCards = cards
      .filter((card: any) => {
        if (!card || typeof card !== "object") {
          return false;
        }
        // Vérification minimale
        if (!card.id || !card.name) {
          return false;
        }
        return true;
      })
      .map((card: any) => {
        // Normaliser la carte
        const normalizedCard = { ...card };

        // Corriger les caractères spéciaux dans des champs clés
        if (normalizedCard.name) {
          normalizedCard.name = fixSpecialCharacters(normalizedCard.name);
        }

        if (normalizedCard.mainType) {
          normalizedCard.mainType = fixSpecialCharacters(
            normalizedCard.mainType,
          );
          // Normaliser aussi le type principal
          normalizedCard.mainType = normalizeCardType(normalizedCard.mainType);
        }

        if (Array.isArray(normalizedCard.subTypes)) {
          normalizedCard.subTypes =
            normalizedCard.subTypes.map(fixSpecialCharacters);
        }

        // Normalize element casing
        normalizeCardElements(normalizedCard);

        // Ensure required properties exist
        if (!normalizedCard.id) {
          normalizedCard.id = `unknown-${Math.random().toString(36).substring(2, 10)}`;
        }

        if (!normalizedCard.name) {
          normalizedCard.name = "Carte sans nom";
        }

        if (!normalizedCard.mainType) {
          normalizedCard.mainType = "Type inconnu";
        }

        if (!Array.isArray(normalizedCard.subTypes)) {
          normalizedCard.subTypes = [];
        }

        if (!normalizedCard.rarity) {
          normalizedCard.rarity = "Commune";
        }

        // Ensure extension property is valid
        if (
          !normalizedCard.extension ||
          typeof normalizedCard.extension !== "object"
        ) {
          normalizedCard.extension = {
            name:
              extension.charAt(0).toUpperCase() +
              extension.slice(1).replace(/-/g, " "),
            id: extension,
          };
        } else if (!normalizedCard.extension.name) {
          normalizedCard.extension.name =
            extension.charAt(0).toUpperCase() +
            extension.slice(1).replace(/-/g, " ");
        }

        return normalizedCard;
      });

    return validCards;
  } catch (error) {
    console.error(
      `Erreur lors du chargement des cartes pour l'extension ${extension}:`,
      error,
    );
    throw error;
  }
}

/**
 * Charge toutes les extensions en parallèle ; les échecs sont re-tentés une
 * fois, et s'il en reste, on REJETTE : tout ou rien. Jamais de catalogue
 * partiel (il tronquerait silencieusement les decks au pull cloud).
 */
async function loadExtensionsAllOrNothing(): Promise<Card[]> {
  const results = await Promise.allSettled(
    EXTENSION_FILES.map((extension) => loadExtensionCards(extension)),
  );
  const cardsByExtension: Card[][] = [];
  const failed: number[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") cardsByExtension[i] = r.value;
    else failed.push(i);
  });

  if (failed.length > 0) {
    const retries = await Promise.allSettled(
      failed.map((i) => loadExtensionCards(EXTENSION_FILES[i])),
    );
    const stillFailing: string[] = [];
    retries.forEach((r, j) => {
      const i = failed[j];
      if (r.status === "fulfilled") cardsByExtension[i] = r.value;
      else stillFailing.push(EXTENSION_FILES[i]);
    });
    if (stillFailing.length > 0) {
      throw new Error(
        `Catalogue incomplet, extension(s) en échec après retry: ${stillFailing.join(", ")}`,
      );
    }
  }

  return cardsByExtension.flat();
}

export async function loadAllCards(): Promise<Card[]> {
  try {
    // Vérifier si les cartes sont en cache
    const cachedCards = await loadFromCache();
    if (cachedCards) {
      return cachedCards;
    }

    const allCards = await loadExtensionsAllOrNothing();

    // Mettre en cache pour les prochains chargements (catalogue complet
    // uniquement : on n'arrive ici que si toutes les extensions ont chargé)
    saveToCache(allCards);

    return allCards;
  } catch (error) {
    console.error("Erreur lors du chargement des cartes:", error);
    throw error;
  }
}

export async function loadCardById(
  extension: string,
  cardId: string,
): Promise<Card | null> {
  try {
    const cards = await loadExtensionCards(extension);
    return cards.find((card) => card.id === cardId) || null;
  } catch (error) {
    console.error(
      `Error loading card ${cardId} from extension ${extension}:`,
      error,
    );
    return null;
  }
}

// Fonction utilitaire pour tester le chargement d'un seul fichier JSON
export async function testJsonLoading(extension: string): Promise<any> {
  try {
    const filePath = `/data/${extension}.json`;

    const response = await fetch(filePath);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        statusText: response.statusText,
      };
    }

    const text = await response.text();

    try {
      const data = JSON.parse(text);

      if (Array.isArray(data)) {
        return {
          success: true,
          items: data.length,
          sample: data.slice(0, 3),
        };
      } else {
        return {
          success: false,
          type: typeof data,
          data,
        };
      }
    } catch (parseError) {
      return {
        success: false,
        error:
          parseError instanceof Error ? parseError.message : String(parseError),
        textSample: text.substring(0, 100),
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
