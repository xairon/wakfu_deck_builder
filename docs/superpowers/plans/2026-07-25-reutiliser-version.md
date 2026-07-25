# « Réutiliser cette version » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Depuis le journal, reprendre en un clic les valeurs d'une version antérieure d'un errata ou d'une correction de règle — l'éditeur s'ouvre pré-rempli, l'admin relit et enregistre.

**Architecture :** Le journal **ne devient pas un éditeur** : il navigue vers l'éditeur existant de l'entité (`/admin/errata`, `/admin/regles`) en passant `?reuse=<auditId>&side=before|after`. L'éditeur charge l'entrée d'audit, pré-remplit son propre formulaire, et n'écrit **rien** tant que l'admin ne soumet pas. L'enregistrement emprunte le chemin normal, donc il est audité comme une modification ordinaire.

**Tech Stack :** Vue 3 `<script setup lang="ts">`, vue-router, Pinia, Vitest + @vue/test-utils, Supabase.

**Spec :** `docs/superpowers/specs/2026-07-25-reutiliser-version-design.md`

## Global Constraints

- UI en **français**, code en **anglais**. Tests : `it("devrait …")`.
- TypeScript strict, **pas d'`enum`**. `npm run type-check` (vue-tsc) est le seul gate de types.
- **La sécurité est la RLS.** Ces écrans sont déjà derrière `requiresAdmin` ; rien de nouveau côté sécurité.
- **Rien n'est écrit sans soumission de l'admin.** Un `?reuse=` pré-remplit, il n'enregistre jamais. Les tests l'assertent **négativement** (aucun appel d'écriture).
- **Le journal navigue, il n'édite pas.** Ne créer aucun formulaire dans `AdminJournalView` — ce projet a déjà payé deux fois la duplication de formulaires.
- Jamais d'exception : une entrée introuvable ou refusée par la RLS donne un bandeau, pas un plantage.
- Aucune migration : `admin_audit` existe déjà et contient déjà les instantanés.

---

### Task 1: `getAuditEntry` — lire une entrée du journal

**Files:**

- Modify: `src/services/adminService.ts`
- Modify: `src/services/__tests__/adminService.spec.ts`

**Interfaces:**

- Produces: `getAuditEntry(id: number): Promise<AuditRow | null>`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `src/services/__tests__/adminService.spec.ts` :

```ts
it("getAuditEntry devrait renvoyer l'entrée demandée", async () => {
  const row = {
    id: 7,
    actor: null,
    action: "update",
    entity: "errata",
    entity_key: "42",
    before_data: { summary: "avant" },
    after_data: { summary: "après" },
    created_at: "2026-07-25T10:00:00Z",
  };
  let table = "";
  supabaseStub = {
    from: (t: string) => {
      table = t;
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: row, error: null }),
          }),
        }),
      };
    },
  };
  const { getAuditEntry } = await import("@/services/adminService");
  const out = await getAuditEntry(7);
  expect(table).toBe("admin_audit");
  expect(out?.id).toBe(7);
  expect(out?.before_data).toEqual({ summary: "avant" });
});

it("getAuditEntry devrait renvoyer null sans backend", async () => {
  supabaseStub = null;
  const { getAuditEntry } = await import("@/services/adminService");
  await expect(getAuditEntry(7)).resolves.toBeNull();
});

it("getAuditEntry devrait renvoyer null si la requête échoue", async () => {
  supabaseStub = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: null, error: { message: "denied" } }),
        }),
      }),
    }),
  };
  const { getAuditEntry } = await import("@/services/adminService");
  await expect(getAuditEntry(7)).resolves.toBeNull();
});

it("getAuditEntry devrait renvoyer null sans lever si la requête jette", async () => {
  supabaseStub = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            throw new Error("réseau");
          },
        }),
      }),
    }),
  };
  const { getAuditEntry } = await import("@/services/adminService");
  await expect(getAuditEntry(7)).resolves.toBeNull();
});
```

- [ ] **Step 2: Voir échouer**

Run: `npx vitest run src/services/__tests__/adminService.spec.ts`
Expected: FAIL — `getAuditEntry` n'est pas exporté.

- [ ] **Step 3: Implémenter**

Ajouter à `src/services/adminService.ts`, après `listAudit` :

```ts
/**
 * Une entrée du journal par son id — sert à « réutiliser cette version ».
 * Même dégradation que `listAudit` : `null` si pas de backend, si la requête
 * échoue ou si la RLS refuse ; jamais d'exception.
 */
export async function getAuditEntry(id: number): Promise<AuditRow | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("admin_audit")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.warn(
        "[adminService] lecture d'une entrée `admin_audit` en échec :",
        error,
      );
      return null;
    }
    return (data as AuditRow | null) ?? null;
  } catch (err) {
    console.warn(
      "[adminService] exception lors de la lecture d'`admin_audit` :",
      err,
    );
    return null;
  }
}
```

- [ ] **Step 4: Vérifier + commit**

Run: `npx vitest run src/services/__tests__/adminService.spec.ts && npm run type-check`

```bash
git add src/services/adminService.ts src/services/__tests__/adminService.spec.ts
git commit -m "feat(admin): getAuditEntry — lire une entrée du journal par son id"
```

---

### Task 2: Le journal propose « Réutiliser cette version »

**Files:**

- Modify: `src/views/admin/AdminJournalView.vue`
- Modify: `src/views/admin/__tests__/AdminJournalView.spec.ts`

**Interfaces:**

- Produces: dans le bloc `<details>` « Avant / après », un `RouterLink` par instantané non nul, `data-testid="reuse-<entryId>-before"` / `-after`, pointant vers `/admin/errata?reuse=<id>&side=<side>` ou `/admin/regles?reuse=<id>&side=<side>`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `src/views/admin/__tests__/AdminJournalView.spec.ts` (adapter le mock de `listAudit` déjà présent dans ce fichier pour renvoyer les entrées ci-dessous) :

```ts
it("devrait proposer de réutiliser chaque instantané non nul d'un errata", async () => {
  listAudit.mockResolvedValue([
    {
      id: 7,
      actor: null,
      action: "update",
      entity: "errata",
      entity_key: "42",
      before_data: { summary: "avant" },
      after_data: { summary: "après" },
      created_at: "2026-07-25T10:00:00Z",
    },
  ]);
  const w = mountView();
  await flushPromises();
  const before = w.find('[data-testid="reuse-7-before"]');
  const after = w.find('[data-testid="reuse-7-after"]');
  expect(before.exists()).toBe(true);
  expect(after.exists()).toBe(true);
  // Cible EXACTE : une mauvaise cible enverrait l'admin éditer la mauvaise entité.
  expect(before.attributes("href")).toBe("/admin/errata?reuse=7&side=before");
  expect(after.attributes("href")).toBe("/admin/errata?reuse=7&side=after");
});

it("devrait pointer vers l'écran des règles pour une correction de règle", async () => {
  listAudit.mockResolvedValue([
    {
      id: 8,
      actor: null,
      action: "update",
      entity: "rule_override",
      entity_key: "418.5b",
      before_data: { number: "418.5b", body: "avant" },
      after_data: { number: "418.5b", body: "après" },
      created_at: "2026-07-25T10:00:00Z",
    },
  ]);
  const w = mountView();
  await flushPromises();
  expect(w.find('[data-testid="reuse-8-before"]').attributes("href")).toBe(
    "/admin/regles?reuse=8&side=before",
  );
});

it("ne devrait pas proposer de réutiliser un instantané nul", async () => {
  listAudit.mockResolvedValue([
    {
      id: 9,
      actor: null,
      action: "create",
      entity: "errata",
      entity_key: "43",
      before_data: null, // une création n'a pas d'avant
      after_data: { summary: "x" },
      created_at: "2026-07-25T10:00:00Z",
    },
  ]);
  const w = mountView();
  await flushPromises();
  expect(w.find('[data-testid="reuse-9-before"]').exists()).toBe(false);
  expect(w.find('[data-testid="reuse-9-after"]').exists()).toBe(true);
});

it("ne devrait rien proposer pour un changement de rôle", async () => {
  listAudit.mockResolvedValue([
    {
      id: 10,
      actor: null,
      action: "update",
      entity: "role",
      entity_key: "user-1",
      before_data: null,
      after_data: { role: "admin" },
      created_at: "2026-07-25T10:00:00Z",
    },
  ]);
  const w = mountView();
  await flushPromises();
  expect(w.find('[data-testid="reuse-10-after"]').exists()).toBe(false);
});
```

Si le fichier de test monte le composant sans routeur, stubber `RouterLink` en rendant son
`to` dans un `href` pour que les assertions ci-dessus fonctionnent :

```ts
const stubs = {
  RouterLink: { props: ["to"], template: "<a :href='to'><slot /></a>" },
};
```

- [ ] **Step 2: Voir échouer**

Run: `npx vitest run src/views/admin/__tests__/AdminJournalView.spec.ts`
Expected: FAIL — aucun `reuse-*` dans le DOM.

- [ ] **Step 3: Implémenter**

Dans le `<script setup>` de `src/views/admin/AdminJournalView.vue` :

```ts
/**
 * Écran d'édition capable de reprendre un instantané. `role` n'en a pas : le
 * seul chemin d'écriture d'un rôle est la RPC `set_user_role()`, dont rejouer
 * un instantané contournerait les garde-fous.
 */
const reuseTargets: Partial<Record<AuditRow["entity"], string>> = {
  errata: "/admin/errata",
  rule_override: "/admin/regles",
};

/** URL de reprise, ou null si l'entité n'a pas d'éditeur / l'instantané est nul. */
function reuseLink(entry: AuditRow, side: "before" | "after"): string | null {
  const target = reuseTargets[entry.entity];
  if (!target) return null;
  const snapshot = side === "before" ? entry.before_data : entry.after_data;
  if (snapshot == null) return null;
  return `${target}?reuse=${entry.id}&side=${side}`;
}
```

Dans le template, sous **chacun** des deux `<pre>` du bloc « Avant / après » :

```vue
<RouterLink
  v-if="reuseLink(entry, 'before')"
  :to="reuseLink(entry, 'before')!"
  class="link mt-1 inline-block text-xs"
  :data-testid="`reuse-${entry.id}-before`"
>Réutiliser cette version</RouterLink>
```

et l'équivalent avec `'after'` / `-after` sous le second.

- [ ] **Step 4: Vérifier + commit**

Run: `npx vitest run src/views/admin/__tests__/AdminJournalView.spec.ts && npm run type-check`

```bash
git add src/views/admin/AdminJournalView.vue src/views/admin/__tests__/AdminJournalView.spec.ts
git commit -m "feat(admin): le journal propose de réutiliser un instantané"
```

---

### Task 3: `/admin/errata?reuse=` pré-remplit le formulaire

**Files:**

- Modify: `src/views/admin/AdminErrataView.vue`
- Modify: `src/views/admin/__tests__/AdminErrataView.spec.ts`

**Interfaces:**

- Consumes: `getAuditEntry` (Task 1), l'état existant `form` / `formOpen` / `formError`, `emptyForm()`.

**État existant à réutiliser** (lu dans le fichier) : `form = reactive<ErrataFormState>(emptyForm())`, `formOpen = ref(false)`, `formError = ref<string|null>(null)`, et `emptyForm()` renvoie `{ id: undefined, card_id: "", errata_date: "", source: "", summary: "", before_text: "", after_text: "", changes: [] }`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `src/views/admin/__tests__/AdminErrataView.spec.ts`. Le fichier mocke déjà `@/services/adminService` — ajouter `getAuditEntry` à ce mock, et mocker `vue-router` :

```ts
const replace = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => ({ query: routeQuery }),
  useRouter: () => ({ replace }),
}));
```

avec `let routeQuery: Record<string, string> = {};` remis à `{}` dans le `beforeEach`.

```ts
it("devrait pré-remplir le formulaire depuis un instantané du journal SANS rien écrire", async () => {
  routeQuery = { reuse: "7", side: "before" };
  getAuditEntry.mockResolvedValue({
    id: 7,
    actor: null,
    action: "update",
    entity: "errata",
    entity_key: "42",
    before_data: {
      id: 42,
      card_id: "opee-tissoin-incarnam",
      errata_date: "2011-10-05",
      source: "Forum",
      summary: "Ancien résumé",
      before_text: null,
      after_text: null,
      sort_order: 0,
      changes: [{ label: "PA", before: "7", after: "6" }],
    },
    after_data: { summary: "autre" },
    created_at: "2026-07-25T10:00:00Z",
  });
  const w = mountView();
  await flushPromises();

  expect(getAuditEntry).toHaveBeenCalledWith(7);
  expect(
    (w.find('[data-testid="f-summary"]').element as HTMLInputElement).value,
  ).toBe("Ancien résumé");
  expect(
    (w.find('[data-testid="change-label-0"]').element as HTMLInputElement)
      .value,
  ).toBe("PA");
  // RIEN ne doit être écrit tant que l'admin n'a pas soumis.
  expect(createErratum).not.toHaveBeenCalled();
  expect(updateErratum).not.toHaveBeenCalled();
  // Le paramètre est nettoyé : un rafraîchissement ne rejoue pas l'opération.
  expect(replace).toHaveBeenCalled();
});

it("devrait afficher un bandeau d'erreur si l'entrée du journal est introuvable", async () => {
  routeQuery = { reuse: "999", side: "before" };
  getAuditEntry.mockResolvedValue(null);
  const w = mountView();
  await flushPromises();
  expect(w.text()).toContain("introuvable");
  expect(createErratum).not.toHaveBeenCalled();
});

it("devrait ignorer un paramètre reuse non numérique", async () => {
  routeQuery = { reuse: "abc", side: "before" };
  const w = mountView();
  await flushPromises();
  expect(getAuditEntry).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Voir échouer.**

- [ ] **Step 3: Implémenter**

Dans `src/views/admin/AdminErrataView.vue`, ajouter les imports `useRoute` / `useRouter` de
`vue-router` et `getAuditEntry` du service, puis :

```ts
const route = useRoute();
const router = useRouter();
/** Bandeau « version reprise » : dit clairement que rien n'est encore enregistré. */
const reuseNotice = ref<string | null>(null);

/**
 * `?reuse=<auditId>&side=before|after` : pré-remplit le formulaire depuis un
 * instantané du journal. N'ÉCRIT RIEN — l'admin relit puis enregistre, et
 * l'enregistrement passe par le chemin normal (donc audité).
 */
async function applyReuseFromQuery() {
  const raw = route.query.reuse;
  const id = Number(raw);
  if (typeof raw !== "string" || !Number.isInteger(id)) return;

  const side = route.query.side === "after" ? "after" : "before";
  const entry = await getAuditEntry(id);
  const snapshot = entry
    ? side === "after"
      ? entry.after_data
      : entry.before_data
    : null;

  if (!snapshot || typeof snapshot !== "object") {
    reuseNotice.value =
      "Version introuvable dans le journal — rien n'a été pré-rempli.";
  } else {
    const s = snapshot as Record<string, unknown>;
    Object.assign(form, emptyForm(), {
      // `id` volontairement repris : si l'errata existe encore on le met à jour ;
      // s'il a été supprimé depuis, la soumission le recréera (id inconnu côté base).
      id: typeof s.id === "number" ? s.id : undefined,
      card_id: String(s.card_id ?? ""),
      errata_date: String(s.errata_date ?? ""),
      source: String(s.source ?? ""),
      summary: String(s.summary ?? ""),
      before_text: String(s.before_text ?? ""),
      after_text: String(s.after_text ?? ""),
      changes: Array.isArray(s.changes) ? [...s.changes] : [],
    });
    formError.value = null;
    formOpen.value = true;
    reuseNotice.value =
      "Version reprise depuis le journal — relis puis enregistre. Rien n'est encore enregistré.";
  }

  // Nettoyage : un rafraîchissement ne doit pas rejouer la reprise.
  await router.replace({ query: {} });
}
```

Appeler `void applyReuseFromQuery();` dans le `onMounted` existant, **après** le chargement
de la liste.

Dans le template, au-dessus du formulaire :

```vue
<p v-if="reuseNotice" class="alert alert-info mt-4" data-testid="reuse-notice">
      {{ reuseNotice }}
    </p>
```

- [ ] **Step 4: Vérifier + commit**

Run: `npx vitest run src/views/admin && npm run type-check`

```bash
git add src/views/admin/AdminErrataView.vue src/views/admin/__tests__/AdminErrataView.spec.ts
git commit -m "feat(admin): /admin/errata reprend un instantané du journal (sans écrire)"
```

---

### Task 4: `/admin/regles?reuse=` pré-remplit l'éditeur

**Files:**

- Modify: `src/views/admin/AdminRulesView.vue`
- Modify: `src/views/admin/__tests__/AdminRulesView.spec.ts`

**Interfaces:**

- Consumes: `getAuditEntry` (Task 1), l'état existant `editing` / `editBody` / `editError` / `openEditForm(row)`, et `newForm` / `newFormOpen` (`NewRuleForm = { number: string; chapter: number | null; body: string }`).

**Deux cas**, parce que la règle peut avoir disparu :

- la règle existe dans `rows` → on ouvre l'éditeur inline sur cette règle et on remplace
  `editBody` par le corps de l'instantané. On **réutilise `saveEdit(row)`**, qui reprend
  `sort_order`/`kind` de la ligne courante — c'est délibéré et important : au lot précédent,
  omettre `sort_order` propulsait la règle en haut de la page publique ;
- la règle n'existe plus (override d'une règle **ajoutée**, supprimé depuis) → on pré-remplit
  le formulaire d'ajout (`newForm`) avec `number` / `chapter` / `body`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `src/views/admin/__tests__/AdminRulesView.spec.ts` (mocker `vue-router` et ajouter
`getAuditEntry` au mock de `@/services/adminService`, comme en Task 3) :

```ts
it("devrait ouvrir l'éditeur pré-rempli sur la règle existante, sans rien écrire", async () => {
  routeQuery = { reuse: "8", side: "before" };
  getAuditEntry.mockResolvedValue({
    id: 8,
    actor: null,
    action: "update",
    entity: "rule_override",
    entity_key: "418.5b",
    before_data: { number: "418.5b", chapter: 4, body: "Ancien texte." },
    after_data: { number: "418.5b", chapter: 4, body: "Nouveau texte." },
    created_at: "2026-07-25T10:00:00Z",
  });
  const w = mount(AdminRulesView, { global: { stubs } });
  await flushPromises();

  expect(getAuditEntry).toHaveBeenCalledWith(8);
  expect(
    (w.find('[data-testid="body-418.5b"]').element as HTMLTextAreaElement)
      .value,
  ).toBe("Ancien texte.");
  expect(upsertRuleOverride).not.toHaveBeenCalled();
});

it("devrait pré-remplir le formulaire d'ajout si la règle n'existe plus", async () => {
  routeQuery = { reuse: "9", side: "before" };
  getAuditEntry.mockResolvedValue({
    id: 9,
    actor: null,
    action: "delete",
    entity: "rule_override",
    entity_key: "418.5z",
    before_data: {
      number: "418.5z",
      chapter: 4,
      body: "Règle ajoutée puis supprimée.",
    },
    after_data: null,
    created_at: "2026-07-25T10:00:00Z",
  });
  const w = mount(AdminRulesView, { global: { stubs } });
  await flushPromises();

  expect(
    (w.find('[data-testid="f-number"]').element as HTMLInputElement).value,
  ).toBe("418.5z");
  expect(upsertRuleOverride).not.toHaveBeenCalled();
});

it("devrait afficher un bandeau si l'entrée est introuvable", async () => {
  routeQuery = { reuse: "999", side: "before" };
  getAuditEntry.mockResolvedValue(null);
  const w = mount(AdminRulesView, { global: { stubs } });
  await flushPromises();
  expect(w.text()).toContain("introuvable");
});
```

Le mock existant de `rulesService` doit renvoyer une règle `418.5b` (et **pas** `418.5z`)
pour que les deux premiers cas se distinguent.

- [ ] **Step 2: Voir échouer.**

- [ ] **Step 3: Implémenter**

Dans `src/views/admin/AdminRulesView.vue`, ajouter les imports `useRoute` / `useRouter` et
`getAuditEntry`, puis :

```ts
const route = useRoute();
const router = useRouter();
const reuseNotice = ref<string | null>(null);

/**
 * `?reuse=<auditId>&side=before|after` : reprend le texte d'une version du
 * journal. N'ÉCRIT RIEN. Si la règle existe encore on ouvre l'éditeur inline
 * (donc `saveEdit` reprendra `sort_order`/`kind` de la ligne COURANTE — omettre
 * `sort_order` avait propulsé une règle corrigée en haut de la page publique) ;
 * sinon on pré-remplit le formulaire d'ajout.
 */
async function applyReuseFromQuery() {
  const raw = route.query.reuse;
  const id = Number(raw);
  if (typeof raw !== "string" || !Number.isInteger(id)) return;

  const side = route.query.side === "after" ? "after" : "before";
  const entry = await getAuditEntry(id);
  const snapshot = entry
    ? side === "after"
      ? entry.after_data
      : entry.before_data
    : null;

  if (!snapshot || typeof snapshot !== "object") {
    reuseNotice.value =
      "Version introuvable dans le journal — rien n'a été pré-rempli.";
  } else {
    const s = snapshot as Record<string, unknown>;
    const number = String(s.number ?? "");
    const body = String(s.body ?? "");
    const row = rows.value.find((r) => r.number === number);
    if (row) {
      openEditForm(row);
      editBody.value = body;
    } else {
      Object.assign(newForm, emptyNewForm(), {
        number,
        chapter: typeof s.chapter === "number" ? s.chapter : null,
        body,
      });
      newFormOpen.value = true;
    }
    reuseNotice.value =
      "Version reprise depuis le journal — relis puis enregistre. Rien n'est encore enregistré.";
  }

  await router.replace({ query: {} });
}
```

Appeler `void applyReuseFromQuery();` dans le `onMounted` existant, **après** `loadRules()`
(la reprise a besoin de `rows` pour trouver la règle).

Dans le template, au-dessus de la liste :

```vue
<p v-if="reuseNotice" class="alert alert-info mt-4" data-testid="reuse-notice">
      {{ reuseNotice }}
    </p>
```

- [ ] **Step 4: Vérifier + commit**

Run: `npx vitest run src/views/admin && npm run type-check`

```bash
git add src/views/admin/AdminRulesView.vue src/views/admin/__tests__/AdminRulesView.spec.ts
git commit -m "feat(admin): /admin/regles reprend un instantané du journal (sans écrire)"
```

---

### Task 5: Vérification finale et documentation

- [ ] **Step 1: Suite complète, types, build**

Run: `npx vitest run && npm run type-check && npm run build`
Expected: 0 échec.

- [ ] **Step 2: Vérifier qu'aucune reprise n'écrit**

Run: `grep -rn "applyReuseFromQuery" -A30 src/views/admin/AdminErrataView.vue src/views/admin/AdminRulesView.vue | grep -E "createErratum|updateErratum|upsertRuleOverride|deleteErratum"`
Attendu : **aucune sortie**. La reprise pré-remplit, elle n'écrit jamais.

- [ ] **Step 3: Lint**

Run: `npx eslint src`
Attendu : pas plus d'erreurs qu'avant la branche (10 préexistantes). Corriger toute nouvelle erreur introduite.

- [ ] **Step 4: Documentation**

Dans `CLAUDE.md`, compléter la ligne « Rôles d'administration » : depuis `/admin/journal`, chaque instantané non nul d'un errata ou d'une correction de règle porte un lien **« Réutiliser cette version »** qui ouvre l'éditeur concerné **pré-rempli** (`?reuse=<auditId>&side=before|after`) ; rien n'est écrit tant que l'admin n'enregistre pas, et l'enregistrement est audité comme une modification ordinaire. Pas de reprise pour les changements de **rôle** (`set_user_role` reste le seul chemin).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: reprise d'une version depuis le journal"
```
