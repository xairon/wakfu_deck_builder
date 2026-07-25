# Wakfu Deck Builder - CLAUDE.md

## Projet

Application web de gestion de collection et construction de decks pour le TCG Wakfu.
**Cloud-only** : authentification et données (collection + decks) via Supabase
(requis). Un cache localStorage par utilisateur sert d'affichage immédiat, mais
Supabase est la source de vérité. Auth obligatoire pour accéder à la collection /
aux decks.

## Stack technique

- **Frontend**: Vue 3 (Composition API, `<script setup>`), TypeScript ~5.3, Vite 6.3
- **State**: Pinia 3
- **Styling**: Tailwind CSS 3 + DaisyUI 4 + Headless UI
- **Auth**: Supabase (REQUIS — application cloud-only)
- **Tests**: Vitest 3 + @vue/test-utils (jsdom) — ~2334 tests unitaires, 258 fichiers
- **Type-check**: `npm run type-check` (`vue-tsc --noEmit`) — **seul garde-fou de types** (le build esbuild ne type-check pas) ; branché en CI (job « Lint & Types »)
- **E2E**: Playwright + Chromium — ~40 tests, 2 fichiers (navigation, thème, collection, decks, deck builder, partage, PWA, a11y, table de jeu : lobby/tutoriel/combat, errata, règles officielles, administration : gardes de route)
- **PWA**: vite-plugin-pwa + Workbox (installable, cache d'assets, install prompt)
- **Linting**: ESLint 9 + Prettier
- **Déploiement web**: Vercel (SPA)

## Architecture

```
src/
├── components/     # Composants Vue (card/, deck/, collection/, auth/, common/, ui/)
├── composables/    # Hooks réutilisables (useTheme, useToast, useAccessibility...)
├── config/         # Constantes et configuration
├── data/           # Données statiques (decks officiels, éléments)
├── game/           # Moteur de jeu event-sourced (engine, rules, types)
├── router/         # Vue Router (routes lazy-loadées, guards auth)
├── server/         # Serveur Express (dev uniquement)
├── services/       # Logique métier (cardLoader, localStorage, supabase, cloudSync, errataService, rulesService...)
├── stores/         # Stores Pinia (cardStore, deckStore, authStore, gameStore, tutorialStore)
├── types/          # Types TypeScript canoniques (cards.ts = source unique)
├── utils/          # Utilitaires (errors, logger, performance, imagePaths, deckSharing)
├── validators/     # Validation (règles de deck)
└── views/          # Pages (Home, Collection, DeckBuilder, Decks, DeckDetail, Official(Decks|DeckDetail), CommunityDecks, SharedDeck, Auth, Profile, PlayTable, Rules, RulesOfficial, Errata, FirstSteps, About, Credits, LegalNotice, Terms, AccessDenied, admin/(AdminHome, AdminErrata, AdminRules, AdminJournal, AdminAccounts))
```

## Commandes

- `npm run dev` — Serveur de dev (port 3000)
- `npm run build` — Build production (~10s, **ne type-check pas**)
- `npm run type-check` — Vérif TypeScript (`vue-tsc --noEmit`) — le seul gate de types
- `npm run test` — Tests unitaires (watch)
- `npm run test:unit` — Tests unitaires jsdom
- `npx vitest run` — Tests en mode CI (~2235 tests)
- `npm run coverage` — Rapport de couverture
- `npm run test:e2e` — Tests E2E Playwright (build + preview requis)
- `npm run optimize-images` — Optimisation WebP + thumbnails (sharp)
- `npm run lint` — Linting ESLint
- `npm run format` — Formatage Prettier (src/)

## Conventions de code

- TypeScript strict, pas d'`enum` (utiliser des maps `as const`)
- Programmation fonctionnelle privilégiée (pas de classes)
- Composants Vue en `<script setup lang="ts">`
- Mobile-first, responsive design
- UI en français, code en anglais
- Nommage : camelCase (variables/fonctions), PascalCase (composants/types)
- Types canoniques dans `src/types/cards.ts` — ne pas dupliquer

## Système de types

- **Source unique** : `src/types/cards.ts` (Card, HeroCard, HavenBagCard, Deck, DeckCard...)
- **Barrel export** : `src/types/index.ts`
- **Card.mainType** : `'Action' | 'Allié' | 'Allié Élémentaire' | 'Dofus' | 'Équipement' | 'Havre-Sac' | 'Héros' | 'Protecteur' | 'Salle' | 'Zone'`
- **Havre-Sac** (avec S majuscule) partout — attention à la casse

## Règles métier TCG

- **Deck valide** : 1 Héros + 1 Havre-Sac + exactement 48 cartes
- **Limite de copies** : max 3 exemplaires par carte, 1 pour les cartes "Unique". Comptée par **carte canonique** (nom), pas par impression : les réimpressions d'un même nom dans des extensions différentes (~119 noms) partagent la limite. Identité canonique via `src/utils/cardIdentity.ts` (`canonicalKey` = nom normalisé) ; comptage centralisé dans `getCardCopies` (`validateDeck`). L'identité d'une _entrée_ de deck reste par `card.id` (deux éditions = deux lignes).
- **Réserve** : exactement 0 ou 12 cartes (règle officielle 101.4 — pas un simple plafond ; cf. `validateDeck`)
- **Types de cartes** : aucun type minimum imposé (le rulebook officiel n'exige pas d'Action/Allié ; cf. `validateDeck`)
- **Éléments** : Air, Eau, Feu, Terre, Neutre
- **Extensions** : Amakna, Ankama Convention 5, Astrub, Bonta-Brakmar, Chaos d'Ogrest, DOFUS Collection, Draft, Île des Wabbits, Incarnam, Otomaï, Pandala
- **~1585 cartes uniques**, ~1613 images

## Auth & Sync

- **Supabase REQUIS** (config via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) ; sans config → écran « Configuration requise »
- Auth obligatoire pour collection / decks (router guards `requiresAuth`) ; redirection vers `/auth?redirect=`
- Confirmation e-mail gérée (signup → « Vérifiez votre e-mail »)
- Source de vérité : Supabase. Cache localStorage par utilisateur (clé `wakfu-*:<userId>`) pour affichage immédiat
- Sync : `hydrateForUser` (pull à la connexion) ; push différé sur modification (collection + decks) ; voir `src/services/cloudSync.ts`
- RLS (Row Level Security) activé sur toutes les tables — voir `supabase/migrations/0001_init.sql`

- **Rôles d'administration (socle EN PROD, UI livrée)** : `profiles.role` ∈ `user` | `admin` | `owner`, migration `supabase/migrations/0013_admin_roles.sql` — **appliquée en prod le 2026-07-24 et RLS prouvée** (`node scripts/checkAdminRls.mjs` exécuté contre la vraie base : tout ✅, dont l'auto-promotion bloquée par UPDATE **et** par INSERT en 403). Écrans (derrière les gardes de route `requiresAdmin` / `requiresOwner`, écran « Accès réservé » sinon) : `/admin` (accueil, liens vers les écrans ci-dessous), `/admin/errata` (CRUD errata, autocomplétion carte, confirmation de suppression), `/admin/regles` (corriger le texte officiel, ajouter une règle manquante, rétablir l'officiel), `/admin/journal` (lecture de `admin_audit`, filtres auteur/entité), `/admin/comptes` (`requiresOwner` : promouvoir/rétrograder via `set_user_role`). Toute règle corrigée affiche un badge « corrigé » sur la page publique `/regles/officielles`, avec le texte officiel d'origine consultable dans un `<details>` ; une règle ajoutée (`body_official` nul) n'a pas de texte source à afficher. `src/services/adminService.ts` porte les écritures règles/errata/rôles. `role` n'est écrivable **ni en `update` ni en `insert`** via l'API PostgREST : la migration révoque `insert, update` sur `public.profiles` **au niveau TABLE** puis ré-accorde `insert`/`update` colonne par colonne sur `user_id, username` seulement (un `revoke` au niveau colonne seul ne suffit pas — Postgres consulte l'ACL de relation en premier, et Supabase accorde `all privileges` au bootstrap ; PostgREST transmet la requête telle quelle et c'est PostgreSQL qui répond `permission denied for column`). Seule la RPC `set_user_role()` attribue `role`, et `owner` n'y est jamais attribuable — le premier `owner` se pose **à la main en SQL** (`update public.profiles set role = 'owner' where user_id = '<uuid>';`), pas d'autre chemin par design. Corrections de règles dans `rules_overrides` (`kind`/`sort_order` avec défaut, `chapter` obligatoire) + vue de fusion `rules_effective` (lue par `rulesService`) → re-scraper reste sans risque. Journal `admin_audit` **append-only, écrit par des triggers**. Chaque instantané non nul y est **réutilisable** : « Réutiliser cette version » renvoie vers l'éditeur de l'entité (`/admin/errata?reuse=<auditId>&side=before|after`, idem `/admin/regles`), qui se pré-remplit — **rien n'est écrit avant que l'admin n'enregistre**, et l'enregistrement passe par le chemin normal, donc il est audité comme une modification ordinaire (le journal reste honnête : « untel a remis telle valeur », jamais une réécriture de l'histoire). Logique commune dans `src/composables/useReuseFromAudit.ts` (le journal navigue, il n'édite pas — pas de 3e formulaire). Pas de reprise pour l'entité `role` : `set_user_role()` doit rester le seul chemin d'écriture d'un rôle. Repli : instantané nul → pas de lien ; entité disparue depuis → l'éditeur bascule en création plutôt que de lancer un `update` sur un id disparu (qui ne toucherait aucune ligne, sans erreur). La base E2E n'a ni admin ni owner : les tests E2E n'assertent que la redirection anonyme vers `/auth?redirect=`, le cas « connecté non-admin » est couvert par `src/router/__tests__/adminGuards.spec.ts`.

## Données

- `public/data/*.json` — Bases de cartes par extension (servis statiquement)
- `public/images/cards/` — Images des cartes
- `scripts/` — Scripts utilitaires (parsing, scraping, optimisation d'images)

## Fonctionnalités

- **Interopérabilité des réimpressions** : limite de copies canonique (par nom, toutes éditions) + sélecteur d'édition sur chaque ligne de deck (`DeckCardRow`/`ReserveRow`, affiché si >1 impression) pilotant `deckStore.setEntryEdition` (permute l'art en gardant la quantité, fusionne si l'édition cible existe déjà). Collection et partage base64 inchangés (stockent l'impression concrète).
- **Partage de deck** : URL avec deck encodé en base64 (`/deck/share?deck=...`)
- **Decks officiels** : Page de parcours et import de decks starter par extension (`/decks/official`), incluant les listes recensées des **Dofus Mag** (OCR, cf. `src/data/dofusMagDecks.ts`)
- **Decks de la communauté** : publication d'un deck par **snapshot** découplé (table `deck_publications`, migration 0009) avec fiche éditoriale (catégorie, accroche, guide) + galerie publique (`/decks/community`)
- **Table de jeu** : moteur event-sourced (`src/game/`) pour jouer une partie en **solo** (tutoriel / bac à sable) ou **1 v 1 en ligne** (temps réel, serveur autoritatif via Edge Functions), avec résolution auto des effets compilés + rappels manuels pour les effets non couverts
- **PWA** : Application installable (écran d'accueil), cache d'assets via Workbox, prompt d'installation
- **Optimisation d'images** : Pipeline WebP + thumbnails via sharp (`scripts/optimizeImages.ts`)
- **Accessibilité** : Skip nav, labels ARIA, `lang="fr"`, meta descriptions, contraste thèmes
- **Errata & règles officielles** : page `/errata` (liste groupée par extension, recherche, avant/après) + badge « Erraté » sur les cartes concernées (collection + atelier de deck, `ErrataBadge.vue`) ; `/regles/officielles` = texte intégral des règles officielles, chaque règle adressable par son numéro (ancre `#418.5b`, défilement auto + recherche). Contenu servi depuis Supabase — **seule source de vérité** (tables `rules` / `card_errata`, migration `supabase/migrations/0012_rules_errata.sql`, lecture **anon**, écriture `service_role`). Seedé et vérifié le 2026-07-24 : **66 errata, 8 chapitres / 79 sections / 445 règles**. `public/data/errata.json` et son JSON Schema ont été supprimés après vérification (le repli transitoire dans `errataService` aussi). Remise en service / réimport : `SUPABASE_MGMT_TOKEN=… node scripts/setupErrataRules.mjs` (migration → seed errata → seed règles → vérification des comptes, idempotent). Le corpus de règles se re-scrape depuis `raw-card-data/pages/regles/completes.html` via `scripts/scrapeRules.ts`. **Errata STRUCTURÉS (migration `0014_errata_changes.sql`)** : un errata porte `changes` (JSONB `[{label, before, after}]`, ex. « PA : 7 → 6 ») — un errata officiel change UN CHAMP (parfois plusieurs), pas « un texte ». Affiché champ par champ sur la fiche de carte par le composant **partagé** `src/components/card/ErrataPanel.vue`, qui remplace les DEUX rendus qui existaient et avaient divergé (`CardZoomInner` + panneau de `CollectionView`). Colonne libellée « Version imprimée » et non « sur ta carte » : **l'image du scan affiche déjà la valeur corrigée** (vérifié — Opée Tissoin y montre PA 6). `changes` est **additif** : vide, l'affichage retombe sur la prose (résumé + avant/après), donc les 66 errata existants se structurent progressivement et l'app **lit** normalement même migration non appliquée (défaut Zod `[]` → repli prose). ⚠️ En revanche les **écritures** d'errata échouent tant que `0014` n'est pas appliquée (PostgREST rejette un corps nommant une colonne inconnue) — **appliquer la migration AVANT de déployer**. Un **admin édite l'errata depuis la carte** (affordance dans `ErrataPanel`, formulaire partagé `src/components/admin/ErrataForm.vue` commun avec `/admin/errata`) ; `isAdmin` ne gate que l'affichage, la RLS refuse réellement. L'historique de chaque version est déjà conservé par `admin_audit` (before/after JSONB par trigger).

## CI/CD

- GitHub Actions CI : lint + type-check (vue-tsc) + tests + build + E2E sur push/PR (`.github/workflows/ci.yml`)
- Vercel : déploiement web SPA (`vercel.json` configuré)

## E2E Tests (Playwright)

- Config : `playwright.config.ts` — Chromium, `vite preview` sur `127.0.0.1:4173`
- Tests : `e2e/app.spec.ts` (~36) + `e2e/a11y.spec.ts` (4, skippés si `@axe-core/playwright` non installé) — ~40 tests (navigation, thème, collection, decks, deck builder, partage, PWA, a11y, **table de jeu** : lobby→plateau, tutoriel, combat, **errata** : page publique + contrôles, **règles officielles** : dégradation explicite sans données + renvoi depuis `/regles`, **administration** : gardes de route (`/admin`, `/admin/errata`, `/admin/regles`, `/admin/journal`, `/admin/comptes`) fermés à un anonyme, écran « Accès réservé » atteignable). Auth e2e via injection user Pinia + nav SPA ; build CI avec `VITE_SUPABASE_*` factices (sinon overlay « Configuration requise »). La base E2E n'a ni admin ni owner : ces tests ne couvrent que la redirection anonyme, pas le contenu des écrans
- Lancer : `npm run build && npm run test:e2e` (CI : `workers:1`)

## Aliases

- `@` → `src/`
- `~` → racine du projet
- `test` → `tests/`
- `@images` → `data/images/` (défini dans `vite.config.ts` ; actuellement inutilisé dans `src/`)
- `@data` → `data/` (défini dans `vite.config.ts` ; actuellement inutilisé dans `src/`)

## Tests

- **Setup global** : `tests/setup.ts` (mocks localStorage, fetch, ResizeObserver, IntersectionObserver)
- **Factories** : `tests/factories/card.ts` — `createMockAllyCard()`, `createMockActionCard()`, `createMockHeroCard()`, `createMockHavreSacCard()`, `createMockEquipmentCard()`, `createMockDeck()`
- **Descriptions en français** : `it('devrait ...')` pattern
- **Tests composants** : `mount()` + @vue/test-utils — `GameBoard`, `HandFan`, `SeatHud`, `GameCard` (les anciens `.spec.ts.disabled` au schéma carte périmé ont été supprimés)
