# Données & pipeline — L'Almanach des Douze

Format standard pour les cartes, illustrations, erratas et decks externes, et
pipeline pour les (re)produire. Objectif : **tout stocker proprement**, de
façon traçable et réutilisable.

## 1. Vue d'ensemble

```
public/data/
  <extension>.json        # bases de cartes (1 tableau de cartes / extension)
  errata.json             # erratas indexés par id de carte
  community-decks.json    # decks de sources externes (Dofus Mag, tournois…)
public/images/
  cards/<id>.png          # carte complète (cadre + art + texte)
  cards/<id>_recto.png    # héros — face portrait
  illustrations/<id>.webp # ART SEUL, recadré (généré)  ← NOUVEAU
schemas/
  card.schema.json        # format canonique d'une carte
  errata.schema.json      # format des erratas
  deck-source.schema.json # format des decks externes
```

Chaque carte a un **id stable** (slug : `<nom-slug>-<extension>`), qui relie
données ↔ image ↔ illustration ↔ errata ↔ collection (Supabase).

## 2. Schéma des cartes — `schemas/card.schema.json`

Champs requis : `id`, `name`, `mainType`, `rarity`, `extension`.
Champs riches déjà présents : `subTypes`, `stats` (niveau/force/pa/pm/pv),
`effects[]`, `keywords[]`, `artists[]`, `flavor`, `extension.number` (n° de
collection), `extension.shortUrl` (source).
Deux champs **ajoutés** :

- `illustration` — chemin de l'art recadré (`/images/illustrations/<id>.webp`).
- `errata[]` — corrections appliquées (voir §4).

La source de vérité des types reste `src/types/cards.ts` ; ce schéma en est le
miroir validable (CI / scripts).

## 3. Illustrations — `npm run extract-illustrations` ✅ FAIT

`scripts/extractIllustrations.ts` recadre la **bande d'illustration** de chaque
carte (les cartes Wakfu ont une mise en page constante : nom en haut ~0-13 %,
art ~14-58 %, texte en bas) et l'enregistre en WebP.

- Cartes classiques : bande pleine largeur.
- Héros (`_recto`) : recadrage resserré à droite (exclut la colonne de stats).
- **1584 illustrations générées** dans `public/images/illustrations/`.

Helper : `getIllustrationPath(id)` (`src/utils/imagePaths.ts`). Réutilisable
pour bannières de deck, en-têtes de héros, cartes de partage, etc.

## 4. Erratas — `public/data/errata.json`

Indexés par id de carte ; chaque entrée : `date`, `source`, `summary`,
`before?`, `after?`, `url?`. Le fichier est vide pour l'instant (prêt à
remplir). Affichage prévu dans la fiche carte (`CardZoomModal`) quand une carte
a des erratas.

Alimentation : manuelle (FAQ Ankama) ou via un futur `scripts/scrapeErrata.ts`
quand une source structurée est identifiée.

## 5. Decks externes — `schemas/deck-source.schema.json`

Bibliothèque de decks tiers (Dofus Mag, tournois, communauté) dans
`public/data/community-decks.json`. Chaque deck : `source`
(`Dofus Mag` | `Tournoi` | `Communauté` | `Créateur`), `author`, `event`,
`date`, `rank`, `sourceUrl`, et une liste `cards[]` (nom + quantité) résolue par
le **parseur d'import existant** (`deckStore.findCardByName`).

UI cible : la page « Decks officiels » devient une **bibliothèque de decks**
avec des onglets par source (Officiels · Dofus Mag · Tournois · Communauté),
mêmes rangées-planches, même bouton « Importer dans mes decks ».

## 6. Re-scraping (rafraîchir depuis la source)

La source est `wtcg-return.fr` (`extension.shortUrl` par carte). Pipeline
existant : `download-pages` → `parse-cards` (→ `<extension>.json`) +
`download-images`. Pour un rafraîchissement propre :

1. `npm run download-pages` — récupère les pages source.
2. `npm run parse-cards` — régénère les JSON (valider contre `card.schema.json`).
3. `npm run download-images` — complète les images manquantes.
4. `npm run extract-illustrations` — régénère les illustrations.
5. (futur) `scrapeErrata` — met à jour `errata.json`.
6. `npm run validate-data` — valide tout contre les schémas (script à ajouter).

## 7. Commandes

| Commande                        | Effet                                         |
| ------------------------------- | --------------------------------------------- |
| `npm run extract-illustrations` | (Re)génère les illustrations recadrées        |
| `npm run parse-cards`           | Régénère les bases de cartes depuis les pages |
| `npm run download-images`       | Télécharge les images manquantes              |
| `npm run validate-data`         | _(à ajouter)_ valide données ↔ schémas       |

## 8. Reste à faire

- [ ] Brancher l'affichage des erratas dans `CardZoomModal`.
- [ ] Charger `community-decks.json` + onglets de source sur la page decks.
- [ ] Seeder quelques decks Dofus Mag / tournoi réels.
- [ ] `scripts/validateData.ts` (validation schémas en CI).
- [ ] (option) brancher les illustrations sur les bannières de deck.
