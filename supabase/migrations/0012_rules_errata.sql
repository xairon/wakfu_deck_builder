-- =============================================================================
-- Wakfu Deck Builder — règles officielles + errata (Phase 1)
-- =============================================================================
-- Contenu CURÉ et éditable par des humains (Phase 2 : édition admin) → en base.
-- Les 1585 cartes restent en JSON statique (compile-effects / CACHE_KEY).
-- Lecture PUBLIQUE (anon inclus) : la page Règles et les badges doivent
-- fonctionner sans compte — différence assumée avec `cards` (0008), qui est
-- réservée aux authentifiés. Écriture : service_role uniquement (le seed).
-- Idempotent : rejouable sans danger. À appliquer dans le SQL Editor.
-- =============================================================================

create table if not exists public.rules (
  number     text primary key,
  kind       text not null check (kind in ('chapter','section','rule')),
  chapter    int  not null,
  title      text,
  body       text,
  sort_order int  not null,
  updated_at timestamptz not null default now()
);

create index if not exists rules_sort_order_idx on public.rules (sort_order);

create table if not exists public.card_errata (
  id          bigint generated always as identity primary key,
  card_id     text not null,
  errata_date date,
  source      text,
  summary     text not null,
  before_text text,
  after_text  text,
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now()
);

create index if not exists card_errata_card_id_idx on public.card_errata (card_id);

alter table public.rules       enable row level security;
alter table public.card_errata enable row level security;

-- Lecture PUBLIQUE (anon inclus), comme profiles_select_public.
drop policy if exists "rules_select_public" on public.rules;
create policy "rules_select_public" on public.rules
  for select using (true);

drop policy if exists "card_errata_select_public" on public.card_errata;
create policy "card_errata_select_public" on public.card_errata
  for select using (true);

-- Écriture : aucune policy → seul service_role (qui contourne RLS) peut écrire.
-- La policy d'écriture « admin » viendra en Phase 2 sans toucher au schéma.

-- updated_at auto (réutilise public.set_updated_at de 0001_init.sql).
drop trigger if exists rules_set_updated_at on public.rules;
create trigger rules_set_updated_at
  before update on public.rules
  for each row execute function public.set_updated_at();

drop trigger if exists card_errata_set_updated_at on public.card_errata;
create trigger card_errata_set_updated_at
  before update on public.card_errata
  for each row execute function public.set_updated_at();
