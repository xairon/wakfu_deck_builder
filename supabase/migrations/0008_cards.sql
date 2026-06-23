-- =============================================================================
-- Wakfu Deck Builder — table `cards` (données de cartes côté serveur)
-- =============================================================================
-- Expose les données de cartes (compilées depuis public/data/*.json) aux Edge
-- Functions pour la validation AUTORITATIVE des règles (coûts, types, légalité).
-- Données publiques en lecture seule : lisibles par tout utilisateur
-- authentifié, écrites uniquement via service_role (le seed, hors RLS).
-- Idempotent : rejouable sans danger.
-- À appliquer dans le SQL Editor (Dashboard → SQL Editor → coller → Run),
-- ou via la CLI Supabase (db push).
-- =============================================================================

create table if not exists public.cards (
  id text primary key,
  data jsonb not null
);

alter table public.cards enable row level security;

-- Lisible par tout utilisateur authentifié (données publiques) ; l'écriture
-- passe par service_role (le seed), qui contourne RLS.
drop policy if exists "cards_read" on public.cards;
create policy "cards_read" on public.cards
  for select to authenticated using (true);
