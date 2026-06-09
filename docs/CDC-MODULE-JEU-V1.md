# Cahier des Charges V1 — Module de Jeu en Ligne « La Table des Douze »

---

## 0. Page de garde

|                         |                                                                      |
| ----------------------- | -------------------------------------------------------------------- |
| **Produit**             | L'Almanach des Douze — Module de jeu en ligne « La Table des Douze » |
| **Document**            | Cahier des charges — Version 1 (V1) du module de jeu 1v1 en ligne    |
| **Version du document** | 1.0                                                                  |
| **Date**                | _TODO — à figer à la validation_                                     |
| **Statut**              | Proposé pour validation                                              |
| **Rédacteur en chef**   | Équipe Almanach des Douze                                            |
| **URL produit**         | https://almanach-des-douze-xairons-projects.vercel.app               |

**Objet du document.** Ce cahier des charges spécifie de façon exhaustive et sans ambiguïté la **première version (V1) du module de jeu en ligne 1v1** du TCG Wakfu, intégré à l'application existante « L'Almanach des Douze ». Il définit la vision, le périmètre, le niveau de règles appliqué, les parcours utilisateurs, les exigences fonctionnelles (FR-xx) et non-fonctionnelles (NFR-xx), le modèle de données, l'architecture (en renvoi au document de conception déjà tranché `docs/GAME-MODULE-V1.md`), la sécurité, les critères d'acceptation, les risques, et les jalons de livraison. Il fait autorité sur le « quoi » et le « pourquoi » de la V1 ; le « comment » technique détaillé vit dans `docs/GAME-MODULE-V1.md`.

**Documents de référence (ancrage vérifié) :**

- `docs/GAME-MODULE-V1.md` — conception technique tranchée (event-sourcing, 100 % Supabase, redaction, RNG, RLS, lots de livraison) + revue adversariale (sections A–E). **Socle non rouvert ici.**
- `src/data/rules.ts` + `_incoming/rules-reference.txt` — règles officielles du TCG Wakfu (source de vérité métier).
- `src/types/cards.ts` — types canoniques (`Card`, `HeroCard`, `Deck`…), source unique immuable.
- `src/utils/deckSharing.ts` — format de code de deck base64 existant (`encodeDeck`/`decodeDeck`/`parseShareUrl`), réutilisé tel quel.
- `supabase/migrations/0001_init.sql` — moule RLS owner-scoped + trigger `set_updated_at`.

---

## 1. Contexte & vision

### 1.1 Contexte produit

« L'Almanach des Douze » est une application web (PWA, Vue 3 + TypeScript + Pinia + Supabase, déployée sur Vercel) de **gestion de collection et de construction de decks** pour le TCG Wakfu. L'ensemble de cartes est **fini (~1585 cartes)** ; images, vignettes et données par carte (type, stats PA/PM/PV, niveau+élément, force+élément, effets, mots-clés, recto/verso héros) sont déjà disponibles. Le **partage de deck par code base64** est déjà implémenté (`utils/deckSharing`).

Aujourd'hui, l'utilisateur peut tout faire **autour** d'une partie (collectionner, construire, partager) mais **ne peut pas jouer**. La V1 comble ce manque structurant.

### 1.2 Vision

**La Table des Douze** transforme l'Almanach d'un outil de deckbuilding en un lieu où l'on **joue réellement** au Wakfu TCG, à deux, en s'échangeant un lien.

> **Promesse produit.** _Deux amis lancent une partie 1v1 en moins d'une minute, avec n'importe quel deck, sans posséder une seule carte, sur une table virtuelle propre, fluide et arbitrée par un serveur de confiance._

La V1 vise le ressenti « défi direct entre amis » (à la MTG Arena / salon Jackbox) : on ouvre une table, on partage un code, l'adversaire arrive, chacun choisit son deck, on joue. Le serveur est **autoritatif** là où la triche serait invisible (ordre des coups, mélange aléatoire, information cachée) ; les joueurs **s'auto-arbitrent** sur l'interprétation des cartes. C'est une table **structurellement honnête** — fidèle au cadre du jeu — mais **volontairement non exhaustive** sur l'automatisation des effets de cartes, assumée comme telle et conçue pour grandir carte par carte sans refonte.

### 1.3 Ce qui rend « à la MTGA » sans automatiser les effets

Le ressenti « propre et fluide » de MTGA ne tient pas tant à la résolution automatique du texte des cartes qu'à : un **serveur autoritatif**, l'**absence de bookkeeping manuel** (mélange, pioche, comptage), l'**impossibilité de tricher sur l'aléatoire**, des **déplacements de cartes lisibles et animés**, et un **état qui ne diverge jamais** entre les deux écrans. La V1 livre exactement cela. L'automatisation du texte des cartes — chantier comparable à un moteur type XMage — est explicitement reportée après la V1.

---

## 2. Objectifs V1 & critères de succès

| ID        | Objectif                                                                  | Cible mesurable                                                                                                       |
| --------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **OBJ-1** | **Time-to-play** : de la page d'accueil à la première carte jouée, à deux | ≤ 60 s (créer + partager + rejoindre + choisir deck + setup)                                                          |
| **OBJ-2** | **Jouer sans posséder**                                                   | 100 % des ~1585 cartes jouables en ligne ; possession (collection) **jamais** requise                                 |
| **OBJ-3** | **Sources de deck acceptées**                                             | 2 : deck sauvegardé **ou** code de deck collé (réutilise `encodeDeck`/`decodeDeck`)                                   |
| **OBJ-4** | **Fluidité perçue**                                                       | Application optimiste d'un coup déterministe < 16 ms (1 frame) ; confirmation serveur p95 < 600 ms                    |
| **OBJ-5** | **Robustesse de session**                                                 | Reconnexion + reconstruction d'état exacte ≤ 3 s, sans perte d'information                                            |
| **OBJ-6** | **Fidélité du cadre de jeu**                                              | 100 % des mécaniques structurelles (zones, pioche, inclinaison, compteurs, mélange serveur) appliquées par le moteur  |
| **OBJ-7** | **Intégrité de l'information cachée**                                     | 0 fuite vérifiable : aucun `cardId` de main/pioche adverse, aucun ordre de pioche, aucune corrélation par identifiant |
| **OBJ-8** | **Partie complète jouable**                                               | Une partie peut atteindre une condition de victoire officielle (0 PV ou Niveau 3) sans blocage moteur                 |

**Critères de succès produit (post-livraison, beta).** Au moins 80 % des parties créées et rejointes vont jusqu'à une fin déclarée (victoire/concession) sans abandon technique ; aucun incident de fuite d'information cachée ; coût d'infrastructure beta < 25 €/mois pour 100 parties simultanées de pointe.

---

## 3. Périmètre V1

### 3.1 Décision structurante : le niveau de règles retenu

C'est la décision la plus engageante du projet. Trois niveaux d'enforcement étaient envisageables :

| Niveau    | Nom                                        | Ce que le moteur garantit                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Ce que le joueur fait                                                                                                                         | Analogie                                                |
| --------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **1**     | **Table libre**                            | RNG/mélange honnêtes (serveur), zones, déplacements, compteurs libres. **Aucune** notion de tour, phase ni légalité.                                                                                                                                                                                                                                                                                                                                                                  | **Tout** manuellement et non vérifié.                                                                                                         | Cockatrice                                              |
| **1-bis** | **Table libre + assistance** ⭐ **RETENU** | Niveau 1 **+** placement initial automatique, pioche depuis une Pioche secrète, redaction par siège, **macros d'assistance** (mulligan dégressif, redresser tout, compléter la main à PA, retrait des Dommages), **structure de tour/phases affichée et compteurs structurés** (PV/PM/PA/XP/Dommages/Niveau), **cascades mécaniques** (équipements suivant leur porteur, routage propriétaire des zones personnelles). Les indications de phase/légalité/fin sont **non bloquantes**. | Les **effets des cartes** : coûts, cibles, pouvoirs, combat (valeurs), montée de niveau, victoire — résolus via primitives, **non vérifiés**. | MTGA « si MTGA ne connaissait pas le texte des cartes » |
| **3**     | **Automatisation complète**                | Niveau 1-bis **+** résolution automatique du texte de chaque carte, moteur de timing/priorité, ciblage légal.                                                                                                                                                                                                                                                                                                                                                                         | Rien (ou presque).                                                                                                                            | XMage / MTGA complet                                    |

**Décision retenue (FR-LVL-01) : Niveau « 1-bis — Table libre assistée ».** Le moteur **n'interprète jamais le texte d'une carte**. Il garantit le **cadre mécanique** du jeu et fournit des **macros d'assistance** + des **indications non bloquantes** (phase courante, suggestion de fin de partie, rappels de limites), mais **n'enforce aucune légalité d'effet** : coût, élément, phase de jeu d'une carte, cible légale, capacité du Havre-Sac, « 1 attaque/tour ». Les joueurs **s'auto-arbitrent** sur l'interprétation, via un jeu de **primitives** (cf. §5.4). Chaque coup est **journalisé et lisible**.

> **Réconciliation interne assumée.** Une lecture intermédiaire proposait de rendre la détection de phases/montée de niveau/victoire **automatique et contraignante** (« Niveau 2 »). La V1 tranche en faveur du **non bloquant** : la structure de tour et les conditions de fin sont **affichées, suggérées et assistées par macros**, mais le joueur reste libre d'agir hors phase et **déclare** la fin de partie. Raison : (a) cohérence avec le socle de conception `GAME-MODULE-V1.md §2-A` (« table libre de règles ») ; (b) sans enforcement d'effet, une détection « dure » de la victoire (ex. double 0 PV, cas 103.3, sursis par effet) produirait des fins fausses que le joueur ne pourrait pas corriger ; (c) le moteur reste **pur et total**, sans connaître le texte des cartes. L'assistance riche capture l'essentiel du confort « MTGA » sans le coût ni le risque d'une fausse autorité.

**Justification de faisabilité (honnête).**

1. Le **Niveau 1 nu** (Cockatrice) est sous la promesse : il laisse tout le bookkeeping (compter PV, redresser, retirer les Dommages, pioche) au joueur.
2. Le **Niveau 3** (automatisation du texte) est un projet en soi (DSL d'effets, moteur de timing/priorité, modificateurs, ciblage légal) ; le promettre en V1 serait malhonnête.
3. Le **Niveau 1-bis** capture ~80 % du ressenti MTGA pour ~20 % du coût, et constitue le **socle exact** de l'automatisation future **sans dette** : un effet automatisé plus tard = du code qui émet les **mêmes events** qu'un joueur. Toute carte non scriptée retombera toujours sur le mode manuel — la table reste jouable en permanence.

### 3.2 Frontière précise : ENFORCÉ par le moteur vs MANUEL (joueur)

**Le moteur ENFORCE / GARANTIT (le joueur ne peut pas le contourner) :**

- L'**ordre total** des events (séquence Postgres autoritative) et l'atomicité d'écriture.
- Le **RNG du mélange** (strictement serveur ; l'ordre de la Pioche est secret **pour tous**, propriétaire inclus).
- La **redaction par siège** : aucun secret (main, ordre de pioche) ne sort sur le fil.
- Le **placement initial conforme** (Havre-Sac → Monde dressé 306.1, Héros → Havre-Sac dressé 307.1, 48 cartes → Pioche mélangée serveur, main de départ = PA 102.1-102.3) via events `system`.
- Les **6 zones officielles** + Réserve + Exil avec leur scope/visibilité.
- La **pioche** carte par carte (507.4) depuis une Pioche secrète.
- Les **compteurs structurés** (PV, Dommages, XP, Niveau, Résistance, jetons nommés).
- Les **cascades mécaniques** (non optionnelles, car sinon l'UI affiche un état incohérent) : les **Équipements/Dofus attachés suivent leur porteur** dans le même `MOVE` (305.3, réf. 2237) ; toute carte envoyée dans une zone **personnelle** va dans la zone de son **propriétaire** (`owner`), jamais du contrôleur (réf. 4596) ; un changement de contrôle passe par un event dédié `SET_CONTROLLER` (réf. 6065).
- Le **mulligan/Rollback dégressif** (102.4) comme **macro serveur** (recyclage → `SHUFFLE` serveur → repioche PA−n).

**Le moteur ASSISTE (non bloquant) :** affichage de la phase courante (602→603→604→605), macros « Redresser tout », « Compléter la main à PA », « Retirer tous les Dommages (fin de tour) » (410.8), **suggestion** de fin de partie (PV ≤ 0 → victoire au combat 103.2a ; Niveau 3 → victoire à l'XP 103.2b), surbrillance optionnelle des cibles/zones plausibles, rappels « 1 attaque/tour » / « pas d'attaque au 1er tour » (603.2).

**Le JOUEUR fait À LA MAIN (le moteur enregistre sans valider la légalité) :** coûts précis (Niveau/élément, 418), légalité du ciblage (702.2/702.3), pouvoirs déclenchés/continus/mots-clés, Réactions/Quêtes/Challenges (302/809), modificateurs (811/812), règle d'or (104), simultanéités (419), valeurs de combat, gain d'XP exact, capacité (Taille) du Havre-Sac, **déclaration de la fin de partie**.

### 3.3 INCLUS en V1

- **Cycle de partie & room** : créer une table (code court + lien partageable), rejoindre par code/lien, 2 sièges A/B, **spectateurs en lecture seule**, présence connecté/déconnecté.
- **Sélection de deck sans possession** : pool complet (~1585) disponible ; deck sauvegardé **ou** code de deck collé ; validation structurelle ; deck **verrouillé** au démarrage.
- **Table & primitives** (Niveau 1-bis) : 6 zones + Réserve + Exil ; piocher, mélanger (serveur), déplacer entre zones, incliner/redresser, compteurs, retourner (face cachée), attacher/détacher, regarder/révéler, créer un jeton, lancer un dé.
- **Tour & combat** : boucle de tour assistée, combat séquencé manuel (702-708), macros d'assistance.
- **Robustesse** : undo collaboratif (`UNDONE`), **journal d'actions exhaustif**, reconnexion par pull+replay, gestion des trous de séquence/resync.
- **Fin de partie** : suggestion/détection assistée + **déclaration** ou **concession** ; politique d'abandon/déconnexion (fenêtre de grâce, nettoyage des tables zombies) ; **revanche** (mêmes decks).
- **UI** : plateau lisible (vignettes + zoom plein), esthétique GRIMOIRE, accessibilité clavier de base, log `aria-live`.

### 3.4 EXCLU de la V1 (explicite)

- ❌ **Automatisation complète des effets** (Niveau 3) : DSL d'effets, moteur de timing/priorité, ciblage légal vérifié, modificateurs 811/812, règle d'or 104, simultanéités 419.
- ❌ **Enforcement des effets** : aucune vérification de coût, élément, cible légale, capacité Havre-Sac, phase de jeu d'une carte.
- ❌ **Jeu classé / ladder / matchmaking / ELO**.
- ❌ **Tournois** (brackets, rondes suisses).
- ❌ **Timer / horloge d'échecs serveur** (chrono de coup strict).
- ❌ **Multijoueur > 2** : 1v1 uniquement (pas de 2v2 ni free-for-all).
- ❌ **Application mobile native** (la PWA reste le seul vecteur).
- ❌ **Format Scellé/Draft en ligne** (V1 = Construit uniquement).
- ❌ **Chat vocal/vidéo** (chat texte possible via `SAID`, non prioritaire).

### 3.5 Décision tranchée — statut du mobile (cf. critique D1)

> **DÉCISION (NFR-COMPAT-02).** En V1, le module de jeu en ligne est **officiellement supporté sur desktop/tablette (≥ 1024 px)**. Sur mobile (< 768 px), la table en ligne est en **mode dégradé lecture / tap-to-act best-effort** (non garanti optimal) ; le **Mode compagnon existant** (`/play` : PV/dé/chrono, 100 % tactile, hors-ligne) reste disponible et n'est jamais cassé. Justification : afficher 2 Havre-Sacs + 2 mains + Monde commun + File + 2 défausses + 2 pioches lisiblement sur un téléphone est physiquement contraint, et optimiser le layout mobile contraindrait le modèle de zones avant le lot UI (L4). Le vrai support mobile est une évolution post-V1. Cette décision est **assumée noir sur blanc** plutôt que de promettre un mobile non tenable.

---

## 4. Personas & parcours utilisateurs

### 4.1 Personas

- **P1 — Florian, le Wakfu nostalgique (cible primaire).** A joué au TCG papier, veut **rejouer une vraie partie avec un ami du Discord** sans racheter de boosters ni installer un client lourd. Connaît les règles « dans les grandes lignes » ; **accepte de résoudre les effets à la main** si le moteur lui épargne la comptabilité (PV, inclinaison, pioche, Dommages) et la structure du tour. Joue le soir, sur portable/tablette, parfois téléphone. Déteste les états incohérents qu'il ne peut pas réparer.
- **P2 — Inès, la testeuse / power-user (qualité).** Connaît les règles à la virgule. Veut **valider des interactions**, tester des decks, repérer tout écart. Exige un **journal d'actions exhaustif et inviolable**, des primitives complètes, l'**undo collaboratif**, la possibilité de **coller un code de deck**. Garante anti-triche sociale : c'est elle qui remarque qu'un adversaire s'est donné 50 PV — donc le log doit tout montrer.
- **P3 — le joueur compétitif (ladder/tournoi).** **Hors V1** (cf. §3.4).

### 4.2 Carte des écrans & routes

| #     | Écran                                 | Route                           | Statut                |
| ----- | ------------------------------------- | ------------------------------- | --------------------- |
| E0    | Hub Jeu (existant, enrichi)           | `/play`                         | —                     |
| E1/E4 | Choix de deck (hôte / invité)         | `/play/table/:code` (lobby)     | `lobby`               |
| E2    | Salon d'attente / lobby hôte          | `/play/table/:code`             | `lobby`               |
| E3    | Atterrissage sur invitation           | `/play/table/:code`             | —                     |
| E5    | Pré-partie (tirage 1er joueur + Prêt) | `/play/table/:code`             | `lobby`→`ready`       |
| E6    | Mulligan / Rollback                   | `/play/table/:code`             | `active` (sous-phase) |
| E7    | Table de jeu (tour + combat)          | `/play/table/:code`             | `active`              |
| E8    | Spectateur (lecture seule)            | `/play/table/:code?spectate=1`  | `active`              |
| E9    | Résultat + revanche                   | overlay sur `/play/table/:code` | `finished`/`aborted`  |

Toutes les routes de jeu portent `meta.requiresAuth = true`.

### 4.3 Parcours nominaux

**A — Créer (hôte).** Depuis `/play` (E0), l'hôte clique « Nouvelle partie » → choisit son deck (E1 : onglet « Mes decks » ou « Coller un code », avec badge de validité). « Créer la partie » génère un **code court** + **lien partageable** et l'amène au salon d'attente (E2), siège A, deck verrouillé. Il copie le code/lien (Web Share API si dispo).

**B — Rejoindre par URL (invité).** L'invité ouvre `/play/table/:code` (E3). Routage : non authentifié → `/auth?redirect=…` puis retour ; siège libre → choix de deck (E4) ; déjà membre → reprise ; partie pleine → proposition spectateur (E8) ; code invalide/terminé → message d'erreur. Il choisit son deck (decks sauvegardés ou code collé), s'assied au siège B, deck verrouillé.

**C — Pré-partie & déroulé.** Les deux decks s'affichent **dos visible** (E5). Le **premier joueur** est déterminé par tirage serveur (102.2). Chacun clique **Prêt** ; à deux Prêt → `active`, **placement initial automatique** (events `system`), puis **mulligan/Rollback dégressif** (E6, premier joueur puis adversaire). Puis la table (E7) : boucle de tour assistée (Redressement → Principale → Pioche → Fin), primitives manuelles, combat séquencé (702-708).

**D — Fin & rematch.** Fin suggérée (PV ≤ 0 / Niveau 3) **déclarée** par un joueur, ou **concession**, ou **match nul** par accord → écran de résultat (E9) avec issue + cause + accès au journal. **Revanche** : mêmes decks verrouillés, choix du premier joueur revenant au perdant (102.2).

### 4.4 Parcours hors-nominal

- **Spectateur (E8)** : vue publique uniquement, aucune action.
- **Déconnexion/reconnexion** : presence signale la coupure + **compte à rebours de grâce** ; à la reconnexion, pull+replay reconstruit l'état exact ; après expiration sans retour, le joueur présent peut clore la partie (`aborted`, adversaire absent = perdant).
- **Lobby orphelin** : expiration automatique (cf. NFR), code recyclable ; annulation manuelle possible.
- **Action rejetée** (séquence périmée `parentSeq`) : re-pull + re-soumission transparente, sinon message « Action rejetée, réessayez ».
- **Désync** (trou de `seq`) : resync complet (pull), sans perte d'état.
- **Coup inhabituel** (compteur modifié à la main, carte déplacée vers une zone adverse) : surligné dans l'ActionLog (contre-pouvoir social).

---

## 5. Exigences fonctionnelles (FR-xx)

**Priorité MoSCoW :** **Must** = bloquant ship ; **Should** = fortement souhaité, descopable sans casser le cœur ; **Could** = bonus.

### 5.1 Gestion de partie (cycle de vie d'une table)

| ID        | Exigence                                                                                                                                                                                                                                                                        | Prio   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **FR-01** | Un utilisateur authentifié peut **créer une partie** 1v1 (statut `lobby`, créateur en **siège A**, event `GAME_CREATED`).                                                                                                                                                       | Must   |
| **FR-02** | La création génère un **code de table à 6 caractères** aléatoires, base32 sans caractères ambigus (`0/O/1/I/L` exclus), **sans préfixe sémantique** (~32⁶ ≈ 1 milliard de combinaisons). Collision à l'insert → régénération et nouvel essai. _(Corrige D4.)_                   | Must   |
| **FR-03** | Le système produit une **URL d'invitation partageable** (`/play/table/:code`), copiable en un clic, + bouton « Partager » (Web Share API si dispo), sur le modèle du partage de deck existant.                                                                                  | Must   |
| **FR-04** | Un second utilisateur authentifié peut **rejoindre** par code saisi **ou** par URL ; il est assigné au **siège B**.                                                                                                                                                             | Must   |
| **FR-05** | Le système **refuse la jointure** si les 2 sièges sont pris, si le code est invalide/expiré, ou si la partie n'est plus `lobby` ; message français explicite (« Table pleine », « Code introuvable », « Partie déjà commencée »).                                               | Must   |
| **FR-06** | Chaque joueur dispose d'un indicateur **« Prêt »** ; l'état Prêt de l'adversaire est visible en temps réel (Realtime presence).                                                                                                                                                 | Must   |
| **FR-07** | Le **démarrage** (`lobby`/`ready → active`) n'est possible que si les 2 sièges sont occupés, chaque deck est validé (cf. §5.2) et les 2 joueurs sont Prêt ; émet `GAME_STARTED`.                                                                                                | Must   |
| **FR-08** | Au démarrage, le serveur exécute le **placement initial conforme** via events `system` (Havre-Sac → Monde dressé 306.1, Héros → Havre-Sac dressé 307.1, 48 → Pioche mélangée serveur, main = PA 102.3). _(Setup = events système pré-tour-1, pas un coup joueur ; corrige A6.)_ | Must   |
| **FR-09** | Le serveur détermine et enregistre le **premier joueur** par tirage serveur (102.2) ; méthode et résultat inscrits au journal.                                                                                                                                                  | Must   |
| **FR-10** | Avant le tour 1, chaque joueur peut effectuer un **Mulligan/Rollback** (102.4) via **macro serveur** : recyclage de la main → `SHUFFLE` serveur → repioche `PA − n` (décompte dégressif serveur jusqu'à 0). Premier joueur d'abord. _(Corrige A5.)_                             | Must   |
| **FR-11** | Un joueur peut **concéder** (bouton « Concéder » + confirmation) : event `CONCEDE` → `finished`, adversaire vainqueur, table figée. _(Comble D2.)_                                                                                                                              | Must   |
| **FR-12** | En cas de **déconnexion** (presence), la partie reste `active` avec une **fenêtre de grâce** (défaut 5 min) ; au-delà, elle peut passer `aborted` (action de l'adversaire ou job). _(D2.)_                                                                                      | Should |
| **FR-13** | Un **job de nettoyage** marque `aborted` les `lobby` non rejoints et les `active` inactives au-delà d'un seuil, et **expire les codes** des lobbies abandonnés. _(D2/D4.)_                                                                                                      | Should |
| **FR-14** | À la fin (`finished`), le serveur **révèle la `masterSeed`** (commit-reveal) pour vérification d'intégrité des mélanges.                                                                                                                                                        | Should |
| **FR-15** | Un **match nul** peut être proposé ; la partie se termine en nul si l'adversaire accepte.                                                                                                                                                                                       | Should |
| **FR-16** | Un utilisateur authentifié peut rejoindre en **spectateur (lecture seule)** : zones publiques uniquement (Monde, Havre-Sacs, Défausses, File, comptes), **jamais** le contenu privé ni l'ordre des Pioches.                                                                     | Should |
| **FR-17** | Le créateur peut **annuler/fermer** une partie `lobby` avant démarrage (→ `aborted`), libérant le code.                                                                                                                                                                         | Could  |

### 5.2 Decks en ligne (sélection, import, légalité — SANS possession)

| ID        | Exigence                                                                                                                                                                                                                                                                              | Prio   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **FR-18** | **Aucune possession requise** : le pool complet (~1585) est disponible ; la collection **n'est jamais consultée** et n'impose aucune restriction.                                                                                                                                     | Must   |
| **FR-19** | Un joueur peut **sélectionner un deck sauvegardé** (`deckStore`, source Supabase).                                                                                                                                                                                                    | Must   |
| **FR-20** | Un joueur peut **importer un deck par code** (base64 `encodeDeck`) collé dans un champ dédié, décodé via `decodeDeck`, utilisable **sans l'enregistrer**. Une URL de partage est acceptée (`parseShareUrl`).                                                                          | Must   |
| **FR-21** | Avant de pouvoir se déclarer Prêt, le deck est **validé** ; le résultat (légal / violations) s'affiche en français. La validation **réutilise le validateur existant** (`src/validators/`, `src/config/cards.ts`) comme unique source de vérité — aucune règle dupliquée.             | Must   |
| **FR-22** | **Taille** : exactement **50 fiches** = 1 Héros + 1 Havre-Sac + **48 autres** (101.1/101.3). _(Note : `deckStore` compte 48 « cartes principales » hors Héros/Havre-Sac ; la validation en ligne somme le total = 50.)_                                                               | Must   |
| **FR-23** | **Héros & Havre-Sac** : exactement **un** Héros et **un** Havre-Sac (101.3).                                                                                                                                                                                                          | Must   |
| **FR-24** | **Copies** : max **3** exemplaires par `cardId` ; **1** pour les cartes **Unique** (101.5), calculé sur le **cumul deck principal + réserve**.                                                                                                                                        | Must   |
| **FR-25** | **Réserve** : **0 ou 12** cartes exactement (stricte), sans Héros ni Havre-Sac (101.4).                                                                                                                                                                                               | Should |
| **FR-26** | Le deck est **verrouillé au démarrage** : aucune modification une fois `active` (même si le deck source est édité ensuite).                                                                                                                                                           | Must   |
| **FR-27** | Un deck illégal **désactive « Prêt »** ; les violations précises sont listées (ex. « Réserve : 7 cartes — doit être 0 ou 12 », « Carte X : 4 exemplaires — max 3 »).                                                                                                                  | Must   |
| **FR-28** | La résolution `cardId → Card` (images/stats) se fait **côté client** via `cardStore`/`cardLoader` ; le réseau ne transporte que `cardId` + `instanceId`, **jamais** l'objet `Card`.                                                                                                   | Must   |
| **FR-29** | Un import **corrompu/illisible** (base64 invalide, cartes inconnues) est rejeté avec message clair, sans crash de l'écran. `decodeDeck` retourne `null` (jamais d'exception non gérée).                                                                                               | Must   |
| **FR-30** | **Deux niveaux de validité** choisis par le créateur et figés à la création (`ruleset`) : `constructed-v1` (strict : 1+1+48, 3/1-Unique, réserve 0/12, ≥ 1 Action/Allié ; bloque « Prêt » si illégal) ; `sandbox-v1` (tolérant : violations en avertissements non bloquants, défaut). | Should |
| **FR-31** | **Minimum instanciable** (vérifié dans **les deux** rulesets, non négociable) : exactement 1 Héros résolu, exactement 1 Havre-Sac résolu, ≥ 1 carte dans le deck principal, tous les `cardId` résolus contre le pool. Échec → la partie **ne peut pas démarrer**.                     | Must   |
| **FR-32** | La validation est **rejouée côté serveur** (Edge) au démarrage avant de figer le snapshot : un client ne peut pas forcer une partie non instanciable.                                                                                                                                 | Must   |

### 5.3 Plateau & zones

| ID        | Exigence                                                                                                                                                                                                                                            | Prio   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **FR-33** | Le plateau affiche les **6 zones officielles** (Pioche, Main, Monde **commun**, Havre-Sac, Défausse, File d'Attente **commune**) + zones techniques **Réserve** et **Exil** (501.1). Le Monde est une **bande commune** contenant les 2 Havre-Sacs. | Must   |
| **FR-34** | **Zoom carte** : clic/appui long ouvre l'image pleine résolution (`CardZoomModal`). Le plateau ne rend que des **vignettes** (`/images/cards/thumbs/<id>.webp`).                                                                                    | Must   |
| **FR-35** | **Menu contextuel de carte** (clic droit / appui prolongé) listant les actions applicables (déplacer vers…, incliner/redresser, retourner, attacher/détacher, compteurs, regarder, bannir, pioche dessus/dessous).                                  | Must   |
| **FR-36** | **Placement libre dans le Monde** : une carte déposée dans le Monde peut être positionnée librement (`at:'free', x, y`) pour reproduire le placement physique (engagement au combat).                                                               | Should |

### 5.4 Primitives & actions de table (Niveau 1-bis)

> Toutes dérivent de `MOVE` ou d'events d'état ; aucune n'est soumise à une validation de légalité d'effet. Le moteur n'interprète jamais le texte d'une carte.

| ID        | Exigence                                                                                                                                                                                                                                                                  | Prio   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **FR-37** | **Piocher** : 1 carte (ou N, chaque pioche = 1 event, 507.4) depuis le **sommet** de la Pioche vers la Main ; révélée au seul propriétaire (`payloadPrivate[owner]`) ; l'adversaire voit le décompte.                                                                     | Must   |
| **FR-38** | **Mélanger** : exclusivement **serveur** (RNG cryptographique, Fisher-Yates) ; l'ordre résultant est inconnu de tous côté client, propriétaire inclus. Émet `SHUFFLE`.                                                                                                    | Must   |
| **FR-39** | **Déplacer entre zones** (drag-and-drop desktop / tap-to-act mobile) : jouer (Main → Monde/Havre-Sac/File), défausser (→ Défausse), bannir (→ Exil), remettre en Pioche (dessus/dessous), Réserve, etc. Émet `MOVE` avec position (`top`/`bottom`/`index`/`free`).        | Must   |
| **FR-40** | **Conservation d'identité Monde↔Havre-Sac** : un `MOVE` Monde↔Havre-Sac **conserve** compteurs/marqueurs (501.5, `preservesIdentity:true`) ; **tout autre** changement de zone **purge** compteurs et modificateurs.                                                    | Must   |
| **FR-41** | **Les attachements voyagent avec leur porteur** : déplacer un porteur déplace **en bloc** ses `attachments[]` ; s'il quitte le jeu, ils suivent et sont purgés. _(Corrige A3 — pas d'équipements orphelins.)_                                                             | Must   |
| **FR-42** | **Routage propriétaire des zones personnelles** : toute destination personnelle (Pioche/Main/Défausse/Havre-Sac/Réserve) est routée vers l'instance du **propriétaire** (`owner`), dérivée serveur ; un `to.owner` client falsifié est **ignoré** (4596). _(Corrige A2.)_ | Must   |
| **FR-43** | **Incliner / Redresser** : possible uniquement dans **Monde ou Havre-Sac** (106.3). Émet `SET_ORIENTATION`.                                                                                                                                                               | Must   |
| **FR-44** | **Redresser tout** : macro (rafale de `SET_ORIENTATION`) redressant les cartes contrôlées dans Monde + Havre-Sac (assistance phase 602).                                                                                                                                  | Should |
| **FR-45** | **Retourner (face cachée / visible)** : `faceDown` est **distinct** de l'état recto/verso (`side`). _(Corrige A4 : ne pas fusionner les deux axes.)_                                                                                                                      | Must   |
| **FR-46** | **Compteurs** : incrémenter/décrémenter/fixer PV (410.2), Dommages (cumulés, 410.8), XP (415.1), Résistance (Havre-Sac, 306.3), jetons nommés ; valeurs entières ≥ 0. Émet `SET_COUNTER`/`INC_COUNTER`.                                                                   | Must   |
| **FR-47** | **Retrait des Dommages en fin de tour** : macro assistée retirant en bloc tous les Dommages des Alliés (Monde + Havre-Sacs) (410.8). Non automatique.                                                                                                                     | Should |
| **FR-48** | **Niveau Héros recto↔verso** : basculer entre recto (N1) et verso (N2/N3), mettant à jour `side` + `level` + `xp` + valeurs dérivées (PA/PM/PV/Force) (307.4/307.5). Émet `SET_LEVEL` ; `side` est **séparé** de `faceDown`.                                             | Must   |
| **FR-49** | **Attacher / Détacher** un Équipement/Dofus à un porteur (305.3/304.3). Émet `ATTACH`/`DETACH` ; rendu groupé sous le porteur.                                                                                                                                            | Must   |
| **FR-50** | **Changement de contrôleur** : transférer le **contrôle** d'une carte du Monde sans changer son propriétaire, via `SET_CONTROLLER` (6065). _(Corrige A2.)_                                                                                                                | Should |
| **FR-51** | **Regarder / Révéler** : regarder en privé les N cartes du dessus de sa Pioche (`LOOK`, `revealedTo` = demandeur) ou révéler une carte (`REVEAL`). Le savoir privé d'ordre est suivi serveur et **invalidé par tout `SHUFFLE` postérieur**. _(C3.)_                       | Should |
| **FR-52** | **Chercher dans une zone** (Pioche/Défausse/Réserve/Havre-Sac) via une modale ; la recherche en Pioche ne révèle son contenu **qu'au demandeur**.                                                                                                                         | Should |
| **FR-53** | **Créer un jeton** (Allié invoqué / `linkedTokens`) dans le Monde ou le Havre-Sac (`spawnToken`).                                                                                                                                                                         | Could  |
| **FR-54** | **Lancer un dé** : résultat RNG serveur consigné au log, pour arbitrages aléatoires manuels.                                                                                                                                                                              | Could  |
| **FR-55** | **Indicateur de capacité Havre-Sac** : affichage indicatif du nombre de cartes vs Taille (non contraignant).                                                                                                                                                              | Could  |

### 5.5 Tour & combat (assisté, manuel)

| ID        | Exigence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Prio   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **FR-56** | **Boucle de tour assistée** : indicateur de phase (Redressement → Principale → Pioche → Fin, 602-605), boutons « phase suivante » / « finir le tour », **sans bloquer** les actions hors phase. Émet `SET_PHASE`.                                                                                                                                                                                                                                                                                                | Must   |
| **FR-57** | **Passer le tour** : le serveur incrémente le numéro de tour et bascule le siège actif (`current_seat`), propagé en temps réel.                                                                                                                                                                                                                                                                                                                                                                                  | Must   |
| **FR-58** | **Pioche de fin de tour assistée** : bouton « Compléter la main à PA » (604) déclenchant les `draw` nécessaires ; exécution à l'initiative du joueur.                                                                                                                                                                                                                                                                                                                                                            | Should |
| **FR-59** | **Combat séquencé manuel** (701-708) : mode combat suivant l'ordre officiel (Cible 702 → Attaquants 703 → Bloqueurs 704 → Réactions 705 → Duels 706 → Dommages cible 707 → Fin 708), avec passages de main attaquant/défenseur, **sans** validation de cibles/PM/résolution. Déplacements via `MOVE`, dommages via `SET_COUNTER`.                                                                                                                                                                                | Must   |
| **FR-60** | **Aides de combat non contraignantes** : surbrillance des cibles/bloqueurs plausibles, rappels « max = PM », « 1 attaque/tour », « pas d'attaque au 1er tour » (603.2) ; **macros** d'application des Dommages (duels, cible) que le joueur valide et peut ajuster (Résistance).                                                                                                                                                                                                                                 | Should |
| **FR-61** | **Réactions hors-tour** : le joueur **non actif** peut soumettre des events durant le tour adverse (Réaction/Quête, blocage), selon une **liste blanche** serveur ; concurrence gérée par `parentSeq` optimiste. _(B4.)_                                                                                                                                                                                                                                                                                         | Should |
| **FR-62** | **File d'Attente — sémantique FIFO** : zone **ordonnée**, **insertion en queue (FIFO)** et **résolution en ordre inverse** (4715/4728) — **pas** une pile LIFO « à la Magic ». _(Corrige A1 et le libellé « LIFO public » du design doc §3.3.)_                                                                                                                                                                                                                                                                  | Should |
| **FR-63** | **Fin de partie déclarée, assistée** : l'UI **détecte et suggère** les conditions de victoire — Héros adverse à 0 PV (103.2a), votre Héros au Niveau 3 (103.2b) — **sans les imposer** ; le joueur **déclare** la fin (`finished`, vainqueur consigné) ou concède. **Cas particuliers signalés, non bloquants :** double 0 PV simultané = **NON-fin** (les deux Héros restent en jeu à 1 PV, la partie continue — règle 103.3) ; double Niveau 3 ou Niveau 3 + 0 PV simultanés → fin à arbitrer par les joueurs. | Must   |

### 5.6 Communication & journal

| ID        | Exigence                                                                                                                                                                                                                                                      | Prio   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **FR-64** | **Log d'actions exhaustif** : chaque event produit **une ligne lisible** en français dans l'`ActionLog`, **dérivé complet et non filtré** du journal (y compris `SET_COUNTER`/`MOVE` arbitraires). Contrôle social anti-triche en table libre. _(D3.)_        | Must   |
| **FR-65** | **Mise en évidence des coups inhabituels** (compteur modifié à une valeur improbable, carte déplacée vers une zone adverse, pioche multiple). _(D3.)_                                                                                                         | Should |
| **FR-66** | **Chat texte** entre joueurs (et spectateurs selon réglage), persisté en events `SAID`.                                                                                                                                                                       | Should |
| **FR-67** | **Annonces système** distinctes (début de partie, changement de tour, concession, fin).                                                                                                                                                                       | Should |
| **FR-68** | **Undo collaboratif** : un event `UNDONE { targetSeq }` est appendé (journal immuable, append-only) ; le fold ignore l'event ciblé et ses dépendants. Un undo traversant un `SHUFFLE` ayant révélé de l'ordre est refusé (jamais d'event inverse de mélange). | Should |
| **FR-69** | Le log est annoncé en **`aria-live="polite"`**.                                                                                                                                                                                                               | Should |

### 5.7 Compte, persistance & reprise

| ID        | Exigence                                                                                                                                                                                                            | Prio   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **FR-70** | **Authentification requise** (Supabase Auth) pour créer/rejoindre/jouer ; routes protégées par `requiresAuth` (redirection `/auth?redirect=`). L'« invité sans compte » n'est **pas** supporté en V1.               | Must   |
| **FR-71** | **Identité de siège vérifiée serveur** : un joueur ne soumet d'actions que pour **son** siège (`actor === auth.uid()`) ; toute action au nom de l'autre siège est rejetée.                                          | Must   |
| **FR-72** | **Persistance complète** : toute partie est intégralement reconstructible depuis son journal `game_events` ; aucune information de jeu ne vit hors du journal/état dérivé.                                          | Must   |
| **FR-73** | **Reprise en cours (reconnexion)** : pull du journal depuis le dernier `seq` + replay reconstruit l'**état exact** (lobby/mulligan/tour/combat), sans perte ni désync.                                              | Must   |
| **FR-74** | **Resync sur trou de séquence** : si `event.seq ≠ view.seq + 1`, le client déclenche un **resync** complet plutôt qu'un delta incohérent.                                                                           | Must   |
| **FR-75** | **Liste « Mes parties en cours »** depuis `/play` (parties `lobby`/`active`) avec bouton « Reprendre ».                                                                                                             | Should |
| **FR-76** | **Revanche** : depuis l'écran de résultat, un joueur propose une revanche ; si acceptée, nouvelle partie avec **mêmes decks verrouillés**, choix du premier joueur revenant au **perdant** (102.2), sans re-saisie. | Should |
| **FR-77** | **Historique des parties terminées** (date, adversaire, decks, résultat) ; **replay** pas à pas (lecteur minimal, lecture seule).                                                                                   | Could  |

---

## 6. Exigences non-fonctionnelles (NFR-xx)

> Codes de priorité : **P0** = bloquant ship ; **P1** = requis beta ; **P2** = souhaitable. Conventions de mesure : _move-to-confirm_ = délai émission → event serveur confirmé (client émetteur) ; _move-to-opponent_ = émission → rendu chez l'adversaire ; environnement de référence = Vercel UE + Supabase UE, clients France métropolitaine ≥ 20 Mbps ; centiles p50/p95/p99.

### 6.1 Performance & latence

| ID         | Exigence                                                                                                                             | Cible                                                                 | Prio |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---- |
| **NFR-01** | Latence d'un coup déterministe (move-to-confirm).                                                                                    | < 250 ms (p50), < 600 ms (p95), < 1 200 ms (p99).                     | P1   |
| **NFR-02** | Latence de propagation à l'adversaire (move-to-opponent).                                                                            | < 400 ms (p50), < 900 ms (p95).                                       | P1   |
| **NFR-03** | **Affichage optimiste obligatoire** pour tout coup déterministe (move connu, incliner, compteur).                                    | Réaction visuelle < 16 ms (1 frame).                                  | P0   |
| **NFR-04** | **Pas d'invention d'état non déterministe** : `SHUFFLE`/`draw` n'ont jamais d'optimistic ; état transitoire jusqu'à l'event serveur. | 0 `cardId` affiché avant révélation serveur.                          | P0   |
| **NFR-05** | Fluidité de la table (transitions FLIP).                                                                                             | ≥ 58 fps soutenus (desktop), ≥ 30 fps (mobile) ; aucun frame > 50 ms. | P1   |
| **NFR-06** | **Vignettes uniquement** sur le plateau ; image pleine au zoom seulement.                                                            | Poids images board initial < 1,5 Mo.                                  | P1   |
| **NFR-07** | Taille des payloads d'events (`cardId` + `instanceId` + métadonnées, jamais l'objet `Card`).                                         | Event médian < 1 Ko ; p99 < 4 Ko (hors `SHUFFLE`).                    | P1   |
| **NFR-08** | Coût du fold (replay) à la reconnexion.                                                                                              | Fold de 200 events sur ~100 instances < 150 ms (desktop).             | P1   |
| **NFR-09** | Coût du pull RLS par event (vue `my_game_events`, JOIN sur `game_players`, pas de sous-requête corrélée).                            | Pull de ≤ 30 events < 120 ms (p95) côté DB.                           | P1   |
| **NFR-10** | **Batch de réconciliation** : un signal Realtime → un seul `SELECT … where seq > lastSeq`.                                           | 1 broadcast → 1 select ; throttle ≤ 1 pull / 50 ms.                   | P1   |

### 6.2 Temps réel, fiabilité & résilience

| ID         | Exigence                                                                                                                                                                                        | Cible                                                     | Prio |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---- |
| **NFR-11** | **Ordre total autoritatif** par séquence Postgres `(game_id, seq)` ; `seq` jamais fourni par le client.                                                                                         | 0 event hors séquence ; `seq` strictement croissant.      | P0   |
| **NFR-12** | **Concurrence optimiste** sur fenêtres hors-tour : `append_event(expected_last_seq)` sous lock `FOR UPDATE` ; rejet si périmé ; retry client borné (re-pull, re-base, 1 retry, sinon notifier). | 0 double-application ; collision ≤ 1 retry auto.          | P0   |
| **NFR-13** | **Reprise après refresh** : reconstruction exacte par `SELECT my_game_events order by seq` + replay.                                                                                            | État post-refresh = pré-refresh ; reconstruction < 2 s.   | P0   |
| **NFR-14** | **Reconnexion après perte réseau** : rattrapage du trou de séquence.                                                                                                                            | < 5 s après retour réseau ; 0 event perdu.                | P1   |
| **NFR-15** | **Realtime traité comme best-effort** : un signal perdu ne crée pas de désync permanente (pull = source de vérité). Polling de garde toutes les 10 s si silence.                                | Perte ≤ 20 % des signaux → 0 désync permanente.           | P1   |
| **NFR-16** | **Détection de désync + resync complet** si `event.seq ≠ view.seq + 1`.                                                                                                                         | Désync résolue < 2 s ; 0 état incohérent affiché.         | P0   |
| **NFR-17** | **Déterminisme du replay** : reducer pur/total (aucun `Date.now()`/`Math.random()`).                                                                                                            | États dérivés strictement égaux pour une séquence donnée. | P0   |
| **NFR-18** | **Presence fiable** : déconnexion reflétée dans l'UI.                                                                                                                                           | Changement de presence < 3 s.                             | P1   |

### 6.3 Sécurité & anti-triche

> Principe directeur : **le secret ne sort jamais sur le fil** ; toute information cachée est _absente_ de la vue redactée (jamais simplement masquée). La redaction est **server-side** (Edge + RLS), dérivée mécaniquement de `ZONE_SPECS`, jamais laissée à la discipline du développeur. _(Détaillées au §9.)_

| ID         | Exigence                                                                                                                                                                                                                     | Cible                                                                     | Prio |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---- |
| **NFR-19** | **RNG de mélange strictement serveur** (`crypto.getRandomValues` + Fisher-Yates) ; aucun `Math.random()` dans un event persisté ; ordre de Pioche `hidden` pour tous.                                                        | 0 RNG client dans un event.                                               | P0   |
| **NFR-20** | **Qualité & atomicité RNG** : PRNG à état ≥ 128 bits (xoshiro256\*\*) ; seed de mélange dérivée d'un **nonce intra-event** (pas de `seq`) → recalculable au retry sans changer la permutation engagée. _(B1/B2.)_            | État ≥ 128 bits ; retry n'altère pas la permutation.                      | P0   |
| **NFR-21** | **Commit-reveal vérifiable** : `masterSeedHash` publié à `GAME_CREATED` ; `masterSeed` révélée **uniquement** à `finished`.                                                                                                  | Audit client recalcule toutes les permutations.                           | P1   |
| **NFR-22** | **Isolation du secret RNG** : `master_seed` dans une table `game_secrets` à **zéro policy select** (`service_role` seul) ; jamais loggée ni dans `public_state`.                                                             | Un joueur ne peut jamais `SELECT master_seed`.                            | P0   |
| **NFR-23** | **Redaction par construction** : `splitPayload(move)` pure, dérivée de `ZONE_SPECS[to].public` + `faceDown`, partagée client/serveur, **property-testée**.                                                                   | Aucun `cardId` ne traverse vers une zone non-publique, pour aucun viewer. | P0   |
| **NFR-24** | **Pas d'inférence par `instanceId`** : zones secrètes adverses n'exposent jamais d'`instanceId` réels/stables ; **handles éphémères par-viewer** alloués à la révélation ; main adverse = `Array(count)`. _(C1.)_            | B ne corrèle aucune paire de pioches/cartes de A.                         | P0   |
| **NFR-25** | **Vue RLS `security_invoker=true`** sur `my_game_events` (fragment du siège appelant uniquement) ; écriture directe sur `game_events` révoquée pour `authenticated`/`anon` (Edge `service_role` = unique chemin d'écriture). | 0 écriture directe ; 0 lecture du fragment adverse.                       | P0   |
| **NFR-26** | **Temps autoritatif serveur** : tout `ts` vient du serveur ; aucune décision sur l'horloge cliente.                                                                                                                          | 0 usage d'horloge cliente dans un event persisté.                         | P1   |
| **NFR-27** | **Autorisation d'agir** (Edge) : `actor === auth.uid()` ; partie `active` ; coup de tour seulement à son tour, **liste blanche** des coups hors-tour (blocage 704, Réaction 705, mulligan).                                  | 0 action illégitime acceptée.                                             | P0   |
| **NFR-28** | **Routage serveur des zones personnelles** : destination = `instance.owner`, jamais le `to.owner` client. _(A2.)_                                                                                                            | 0 carte envoyée dans une zone personnelle adverse.                        | P0   |
| **NFR-29** | **Le deck non possédé n'ouvre aucun privilège** : mêmes validations d'autorisation/redaction/RNG ; la possession n'est jamais consultée pour autoriser un coup.                                                              | Deck collé = même chemin qu'un deck possédé.                              | P0   |
| **NFR-30** | **Validation des entrées Edge** (schéma, bornes, types) ; events malformés rejetés sans muter l'état.                                                                                                                        | 0 event malformé persisté.                                                | P1   |
| **NFR-31** | **Défense en profondeur** : ≥ 3 couches indépendantes (RLS lecture, Edge autorité/RNG/redaction, reducer pur garde d'ordre) ; la défaillance d'une seule ne fuite aucun secret.                                              | Aucune fuite par une seule couche défaillante.                            | P0   |

### 6.4 Abus, parties zombies & équité sociale

| ID         | Exigence                                                                                                                                          | Cible                                                                     | Prio |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---- |
| **NFR-32** | **Forfait après timeout de déconnexion** (fenêtre de grâce 5 min) → transition explicite (`aborted`/forfait).                                     | Au-delà de 5 min → transition auto ; adversaire notifié.                  | P1   |
| **NFR-33** | **Concession explicite** (`CONCEDE` → `finished`).                                                                                                | 0 partie `active` indéfiniment après abandon.                             | P1   |
| **NFR-34** | **Nettoyage des parties zombies** : lobbies non rejoints expirés (défaut 30 min) ; `active`/`lobby` sans event > 24 h → `aborted` puis archivées. | Métrique « parties zombies » sous seuil.                                  | P1   |
| **NFR-35** | **Anti-spam de création** (rate-limit).                                                                                                           | Max N parties actives/utilisateur (ex. 5) ; max X créations/min (ex. 10). | P2   |
| **NFR-36** | **Codes non devinables/non squattables** : 6 caractères base32 sans préfixe ; unicité par retry ; expiration des lobbies.                         | Espace ≥ 32⁶ ; collision négligeable ; codes recyclables.                 | P1   |
| **NFR-37** | **Triche assumée mais traçable** : `ActionLog` exhaustif et inviolable, coups inhabituels signalés.                                               | 100 % des events au log.                                                  | P1   |
| **NFR-38** | **Déconnexion volontaire = pas d'avantage** : aucune info cachée gagnée, aucun reset exploitable.                                                 | Reprise reconstruit l'état exact.                                         | P1   |

### 6.5 Accessibilité

| ID         | Exigence                                                                                                                                                                               | Norme                                             | Prio |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---- |
| **NFR-39** | **Tout au clavier** (même chemin que le tap mobile) ; cibles `tabindex="0"`.                                                                                                           | 0 action exclusivement souris/drag.               | P1   |
| **NFR-40** | **Sémantique ARIA** : `GameZone` = `role="group"` + label ; `GameCard` = `role="button"` + label descriptif ; `ActionLog` = `aria-live="polite"` ; inclinaison doublée d'un état ARIA. | Labels exacts sur 100 % des éléments interactifs. | P1   |
| **NFR-41** | **Contrastes WCAG 2.1 AA** (texte ≥ 4,5:1, UI ≥ 3:1) en thèmes clair/sombre ; couleur jamais seul vecteur d'info (liserés d'élément doublés d'un label).                               | 0 violation AA.                                   | P1   |
| **NFR-42** | **`prefers-reduced-motion`** coupe les transitions ; jeu pleinement fonctionnel sans animation.                                                                                        | 100 % des animations désactivables.               | P1   |
| **NFR-43** | **Cibles tactiles ≥ 44×44 px** (WCAG 2.5.5).                                                                                                                                           | Toutes les cibles interactives.                   | P2   |

### 6.6 Compatibilité

| ID                | Exigence                                                                                                                                               | Cible                               | Prio |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ---- |
| **NFR-COMPAT-01** | **Support desktop de premier rang** (≥ 1024 px, Chrome/Edge/Firefox evergreen -2).                                                                     | 100 % des fonctionnalités V1.       | P0   |
| **NFR-COMPAT-02** | **Mobile = repli explicite** (cf. §3.5) : table en mode dégradé < 768 px ; `/play` compagnon jamais cassé.                                             | Aucune régression de `/play`.       | P1   |
| **NFR-COMPAT-03** | **Pas de backend stateful** : Vercel (SPA + serverless) + Supabase (Postgres/Edge/Realtime).                                                           | 0 dépendance à un process stateful. | P0   |
| **NFR-COMPAT-04** | **Compatibilité PWA / hors-ligne dégradé** : table en ligne indisponible proprement hors-ligne (message « connexion requise ») ; compagnon utilisable. | 0 crash hors-ligne.                 | P1   |

### 6.7 Observabilité

| ID         | Exigence                                                                                                                                       | Cible                         | Prio |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---- |
| **NFR-44** | **Logs serveur structurés** (gameId, seat, type, résultat, durée, erreur) **sans secret** (`master_seed`, `payload_private`, `cardId` secret). | 0 secret dans les logs.       | P1   |
| **NFR-45** | **Métriques de parties** (créées/démarrées/finies/abandonnées, durée médiane, events/partie, taux de désync/reconnexion, latence p50/p95).     | Dashboard beta.               | P1   |
| **NFR-46** | **Traçabilité d'incident** : journal append-only rejouable pour audit (replay déterministe).                                                   | Toute partie finie rejouable. | P1   |
| **NFR-47** | **Alerte sur anomalies** : désync > 1 % des events ou latence p95 > 2× cible sur 5 min.                                                        | Alerting configuré.           | P2   |

### 6.8 Coûts (échelle beta)

> Hypothèse : ≤ 100 parties simultanées, ~50-150 events/partie, jeu tour-par-tour (volume de coups/s faible).

| ID         | Exigence                                                                                                                                         | Cible                                               | Prio |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ---- |
| **NFR-48** | **Frugalité Realtime** : le canal ne transporte qu'un **signal `{ seq }`**, jamais l'event complet ni un secret.                                 | < quelques Ko/partie/min ; sous quota beta.         | P1   |
| **NFR-49** | **Frugalité Edge** : appelée pour `append`/`shuffle`/`pull`/`create`/`join`, pas pour chaque micro-interaction (coups déterministes optimistes). | ≤ 1 invocation/event de jeu.                        | P1   |
| **NFR-50** | **Archivage des parties finies** (`game_events` compactés).                                                                                      | Parties terminées archivées < 7 jours.              | P1   |
| **NFR-51** | **Budget coût beta**                                                                                                                             | < 25 €/mois pour 100 parties simultanées de pointe. | P2   |

---

## 7. Modèle de données & portabilité des decks

### 7.1 Principe de portabilité — « jouer sans posséder »

En ligne, la **collection n'intervient jamais**. Le pool jouable est l'ensemble fini complet (~1585 cartes, chargé par `cardStore`/`cardLoader`). Les deux canaux de sélection — deck sauvegardé et code collé — **convergent vers une structure unique** `DecodedDeckData` en amont de la validation et de l'instanciation (un seul chemin de code). Le **code de deck réutilise sans modification** le format base64 de `src/utils/deckSharing.ts` (`EncodedDeckPayload {n,h,s,c}` ↔ `DecodedDeckData {name, heroId, havreSacId, cards[]}`). Le décodage est **purement client et hors-ligne** ; la résolution `cardId → Card` se fait via le `cardStore` déjà hydraté.

### 7.2 Nouvelle migration `supabase/migrations/0002_game.sql`

Alignée sur le moule `0001_init.sql` (RLS activée partout, trigger `set_updated_at`, écriture via Edge `service_role` uniquement). Raffine le schéma esquissé en `GAME-MODULE-V1.md §6.1` en corrigeant les manques de la revue adversariale (snapshot de deck figé, isolation `master_seed`, statut d'abandon relié, rétention). Le journal `game_events`, la vue `my_game_events` et l'Edge `submit_event`/`append_event` sont spécifiés dans `GAME-MODULE-V1.md §6` et non redéfinis.

**Énumérations.**

```sql
create type public.game_status   as enum ('lobby','ready','active','finished','aborted');
create type public.player_seat   as enum ('A','B');
create type public.game_ruleset  as enum ('sandbox-v1','constructed-v1');
```

> `ready` matérialise « 2 joueurs + 2 decks validés, snapshots figés, attend le coup d'envoi » — l'état où l'on fige les snapshots avant `GAME_STARTED`.

**Table `games`** (extraits clés) :

```sql
create table public.games (
  id               text primary key,
  code             text not null unique,
  status           public.game_status  not null default 'lobby',
  ruleset          public.game_ruleset not null default 'sandbox-v1',  -- FIGÉ à la création
  created_by       uuid not null references auth.users(id) on delete set null,
  last_seq         bigint not null default 0,
  current_seat     public.player_seat,
  turn_number      int not null default 0,
  public_state     jsonb not null default '{}'::jsonb,    -- snapshot REDACTÉ-NEUTRE (zones publiques)
  master_seed_hash text,                                  -- engagement RNG public (commit)
  started_at       timestamptz, ended_at timestamptz,
  winner_seat      public.player_seat,
  end_reason       text,                                  -- 'concede'|'disconnect'|'lobby_timeout'|'manual'
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index games_code_active_idx on public.games(code)
  where status in ('lobby','ready','active');             -- code unique seulement tant que joignable
```

**Table `game_players`** — sièges + **snapshot de deck figé à T0** (cœur de la reproductibilité) :

```sql
create table public.game_players (
  game_id        text not null references public.games(id) on delete cascade,
  seat           public.player_seat not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  source_deck_id text,                 -- public.decks.id si "sauvegardé" ; null si "code collé" (pas de FK : découplage)
  deck_code      text,                 -- base64 exact soumis, conservé tel quel
  deck_snapshot  jsonb,                -- DecodedDeckData résolu, figé au GAME_STARTED (autorité unique en partie)
  deck_legal     boolean,
  ready          boolean not null default false,
  joined_at      timestamptz not null default now(),
  primary key (game_id, seat),
  unique (game_id, user_id)            -- un user = un seul siège
);
```

**Table `game_secrets`** — isolation de `master_seed` (correctif B2) :

```sql
create table public.game_secrets (
  game_id text primary key references public.games(id) on delete cascade,
  master_seed text not null,           -- 256 bits ; révélé en fin de partie via event 'REVEAL_SEED'
  created_at timestamptz not null default now()
);
alter table public.game_secrets enable row level security;
revoke all on public.game_secrets from authenticated, anon;  -- AUCUNE policy => inaccessible aux joueurs
```

**Table `game_events`** (rappel, spécifiée en `GAME-MODULE-V1.md §6.1`) : append-only, PK `(game_id, seq)`, `payload` public + `payload_private` par siège, `parent_seq` (concurrence optimiste). `revoke insert,update,delete … from authenticated, anon`.

### 7.3 Invariants clés

| #         | Invariant                                                                   | Garanti par                                                         |
| --------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| INV-G1    | `code` unique seulement parmi parties joignables ; recyclable après fin     | index partiel `games_code_active_idx`                               |
| INV-G2    | `ruleset` immuable post-création                                            | Edge (aucun write client)                                           |
| INV-P2    | 1 user = 1 siège                                                            | `unique(game_id, user_id)`                                          |
| INV-P3    | `deck_snapshot` null tant que `< active`, puis **immuable**                 | Edge `start_game`                                                   |
| INV-P4/P5 | partie indépendante du deck source & du pool évolutif                       | snapshot autosuffisant (cardId historiques), pas de FK vers `decks` |
| INV-E1/E2 | journal append-only, `seq` monotone, `parent_seq` == `last_seq` sinon rejet | RLS revoke + `append_event` sous lock                               |
| INV-S1    | `master_seed` jamais lisible par un joueur                                  | `game_secrets` sans policy select                                   |

### 7.4 Identité des cartes en partie (`instanceId` vs `cardId`)

| Notion         | Champ                | Portée                   | Rôle                                                             |
| -------------- | -------------------- | ------------------------ | ---------------------------------------------------------------- |
| **Définition** | `cardId: string`     | global, immuable (~1585) | clé vers `cards.ts` ; résolue **client** via `cardStore`         |
| **Occurrence** | `instanceId: string` | une partie               | une carte physique précise ; 3 copies = 3 `instanceId` distincts |

- Chaque carte du `deck_snapshot` génère `quantity` occurrences `CardInstance` à `instanceId` unique/stable, **générés serveur-déterministe** au `start_game` (pour que replay/reconnexion/spectateur dérivent les mêmes ids). `CardInstance.owner` immuable ; `controller` modifiable via `SET_CONTROLLER`.
- **L'instanciation ne lit ni n'écrit `public.collections`** : un deck non possédé suit exactement le même chemin qu'un deck possédé.
- **Redaction sur l'identité (C1)** : les `instanceId` réels des zones secrètes adverses ne sont **jamais transmis** au non-propriétaire (handles éphémères par-viewer). Un `MOVE pioche→main` ne met aucun `instanceId`/`cardId` réel dans `payload` public (seulement le compte) ; ils vont dans `payload_private[owner]`. `splitPayload(move)` est dérivée mécaniquement de `ZONE_SPECS[to].public` et **property-testée**.

### 7.5 Rétention & purge

Lobbies fantômes (`lobby`/`ready` inactifs > 2 h → `aborted`, code recyclé) ; parties zombies (`active` sans event > 24 h → `aborted`) ; purge physique des `finished`/`aborted` > 30 jours (cascade `game_players`/`game_events`/`game_secrets`) ; tâche planifiée (pg_cron ou Edge programmée), idempotente et bornée par batch.

### 7.6 RGPD & vie privée (QA-05)

- **NFR-RGPD-01 — Droit à l'effacement vs journal immuable.** Le journal `game_events` est append-only (intégrité du replay) ; le droit à l'effacement s'applique au niveau **identité**, pas event par event. À la suppression d'un compte, ses parties **terminées** sont purgées par cascade ; pour les références résiduelles, le `user_id` est **anonymisé** (remplacé par un pseudonyme stable type `joueur-supprimé-x`), jamais conservé en clair.
- **NFR-RGPD-02 — Minimisation.** Une partie ne stocke que l'`user_id`, le snapshot de deck (cartes, données publiques) et les coups. Aucune donnée personnelle au-delà de ce que l'auth Supabase détient déjà.
- **NFR-RGPD-03 — Chat & modération.** Si un chat texte est inclus (FR optionnel), les messages sont soumis à la même rétention (purge à 30 j), non indexés, et un signalement/blocage basique est prévu ; à défaut de modération, **se limiter aux emotes prédéfinis** (décision de périmètre).
- **NFR-RGPD-04 — Spectateurs.** Le lien spectateur ne donne accès qu'à l'**état public redacté** ; il n'expose aucune main ni ordre de pioche, et n'écrit jamais dans le journal.

---

## 8. Architecture technique (synthèse)

> **Le détail technique est tranché dans `docs/GAME-MODULE-V1.md` et n'est pas rouvert.** Synthèse pour le lecteur du CdC.

- **Event-sourcing de bout en bout.** `GameState = events.reduce(applyEvent, initialState)`. Le reducer est **pur, déterministe, total** (aucun `Date.now()`/`Math.random()` ; tout non-déterminisme est capturé _dans_ l'event). Conséquence : sync, undo, replay, spectateur et reconnexion sont des **corollaires gratuits**, pas des features à coder. C'est aligné sur les règles officielles, qui raisonnent déjà en events (507.4).
- **100 % Supabase, zéro infra ajoutée** (décision unanime des contributeurs, `GAME-MODULE-V1.md §2`). **Postgres** = event store + autorité d'ordre (contrainte `(game_id, seq)`, fonction `append_event` sous lock `FOR UPDATE`, concurrence optimiste par `parentSeq`). **Edge Function Deno `submit_event`** = unique chemin d'écriture : RNG cryptographique, redaction (calcul des `payload_private` par siège, TS partagé client/serveur), validation d'autorisation. **Realtime** = transport (signal `{ seq }`, presence). **RLS** = redaction en lecture (vue `my_game_events` en `security_invoker`).
- **Primitive reine `MOVE`** : tous les verbes de déplacement (`draw`, `play`, `discard`, `banish`, `mill`/`tuck`, `worldHavenSwap`) en dérivent ; `SHUFFLE` est délibérément hors de `MOVE` (seul point où l'ordre est régénéré, autoritativement serveur) ; les mutations d'état (`SET_ORIENTATION`, `SET_LEVEL`, `SET_COUNTER`, `ATTACH`/`DETACH`, `LOOK`/`REVEAL`, `SET_CONTROLLER`) sont des events distincts.
- **Deux axes de visibilité indépendants** (contenu vs ordre), redactés séparément via `ZONE_SPECS`. Règle d'or : visibilité effective = `min(zone, face, révélations)`.
- **Correction de conception adoptée ici** : la File d'Attente est **FIFO (insertion en queue) / résolution en ordre inverse** (4715/4728), **et non** « LIFO public » comme l'indique encore `GAME-MODULE-V1.md §3.3` ligne 100 — à corriger dans le design doc.

**Nouveaux fichiers cibles :** `supabase/migrations/0002_game.sql`, `supabase/functions/submit_event/`, `src/game/` (types + engine + `__tests__`), `src/stores/gameStore.ts`, `src/services/gameSync.ts`, `src/game/deck/onlineDeck.ts`, `src/views/GameTableView.vue`, `e2e/game-table.spec.ts`.

---

## 9. Sécurité & anti-triche

La sécurité de la V1 tient sur **trois couches indépendantes** (NFR-31) ; le secret ne sort jamais sur le fil (il est _absent_ de la vue redactée, jamais masqué cosmétiquement).

1. **RLS (lecture).** Vue `my_game_events` obligatoirement `security_invoker=true` ; un joueur ne lit que le `payload_private` de **son** siège ; écriture directe révoquée (NFR-25). `master_seed` isolé dans `game_secrets` à zéro policy select (NFR-22).
2. **Edge Function (écriture/autorité).** RNG strictement serveur, seed dérivée d'un **nonce intra-event** (NFR-19/20) ; commit-reveal (NFR-21) ; autorisation `actor === auth.uid()` + liste blanche hors-tour (NFR-27) ; routage propriétaire des zones personnelles (NFR-28) ; validation d'entrées (NFR-30) ; `splitPayload` mécanique property-testée (NFR-23) ; handles éphémères par-viewer (NFR-24).
3. **Reducer pur (ordre).** Garde `event.seq === view.seq + 1` ; déterminisme du replay (NFR-17).

**Triche sociale assumée mais cadrée.** L'absence d'enforcement d'effet (modèle Cockatrice, amis confiants) est **compensée** par un `ActionLog` exhaustif et inviolable (NFR-37/FR-64) : tout event — y compris un `SET_COUNTER(PV, 999)` arbitraire ou un `MOVE` vers une zone adverse — produit une ligne lisible, jamais filtrée, avec mise en évidence des coups inhabituels. C'est un **choix visible**, pas un trou.

**NFR critiques (P0, bloquants ship), recoupant les 3 risques majeurs de la revue adversariale :**

- **NFR-22 + NFR-25** — isolation `master_seed` **et** vue `security_invoker` (sinon fuite massive = triche totale).
- **NFR-23 + NFR-24** — redaction par construction **et** handles éphémères (sinon inférence par `instanceId` — fuite par canal auxiliaire, C1/C2).
- **NFR-20** — seed dérivée d'un nonce intra-event (atomicité RNG↔lock SQL, B1).
- **NFR-27 + NFR-28 + NFR-29** — autorisation, routage propriétaire, neutralité du deck non possédé.

---

## 10. Critères d'acceptation & plan de test

### 10.1 Scénarios d'acceptation

La V1 est **« done » quand AC-01..AC-10 passent en e2e** (Playwright, 2 contextes navigateur = 2 joueurs, + un contexte spectateur pour AC-09) **et** que la suite de redaction AC-R passe en unitaire + intégration.

- **AC-01 — Créer et partager** (FR-01/02/03) : table créée `lobby`, code 6 car. base32 unique sans préfixe, siège A, URL copiable, deck verrouillé, Pioche non ordonnée côté client.
- **AC-02 — Rejoindre par URL avec deck NON possédé** (FR-04/18/22/31/32, NFR-04) : collection jamais vérifiée ; validation structurelle (1+1+48) ; deck verrouillé siège B ; au démarrage, `masterSeedHash` publié, placement initial via events `system`, Pioche = 48 mélangées serveur, main = PA révélée au seul propriétaire, `active`, premier joueur tiré serveur.
- **AC-03 — Mulligan/Rollback** (FR-10) : macro serveur dégressive (N → N-1 → …), adversaire ne voit aucune main, premier joueur d'abord.
- **AC-04 — Déroulé d'un tour** (FR-37/43/44/47/56/57) : « Redresser tout », jouer (carte visible à l'arrivée dans le Monde, optimistic sans saut), incliner, piocher (révélée à soi, Pioche adverse = `{count}`), passer le tour (Dommages retirés, bascule de siège), aucune légalité d'effet vérifiée.
- **AC-05 — Une attaque** (FR-59/60, A2/A3) : combat séquencé manuel ; Dommages via `SET_COUNTER` ; carte détruite va dans la Défausse de **son propriétaire** ; équipements attachés voyagent avec le porteur.
- **AC-06 — Victoire à 0 PV** (FR-63, 103.2a/103.3) : suggestion de fin non bloquante ; déclaration → `finished`, vainqueur enregistré, `masterSeed` révélée ; cas double 0 PV documenté au log (pas de fin automatique ambiguë).
- **AC-07 — Abandon/Concession** (FR-11/12) : `CONCEDE` → `finished` ; déconnexion prolongée → `aborted`, pas de table zombie.
- **AC-08 — Reconnexion** (FR-73/74) : pull + replay → état strictement identique ; main re-visible, Pioche secrète, main adverse `{count}` ; rattrapage du trou de `seq`.
- **AC-09 — Spectateur** (FR-16) : zones publiques uniquement ; jamais de `cardId` de main/pioche ni d'ordre ; aucune action soumissible.
- **AC-10 — Undo collaboratif** (FR-68) : `UNDONE{targetSeq}` appendé (journal immuable) ; fold ignore l'event ciblé ; undo traversant un `SHUFFLE` ayant révélé de l'ordre refusé.
- **AC-R — Preuve de redaction (transverse, bloquante)** : `redactStateFor(state,'B')` ne contient jamais un `cardId` de main/pioche de A ; ordre de la Pioche de A indérivable ; aucune corrélation par `instanceId` ; `MOVE` vers zone non-publique → `payload` public sans `cardId` ; canal Realtime = signal `{seq}` seul ; vue `security_invoker` ; `master_seed` jamais lisible.

### 10.2 Plan de test

Pyramide : **unitaire moteur/redaction (large)** → **intégration Edge/SQL/RLS (sécurité & atomicité)** → **e2e parcours (les 10 AC)** → **charge légère**. Outillage réutilisé : Vitest 3 + factories `tests/factories/card.ts`, Playwright/Chromium, Supabase CLI local.

- **Unitaire (L0/L1, sans réseau).** UT-01 déterminisme du fold ; UT-02 placement initial (Pioche=48, Héros dans Havre-Sac dressé, mains=PA, events `system`) ; UT-03 frontière de zone (Monde↔Havre-Sac conserve, sinon purge) ; UT-04 cascade équipements (A3) ; UT-05 owner-routing (A2) ; UT-06 `SET_CONTROLLER` ; UT-07 face vs side (A4) ; UT-08 File FIFO/inverse (A1) ; UT-09 undo ; UT-10 application de `SHUFFLE` (jamais de génération) ; UT-11 `knownOrder`/LOOK invalidé par `SHUFFLE` (C3) ; **UT-R1** redaction directe, **UT-R2** non-inférence par `instanceId` (fuzz, C1), **UT-R3** `splitPayload` mécanique (property test, C2).
- **Intégration (L2, Supabase local).** IT-01 append atomique/ordre total ; IT-02 concurrence optimiste ; **IT-03 atomicité RNG↔seq** (nonce intra-event, B1) ; IT-04 commit-reveal (PRNG ≥128 bits) ; **IT-05 `master_seed` inaccessible** (B2) ; **IT-06 `security_invoker`** (avec mutation négative) ; IT-07 RLS lecture ; IT-08 écriture verrouillée ; IT-09 autorisation de coup ; IT-10 possession non requise ; IT-11 unicité du code (D4).
- **E2E (L4).** Un test par AC-01..AC-10 + happy path bout-en-bout. Vérifs transverses : pas de saut visuel à l'optimistic ; ActionLog liste chaque event en clair ; main adverse = dos comptés.
- **Charge légère (L3/L4).** LT-01 rafale de combat (~30 events, p95 end-to-end < ~500 ms) ; LT-02 2 joueurs + 3 spectateurs (pas de fuite, quota tenu) ; LT-03 batching du pull ; LT-04 reconnexion tardive (fold borné).
- **Gate de merge.** UT-R1..R3, IT-05, IT-06 sont **bloquants** ; chaque test de redaction inclut une **mutation négative** (casser la redaction → le test doit échouer) pour prouver qu'il détecte réellement une fuite.

---

## 11. Risques & parades

Gravité (G) × Probabilité (P) sur 1-5 ; priorité ≈ G×P. Parades ancrées sur la revue adversariale de `GAME-MODULE-V1.md`.

### 11.1 Risques techniques

| ID    | Risque                                                                |  G  |  P  | Prio | Parade                                                                                                                             |
| ----- | --------------------------------------------------------------------- | :-: | :-: | :--: | ---------------------------------------------------------------------------------------------------------------------------------- |
| RT-01 | Atomicité RNG↔seq (permutation calculée sur `last_seq` périmé) — B1  |  5  |  4  | 🔴20 | Seed dérivée d'un **nonce intra-event** ; sinon retry borné (3×) dans l'Edge. **IT-03 bloquant.**                                  |
| RT-02 | Désync d'état (events désordonnés / signal perdu)                     |  5  |  3  | 🔴15 | `seq` Postgres = ordre autoritatif ; Realtime = simple signal ; pull-and-replay systématique ; garde `seq===view.seq+1`. IT-01/02. |
| RT-03 | Fuite par `instanceId` stable (corrélation main/pioche adverses) — C1 |  4  |  4  | 🔴16 | **Handles éphémères par-viewer** ; mapping réel↔handle reste serveur. **UT-R2 bloquant.**                                         |
| RT-04 | Fuite silencieuse `payload` public (cardId vers zone secrète) — C2    |  4  |  3  | 🟠12 | `splitPayload` pure, dérivée de `ZONE_SPECS`, **property-testée** (UT-R3).                                                         |
| RT-05 | `security_invoker` oublié → contournement RLS — §9                    |  5  |  2  | 🟠10 | Vue obligatoirement `security_invoker=true` ; IT-06 avec mutation négative.                                                        |
| RT-06 | `master_seed` exposée (log/`public_state`/policy) — B2                |  5  |  2  | 🟠10 | `game_secrets` séparée, `revoke all`, zéro policy ; IT-05 bloquant ; PRNG ≥128 bits.                                               |
| RT-07 | Cascade équipements non gérée → cartes fantômes — A3                  |  4  |  4  | 🔴16 | `attachments` voyagent avec le porteur dans `applyMove`. UT-04.                                                                    |
| RT-08 | Owner/controller mal routé — A2                                       |  4  |  3  | 🟠12 | Routage vers `owner` (4596) ; `SET_CONTROLLER` (6065) ; ignorer `to.owner` client. UT-05/06.                                       |
| RT-09 | Course `parentSeq` sur Réactions hors-tour — B4                       |  3  |  3  | 🟡9  | Politique de retry client documentée (re-pull, re-base, 1 retry, sinon notifier).                                                  |
| RT-10 | Coût du pull RLS (sous-requête corrélée par event) — B3               |  3  |  3  | 🟡9  | Batcher (1 select/signal) ; JOIN au lieu de sous-requête ; mesurer p95 (LT-01/03).                                                 |
| RT-11 | Fold lent en reconnexion (`structuredClone` par event) — B5           |  2  |  3  | 🟡6  | Structural sharing (immer) dès L1, ou `CHECKPOINT` réel (snapshot tous N events). LT-04.                                           |

### 11.2 Risques produit

| ID    | Risque                                                       |  G  |  P  | Prio | Parade                                                                                                                                    |
| ----- | ------------------------------------------------------------ | :-: | :-: | :--: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| RP-01 | Abandon/déconnexion sans politique (tables zombies) — D2     |  4  |  4  | 🔴16 | `CONCEDE`/`ABORT` → `finished`/`aborted` ; fenêtre de grâce 5 min ; job de nettoyage. **Intégré au périmètre** (AC-07).                   |
| RP-02 | Mobile injouable (Monde commun illisible sur téléphone) — D1 |  4  |  4  | 🔴16 | **Décision tranchée §3.5** : mobile = fallback compagnon, support desktop premier rang. Décision actée, pas découverte en e2e.            |
| RP-03 | Mulligan « manuel » bancal — A5                              |  3  |  4  | 🟡12 | Macro serveur `MULLIGAN` (SHUFFLE+draw, décompte serveur). AC-03.                                                                         |
| RP-04 | Setup compté comme coup vers le Monde — A6                   |  2  |  3  | 🟡6  | Placement initial via events `system` avant tour 1. UT-02.                                                                                |
| RP-05 | Codes de table : collisions/squat — D4                       |  2  |  3  | 🟡6  | Code base32 sans préfixe ; `unique` par retry ; expiration. IT-11.                                                                        |
| RP-06 | Sur-ingénierie du moteur de règles trop tôt                  |  3  |  2  | 🟡6  | Périmètre §3.1 verrouillé (libre de règles + assistance) ; automatisation strictement post-V1 ; ne jamais bloquer la table sur une carte. |

### 11.3 Risques sécurité

| ID    | Risque                                                     |  G  |  P  | Prio | Parade                                                                                                          |
| ----- | ---------------------------------------------------------- | :-: | :-: | :--: | --------------------------------------------------------------------------------------------------------------- |
| RS-01 | Triche par events arbitraires (`setCounter(hp,999)`…) — D3 |  3  |  4  | 🟡12 | **Assumé** (amis confiants) mais **cadré** : `ActionLog` complet/inviolable, coups inhabituels mis en évidence. |
| RS-02 | Mélange devinable (RNG client / ordre exposé)              |  5  |  2  | 🟠10 | RNG strictement serveur ; ordre `hidden` pour tous ; commit-reveal. IT-04.                                      |
| RS-03 | Savoir privé périmé après LOOK+SHUFFLE — C3                |  3  |  3  | 🟡9  | `knownOrder` redacté par siège, invalidé par tout `SHUFFLE` postérieur. UT-11.                                  |
| RS-04 | Quotas Realtime/Edge saturés                               |  2  |  3  | 🟡6  | 1v1 = volume faible ; broadcast d'un signal ; archivage ; nettoyage RP-01. LT-02.                               |

**Top 5 à éliminer avant le ship** (prio ≥ 16) : **RT-01** (atomicité RNG↔seq), **RT-03** (fuite `instanceId`), **RT-07** (cascade équipements), **RP-01** (abandon), **RP-02** (décision mobile). Les trois premiers sont des **gates de merge** (tests bloquants) ; les deux derniers sont des **décisions de périmètre** actées avant L4.

---

## 12. Jalons / lots de livraison

Repris et durcis depuis `GAME-MODULE-V1.md §8.3` : les corrections de la revue adversariale sont réinjectées dans les lots où elles appartiennent. Effort « grossier » (1 dev). Chaque lot est mergeable et démo-able seul.

| Lot    | Titre                       | Contenu                                                                                                                                                                                                                                   | Dépend | Effort   | Gate de sortie                              |
| ------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------------------------------------------- |
| **L0** | Types & contrat             | `src/game/types/{zones,events,state}.ts` ; `ZONE_SPECS` ; dès ici : `SET_CONTROLLER`, `faceDown`+`side` séparés (A4), routing owner (A2), File FIFO/inverse (A1)                                                                          | —      | ~2 j     | Contrat figé, strict mode                   |
| **L1** | Moteur pur + redaction      | `applyEvent`/`deriveState`/verbes/log dérivé/`UNDONE` ; `redactStateFor`/`splitPayload` mécanique (C2) ; handles éphémères (C1) ; cascade `attachments` (A3) ; `knownOrder` (C3)                                                          | L0     | ~6-8 j   | **UT-01..R3 verts**                         |
| **L2** | Schéma + Edge + RNG         | `0002_game.sql` (RLS, vue `security_invoker`, `game_secrets`) ; Edge `create_game`/`join`/`submit_event`/`append_event`/`pull_events` ; macro `MULLIGAN` (A5) ; RNG nonce-based (B1) ; commit-reveal                                      | L1     | ~8-10 j  | **IT-01..11 verts** (IT-03/05/06 bloquants) |
| **L3** | Sync Realtime + reconnexion | `gameStore` + `gameSync.ts` : signal `seq`, pull batché (B3), presence, conflit optimiste `parentSeq` + retry (B4), reconnexion par replay                                                                                                | L2     | ~6-8 j   | AC-08, LT-01/03 dans les seuils             |
| **L4** | UI Table jouable            | `/play/table/:code`, lobby + invitation (réutilise deckSharing), plateau drag-and-drop, zoom (`CardZoomModal`), compteurs, mains redactées, ActionLog, boutons phase/concéder ; abandon câblé (D2) ; **mobile = fallback** (D1 acté §3.5) | L3     | ~10-12 j | **AC-01..10 e2e verts**                     |
| **L5** | Polish & robustesse         | undo/redo UI, mise en évidence des coups inhabituels (D3), presence, job de nettoyage (RP-01), replay viewer minimal, `CHECKPOINT` si besoin perf (B5)                                                                                    | L4     | ~5-7 j   | LT-02/04 OK, 0 table zombie                 |

**Chemin critique.** L0→L1 est le **jalon de dérisquage majeur** : un moteur complet **et sa redaction prouvée** à 100 % en unitaire, sans une ligne de réseau. Si L1 (surtout UT-R1..R3) est vert, le reste n'est que transport et présentation. RT-01 (atomicité) est traité en L2, RT-03 (fuite `instanceId`) en L1 — les deux risques susceptibles de doubler la durée de leur lot, à attaquer en premier. RP-02 (mobile) est **décidé avant L4** (cf. §3.5). **Estimation totale grossière : ~37-47 j-p (≈ 8-10 semaines, 1 dev)**, L4 étant le lot le plus lourd.

### Définition de « V1 LIVRÉE »

La V1 est livrée quand **toutes** ces conditions sont vraies :

1. **AC-01..AC-10 passent en e2e** (2 joueurs + spectateur) + happy path bout-en-bout.
2. **AC-R / UT-R1..R3 / IT-05 / IT-06 passent**, chacun avec sa mutation négative : **aucune information cachée ne fuit par aucun canal** (state redacté, fil Realtime, `instanceId`, vue SQL, `master_seed`).
3. **`npx vitest run` vert** (moteur + redaction) ; tests d'intégration Supabase local verts (atomicité, commit-reveal, RLS, écriture verrouillée).
4. **Possession non requise prouvée** (IT-10) : rejoindre avec un deck dont aucune carte n'est possédée fonctionne, sur tout le pool (~1585).
5. **Politique d'abandon/déconnexion en place** (AC-07) : aucune partie ne reste `active` indéfiniment.
6. **Décision mobile assumée et implémentée** (fallback compagnon, §3.5) — le module n'est pas injouable sur l'écran réel d'usage.
7. Les **5 risques prio ≥ 16** (RT-01, RT-03, RT-07, RP-01, RP-02) sont **clos** (test bloquant vert ou décision actée + implémentée).
8. La V1 reste **fidèle au périmètre §3.1** : aucun enforcement d'effet ajouté ; les cascades livrées sont **mécaniques** (équipements↔porteur, défausse du propriétaire), pas des effets de carte.

> **Note d'honnêteté de périmètre.** Tout ce qui touche à la **légalité des effets** (coût, élément, phase, cible légale, capacité du Havre-Sac, « 1 attaque/tour », résolution de combat) est **auto-arbitré (manuel)** en V1. L'expérience « à la MTGA » porte sur la **fluidité, la lisibilité et l'autorité serveur** (ordre, RNG, redaction, reconnexion, spectateur, macros d'assistance), **pas** sur l'automatisation des règles. Ce dernier chantier (un `RuleEngine` au-dessus du journal inchangé) est explicitement **post-V1** et incrémental.

---

## 13. Annexe

### 13.1 Glossaire

- **ActionLog** : journal lisible dérivé exhaustivement du journal d'events, affiché en français, non filtré (contrôle social anti-triche).
- **CardInstance / `instanceId`** : occurrence d'une carte dans une partie (stable, unique) ; distincte du `cardId` (définition globale).
- **Commit-reveal** : engagement public (`masterSeedHash`) à la création + révélation (`masterSeed`) à la fin, pour audit du RNG.
- **Edge Function** : fonction Deno serverless Supabase ; unique chemin d'écriture (`submit_event`), porte RNG + redaction + autorisation.
- **Event-sourcing** : l'état dérive d'un journal d'events ordonné (`state = events.reduce(applyEvent, init)`).
- **Fold / replay** : reconstruction du `GameState` par application séquentielle des events.
- **Handle éphémère** : identifiant temporaire par-viewer évitant la corrélation d'`instanceId` sur les zones secrètes adverses.
- **Niveau 1-bis (table libre assistée)** : niveau de règles V1 — cadre mécanique enforcé + macros d'assistance, sans enforcement d'effet.
- **Optimistic update** : application locale immédiate d'un coup déterministe, réconciliée par l'event serveur (animation FLIP, pas de saut).
- **`parentSeq`** : `seq` attendu du parent ; base de la concurrence optimiste.
- **Redaction** : suppression server-side de l'information cachée avant diffusion (le secret est absent, pas masqué).
- **Ruleset** (`sandbox-v1` / `constructed-v1`) : niveau de validité de deck figé à la création.
- **Snapshot de deck** : `DecodedDeckData` figé à T0 dans `game_players.deck_snapshot`, autorité immuable pendant la partie.
- **`splitPayload`** : fonction pure découpant un event en `payload` public / `payload_private` par siège, dérivée de `ZONE_SPECS`.

### 13.2 Hors-périmètre détaillé (rappel consolidé)

Automatisation complète des effets (DSL, timing, priorité, modificateurs 811/812, ciblage légal, règle d'or 104, simultanéités 419) ; enforcement des coûts/éléments/phases/cibles/capacité Havre-Sac ; détection **contraignante** de la fin de partie ; ladder/matchmaking/ELO ; tournois ; chrono serveur ; multijoueur > 2 ; application mobile native ; Scellé/Draft en ligne ; chat vocal/vidéo ; vrai support mobile optimisé de la table (fallback compagnon en V1).

### 13.3 Points tranchés (résumé décisionnel)

1. **Niveau de règles = 1-bis (table libre assistée)**, non bloquant ; aucun enforcement d'effet (§3.1).
2. **Mobile = fallback compagnon**, support desktop premier rang (§3.5).
3. **Code de deck = format base64 existant** réutilisé tel quel (FR-20).
4. **Collection jamais consultée en ligne** ; pool complet toujours disponible (FR-18).
5. **Deux rulesets figés à la création** (`sandbox-v1` défaut / `constructed-v1`) ; minimum instanciable vérifié dans les deux (FR-30/31).
6. **Validation = validateur existant** réutilisé, rejoué serveur (FR-21/32).
7. **Deck figé à T0** dans `game_players.deck_snapshot` ⇒ reproductibilité, indépendance du deck source.
8. **`master_seed` isolé** dans `game_secrets` (zéro policy) — correctif B2.
9. **Statut `aborted` relié** à concession/déconnexion/timeout (FR-11/12/13) — correctif D2.
10. **Redaction par construction** : `splitPayload` mécanique + handles éphémères, property-testées — correctifs C1/C2.
11. **File d'Attente = FIFO / résolution inverse** (4715/4728) — corrige A1 **et** le libellé « LIFO public » de `GAME-MODULE-V1.md §3.3` (à mettre à jour dans le design doc).
12. **`security_invoker=true`** obligatoire sur `my_game_events` — correctif fuite massive.

---

_Fin du cahier des charges V1 — « La Table des Douze »._

---

# Annexe Z — Relecture qualité (QA)

All the rules claims in the CdC verify against the official reference. I have everything needed for the QA review.

---

# Relecture QA — CdC V1 « La Table des Douze »

## Verdict global : **8,5 / 10** — prêt à servir de référence de dev, sous réserve des corrections P0 ci-dessous.

C'est un excellent document : il intègre fidèlement la revue adversariale du design doc (A1-A6, B1-B5, C1-C3, D1-D4), il tranche honnêtement le niveau de règles, il numérote tout (FR/NFR/AC/RT/RP/RS), et ses affirmations de règles sont **factuellement exactes** (vérifié contre `_incoming/rules-reference.txt` : File 4715/4728, premier tour 4943/5362, double 0 PV 103.3, routage propriétaire 4596). Il ne sera pas livrable « tel quel » uniquement à cause d'une poignée de trous de complétude (RGPD, i18n, erreurs réseau exhaustives, et **une incohérence interne réelle sur la condition de victoire 103.3**). Aucun problème d'architecture.

---

## 1. INCOHÉRENCES INTERNES (à corriger en priorité)

**QA-01 (P0) — Contradiction sur le double 0 PV (103.3).** Incohérence interne dure. FR-63 dit « double 0 PV → 103.3 » et l'OBJ-8 dit « atteindre une condition de victoire (0 PV ou Niveau 3) ». Mais la règle officielle (ligne 976, vérifiée) dit : _« si deux Héros perdent leur dernier PV simultanément, les deux Héros restent en jeu avec 1 PV »_ — c'est-à-dire **non-fin, la partie continue**. Or AC-06 le traite comme une fin (« cas double 0 PV documenté au log »). Le CdC range 103.3 dans les _conditions de fin suggérées_, alors que c'est l'inverse : un **anti-pattern de fin**. À clarifier : l'UI ne doit PAS suggérer la fin sur double 0 PV ; elle doit suggérer « 1 PV chacun, la partie continue ». De même, le double Niveau 3 simultané (ligne 989 : on continue jusqu'à départage par XP) et le cas Niveau 3 + 0 PV simultané (ligne 1002 : ce joueur **perd**) ne sont nulle part dans le CdC. Ajouter ces 3 cas à FR-63.

**QA-02 (P1) — Le niveau de règles « non bloquant » est respecté partout, sauf 4 micro-fuites d'autorité à expliciter.** Le doc affirme « aucun enforcement d'effet », mais certaines macros encodent _de facto_ de la règle métier : FR-10 (décompte mulligan `PA−n` dégressif), FR-22/24/25 (validation `constructed-v1`), FR-08 (main de départ = PA). C'est cohérent avec « cadre mécanique enforcé », mais la frontière §3.2 devrait dire explicitement que **le décompte du mulligan et la main-de-départ-à-PA sont du "cadre", pas de "l'effet"** — sinon un relecteur peut y voir une violation du principe « le moteur n'interprète jamais une carte ». (Défendable, mais à écrire noir sur blanc pour lever l'ambiguïté.)

**QA-03 (P1) — `ready` vs « 2 Prêt ».** L'enum a `lobby/ready/active`. FR-06/FR-07 parlent d'« indicateur Prêt » par joueur, et §7.2 du modèle de données dit que `ready` = « 2 joueurs + 2 decks validés + snapshots figés ». Mais aucune FR ne décrit **la transition `lobby → ready`** ni qui la déclenche (les deux Prêt ? l'Edge ?). E5 mappe `lobby→ready` sans dire l'événement. Ajouter une FR explicite : « quand les 2 sièges sont Prêt + decks légaux, l'Edge fige les snapshots et passe `ready` (event `GAME_READY`) ; `GAME_STARTED` suit ». Sinon `ready` est un état orphelin comme l'était `aborted` dans le design doc.

**QA-04 (P2) — FR-30 `sandbox-v1` (défaut, tolérant) vs FR-21 « désactive Prêt si illégal ».** FR-21/FR-27 disent « deck illégal → Prêt désactivé », mais FR-30 dit que `sandbox-v1` (le **défaut**) rend les violations « non bloquantes ». Donc en mode défaut, un deck illégal **n'**empêche **pas** Prêt — ce qui contredit FR-21/27 lues isolément. Réconcilier : préciser que FR-21/27 ne bloquent qu'en `constructed-v1`, et que **seul FR-31 (minimum instanciable)** bloque dans les deux modes.

---

## 2. COMPLÉTUDE — ce qui manque

**QA-05 (P0) — Vie privée / RGPD : totalement absent.** Aucune mention. Le module crée des données nouvelles : `game_events` (journal append-only **immuable** — donc non effaçable par design), `deck_code`/`deck_snapshot`, chat `SAID`, association user↔partie, historique (FR-77). Manque : (a) base légale + politique de **rétention** côté RGPD (la §7.5 purge à 30 j techniquement, mais ce n'est pas posé comme exigence de conformité) ; (b) **droit à l'effacement** vs journal immuable (tension réelle : que devient le `user_id` d'un compte supprimé dans un `game_events` figé ? `created_by … on delete set null` traite `games` mais pas le contenu du journal) ; (c) le chat texte (FR-66) est du contenu utilisateur à modérer/effacer. Ajouter 2-3 NFR : `NFR-RGPD-01` rétention déclarée, `NFR-RGPD-02` anonymisation à la suppression de compte, `NFR-RGPD-03` pas de PII dans `payload`/log. C'est le plus gros trou de complétude.

**QA-06 (P1) — Internationalisation : non traitée, alors que le CLAUDE.md impose « UI en français ».** Le doc est 100 % FR (cohérent projet), mais : (a) aucune exigence ne dit si l'i18n est **hors-périmètre explicite** (à ajouter au §3.4) ; (b) **l'`ActionLog` génère du texte FR dérivé d'events** (FR-64) — si l'i18n arrive un jour, le log doit dériver de **clés** et non de strings figées. À cadrer maintenant (clé i18n par type d'event) même si une seule langue est livrée, sinon dette. Au minimum : ajouter « i18n hors-périmètre V1, UI FR » au §3.4.

**QA-07 (P1) — Gestion d'erreurs réseau/serveur incomplète côté UX.** Le doc couvre très bien la désync/resync (NFR-13..16) et les rejets `parentSeq` (§4.4 hors-nominal). Mais manquent des parcours d'erreur **utilisateur** concrets : (a) **Edge Function indisponible / 500 / timeout** (Supabase down) — quel message, quel retry, la partie est-elle gelée ? ; (b) **quota Realtime/Edge dépassé en cours de partie** (NFR-35 limite la création mais pas l'épuisement en jeu) ; (c) **deck `source_deck_id` supprimé entre lobby et start** (FR-19 : deck sauvegardé → mais `deck_snapshot` n'est figé qu'au `GAME_STARTED`, donc fenêtre où le deck source peut disparaître — INV-P3 dit `deck_snapshot` null tant que `< active`). Ajouter une FR « gestion des erreurs serveur (5xx/timeout) : état dégradé read-only + bouton resync, jamais de perte de journal ».

**QA-08 (P1) — Spectateurs : 4 angles morts.** FR-16 est correct mais incomplet : (a) **combien** de spectateurs max ? (impact quota + NFR-48) ; (b) un spectateur peut-il **rejoindre une partie déjà `active`** (pull+replay depuis seq 0) ou seulement en cours ? — implicite mais non spécifié ; (c) les **joueurs sont-ils notifiés** qu'on les regarde ? (vie privée sociale) ; (d) le **chat** (FR-66) est ouvert aux spectateurs « selon réglage » — qui règle, où ? AC-09 ne teste que la non-fuite, pas ces 4 points.

**QA-09 (P2) — Conditions de victoire : voir QA-01, mais aussi FR-11 concession + match nul FR-15 sans symétrie sur le résultat.** FR-15 (match nul) ne dit pas comment `winner_seat` est renseigné (NULL ?) ni quel `end_reason`. L'enum `end_reason` ('concede'|'disconnect'|'lobby_timeout'|'manual') **n'a pas de valeur 'draw'/'mutual'** alors que FR-15 existe. Incohérence schéma↔FR : ajouter `'draw'` à `end_reason`.

**QA-10 (P2) — Abandon/forfait : bien couvert (FR-11/12/13, NFR-32/33/34), un seul trou.** Que se passe-t-il si **les deux** joueurs se déconnectent simultanément ? FR-12 dit « l'adversaire présent peut clore » — mais si personne n'est présent, seul le job NFR-34 tranche (24 h). Acceptable, mais à mentionner pour ne pas laisser un lecteur supposer une fin immédiate.

**QA-11 (P2) — Accessibilité : solide (NFR-39..43), un manque.** Le **drag-and-drop** (FR-39) est cité comme desktop, avec un chemin clavier (NFR-39). Mais le **menu contextuel clic-droit** (FR-35) n'a pas d'équivalent clavier spécifié (touche `Menu`/`Shift+F10` ? long-press ?). Et `aria-live="polite"` sur un log de combat à 30 events en rafale (FR-59) va **noyer** un lecteur d'écran — préciser une politique (résumés, ou `role="log"` avec regroupement). Ajouter à NFR-40.

---

## 3. RÉALISME DU PÉRIMÈTRE — ce qui est sous-estimé

**QA-12 (P1) — L4 (UI Table, 10-12 j) est très probablement sous-estimé.** C'est le lot qui porte : plateau 7 zones × 2 + Monde commun + File + redaction par-viewer + drag-and-drop **et** tap-to-act mobile dégradé + zoom + ActionLog + lobby + invitation + **câblage abandon** + 10 AC e2e. Le design doc lui-même liste 9 composants Vue (`GameBoard`→`HandFan`…). 10-12 j pour tout cela + débogage cross-browser + animations FLIP sans saut (NFR-03/05) est optimiste pour 1 dev. Réalisme : prévoir **14-18 j** ou descoper (mobile dégradé en L5). Le total « 37-47 j-p » est donc plutôt **45-55 j-p**.

**QA-13 (P1) — Combat séquencé manuel (FR-59/60/61) sous-estimé dans L4.** Les Réactions hors-tour (FR-61) avec liste blanche serveur + concurrence `parentSeq` (NFR-12) + fenêtres de priorité (705) = la partie la plus subtile du transport, et elle est mélangée dans le « combat manuel ». RT-09 (course `parentSeq` Réactions) est noté G3×P3 mais sa **parade UX** (« re-pull, re-base, 1 retry, sinon notifier ») est non triviale à implémenter correctement avec optimistic. À isoler comme risque L3, pas L4.

**QA-14 (P2) — `instanceId` éphémères par-viewer (NFR-24, le correctif C1) : effort caché.** C'est élégant mais c'est un **mapping bidirectionnel réel↔handle, par-viewer, persistant et rejouable au replay/reconnexion/spectateur** (UT-R2). Allouer des handles « au moment de la révélation » de façon **déterministe** (pour que reconnexion/spectateur dérivent les mêmes) est plus dur qu'il n'y paraît : un handle alloué non-déterministiquement casse NFR-17 (replay déterministe). Le CdC ne dit pas comment les handles sont générés de façon déterministe et stable. À spécifier en L1 (FR-28/§7.4), sinon contradiction latente avec NFR-17.

**QA-15 (P2) — Archivage (NFR-50) « < 7 jours » vs purge (§7.5) « 30 jours » vs replay (FR-77).** Trois horizons de rétention qui se chevauchent sans hiérarchie claire : archiver à 7 j, purger à 30 j, mais FR-77 promet le **replay des parties terminées** (Could) — sur des parties archivées/compactées comment ? Si `CHECKPOINT`/compaction (B5/RT-11) écrase des events, le replay pas-à-pas (FR-77) n'a plus le grain fin. Réconcilier rétention ↔ replay.

---

## 4. AMBIGUÏTÉS & EXIGENCES NON TESTABLES

**QA-16 (P1) — OBJ-1 « ≤ 60 s » non testable tel quel.** Inclut le temps humain (choisir un deck, partager le lien, l'autre rejoint). Non mesurable de façon déterministe en CI. Reformuler en métrique **système** : « temps machine create→lobby < X ms ; join→seated < Y ms », et garder le 60 s comme objectif produit non-AC.

**QA-17 (P2) — OBJ-7/NFR-24 « 0 fuite vérifiable » / « 0 corrélation ».** « 0 corrélation par identifiant » n'est pas falsifiable en absolu (on ne peut pas prouver l'absence de tout canal auxiliaire). Le rendre testable : « UT-R2 : N pioches successives ne permettent pas de corréler 2 instanceId via les vues redactées » (déjà prévu) — référencer UT-R2 **dans** l'objectif pour le rendre vérifiable, sinon c'est un absolu non testable.

**QA-18 (P2) — NFR-05 « ≥ 58 fps soutenus ».** Mesurable mais dépend matériel ; préciser l'environnement de référence (déjà fait pour la latence §6 intro, pas pour le fps). Aligner.

**QA-19 (P2) — FR-65 « coups inhabituels » : critère d'« inhabituel » non défini.** « compteur modifié à une valeur improbable » — improbable selon quel seuil ? Non testable. Définir des règles concrètes (ex. `SET_COUNTER` direct hors macro, delta > seuil, MOVE vers zone dont `owner ≠ actor`) — sinon FR-65 est invérifiable et son test AC absent.

**QA-20 (P2) — FR-36 « placement libre `at:'free',x,y` » : non couvert par un AC** et interagit mal avec mobile dégradé (pas de drag précis). Soit le tester, soit le marquer Could/desktop-only.

---

## 5. AMÉLIORATIONS DE FORME / TRAÇABILITÉ

- **QA-21** — La date (§0) et le statut sont en `TODO`. À figer avant usage comme référence.
- **QA-22** — Aucune **matrice de traçabilité FR↔AC↔Test**. Le doc a les FR et les AC/UT/IT, mais pas de table « chaque FR Must → couvert par quel AC/test ». Plusieurs FR Must n'ont pas d'AC dédié (FR-26 verrouillage deck, FR-33 zones, FR-45 face/side, FR-48 niveau Héros) — couverts indirectement, mais sans mapping on ne peut pas prouver la complétude des tests. Ajouter cette matrice (c'est le livrable qui transforme un bon CdC en référence de dev _vérifiable_).
- **QA-23** — `ruleset` : le design doc utilise `'free-v1'` (`0002_game.sql` esquissé), le CdC utilise `'sandbox-v1'`/`'constructed-v1'`. Le CdC note qu'il « raffine », OK, mais signaler explicitement que l'enum du design doc est **remplacé** (sinon deux sources divergent).
- **QA-24** — Glossaire (§13.1) complet et bon. Manque : « siège », « presence », « resync », « fold » (présent), « handle éphémère » (présent). Ajouter « grâce/fenêtre de grâce » qui pilote FR-12/NFR-32.

---

## Synthèse exécutable (ce qu'il faut faire, par priorité)

**Bloquants avant de servir de référence (P0) :**

1. **QA-01** : corriger 103.3 (double 0 PV = **non-fin**, 1 PV chacun) + ajouter double-N3 (989) et N3+0PV (1002) à FR-63. _Erreur de règle factuelle._
2. **QA-05** : ajouter une section RGPD/rétention (journal immuable vs droit à l'effacement, anonymisation user supprimé, chat à modérer).

**Fortement recommandés (P1) :** 3. **QA-03** : spécifier la transition `lobby→ready` (event `GAME_READY`, qui la déclenche). 4. **QA-04** : réconcilier FR-21/27 (bloque Prêt) avec FR-30 `sandbox-v1` (non bloquant) — seul FR-31 bloque dans les deux modes. 5. **QA-07** : ajouter FR « erreurs serveur 5xx/timeout/quota → read-only + resync, jamais de perte de journal ». 6. **QA-08** : compléter spectateurs (max N, join mid-game, notification, réglage chat). 7. **QA-06** : déclarer i18n hors-périmètre + ActionLog dérivé de clés (pas de strings figées). 8. **QA-12/13** : ré-estimer L4 (14-18 j) ; isoler les Réactions hors-tour comme risque L3.

**Clarifications testabilité (P2) :** QA-09 (`'draw'` manquant dans `end_reason`), QA-14 (handles éphémères déterministes vs NFR-17), QA-16 (OBJ-1 métrique système), QA-19 (définir « inhabituel »), QA-22 (matrice de traçabilité FR↔Test).

**À préserver tel quel :** la décision §3.1 (niveau 1-bis), l'intégration des correctifs A1-A6/B1-B5/C1-C3/D1-D4, l'exactitude des références de règles, la stratégie de dérisquage L0→L1, les gates de merge de redaction (UT-R1..R3, IT-05/06). C'est du très bon travail — les corrections ci-dessus sont des compléments de complétude, pas une remise en cause.

**Note : 8,5 / 10.** Référence de dev quasi-prête ; deux P0 (erreur de règle 103.3, absence RGPD) et la matrice de traçabilité manquante sont ce qui sépare ce document d'un 10.

Fichiers d'ancrage utilisés : `E:\wakfu_deck_builder\docs\GAME-MODULE-V1.md`, `E:\wakfu_deck_builder\src\data\rules.ts`, `E:\wakfu_deck_builder\_incoming\rules-reference.txt` (lignes 976/989/1002 pour 103.3, 4715/4728 pour la File, 4943/5362 pour le 1er tour), `E:\wakfu_deck_builder\src\utils\deckSharing.ts`.
