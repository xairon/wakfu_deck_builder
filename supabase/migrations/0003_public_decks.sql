-- =============================================================================
-- Wakfu Deck Builder — galerie de decks publics (v1)
-- =============================================================================
-- Publication OPT-IN d'un deck via `decks.is_public`. Les decks publiés sont
-- lisibles par TOUS (galerie communautaire, anon inclus) ; l'écriture reste
-- réservée au propriétaire (policies de 0001_init.sql, inchangées).
-- Idempotent : rejouable sans danger.
-- À appliquer dans le SQL Editor (Dashboard → SQL Editor → coller → Run),
-- ou via la CLI Supabase (db push).
-- =============================================================================

alter table public.decks
  add column if not exists is_public boolean not null default false;

-- Galerie triée par fraîcheur ; index partiel sur les seuls decks publics.
create index if not exists decks_public_idx
  on public.decks (updated_at desc)
  where is_public;

-- Lecture PUBLIQUE des decks publiés (s'ajoute à decks_select_own de 0001 :
-- un utilisateur voit ses decks privés + tous les decks publics). L'écriture
-- (insert/update/delete) reste strictement réservée au propriétaire.
drop policy if exists "decks_select_public" on public.decks;
create policy "decks_select_public" on public.decks
  for select using (is_public = true);
