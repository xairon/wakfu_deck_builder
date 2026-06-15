-- Wakfu Deck Builder — DEPLOIEMENT v1 (bloc SQL combine)
-- A coller dans Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> Run).
-- Prerequis : 0001_init.sql deja applique (l'appli fonctionne deja). Idempotent.

-- ============================================================
-- 0002_game.sql
-- ============================================================
-- =============================================================================
-- Wakfu Deck Builder â€” Module de jeu Â« La Table des Douze Â» (V1, lot L2)
-- =============================================================================
-- Tables d'une partie 1v1 en ligne, event-sourcÃ©e et Ã  serveur autoritatif.
-- RÃ©f. : docs/GAME-MODULE-V1.md Â§6, docs/CDC-MODULE-JEU-V1.md Â§7.
--
-- ModÃ¨le :
--   games          : une partie (code de salon, statut, siÃ¨ges, dernier seq).
--   game_players   : un siÃ¨ge (A/B) + le SNAPSHOT de deck figÃ© Ã  T0.
--   game_events    : le JOURNAL append-only (source de vÃ©ritÃ©, dÃ©rive l'Ã©tat).
--   game_secrets   : la masterSeed serveur (jamais exposÃ©e aux clients).
--
-- SÃ©curitÃ© (cf. Â§6.2) :
--   - game_events & game_secrets : AUCUN accÃ¨s client (RLS sans policy) â†’ seul
--     le rÃ´le service (Edge Function) les lit/Ã©crit. Les clients reÃ§oivent des
--     events REDACTÃ‰S via l'Edge Function / Realtime broadcast.
--   - game_players : chacun ne lit QUE sa propre ligne (deck adverse cachÃ©).
--   - L'Ã©criture autoritative passe par append_event() (atomicitÃ© + ordre).
-- Idempotent : rejouable sans danger.
-- =============================================================================

-- â”€â”€ Tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create table if not exists public.games (
  id               uuid        primary key default gen_random_uuid(),
  code             text        not null unique,             -- code de salon partageable
  status           text        not null default 'lobby'
                     check (status in ('lobby', 'active', 'finished', 'aborted')),
  seat_a           uuid        references auth.users (id) on delete set null,
  seat_b           uuid        references auth.users (id) on delete set null,
  first_player     text        check (first_player in ('A', 'B')),
  last_seq         integer     not null default 0,          -- dernier seq appliquÃ© (concurrence optimiste)
  master_seed_hash text,                                    -- engagement public (commit-reveal)
  winner           text        check (winner in ('A', 'B', 'draw')),
  end_reason       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.game_players (
  game_id    uuid        not null references public.games (id) on delete cascade,
  seat       text        not null check (seat in ('A', 'B')),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  deck       jsonb       not null,                          -- snapshot FIGÃ‰ Ã  T0
  ready      boolean     not null default false,
  joined_at  timestamptz not null default now(),
  primary key (game_id, seat)
);

create table if not exists public.game_events (
  game_id        uuid        not null references public.games (id) on delete cascade,
  seq            integer     not null,
  parent_seq     integer     not null,
  actor          text        not null check (actor in ('A', 'B', 'system')),
  type           text        not null,
  payload        jsonb       not null default '{}'::jsonb,  -- public + permutations (service only)
  payload_private jsonb,                                    -- fragments par siÃ¨ge { "A": {...}, "B": {...} }
  ts             timestamptz not null default now(),
  primary key (game_id, seq)
);

create table if not exists public.game_secrets (
  game_id     uuid primary key references public.games (id) on delete cascade,
  master_seed text not null                                 -- JAMAIS exposÃ© (service role uniquement)
);

create index if not exists games_code_idx on public.games (code);
create index if not exists games_status_idx on public.games (status);
create index if not exists game_events_game_idx on public.game_events (game_id, seq);
create index if not exists game_players_user_idx on public.game_players (user_id);

-- â”€â”€ Row Level Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_events enable row level security;
alter table public.game_secrets enable row level security;

-- games : lisible par tout utilisateur authentifiÃ© (mÃ©tadonnÃ©es de salon non
-- sensibles ; permet de rejoindre via code). Ã‰criture par Edge (service role).
drop policy if exists "games_select_auth" on public.games;
create policy "games_select_auth" on public.games
  for select using (auth.role() = 'authenticated');

-- game_players : on ne lit QUE sa propre ligne (le deck adverse reste cachÃ©).
drop policy if exists "game_players_select_own" on public.game_players;
create policy "game_players_select_own" on public.game_players
  for select using (auth.uid() = user_id);

-- game_events & game_secrets : aucune policy â†’ AUCUN accÃ¨s client.
-- (Le rÃ´le service utilisÃ© par l'Edge Function contourne la RLS.)

-- â”€â”€ Append atomique d'un event (ordre total + concurrence optimiste) â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- AppelÃ©e par l'Edge Function (service role) APRÃˆS calcul du coup autoritatif.

create or replace function public.append_event(
  p_game_id        uuid,
  p_parent_seq     integer,
  p_actor          text,
  p_type           text,
  p_payload        jsonb,
  p_payload_private jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last integer;
begin
  -- Verrou de ligne : sÃ©rialise les append concurrents sur la mÃªme partie.
  select last_seq into v_last from public.games where id = p_game_id for update;
  if v_last is null then
    raise exception 'GAME_NOT_FOUND';
  end if;
  if p_parent_seq <> v_last then
    raise exception 'OUT_OF_ORDER expected % got %', v_last, p_parent_seq;
  end if;

  insert into public.game_events (game_id, seq, parent_seq, actor, type, payload, payload_private)
    values (p_game_id, v_last + 1, p_parent_seq, p_actor, p_type, p_payload, p_payload_private);

  update public.games set last_seq = v_last + 1, updated_at = now() where id = p_game_id;
  return v_last + 1;
end;
$$;

-- â”€â”€ Triggers updated_at (rÃ©utilise public.set_updated_at de 0001_init.sql) â”€â”€â”€â”€

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

-- NB diffusion temps rÃ©el : les clients NE lisent PAS game_events (RLS).
-- L'Edge Function diffuse des events REDACTÃ‰S via Realtime *broadcast* (canal
-- `game:<id>`), et expose `pull_events` pour la reconstruction/reconnexion.
-- NB rÃ©tention : prÃ©voir un job (pg_cron) â€” lobbies > 2 h et parties zombies
-- > 24 h â†’ 'aborted' ; purge des 'finished'/'aborted' > 30 j (cf. CdC Â§7.5).


-- ============================================================
-- 0003_public_decks.sql
-- ============================================================
-- =============================================================================
-- Wakfu Deck Builder â€” galerie de decks publics (v1)
-- =============================================================================
-- Publication OPT-IN d'un deck via `decks.is_public`. Les decks publiÃ©s sont
-- lisibles par TOUS (galerie communautaire, anon inclus) ; l'Ã©criture reste
-- rÃ©servÃ©e au propriÃ©taire (policies de 0001_init.sql, inchangÃ©es).
-- Idempotent : rejouable sans danger.
-- Ã€ appliquer dans le SQL Editor (Dashboard â†’ SQL Editor â†’ coller â†’ Run),
-- ou via la CLI Supabase (db push).
-- =============================================================================

alter table public.decks
  add column if not exists is_public boolean not null default false;

-- Galerie triÃ©e par fraÃ®cheur ; index partiel sur les seuls decks publics.
create index if not exists decks_public_idx
  on public.decks (updated_at desc)
  where is_public;

-- Lecture PUBLIQUE des decks publiÃ©s (s'ajoute Ã  decks_select_own de 0001 :
-- un utilisateur voit ses decks privÃ©s + tous les decks publics). L'Ã©criture
-- (insert/update/delete) reste strictement rÃ©servÃ©e au propriÃ©taire.
drop policy if exists "decks_select_public" on public.decks;
create policy "decks_select_public" on public.decks
  for select using (is_public = true);


-- ============================================================
-- 0004_profiles.sql
-- ============================================================
-- =============================================================================
-- Wakfu Deck Builder â€” profils publics (v1)
-- =============================================================================
-- Un pseudo public par utilisateur : sert d'AUTEUR affichÃ© sur les decks
-- publiÃ©s (galerie communautaire) et, plus tard, de nom en partie en ligne.
-- Lecture publique (afficher l'auteur, anon inclus) ; chacun n'Ã©crit QUE le
-- sien. Idempotent : rejouable sans danger. Ã€ appliquer dans le SQL Editor.
-- =============================================================================

create table if not exists public.profiles (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  username   text        not null check (char_length(btrim(username)) between 2 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pseudo unique, insensible Ã  la casse.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- Lecture PUBLIQUE des pseudos (affichage de l'auteur des decks publics).
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (true);

-- Chacun crÃ©e / met Ã  jour SON profil uniquement.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at auto (rÃ©utilise public.set_updated_at de 0001_init.sql).
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ============================================================
-- 0005_deck_publication.sql
-- ============================================================
-- =============================================================================
-- Wakfu Deck Builder â€” fiche de publication d'un deck (v1)
-- =============================================================================
-- MÃ©tadonnÃ©es Ã©ditoriales d'un deck publiÃ© dans la galerie : catÃ©gorie/source,
-- accroche, et guide Â« comment jouer Â». Une seule colonne JSONB, extensible.
-- Lisible/Ã©crivable selon les policies de `decks` (0001 + 0003) : voyagent avec
-- la ligne, donc visibles sur les decks publics, modifiables par le proprio.
-- Idempotent. Ã€ appliquer dans le SQL Editor (avec 0002/0003/0004).
-- =============================================================================

alter table public.decks
  add column if not exists publication jsonb;
