# Refonte de la landing (HomeView) — Design

**Date:** 2026-06-25
**Statut:** Design validé (« go » utilisateur)
**Branche:** `feat/home-redesign`

## Problème

La landing actuelle (`HomeView.vue`) est datée et fausse :

- **Chiffres erronés/vides** : les stats sont centrées utilisateur (Possédées /
  Decks / Prêts) et affichent « — » hors connexion ; le total cartes n'est jamais
  chargé (la vue n'initialise pas le `cardStore`).
- **Icônes d'éléments fausses** : la légende utilise de simples carrés de couleur
  alors qu'un composant `ElementIcon` (+ vraies icônes `ressource-*.png` pour les
  5 éléments) existe déjà et n'est pas utilisé.
- **Ton « grimoire/almanach » médiéval** trop appuyé, perçu comme vieux.
- Ne **montre pas** le contenu réel (les 73 decks officiels, le catalogue, la
  table de jeu).

## Décisions (validées)

1. **Direction** : refonte vibrante « univers Wakfu » (art de cartes, couleurs
   élémentaires, vraies icônes), moderne. On garde le nom **« L'Almanach des
   Douze »** mais traité de façon vibrante.
2. **Audience** : **adaptatif** — vitrine soignée (non connecté) ET tableau de
   bord (connecté).

## Données réelles (live, exactes)

Calculées au runtime (le `cardStore` est initialisé au montage) :

- **Cartes** : `cardStore.totalCards` (~1485).
- **Extensions** : nombre de `extension.name` distincts parmi `cardStore.cards`
  (~10) — vraies extensions de cartes (≠ catégories de decks).
- **Decks officiels** : `ALL_OFFICIAL_DECKS.length` (73).
- **Éléments** : 5.
- **Perso (si connecté)** : possédées, decks, decks prêts (48 cartes) — depuis
  les stores.

## Architecture

### Sections (haut → bas)

1. **Hero (adaptatif, vibrant)**
   - _Déconnecté_ : titre accrocheur + proposition de valeur, CTA principal
     (Créer un compte / Essayer la table), secondaire (Parcourir les cartes).
     Visuel : composition de **planches d'art de héros** (`.plate-frame`, épines
     colorées par élément) + rangée des **5 vraies icônes d'élément**
     (`<ElementIcon>`).
   - _Connecté_ : « Content de vous revoir » + actions rapides (Ma collection ·
     Mes decks · Ouvrir la table) + mini-stats perso.
2. **Barre de stats (réelles, live)** : `Cartes · Extensions · Decks officiels ·
Éléments`. Connecté : ajoute les stats perso.
3. **Les 5 Éléments** (`ElementShowcase`) : `<ElementIcon>` + nom + couleur
   thématique (`el-air`…) pour Air/Eau/Feu/Terre/Neutre.
4. **Ce que fait l'app** : cartes de features vibrantes — Catalogue · Atelier de
   deck (règles vérifiées) · Table de jeu (jouable sans tout connaître +
   tutoriel) · Decks officiels. Chaque carte : icône + CTA → route.
5. **Decks officiels en vedette** (`FeaturedDecks`) : ~6 decks curatés (art du
   héros + nom) → liens vers `/decks/official/:id` (pages détail existantes).
6. **CTA final** : bandeau « Commencer ».

### Fichiers

| Fichier                                           | Rôle                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/views/HomeView.vue` (réécrire)               | Orchestration adaptative (connecté/déconnecté) + sections hero/features/CTA.   |
| `src/components/home/ElementShowcase.vue` (créer) | Les 5 éléments via `<ElementIcon>` + couleurs.                                 |
| `src/components/home/FeaturedDecks.vue` (créer)   | Decks en vedette → liens vers pages détail. Résout l'art du héros.             |
| `src/components/home/HomeStatsBar.vue` (créer)    | Barre de stats (props: chiffres).                                              |
| `src/utils/homeStats.ts` (créer)                  | Helpers purs : `distinctExtensionCount(cards)`, `pickFeaturedDecks(decks, n)`. |

### Flux de données

`cardStore.initialize()` au montage (résout art + total). Stats live calculées
par computed. `pickFeaturedDecks` choisit N decks ayant un héros résolvable
(art dispo). Repli image `onerror` → `card-back.webp`.

## Gestion d'erreurs / cas limites

- **cardStore non initialisé** : stats affichent un repli (« … ») le temps de
  l'init ; les sections statiques (features, éléments) s'affichent quand même.
- **Art de héros manquant** (deck en vedette) : repli dos de carte.
- **Élément non reconnu** : `ElementIcon`/`useElements` retombe sur Neutre.

## Tests

- `homeStats.spec.ts` : `distinctExtensionCount`, `pickFeaturedDecks`
  (n, héros résolvable, déterminisme).
- `ElementShowcase.spec.ts` : rend 5 `ElementIcon`.
- `FeaturedDecks.spec.ts` : rend N liens vers `/decks/official/:id`.
- Vue vérifiée en **preview** (connecté & déconnecté, responsive, clair/sombre).
- Skill **frontend-design** pour la finition visuelle.

## Hors périmètre (YAGNI)

- Pas de blog/news, pas de témoignages/preuve sociale factice, pas d'animations
  au-delà de hover/fade discrets. On garde l'encart « Premiers pas » (onboarding
  première visite) intégré au hero déconnecté.
