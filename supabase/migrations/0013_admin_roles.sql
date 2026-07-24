-- =============================================================================
-- Wakfu Deck Builder — rôles d'administration & journal (Phase 2, lot 1)
-- =============================================================================
-- owner  : gère les comptes (posé UNE fois en SQL, jamais via l'API)
-- admin  : édite règles et errata
-- user   : défaut
-- Idempotent : rejouable sans danger. À appliquer dans le SQL Editor.
-- =============================================================================

-- ── 1. Le rôle ───────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists role text not null default 'user';

do $$ begin
  alter table public.profiles
    add constraint profiles_role_check check (role in ('user','admin','owner'));
exception when duplicate_object then null;
end $$;

-- ⛔ SÉCURITÉ — les DEUX revoke sont nécessaires.
-- `profiles_update_own` ET `profiles_insert_own` (0004) n'ont aucune restriction de
-- colonne, et profileService.setUsername() fait un UPSERT : sans ces deux lignes,
-- n'importe qui se promeut admin (par update OU par insert de son propre profil).
-- PostgREST refuse toute requête mentionnant une colonne non accordée ; `username`
-- continue de fonctionner et `role` prend son défaut 'user' à l'insertion.
revoke update (role) on public.profiles from anon, authenticated;
revoke insert (role) on public.profiles from anon, authenticated;

-- ── 2. Prédicats de rôle ─────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role in ('admin','owner')
  );
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'owner'
  );
$$;

-- ── 3. Journal (append-only, alimenté par TRIGGERS) ──────────────────────────
create table if not exists public.admin_audit (
  id          bigint generated always as identity primary key,
  actor       uuid references public.profiles (user_id) on delete set null,  -- null = seed / système, ou acteur supprimé
  action      text not null check (action in ('create','update','delete')),
  entity      text not null check (entity in ('rule_override','errata','role')),
  entity_key  text not null,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_audit_created_at_idx
  on public.admin_audit (created_at desc);

alter table public.admin_audit enable row level security;

-- Lecture : admins et owner seulement (le journal dit qui a fait quoi).
drop policy if exists "admin_audit_select_admin" on public.admin_audit;
create policy "admin_audit_select_admin" on public.admin_audit
  for select using (public.is_admin());

-- AUCUNE policy insert/update/delete : seuls les triggers `security definer`
-- (et service_role) écrivent. Le journal est donc infalsifiable depuis l'API.

-- Extraction de la clé via JSONB : `rules_overrides` a `number` (pas d'`id`),
-- `card_errata` a `id` (pas de `number`) ; le coalesce prend celle qui existe
-- sur la ligne réellement fournie par OLD/NEW, sans branche par table.
create or replace function public.log_admin_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_entity text := tg_argv[0];
  v_key    text;
begin
  if tg_op = 'DELETE' then
    v_key := coalesce(to_jsonb(old) ->> 'number', to_jsonb(old) ->> 'id');
  else
    v_key := coalesce(to_jsonb(new) ->> 'number', to_jsonb(new) ->> 'id');
  end if;

  insert into public.admin_audit
    (actor, action, entity, entity_key, before_data, after_data)
  values (
    auth.uid(),
    case tg_op when 'INSERT' then 'create'
               when 'UPDATE' then 'update'
               else 'delete' end,
    v_entity,
    v_key,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return null;  -- trigger AFTER : valeur de retour ignorée
end;
$$;

-- ── 4. Corrections et ajouts de règles ───────────────────────────────────────
create table if not exists public.rules_overrides (
  number     text primary key,   -- même clé que rules.number, ou une NOUVELLE règle
  kind       text check (kind in ('chapter','section','rule')),
  chapter    int,
  title      text,
  body       text,
  sort_order int,
  updated_by uuid references public.profiles (user_id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.rules_overrides enable row level security;

drop policy if exists "rules_overrides_select_public" on public.rules_overrides;
create policy "rules_overrides_select_public" on public.rules_overrides
  for select using (true);

drop policy if exists "rules_overrides_write_admin" on public.rules_overrides;
create policy "rules_overrides_write_admin" on public.rules_overrides
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists rules_overrides_set_updated_at on public.rules_overrides;
create trigger rules_overrides_set_updated_at
  before update on public.rules_overrides
  for each row execute function public.set_updated_at();

drop trigger if exists rules_overrides_audit on public.rules_overrides;
create trigger rules_overrides_audit
  after insert or update or delete on public.rules_overrides
  for each row execute function public.log_admin_change('rule_override');

-- Vue de fusion : `rules` reste le miroir du scrape (purgeable), les corrections
-- vivent à côté. security_invoker → la RLS des tables sous-jacentes s'applique.
create or replace view public.rules_effective with (security_invoker = on) as
select
  coalesce(r.number, o.number)         as number,
  coalesce(o.kind, r.kind)             as kind,
  coalesce(o.chapter, r.chapter)       as chapter,
  coalesce(o.title, r.title)           as title,
  coalesce(o.body, r.body)             as body,
  coalesce(o.sort_order, r.sort_order) as sort_order,
  (o.number is not null)               as is_edited,
  r.body                               as body_official,  -- null si règle ajoutée
  o.updated_by,
  o.updated_at
from public.rules r
full outer join public.rules_overrides o using (number);

-- ── 5. Errata : écriture admin + journal ─────────────────────────────────────
alter table public.card_errata
  add column if not exists updated_by uuid references public.profiles (user_id) on delete set null;

drop policy if exists "card_errata_write_admin" on public.card_errata;
create policy "card_errata_write_admin" on public.card_errata
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists card_errata_audit on public.card_errata;
create trigger card_errata_audit
  after insert or update or delete on public.card_errata
  for each row execute function public.log_admin_change('errata');

-- ── 6. Attribution d'un rôle (seul chemin d'écriture de `role`) ──────────────
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Réservé au propriétaire';
  end if;
  if p_role not in ('user','admin') then
    raise exception 'Rôle non attribuable : %', p_role;
  end if;
  if exists (select 1 from public.profiles
             where user_id = p_user_id and role = 'owner') then
    raise exception 'Le propriétaire ne peut pas être modifié depuis l''UI';
  end if;

  update public.profiles set role = p_role where user_id = p_user_id;

  if not found then
    raise exception 'Utilisateur introuvable : %', p_user_id;
  end if;

  insert into public.admin_audit (actor, action, entity, entity_key, after_data)
  values (auth.uid(), 'update', 'role', p_user_id::text,
          jsonb_build_object('role', p_role));
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
