-- =============================================================================
-- Wakfu Deck Builder — schéma initial Supabase (mode cloud)
-- =============================================================================
-- À exécuter une fois dans le SQL Editor de votre projet Supabase
-- (Dashboard → SQL Editor → New query → coller → Run), ou via la CLI Supabase.
--
-- Crée les tables `collections` et `decks` attendues par `src/services/cloudSync.ts`,
-- active la Row Level Security (RLS) et restreint chaque ligne à son propriétaire.
-- Idempotent : peut être rejoué sans danger.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: collections  (une ligne par carte possédée et par utilisateur)
-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  user_id         uuid        not null references auth.users (id) on delete cascade,
  card_id         text        not null,
  normal_quantity integer     not null default 0 check (normal_quantity >= 0),
  foil_quantity   integer     not null default 0 check (foil_quantity   >= 0),
  updated_at      timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- ---------------------------------------------------------------------------
-- Table: decks
-- ---------------------------------------------------------------------------
create table if not exists public.decks (
  -- id généré côté client (deckStore.generateId) : type text, scopé par utilisateur.
  id           text        not null,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  name         text        not null default 'Nouveau deck',
  hero_id      text,
  havre_sac_id text,
  cards        jsonb       not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- PK (user_id, id) : ids uniques PAR utilisateur (pas de collision/DoS
  -- inter-comptes) et compatible avec l'upsert onConflict "id,user_id".
  primary key (user_id, id)
);

create index if not exists decks_user_id_idx on public.decks (user_id);
create index if not exists collections_user_id_idx on public.collections (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security : chacun ne voit/écrit que ses propres données
-- ---------------------------------------------------------------------------
alter table public.collections enable row level security;
alter table public.decks       enable row level security;

-- collections
drop policy if exists "collections_select_own" on public.collections;
create policy "collections_select_own" on public.collections
  for select using (auth.uid() = user_id);

drop policy if exists "collections_insert_own" on public.collections;
create policy "collections_insert_own" on public.collections
  for insert with check (auth.uid() = user_id);

drop policy if exists "collections_update_own" on public.collections;
create policy "collections_update_own" on public.collections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_delete_own" on public.collections
  for delete using (auth.uid() = user_id);

-- decks
drop policy if exists "decks_select_own" on public.decks;
create policy "decks_select_own" on public.decks
  for select using (auth.uid() = user_id);

drop policy if exists "decks_insert_own" on public.decks;
create policy "decks_insert_own" on public.decks
  for insert with check (auth.uid() = user_id);

drop policy if exists "decks_update_own" on public.decks;
create policy "decks_update_own" on public.decks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "decks_delete_own" on public.decks;
create policy "decks_delete_own" on public.decks
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Trigger: maintient updated_at à jour automatiquement
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

drop trigger if exists decks_set_updated_at on public.decks;
create trigger decks_set_updated_at
  before update on public.decks
  for each row execute function public.set_updated_at();
