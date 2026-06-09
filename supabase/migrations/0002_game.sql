-- =============================================================================
-- Wakfu Deck Builder — Module de jeu « La Table des Douze » (V1, lot L2)
-- =============================================================================
-- Tables d'une partie 1v1 en ligne, event-sourcée et à serveur autoritatif.
-- Réf. : docs/GAME-MODULE-V1.md §6, docs/CDC-MODULE-JEU-V1.md §7.
--
-- Modèle :
--   games          : une partie (code de salon, statut, sièges, dernier seq).
--   game_players   : un siège (A/B) + le SNAPSHOT de deck figé à T0.
--   game_events    : le JOURNAL append-only (source de vérité, dérive l'état).
--   game_secrets   : la masterSeed serveur (jamais exposée aux clients).
--
-- Sécurité (cf. §6.2) :
--   - game_events & game_secrets : AUCUN accès client (RLS sans policy) → seul
--     le rôle service (Edge Function) les lit/écrit. Les clients reçoivent des
--     events REDACTÉS via l'Edge Function / Realtime broadcast.
--   - game_players : chacun ne lit QUE sa propre ligne (deck adverse caché).
--   - L'écriture autoritative passe par append_event() (atomicité + ordre).
-- Idempotent : rejouable sans danger.
-- =============================================================================

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists public.games (
  id               uuid        primary key default gen_random_uuid(),
  code             text        not null unique,             -- code de salon partageable
  status           text        not null default 'lobby'
                     check (status in ('lobby', 'active', 'finished', 'aborted')),
  seat_a           uuid        references auth.users (id) on delete set null,
  seat_b           uuid        references auth.users (id) on delete set null,
  first_player     text        check (first_player in ('A', 'B')),
  last_seq         integer     not null default 0,          -- dernier seq appliqué (concurrence optimiste)
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
  deck       jsonb       not null,                          -- snapshot FIGÉ à T0
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
  payload_private jsonb,                                    -- fragments par siège { "A": {...}, "B": {...} }
  ts             timestamptz not null default now(),
  primary key (game_id, seq)
);

create table if not exists public.game_secrets (
  game_id     uuid primary key references public.games (id) on delete cascade,
  master_seed text not null                                 -- JAMAIS exposé (service role uniquement)
);

create index if not exists games_code_idx on public.games (code);
create index if not exists games_status_idx on public.games (status);
create index if not exists game_events_game_idx on public.game_events (game_id, seq);
create index if not exists game_players_user_idx on public.game_players (user_id);

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_events enable row level security;
alter table public.game_secrets enable row level security;

-- games : lisible par tout utilisateur authentifié (métadonnées de salon non
-- sensibles ; permet de rejoindre via code). Écriture par Edge (service role).
drop policy if exists "games_select_auth" on public.games;
create policy "games_select_auth" on public.games
  for select using (auth.role() = 'authenticated');

-- game_players : on ne lit QUE sa propre ligne (le deck adverse reste caché).
drop policy if exists "game_players_select_own" on public.game_players;
create policy "game_players_select_own" on public.game_players
  for select using (auth.uid() = user_id);

-- game_events & game_secrets : aucune policy → AUCUN accès client.
-- (Le rôle service utilisé par l'Edge Function contourne la RLS.)

-- ── Append atomique d'un event (ordre total + concurrence optimiste) ─────────
-- Appelée par l'Edge Function (service role) APRÈS calcul du coup autoritatif.

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
  -- Verrou de ligne : sérialise les append concurrents sur la même partie.
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

-- ── Triggers updated_at (réutilise public.set_updated_at de 0001_init.sql) ────

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

-- NB diffusion temps réel : les clients NE lisent PAS game_events (RLS).
-- L'Edge Function diffuse des events REDACTÉS via Realtime *broadcast* (canal
-- `game:<id>`), et expose `pull_events` pour la reconstruction/reconnexion.
-- NB rétention : prévoir un job (pg_cron) — lobbies > 2 h et parties zombies
-- > 24 h → 'aborted' ; purge des 'finished'/'aborted' > 30 j (cf. CdC §7.5).
