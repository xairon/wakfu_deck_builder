-- Migration 0007 : colonne games.assisted (mode « règles assistées » partagé).
-- Réf. plan online-lifecycle (Task 5). Choix fait par l'hôte à la création de
-- la partie ; les deux clients héritent de ce réglage.
alter table public.games
  add column if not exists assisted boolean not null default false;
