# Wakfu Deck Builder

Application web (et desktop) de gestion de collection, de construction de decks
et de **jeu** pour le TCG **Wakfu**. Application **cloud** : inscription /
connexion et synchronisation des données (collection + decks) via **Supabase**,
accessibles depuis tous vos appareils. Configuration : voir
[DEPLOYMENT.md](DEPLOYMENT.md).

## 🚀 Fonctionnalités

### Collection & decks

- **🔐 Comptes cloud** : authentification Supabase (e-mail / mot de passe),
  confirmation d'e-mail gérée.
- **☁️ Synchronisation multi-appareils** : collection et decks stockés dans le
  cloud (source de vérité), avec cache local pour l'affichage immédiat et la
  lecture hors-ligne.
- **📚 Collection de cartes** : ~1585 cartes des 11 extensions, gestion des
  exemplaires normaux et foil, fiche détaillée (effets, mots-clés, notes /
  errata).
- **🃏 Atelier de deck** : filtres avancés (nom, extension, élément, type, coût…),
  zoom-avant-ajout, lecteur épinglé, validation des règles en direct, réserve
  (sideboard).
- **♻️ Interopérabilité des réimpressions** : la limite de copies est comptée par
  **carte canonique** (nom), toutes éditions confondues ; un sélecteur d'édition
  permet de permuter l'art sur chaque ligne de deck.
- **🔗 Partage de deck** : URL avec le deck encodé en base64 (aucun backend
  requis pour partager), page de deck partagé importable en un clic.
- **📖 Decks officiels** : parcours et import des decks starter par extension,
  plus les listes recensées des **Dofus Mag**.
- **🌐 Decks de la communauté** : publication d'un deck par snapshot (fiche
  éditoriale : catégorie, accroche, guide) et galerie publique.

### Table de jeu

- **🎲 Table de jeu** : moteur de règles _event-sourced_ permettant de jouer une
  partie (mise en place, combat, phases) — en **solo** (tutoriel et bac à sable)
  ou en **1 v 1 en ligne** (parties temps réel, serveur autoritatif via Edge
  Functions).
- **🎓 Tutoriels par mécanique** et **assistant de règles** (aperçu des dégâts,
  flèches d'attaque / blocage) pour apprendre à jouer.
- **⚙️ Automatisation des effets** : les effets de carte compilés se résolvent
  automatiquement en partie ; les effets non encore couverts sont affichés comme
  rappels manuels.

### Plateforme

- **📱 Interface responsive + PWA** : desktop et mobile, installation native,
  cache hors-ligne via Workbox.
- **🖥️ Desktop (Tauri)** : installeurs Windows `.exe` (NSIS) / `.msi` (Wix).
- **🎨 Interface moderne** : Tailwind CSS + DaisyUI, thèmes clair / sombre,
  accessibilité (skip-nav, labels ARIA, `lang="fr"`).

## 🧱 Stack technique

Vue 3 (`<script setup>` + Composition API) · TypeScript · Vite 6 · Pinia 3 ·
Tailwind CSS 3 + DaisyUI 4 · Supabase (auth + Postgres + Realtime + Edge
Functions) · Tauri 2 · Vitest + @vue/test-utils · Playwright (E2E) ·
vite-plugin-pwa (Workbox).

> Architecture détaillée, conventions de code et règles métier : voir
> [CLAUDE.md](CLAUDE.md).

## 📦 Installation rapide

1. **Cloner le projet**

   ```bash
   git clone <repository-url>
   cd wakfu_deck_builder
   ```

2. **Installer les dépendances**

   ```bash
   npm install
   ```

3. **Configurer Supabase** (requis) — copiez `.env.example` en `.env` et
   renseignez `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Voir
   [DEPLOYMENT.md](DEPLOYMENT.md) pour le pas-à-pas (projet + migrations SQL).

4. **Lancer en mode développement (Web)**

   ```bash
   npm run dev          # http://localhost:3000
   ```

5. **Lancer la version Desktop (Tauri)**

   ```bash
   npm run tauri:dev
   ```

## 🛠️ Commandes principales

| Commande              | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `npm run dev`         | Serveur de dev (port 3000)                               |
| `npm run build`       | Build production (~10 s, **ne type-check pas**)          |
| `npm run type-check`  | Vérif TypeScript (`vue-tsc`) — **le seul gate de types** |
| `npm run test:unit`   | Tests unitaires (Vitest / jsdom)                         |
| `npx vitest run`      | Tests unitaires en mode CI                               |
| `npm run test:e2e`    | Tests E2E Playwright (build + preview requis)            |
| `npm run lint`        | Linting ESLint                                           |
| `npm run tauri:build` | Installeurs desktop `.exe` / `.msi`                      |

## ⚖️ Règles du deck (validation)

- **Deck valide** : 1 Héros + 1 Havre-Sac + **exactement 48 cartes**.
- **Copies** : max **3** exemplaires par carte (**1** pour les cartes _Unique_),
  comptées par **carte canonique** (nom), toutes réimpressions confondues.
- **Réserve** : exactement **0 ou 12** cartes (règle officielle 101.4).
- **Aucun type minimum imposé** (pas d'Action / Allié obligatoire).

L'import (page `Decks` → `Importer`) et le partage appliquent ces mêmes règles,
avec erreurs et avertissements détaillés, et conservent la réserve.

## 💾 Données & persistance

- **Source de vérité : Supabase.** Collection et decks sont chargés depuis le
  cloud à la connexion et repoussés (différé, best-effort) à chaque modification.
- **Cache local (PWA)** : copie par utilisateur (clé `wakfu-*:<userId>`) pour
  l'affichage immédiat et la lecture hors-ligne ; le cloud reste prioritaire au
  rechargement.
- **Données de cartes** : `public/data/*.json` (une base par extension, servie
  statiquement) + images optimisées WebP / vignettes. Les effets sont **compilés**
  depuis ces JSON (`npm run compile-effects`) pour alimenter le moteur de jeu.

## 🖥️ Desktop & releases

Des installeurs Windows sont générés via Tauri :

```bash
npm run tauri:build   # .exe (NSIS) / .msi (Wix) dans src-tauri/target/release/bundle/
```

> Les exécutables signés localement peuvent être détectés par certains
> antivirus. Pour une distribution publique, la signature de code est
> recommandée.

**Publication automatique** : un workflow GitHub Actions publie une release avec
les binaires lors d'un tag `v*` :

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 🌐 Déploiement web (Vercel)

1. Connectez le repo GitHub à [Vercel](https://vercel.com).
2. Ajoutez les variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   (Production + Preview).
3. Déployez — Vercel détecte Vite via `vercel.json` (build `npm run build`,
   sortie `dist`, rewrites SPA pour vue-router).

Guide complet (Supabase + Vercel + migrations SQL) : **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## 🤝 Contribution

1. Fork le projet.
2. Créez une branche feature (`git checkout -b feature/AmazingFeature`).
3. Commit vos changements.
4. Push vers la branche.
5. Ouvrez une Pull Request.

## 🙏 Remerciements

- **Ankama** pour le jeu Wakfu TCG.
- L'équipe de [wtcg-return.fr](https://www.wtcg-return.fr/) pour leurs assets.
- La communauté **Wakfu TCG Return** sur Discord pour leur soutien.
