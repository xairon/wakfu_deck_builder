-- =============================================================================
-- Wakfu Deck Builder — fiche de publication d'un deck (v1)
-- =============================================================================
-- Métadonnées éditoriales d'un deck publié dans la galerie : catégorie/source,
-- accroche, et guide « comment jouer ». Une seule colonne JSONB, extensible.
-- Lisible/écrivable selon les policies de `decks` (0001 + 0003) : voyagent avec
-- la ligne, donc visibles sur les decks publics, modifiables par le proprio.
-- Idempotent. À appliquer dans le SQL Editor (avec 0002/0003/0004).
-- =============================================================================

alter table public.decks
  add column if not exists publication jsonb;
