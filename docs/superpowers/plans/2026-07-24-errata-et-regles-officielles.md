# Errata consultables & Règles officielles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les errata découvrables (page liste + badge sur les cartes) et publier les règles officielles complètes (79 sections ancrées par numéro), le tout servi depuis Supabase.

**Architecture :** Deux nouvelles tables Supabase (`rules`, `card_errata`) en lecture publique (anon) / écriture `service_role`. Le contenu est importé par des scripts (scrape des règles officielles ; migration one-shot d'`errata.json`) puis servi au front par deux services symétriques qui chargent l'index complet **une seule fois** et le mettent en cache (mémoire + `localStorage`), exactement comme `cardLoader`. Deux nouvelles vues lazy-loadées consomment ces services. Les 1585 cartes restent en JSON statique.

**Tech Stack :** Vue 3 `<script setup lang="ts">`, Pinia, Vitest + @vue/test-utils, Zod, Supabase JS, cheerio (scrape), Playwright (E2E), Tailwind + DaisyUI.

**Spec de référence :** `docs/superpowers/specs/2026-07-24-errata-et-regles-officielles-design.md`

## Global Constraints

- UI en **français**, code en **anglais**. Descriptions de test : `it("devrait …")`.
- TypeScript strict, **pas d'`enum`** (maps `as const`). Pas de classes.
- Types canoniques dans `src/types/` ; **Zod = source unique** (`src/schema/`, types via `z.infer`).
- `npm run type-check` (vue-tsc) est **le seul gate de types** — il doit rester vert.
- Lecture RLS des deux nouvelles tables : `using (true)` (**anon inclus**) ; écriture `service_role` uniquement.
- `supabase` peut être `null` (backend non configuré) : **tout service doit dégrader sans lancer d'exception**.
- Les 4 consommateurs d'`errataService` (`CardZoomInner.vue`, `CardZoomModal.vue`, `CardHoverPreview.vue`, `CollectionView.vue`) **ne doivent pas changer leurs appels à `errataService`** : `fetchErrata` / `getErrata` gardent signature et sémantique, et les tests existants de ces 4 fichiers doivent rester verts sans être réécrits. Ces fichiers peuvent en revanche être modifiés pour d'autres raisons prévues au plan (badge en Task 10, lecture de `?q=` en Task 8) — ce n'est pas une violation.
- Ne **pas** déplacer les cartes (`public/data/*.json`) en base.
- Migrations : SQL **idempotent**, applicable au SQL Editor (convention du projet).
- Seed via Management API (`SUPABASE_MGMT_TOKEN`, `PROJECT_REF`), patron de `scripts/seedCardsViaManagement.mjs`.

> ## ⛔ Étapes DIFFÉRÉES — décision d'exécution 2026-07-24
>
> **Aucun agent ne dispose des accès Supabase.** Toute étape marquée
> **`[DIFFÉRÉ — humain]`** ci-dessous ne doit **PAS** être exécutée par un
> implémenteur : il écrit le fichier, vérifie ce qui est vérifiable hors base
> (lint, types, tests unitaires avec Supabase mocké), puis **passe à l'étape
> suivante** en le signalant dans son rapport. Ne jamais tenter d'appliquer une
> migration, de lancer un seed, ni de deviner un token.
>
> **`public/data/errata.json` ne doit être supprimé sous AUCUN prétexte** dans
> cette exécution : c'est l'unique copie des 66 errata tant que le seed n'a pas
> été vérifié en base par l'humain. La suppression fera l'objet d'un commit
> séparé, plus tard.

---

### Task 1: Migration SQL — tables `rules` et `card_errata`

**Files:**

- Create: `supabase/migrations/0012_rules_errata.sql`

**Interfaces:**

- Consumes: rien.
- Produces: tables `public.rules(number, kind, chapter, title, body, sort_order, updated_at)` et `public.card_errata(id, card_id, errata_date, source, summary, before_text, after_text, sort_order, updated_at)`.

- [ ] **Step 1: Écrire la migration**

```sql
-- =============================================================================
-- Wakfu Deck Builder — règles officielles + errata (Phase 1)
-- =============================================================================
-- Contenu CURÉ et éditable par des humains (Phase 2 : édition admin) → en base.
-- Les 1585 cartes restent en JSON statique (compile-effects / CACHE_KEY).
-- Lecture PUBLIQUE (anon inclus) : la page Règles et les badges doivent
-- fonctionner sans compte — différence assumée avec `cards` (0008), qui est
-- réservée aux authentifiés. Écriture : service_role uniquement (le seed).
-- Idempotent : rejouable sans danger. À appliquer dans le SQL Editor.
-- =============================================================================

create table if not exists public.rules (
  number     text primary key,
  kind       text not null check (kind in ('chapter','section','rule')),
  chapter    int  not null,
  title      text,
  body       text,
  sort_order int  not null,
  updated_at timestamptz not null default now()
);

create index if not exists rules_sort_order_idx on public.rules (sort_order);

create table if not exists public.card_errata (
  id          bigint generated always as identity primary key,
  card_id     text not null,
  errata_date date,
  source      text,
  summary     text not null,
  before_text text,
  after_text  text,
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now()
);

create index if not exists card_errata_card_id_idx on public.card_errata (card_id);

alter table public.rules       enable row level security;
alter table public.card_errata enable row level security;

-- Lecture PUBLIQUE (anon inclus), comme profiles_select_public.
drop policy if exists "rules_select_public" on public.rules;
create policy "rules_select_public" on public.rules
  for select using (true);

drop policy if exists "card_errata_select_public" on public.card_errata;
create policy "card_errata_select_public" on public.card_errata
  for select using (true);

-- Écriture : aucune policy → seul service_role (qui contourne RLS) peut écrire.
-- La policy d'écriture « admin » viendra en Phase 2 sans toucher au schéma.

-- updated_at auto (réutilise public.set_updated_at de 0001_init.sql).
drop trigger if exists rules_set_updated_at on public.rules;
create trigger rules_set_updated_at
  before update on public.rules
  for each row execute function public.set_updated_at();

drop trigger if exists card_errata_set_updated_at on public.card_errata;
create trigger card_errata_set_updated_at
  before update on public.card_errata
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Vérifier l'idempotence** `[DIFFÉRÉ — humain]`

Appliquer le fichier **deux fois** dans le SQL Editor Supabase (Dashboard → SQL Editor → coller → Run).
Attendu : aucune erreur au second passage (`create ... if not exists`, `drop policy if exists`).

- [ ] **Step 3: Vérifier la lecture anonyme** `[DIFFÉRÉ — humain]`

Dans le SQL Editor :

```sql
select tablename, policyname, roles, cmd
from pg_policies
where tablename in ('rules','card_errata');
```

Attendu : deux lignes `cmd = SELECT`, sans restriction de rôle (policy `using (true)`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0012_rules_errata.sql
git commit -m "feat(db): tables rules + card_errata (lecture anon, écriture service_role)"
```

---

### Task 2: Schémas Zod des règles et errata

**Files:**

- Create: `src/schema/rules.ts`
- Modify: `src/schema/index.ts`
- Create: `src/schema/__tests__/rules.spec.ts`

**Interfaces:**

- Consumes: rien.
- Produces: `ruleRowSchema`, `errataRowSchema`, et les types `RuleRow`, `ErrataRow` (via `z.infer`), exportés depuis `@/schema`.

- [ ] **Step 1: Écrire le test qui échoue**

`src/schema/__tests__/rules.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { ruleRowSchema, errataRowSchema } from "../rules";

describe("ruleRowSchema", () => {
  it("devrait accepter une règle valide", () => {
    const ok = ruleRowSchema.safeParse({
      number: "418.5b",
      kind: "rule",
      chapter: 4,
      title: null,
      body: "Pour payer le coût de lancement d'un Allié…",
      sort_order: 512,
    });
    expect(ok.success).toBe(true);
  });

  it("devrait refuser un kind inconnu", () => {
    const ko = ruleRowSchema.safeParse({
      number: "418",
      kind: "paragraphe",
      chapter: 4,
      sort_order: 1,
    });
    expect(ko.success).toBe(false);
  });

  it("devrait refuser un chapitre hors 1..8", () => {
    const ko = ruleRowSchema.safeParse({
      number: "9.1",
      kind: "rule",
      chapter: 9,
      body: "x",
      sort_order: 1,
    });
    expect(ko.success).toBe(false);
  });
});

describe("errataRowSchema", () => {
  it("devrait accepter un errata valide", () => {
    const ok = errataRowSchema.safeParse({
      card_id: "opee-tissoin-incarnam",
      errata_date: "2010-12-01",
      source: "Forum officiel Wakfu",
      summary: "Passe à 6 PA.",
      before_text: "7 PA",
      after_text: "6 PA",
      sort_order: 0,
    });
    expect(ok.success).toBe(true);
  });

  it("devrait refuser un errata sans summary", () => {
    const ko = errataRowSchema.safeParse({
      card_id: "x-incarnam",
      sort_order: 0,
    });
    expect(ko.success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/schema/__tests__/rules.spec.ts`
Expected: FAIL — `Failed to resolve import "../rules"`.

- [ ] **Step 3: Écrire les schémas**

`src/schema/rules.ts` :

```ts
import { z } from "zod";

/** Une ligne de la table `rules` : chapitre, section, ou règle numérotée. */
export const ruleRowSchema = z.object({
  // "4" (chapitre) | "418" (section) | "418.5b" (règle) — ancre de deep-link.
  number: z.string().min(1),
  kind: z.enum(["chapter", "section", "rule"]),
  chapter: z.number().int().min(1).max(8),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  sort_order: z.number().int(),
});

/** Une ligne de la table `card_errata` (un errata rattaché à une carte). */
export const errataRowSchema = z.object({
  card_id: z.string().min(1),
  errata_date: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  summary: z.string().min(1),
  before_text: z.string().nullable().optional(),
  after_text: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export type RuleRow = z.infer<typeof ruleRowSchema>;
export type ErrataRow = z.infer<typeof errataRowSchema>;
```

- [ ] **Step 4: Exporter depuis le barrel**

Ajouter à la fin de `src/schema/index.ts` :

```ts
export * from "./rules";
```

- [ ] **Step 5: Lancer les tests + type-check**

Run: `npx vitest run src/schema/__tests__/rules.spec.ts && npm run type-check`
Expected: 5 tests PASS, type-check sans erreur.

- [ ] **Step 6: Commit**

```bash
git add src/schema/rules.ts src/schema/index.ts src/schema/__tests__/rules.spec.ts
git commit -m "feat(schema): ruleRowSchema + errataRowSchema (Zod = source unique)"
```

---

### Task 3: `errataService` — source Supabase + `hasErrata`

**Files:**

- Modify: `src/services/errataService.ts`
- Create: `src/services/__tests__/errataService.spec.ts`

**Interfaces:**

- Consumes: `errataRowSchema` (Task 2), `supabase` (`@/services/supabase`).
- Produces: API publique **inchangée** — `preloadErrata(): Promise<void>`, `getErrata(cardId): ErrataEntry[]` (synchrone), `fetchErrata(cardId): Promise<ErrataEntry[]>`, type `ErrataEntry` ; **plus** `hasErrata(cardId): boolean` et `getAllErrata(): Record<string, ErrataEntry[]>`.

> **Attention :** les signatures existantes doivent rester **strictement identiques** — les 4 consommateurs ne sont pas modifiés. Seul le corps d'`ensureLoaded()` change.

- [ ] **Step 1: Écrire le test qui échoue**

`src/services/__tests__/errataService.spec.ts` :

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

let supabaseStub: any = null;

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));

import {
  preloadErrata,
  getErrata,
  fetchErrata,
  hasErrata,
  __resetErrataCache,
} from "@/services/errataService";

/** Stub Supabase : supabase.from("card_errata").select("*") → { data, error }. */
function stubRows(rows: unknown[], error: unknown = null) {
  supabaseStub = {
    from: () => ({ select: () => Promise.resolve({ data: rows, error }) }),
  };
}

const ROW = {
  card_id: "opee-tissoin-incarnam",
  errata_date: "2010-12-01",
  source: "Forum officiel Wakfu",
  summary: "Passe à 6 PA.",
  before_text: "7 PA",
  after_text: "6 PA",
  sort_order: 0,
};

describe("errataService — source Supabase", () => {
  beforeEach(() => {
    supabaseStub = null;
    __resetErrataCache();
  });

  it("devrait indexer les errata par card_id après préchargement", async () => {
    stubRows([ROW]);
    await preloadErrata();
    const list = getErrata("opee-tissoin-incarnam");
    expect(list).toHaveLength(1);
    expect(list[0].summary).toBe("Passe à 6 PA.");
    expect(list[0].before).toBe("7 PA");
    expect(list[0].after).toBe("6 PA");
  });

  it("devrait exposer hasErrata en O(1) sur l'index", async () => {
    stubRows([ROW]);
    await preloadErrata();
    expect(hasErrata("opee-tissoin-incarnam")).toBe(true);
    expect(hasErrata("bouftou-incarnam")).toBe(false);
  });

  it("devrait ne charger qu'UNE fois (index complet, pas de requête par carte)", async () => {
    let calls = 0;
    supabaseStub = {
      from: () => ({
        select: () => {
          calls++;
          return Promise.resolve({ data: [ROW], error: null });
        },
      }),
    };
    await preloadErrata();
    await fetchErrata("opee-tissoin-incarnam");
    await fetchErrata("bouftou-incarnam");
    expect(calls).toBe(1);
  });

  it("devrait dégrader silencieusement si Supabase n'est pas configuré", async () => {
    supabaseStub = null;
    await expect(preloadErrata()).resolves.toBeUndefined();
    expect(getErrata("opee-tissoin-incarnam")).toEqual([]);
    expect(hasErrata("opee-tissoin-incarnam")).toBe(false);
  });

  it("devrait dégrader silencieusement si la requête échoue", async () => {
    stubRows(null, { message: "boom" });
    await preloadErrata();
    expect(getErrata("opee-tissoin-incarnam")).toEqual([]);
  });

  it("devrait ignorer une ligne invalide sans casser les autres", async () => {
    stubRows([ROW, { card_id: "x-incarnam" }]); // 2e ligne : summary manquant
    await preloadErrata();
    expect(hasErrata("opee-tissoin-incarnam")).toBe(true);
    expect(hasErrata("x-incarnam")).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/services/__tests__/errataService.spec.ts`
Expected: FAIL — `hasErrata` et `__resetErrataCache` ne sont pas exportés.

- [ ] **Step 3: Réécrire le service (source uniquement)**

Remplacer intégralement `src/services/errataService.ts` :

```ts
/**
 * Service d'erratas — charge l'index COMPLET une seule fois depuis Supabase
 * (table `card_errata`) et l'expose par identifiant de carte.
 *
 * L'index entier est chargé en un seul appel : afficher un badge « Erraté » sur
 * la grille imposerait sinon d'interroger les 1585 cartes une par une.
 *
 * Dégradation : Supabase absent / requête en échec / ligne invalide → index vide
 * ou ligne ignorée, JAMAIS d'exception (une panne d'errata ne doit pas casser la
 * collection ni le deck builder).
 */
import { supabase } from "@/services/supabase";
import { errataRowSchema } from "@/schema";

export interface ErrataEntry {
  date: string;
  source?: string;
  summary: string;
  before?: string;
  after?: string;
  url?: string;
}

let cache: Record<string, ErrataEntry[]> | null = null;
let loading: Promise<void> | null = null;

/** Réinitialise le cache — tests uniquement. */
export function __resetErrataCache(): void {
  cache = null;
  loading = null;
}

async function load(): Promise<void> {
  if (!supabase) {
    cache = {};
    return;
  }
  try {
    const { data, error } = await supabase.from("card_errata").select("*");
    if (error || !Array.isArray(data)) {
      cache = {};
      return;
    }
    const index: Record<string, ErrataEntry[]> = {};
    for (const raw of data) {
      const parsed = errataRowSchema.safeParse(raw);
      if (!parsed.success) continue; // ligne invalide → ignorée
      const r = parsed.data;
      (index[r.card_id] ??= []).push({
        date: r.errata_date ?? "",
        source: r.source ?? undefined,
        summary: r.summary,
        before: r.before_text ?? undefined,
        after: r.after_text ?? undefined,
      });
    }
    cache = index;
  } catch {
    cache = {};
  }
}

async function ensureLoaded(): Promise<void> {
  if (cache) return;
  loading ??= load();
  await loading;
}

/** Précharge les erratas (à appeler au démarrage, facultatif). */
export async function preloadErrata(): Promise<void> {
  await ensureLoaded();
}

/** Erratas d'une carte (vide si aucun / non chargé). Synchrone. */
export function getErrata(cardId: string): ErrataEntry[] {
  return cache?.[cardId] ?? [];
}

/** Variante asynchrone qui garantit le chargement. */
export async function fetchErrata(cardId: string): Promise<ErrataEntry[]> {
  await ensureLoaded();
  return getErrata(cardId);
}

/** Prédicat du badge « Erraté » — O(1) sur l'index déjà chargé. */
export function hasErrata(cardId: string): boolean {
  return (cache?.[cardId]?.length ?? 0) > 0;
}

/** Index complet (page /errata). Vide si non chargé. */
export function getAllErrata(): Record<string, ErrataEntry[]> {
  return cache ?? {};
}
```

- [ ] **Step 4: Lancer les tests du service**

Run: `npx vitest run src/services/__tests__/errataService.spec.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Vérifier le filet de régression des 4 consommateurs**

Run: `npx vitest run src/components/card src/views 2>&1 | tail -20`
Expected: PASS. Si un test échouait parce qu'il moquait `fetch("/data/errata.json")`, adapter **le mock du test** (pas le composant) vers le stub Supabase du Step 1.

- [ ] **Step 6: Commit**

```bash
git add src/services/errataService.ts src/services/__tests__/errataService.spec.ts
git commit -m "feat(errata): source Supabase + hasErrata (API publique inchangée)"
```

---

### Task 4: Seed `card_errata` depuis `errata.json`, puis suppression du JSON

**Files:**

- Create: `scripts/seedErrata.mjs`
- Delete: `public/data/errata.json`, `schemas/errata.schema.json`

**Interfaces:**

- Consumes: `public/data/errata.json` (avant suppression), table `card_errata` (Task 1).
- Produces: table `card_errata` peuplée (66 lignes).

> **Ordre impératif :** seed **puis** vérification **puis** suppression. Ne jamais supprimer le JSON avant d'avoir vérifié le contenu en base — c'est la seule copie de la donnée.

- [ ] **Step 1: Écrire le script de seed**

`scripts/seedErrata.mjs` :

```js
/**
 * Migration one-shot : public/data/errata.json → table `card_errata`.
 *
 * Passe par la Management API (superuser → contourne la RLS, l'écriture étant
 * réservée au service_role), comme scripts/seedCardsViaManagement.mjs.
 *
 * Idempotent : purge la table puis ré-insère (66 lignes, coût négligeable).
 * Usage : SUPABASE_MGMT_TOKEN=sbp_… PROJECT_REF=… node scripts/seedErrata.mjs
 */
import { readFileSync } from "node:fs";

const REF = process.env.PROJECT_REF ?? "ehqalhzvmgkepgbaxbzu";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) {
  console.error("Erreur : SUPABASE_MGMT_TOKEN (token sbp_…) manquant.");
  process.exit(1);
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const qOrNull = (s) =>
  s === undefined || s === null || s === "" ? "NULL" : q(s);

/** "13/10/2009" → "2009-10-13" (date SQL). Retourne NULL si non parsable. */
function toSqlDate(fr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(fr ?? ""));
  return m ? `'${m[3]}-${m[2]}-${m[1]}'` : "NULL";
}

async function runSql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  if (!res.ok) {
    console.error("SQL error", res.status, await res.text());
    process.exit(1);
  }
  return res.json();
}

const file = JSON.parse(readFileSync("public/data/errata.json", "utf8"));
const rows = [];
for (const [cardId, list] of Object.entries(file.errata ?? {})) {
  list.forEach((e, i) => {
    if (!e?.summary) {
      console.error(`Errata sans summary pour ${cardId} — abandon.`);
      process.exit(1);
    }
    rows.push(
      `(${q(cardId)}, ${toSqlDate(e.date)}, ${qOrNull(e.source)}, ` +
        `${q(e.summary)}, ${qOrNull(e.before)}, ${qOrNull(e.after)}, ${i})`,
    );
  });
}

if (rows.length === 0) {
  console.error("Aucun errata trouvé — abandon.");
  process.exit(1);
}

await runSql("delete from public.card_errata;");
await runSql(
  "insert into public.card_errata " +
    "(card_id, errata_date, source, summary, before_text, after_text, sort_order) values " +
    rows.join(",\n") +
    ";",
);

const check = await runSql(
  "select count(*)::int as n from public.card_errata;",
);
console.log(
  `Seed terminé : ${rows.length} lignes envoyées, ${JSON.stringify(check)} en base.`,
);
```

- [ ] **Step 2: Exécuter le seed** `[DIFFÉRÉ — humain]`

```bash
SUPABASE_MGMT_TOKEN=<token sbp_…> node scripts/seedErrata.mjs
```

Expected: `Seed terminé : 66 lignes envoyées, [{"n":66}] en base.`

- [ ] **Step 3: Vérifier les deux cartes du rapport** `[DIFFÉRÉ — humain]`

Dans le SQL Editor :

```sql
select card_id, errata_date, summary
from public.card_errata
where card_id in ('opee-tissoin-incarnam','aeron-zeklox-incarnam');
```

Expected: 2 lignes, `errata_date` non nulle.

- [ ] **Step 4: Supprimer le JSON** `[DIFFÉRÉ — humain]` ⛔ NE PAS EXÉCUTER

```bash
git rm public/data/errata.json schemas/errata.schema.json
```

- [ ] **Step 5: Vérifier qu'aucune référence ne subsiste** `[DIFFÉRÉ — humain]`

Ne vaut qu'APRÈS la suppression du JSON (elle-même différée). À ce stade, vérifier
seulement que **le code applicatif** ne lit plus le fichier :

Run: `grep -rn "data/errata.json" src/`
Expected: aucune sortie (seul `scripts/seedErrata.mjs` peut encore le lire).

- [ ] **Step 6: Lancer la suite complète**

Run: `npx vitest run 2>&1 | tail -5`
Expected: 0 failure.

- [ ] **Step 7: Commit**

```bash
git add scripts/seedErrata.mjs
git commit -m "feat(errata): migration errata.json -> table card_errata, JSON supprimé"
```

---

### Task 5: `scrapeRules.ts` — parser les règles officielles

**Files:**

- Create: `scripts/scrapeRules.ts`
- Create: `raw-card-data/pages/regles/completes.html` (téléchargé, versionné)
- Create: `scripts/__tests__/scrapeRules.spec.ts`

**Interfaces:**

- Consumes: rien.
- Produces: `parseRules(html: string): RuleRow[]` exportée depuis `scripts/scrapeRules.ts`, consommée par Task 6.

- [ ] **Step 1: Télécharger la page brute**

```bash
mkdir -p raw-card-data/pages/regles
# --ssl-no-revoke : sous Windows/schannel, la vérification de révocation du
# certificat échoue (CRYPT_E_NO_REVOCATION_CHECK) et curl abandonne. Vérifié.
curl -sSL --ssl-no-revoke https://www.wtcg-return.fr/regles/completes -o raw-card-data/pages/regles/completes.html
wc -c raw-card-data/pages/regles/completes.html
```

Expected: fichier non vide (> 50 000 octets).

- [ ] **Step 2: Écrire le test qui échoue**

`scripts/__tests__/scrapeRules.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { parseRules } from "../scrapeRules";

const HTML = `
<h2>4. Concepts de Jeu</h2>
<h3>418. Ressources et Coûts</h3>
<p>418.1 Une ressource est une unité d'énergie magique.</p>
<p>418.5 Pour payer un coût en ressources, le joueur doit dépenser.</p>
<p>418.5a Un coût en ressources d'Elément Neutre peut être payé.</p>
<p>418.5b Pour payer le coût de lancement d'un Allié, le joueur doit.</p>
`;

describe("parseRules", () => {
  it("devrait extraire le chapitre, la section et les règles numérotées", () => {
    const rows = parseRules(HTML);
    const numbers = rows.map((r) => r.number);
    expect(numbers).toEqual(["4", "418", "418.1", "418.5", "418.5a", "418.5b"]);
  });

  it("devrait typer chaque ligne (chapter / section / rule)", () => {
    const rows = parseRules(HTML);
    expect(rows.find((r) => r.number === "4")?.kind).toBe("chapter");
    expect(rows.find((r) => r.number === "418")?.kind).toBe("section");
    expect(rows.find((r) => r.number === "418.5b")?.kind).toBe("rule");
  });

  it("devrait rattacher chaque ligne à son chapitre", () => {
    const rows = parseRules(HTML);
    expect(rows.every((r) => r.chapter === 4)).toBe(true);
  });

  it("devrait conserver le titre des sections et le corps des règles", () => {
    const rows = parseRules(HTML);
    expect(rows.find((r) => r.number === "418")?.title).toBe(
      "Ressources et Coûts",
    );
    expect(rows.find((r) => r.number === "418.1")?.body).toContain(
      "unité d'énergie",
    );
  });

  it("devrait numéroter sort_order dans l'ordre de lecture", () => {
    const rows = parseRules(HTML);
    const orders = rows.map((r) => r.sort_order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });
});
```

- [ ] **Step 3: Lancer le test pour le voir échouer**

Run: `npx vitest run scripts/__tests__/scrapeRules.spec.ts`
Expected: FAIL — `Failed to resolve import "../scrapeRules"`.

- [ ] **Step 4: Écrire le parser**

`scripts/scrapeRules.ts` :

```ts
/**
 * Scrape des règles officielles (wtcg-return.fr/regles/completes) vers des
 * lignes `rules`. Le repère fiable est le NUMÉRO en tête de texte
 * ("4.", "418.", "418.5b") — on ne dépend donc pas des balises exactes.
 *
 * Usage : npx tsx scripts/scrapeRules.ts   (écrit le JSON sur stdout)
 */
import * as cheerio from "cheerio";
import { readFileSync } from "node:fs";
import type { RuleRow } from "../src/schema/rules";

const CHAPTER_RE = /^(\d)\.\s+(.+)$/; //  "4. Concepts de Jeu"
const SECTION_RE = /^(\d{3})\.\s+(.+)$/; //  "418. Ressources et Coûts"
const RULE_RE = /^(\d{3}\.\d+[a-z]?)\s+(.+)$/s; //  "418.5b Pour payer…"

/** Convertit le HTML des règles complètes en lignes prêtes pour la table. */
export function parseRules(html: string): RuleRow[] {
  const $ = cheerio.load(html);
  const rows: RuleRow[] = [];
  let chapter = 0;
  let order = 0;

  $("h1, h2, h3, h4, p, li").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;

    const chap = CHAPTER_RE.exec(text);
    if (chap) {
      chapter = Number(chap[1]);
      rows.push({
        number: chap[1],
        kind: "chapter",
        chapter,
        title: chap[2].trim(),
        body: null,
        sort_order: order++,
      });
      return;
    }

    const sec = SECTION_RE.exec(text);
    if (sec) {
      rows.push({
        number: sec[1],
        kind: "section",
        chapter: chapter || Number(sec[1][0]),
        title: sec[2].trim(),
        body: null,
        sort_order: order++,
      });
      return;
    }

    const rule = RULE_RE.exec(text);
    if (rule) {
      rows.push({
        number: rule[1],
        kind: "rule",
        chapter: chapter || Number(rule[1][0]),
        title: null,
        body: rule[2].trim(),
        sort_order: order++,
      });
    }
  });

  // Dédoublonnage défensif : le sommaire répète les titres en tête de page.
  const seen = new Set<string>();
  return rows.filter((r) => !seen.has(r.number) && seen.add(r.number));
}

// Exécution directe : lit le HTML brut versionné et imprime le JSON.
if (process.argv[1]?.endsWith("scrapeRules.ts")) {
  const html = readFileSync(
    "raw-card-data/pages/regles/completes.html",
    "utf8",
  );
  const rows = parseRules(html);
  console.error(`Parsé : ${rows.length} lignes.`);
  console.log(JSON.stringify(rows, null, 2));
}
```

- [ ] **Step 5: Lancer les tests**

Run: `npx vitest run scripts/__tests__/scrapeRules.spec.ts`
Expected: 5 tests PASS.

- [ ] **Step 6: Contrôler le parsing sur la vraie page**

```bash
npx tsx scripts/scrapeRules.ts > /tmp/rules.json
node -e "const r=require('/tmp/rules.json');console.log('chapitres',r.filter(x=>x.kind==='chapter').length,'sections',r.filter(x=>x.kind==='section').length,'regles',r.filter(x=>x.kind==='rule').length)"
```

Expected: **8 chapitres** et **79 sections** (valeurs VÉRIFIÉES sur la page réelle). Si l'écart est important, ajuster les regex **avant** de passer à la Task 6 — le seed ne doit jamais peupler la base avec un parsing douteux.

- [ ] **Step 7: Commit**

```bash
git add scripts/scrapeRules.ts scripts/__tests__/scrapeRules.spec.ts raw-card-data/pages/regles/completes.html
git commit -m "feat(rules): scrape des règles officielles -> lignes rules (parser + tests)"
```

---

### Task 6: Seed de la table `rules`

**Files:**

- Create: `scripts/seedRules.mjs`

**Interfaces:**

- Consumes: `parseRules` (Task 5), table `rules` (Task 1).
- Produces: table `rules` peuplée.

- [ ] **Step 1: Écrire le script**

`scripts/seedRules.mjs` :

```js
/**
 * Seed de la table `rules` depuis le HTML brut versionné.
 * Passe par la Management API (superuser → contourne la RLS).
 * Idempotent : purge puis ré-insère.
 * Usage : SUPABASE_MGMT_TOKEN=sbp_… PROJECT_REF=… node scripts/seedRules.mjs
 */
import { execFileSync } from "node:child_process";

const REF = process.env.PROJECT_REF ?? "ehqalhzvmgkepgbaxbzu";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) {
  console.error("Erreur : SUPABASE_MGMT_TOKEN (token sbp_…) manquant.");
  process.exit(1);
}

// Réutilise le parser (source unique) via tsx.
const json = execFileSync("npx", ["tsx", "scripts/scrapeRules.ts"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const rows = JSON.parse(json);

const chapters = rows.filter((r) => r.kind === "chapter").length;
const sections = rows.filter((r) => r.kind === "section").length;
// Le compte de RÈGLES est vérifié séparément : l'extraction des chapitres/sections
// (sur le texte des titres) est structurellement INDÉPENDANTE de celle des règles
// (sur les div.regle-target[id]). Sans ce 3e garde-fou, un renommage de la classe
// côté site donnerait rules=0 tout en passant chapitres=8 / sections=79.
const ruleCount = rows.filter((r) => r.kind === "rule").length;
if (chapters !== 8 || sections < 70 || ruleCount < 400) {
  console.error(
    `Parsing suspect (chapitres=${chapters}, sections=${sections}, regles=${ruleCount}) — seed annulé.`,
  );
  process.exit(1);
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const qOrNull = (s) => (s === undefined || s === null ? "NULL" : q(s));

async function runSql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  if (!res.ok) {
    console.error("SQL error", res.status, await res.text());
    process.exit(1);
  }
  return res.json();
}

const values = rows
  .map(
    (r) =>
      `(${q(r.number)}, ${q(r.kind)}, ${r.chapter}, ${qOrNull(r.title)}, ` +
      `${qOrNull(r.body)}, ${r.sort_order})`,
  )
  .join(",\n");

await runSql("delete from public.rules;");
await runSql(
  "insert into public.rules (number, kind, chapter, title, body, sort_order) values " +
    values +
    ";",
);
const check = await runSql("select count(*)::int as n from public.rules;");
console.log(
  `Seed terminé : ${rows.length} lignes envoyées, ${JSON.stringify(check)} en base.`,
);
```

- [ ] **Step 2: Exécuter le seed**

```bash
SUPABASE_MGMT_TOKEN=<token sbp_…> node scripts/seedRules.mjs
```

Expected: `Seed terminé : N lignes envoyées, [{"n":N}] en base.` avec N > 400.

- [ ] **Step 3: Vérifier une règle citée par le moteur** `[DIFFÉRÉ — humain]`

```sql
select number, kind, chapter, left(body, 60) from public.rules where number = '418.5b';
```

Expected: 1 ligne, `kind = rule`, `chapter = 4`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seedRules.mjs
git commit -m "feat(rules): seed de la table rules via Management API (garde-fou 8 chapitres)"
```

---

### Task 7: `rulesService`

**Files:**

- Create: `src/services/rulesService.ts`
- Create: `src/services/__tests__/rulesService.spec.ts`

**Interfaces:**

- Consumes: `ruleRowSchema` (Task 2), `supabase`.
- Produces: `loadRules(): Promise<RuleRow[]>`, `getRules(): RuleRow[]` (synchrone), `__resetRulesCache()`.

- [ ] **Step 1: Écrire le test qui échoue**

`src/services/__tests__/rulesService.spec.ts` :

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

let supabaseStub: any = null;

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));

import {
  loadRules,
  getRules,
  __resetRulesCache,
} from "@/services/rulesService";

const ROWS = [
  {
    number: "4",
    kind: "chapter",
    chapter: 4,
    title: "Concepts",
    body: null,
    sort_order: 1,
  },
  {
    number: "418",
    kind: "section",
    chapter: 4,
    title: "Ressources",
    body: null,
    sort_order: 2,
  },
  {
    number: "418.5b",
    kind: "rule",
    chapter: 4,
    title: null,
    body: "Allié…",
    sort_order: 3,
  },
];

function stubRows(rows: unknown[], error: unknown = null) {
  supabaseStub = {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: rows, error }) }),
    }),
  };
}

describe("rulesService", () => {
  beforeEach(() => {
    supabaseStub = null;
    __resetRulesCache();
  });

  it("devrait charger les règles triées par sort_order", async () => {
    stubRows(ROWS);
    const rules = await loadRules();
    expect(rules.map((r) => r.number)).toEqual(["4", "418", "418.5b"]);
  });

  it("devrait exposer getRules de façon synchrone après chargement", async () => {
    stubRows(ROWS);
    await loadRules();
    expect(getRules()).toHaveLength(3);
  });

  it("devrait ne charger qu'une seule fois", async () => {
    let calls = 0;
    supabaseStub = {
      from: () => ({
        select: () => ({
          order: () => {
            calls++;
            return Promise.resolve({ data: ROWS, error: null });
          },
        }),
      }),
    };
    await loadRules();
    await loadRules();
    expect(calls).toBe(1);
  });

  it("devrait renvoyer une liste vide si Supabase n'est pas configuré", async () => {
    supabaseStub = null;
    await expect(loadRules()).resolves.toEqual([]);
  });

  it("devrait ignorer une ligne invalide", async () => {
    stubRows([
      ...ROWS,
      { number: "9.9", kind: "rule", chapter: 99, sort_order: 4 },
    ]);
    const rules = await loadRules();
    expect(rules).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/services/__tests__/rulesService.spec.ts`
Expected: FAIL — `Failed to resolve import "@/services/rulesService"`.

- [ ] **Step 3: Écrire le service**

`src/services/rulesService.ts` :

```ts
/**
 * Service des règles officielles — charge la table `rules` UNE seule fois
 * (index complet, trié par sort_order) et l'expose au front.
 *
 * Dégradation : Supabase absent / requête en échec → liste vide, jamais
 * d'exception. La vue affiche alors un état d'erreur explicite.
 */
import { supabase } from "@/services/supabase";
import { ruleRowSchema, type RuleRow } from "@/schema";

let cache: RuleRow[] | null = null;
let loading: Promise<RuleRow[]> | null = null;

/** Réinitialise le cache — tests uniquement. */
export function __resetRulesCache(): void {
  cache = null;
  loading = null;
}

async function load(): Promise<RuleRow[]> {
  if (!supabase) {
    cache = [];
    return cache;
  }
  try {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error || !Array.isArray(data)) {
      cache = [];
      return cache;
    }
    cache = data
      .map((raw) => ruleRowSchema.safeParse(raw))
      .filter((p): p is { success: true; data: RuleRow } => p.success)
      .map((p) => p.data);
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

/** Charge (une fois) et renvoie toutes les règles, dans l'ordre de lecture. */
export async function loadRules(): Promise<RuleRow[]> {
  if (cache) return cache;
  loading ??= load();
  return loading;
}

/** Règles déjà chargées (vide sinon). Synchrone. */
export function getRules(): RuleRow[] {
  return cache ?? [];
}
```

- [ ] **Step 4: Lancer les tests + type-check**

Run: `npx vitest run src/services/__tests__/rulesService.spec.ts && npm run type-check`
Expected: 5 tests PASS, type-check vert.

- [ ] **Step 5: Commit**

```bash
git add src/services/rulesService.ts src/services/__tests__/rulesService.spec.ts
git commit -m "feat(rules): rulesService (index complet, cache, dégradation)"
```

---

### Task 8: Vue `/errata`

**Files:**

- Create: `src/views/ErrataView.vue`
- Modify: `src/router/index.ts`
- Create: `src/views/__tests__/ErrataView.spec.ts`

**Interfaces:**

- Consumes: `preloadErrata`, `getAllErrata` (Task 3), `useCardStore`.
- Produces: route nommée `errata` sur `/errata`.

> **Groupement :** par `card.extension.name` résolu via `cardStore` — **surtout pas** par suffixe d'id (`dofus-collection` → « collection », `bonta-brakmar` → « brakmar » : faux).

- [ ] **Step 1: Écrire le test qui échoue**

`src/views/__tests__/ErrataView.spec.ts` :

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/services/errataService", () => ({
  preloadErrata: () => Promise.resolve(),
  getAllErrata: () => ({
    "opee-tissoin-incarnam": [
      {
        date: "2010-12-01",
        summary: "Passe à 6 PA.",
        before: "7 PA",
        after: "6 PA",
      },
    ],
    "skeunk-amakna": [{ date: "2009-10-13", summary: "Texte clarifié." }],
  }),
}));

import ErrataView from "@/views/ErrataView.vue";
import { useCardStore } from "@/stores/cardStore";

function mountView() {
  const store = useCardStore();
  store.cards = [
    {
      id: "opee-tissoin-incarnam",
      name: "Opée Tissoin",
      mainType: "Allié",
      extension: { name: "Incarnam" },
    },
    {
      id: "skeunk-amakna",
      name: "Skeunk",
      mainType: "Allié",
      extension: { name: "Amakna" },
    },
  ] as any;
  // RouterLink stubbé AVEC son slot : `stubs: { RouterLink: true }` ne rendrait
  // pas le contenu par défaut, et le nom de la carte disparaîtrait de text().
  return mount(ErrataView, {
    global: {
      stubs: { RouterLink: { template: "<a><slot /></a>" } },
    },
  });
}

describe("ErrataView", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("devrait afficher les cartes erratées avec leur résumé", async () => {
    const w = mountView();
    await w.vm.$nextTick();
    expect(w.text()).toContain("Opée Tissoin");
    expect(w.text()).toContain("Passe à 6 PA.");
  });

  it("devrait grouper par extension de la carte (pas par suffixe d'id)", async () => {
    const w = mountView();
    await w.vm.$nextTick();
    expect(w.text()).toContain("Incarnam");
    expect(w.text()).toContain("Amakna");
  });

  it("devrait afficher le avant/après quand il existe", async () => {
    const w = mountView();
    await w.vm.$nextTick();
    expect(w.text()).toContain("7 PA");
    expect(w.text()).toContain("6 PA");
  });

  it("devrait filtrer par nom de carte", async () => {
    const w = mountView();
    await w.vm.$nextTick();
    await w.find('input[type="search"]').setValue("Skeunk");
    expect(w.text()).toContain("Skeunk");
    expect(w.text()).not.toContain("Opée Tissoin");
  });

  it("devrait lier chaque entrée vers la carte", async () => {
    const w = mountView();
    await w.vm.$nextTick();
    expect(w.findAll("a").length).toBeGreaterThan(0);
  });

  it("devrait basculer en tri par date (un seul groupe, récent d'abord)", async () => {
    const w = mountView();
    await w.vm.$nextTick();
    await w.find("select").setValue("date");
    expect(w.findAll("section")).toHaveLength(1);
    // Opée Tissoin (2010-12-01) doit précéder Skeunk (2009-10-13).
    const text = w.text();
    expect(text.indexOf("Opée Tissoin")).toBeLessThan(text.indexOf("Skeunk"));
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/views/__tests__/ErrataView.spec.ts`
Expected: FAIL — `Failed to resolve import "@/views/ErrataView.vue"`.

- [ ] **Step 3: Écrire la vue**

`src/views/ErrataView.vue` :

```vue
<template>
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold">Errata</h1>
    <p class="mt-2 max-w-3xl opacity-80">
      Les cartes dont le texte ou les valeurs ont été officiellement corrigés.
      Une carte errata­ée porte aussi un repère dans la collection et l'atelier
      de deck.
    </p>

    <div class="mt-6 flex flex-wrap items-end gap-4">
      <input
        v-model="query"
        type="search"
        class="input input-bordered w-full max-w-md"
        placeholder="Rechercher une carte…"
        aria-label="Rechercher une carte errataée"
      />
      <select
        v-model="sortMode"
        class="select select-bordered"
        aria-label="Trier les errata"
      >
        <option value="extension">Grouper par extension</option>
        <option value="date">Trier par date (récent d'abord)</option>
      </select>
    </div>

    <p class="mt-4 text-sm opacity-70">{{ total }} carte(s) erratée(s)</p>

    <section v-for="group in groups" :key="group.extension" class="mt-8">
      <h2 class="text-xl font-semibold">{{ group.extension }}</h2>
      <ul class="mt-3 space-y-4">
        <li
          v-for="item in group.items"
          :key="item.cardId"
          class="flex gap-4 rounded-lg border border-base-content/20 p-4"
        >
          <img
            v-if="item.thumb"
            :src="item.thumb"
            :alt="item.name"
            class="h-24 w-auto flex-shrink-0 rounded"
            loading="lazy"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-3">
              <RouterLink
                :to="{ name: 'collection', query: { q: item.name } }"
                class="link font-semibold"
                >{{ item.name }}</RouterLink
              >
              <span v-if="item.entry.date" class="text-sm opacity-70">{{
                item.entry.date
              }}</span>
            </div>
            <p class="mt-1">{{ item.entry.summary }}</p>
            <div
              v-if="item.entry.before || item.entry.after"
              class="mt-2 text-sm"
            >
              <p v-if="item.entry.before">
                <span class="opacity-70">Avant :</span> {{ item.entry.before }}
              </p>
              <p v-if="item.entry.after">
                <span class="opacity-70">Après :</span> {{ item.entry.after }}
              </p>
            </div>
            <p v-if="item.entry.source" class="mt-2 text-xs opacity-60">
              Source : {{ item.entry.source }}
            </p>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  preloadErrata,
  getAllErrata,
  type ErrataEntry,
} from "@/services/errataService";
import { useCardStore } from "@/stores/cardStore";
import { matchesSearch } from "@/utils/text";
import { getThumbPath } from "@/utils/imagePaths";

const cardStore = useCardStore();
const query = ref("");
const sortMode = ref<"extension" | "date">("extension");
const loaded = ref(0); // incrémenté après préchargement pour recalculer

onMounted(async () => {
  await preloadErrata();
  loaded.value++;
});

interface Item {
  cardId: string;
  name: string;
  extension: string;
  thumb: string | null;
  entry: ErrataEntry;
}

const items = computed<Item[]>(() => {
  void loaded.value;
  const byId = new Map(cardStore.cards.map((c) => [c.id, c]));
  const out: Item[] = [];
  for (const [cardId, list] of Object.entries(getAllErrata())) {
    const card = byId.get(cardId);
    for (const entry of list) {
      out.push({
        cardId,
        name: card?.name ?? cardId,
        // Extension RÉELLE de la carte — le suffixe d'id est trompeur.
        extension: card?.extension?.name ?? "Autre",
        thumb: card?.imageUrl ? getThumbPath(card.imageUrl) : null,
        entry,
      });
    }
  }
  return out;
});

const filtered = computed(() =>
  query.value
    ? items.value.filter((i) => matchesSearch(i.name, query.value))
    : items.value,
);

const total = computed(() => filtered.value.length);

const groups = computed(() => {
  // Tri par date : un seul groupe, du plus récent au plus ancien. Les dates
  // arrivent en "YYYY-MM-DD" (colonne `date` Postgres) → tri lexicographique OK.
  if (sortMode.value === "date") {
    return [
      {
        extension: "Toutes extensions, du plus récent",
        items: [...filtered.value].sort((a, b) =>
          (b.entry.date ?? "").localeCompare(a.entry.date ?? ""),
        ),
      },
    ];
  }
  const map = new Map<string, Item[]>();
  for (const i of filtered.value) {
    const list = map.get(i.extension) ?? [];
    list.push(i);
    map.set(i.extension, list);
  }
  return [...map.entries()]
    .map(([extension, list]) => ({
      extension,
      items: [...list].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }))
    .sort((a, b) => a.extension.localeCompare(b.extension, "fr"));
});
</script>
```

- [ ] **Step 4: Déclarer la route**

Dans `src/router/index.ts`, après l'entrée `/regles/apprendre` :

```ts
    {
      path: "/errata",
      name: "errata",
      component: () => import("@/views/ErrataView.vue"),
      meta: { guest: true },
    },
```

- [ ] **Step 5: Faire lire `?q=` par la collection (sinon le lien ne sert à rien)**

`CollectionView.vue` importe `useRouter` mais **pas** `useRoute` : sans ça, le lien
`{ name: 'collection', query: { q: … } }` navigue sans pré-remplir la recherche.

Dans `src/views/CollectionView.vue`, ajouter à l'import vue-router existant :

```ts
import { useRouter, useRoute } from "vue-router";
```

puis, juste après `const router = useRouter();` :

```ts
const route = useRoute();
// Pré-remplit la recherche depuis ?q= (lien « voir la carte » depuis /errata).
if (typeof route.query.q === "string") searchQuery.value = route.query.q;
```

> Placer ces lignes **après** la déclaration de `searchQuery` (sinon TDZ).

- [ ] **Step 6: Vérifier le pré-remplissage**

Run: `npx vitest run src/views/__tests__ && npm run type-check`
Expected: PASS, type-check vert.

- [ ] **Step 7: Lancer les tests + type-check**

Run: `npx vitest run src/views/__tests__/ErrataView.spec.ts && npm run type-check`
Expected: 6 tests PASS, type-check vert.

- [ ] **Step 8: Commit**

```bash
git add src/views/ErrataView.vue src/views/__tests__/ErrataView.spec.ts src/router/index.ts src/views/CollectionView.vue
git commit -m "feat(errata): page /errata groupée par extension, avec recherche et avant/après"
```

---

### Task 9: Vue `/regles/officielles`

**Files:**

- Create: `src/views/RulesOfficialView.vue`
- Modify: `src/router/index.ts`, `src/views/RulesView.vue`
- Create: `src/views/__tests__/RulesOfficialView.spec.ts`

**Interfaces:**

- Consumes: `loadRules`, `getRules` (Task 7).
- Produces: route nommée `rulesOfficial` sur `/regles/officielles`.

- [ ] **Step 1: Écrire le test qui échoue**

`src/views/__tests__/RulesOfficialView.spec.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

const ROWS = [
  {
    number: "4",
    kind: "chapter",
    chapter: 4,
    title: "Concepts de Jeu",
    body: null,
    sort_order: 1,
  },
  {
    number: "418",
    kind: "section",
    chapter: 4,
    title: "Ressources et Coûts",
    body: null,
    sort_order: 2,
  },
  {
    number: "418.5b",
    kind: "rule",
    chapter: 4,
    title: null,
    body: "Pour payer le coût d'un Allié.",
    sort_order: 3,
  },
];

vi.mock("@/services/rulesService", () => ({
  loadRules: () => Promise.resolve(ROWS),
  getRules: () => ROWS,
}));

import RulesOfficialView from "@/views/RulesOfficialView.vue";

describe("RulesOfficialView", () => {
  it("devrait afficher les chapitres, sections et règles", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    expect(w.text()).toContain("Concepts de Jeu");
    expect(w.text()).toContain("Ressources et Coûts");
    expect(w.text()).toContain("Pour payer le coût d'un Allié.");
  });

  it("devrait ancrer chaque règle par son numéro (deep-link)", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    expect(w.find("#418\\.5b").exists()).toBe(true);
  });

  it("devrait filtrer par recherche plein-texte", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    await w.find('input[type="search"]').setValue("Ressources");
    expect(w.text()).toContain("Ressources et Coûts");
    expect(w.text()).not.toContain("Pour payer le coût d'un Allié.");
  });

  it("devrait afficher l'attribution de la source", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    expect(w.text()).toContain("wtcg-return.fr");
  });

  it("devrait afficher un sommaire des chapitres avec ancres", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    const nav = w.find('nav[aria-label="Sommaire"]');
    expect(nav.exists()).toBe(true);
    expect(nav.find('a[href="#4"]').exists()).toBe(true);
  });

  it("devrait masquer le sommaire pendant une recherche", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    await w.find('input[type="search"]').setValue("Ressources");
    expect(w.find('nav[aria-label="Sommaire"]').exists()).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/views/__tests__/RulesOfficialView.spec.ts`
Expected: FAIL — `Failed to resolve import "@/views/RulesOfficialView.vue"`.

- [ ] **Step 3: Écrire la vue**

`src/views/RulesOfficialView.vue` :

```vue
<template>
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold">Règles officielles</h1>
    <p class="mt-2 max-w-3xl opacity-80">
      Texte intégral des règles officielles du Wakfu TCG (édition Return).
      Chaque règle est adressable par son numéro : partagez un lien du type
      <code>/regles/officielles#418.5b</code>.
    </p>
    <p class="mt-2 text-sm opacity-70">
      Source :
      <a
        class="link"
        href="https://www.wtcg-return.fr/regles/completes"
        target="_blank"
        rel="noopener"
        >wtcg-return.fr/regles/completes</a
      >
    </p>

    <input
      v-model="query"
      type="search"
      class="input input-bordered mt-6 w-full max-w-md"
      placeholder="Rechercher dans les règles…"
      aria-label="Rechercher dans les règles"
    />

    <p v-if="failed" class="mt-6 alert alert-warning">
      Règles indisponibles — vérifiez votre connexion.
    </p>

    <!-- Sommaire : 8 chapitres, ancres internes. Masqué pendant une recherche
         (le sommaire n'aurait plus de rapport avec la liste filtrée). -->
    <nav v-if="!query && chapters.length" class="mt-6" aria-label="Sommaire">
      <h2 class="text-lg font-semibold">Sommaire</h2>
      <ol class="mt-2 space-y-1">
        <li v-for="c in chapters" :key="c.number">
          <a :href="`#${c.number}`" class="link"
            >{{ c.number }}. {{ c.title }}</a
          >
        </li>
      </ol>
    </nav>

    <div
      v-for="row in visible"
      :key="row.number"
      :id="row.number"
      class="mt-4 scroll-mt-24"
    >
      <h2 v-if="row.kind === 'chapter'" class="mt-8 text-2xl font-bold">
        {{ row.number }}. {{ row.title }}
      </h2>
      <h3 v-else-if="row.kind === 'section'" class="mt-6 text-xl font-semibold">
        {{ row.number }}. {{ row.title }}
      </h3>
      <p v-else class="leading-relaxed">
        <span class="font-mono text-sm opacity-70">{{ row.number }}</span>
        {{ row.body }}
      </p>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { loadRules, getRules } from "@/services/rulesService";
import { matchesSearch } from "@/utils/text";
import type { RuleRow } from "@/schema";

const query = ref("");
const rows = ref<RuleRow[]>(getRules());
const failed = ref(false);

onMounted(async () => {
  rows.value = await loadRules();
  failed.value = rows.value.length === 0;
  // Deep-link : le contenu arrive après le montage, on re-scrolle vers l'ancre.
  const hash = decodeURIComponent(window.location.hash.slice(1));
  if (hash) {
    await new Promise((r) => setTimeout(r, 0));
    document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
  }
});

const visible = computed(() =>
  query.value
    ? rows.value.filter((r) =>
        matchesSearch(
          `${r.number} ${r.title ?? ""} ${r.body ?? ""}`,
          query.value,
        ),
      )
    : rows.value,
);

/** Les 8 chapitres, pour le sommaire. */
const chapters = computed(() => rows.value.filter((r) => r.kind === "chapter"));
</script>
```

- [ ] **Step 4: Déclarer la route**

Dans `src/router/index.ts`, après `/regles/apprendre` :

```ts
    {
      path: "/regles/officielles",
      name: "rulesOfficial",
      component: () => import("@/views/RulesOfficialView.vue"),
      meta: { guest: true },
    },
```

- [ ] **Step 5: Lier depuis `/regles`**

Dans le `<template>` de `src/views/RulesView.vue`, juste après le `<h1>` :

```vue
<RouterLink to="/regles/officielles" class="link link-primary">
      Consulter les règles officielles complètes →
    </RouterLink>
```

- [ ] **Step 6: Lancer les tests + type-check**

Run: `npx vitest run src/views/__tests__/RulesOfficialView.spec.ts && npm run type-check`
Expected: 4 tests PASS, type-check vert.

- [ ] **Step 7: Commit**

```bash
git add src/views/RulesOfficialView.vue src/views/__tests__/RulesOfficialView.spec.ts src/router/index.ts src/views/RulesView.vue
git commit -m "feat(rules): page /regles/officielles (ancres par numéro, recherche, attribution)"
```

---

### Task 10: Badge « Erraté »

**Files:**

- Create: `src/components/card/ErrataBadge.vue`
- Modify: `src/views/CollectionView.vue`, `src/components/deck/CardPool.vue`,
  `src/components/deck/DeckCardRow.vue`, `src/components/deck/ReserveRow.vue`
- Create: `src/components/card/__tests__/ErrataBadge.spec.ts`

**Interfaces:**

- Consumes: `hasErrata` (Task 3).
- Produces: composant `ErrataBadge` (prop `cardId: string`).

- [ ] **Step 1: Écrire le test qui échoue**

`src/components/card/__tests__/ErrataBadge.spec.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@/services/errataService", () => ({
  hasErrata: (id: string) => id === "opee-tissoin-incarnam",
}));

import ErrataBadge from "@/components/card/ErrataBadge.vue";

describe("ErrataBadge", () => {
  it("devrait s'afficher sur une carte erratée", () => {
    const w = mount(ErrataBadge, {
      props: { cardId: "opee-tissoin-incarnam" },
    });
    expect(w.text()).toContain("Erraté");
  });

  it("devrait rester invisible sur une carte sans errata", () => {
    const w = mount(ErrataBadge, { props: { cardId: "bouftou-incarnam" } });
    expect(w.text()).toBe("");
  });

  it("devrait porter un title accessible", () => {
    const w = mount(ErrataBadge, {
      props: { cardId: "opee-tissoin-incarnam" },
    });
    expect(w.find("[title]").attributes("title")).toContain("errata");
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/components/card/__tests__/ErrataBadge.spec.ts`
Expected: FAIL — `Failed to resolve import "@/components/card/ErrataBadge.vue"`.

- [ ] **Step 3: Écrire le composant**

`src/components/card/ErrataBadge.vue` :

```vue
<template>
  <span
    v-if="show"
    class="badge badge-warning badge-sm"
    title="Cette carte a fait l'objet d'un errata officiel"
  >
    Erraté
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { hasErrata } from "@/services/errataService";

const props = defineProps<{ cardId: string }>();
const show = computed(() => hasErrata(props.cardId));
</script>
```

- [ ] **Step 4: Poser le badge dans la collection**

Dans `src/views/CollectionView.vue` : importer le composant dans le `<script setup>`

```ts
import ErrataBadge from "@/components/card/ErrataBadge.vue";
```

puis, dans la vignette de la grille, à l'intérieur du conteneur de la carte :

```vue
<ErrataBadge :card-id="item.card.id" class="absolute right-1 top-1 z-10" />
```

Le conteneur de la vignette doit être `relative` (ajouter la classe si absente).

- [ ] **Step 5: Poser le badge dans l'atelier de deck (3 composants)**

Le spec couvre le pool **et** les lignes de decklist. Dans **chacun** de ces trois
fichiers, ajouter l'import dans le `<script setup>` :

```ts
import ErrataBadge from "@/components/card/ErrataBadge.vue";
```

puis le badge, à côté du **nom de la carte** :

- `src/components/deck/CardPool.vue` — dans la vignette de carte du pool :

```vue
<ErrataBadge :card-id="card.id" />
```

- `src/components/deck/DeckCardRow.vue` — dans la ligne de deck, après le nom :

```vue
<ErrataBadge :card-id="deckCard.card.id" />
```

- `src/components/deck/ReserveRow.vue` — idem dans la ligne de réserve :

```vue
<ErrataBadge :card-id="deckCard.card.id" />
```

> Vérifier le nom réel de la prop de chaque composant avant de coller
> (`deckCard`, `dc`, ou `card` selon le fichier) : le badge attend l'**id de la
> carte**, pas l'objet.

- [ ] **Step 6: Précharger l'index au démarrage**

Dans `src/views/CollectionView.vue`, dans le `onMounted` existant (ou en créer un) :

```ts
import { preloadErrata } from "@/services/errataService";
onMounted(() => {
  void preloadErrata();
});
```

`hasErrata` étant synchrone, le badge apparaît dès que l'index est en cache.

- [ ] **Step 7: Lancer les tests + type-check**

Run: `npx vitest run src/components/card src/views && npm run type-check`
Expected: PASS, type-check vert.

- [ ] **Step 8: Commit**

```bash
git add src/components/card/ErrataBadge.vue src/components/card/__tests__/ErrataBadge.spec.ts src/views/CollectionView.vue src/components/deck/CardPool.vue src/components/deck/DeckCardRow.vue src/components/deck/ReserveRow.vue
git commit -m "feat(errata): badge « Erraté » en collection et atelier de deck"
```

---

### Task 11: E2E Playwright

**Files:**

- Modify: `e2e/app.spec.ts`

**Interfaces:**

- Consumes: routes `/errata` et `/regles/officielles`.
- Produces: rien.

- [ ] **Step 1: Écrire les tests E2E**

Ajouter à la fin de `e2e/app.spec.ts` :

```ts
// IMPORTANT : la CI construit avec des VITE_SUPABASE_* FACTICES → aucune base
// réelle, donc `rules` et `card_errata` sont vides en E2E. Ces tests valident
// donc le SQUELETTE (route publique, titre, contrôles, dégradation explicite),
// jamais un contenu seedé — sinon ils échoueraient systématiquement en CI.

test("la page Errata est publique et expose ses contrôles", async ({
  page,
}) => {
  await page.goto("/errata");
  await expect(
    page.getByRole("heading", { name: "Errata", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: /Rechercher une carte/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: /Trier les errata/i }),
  ).toBeVisible();
});

test("les règles officielles sont publiques et dégradent explicitement sans base", async ({
  page,
}) => {
  await page.goto("/regles/officielles#418.5b");
  await expect(
    page.getByRole("heading", { name: "Règles officielles" }),
  ).toBeVisible();
  // Sans base : message d'indisponibilité explicite, jamais une page blanche.
  await expect(page.getByText(/Règles indisponibles/i)).toBeVisible();
});

test("la page Règles renvoie vers les règles officielles", async ({ page }) => {
  await page.goto("/regles");
  await page
    .getByRole("link", { name: /règles officielles complètes/i })
    .click();
  await expect(page).toHaveURL(/\/regles\/officielles/);
});
```

- [ ] **Step 2: Lancer les E2E**

Run: `npm run build && npm run test:e2e -- --workers=1`
Expected: tous les tests passent, dont les 3 nouveaux.

> Les deux pages sont `meta: { guest: true }` : aucune injection d'auth n'est nécessaire. Le build CI utilise des `VITE_SUPABASE_*` factices — si la base est injoignable en E2E, la page Règles affiche l'état d'erreur explicite ; le test de deep-link doit alors être ajusté pour n'asserter que le titre. Vérifier le comportement réel au premier passage.

- [ ] **Step 3: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "test(e2e): page Errata + deep-link des règles officielles"
```

---

### Task 12: Vérification finale

- [ ] **Step 1: Suite complète**

Run: `npx vitest run 2>&1 | tail -5`
Expected: 0 failure.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: aucune sortie d'erreur.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build réussi.

- [ ] **Step 4: Vérification navigateur** `[DIFFÉRÉ — humain]`

Démarrer le serveur de dev, puis contrôler :

1. `/errata` — les 66 cartes groupées par extension, recherche fonctionnelle, avant/après visible.
2. `/regles/officielles#418.5b` — la page défile jusqu'à la règle.
3. `/collection` — le badge « Erraté » apparaît sur Opée Tissoin et Aeron Zeklox.

- [ ] **Step 5: Mettre à jour la documentation**

Dans `CLAUDE.md`, section « Fonctionnalités », ajouter :

```markdown
- **Errata & règles officielles** : page `/errata` (liste groupée par extension, avant/après) + badge « Erraté » sur les cartes concernées ; `/regles/officielles` = texte intégral des règles officielles, chaque règle adressable par son numéro (`#418.5b`). Contenu servi depuis Supabase (`card_errata`, `rules`), importé par `scripts/seedErrata.mjs` et `scripts/seedRules.mjs`.
```

- [ ] **Step 6: Commit final**

```bash
git add CLAUDE.md
git commit -m "docs: errata consultables + règles officielles complètes"
```
