# Page dédiée par deck officiel — Design

**Date:** 2026-06-25
**Statut:** Design validé (« go » utilisateur)
**Branche:** `feat/official-deck-page`

## Problème

Sur `/decks/official`, on ne voit presque rien d'un deck (panneau « Détails »
inline minuscule). On veut **cliquer sur un deck → page dédiée à jolie UI**
montrant **tous les champs** (description, lore, conseil de jeu, cartes
maîtresses, méta…) et les **cartes du deck en images**.

## Décisions (validées)

1. **Portée** : tous les decks officiels (starters + Dofus Mag). La page
   s'adapte : champs riches affichés quand présents ; starters = héros + cartes.
2. **Cartes** : **grille de vignettes** (images) groupées par catégorie **+
   bascule vers liste** compacte.
3. **Route dédiée** `/decks/official/:id` (deep-link partageable), pas un modal.

## Architecture

### Route

`/decks/official/:id`, `meta: { guest: true }`, lazy `OfficialDeckDetailView.vue`.
Le `:id` = `OfficialDeck.id`. Id inconnu → message « deck introuvable » + retour.

### Fichiers

| Fichier                                            | Rôle                                                                                                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/data/allOfficialDecks.ts` (créer)             | `ALL_OFFICIAL_DECKS = [...OFFICIAL_DECKS, ...DOFUS_MAG_DECKS]` + `getOfficialDeckById(id)`. Source unique, supprime la fusion dupliquée.                                                                                                         |
| `src/composables/useOfficialDeckImport.ts` (créer) | Extrait la logique d'import (~80 l.) de `OfficialDecksView` (résolution cartes + `buildAndAddDeck` + toasts) pour réemploi par les 2 vues. Comportement inchangé.                                                                                |
| `src/views/OfficialDeckDetailView.vue` (créer)     | La page.                                                                                                                                                                                                                                         |
| `src/components/deck/DeckCardGrid.vue` (créer)     | Bloc cartes : résout chaque `deck.cards` (nom → `Card` via `findCardByName`), groupe par `section` imprimée (repli `mainType`), rend **grille de vignettes ×N** + **bascule grille/liste**, survol-zoom via `CardHoverPreview`/`useCardPreview`. |
| `src/views/OfficialDecksView.vue` (modifier)       | Carte + bouton « Voir le deck » → lien vers la page ; retire le panneau expand inline ; consomme le sélecteur partagé + le composable d'import.                                                                                                  |
| `src/router/index.ts` (modifier)                   | Ajouter la route.                                                                                                                                                                                                                                |

### Mise en page (OfficialDeckDetailView)

1. **Bandeau héros** : illustration héros (grande), nom du deck, puce d'extension,
   alignement, havre-sac, badge `⚠ Incohérence magazine` si `formatNote`, bouton
   **Importer**.
2. **Récit** : Présentation (`lore`), Comment le jouer (`howToPlay`), Cartes
   maîtresses (`keyCards`), illustrateur · n° de mag — réutilise le contenu de
   `DeckMagMeta` (DRY), avec plus d'espace.
3. **Cartes** : `DeckCardGrid` — vignettes par catégorie + compteurs, bascule
   liste compacte, survol-zoom.

### Flux de données

`cardStore.initialize()` au montage (résoudre noms→images). Résolution des
`deck.cards` une fois en `{ card, quantity, section }[]`, groupée par catégorie.
Carte non résolue → tuile placeholder (défensif ; 0 actuellement). Résolution
d'extension : `EXTENSION_NAME_BY_SLUG` (incarnam/bonta-brakmar pinné ; dofus-mag
non pinné — déjà le comportement existant).

### Images

`/images/cards/<id>.webp` ; vignettes via `getThumbPath` ; survol-zoom rend la
carte pleine. Repli `onerror` → dos de carte (`/images/card-back.webp`).

## Gestion d'erreurs / cas limites

- **Id inconnu** → écran « Deck introuvable » + lien retour `/decks/official`.
- **cardStore non prêt** → état de chargement le temps de l'init.
- **Nom de carte non résolu** → tuile placeholder nommée (pas de crash).
- **Deck à incohérence magazine** → badge + le compte de cartes peut être ≠ 48
  (assumé, format historique).

## Tests

- `DeckCardGrid.spec.ts` : groupement par section, bascule grille↔liste, badge
  quantité, déclenchement du survol (mock `useCardPreview`).
- `allOfficialDecks.spec.ts` : `getOfficialDeckById` (trouve / undefined).
- Vue vérifiée en **preview** (rendu réel) + e2e existant `/decks/official`.

## Hors périmètre (YAGNI)

- Pas de stats/graphes de deck, pas de simulateur de pioche, pas d'édition.
- Page lecture/vitrine + import uniquement.
