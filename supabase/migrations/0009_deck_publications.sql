-- =============================================================================
-- Wakfu Deck Builder — publications de decks par SNAPSHOT (v2 galerie)
-- =============================================================================
-- Remplace la publication « en direct » (decks.is_public + decks.publication,
-- migrations 0003/0005) par un SNAPSHOT découplé du deck de travail. Publier
-- fige une copie du deck ; éditer le deck de travail ne touche PLUS la galerie
-- tant que l'auteur ne « met à jour » (nouvel upsert). Un seul snapshot courant
-- par deck (unique deck_id). Pas d'historique multi-versions (retirer la
-- contrainte unique + ajouter `version` le jour venu).
--
-- Gains : (1) fin de la fuite « toute modif est instantanément publique » ;
-- (2) la publication quitte le chemin d'upsert de `decks` → plus aucune
-- dépendance à la préservation de colonnes ; (3) le snapshot porte cardId +
-- isReserve → réserve publiée et impressions exactes à l'import.
--
-- Lecture PUBLIQUE (galerie, anon inclus) ; écriture réservée au propriétaire
-- (RLS). Idempotent : rejouable sans danger. À appliquer dans le SQL Editor.
-- Les colonnes decks.is_public / decks.publication (0003/0005) deviennent
-- mortes ; laissées en place (aucune donnée en galerie) pour ne rien casser.
-- =============================================================================

create table if not exists public.deck_publications (
  id           uuid        primary key default gen_random_uuid(),
  deck_id      uuid        not null references public.decks (id)  on delete cascade,
  user_id      uuid        not null references auth.users (id)    on delete cascade,
  name         text        not null,
  hero_id      text,
  havre_sac_id text,
  -- Snapshot des cartes : [{ cardId, quantity, isReserve? }] — réserve incluse.
  cards        jsonb       not null default '[]'::jsonb,
  -- Fiche éditoriale (ex-decks.publication).
  source       text,
  tagline      text,
  guide        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Un seul snapshot courant par deck (re-publier = upsert, pas d'accumulation).
  unique (deck_id)
);

-- Galerie triée par fraîcheur.
create index if not exists deck_publications_recent_idx
  on public.deck_publications (updated_at desc);

alter table public.deck_publications enable row level security;

-- Lecture PUBLIQUE des decks publiés (galerie communautaire, anon inclus).
drop policy if exists "deck_publications_select_public" on public.deck_publications;
create policy "deck_publications_select_public" on public.deck_publications
  for select using (true);

-- Écriture strictement réservée au propriétaire.
drop policy if exists "deck_publications_insert_own" on public.deck_publications;
create policy "deck_publications_insert_own" on public.deck_publications
  for insert with check (auth.uid() = user_id);

drop policy if exists "deck_publications_update_own" on public.deck_publications;
create policy "deck_publications_update_own" on public.deck_publications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "deck_publications_delete_own" on public.deck_publications;
create policy "deck_publications_delete_own" on public.deck_publications
  for delete using (auth.uid() = user_id);

-- updated_at auto (réutilise public.set_updated_at de 0001_init.sql).
drop trigger if exists deck_publications_set_updated_at on public.deck_publications;
create trigger deck_publications_set_updated_at
  before update on public.deck_publications
  for each row execute function public.set_updated_at();
