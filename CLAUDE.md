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
- **Tests**: Vitest 3 + @vue/test-utils (jsdom) — ~424 tests unitaires, 13 fichiers
- **E2E**: Playwright + Chromium — 23 tests (navigation, collection, deck builder, PWA, a11y)
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
├── parser/         # Parsing des données de cartes
├── router/         # Vue Router (routes lazy-loadées, guards auth)
├── server/         # Serveur Express (dev uniquement)
├── services/       # Logique métier (cardLoader, localStorage, supabase, cloudSync...)
├── stores/         # Stores Pinia (cardStore, deckStore, authStore, sync)
├── types/          # Types TypeScript canoniques (cards.ts = source unique)
├── utils/          # Utilitaires (errors, logger, performance, imagePaths, deckSharing)
├── validators/     # Validation (règles de deck)
└── views/          # Pages (Home, Collection, DeckBuilder, Cards, Decks, Auth, SharedDeck, OfficialDecks)
```

## Commandes

- `npm run dev` — Serveur de dev (port 3000)
- `npm run build` — Build production (~4.5s)
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
- **Limite de copies** : max 3 exemplaires par carte, 1 pour les cartes "Unique"
- **Réserve** : max 12 cartes
- **Types requis** : au moins un Action ou Allié
- **Éléments** : Air, Eau, Feu, Terre, Neutre
- **Extensions** : Amakna, Ankama Convention 5, Astrub, Bonta-Brakmar, Chaos d'Ogrest, DOFUS Collection, Draft, Île des Wabbits, Incarnam, Otomaï, Pandala
- **~2800+ cartes uniques**, ~1611 images

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

- **Partage de deck** : URL avec deck encodé en base64 (`/deck/share?deck=...`)
- **Decks officiels** : Page de parcours et import de decks starter par extension (`/decks/official`)
- **PWA** : Installation native, cache offline via Workbox, prompt d'installation
- **Optimisation d'images** : Pipeline WebP + thumbnails via sharp (`scripts/optimizeImages.ts`)
- **Accessibilité** : Skip nav, labels ARIA, `lang="fr"`, meta descriptions, contraste thèmes

## CI/CD

- GitHub Actions CI : lint + tests + build sur push/PR (`.github/workflows/ci.yml`)
- GitHub Actions Release : automatique sur tag `v*` (Windows, Node 20, Rust)
- Génère des installeurs .exe (NSIS) et .msi (Wix) via Tauri
- Vercel : déploiement web SPA (`vercel.json` configuré)

## E2E Tests (Playwright)

- Config : `playwright.config.ts` — Chromium, `vite preview` sur port 4173
- Tests : `e2e/app.spec.ts` — 23 tests couvrant navigation, thème, collection, decks, deck builder, partage, PWA, accessibilité
- Lancer : `npm run build && npm run test:e2e`

## Aliases

- `@` → `src/`
- `~` → racine du projet
- `test` → `tests/`
- `@images` → `public/images/`
- `@data` → `public/data/`

## Tests

- **Setup global** : `tests/setup.ts` (mocks localStorage, fetch, ResizeObserver, IntersectionObserver)
- **Factories** : `tests/factories/card.ts` — `createMockAllyCard()`, `createMockActionCard()`, `createMockHeroCard()`, `createMockHavreSacCard()`, `createMockEquipmentCard()`, `createMockDeck()`
- **Descriptions en français** : `it('devrait ...')` pattern
- **Tests désactivés** : 7 fichiers `.spec.ts.disabled` dans `src/components/__tests__/`
