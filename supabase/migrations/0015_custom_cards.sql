-- Migration 0015: Custom Cards (Cartes personnalisées)
-- Permet aux joueurs de créer, modifier, lister et rechercher des cartes custom

create table if not exists public.custom_cards (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    main_type text not null,
    card_data jsonb not null,
    image_url text,
    is_public boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Index pour recherche rapide et listage utilisateur
create index if not exists idx_custom_cards_user_id on public.custom_cards(user_id);
create index if not exists idx_custom_cards_is_public on public.custom_cards(is_public) where is_public = true;
create index if not exists idx_custom_cards_name on public.custom_cards(name);

-- RLS
alter table public.custom_cards enable row level security;

-- Lecture : Les cartes publiques sont visibles par tous (anon et authentifiés), les privées uniquement par leur auteur
create policy "custom_cards_select"
    on public.custom_cards
    for select
    using (is_public = true or auth.uid() = user_id);

-- Insertion : Les utilisateurs authentifiés peuvent créer leurs cartes
create policy "custom_cards_insert"
    on public.custom_cards
    for insert
    with check (auth.uid() = user_id);

-- Mise à jour : L'auteur peut modifier ses cartes
create policy "custom_cards_update"
    on public.custom_cards
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Suppression : L'auteur peut supprimer ses cartes
create policy "custom_cards_delete"
    on public.custom_cards
    for delete
    using (auth.uid() = user_id);

-- Trigger auto updated_at
create or replace function public.handle_custom_cards_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create or replace trigger custom_cards_updated_at_trg
    before update on public.custom_cards
    for each row
    execute function public.handle_custom_cards_updated_at();
