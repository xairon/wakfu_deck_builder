-- =============================================================================
-- Wakfu Deck Builder — table `deck_shares` (partages de decks avec lien court)
-- =============================================================================
-- Permet de partager un deck via un code court (ex: 6 à 8 caractères).
-- Lecture PUBLIQUE (anon inclus) pour que n'importe qui (ou le crawler Discord)
-- puisse charger le deck partagé sans être connecté.
-- Création ouverte à tout utilisateur connecté ou anonyme.
--
-- Colonnes :
--   id           text primary key (code court, ex: 8 chars alphanumériques)
--   name         text not null
--   hero_id      text
--   havre_sac_id text
--   cards        jsonb not null default '[]'::jsonb  -- [{ cardId, quantity, isReserve? }]
--   created_at   timestamptz not null default now()
-- =============================================================================

create table if not exists public.deck_shares (
  id           text primary key,
  name         text not null,
  hero_id      text,
  havre_sac_id text,
  cards        jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

-- Index pour nettoyer d'éventuels vieux partages ou trier
create index if not exists deck_shares_created_idx
  on public.deck_shares (created_at desc);

alter table public.deck_shares enable row level security;

-- Lecture PUBLIQUE : n'importe qui avec le code peut voir le deck (anon inclus).
drop policy if exists "deck_shares_select_public" on public.deck_shares;
create policy "deck_shares_select_public" on public.deck_shares
  for select using (true);

-- Insertion PUBLIQUE : tout utilisateur (connecté ou non) peut générer un lien de partage court.
drop policy if exists "deck_shares_insert_public" on public.deck_shares;
create policy "deck_shares_insert_public" on public.deck_shares
  for insert with check (true);

-- Lecture PUBLIQUE des cartes pour anon (permet la consultation de cartes partagées sans être loggé)
drop policy if exists "cards_read" on public.cards;
create policy "cards_read" on public.cards
  for select using (true);

