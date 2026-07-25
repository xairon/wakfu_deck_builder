-- =============================================================================
-- Wakfu Deck Builder — errata structurés (champ par champ)
-- =============================================================================
-- Un errata officiel ne change pas « un texte » : il change UN CHAMP (parfois
-- plusieurs) — une stat, la ligne de type, le texte d'un effet. `changes` porte
-- ces changements pour un affichage précis (« PA : 7 → 6 »).
--
-- ADDITIF : summary / before_text / after_text restent la source d'affichage
-- tant que `changes` est vide. Les 66 errata existants ne cassent pas et se
-- structurent progressivement.
-- Idempotent. À appliquer dans le SQL Editor.
-- =============================================================================

alter table public.card_errata
  add column if not exists changes jsonb not null default '[]'::jsonb;
