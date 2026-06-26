# Interopérabilité des réimpressions — Design

**Date** : 2026-06-26
**Statut** : validé (brainstorming)

## Problème

Une même carte du TCG Wakfu est réimprimée dans plusieurs extensions (ex. `Tofu`
dans Incarnam **et** Dofus Collection). Dans l'application, les IDs sont de la
forme `<slug>-<extension>` (`tofu-incarnam`, `tofu-dofus-collection`) et **la
collection comme les decks sont indexés par `card.id`**, donc par _impression_.

Conséquences mesurées sur les données (`public/data/*.json`, hors draft/community) :

- 1581 entrées de cartes, 1455 noms distincts.
- **119 noms réimprimés** dans ≥2 extensions.
- Comparaison gameplay des 119 : **88 strictement identiques** ; les 31
  « différences » restantes sont du **bruit de scraping** (encodage de
  guillemets, fautes OCR, lignes de _ruling_ comptées à tort comme effets).
  → **Aucune réimpression n'est une carte réellement différente.** Le **nom est
  une clé canonique fiable**.

Deux bugs en découlent :

1. **Règle des copies cassée** — `3× tofu-incarnam + 3× tofu-dofus-collection`
   = 6 Tofu, illégal (max 3 par carte) mais actuellement autorisé.
2. **Choix d'édition impossible** — on ne peut pas dire « je veux ce Tofu mais
   avec l'art d'Incarnam » tout en gardant l'interchangeabilité pour les règles.

## Périmètre

Décisions de cadrage prises avec l'utilisateur :

- **Inclus** : (1) règle des copies comptée par carte (nom) et non par
  impression ; (3) choix/permutation de l'édition d'une carte dans un deck.
- **Exclu** : (2) interopérabilité de la **collection / possession** — la
  collection reste indexée par `card.id` (par impression). Non concernée.
- **Affichage** : impressions **séparées** dans le pool (option 2), avec
  **compteur de copies partagé** et **permutation** possible.

## Insight central

Aujourd'hui `card.id` sert à la fois à :

- **compter les copies** pour la règle max-3 → doit devenir **canonique (nom)** ;
- **identifier une entrée** de deck (quelle ligne incrémenter / retirer /
  déplacer) → doit **rester par impression (`id`)**.

Le design sépare proprement ces deux usages. Conséquence visible :
`2× Tofu-Incarnam + 1× Tofu-Dofus` = **deux lignes distinctes** (deux arts) qui
**comptent comme 3 Tofu** ; toute 4ᵉ copie (n'importe quelle édition) est bloquée.

## Composants

### 1. Identité canonique — `src/utils/cardIdentity.ts` (nouveau)

```ts
/** Clé regroupant les impressions d'une même carte. Le nom normalisé suffit
 *  (vérifié : aucune réimpression de même nom n'est gameplay-distincte). */
export function canonicalKey(card: Card): string;
// = nom passé par fixSpecialCharacters, trim, lowercase.

/** Toutes les impressions chargées partageant la clé canonique de `card`. */
export function printingsOf(cards: Card[], card: Card): Card[];
```

- Réutilise `fixSpecialCharacters` (déjà dans `cardLoader`) — extraire si besoin
  vers un util partagé pour éviter une dépendance circulaire.
- Cartes « Unique » : max 1 (inchangé). Le mot-clé est cohérent entre
  impressions ; on garde `isUniqueCard(card)` tel quel.

### 2. Règle des copies partagée (besoin n°1)

Bascule du comptage de `card.id` vers `canonicalKey`, aux 5 emplacements de
**comptage** :

| Fichier                            | Emplacement                                                | Changement                           |
| ---------------------------------- | ---------------------------------------------------------- | ------------------------------------ |
| `src/validators/deck.ts`           | `getCardCopies` (filtre l. 47)                             | grouper par `canonicalKey`           |
| `src/validators/deck.ts`           | `validateCardCopies` (dédup `seen`, l. 128-129)            | dédup par `canonicalKey`             |
| `src/validators/deck.ts`           | `canAddCard`                                               | bénéficie du nouveau `getCardCopies` |
| `src/stores/deckStore.ts`          | `addCard` `totalCopies` (l. 511-513)                       | grouper par `canonicalKey`           |
| `src/components/deck/CardPool.vue` | `inDeckQty` / `canAddCard` / `addBlockReason` (l. 292-317) | compter par `canonicalKey`           |

**Restent par `id` (identité d'entrée, aucun changement)** :
`existingCard` (deckStore l. 521-523), `removeCard` (l. 549),
`moveCardZone` (l. 577, 593). On incrémente/retire/déplace l'impression précise,
pas le regroupement.

Le comptage inclut **déjà** la réserve (`getCardCopies` ne filtre pas
`isReserve`) → la limite partagée couvre automatiquement deck principal +
réserve, ce qui est correct (règle 101.5).

### 3. Permutation d'édition (besoin n°3)

- **`cardStore.printingsOf(card): Card[]`** — getter dérivé de l'index de cartes
  déjà construit (`cardIndex`). Retourne ≥1 impression.
- **`deckStore.setEntryEdition(cardId, isReserve, newPrintingId)`** — action :
  - localise l'entrée par `(card.id === cardId, !!isReserve)` ;
  - remplace `entry.card` par l'impression cible (passée par
    `prepareCardForDeck`), **quantité conservée** ;
  - si une entrée de l'édition cible existe déjà dans la **même zone**, **fusionne**
    les quantités (et supprime l'entrée source) ;
  - `updatedAt` + `saveDecks()`.
- **UI** : chip `Extension ▾` sur `DeckCardRow` et `ReserveRow`, **affiché
  uniquement si `printingsOf(card).length > 1`**. Clic → petit menu listant les
  éditions disponibles → `setEntryEdition`. Réutiliser le pattern de menu
  existant (Headless UI) du builder.

### 4. Pool

- Badge de compte et état désactivé (`canAddCard` / `addBlockReason`) basés sur
  le **compte canonique** → toutes les impressions d'un nom grisées **ensemble**
  dès la limite atteinte. Le message d'`addBlockReason` utilise déjà le nom.

## Hors périmètre (assumé, documenté)

- **Collection** : indexation par `card.id` **inchangée** (choix utilisateur).
- **Partage base64** (`utils/deckSharing`) : **inchangé** — encode l'impression
  concrète ; la limite canonique est re-vérifiée à l'import via `validateDeck`.
- **Modèle de données** `Deck` / `DeckCard` : **aucun changement**.
- **Moteur de jeu** (`src/game`) : non concerné (joue des impressions concrètes).

## Stratégie de test (TDD)

- **`cardIdentity`** (unitaire) : même nom / extensions ≠ → même clé ; noms ≠ →
  clés ≠ ; robustesse aux artefacts d'encodage.
- **`validators/deck`** : copies mixtes inter-éditions dépassant / respectant la
  limite ; partage deck principal + réserve ; carte Unique inter-éditions.
- **`stores/deckStore`** : `addCard` bloque la 4ᵉ copie toutes éditions
  confondues ; `setEntryEdition` permute en gardant la quantité et **fusionne**
  si l'édition cible existe déjà.
- **`CardPool`** : une impression à la limite désactive **toutes** les éditions
  du même nom (test de logique ou composant).
- **E2E** (optionnel) : ajouter deux éditions du même nom, vérifier le blocage et
  la permutation.

## Risques / points d'attention

- **Dépendance circulaire** : `cardIdentity` ne doit pas importer `cardLoader`
  si `cardLoader` venait à importer `cardIdentity`. Extraire `fixSpecialCharacters`
  vers un util neutre au besoin.
- **Cohérence du badge de compte** dans le pool : afficher le total canonique sur
  chaque impression (et non un compte par impression) est volontaire — c'est ce
  qui communique la limite partagée.
- **`isUniqueCard`** : si une seule impression portait par erreur le mot-clé
  Unique, le comptage canonique resterait correct (on borne par carte) ; pas de
  traitement spécial requis.
