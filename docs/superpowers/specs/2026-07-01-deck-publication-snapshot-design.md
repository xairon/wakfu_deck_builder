# Publication de deck par snapshot découplé

**Date** : 2026-07-01
**Statut** : approuvé (design)

## Problème

La publication d'un deck dans la galerie communautaire pose aujourd'hui `is_public` +
`publication` **directement sur la ligne du deck de travail** (`decks`). La galerie lit
cette même ligne en direct (`loadPublicDecks`). Conséquences :

1. **Fuite en direct** : toute modification du deck de travail est instantanément
   publique — même à moitié finie, même invalide.
2. **Fragilité #1** : `deckToCloud` n'inclut pas `is_public` / `publication`, or chaque
   édition fait un `upsert` de tous les decks. Ça ne dé-publie pas _aujourd'hui_ seulement
   parce que PostgREST préserve les colonnes absentes du payload sur conflit — comportement
   implicite qu'un refactor casserait silencieusement.
3. **Réserve perdue (#2)** : galerie et import filtrent `!isReserve` ; les 12 cartes de
   réserve ne sont ni publiées ni importées.
4. **Aucun garde-fou de validité (#3)** : on peut publier un deck incomplet.
5. **Import par nom (#4)** : les impressions/éditions exactes sont perdues à l'import.

Décision de versionnement (retenue) : **snapshot, une seule version courante**. Publier fige
une copie ; éditer le deck de travail ne touche pas la galerie tant qu'on ne « Met à jour ».
Pas d'historique multi-versions (YAGNI — galerie vide), mais le modèle est prêt à l'accueillir.

## Modèle de données

Nouvelle migration `supabase/migrations/0009_deck_publications.sql`. Table dédiée qui
**sort la publication du chemin d'upsert de `decks`** :

```sql
create table if not exists public.deck_publications (
  id           uuid primary key default gen_random_uuid(),
  deck_id      uuid not null references public.decks (id) on delete cascade,
  user_id      uuid not null references auth.users (id)   on delete cascade,
  name         text not null,
  hero_id      text,
  havre_sac_id text,
  cards        jsonb not null,          -- [{cardId, quantity, isReserve?}] — inclut la réserve
  source       text,
  tagline      text,
  guide        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (deck_id)                       -- un seul snapshot courant par deck
);
```

- **RLS** (miroir de `profiles`/`decks`) : `select using (true)` (galerie anon-lisible) ;
  `insert/update/delete` gardés par `auth.uid() = user_id`.
- Index partiel `deck_publications (updated_at desc)` pour le tri galerie.
- Trigger `set_updated_at` réutilisé.
- `decks.is_public` / `decks.publication` deviennent **morts** : laissés en place (galerie
  vide → aucun risque de migration), mais plus aucun code ne les lit ni les écrit.

**Ce que ça règle** : la fragilité #1 disparaît par construction (la publication n'est plus
jamais dans le payload `deckToCloud`) ; éditer un deck ne peut plus le dé-publier ni fuiter ;
le snapshot porte `cardId` + `isReserve` → réserve publiée (#2) et impressions exactes (#4).

## Types & services

### `src/services/publicDeckService.ts` (réécrit)

```ts
export interface PublishedDeck {          // = une ligne deck_publications
  id: string; deck_id: string; user_id: string;
  name: string; hero_id: string | null; havre_sac_id: string | null;
  cards: Array<{ cardId: string; quantity: number; isReserve?: boolean }>;
  source: string | null; tagline: string | null; guide: string | null;
  created_at: string; updated_at: string;
}

// Snapshot du deck de travail + upsert (publier ou mettre à jour).
publishDeck(deck: Deck, publication: DeckPublication): Promise<boolean>
// Retirer de la galerie (delete de la ligne).
unpublishDeck(deckId: string): Promise<boolean>
// Publication existante de MON deck (état du bouton + comparaison).
getMyPublication(deckId: string): Promise<PublishedDeck | null>
// Galerie (déjà existant, lit deck_publications, tri updated_at desc).
loadPublicDecks(limit?: number): Promise<PublishedDeck[]>
```

`publishDeck` construit le snapshot depuis `deck.cards` (via `deckToCloud`-like : `cardId`,
`quantity`, `isReserve`) et upsert sur `onConflict: "deck_id"`.

### Garde-fou de validité (#3)

`DeckDetailView.submitPublish(true)` refuse si `!validateDeck(deck).isValid` (blocage dur,
toast d'erreur explicite). Le bouton « Publier/Mettre à jour » du modal est `:disabled` si
le deck est invalide, avec un message « Deck incomplet — complète-le pour publier ».

## UX « modifications en attente »

`DeckDetailView` charge `getMyPublication(deckId)` au montage. Un hash stable du snapshot
(nom + héros + havre-sac + cartes triées avec `isReserve`) compare travail ↔ publié :

- non publié → bouton **« Publier »**
- publié, identique → **« Publié ✓ — gérer »**
- publié, différent → **« Mettre à jour · modifs en attente »** (accent visuel)

Utilitaire pur `publicationSnapshotHash(deckLike)` testable en isolation, partagé entre le
snapshot local et la ligne distante.

## Galerie & import

- `loadPublicDecks` lit `deck_publications` ; `CommunityDecksView.publicToSourced` mappe une
  `PublishedDeck` → `SourcedDeck` (auteur via `getUsernames`, réserve **incluse**).
- Import des decks publiés **par `cardId`** : nouveau `SourcedDeck.cardIds?` (optionnel) porté
  par les publications ; `deckStore.importDeck` (ou un chemin `importPublishedDeck`) résout par
  id quand disponible, sinon repli par nom (decks curatés `community-decks.json` inchangés).
  La réserve est restaurée (`isReserve`).

## Hors périmètre

- Historique multi-versions (voir anciennes versions) : table prête (`unique(deck_id)` +
  futur `version`), non implémenté.
- Modération / signalement.

## Tests

- `publishDeck` : upsert correct, snapshot inclut la réserve.
- `unpublishDeck` : delete.
- `publicationSnapshotHash` : stable, insensible à l'ordre des cartes, sensible à qté/réserve.
- Garde-fou validité : publication refusée sur deck invalide.
- `publicToSourced` : réserve incluse, auteur résolu, `cardIds` portés.
- Import par id restaure impressions + réserve.
- Non-régression : `cloudToDeck` inchangé ; `npm run type-check` + `npx vitest run` verts.
