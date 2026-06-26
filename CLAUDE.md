# Wakfu Deck Builder - CLAUDE.md

## Projet

Application web de gestion de collection et construction de decks pour le TCG Wakfu.
**Cloud-only** : authentification et données (collection + decks) via Supabase
(requis). Un cache localStorage par utilisateur sert d'affichage immédiat / lecture
hors-ligne, mais Supabase est la source de vérité. Auth obligatoire pour accéder à
la collection / aux decks.

## Stack technique

- **Frontend**: Vue 3 (Composition API, `<script setup>`), TypeScript ~5.3, Vite 6.3
- **State**: Pinia 3
- **Styling**: Tailwind CSS 3 + DaisyUI 4 + Headless UI
- **Auth**: Supabase (REQUIS — application cloud-only)
- **Desktop**: Tauri 2.7 (Rust backend)
- **Tests**: Vitest 3 + @vue/test-utils (jsdom) — ~617 tests unitaires, 40 fichiers
- **Type-check**: `npm run type-check` (`vue-tsc --noEmit`) — **seul garde-fou de types** (le build esbuild ne type-check pas) ; branché en CI (job « Lint & Types »)
- **E2E**: Playwright + Chromium — 26 tests (navigation, thème, collection, decks, deck builder, partage, PWA, a11y, table de jeu : lobby/tutoriel/combat)
- **PWA**: vite-plugin-pwa + Workbox (cache offline, install prompt)
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
├── services/       # Logique métier (cardLoader, localStorage, supabase, cloudSync...)
├── stores/         # Stores Pinia (cardStore, deckStore, authStore, gameStore, tutorialStore)
├── types/          # Types TypeScript canoniques (cards.ts = source unique)
├── utils/          # Utilitaires (errors, logger, performance, imagePaths, deckSharing)
├── validators/     # Validation (règles de deck)
└── views/          # Pages (Home, Collection, DeckBuilder, Decks, Auth, SharedDeck, OfficialDecks, PlayTable, Rules)
```

## Commandes

- `npm run dev` — Serveur de dev (port 3000)
- `npm run build` — Build production (~10s, **ne type-check pas**)
- `npm run type-check` — Vérif TypeScript (`vue-tsc --noEmit`) — le seul gate de types
- `npm run test` — Tests unitaires (watch)
- `npm run test:unit` — Tests unitaires jsdom
- `npx vitest run` — Tests en mode CI (~424 tests)
- `npm run coverage` — Rapport de couverture
- `npm run tauri:dev` — Dev desktop Tauri
- `npm run tauri:build` — Build desktop (.exe/.msi)
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
- Source de vérité : Supabase. Cache localStorage par utilisateur (clé `wakfu-*:<userId>`) pour affichage immédiat / lecture hors-ligne
- Sync : `hydrateForUser` (pull à la connexion) ; push différé sur modification (collection + decks) ; voir `src/services/cloudSync.ts`
- RLS (Row Level Security) activé sur toutes les tables — voir `supabase/migrations/0001_init.sql`

## Données

- `public/data/*.json` — Bases de cartes par extension (servis statiquement)
- `public/images/cards/` — Images des cartes
- `scripts/` — Scripts utilitaires (parsing, scraping, optimisation d'images)

## Fonctionnalités

- **Interopérabilité des réimpressions** : limite de copies canonique (par nom, toutes éditions) + sélecteur d'édition sur chaque ligne de deck (`DeckCardRow`/`ReserveRow`, affiché si >1 impression) pilotant `deckStore.setEntryEdition` (permute l'art en gardant la quantité, fusionne si l'édition cible existe déjà). Collection et partage base64 inchangés (stockent l'impression concrète).
- **Partage de deck** : URL avec deck encodé en base64 (`/deck/share?deck=...`)
- **Decks officiels** : Page de parcours et import de decks starter par extension (`/decks/official`)
- **PWA** : Installation native, cache offline via Workbox, prompt d'installation
- **Optimisation d'images** : Pipeline WebP + thumbnails via sharp (`scripts/optimizeImages.ts`)
- **Accessibilité** : Skip nav, labels ARIA, `lang="fr"`, meta descriptions, contraste thèmes

## CI/CD

- GitHub Actions CI : lint + type-check (vue-tsc) + tests + build + E2E sur push/PR (`.github/workflows/ci.yml`)
- GitHub Actions Release : automatique sur tag `v*` (Windows, Node 20, Rust)
- Génère des installeurs .exe (NSIS) et .msi (Wix) via Tauri
- Vercel : déploiement web SPA (`vercel.json` configuré)

## E2E Tests (Playwright)

- Config : `playwright.config.ts` — Chromium, `vite preview` sur `127.0.0.1:4173`
- Tests : `e2e/app.spec.ts` — 26 tests (navigation, thème, collection, decks, deck builder, partage, PWA, a11y, **table de jeu** : lobby→plateau, tutoriel, combat). Auth e2e via injection user Pinia + nav SPA ; build CI avec `VITE_SUPABASE_*` factices (sinon overlay « Configuration requise »)
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
