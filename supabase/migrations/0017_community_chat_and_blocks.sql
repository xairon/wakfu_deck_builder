-- =============================================================================
-- Wakfu Deck Builder — Chat général, messagerie privée & blocage utilisateurs (0017)
-- =============================================================================
-- Permet la communication en temps réel (général et privé) et la gestion des
-- blocages entre utilisateurs.
-- =============================================================================

-- Table des utilisateurs bloqués
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_cannot_block_self check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

-- L'utilisateur connecté peut voir qui il a bloqué
drop policy if exists "user_blocks_select_own" on public.user_blocks;
create policy "user_blocks_select_own" on public.user_blocks
  for select using (auth.uid() = blocker_id);

-- L'utilisateur connecté peut bloquer un autre utilisateur
drop policy if exists "user_blocks_insert_own" on public.user_blocks;
create policy "user_blocks_insert_own" on public.user_blocks
  for insert with check (auth.uid() = blocker_id);

-- L'utilisateur connecté peut débloquer un utilisateur
drop policy if exists "user_blocks_delete_own" on public.user_blocks;
create policy "user_blocks_delete_own" on public.user_blocks
  for delete using (auth.uid() = blocker_id);

-- Table des messages de chat
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  sender_name text not null,
  recipient_id uuid references auth.users (id) on delete cascade,
  channel text not null default 'general' check (channel in ('general', 'private')),
  content text not null check (char_length(btrim(content)) > 0 and char_length(content) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_general_idx
  on public.chat_messages (channel, created_at desc)
  where channel = 'general';

create index if not exists chat_messages_private_idx
  on public.chat_messages (channel, sender_id, recipient_id, created_at desc)
  where channel = 'private';

alter table public.chat_messages enable row level security;

-- RLS de lecture :
-- 1. Chat général : tout utilisateur authentifié peut lire, sauf si l'émetteur est bloqué
-- 2. Chat privé : lisible si l'utilisateur est émetteur ou destinataire, et non bloqué
drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select" on public.chat_messages
  for select using (
    auth.role() = 'authenticated'
    and (
      (
        channel = 'general'
        and not exists (
          select 1 from public.user_blocks ub
          where ub.blocker_id = auth.uid() and ub.blocked_id = sender_id
        )
      )
      or (
        channel = 'private'
        and (auth.uid() = sender_id or auth.uid() = recipient_id)
        and not exists (
          select 1 from public.user_blocks ub
          where ub.blocker_id = auth.uid() and ub.blocked_id = case when auth.uid() = sender_id then recipient_id else sender_id end
        )
      )
    )
  );

-- RLS d'insertion :
-- Doit être l'émetteur.
-- Si privé : le destinataire ne doit pas avoir bloqué l'émetteur, et l'émetteur ne doit pas avoir bloqué le destinataire.
drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert" on public.chat_messages
  for insert with check (
    auth.uid() = sender_id
    and (
      channel = 'general'
      or (
        channel = 'private'
        and recipient_id is not null
        and recipient_id <> sender_id
        and not exists (
          select 1 from public.user_blocks ub
          where (ub.blocker_id = recipient_id and ub.blocked_id = sender_id)
             or (ub.blocker_id = sender_id and ub.blocked_id = recipient_id)
        )
      )
    )
  );

-- Publication Realtime pour synchroniser les messages instantanément
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
