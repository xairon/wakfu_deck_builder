-- =============================================================================
-- Wakfu Deck Builder — Upvotes des decks publics & gestion visibilité
-- =============================================================================
-- Permet aux utilisateurs d'upvoter des decks communautaires (table deck_upvotes).
-- Stocke le décompte dénormalisé sur deck_publications et decks pour des tris
-- ultra-rapides sans jointure d'agrégation.
-- RPC atomique toggle_deck_upvote(p_deck_id) pour basculer le vote de manière sûre.
-- =============================================================================

-- 1. Colonnes sur deck_publications et decks
alter table public.deck_publications
  add column if not exists upvote_count integer not null default 0;

alter table public.decks
  add column if not exists is_public boolean not null default false,
  add column if not exists upvote_count integer not null default 0;

-- 2. Table de jointure des upvotes
create table if not exists public.deck_upvotes (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  deck_id    text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

create index if not exists deck_upvotes_deck_id_idx
  on public.deck_upvotes (deck_id);

alter table public.deck_upvotes enable row level security;

-- Politiques RLS pour deck_upvotes
drop policy if exists "deck_upvotes_select" on public.deck_upvotes;
create policy "deck_upvotes_select" on public.deck_upvotes
  for select using (true);

drop policy if exists "deck_upvotes_insert" on public.deck_upvotes;
create policy "deck_upvotes_insert" on public.deck_upvotes
  for insert with check (auth.uid() = user_id);

drop policy if exists "deck_upvotes_delete" on public.deck_upvotes;
create policy "deck_upvotes_delete" on public.deck_upvotes
  for delete using (auth.uid() = user_id);

-- 3. Fonction RPC de toggle atomique
create or replace function public.toggle_deck_upvote(p_deck_id text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_exists boolean;
  v_count integer;
  v_upvoted boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  select exists(
    select 1 from public.deck_upvotes
    where user_id = v_user_id and deck_id = p_deck_id
  ) into v_exists;

  if v_exists then
    delete from public.deck_upvotes
    where user_id = v_user_id and deck_id = p_deck_id;

    update public.deck_publications
    set upvote_count = greatest(0, coalesce(upvote_count, 1) - 1)
    where deck_id = p_deck_id or id::text = p_deck_id;

    update public.decks
    set upvote_count = greatest(0, coalesce(upvote_count, 1) - 1)
    where id = p_deck_id;

    v_upvoted := false;
  else
    insert into public.deck_upvotes (user_id, deck_id)
    values (v_user_id, p_deck_id)
    on conflict do nothing;

    update public.deck_publications
    set upvote_count = coalesce(upvote_count, 0) + 1
    where deck_id = p_deck_id or id::text = p_deck_id;

    update public.decks
    set upvote_count = coalesce(upvote_count, 0) + 1
    where id = p_deck_id;

    v_upvoted := true;
  end if;

  -- Obtenir le nouveau compteur
  select coalesce(upvote_count, 0) into v_count
  from public.deck_publications
  where deck_id = p_deck_id or id::text = p_deck_id
  limit 1;

  if v_count is null then
    select coalesce(upvote_count, 0) into v_count
    from public.decks
    where id = p_deck_id
    limit 1;
  end if;

  return jsonb_build_object(
    'upvoted', v_upvoted,
    'upvoteCount', coalesce(v_count, 0)
  );
end;
$$;
