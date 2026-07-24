# Rôles admin — socle (Plan A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser et **prouver** le socle de droits (`owner` / `admin` / `user`) : schéma, RLS, journal d'audit infalsifiable, rôles côté client, gardes de route et services d'écriture — sans aucun écran d'administration.

**Architecture :** Une migration `0013` ajoute le rôle sur `profiles` (avec les deux `revoke` de colonne qui ferment l'auto-promotion), les fonctions `is_admin()` / `is_owner()` / `set_user_role()`, la table `rules_overrides` + la vue de fusion `rules_effective`, et la table `admin_audit` alimentée par des **triggers** (jamais par le client). Côté client, `authStore` expose `isAdmin` / `isOwner`, le routeur gagne deux gardes, `rulesService` lit la vue, et un nouveau `adminService` porte les écritures — c'est la RLS qui tranche, jamais le front.

**Tech Stack :** Postgres / Supabase (RLS, `security definer`, triggers), Vue 3 `<script setup lang="ts">`, Pinia, Vitest + @vue/test-utils, Zod, Node `.mjs` pour l'ops.

**Spec de référence :** `docs/superpowers/specs/2026-07-24-roles-admin-et-edition-design.md`

**Plan B (à suivre)** : les écrans `/admin/*` et le marqueur « corrigé ».

## Global Constraints

- UI en **français**, code en **anglais**. Tests : `it("devrait …")`.
- TypeScript strict, **pas d'`enum`**. Pas de classes. **Zod = source unique** (`src/schema/`, types via `z.infer`).
- `npm run type-check` (vue-tsc) est **le seul gate de types**.
- **La sécurité, c'est la RLS.** `isAdmin` côté client ne sert qu'à afficher/masquer l'UI. Aucune décision de sécurité ne doit dépendre du front.
- `supabase` peut être `null` : tout service dégrade sans lever d'exception.
- Migrations : SQL **idempotent**, applicable au SQL Editor.
- Le journal `admin_audit` est écrit **uniquement par des triggers** — jamais un `insert` depuis le client.
- Le rôle `owner` n'est **jamais** attribuable via l'API.

> ## ⛔ Étapes DIFFÉRÉES — aucun agent n'a d'accès Supabase
>
> Les étapes marquées **`[DIFFÉRÉ — humain]`** ne doivent **PAS** être exécutées par un
> implémenteur : il écrit le fichier, vérifie ce qui l'est hors base (lint, types, tests
> avec Supabase mocké), puis passe à la suite **en le signalant dans son rapport**. Ne
> jamais tenter d'appliquer une migration, ni chercher/deviner un token.
>
> Rappel : **deux tokens `sbp_` ont été exposés et doivent être révoqués** avant d'en créer
> un nouveau pour ce lot.

---

### Task 1: Migration 0013 — rôles, overrides, journal

**Files:**

- Create: `supabase/migrations/0013_admin_roles.sql`

**Interfaces:**

- Consumes: `public.profiles` (0004), `public.rules` / `public.card_errata` (0012).
- Produces: colonne `profiles.role` ; fonctions `is_admin()`, `is_owner()`, `set_user_role(uuid, text)` ; tables `rules_overrides`, `admin_audit` ; vue `rules_effective` ; policies.

- [ ] **Step 1: Écrire la migration**

```sql
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
  actor       uuid references public.profiles (user_id),  -- null = seed / système
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

create or replace function public.log_admin_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_entity text := tg_argv[0];
  v_key    text;
begin
  if tg_op = 'DELETE' then
    v_key := case v_entity when 'rule_override' then old.number::text
                           else old.id::text end;
  else
    v_key := case v_entity when 'rule_override' then new.number::text
                           else new.id::text end;
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
  updated_by uuid references public.profiles (user_id),
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
  add column if not exists updated_by uuid references public.profiles (user_id);

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

  insert into public.admin_audit (actor, action, entity, entity_key, after_data)
  values (auth.uid(), 'update', 'role', p_user_id::text,
          jsonb_build_object('role', p_role));
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
```

- [ ] **Step 2: Contrôles hors base**

Relire le fichier et vérifier, sans exécuter :

- les DEUX `revoke` (`update` **et** `insert`) sur `role` sont présents ;
- `admin_audit` n'a **aucune** policy `insert`/`update`/`delete` ;
- `set_user_role` refuse : non-owner, rôle hors `user|admin`, cible déjà `owner` ;
- chaque `create` est `if not exists`, chaque `drop policy`/`drop trigger` est `if exists`.

- [ ] **Step 3: Appliquer la migration** `[DIFFÉRÉ — humain]`

```bash
SUPABASE_MGMT_TOKEN=<token> node scripts/applyMigration.mjs supabase/migrations/0013_admin_roles.sql
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0013_admin_roles.sql
git commit -m "feat(db): roles owner/admin, rules_overrides + vue, journal d'audit par triggers"
```

---

### Task 2: Schémas Zod

**Files:**

- Create: `src/schema/admin.ts`
- Modify: `src/schema/index.ts`
- Create: `src/schema/__tests__/admin.spec.ts`

**Interfaces:**

- Produces: `userRoleSchema`, `ruleEffectiveRowSchema`, `ruleOverrideRowSchema`, `auditRowSchema` et les types `UserRole`, `RuleEffectiveRow`, `RuleOverrideRow`, `AuditRow`, exportés depuis `@/schema`.

- [ ] **Step 1: Écrire le test qui échoue**

`src/schema/__tests__/admin.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import {
  userRoleSchema,
  ruleEffectiveRowSchema,
  auditRowSchema,
} from "../admin";

describe("userRoleSchema", () => {
  it("devrait accepter les trois rôles", () => {
    for (const r of ["user", "admin", "owner"])
      expect(userRoleSchema.safeParse(r).success).toBe(true);
  });

  it("devrait refuser un rôle inconnu", () => {
    expect(userRoleSchema.safeParse("superadmin").success).toBe(false);
  });
});

describe("ruleEffectiveRowSchema", () => {
  it("devrait accepter une règle corrigée (is_edited + body_official)", () => {
    const ok = ruleEffectiveRowSchema.safeParse({
      number: "418.5b",
      kind: "rule",
      chapter: 4,
      title: null,
      body: "Texte corrigé.",
      sort_order: 512,
      is_edited: true,
      body_official: "Texte officiel.",
      updated_by: "11111111-1111-1111-1111-111111111111",
      updated_at: "2026-07-24T10:00:00Z",
    });
    expect(ok.success).toBe(true);
  });

  it("devrait accepter une règle AJOUTÉE (body_official null)", () => {
    const ok = ruleEffectiveRowSchema.safeParse({
      number: "418.5c",
      kind: "rule",
      chapter: 4,
      body: "Règle ajoutée.",
      sort_order: 512,
      is_edited: true,
      body_official: null,
    });
    expect(ok.success).toBe(true);
  });

  it("devrait refuser un chapitre hors 1..8", () => {
    expect(
      ruleEffectiveRowSchema.safeParse({
        number: "9.1",
        kind: "rule",
        chapter: 9,
        sort_order: 1,
        is_edited: false,
      }).success,
    ).toBe(false);
  });
});

describe("auditRowSchema", () => {
  it("devrait accepter une ligne système (actor null)", () => {
    const ok = auditRowSchema.safeParse({
      id: 1,
      actor: null,
      action: "create",
      entity: "errata",
      entity_key: "42",
      before_data: null,
      after_data: { summary: "x" },
      created_at: "2026-07-24T10:00:00Z",
    });
    expect(ok.success).toBe(true);
  });

  it("devrait refuser une action inconnue", () => {
    expect(
      auditRowSchema.safeParse({
        id: 1,
        action: "purge",
        entity: "errata",
        entity_key: "42",
        created_at: "2026-07-24T10:00:00Z",
      }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/schema/__tests__/admin.spec.ts`
Expected: FAIL — `Failed to resolve import "../admin"`.

- [ ] **Step 3: Écrire les schémas**

`src/schema/admin.ts` :

```ts
import { z } from "zod";

/** Rôle d'un compte. `owner` n'est jamais attribuable via l'API (cf. set_user_role). */
export const userRoleSchema = z.enum(["user", "admin", "owner"]);

/** Une ligne de la vue `rules_effective` (règle importée, corrigée, ou ajoutée). */
export const ruleEffectiveRowSchema = z.object({
  number: z.string().min(1),
  kind: z.enum(["chapter", "section", "rule"]),
  chapter: z.number().int().min(1).max(8),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  sort_order: z.number().int(),
  is_edited: z.boolean(),
  /** Texte officiel d'origine ; null pour une règle AJOUTÉE (aucun import en face). */
  body_official: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

/** Une ligne de `rules_overrides` (ce qu'on écrit). */
export const ruleOverrideRowSchema = z.object({
  number: z.string().min(1),
  kind: z.enum(["chapter", "section", "rule"]).nullable().optional(),
  chapter: z.number().int().min(1).max(8).nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  sort_order: z.number().int().nullable().optional(),
});

/** Une ligne du journal. `actor` null = écriture système (seed). */
export const auditRowSchema = z.object({
  id: z.number().int(),
  actor: z.string().nullable().optional(),
  action: z.enum(["create", "update", "delete"]),
  entity: z.enum(["rule_override", "errata", "role"]),
  entity_key: z.string(),
  before_data: z.unknown().nullable().optional(),
  after_data: z.unknown().nullable().optional(),
  created_at: z.string(),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type RuleEffectiveRow = z.infer<typeof ruleEffectiveRowSchema>;
export type RuleOverrideRow = z.infer<typeof ruleOverrideRowSchema>;
export type AuditRow = z.infer<typeof auditRowSchema>;
```

- [ ] **Step 4: Exporter depuis le barrel**

Ajouter à la fin de `src/schema/index.ts` :

```ts
export * from "./admin";
```

- [ ] **Step 5: Lancer les tests + type-check**

Run: `npx vitest run src/schema/__tests__/admin.spec.ts && npm run type-check`
Expected: 7 tests PASS, type-check vert.

- [ ] **Step 6: Commit**

```bash
git add src/schema/admin.ts src/schema/index.ts src/schema/__tests__/admin.spec.ts
git commit -m "feat(schema): rôles, rules_effective, rules_overrides, journal d'audit"
```

---

### Task 3: Le rôle côté client

**Files:**

- Modify: `src/services/profileService.ts`
- Modify: `src/stores/authStore.ts`
- Create: `src/services/__tests__/profileRole.spec.ts`

**Interfaces:**

- Consumes: `userRoleSchema` (Task 2).
- Produces: `getMyRole(): Promise<UserRole>` (`profileService`) ; `authStore.role`, `authStore.isAdmin`, `authStore.isOwner`.

- [ ] **Step 1: Écrire le test qui échoue**

`src/services/__tests__/profileRole.spec.ts` :

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

let supabaseStub: any = null;

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ userId: "user-1" }),
}));

import { getMyRole } from "@/services/profileService";

function stubRole(role: unknown, error: unknown = null) {
  supabaseStub = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: role, error }),
        }),
      }),
    }),
  };
}

describe("profileService.getMyRole", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    supabaseStub = null;
  });

  it("devrait renvoyer le rôle stocké", async () => {
    stubRole({ role: "admin" });
    await expect(getMyRole()).resolves.toBe("admin");
  });

  it("devrait renvoyer 'user' si Supabase n'est pas configuré", async () => {
    supabaseStub = null;
    await expect(getMyRole()).resolves.toBe("user");
  });

  it("devrait renvoyer 'user' si la requête échoue", async () => {
    stubRole(null, { message: "boom" });
    await expect(getMyRole()).resolves.toBe("user");
  });

  it("devrait renvoyer 'user' si le rôle stocké est invalide", async () => {
    stubRole({ role: "superadmin" });
    await expect(getMyRole()).resolves.toBe("user");
  });

  it("devrait renvoyer 'user' si aucun profil n'existe", async () => {
    stubRole(null);
    await expect(getMyRole()).resolves.toBe("user");
  });
});
```

> Le repli sur `"user"` dans tous les cas d'échec est délibéré : **en cas de doute, aucun
> privilège**. L'inverse (échouer vers `admin`) serait une faille.

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/services/__tests__/profileRole.spec.ts`
Expected: FAIL — `getMyRole` n'est pas exporté.

- [ ] **Step 3: Ajouter `getMyRole`**

Ajouter à la fin de `src/services/profileService.ts` :

```ts
import { userRoleSchema, type UserRole } from "@/schema";

/**
 * Rôle de l'utilisateur courant. **Replie sur `"user"` à la moindre incertitude**
 * (pas de backend, requête en échec, valeur inattendue) : en cas de doute, aucun
 * privilège. Ce rôle ne sert QU'À l'affichage — la sécurité réelle est la RLS.
 */
export async function getMyRole(): Promise<UserRole> {
  if (!supabase) return "user";
  const authStore = useAuthStore();
  if (!authStore.userId) return "user";
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", authStore.userId)
    .maybeSingle();
  if (error || !data) return "user";
  const parsed = userRoleSchema.safeParse((data as { role?: unknown }).role);
  return parsed.success ? parsed.data : "user";
}
```

- [ ] **Step 4: Exposer le rôle dans `authStore`**

Dans `src/stores/authStore.ts` : ajouter l'état, les getters, le chargement et la remise à zéro.

```ts
import type { UserRole } from "@/schema";

const role = ref<UserRole>("user");

const isAdmin = computed(
  () => role.value === "admin" || role.value === "owner",
);
const isOwner = computed(() => role.value === "owner");

/** Charge le rôle depuis `profiles`. Silencieux : le repli est déjà « user ». */
async function loadRole() {
  const { getMyRole } = await import("@/services/profileService");
  role.value = await getMyRole();
}
```

**Un seul point de branchement** : `setSession()` (ligne ~30) est appelé par `initialize`,
`signUp`, `signIn` **et** `signOut(null)` — c'est donc le seul endroit à modifier :

```ts
function setSession(next: AuthSession | null) {
  session.value = next;
  user.value = next?.user ?? null;
  // Le rôle suit la session. Repli IMMÉDIAT sur « user » : aucun privilège tant
  // que le rôle réel n'est pas revenu, et remise à zéro à la déconnexion.
  role.value = "user";
  if (next) void loadRole();
}
```

Ce repli immédiat est délibéré : entre la pose de la session et le retour de `loadRole()`,
l'utilisateur est traité comme non privilégié. L'inverse afficherait brièvement l'UI d'admin
à tout le monde.

Enfin, ajouter `role`, `isAdmin`, `isOwner` et `loadRole` à l'objet retourné par le store.

- [ ] **Step 5: Lancer les tests + type-check**

Run: `npx vitest run src/services/__tests__ src/stores/__tests__ && npm run type-check`
Expected: PASS, type-check vert.

- [ ] **Step 6: Commit**

```bash
git add src/services/profileService.ts src/stores/authStore.ts src/services/__tests__/profileRole.spec.ts
git commit -m "feat(auth): rôle du compte exposé côté client (repli 'user' systématique)"
```

---

### Task 4: Gardes de route

**Files:**

- Create: `src/views/AccessDeniedView.vue`
- Modify: `src/router/index.ts`
- Create: `src/router/__tests__/adminGuards.spec.ts`

**Interfaces:**

- Consumes: `authStore.isAdmin` / `isOwner` (Task 3).
- Produces: prise en charge de `meta.requiresAdmin` et `meta.requiresOwner` ; route nommée `accessDenied` sur `/acces-refuse`.

- [ ] **Step 1: Écrire le test qui échoue**

`src/router/__tests__/adminGuards.spec.ts` :

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

let authState = { isAuthenticated: false, isAdmin: false, isOwner: false };

vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({
    ...authState,
    initialize: () => Promise.resolve(),
  }),
}));

import router from "@/router";

describe("gardes d'administration", () => {
  beforeEach(() => {
    authState = { isAuthenticated: false, isAdmin: false, isOwner: false };
  });

  it("devrait renvoyer un visiteur non connecté vers /auth", async () => {
    await router.push("/admin");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("auth");
    expect(router.currentRoute.value.query.redirect).toBe("/admin");
  });

  it("devrait refuser l'accès à un connecté NON admin", async () => {
    authState = { isAuthenticated: true, isAdmin: false, isOwner: false };
    await router.push("/admin");
    expect(router.currentRoute.value.name).toBe("accessDenied");
  });

  it("devrait laisser passer un admin", async () => {
    authState = { isAuthenticated: true, isAdmin: true, isOwner: false };
    await router.push("/admin");
    expect(router.currentRoute.value.name).toBe("admin");
  });

  it("devrait refuser /admin/comptes à un admin non owner", async () => {
    authState = { isAuthenticated: true, isAdmin: true, isOwner: false };
    await router.push("/admin/comptes");
    expect(router.currentRoute.value.name).toBe("accessDenied");
  });

  it("devrait laisser passer l'owner sur /admin/comptes", async () => {
    authState = { isAuthenticated: true, isAdmin: true, isOwner: true };
    await router.push("/admin/comptes");
    expect(router.currentRoute.value.name).toBe("adminAccounts");
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/router/__tests__/adminGuards.spec.ts`
Expected: FAIL — les routes `/admin` n'existent pas.

- [ ] **Step 3: Écrire l'écran de refus**

`src/views/AccessDeniedView.vue` :

```vue
<template>
  <main class="container mx-auto px-4 py-16 text-center">
    <h1 class="text-3xl font-bold">Accès réservé</h1>
    <p class="mx-auto mt-3 max-w-lg opacity-80">
      Cette page est réservée à l'équipe d'administration. Si tu penses qu'il
      s'agit d'une erreur, contacte le responsable du site.
    </p>
    <RouterLink to="/" class="btn btn-neutral mt-6"
      >Retour à l'accueil</RouterLink
    >
  </main>
</template>
```

- [ ] **Step 4: Déclarer les routes**

Dans `src/router/index.ts`, après les routes `/regles/*` :

```ts
    {
      path: "/acces-refuse",
      name: "accessDenied",
      component: () => import("@/views/AccessDeniedView.vue"),
      meta: { guest: true },
    },
    {
      path: "/admin",
      name: "admin",
      component: () => import("@/views/admin/AdminHomeView.vue"),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: "/admin/comptes",
      name: "adminAccounts",
      component: () => import("@/views/admin/AdminAccountsView.vue"),
      meta: { requiresAuth: true, requiresOwner: true },
    },
```

- [ ] **Step 5: Étendre le garde**

Dans le `beforeEach` de `src/router/index.ts`, **après** le bloc `requiresAuth` existant :

```ts
// Rôles. `isAdmin`/`isOwner` ne servent qu'à l'aiguillage d'UI : la sécurité
// réelle est la RLS, qui refuse l'écriture même si quelqu'un force la route.
const requiresAdmin = to.matched.some((r) => r.meta.requiresAdmin);
const requiresOwner = to.matched.some((r) => r.meta.requiresOwner);
if (
  (requiresAdmin && !authStore.isAdmin) ||
  (requiresOwner && !authStore.isOwner)
) {
  next({ name: "accessDenied" });
  return;
}
```

> `requiresOwner` implique `requiresAuth` dans les métadonnées ci-dessus, donc un
> visiteur anonyme est d'abord renvoyé vers `/auth` par le bloc existant.

- [ ] **Step 6: Créer les deux vues minimales attendues par les routes**

`src/views/admin/AdminHomeView.vue` :

```vue
<template>
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold">Administration</h1>
    <p class="mt-2 opacity-80">
      Les écrans d'édition arrivent dans le lot suivant.
    </p>
  </main>
</template>
```

`src/views/admin/AdminAccountsView.vue` :

```vue
<template>
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold">Comptes</h1>
    <p class="mt-2 opacity-80">
      La gestion des rôles arrive dans le lot suivant.
    </p>
  </main>
</template>
```

- [ ] **Step 7: Lancer les tests + type-check**

Run: `npx vitest run src/router/__tests__/adminGuards.spec.ts && npm run type-check`
Expected: 5 tests PASS, type-check vert.

- [ ] **Step 8: Commit**

```bash
git add src/views/AccessDeniedView.vue src/views/admin src/router/index.ts src/router/__tests__/adminGuards.spec.ts
git commit -m "feat(admin): gardes requiresAdmin/requiresOwner + écran Accès réservé"
```

---

### Task 5: `rulesService` lit la vue de fusion, et les deux services savent se rafraîchir

**Files:**

- Modify: `src/services/rulesService.ts`
- Modify: `src/services/errataService.ts`
- Modify: `src/services/__tests__/rulesService.spec.ts`
- Modify: `src/services/__tests__/errataService.spec.ts`

**Interfaces:**

- Consumes: vue `rules_effective` (Task 1), `ruleEffectiveRowSchema` (Task 2).
- Produces: `rulesService.getRules()` renvoie des `RuleEffectiveRow` ; `refreshRules()` et `refreshErrata()` exportés.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `src/services/__tests__/rulesService.spec.ts` :

```ts
it("devrait lire la vue rules_effective (pas la table rules)", async () => {
  let table = "";
  supabaseStub = {
    from: (t: string) => {
      table = t;
      return {
        select: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    },
  };
  await loadRules();
  expect(table).toBe("rules_effective");
});

it("devrait exposer is_edited et body_official", async () => {
  stubData([
    {
      number: "418.5b",
      kind: "rule",
      chapter: 4,
      title: null,
      body: "Corrigé.",
      sort_order: 3,
      is_edited: true,
      body_official: "Officiel.",
    },
  ]);
  const rules = await loadRules();
  expect(rules[0].is_edited).toBe(true);
  expect(rules[0].body_official).toBe("Officiel.");
});

it("refreshRules devrait forcer une nouvelle requête", async () => {
  let calls = 0;
  supabaseStub = {
    from: () => ({
      select: () => ({
        order: () => {
          calls++;
          return Promise.resolve({ data: [], error: null });
        },
      }),
    }),
  };
  await loadRules();
  await loadRules();
  expect(calls).toBe(1);
  await refreshRules();
  expect(calls).toBe(2);
});
```

Ajouter à `src/services/__tests__/errataService.spec.ts` :

```ts
it("refreshErrata devrait forcer une nouvelle requête", async () => {
  let calls = 0;
  supabaseStub = {
    from: () => ({
      select: () => ({
        order: () => {
          calls++;
          return Promise.resolve({ data: [ROW], error: null });
        },
      }),
    }),
  };
  await preloadErrata();
  await preloadErrata();
  expect(calls).toBe(1);
  await refreshErrata();
  expect(calls).toBe(2);
});
```

Compléter les imports des deux fichiers de test avec `refreshRules` / `refreshErrata`.

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx vitest run src/services/__tests__/rulesService.spec.ts src/services/__tests__/errataService.spec.ts`
Expected: FAIL — `refreshRules` / `refreshErrata` non exportés, et la table lue est `rules`.

- [ ] **Step 3: Adapter `rulesService`**

Dans `src/services/rulesService.ts` :

- remplacer `ruleRowSchema` par `ruleEffectiveRowSchema` et le type `RuleRow` par `RuleEffectiveRow` (import depuis `@/schema`) ;
- remplacer `.from("rules")` par `.from("rules_effective")` ;
- **trier par `(sort_order, number)`** :

```ts
const { data, error } = await supabase
  .from("rules_effective")
  .select("*")
  .order("sort_order", { ascending: true })
  .order("number", { ascending: true });
```

- ajouter, après `getRules` :

```ts
/**
 * Force un rechargement au prochain accès (après une écriture admin).
 * Distinct de `__resetRulesCache` (tests) : c'est un chemin de production.
 */
export async function refreshRules(): Promise<RuleEffectiveRow[]> {
  cache = null;
  loading = null;
  return loadRules();
}
```

- [ ] **Step 4: Ajouter `refreshErrata`**

Dans `src/services/errataService.ts`, après `getAllErrata` :

```ts
/** Force un rechargement de l'index au prochain accès (après une écriture admin). */
export async function refreshErrata(): Promise<void> {
  cache = null;
  loading = null;
  await preloadErrata();
}
```

- [ ] **Step 5: Adapter la vue publique**

`src/views/RulesOfficialView.vue` importe `RuleRow` depuis `@/schema` : remplacer par
`RuleEffectiveRow`. Aucun autre changement (les champs lus existent toujours).

- [ ] **Step 6: Lancer la suite complète + type-check**

Run: `npx vitest run && npm run type-check`
Expected: 0 échec, type-check vert.

- [ ] **Step 7: Commit**

```bash
git add src/services/rulesService.ts src/services/errataService.ts src/services/__tests__ src/views/RulesOfficialView.vue
git commit -m "feat(rules): lecture via rules_effective + refresh() des deux index"
```

---

### Task 6: `adminService` — les écritures

**Files:**

- Create: `src/services/adminService.ts`
- Create: `src/services/__tests__/adminService.spec.ts`

**Interfaces:**

- Consumes: `supabase`, `authStore.userId`, `refreshRules` / `refreshErrata` (Task 5), schémas (Task 2).
- Produces: `upsertRuleOverride`, `deleteRuleOverride`, `createErratum`, `updateErratum`, `deleteErratum`, `setUserRole`, `listAudit`, `listProfiles` — tous en `Promise<{ ok: boolean; error?: string }>` (sauf les listes).

- [ ] **Step 1: Écrire le test qui échoue**

`src/services/__tests__/adminService.spec.ts` :

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

let supabaseStub: any = null;
const refreshRules = vi.fn().mockResolvedValue([]);
const refreshErrata = vi.fn().mockResolvedValue(undefined);

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ userId: "user-1" }),
}));
vi.mock("@/services/rulesService", () => ({ refreshRules }));
vi.mock("@/services/errataService", () => ({ refreshErrata }));

import {
  upsertRuleOverride,
  deleteRuleOverride,
  createErratum,
  setUserRole,
} from "@/services/adminService";

describe("adminService", () => {
  beforeEach(() => {
    supabaseStub = null;
    refreshRules.mockClear();
    refreshErrata.mockClear();
  });

  it("devrait échouer proprement sans backend", async () => {
    const res = await upsertRuleOverride({ number: "418.5b", body: "x" });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it("devrait remonter le refus de la base sans lever", async () => {
    supabaseStub = {
      from: () => ({
        upsert: () =>
          Promise.resolve({ error: { message: "row-level security" } }),
      }),
    };
    const res = await upsertRuleOverride({ number: "418.5b", body: "x" });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("row-level security");
    expect(refreshRules).not.toHaveBeenCalled();
  });

  it("devrait rafraîchir l'index après une écriture réussie", async () => {
    supabaseStub = {
      from: () => ({ upsert: () => Promise.resolve({ error: null }) }),
    };
    const res = await upsertRuleOverride({ number: "418.5b", body: "x" });
    expect(res.ok).toBe(true);
    expect(refreshRules).toHaveBeenCalledTimes(1);
  });

  it("devrait rafraîchir après suppression d'un override", async () => {
    supabaseStub = {
      from: () => ({
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    };
    expect((await deleteRuleOverride("418.5b")).ok).toBe(true);
    expect(refreshRules).toHaveBeenCalledTimes(1);
  });

  it("devrait rafraîchir l'index errata après création", async () => {
    supabaseStub = {
      from: () => ({ insert: () => Promise.resolve({ error: null }) }),
    };
    const res = await createErratum({
      card_id: "opee-tissoin-incarnam",
      summary: "Passe à 6 PA.",
    });
    expect(res.ok).toBe(true);
    expect(refreshErrata).toHaveBeenCalledTimes(1);
  });

  it("devrait remonter le refus de set_user_role (réservé au propriétaire)", async () => {
    supabaseStub = {
      rpc: () =>
        Promise.resolve({ error: { message: "Réservé au propriétaire" } }),
    };
    const res = await setUserRole("user-2", "admin");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("propriétaire");
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/services/__tests__/adminService.spec.ts`
Expected: FAIL — `Failed to resolve import "@/services/adminService"`.

- [ ] **Step 3: Écrire le service**

`src/services/adminService.ts` :

```ts
/**
 * Écritures d'administration (règles, errata, rôles).
 *
 * ⚠️ Ce service NE décide RIEN en matière de sécurité : il envoie la requête et
 * remonte le verdict de la base. C'est la RLS (`is_admin()` / `is_owner()`) qui
 * autorise ou refuse — un utilisateur qui appellerait ces fonctions sans les
 * droits obtiendrait la même erreur qu'en appelant l'API à la main.
 *
 * Chaque écriture réussie rafraîchit l'index concerné : les services de lecture
 * chargent une seule fois et garderaient sinon l'ancien contenu.
 */
import { supabase } from "./supabase";
import { useAuthStore } from "@/stores/authStore";
import { refreshRules } from "./rulesService";
import { refreshErrata } from "./errataService";
import type { RuleOverrideRow, UserRole, AuditRow } from "@/schema";

export interface WriteResult {
  ok: boolean;
  error?: string;
}

const NO_BACKEND = "Service indisponible (backend non configuré).";

function fail(error: unknown): WriteResult {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : "Écriture refusée.";
  return { ok: false, error: message };
}

/** Crée ou met à jour la correction d'une règle. */
export async function upsertRuleOverride(
  row: RuleOverrideRow,
): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  const authStore = useAuthStore();
  const { error } = await supabase
    .from("rules_overrides")
    .upsert({ ...row, updated_by: authStore.userId }, { onConflict: "number" });
  if (error) return fail(error);
  await refreshRules();
  return { ok: true };
}

/** Supprime la correction — la règle officielle reprend sa place. */
export async function deleteRuleOverride(number: string): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  const { error } = await supabase
    .from("rules_overrides")
    .delete()
    .eq("number", number);
  if (error) return fail(error);
  await refreshRules();
  return { ok: true };
}

export interface ErratumInput {
  card_id: string;
  errata_date?: string | null;
  source?: string | null;
  summary: string;
  before_text?: string | null;
  after_text?: string | null;
  sort_order?: number;
}

export async function createErratum(input: ErratumInput): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  const authStore = useAuthStore();
  const { error } = await supabase
    .from("card_errata")
    .insert({ sort_order: 0, ...input, updated_by: authStore.userId });
  if (error) return fail(error);
  await refreshErrata();
  return { ok: true };
}

export async function updateErratum(
  id: number,
  input: Partial<ErratumInput>,
): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  const authStore = useAuthStore();
  const { error } = await supabase
    .from("card_errata")
    .update({ ...input, updated_by: authStore.userId })
    .eq("id", id);
  if (error) return fail(error);
  await refreshErrata();
  return { ok: true };
}

export async function deleteErratum(id: number): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  const { error } = await supabase.from("card_errata").delete().eq("id", id);
  if (error) return fail(error);
  await refreshErrata();
  return { ok: true };
}

/** Attribue un rôle. Passe par la RPC : `role` n'est pas écrivable directement. */
export async function setUserRole(
  userId: string,
  role: Exclude<UserRole, "owner">,
): Promise<WriteResult> {
  if (!supabase) return { ok: false, error: NO_BACKEND };
  const { error } = await supabase.rpc("set_user_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (error) return fail(error);
  return { ok: true };
}

/** Journal, du plus récent au plus ancien. Vide si non autorisé (RLS). */
export async function listAudit(limit = 200): Promise<AuditRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("admin_audit")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data as AuditRow[];
}

/** Profils + rôles (page de gestion des comptes). */
export async function listProfiles(): Promise<
  { user_id: string; username: string; role: UserRole }[]
> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, role")
    .order("username", { ascending: true });
  if (error || !Array.isArray(data)) return [];
  return data as { user_id: string; username: string; role: UserRole }[];
}
```

- [ ] **Step 4: Lancer les tests + type-check**

Run: `npx vitest run src/services/__tests__/adminService.spec.ts && npm run type-check`
Expected: 6 tests PASS, type-check vert.

- [ ] **Step 5: Commit**

```bash
git add src/services/adminService.ts src/services/__tests__/adminService.spec.ts
git commit -m "feat(admin): adminService — écritures règles/errata/rôles, refresh des index"
```

---

### Task 7: Protéger le seed errata

**Files:**

- Modify: `scripts/seedErrata.mjs`
- Modify: `scripts/setupErrataRules.mjs`

**Interfaces:**

- Produces: `seedErrata.mjs` refuse de tourner si `card_errata` n'est pas vide, sauf `--force`.

- [ ] **Step 1: Ajouter la garde**

Dans `scripts/seedErrata.mjs`, **avant** le `delete from public.card_errata` :

```js
// ⛔ Les errata sont désormais CRÉÉS À LA MAIN par les admins : ce script n'a plus
// de source amont, et son `delete` détruirait leur travail. Il ne s'exécute donc
// que sur une table vide, sauf --force explicite.
const force = process.argv.includes("--force");
const [{ n: existing }] = await runSql(
  "select count(*)::int as n from public.card_errata;",
);
if (existing > 0 && !force) {
  console.error(
    `Refus : card_errata contient déjà ${existing} ligne(s).\n` +
      "Ce seed EFFACE la table — relancer écraserait les errata saisis par les admins.\n" +
      "Si c'est vraiment ce que tu veux : node scripts/seedErrata.mjs --force",
  );
  process.exit(1);
}
```

- [ ] **Step 2: Répercuter dans l'orchestrateur**

Dans `scripts/setupErrataRules.mjs`, propager l'argument à l'étape 2 :

```js
const forceArgs = process.argv.includes("--force") ? ["--force"] : [];
step("2/4 · Seed des errata", ["scripts/seedErrata.mjs", ...forceArgs]);
```

et compléter le docstring d'en-tête :

```js
 * ⚠️ Depuis la Phase 2, les errata sont édités par les admins : le seed refuse de
 * tourner si `card_errata` n'est pas vide (--force pour passer outre).
```

- [ ] **Step 3: Vérifier la syntaxe**

Run: `node --check scripts/seedErrata.mjs && node --check scripts/setupErrataRules.mjs`
Expected: aucune sortie.

- [ ] **Step 4: Vérifier la garde sans base** `[DIFFÉRÉ — humain]`

Le contrôle réel demande un token ; se contenter de relire que la garde est bien **avant**
le `delete` et qu'elle sort en code 1.

- [ ] **Step 5: Commit**

```bash
git add scripts/seedErrata.mjs scripts/setupErrataRules.mjs
git commit -m "fix(ops): le seed errata refuse d'écraser le travail des admins"
```

---

### Task 8: `checkAdminRls.mjs` — prouver la sécurité

**Files:**

- Create: `scripts/checkAdminRls.mjs`

**Interfaces:**

- Consumes: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (`.env`), et deux comptes de test fournis par l'humain.
- Produces: un script qui **échoue bruyamment** si une seule des 7 garanties ne tient pas.

> **C'est le livrable le plus important de ce plan.** Les tests unitaires moquent Supabase :
> ils valident le code, **pas** la sécurité. Seul ce script, exécuté contre la vraie base,
> prouve que la RLS tient.

- [ ] **Step 1: Écrire le script**

`scripts/checkAdminRls.mjs` :

```js
/**
 * Prouve, contre la VRAIE base, que les droits d'administration tiennent.
 *
 * Les tests unitaires moquent Supabase : ils ne prouvent RIEN sur la RLS. Ce
 * script est le seul contrôle qui vaille.
 *
 * Il n'écrit jamais rien de durable : chaque tentative d'écriture DOIT échouer,
 * et les rares écritures censées réussir ne sont pas testées ici (elles le sont
 * par l'usage réel de l'UI).
 *
 * Usage :
 *   node scripts/checkAdminRls.mjs
 *   # optionnel, pour couvrir les points 3/4/5 (compte SANS rôle admin) :
 *   TEST_EMAIL=… TEST_PASSWORD=… node scripts/checkAdminRls.mjs
 */
import { readFileSync } from "node:fs";

function envFromDotenv(key) {
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  return line
    ? line
        .slice(key.length + 1)
        .replace(/^"|"$/g, "")
        .trim()
    : "";
}

const URL = process.env.VITE_SUPABASE_URL || envFromDotenv("VITE_SUPABASE_URL");
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY || envFromDotenv("VITE_SUPABASE_ANON_KEY");
if (!URL || !ANON) {
  console.error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY introuvables.");
  process.exit(1);
}

let failures = 0;
function check(label, ok, detail = "") {
  console.log(
    `${ok ? "  ✅" : "  ❌"} ${label}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
}

async function rest(path, { method = "GET", token = ANON, body } = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, text: await res.text() };
}

async function signIn(email, password) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return { token: j.access_token, userId: j.user?.id };
}

console.log("\n── Lecture publique (anon) ──────────────────");
{
  const r1 = await rest("rules_effective?select=number&limit=1");
  check("anon LIT rules_effective", r1.status === 200, `HTTP ${r1.status}`);
  const r2 = await rest("card_errata?select=card_id&limit=1");
  check("anon LIT card_errata", r2.status === 200, `HTTP ${r2.status}`);
  const r3 = await rest("admin_audit?select=id&limit=1");
  // La RLS filtre : 200 avec 0 ligne est acceptable, du contenu ne l'est pas.
  check(
    "anon NE LIT PAS le journal",
    r3.status !== 200 || r3.text.trim() === "[]",
    `HTTP ${r3.status} ${r3.text.slice(0, 60)}`,
  );
}

console.log("\n── Écriture anonyme : tout doit échouer ─────");
{
  const w1 = await rest("rules_overrides", {
    method: "POST",
    body: { number: "__rls_probe__", body: "x" },
  });
  check(
    "anon N'ÉCRIT PAS rules_overrides",
    w1.status >= 400,
    `HTTP ${w1.status}`,
  );
  const w2 = await rest("card_errata", {
    method: "POST",
    body: { card_id: "__rls_probe__", summary: "x" },
  });
  check("anon N'ÉCRIT PAS card_errata", w2.status >= 400, `HTTP ${w2.status}`);
  const w3 = await rest("admin_audit", {
    method: "POST",
    body: { action: "create", entity: "errata", entity_key: "x" },
  });
  check("anon N'ÉCRIT PAS le journal", w3.status >= 400, `HTTP ${w3.status}`);
}

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
if (!email || !password) {
  console.log(
    "\n⚠️  TEST_EMAIL / TEST_PASSWORD absents : les points 3 à 5 (compte connecté\n" +
      "   NON admin) n'ont PAS été vérifiés. Fournis un compte de test sans rôle\n" +
      "   pour une preuve complète.",
  );
} else {
  const session = await signIn(email, password);
  if (!session) {
    console.error("\n❌ Connexion du compte de test impossible.");
    failures++;
  } else {
    const t = session.token;
    console.log("\n── Connecté NON admin : écriture interdite ──");
    const w1 = await rest("rules_overrides", {
      method: "POST",
      token: t,
      body: { number: "__rls_probe__", body: "x" },
    });
    check(
      "non-admin N'ÉCRIT PAS rules_overrides",
      w1.status >= 400,
      `HTTP ${w1.status}`,
    );
    const w2 = await rest("card_errata", {
      method: "POST",
      token: t,
      body: { card_id: "__rls_probe__", summary: "x" },
    });
    check(
      "non-admin N'ÉCRIT PAS card_errata",
      w2.status >= 400,
      `HTTP ${w2.status}`,
    );

    console.log("\n── Auto-promotion : les DEUX voies ──────────");
    const p1 = await rest(`profiles?user_id=eq.${session.userId}`, {
      method: "PATCH",
      token: t,
      body: { role: "admin" },
    });
    check(
      "ne peut PAS se promouvoir par UPDATE",
      p1.status >= 400,
      `HTTP ${p1.status}`,
    );
    const p2 = await rest("profiles", {
      method: "POST",
      token: t,
      body: { user_id: session.userId, username: "probe", role: "admin" },
    });
    check(
      "ne peut PAS se promouvoir par INSERT",
      p2.status >= 400,
      `HTTP ${p2.status}`,
    );

    console.log("\n── RPC de rôle : réservée à l'owner ─────────");
    const rpc = await fetch(`${URL}/rest/v1/rpc/set_user_role`, {
      method: "POST",
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user_id: session.userId, p_role: "admin" }),
    });
    check(
      "non-owner NE PEUT PAS appeler set_user_role",
      rpc.status >= 400,
      `HTTP ${rpc.status}`,
    );

    // Contrôle final : le rôle n'a pas bougé.
    const after = await rest(
      `profiles?user_id=eq.${session.userId}&select=role`,
      { token: t },
    );
    check(
      "le rôle du compte de test est resté 'user'",
      after.text.includes('"user"') || after.text.trim() === "[]",
      after.text.slice(0, 60),
    );
  }
}

console.log(
  failures === 0
    ? "\n✅ Toutes les garanties de sécurité tiennent.\n"
    : `\n❌ ${failures} garantie(s) EN DÉFAUT — ne pas déployer.\n`,
);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `node --check scripts/checkAdminRls.mjs`
Expected: aucune sortie.

- [ ] **Step 3: Exécuter contre la vraie base** `[DIFFÉRÉ — humain]`

```bash
node scripts/checkAdminRls.mjs
# preuve complète (compte de test SANS rôle admin) :
TEST_EMAIL=… TEST_PASSWORD=… node scripts/checkAdminRls.mjs
```

Attendu : **toutes les lignes ✅**. Une seule ❌ = ne pas déployer.

- [ ] **Step 4: Commit**

```bash
git add scripts/checkAdminRls.mjs
git commit -m "test(security): checkAdminRls — prouve la RLS contre la vraie base"
```

---

### Task 9: Vérification finale

- [ ] **Step 1: Suite complète**

Run: `npx vitest run`
Expected: 0 échec.

- [ ] **Step 2: Type-check et build**

Run: `npm run type-check && npm run build`
Expected: aucune erreur.

- [ ] **Step 3: Vérifier qu'aucune décision de sécurité ne dépend du front**

Run: `grep -rn "isAdmin\|isOwner" src/ --include=*.ts --include=*.vue | grep -v __tests__`
Attendu : uniquement de l'aiguillage d'UI (garde de route, affichage conditionnel). **Aucune**
occurrence ne doit conditionner la forme d'une requête ou servir de substitut à la RLS.

- [ ] **Step 4: E2E — la garde tient sur le vrai routeur**

Ajouter à la fin de `e2e/app.spec.ts` :

```ts
test("l'administration est fermée à un visiteur anonyme", async ({ page }) => {
  await page.goto("/admin");
  // Le garde renvoie vers l'authentification en conservant la destination.
  await expect(page).toHaveURL(/\/auth\?redirect=%2Fadmin/);
});

test("l'écran Accès réservé est atteignable et explicite", async ({ page }) => {
  await page.goto("/acces-refuse");
  await expect(
    page.getByRole("heading", { name: "Accès réservé" }),
  ).toBeVisible();
});
```

Run: `npm run build && npm run test:e2e -- --workers=1`
Expected: tous les tests passent, dont les deux nouveaux.

> Ces deux tests ne dépendent d'**aucune donnée** : la base E2E est vide et aucun admin
> n'existe. Le cas « connecté non-admin » est couvert par les tests unitaires du routeur
> (Task 4) et, en réel, par `checkAdminRls.mjs`.

- [ ] **Step 5: Documentation**

Dans `CLAUDE.md`, section « Auth & Sync », ajouter :

```markdown
- **Rôles** : `profiles.role` ∈ `user` | `admin` | `owner`. `owner` gère les comptes (posé UNE fois en SQL) ; `admin` édite règles et errata. Gardes de route `requiresAdmin` / `requiresOwner`, mais **la sécurité réelle est la RLS** (`is_admin()` / `is_owner()`) — `authStore.isAdmin` ne sert qu'à l'affichage. `role` n'est écrivable ni en `update` ni en `insert` via l'API (double `revoke` de colonne, migration `0013`) : seule la RPC `set_user_role()` l'attribue, et `owner` n'est jamais attribuable. Journal `admin_audit` append-only, écrit par des **triggers**. Preuve de la sécurité : `node scripts/checkAdminRls.mjs`.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md e2e/app.spec.ts
git commit -m "docs: socle de rôles d'administration"
```
