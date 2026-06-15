-- =============================================================================
-- Wakfu Deck Builder — profils publics (v1)
-- =============================================================================
-- Un pseudo public par utilisateur : sert d'AUTEUR affiché sur les decks
-- publiés (galerie communautaire) et, plus tard, de nom en partie en ligne.
-- Lecture publique (afficher l'auteur, anon inclus) ; chacun n'écrit QUE le
-- sien. Idempotent : rejouable sans danger. À appliquer dans le SQL Editor.
-- =============================================================================

create table if not exists public.profiles (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  username   text        not null check (char_length(btrim(username)) between 2 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pseudo unique, insensible à la casse.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- Lecture PUBLIQUE des pseudos (affichage de l'auteur des decks publics).
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (true);

-- Chacun crée / met à jour SON profil uniquement.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at auto (réutilise public.set_updated_at de 0001_init.sql).
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
