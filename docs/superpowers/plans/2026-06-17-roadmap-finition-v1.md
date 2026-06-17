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

- [ ] **P1.1** Decks officiels : ne plus auto-injecter au démarrage (`App.vue`
      `initializeOfficialDecksList`) ; unifier `createDeckFromOfficial` sur le format
      `DeckCard[]` du store ; garde anti-doublon à l'import (`OfficialDecksView`).
      _Fait quand :_ « Mes decks » vide pour un nouvel utilisateur ; réimport = pas de
      doublon ; aucun deck au format `Record<string,number>`.
- [ ] **P1.2** Reset mot de passe : écran de saisie du nouveau mot de passe au
      retour du lien (event `PASSWORD_RECOVERY` / `updateUser`). _Fait quand :_ le
      flux « Mot de passe oublié → e-mail → nouveau mdp » aboutit.
- [ ] **P1.3** Masquer le jeu en ligne (DEC-1) : panneau « Jouer en ligne (bêta) »
      derrière un flag désactivé par défaut. _Fait quand :_ le lobby n'expose plus
      l'en-ligne ; le code reste compilable/testé.
- [ ] **P1.4** Leçons par mécanique : section « Apprendre une mécanique » dans le
      lobby itérant `tutorial.mechanicLessons` → `startLesson(id)`. _Fait quand :_ les
      leçons combat/leveling sont lançables depuis l'UI.
- [ ] **P1.5** Clés localStorage namespacées : `isFirstTimeUser` /
      `isInitializationCompleted` via `storageNamespace` (par compte). _Fait quand :_
      plus de clés en dur, flag d'init par utilisateur.

## Phase 2 — Règles & cohérence (moyenne)

- [ ] **P2.1** Règle 507.5 : sur Pioche vide, remélanger la Défausse → Pioche puis
      poursuivre la pioche (dans `draw()`). + test moteur/store.
- [ ] **P2.2** `validateDeck` vérifie `mainType` Héros/Havre-Sac (pas seulement la
      présence). + test validateur.
- [ ] **P2.3** Réserve non piochable (DEC-2) : retirer `drawFromReserve` du flux +
      le bouton UI. + test.
- [ ] **P2.4** Import texte : gérer la réserve à l'export/import (`deckStore`
      `importDeck`/`exportDeck`) — ou documenter l'asymétrie si trop coûteux.
- [ ] **P2.5** Exil : afficher une pile `PileStack` (ou compteur) quand
      `exil.length > 0` dans `GameBoard`.
- [ ] **P2.6** Mode assisté : garde lors d'un toggle `assist` en plein combat
      (éviter l'impasse) + libellé/aide du toggle.

## Phase 3 — Type-check, tests & a11y (haute/moyenne)

- [ ] **P3.1** Corriger les ~20 erreurs `vue-tsc --noEmit` (CardDetailsView,
      CardsView, CollectionView, comparaisons mortes « Havre-sac », `tests/setup.ts`,
      `tsconfig` types Vitest/Node) ; ajouter script `type-check` + job CI.
- [ ] **P3.2** E2E `/play/table` : parcours sandbox → poser Allié → attaque →
      blocage → résolution → vérif dégâts/leveling ; + parcours tutoriel. data-testid
      sur les éléments clés ; supprimer les `if(count>0)` masquants et `waitForTimeout`
      ; corriger la casse « Mes Decks » → « Mes decks ».
- [ ] **P3.3** a11y automatisée : `@axe-core/playwright`, scan des pages clés
      (`/`, `/collection`, `/deck-builder`, `/play/table`).
- [ ] **P3.4** 7 fichiers `.spec.ts.disabled` : supprimer les morts (schéma carte
      périmé) ; réécrire 1–2 utiles (DeckBuilder, DeckDrawSimulator) sur les factories
      actuelles.
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
