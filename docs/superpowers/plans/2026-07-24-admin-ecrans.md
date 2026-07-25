# Écrans d'administration (Plan B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Les écrans qui rendent le socle de rôles utilisable — `/admin/errata`, `/admin/regles`, `/admin/journal`, `/admin/comptes` — plus le marqueur « corrigé » sur les règles publiques.

**Architecture :** Chaque écran consomme `adminService` (écritures) et les services de lecture existants. Aucun écran ne décide de sécurité — la RLS refuse déjà tout non-admin, les écrans se contentent de ne pas s'afficher (garde de route) et de remonter le verdict de la base. Réutilisation maximale des patrons existants (`ErrataView`, `RulesOfficialView`, `ConfirmDialog`, `useToast`).

**Tech Stack :** Vue 3 `<script setup lang="ts">`, Pinia, Vitest + @vue/test-utils, Tailwind + DaisyUI, Playwright.

**Spec de référence :** `docs/superpowers/specs/2026-07-24-roles-admin-et-edition-design.md` (section « Interface »). Le socle (rôles, RLS, `adminService`) est **déjà livré en prod** (migration 0013 appliquée, `checkAdminRls.mjs` tout vert).

## Global Constraints

- UI en **français**, code en **anglais**. Tests : `it("devrait …")`.
- TypeScript strict, **pas d'`enum`**. **Zod = source unique**.
- `npm run type-check` (vue-tsc) est le seul gate de types.
- **La sécurité est la RLS.** Un écran d'admin ne fait que masquer l'UI (garde) et afficher le verdict serveur. Ne jamais présumer les droits côté client.
- Toute écriture affiche une **erreur explicite en cas de refus** et **conserve la saisie** — jamais d'échec silencieux, jamais de formulaire vidé.
- `ConfirmDialog` (`src/components/common/ConfirmDialog.vue`) : props `open`, `title`, `message?`, `confirmLabel?`, `cancelLabel?`, `danger?` ; émet `confirm` / `cancel`.
- `useToast()` : `success(msg, {title?})`, `error(msg, {title?})`, `info(...)`.

---

### Task 1: `adminService.listErrataAdmin()` — errata AVEC leur `id`

**Files:**

- Modify: `src/services/adminService.ts`
- Modify: `src/services/__tests__/adminService.spec.ts`

**Interfaces:**

- Produces: `listErrataAdmin(): Promise<AdminErratum[]>` où `AdminErratum = { id: number; card_id: string; errata_date: string | null; source: string | null; summary: string; before_text: string | null; after_text: string | null; sort_order: number }`.

**Pourquoi :** l'écran d'édition doit cibler chaque errata par sa **clé primaire `id`** (pour `updateErratum(id)` / `deleteErratum(id)`). Or `errataService.getAllErrata()` renvoie des `ErrataEntry` qui **n'ont pas d'`id`** (type public, volontairement dépouillé). Il faut donc une lecture dédiée.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `src/services/__tests__/adminService.spec.ts` :

```ts
it("listErrataAdmin devrait renvoyer les errata AVEC leur id", async () => {
  const rows = [
    {
      id: 7,
      card_id: "opee-tissoin-incarnam",
      errata_date: "2010-12-01",
      source: "Forum",
      summary: "Passe à 6 PA.",
      before_text: "7 PA",
      after_text: "6 PA",
      sort_order: 0,
    },
  ];
  let table = "";
  supabaseStub = {
    from: (t: string) => {
      table = t;
      return {
        select: () => ({
          order: () => Promise.resolve({ data: rows, error: null }),
        }),
      };
    },
  };
  const { listErrataAdmin } = await import("@/services/adminService");
  const out = await listErrataAdmin();
  expect(table).toBe("card_errata");
  expect(out[0].id).toBe(7);
  expect(out[0].summary).toBe("Passe à 6 PA.");
});

it("listErrataAdmin devrait renvoyer [] sans backend et sans lever si la requête jette", async () => {
  supabaseStub = null;
  const { listErrataAdmin } = await import("@/services/adminService");
  await expect(listErrataAdmin()).resolves.toEqual([]);
});
```

- [ ] **Step 2: Voir échouer**

Run: `npx vitest run src/services/__tests__/adminService.spec.ts`
Expected: FAIL — `listErrataAdmin` non exporté.

- [ ] **Step 3: Implémenter**

Ajouter à `src/services/adminService.ts` :

```ts
export interface AdminErratum {
  id: number;
  card_id: string;
  errata_date: string | null;
  source: string | null;
  summary: string;
  before_text: string | null;
  after_text: string | null;
  sort_order: number;
}

/**
 * Errata AVEC leur `id` (clé primaire) — nécessaire à l'édition/suppression,
 * que `errataService.getAllErrata()` ne fournit pas (son type public omet l'id).
 * Même dégradation que `listAudit` : jamais d'exception, `console.warn` sur échec.
 */
export async function listErrataAdmin(): Promise<AdminErratum[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("card_errata")
      .select("*")
      .order("card_id", { ascending: true });
    if (error) {
      console.warn(
        "[adminService] requête `card_errata` (admin) en échec :",
        error,
      );
      return [];
    }
    return Array.isArray(data) ? (data as AdminErratum[]) : [];
  } catch (err) {
    console.warn(
      "[adminService] exception lors du chargement des errata (admin) :",
      err,
    );
    return [];
  }
}
```

- [ ] **Step 4: Vérifier + commit**

Run: `npx vitest run src/services/__tests__/adminService.spec.ts && npm run type-check`

```bash
git add src/services/adminService.ts src/services/__tests__/adminService.spec.ts
git commit -m "feat(admin): listErrataAdmin (errata avec id pour l'édition)"
```

---

### Task 2: Accueil admin + entrée de navigation (réservée aux admins)

**Files:**

- Modify: `src/views/admin/AdminHomeView.vue`
- Modify: `src/App.vue`
- Create: `src/views/admin/__tests__/AdminHomeView.spec.ts`

**Interfaces:**

- Consumes: `authStore.isAdmin` / `isOwner`.
- Produces: `AdminHomeView` liste les 4 écrans (Comptes seulement si `isOwner`).

- [ ] **Step 1: Test qui échoue**

`src/views/admin/__tests__/AdminHomeView.spec.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

let owner = false;
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ isAdmin: true, isOwner: owner }),
}));

import AdminHomeView from "@/views/admin/AdminHomeView.vue";

const stubs = { RouterLink: { props: ["to"], template: "<a><slot /></a>" } };

describe("AdminHomeView", () => {
  it("devrait lister errata, règles et journal", () => {
    owner = false;
    const w = mount(AdminHomeView, { global: { stubs } });
    expect(w.text()).toContain("Errata");
    expect(w.text()).toContain("Règles");
    expect(w.text()).toContain("Journal");
  });

  it("ne devrait PAS proposer Comptes à un admin non-owner", () => {
    owner = false;
    const w = mount(AdminHomeView, { global: { stubs } });
    expect(w.text()).not.toContain("Comptes");
  });

  it("devrait proposer Comptes à l'owner", () => {
    owner = true;
    const w = mount(AdminHomeView, { global: { stubs } });
    expect(w.text()).toContain("Comptes");
  });
});
```

- [ ] **Step 2: Voir échouer** — `npx vitest run src/views/admin/__tests__/AdminHomeView.spec.ts` (le placeholder actuel ne contient aucun de ces liens).

- [ ] **Step 3: Écrire la vue**

`src/views/admin/AdminHomeView.vue` :

```vue
<template>
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold">Administration</h1>
    <p class="mt-2 opacity-80">
      Édition du contenu du site. Toute action est journalisée.
    </p>
    <ul class="mt-6 grid gap-4 sm:grid-cols-2">
      <li v-for="link in links" :key="link.to">
        <RouterLink
          :to="link.to"
          class="block rounded-lg border border-base-content/20 p-4 hover:border-primary"
        >
          <span class="font-display text-xl">{{ link.label }}</span>
          <span class="mt-1 block text-sm opacity-70">{{ link.desc }}</span>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "@/stores/authStore";

const authStore = useAuthStore();
const links = computed(() => {
  const base = [
    {
      to: "/admin/errata",
      label: "Errata",
      desc: "Ajouter, corriger, supprimer les errata de cartes.",
    },
    {
      to: "/admin/regles",
      label: "Règles",
      desc: "Corriger le texte officiel ou ajouter une règle manquante.",
    },
    {
      to: "/admin/journal",
      label: "Journal",
      desc: "Qui a modifié quoi, et quand.",
    },
  ];
  if (authStore.isOwner)
    base.push({
      to: "/admin/comptes",
      label: "Comptes",
      desc: "Attribuer ou retirer le rôle admin.",
    });
  return base;
});
</script>
```

- [ ] **Step 4: Entrée de nav (admins seulement)**

Dans `src/App.vue`, transformer `navItems` en `computed` et y ajouter Admin sous condition. Remplacer la constante `navItems` (lignes ~201-208) par :

```ts
const navItems = computed(() => {
  const items = [
    { to: "/", label: "Accueil", match: ["/"] },
    { to: "/collection", label: "Collection", match: ["/collection"] },
    { to: "/decks", label: "Decks", match: ["/decks", "/deck"] },
    { to: "/play/table", label: "Partie", match: ["/play"] },
    { to: "/regles", label: "Règles", match: ["/regles"] },
    { to: "/errata", label: "Errata", match: ["/errata"] },
  ];
  // Réservé à l'UI : la RLS reste la barrière réelle.
  if (authStore.isAdmin)
    items.push({ to: "/admin", label: "Admin", match: ["/admin"] });
  return items;
});
```

Adapter `isActive` pour lire `navItems.value` (le `v-for="item in navItems"` du template fonctionne tel quel avec un computed ; `isActive` prend déjà `item` en paramètre, aucun changement de signature).

- [ ] **Step 5: Vérifier + commit**

Run: `npx vitest run src/views/admin/__tests__/AdminHomeView.spec.ts && npm run type-check`

```bash
git add src/views/admin/AdminHomeView.vue src/App.vue src/views/admin/__tests__/AdminHomeView.spec.ts
git commit -m "feat(admin): accueil /admin + entrée de nav réservée aux admins"
```

---

### Task 3: `/admin/errata` — CRUD

**Files:**

- Create: `src/views/admin/AdminErrataView.vue`
- Modify: `src/router/index.ts`
- Create: `src/views/admin/__tests__/AdminErrataView.spec.ts`

**Interfaces:**

- Consumes: `listErrataAdmin`, `createErratum`, `updateErratum`, `deleteErratum` (adminService), `useCardStore` (autocomplétion carte), `useToast`, `ConfirmDialog`.
- Produces: route `adminErrata` sur `/admin/errata` (`requiresAuth` + `requiresAdmin`).

**Comportement :** liste les errata (via `listErrataAdmin`, nom de carte résolu par `cardStore`), un bouton « Ajouter », un formulaire (champs : carte, date, source, résumé, avant, après ; **résumé obligatoire**), édition en place, suppression derrière `ConfirmDialog`. Après chaque écriture réussie : toast de succès + rechargement de la liste. En cas de refus : toast d'erreur **avec le message de la base**, formulaire conservé.

- [ ] **Step 1: Test qui échoue**

`src/views/admin/__tests__/AdminErrataView.spec.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

const listErrataAdmin = vi.fn();
const createErratum = vi.fn();
const deleteErratum = vi.fn();
vi.mock("@/services/adminService", () => ({
  listErrataAdmin,
  createErratum,
  updateErratum: vi.fn(),
  deleteErratum,
}));

import AdminErrataView from "@/views/admin/AdminErrataView.vue";
import { useCardStore } from "@/stores/cardStore";

const stubs = {
  ConfirmDialog: {
    props: ["open"],
    template:
      '<div v-if="open"><button class="confirm" @click="$emit(\'confirm\')">ok</button></div>',
  },
  RouterLink: { props: ["to"], template: "<a><slot /></a>" },
};

function mountView() {
  const store = useCardStore();
  store.cards = [
    {
      id: "opee-tissoin-incarnam",
      name: "Opée Tissoin",
      mainType: "Allié",
      extension: { name: "Incarnam" },
    },
  ] as any;
  return mount(AdminErrataView, { global: { stubs } });
}

describe("AdminErrataView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    listErrataAdmin.mockResolvedValue([
      {
        id: 7,
        card_id: "opee-tissoin-incarnam",
        errata_date: "2010-12-01",
        source: "Forum",
        summary: "Passe à 6 PA.",
        before_text: null,
        after_text: null,
        sort_order: 0,
      },
    ]);
    createErratum.mockResolvedValue({ ok: true });
    deleteErratum.mockResolvedValue({ ok: true });
  });

  it("devrait afficher les errata existants avec le nom de carte résolu", async () => {
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain("Opée Tissoin");
    expect(w.text()).toContain("Passe à 6 PA.");
  });

  it("devrait recharger la liste après une suppression confirmée", async () => {
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="delete-7"]').trigger("click"); // ouvre le ConfirmDialog
    await w.find(".confirm").trigger("click");
    await flushPromises();
    expect(deleteErratum).toHaveBeenCalledWith(7);
    expect(listErrataAdmin).toHaveBeenCalledTimes(2); // montage + après suppression
  });

  it("devrait afficher l'erreur de la base et conserver la saisie si la création échoue", async () => {
    createErratum.mockResolvedValue({ ok: false, error: "row-level security" });
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="new-errata"]').trigger("click");
    await w.find('[data-testid="f-summary"]').setValue("Test");
    await w.find('[data-testid="f-card"]').setValue("opee-tissoin-incarnam");
    await w.find('[data-testid="errata-submit"]').trigger("click");
    await flushPromises();
    expect(w.text()).toContain("row-level security");
    expect(
      (w.find('[data-testid="f-summary"]').element as HTMLInputElement).value,
    ).toBe("Test");
  });
});
```

- [ ] **Step 2: Voir échouer** — module inexistant.

- [ ] **Step 3: Écrire la vue**

Écrire `src/views/admin/AdminErrataView.vue` en suivant le patron de `ErrataView.vue` pour la liste (résolution du nom via `cardStore`), avec en plus :

- un état de formulaire `{ id?: number; card_id, errata_date, source, summary, before_text, after_text }` ;
- bouton `data-testid="new-errata"` qui ouvre un formulaire vide ; un bouton « Modifier » par ligne qui le pré-remplit ;
- champs `data-testid="f-card"` (input avec `list` d'autocomplétion sur `cardStore.cards`, valeur = `card.id`), `f-date`, `f-source`, `f-summary`, `f-before`, `f-after` ;
- bouton `data-testid="errata-submit"` : si `id` présent → `updateErratum(id, payload)`, sinon `createErratum(payload)` ; le résumé vide bloque la soumission (message inline) ;
- par ligne : bouton `data-testid="delete-<id>"` qui ouvre `ConfirmDialog` ; à `confirm` → `deleteErratum(id)` ;
- après toute écriture `ok` : `toast.success(...)`, refermer le formulaire, `await reload()` (rappelle `listErrataAdmin`) ; si `!ok` : `toast.error(res.error)` et **garder** le formulaire ouvert avec la saisie ;
- `reload()` est appelé dans `onMounted` et après chaque écriture.

Contrainte anti-régression du test : `listErrataAdmin` doit être appelé une fois au montage puis une fois après chaque écriture réussie.

- [ ] **Step 4: Route**

Dans `src/router/index.ts`, après `/admin` :

```ts
    {
      path: "/admin/errata",
      name: "adminErrata",
      component: () => import("@/views/admin/AdminErrataView.vue"),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
```

- [ ] **Step 5: Vérifier + commit**

Run: `npx vitest run src/views/admin/__tests__/AdminErrataView.spec.ts && npm run type-check`

```bash
git add src/views/admin/AdminErrataView.vue src/router/index.ts src/views/admin/__tests__/AdminErrataView.spec.ts
git commit -m "feat(admin): écran /admin/errata (CRUD, autocomplétion carte, confirm suppression)"
```

---

### Task 4: `/admin/regles` — corriger / ajouter / rétablir

**Files:**

- Create: `src/views/admin/AdminRulesView.vue`
- Modify: `src/router/index.ts`
- Create: `src/views/admin/__tests__/AdminRulesView.spec.ts`

**Interfaces:**

- Consumes: `loadRules` / `getRules` (rulesService), `upsertRuleOverride` / `deleteRuleOverride` (adminService), `useToast`, `ConfirmDialog`.
- Produces: route `adminRules` sur `/admin/regles`.

**Comportement :** réutilise la liste + recherche de `RulesOfficialView`. Sur une règle (`kind === 'rule'`) :

- **Corriger** : un champ texte pré-rempli avec `body` ; à l'enregistrement → `upsertRuleOverride({ number, chapter: row.chapter, body })`. Si la règle est déjà corrigée (`row.is_edited`), afficher **le texte officiel `row.body_official` en regard** (lecture seule).
- **Rétablir l'officiel** (visible si `is_edited` et `body_official` non nul) : derrière `ConfirmDialog` → `deleteRuleOverride(number)`.
- **Ajouter une règle** : formulaire `number` + `chapter` + `body` → `upsertRuleOverride({ number, chapter, body })` (`kind`/`sort_order` prennent leurs défauts en base).
- Après écriture `ok` : toast + `await loadRules()` (les données rechargées reflètent la vue de fusion). Refus : toast d'erreur + saisie conservée.

- [ ] **Step 1: Test qui échoue**

`src/views/admin/__tests__/AdminRulesView.spec.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const ROWS = [
  {
    number: "418.5b",
    kind: "rule",
    chapter: 4,
    title: null,
    body: "Texte officiel.",
    sort_order: 3,
    is_edited: false,
    body_official: "Texte officiel.",
  },
];
const loadRules = vi.fn().mockResolvedValue(ROWS);
const upsertRuleOverride = vi.fn().mockResolvedValue({ ok: true });
const deleteRuleOverride = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/services/rulesService", () => ({ loadRules, getRules: () => ROWS }));
vi.mock("@/services/adminService", () => ({
  upsertRuleOverride,
  deleteRuleOverride,
}));

import AdminRulesView from "@/views/admin/AdminRulesView.vue";
const stubs = {
  ConfirmDialog: {
    props: ["open"],
    template:
      '<div v-if="open"><button class="confirm" @click="$emit(\'confirm\')">ok</button></div>',
  },
};

describe("AdminRulesView", () => {
  beforeEach(() => {
    loadRules.mockClear();
    upsertRuleOverride.mockClear();
  });

  it("devrait enregistrer une correction et recharger", async () => {
    const w = mount(AdminRulesView, { global: { stubs } });
    await flushPromises();
    await w.find('[data-testid="edit-418.5b"]').trigger("click");
    await w.find('[data-testid="body-418.5b"]').setValue("Texte corrigé.");
    await w.find('[data-testid="save-418.5b"]').trigger("click");
    await flushPromises();
    expect(upsertRuleOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        number: "418.5b",
        chapter: 4,
        body: "Texte corrigé.",
      }),
    );
    expect(loadRules).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Voir échouer.**

- [ ] **Step 3: Écrire la vue** (patron `RulesOfficialView` pour la liste/recherche ; formulaire d'édition inline par règle avec les `data-testid` du test ; « rétablir » derrière `ConfirmDialog` ; formulaire d'ajout).

- [ ] **Step 4: Route** (`adminRules` sur `/admin/regles`, `requiresAdmin`).

- [ ] **Step 5: Vérifier + commit**

```bash
git add src/views/admin/AdminRulesView.vue src/router/index.ts src/views/admin/__tests__/AdminRulesView.spec.ts
git commit -m "feat(admin): écran /admin/regles (corriger, ajouter, rétablir l'officiel)"
```

---

### Task 5: `/admin/journal`

**Files:**

- Create: `src/views/admin/AdminJournalView.vue`
- Modify: `src/router/index.ts`
- Create: `src/views/admin/__tests__/AdminJournalView.spec.ts`

**Interfaces:**

- Consumes: `listAudit` (adminService), `listProfiles` (pour résoudre `actor` → pseudo).
- Produces: route `adminJournal` sur `/admin/journal`.

**Comportement :** liste `listAudit()` du plus récent au plus ancien : date (via `formatFrenchDate` ou `toLocaleString`), auteur (pseudo résolu, « système » si `actor` null), action, entité, clé, et le avant/après dépliable. Filtres par **type d'entité** (`rule_override`/`errata`/`role`) et par **auteur**. Lecture seule.

- [ ] **Step 1: Test qui échoue** — assertions : une ligne avec `actor: null` affiche « système » ; le filtre par entité masque les autres. (Écrire un test qui monte avec un `listAudit` moqué de 2 lignes d'entités différentes et vérifie le filtrage.)
- [ ] **Step 2: Voir échouer.**
- [ ] **Step 3: Écrire la vue.**
- [ ] **Step 4: Route** (`adminJournal`, `requiresAdmin`).
- [ ] **Step 5: Vérifier + commit** — `git commit -m "feat(admin): écran /admin/journal (lecture, filtres auteur/entité)"`

---

### Task 6: `/admin/comptes` (owner) — remplace le placeholder

**Files:**

- Modify: `src/views/admin/AdminAccountsView.vue`
- Create: `src/views/admin/__tests__/AdminAccountsView.spec.ts`

(la route `/admin/comptes` existe déjà avec `requiresOwner`, Plan A Task 4)

**Interfaces:**

- Consumes: `listProfiles`, `setUserRole` (adminService), `useToast`, `ConfirmDialog`.

**Comportement :** liste les profils (pseudo, rôle). Pour un `user` : bouton « Promouvoir admin » ; pour un `admin` : « Rétrograder ». Chaque action derrière `ConfirmDialog` → `setUserRole(userId, role)`. L'`owner` apparaît **sans bouton** (la RPC le refuserait). Le rôle `owner` n'est jamais proposé. Après `ok` : toast + rechargement ; refus (ex. « Réservé au propriétaire ») : toast d'erreur.

- [ ] **Step 1: Test qui échoue** — assertions : l'owner n'a pas de bouton d'action ; confirmer une promotion appelle `setUserRole(id, "admin")` puis recharge ; un refus affiche le message.
- [ ] **Step 2: Voir échouer.**
- [ ] **Step 3: Écrire la vue.**
- [ ] **Step 4: Vérifier + commit** — `git commit -m "feat(admin): écran /admin/comptes (owner : promouvoir/rétrograder via set_user_role)"`

---

### Task 7: Marqueur « corrigé » sur les règles publiques

**Files:**

- Modify: `src/views/RulesOfficialView.vue`
- Modify: `src/views/__tests__/RulesOfficialView.spec.ts`

**Comportement :** une règle `is_edited` porte un **marqueur discret « corrigé »** et rend le **texte officiel d'origine `body_official` consultable** en regard (ex. `<details>`), quand il est non nul. Ne rien afficher de spécial pour une règle ajoutée (`body_official` nul).

- [ ] **Step 1: Test qui échoue**

Ajouter à `src/views/__tests__/RulesOfficialView.spec.ts` un cas où `getRules`/`loadRules` renvoie une règle `is_edited: true, body_official: "Officiel."` et asserter que le texte « corrigé » apparaît et que « Officiel. » est présent dans le DOM. Et un cas `is_edited: false` où le marqueur est absent. Prouver RED en retirant le marqueur.

- [ ] **Step 2: Voir échouer.**

- [ ] **Step 3: Implémenter** — dans le bloc `<p v-else …>` de la liste, quand `row.is_edited`, ajouter un `<span>` marqueur et, si `row.body_official`, un `<details><summary>Texte officiel</summary>{{ row.body_official }}</details>`.

- [ ] **Step 4: Vérifier + commit**

```bash
git add src/views/RulesOfficialView.vue src/views/__tests__/RulesOfficialView.spec.ts
git commit -m "feat(rules): marqueur « corrigé » + texte officiel consultable sur les règles éditées"
```

---

### Task 8: E2E + vérification finale

**Files:**

- Modify: `e2e/app.spec.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: E2E des gardes**

Les écrans sont derrière `requiresAdmin`/`requiresOwner` et la base E2E n'a pas d'admin → un E2E ne peut que constater la **redirection**. Ajouter à `e2e/app.spec.ts` :

```ts
test("les écrans d'admin sont fermés à un anonyme", async ({ page }) => {
  for (const path of [
    "/admin/errata",
    "/admin/regles",
    "/admin/journal",
    "/admin/comptes",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(
      new RegExp("/auth\\?redirect=" + path.replace("/", "\\/")),
    );
  }
});
```

Run: `npm run build && npm run test:e2e -- --workers=1`
Expected: tous verts.

- [ ] **Step 2: Suite + types + build**

Run: `npx vitest run && npm run type-check && npm run build`
Expected: 0 échec.

- [ ] **Step 3: Doc**

Dans `CLAUDE.md`, mettre à jour la ligne « Rôles d'administration » : les écrans `/admin/{errata,regles,journal,comptes}` existent désormais (retirer « aucune UI d'administration réelle »). Ajouter les routes dans la liste `views/`.

- [ ] **Step 4: Commit**

```bash
git add e2e/app.spec.ts CLAUDE.md
git commit -m "docs+test(e2e): écrans d'admin — gardes de route, doc à jour"
```
