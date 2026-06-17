# Roadmap — Finition v1 (hors automatisation des effets)

Issue de l'audit multi-agents du 2026-06-17 (58 items, 6 dimensions). Chaque item
est **traité** : corrigé (FIX), tranché (DÉCISION), documenté (DOC), délégué à
l'utilisateur (UA) ou explicitement reporté (DEFER / NON-OBJECTIF). Statut coché
au fur et à mesure.

## Décisions de périmètre (défauts pris, réversibles)

- **DEC-1 — Jeu en ligne masqué en v1.** Le « Jouer en ligne (bêta) » n'est pas
  fonctionnel de bout en bout (transitions non synchronisées, pas de reconnexion,
  backend non déployé). Le finir est une épopée vérifiable seulement avec backend
  - 2 clients → **v1.1**. En v1 : masquer le panneau derrière un flag, garder le
    code. Réversible.
- **DEC-2 — Réserve non piochable en jeu.** La réserve est un sideboard (101.4) ;
  on retire `drawFromReserve` du flux de partie (zone manuelle, non piochable).
- **DEC-3 — Non-objectifs v1 (documentés, non codés) :** Scellé/Draft (101.2),
  mulligan de tour 604.2, updater/signature Tauri, file d'écritures hors-ligne
  (conflit last-write-wins assumé).

## Action utilisateur (je documente, tu exécutes)

- **UA-1 — Provisionner Supabase.** Appliquer les migrations `0001+0003+0004+0005`
  sur le projet lié ; Auth → Email activé + Redirect URLs (prod + localhost
  4173/3000) ; renseigner `VITE_SUPABASE_*` dans Vercel (Prod+Preview). Je corrige
  `DEPLOYMENT.md` (P4) pour lister toutes les migrations ; l'application dashboard
  reste manuelle (je n'ai pas les accès, et saisir des identifiants est interdit).

---

## Phase 1 — Bugs visibles (haute)

- [x] **P1.1** Decks officiels : ne plus auto-injecter au démarrage (call retiré
      d'`App.vue`) ; garde anti-doublon à l'import (`OfficialDecksView`).
      `createDeckFromOfficial` (format hérité) est du **code mort** → suppression
      en P4.2. ✅ « Mes decks » vide pour un nouvel utilisateur ; réimport = pas de
      doublon.
- [x] **P1.2** Reset mot de passe : écran de saisie du nouveau mot de passe au
      retour du lien (`PASSWORD_RECOVERY` → `authStore.passwordRecovery` → formulaire
      `updatePassword`). ✅ Le flux n'est plus une impasse.
- [x] **P1.3** Jeu en ligne masqué (DEC-1) : panneau derrière le flag
      `ONLINE_PLAY_ENABLED = false`. ✅ Lobby sobre ; code conservé/compilable.
- [~] **P1.4** Leçons par mécanique : **DÉFÉRÉ** — l'utilisateur a explicitement
  demandé de **ne pas les mettre sur la front page** (« reste sobre », commit
  b127c83). Le code des leçons reste latent (pour une future page « École » hors
  front page). NE PAS re-surfacer dans le lobby.
- [~] **P1.5** → **subsumé dans P4.2** : `isFirstTimeUser`/`isInitializationCompleted`
  (clés non namespacées) sont du **code mort** après P1.1 (aucun appelant) → la
  faille ne se déclenche pas ; suppression du code mort en P4.2.

## Phase 2 — Règles & cohérence (moyenne)

- [x] **P2.1** Règle 507.5 : `draw()` remélange la Défausse→Pioche sur Pioche vide
      (`reshuffleDiscardIntoDeck`) ; pas de défaite deck-out. ✅ + test store.
- [x] **P2.2** `validateDeck` vérifie `mainType` Héros/Havre-Sac (102.1). ✅ + test.
- [x] **P2.3** Réserve non piochable (DEC-2) : `drawFromReserve` supprimé (store +
      export) ; PileStack Réserve rendu en info statique (sans `deck`/`@act`). ✅
- [~] **P2.4** Import texte : **DOCUMENTÉ** — le format texte ne porte pas la
  réserve ; le **partage base64** (`deckSharing`) la préserve (chemin de fidélité
  recommandé). Pas de réécriture du parseur (risque > bénéfice).
- [~] **P2.5** Exil sans UI (basse, cas rare) : **déplacé en P4.4** (polish).
- [x] **P2.6** Mode assisté : `watch(assist)` annule le combat en cours si on
      désactive « Règles assistées » en plein combat (évite l'impasse). ✅

## Phase 3 — Type-check, tests & a11y (haute/moyenne)

- [x] **P3.1** ✅ Type-check vert. Réalité : le `tsconfig` était en `NodeNext`
      (faux pour Vite) et masquait **188** erreurs réelles (pas ~20). Corrigé en
      `ESNext`/`Bundler`, puis 188 → 0 : purge de ~20 fichiers morts + 2 clusters
      morts **cassés à l'exécution** (cardLoader `loadFile`/`loadCardsFromFile`/
      `extractElement` qui traitaient effets/mots-clés comme des chaînes alors que
      ce sont des objets — le vrai chargeur est `loadExtensionCards` ; chaîne
      d'init `starterService`) + narrowings. Script `type-check` ajouté et **gate
      CI** branché (étape `vue-tsc` dans le job « Lint & Types »). 603 tests, build OK.
- [~] **P3.2** Largement fait. La suite e2e était **cassée** (texte d'accueil
  périmé ; `/decks` & `/deck-builder` redirigés vers `/auth` en anonyme ;
  build CI sans env Supabase → overlay « Configuration requise » masquant le
  router-view ; assertions vacantes `if(count>0)`, `waitForTimeout`, casse
  « Mes Decks »). **Réparée + étendue** : fixture d'auth (injection user
  Pinia + nav SPA), de-masking complet, casse corrigée, `data-testid` (lobby,
  passation/mulligan, plateau, coach tutoriel, thème), env Supabase factice
  au build CI, `playwright.config` en 127.0.0.1. **Nouveaux tests** : lancement
  sandbox lobby→plateau, lancement du tutoriel « découverte ». **25/25 verts**
  en local (série ; CI = workers 1). _Reste_ : le test e2e du **flux de combat
  via l'UI** (attaque→blocage→résolution→dégâts) — le plus fragile à piloter ;
  les règles de combat sont déjà couvertes par 603 tests unitaires. À ajouter
  avec `data-testid` sur la barre de combat (`combat-confirm`/`resolve`/…) et
  un `data-combat-role` sur les `.gslot`.
- [ ] **P3.3** a11y automatisée : `@axe-core/playwright`, scan des pages clés
      (`/`, `/collection`, `/deck-builder`, `/play/table`).
- [x] **P3.4** ✅ Les 7 fichiers `.spec.ts.disabled` (schéma carte périmé)
      supprimés (avec P3.1). Réécriture éventuelle DeckBuilder/DeckDrawSimulator
      repliée dans P3.5 (tests composants).
- [ ] **P3.5** Tests composants jeu : `SeatHud`, `GameCard` + test store
      `tutorialStore` (cycle decouverte : setup → avancement d'étapes).
- [ ] **P3.6** a11y clavier : chemin pour _jouer_ une carte au clavier qui passe
      par `playFromHand` (coût/légalité) et non `moveTo` brut (`GameBoard` barre
      d'action « → Monde »).

## Phase 4 — Polish, code mort & docs (basse)

- [ ] **P4.1 Docs** : `CLAUDE.md` (1585 cartes, 0 sans image ; tests ~424→612 ;
      type de Havre-Sac casse) ; `MEMORY.md`/auto-memory (276→612) ; `DEPLOYMENT.md`
      (migrations 0003/0004/0005) ; `CDC-MODULE-JEU-ETAT.md` (3 lignes périmées :
      103.3, 2342, PA/PM mods) ; `AUDIT-2026-06.md` #13 (Otomaï image présente).
- [ ] **P4.2 Code mort / lint** : retirer `src/stores/sync.ts` (non câblé) et
      `src/data/keywords.ts` (non importé) — ou les brancher ; câbler/retirer les
      handlers orphelins `CollectionView` (`resetFilters`, `disableHideNotOwned`) ;
      nettoyer les `no-unused-vars` notables ; viser `--max-warnings` raisonnable.
- [ ] **P4.3 Infra polish** : `vercel.json` CSP + Permissions-Policy ; `robots.txt`
      (+ note sitemap). DEC-3 documente updater Tauri / conflit hors-ligne.
- [ ] **P4.4 UX polish** : journal `ActionLog` scroll-back (historique complet) ;
      breakpoint tablette 1025–1100px aligné ; `getCardTypeBreakdown` mémoïsé ;
      deck builder `aria-live` sur blocages ; hint « effets à la main » discret sur la
      table hors tutoriel ; vérifier l'affichage des 3 errata.

## NON-OBJECTIFS v1 (documentés, non codés — DEC-3)

- Machine de phases distincte (redressement/pioche/fin) — scaffolding assumé,
  `turn.phase` reste « principale » + libellés contextuels.
- Scellé/Draft (101.2) ; mulligan de tour (604.2) ; updater/signature Tauri ;
  file d'écritures hors-ligne (last-write-wins assumé).
- Jeu en ligne (DEC-1) → épopée v1.1.

## Vérification (à chaque phase)

`npx vitest run` (vert), `npm run build` (OK), `npx vue-tsc --noEmit` (0 erreur
après P3.1), `npm run lint`, et rejeu live preview (port 3000) pour les changements
UI. E2E (`npm run test:e2e`) après P3.2.
