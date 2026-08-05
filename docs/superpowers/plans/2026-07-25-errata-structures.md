# Errata structurés & édition en place — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Un errata dit **quel champ a changé, de quoi à quoi** ; la fiche de carte l'affiche précisément ; un admin l'édite depuis la carte, sans quitter la collection.

**Architecture :** Une colonne `changes` (JSONB) **additive** sur `card_errata` — vide, l'affichage retombe sur la prose actuelle, donc rien ne casse et la structuration se fait au fil de l'eau. Côté UI, un composant partagé `ErrataPanel` remplace les **deux** blocs de rendu qui existent aujourd'hui (ils ont déjà divergé), et un composant `ErrataForm` extrait de l'écran d'admin sert les **deux** points d'entrée d'édition.

**Tech Stack :** Postgres/Supabase (JSONB), Zod, Vue 3 `<script setup lang="ts">`, Vitest + @vue/test-utils, Tailwind/DaisyUI.

**Spec :** `docs/superpowers/specs/2026-07-25-errata-structures-design.md`

## Global Constraints

- UI en **français**, code en **anglais**. Tests : `it("devrait …")`.
- TypeScript strict, **pas d'`enum`**. **Zod = source unique** (`src/schema/`, types via `z.infer`).
- `npm run type-check` (vue-tsc) est le seul gate de types.
- **La sécurité est la RLS.** `isAdmin` ne sert qu'à afficher ou masquer l'UI.
- **`changes` est additif** : `summary` / `before_text` / `after_text` sont conservés et restent affichés quand `changes` est vide. Aucun errata existant ne doit devenir invisible.
- **Déployable avant la migration** : sans la colonne, les lignes reviennent sans `changes`, le défaut Zod `[]` s'applique, et l'affichage est celui d'aujourd'hui. Aucune régression possible dans un ordre ou dans l'autre.
- Ne **jamais** lever : une ligne de `changes` mal formée est ignorée, le reste s'affiche.

> ## ⛔ Étape DIFFÉRÉE — aucun agent n'a d'accès Supabase
>
> L'application de la migration `0014` est **`[DIFFÉRÉ — humain]`**. L'implémenteur écrit le
> fichier, vérifie ce qui l'est hors base, et passe à la suite **en le signalant**. Ne jamais
> tenter d'appliquer une migration ni chercher un token.

---

### Task 1: Donnée — colonne `changes`, schéma Zod, type public

**Files:**

- Create: `supabase/migrations/0014_errata_changes.sql`
- Modify: `src/schema/rules.ts`
- Modify: `src/services/errataService.ts`
- Modify: `src/schema/__tests__/rules.spec.ts`
- Modify: `src/services/__tests__/errataService.spec.ts`

**Interfaces:**

- Produces: `errataChangeSchema`, type `ErrataChange = { label: string; before: string; after: string }` (exportés depuis `@/schema`) ; `errataRowSchema.changes` ; `ErrataEntry.changes: ErrataChange[]`.

- [ ] **Step 1: Écrire la migration**

`supabase/migrations/0014_errata_changes.sql` :

```sql
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
```

- [ ] **Step 2: Appliquer la migration** `[DIFFÉRÉ — humain]`

```bash
SUPABASE_MGMT_TOKEN=<token> node scripts/applyMigration.mjs supabase/migrations/0014_errata_changes.sql
```

- [ ] **Step 3: Écrire les tests qui échouent**

Ajouter à `src/schema/__tests__/rules.spec.ts` :

```ts
describe("errataChangeSchema / changes", () => {
  it("devrait accepter un errata avec des changements structurés", () => {
    const ok = errataRowSchema.safeParse({
      card_id: "opee-tissoin-incarnam",
      summary: "Passe à 6 PA.",
      sort_order: 0,
      changes: [{ label: "PA", before: "7", after: "6" }],
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.changes).toHaveLength(1);
  });

  it("devrait défaut à [] quand changes est absent (colonne pas encore migrée)", () => {
    const ok = errataRowSchema.safeParse({
      card_id: "x-incarnam",
      summary: "Texte.",
      sort_order: 0,
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.changes).toEqual([]);
  });

  it("devrait refuser un changement sans label", () => {
    const ko = errataRowSchema.safeParse({
      card_id: "x-incarnam",
      summary: "Texte.",
      sort_order: 0,
      changes: [{ before: "7", after: "6" }],
    });
    expect(ko.success).toBe(false);
  });
});
```

Ajouter à `src/services/__tests__/errataService.spec.ts` :

```ts
it("devrait exposer les changements structurés sur l'entrée", async () => {
  stubRows([{ ...ROW, changes: [{ label: "PA", before: "7", after: "6" }] }]);
  await preloadErrata();
  const e = getErrata("opee-tissoin-incarnam")[0];
  expect(e.changes).toEqual([{ label: "PA", before: "7", after: "6" }]);
});

it("devrait exposer un tableau vide quand la colonne changes est absente", async () => {
  stubRows([ROW]); // ROW n'a pas de `changes`
  await preloadErrata();
  expect(getErrata("opee-tissoin-incarnam")[0].changes).toEqual([]);
});
```

- [ ] **Step 4: Voir échouer**

Run: `npx vitest run src/schema/__tests__/rules.spec.ts src/services/__tests__/errataService.spec.ts`
Expected: FAIL — `changes` inconnu / `errataChangeSchema` non exporté.

- [ ] **Step 5: Étendre le schéma**

Dans `src/schema/rules.ts`, avant `errataRowSchema` :

```ts
/**
 * Un changement porté par un errata : « tel champ passe de X à Y ».
 * `label` est le nom du champ tel qu'il est montré au joueur (« PA »,
 * « Sous-types », « Effet ») — libre, pas une énumération : les errata touchent
 * des champs variés et le libellé officiel prime sur une taxonomie interne.
 * `before`/`after` sont des CHAÎNES affichées telles quelles : on affiche, on ne
 * recalcule aucune version de carte.
 */
export const errataChangeSchema = z.object({
  label: z.string().min(1),
  before: z.string(),
  after: z.string(),
});
```

puis, dans `errataRowSchema`, ajouter le champ :

```ts
  changes: z.array(errataChangeSchema).default([]),
```

et les types en bas du fichier :

```ts
export type ErrataChange = z.infer<typeof errataChangeSchema>;
```

- [ ] **Step 6: Étendre le type public du service**

Dans `src/services/errataService.ts` :

- ajouter `import type { ErrataChange } from "@/schema";` (l'import de `errataRowSchema` existe déjà) ;
- ajouter à l'interface `ErrataEntry` :

```ts
  /** Changements structurés (« PA : 7 → 6 »). Vide = errata non encore structuré. */
  changes: ErrataChange[];
```

- dans le mapping de `load()`, ajouter `changes: r.changes,` à l'objet poussé dans l'index.

- [ ] **Step 7: Vérifier + commit**

Run: `npx vitest run && npm run type-check`
Expected: 0 échec.

```bash
git add supabase/migrations/0014_errata_changes.sql src/schema/rules.ts src/services/errataService.ts src/schema/__tests__/rules.spec.ts src/services/__tests__/errataService.spec.ts
git commit -m "feat(errata): changements structurés champ par champ (additif, défaut [])"
```

---

### Task 2: `ErrataPanel` — le composant d'affichage partagé

**Files:**

- Create: `src/components/card/ErrataPanel.vue`
- Create: `src/components/card/__tests__/ErrataPanel.spec.ts`

**Interfaces:**

- Consumes: `ErrataEntry` (avec `changes`), `formatFrenchDate` (`@/utils/date`).
- Produces: composant `ErrataPanel`, prop `errata: ErrataEntry[]`. Ne rend **rien** si le tableau est vide.

**Pourquoi ce composant :** les deux rendus actuels ont déjà divergé — `CollectionView` affiche l'avant/après, `CardZoomInner` non. Une seule implémentation rend la divergence impossible.

- [ ] **Step 1: Écrire le test qui échoue**

`src/components/card/__tests__/ErrataPanel.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ErrataPanel from "@/components/card/ErrataPanel.vue";

const BASE = {
  date: "2011-10-05",
  source: "Forum officiel Wakfu",
  summary: "Coût en PA ramené à 6.",
  changes: [],
};

describe("ErrataPanel", () => {
  it("ne devrait rien rendre sans errata", () => {
    const w = mount(ErrataPanel, { props: { errata: [] } });
    expect(w.text()).toBe("");
  });

  it("devrait afficher le tableau des changements quand ils sont structurés", () => {
    const w = mount(ErrataPanel, {
      props: {
        errata: [
          { ...BASE, changes: [{ label: "PA", before: "7", after: "6" }] },
        ],
      },
    });
    expect(w.find("table").exists()).toBe(true);
    expect(w.text()).toContain("PA");
    expect(w.text()).toContain("7");
    expect(w.text()).toContain("6");
    // Le libellé de colonne parle des exemplaires physiques, pas de l'image
    // affichée à côté (qui, elle, montre déjà la valeur corrigée).
    expect(w.text()).toContain("Version imprimée");
  });

  it("devrait retomber sur la prose quand changes est vide", () => {
    const w = mount(ErrataPanel, {
      props: { errata: [{ ...BASE, before: "7 PA", after: "6 PA" }] },
    });
    expect(w.find("table").exists()).toBe(false);
    expect(w.text()).toContain("Coût en PA ramené à 6.");
    expect(w.text()).toContain("7 PA");
    expect(w.text()).toContain("6 PA");
  });

  it("devrait afficher la date en français et la source", () => {
    const w = mount(ErrataPanel, { props: { errata: [BASE] } });
    expect(w.text()).toContain("05/10/2011");
    expect(w.text()).toContain("Forum officiel Wakfu");
  });

  it("devrait ignorer une ligne de changement mal formée sans casser le reste", () => {
    const w = mount(ErrataPanel, {
      props: {
        errata: [
          {
            ...BASE,
            changes: [
              { label: "", before: "x", after: "y" },
              { label: "PA", before: "7", after: "6" },
            ] as never,
          },
        ],
      },
    });
    expect(w.text()).toContain("PA");
  });
});
```

- [ ] **Step 2: Voir échouer**

Run: `npx vitest run src/components/card/__tests__/ErrataPanel.spec.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le composant**

`src/components/card/ErrataPanel.vue` :

```vue
<template>
  <div v-if="errata.length" class="mt-4" data-testid="errata-panel">
    <p class="eyebrow mb-2 text-primary">Errata officiel</p>
    <div
      v-for="(e, i) in errata"
      :key="i"
      class="border-l-2 border-primary bg-primary/5 p-3"
      :class="i > 0 ? 'mt-2' : ''"
    >
      <p class="text-sm leading-relaxed">{{ e.summary }}</p>

      <!-- Structuré : on montre précisément quel champ a changé. -->
      <table v-if="visibleChanges(e).length" class="mt-2 w-full text-xs">
        <thead>
          <tr class="text-left text-base-content/50">
            <th class="pr-3 font-normal">Champ</th>
            <th class="pr-3 font-normal">Version imprimée</th>
            <th class="font-normal">À jouer</th>
          </tr>
        </thead>
        <tbody class="font-mono">
          <tr v-for="(c, j) in visibleChanges(e)" :key="j">
            <td class="pr-3 align-top">{{ c.label }}</td>
            <td class="pr-3 align-top text-base-content/50 line-through">
              {{ c.before }}
            </td>
            <td class="align-top font-bold">{{ c.after }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Non structuré : repli sur la prose (état des errata pas encore saisis). -->
      <p v-else-if="e.before || e.after" class="mt-1 font-mono text-xs">
        <span v-if="e.before" class="text-base-content/50 line-through">{{
          e.before
        }}</span>
        <span v-if="e.before && e.after"> → </span>
        <span v-if="e.after" class="text-base-content">{{ e.after }}</span>
      </p>

      <p
        class="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-base-content/45"
      >
        {{ formatFrenchDate(e.date)
        }}<span v-if="e.source"> · {{ e.source }}</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ErrataEntry } from "@/services/errataService";
import { formatFrenchDate } from "@/utils/date";

defineProps<{ errata: ErrataEntry[] }>();

/**
 * Une ligne sans libellé n'est pas affichable (colonne « Champ » vide) : on
 * l'écarte plutôt que de rendre une ligne muette. Jamais d'exception — un
 * errata mal saisi ne doit pas casser la fiche de carte.
 */
function visibleChanges(e: ErrataEntry) {
  return (e.changes ?? []).filter((c) => c?.label?.trim());
}
</script>
```

- [ ] **Step 4: Vérifier + commit**

Run: `npx vitest run src/components/card/__tests__/ErrataPanel.spec.ts && npm run type-check`
Expected: 5 tests PASS.

```bash
git add src/components/card/ErrataPanel.vue src/components/card/__tests__/ErrataPanel.spec.ts
git commit -m "feat(errata): composant partagé ErrataPanel (tableau des changements + repli prose)"
```

---

### Task 3: Brancher `ErrataPanel` sur les DEUX chemins de rendu

**Files:**

- Modify: `src/components/card/CardZoomInner.vue`
- Modify: `src/views/CollectionView.vue`

**Interfaces:**

- Consumes: `ErrataPanel` (Task 2).

**But :** supprimer la duplication existante. `CollectionView` affiche l'avant/après, `CardZoomInner` non — après cette tâche, les deux affichent la même chose parce que c'est le même composant.

- [ ] **Step 1: Remplacer le bloc dans `CardZoomInner.vue`**

Supprimer le bloc `<!-- Erratas -->` (le `<div v-if="errata.length">` et tout son contenu) et le remplacer par :

```vue
<!-- Errata officiels : composant partagé avec le panneau de la Collection. -->
<ErrataPanel :errata="errata" />
```

Dans le `<script setup>`, ajouter `import ErrataPanel from "@/components/card/ErrataPanel.vue";`.
Si `formatFrenchDate` n'est plus utilisé ailleurs dans ce fichier, retirer son import (vue-tsc signalera l'import inutilisé).

- [ ] **Step 2: Remplacer le bloc dans `CollectionView.vue`**

Supprimer le bloc `<!-- Errata (officiels) -->` (le `<template v-if="cardErrata.length">` et tout son contenu) et le remplacer par :

```vue
<!-- Errata officiels : composant partagé avec le zoom de carte. -->
<ErrataPanel :errata="cardErrata" />
```

Ajouter l'import du composant dans le `<script setup>`.

**Ne pas toucher** au badge « Errata » de l'en-tête (ligne ~262, `v-if="cardErrata.length"`) : il reste.

- [ ] **Step 3: Vérifier que rien n'a régressé**

Run: `npx vitest run src/components/card src/views && npm run type-check`
Expected: 0 échec. Les tests existants de `CardZoomInner` / `CardZoomModal` / `CollectionView` doivent passer **sans modification** — s'ils échouent parce qu'ils cherchaient un balisage précis, adapter **le test** au nouveau balisage (le composant partagé rend désormais les deux à l'identique), et le signaler dans le rapport.

- [ ] **Step 4: Commit**

```bash
git add src/components/card/CardZoomInner.vue src/views/CollectionView.vue
git commit -m "refactor(errata): un seul rendu partagé pour les deux chemins (fin de la divergence)"
```

---

### Task 4: `ErrataForm` — extraire le formulaire, y ajouter les changements

**Files:**

- Create: `src/components/admin/ErrataForm.vue`
- Modify: `src/views/admin/AdminErrataView.vue`
- Create: `src/components/admin/__tests__/ErrataForm.spec.ts`

**Interfaces:**

- Consumes: `useCardStore` (autocomplétion), `AdminErratum` (`@/services/adminService`).
- Produces: composant `ErrataForm` — props `{ modelValue: ErrataFormState; cards: {id: string; name: string}[] }`, émet `submit` et `cancel`. Type `ErrataFormState = { id?: number; card_id: string; errata_date: string; source: string; summary: string; before_text: string; after_text: string; changes: ErrataChange[] }`.

**Pourquoi :** le formulaire servira **deux** points d'entrée (l'écran d'admin et la fiche de carte). Une seule implémentation évite la divergence que la revue précédente a justement pointée entre `RulesOfficialView` et `AdminRulesView`.

- [ ] **Step 1: Lire l'existant**

Lire `src/views/admin/AdminErrataView.vue` en entier. Le formulaire y est inline avec les `data-testid` : `f-card`, `f-date`, `f-source`, `f-summary`, `f-before`, `f-after`, `errata-submit`. **Ces identifiants doivent être conservés à l'identique** — les tests existants de l'écran s'appuient dessus.

- [ ] **Step 2: Écrire le test qui échoue**

`src/components/admin/__tests__/ErrataForm.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ErrataForm from "@/components/admin/ErrataForm.vue";

const CARDS = [{ id: "opee-tissoin-incarnam", name: "Opée Tissoin" }];

function state(over = {}) {
  return {
    card_id: "",
    errata_date: "",
    source: "",
    summary: "",
    before_text: "",
    after_text: "",
    changes: [],
    ...over,
  };
}

describe("ErrataForm", () => {
  it("devrait exposer les champs attendus", () => {
    const w = mount(ErrataForm, {
      props: { modelValue: state(), cards: CARDS },
    });
    for (const id of [
      "f-card",
      "f-date",
      "f-source",
      "f-summary",
      "f-before",
      "f-after",
    ])
      expect(w.find(`[data-testid="${id}"]`).exists()).toBe(true);
  });

  it("devrait ajouter puis retirer une ligne de changement", async () => {
    const w = mount(ErrataForm, {
      props: { modelValue: state(), cards: CARDS },
    });
    await w.find('[data-testid="add-change"]').trigger("click");
    expect(w.find('[data-testid="change-label-0"]').exists()).toBe(true);
    await w.find('[data-testid="remove-change-0"]').trigger("click");
    expect(w.find('[data-testid="change-label-0"]').exists()).toBe(false);
  });

  it("devrait pré-remplir les changements existants", () => {
    const w = mount(ErrataForm, {
      props: {
        modelValue: state({
          changes: [{ label: "PA", before: "7", after: "6" }],
        }),
        cards: CARDS,
      },
    });
    expect(
      (w.find('[data-testid="change-label-0"]').element as HTMLInputElement)
        .value,
    ).toBe("PA");
  });

  it("devrait émettre submit", async () => {
    const w = mount(ErrataForm, {
      props: {
        modelValue: state({ summary: "x", card_id: "y" }),
        cards: CARDS,
      },
    });
    await w.find('[data-testid="errata-submit"]').trigger("click");
    expect(w.emitted("submit")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Voir échouer.**

- [ ] **Step 4: Écrire `ErrataForm.vue`**

Déplacer le balisage du formulaire depuis `AdminErrataView.vue` (mêmes `data-testid`, mêmes libellés), et ajouter une section « Changements » :

- un bouton `data-testid="add-change"` qui pousse `{ label: "", before: "", after: "" }` ;
- par ligne `j` : trois inputs `data-testid="change-label-<j>"`, `change-before-<j>`, `change-after-<j>`, et un bouton `remove-change-<j>` ;
- un texte d'aide : « Optionnel. Renseigné, l'errata s'affiche champ par champ sur la fiche de la carte ; sinon c'est le résumé et l'avant/après qui s'affichent. »

Le composant travaille sur `modelValue` (mutation directe des propriétés de l'objet, comme le fait déjà l'écran avec son `form` réactif) et émet `submit` / `cancel`. La validation « résumé obligatoire » **reste dans l'écran appelant** (elle décide de l'appel au service) — le formulaire ne fait que collecter.

- [ ] **Step 5: Faire consommer le composant par `AdminErrataView`**

Remplacer le formulaire inline par `<ErrataForm :model-value="form" :cards="cardStore.cards" @submit="submit" @cancel="closeForm" />`, en conservant l'état `form` et la logique de soumission déjà en place. Ajouter `changes: []` à l'état initial du formulaire (`emptyForm()`) et le transmettre dans le payload envoyé à `createErratum` / `updateErratum`.

- [ ] **Step 6: Vérifier**

Run: `npx vitest run src/components/admin src/views/admin && npm run type-check`
Expected: les tests existants d'`AdminErrataView` passent **sans modification** (les `data-testid` sont préservés).

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/ErrataForm.vue src/components/admin/__tests__/ErrataForm.spec.ts src/views/admin/AdminErrataView.vue
git commit -m "refactor(admin): ErrataForm partagé + édition des changements structurés"
```

---

### Task 5: Édition en place depuis la fiche de carte

**Files:**

- Modify: `src/components/card/ErrataPanel.vue`
- Modify: `src/components/card/__tests__/ErrataPanel.spec.ts`

**Interfaces:**

- Consumes: `authStore.isAdmin`, `ErrataForm` (Task 4), `listErrataAdmin` / `createErratum` / `updateErratum` (`@/services/adminService`), `useToast`.
- Produces: `ErrataPanel` accepte une prop `cardId?: string`. Fournie **et** l'utilisateur admin → affordance d'édition.

**Important :** l'affordance dépend d'`isAdmin` **pour l'affichage uniquement**. La RLS refuse réellement l'écriture — ne pas présenter la garde comme une protection.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `src/components/card/__tests__/ErrataPanel.spec.ts` (avec un mock d'`authStore` en tête de fichier) :

```ts
let admin = false;
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ isAdmin: admin }),
}));
```

puis :

```ts
describe("ErrataPanel — édition en place", () => {
  it("ne devrait proposer aucune édition à un non-admin", () => {
    admin = false;
    const w = mount(ErrataPanel, {
      props: { errata: [BASE], cardId: "opee-tissoin-incarnam" },
    });
    expect(w.find('[data-testid="edit-errata"]').exists()).toBe(false);
  });

  it("devrait proposer l'édition à un admin", () => {
    admin = true;
    const w = mount(ErrataPanel, {
      props: { errata: [BASE], cardId: "opee-tissoin-incarnam" },
    });
    expect(w.find('[data-testid="edit-errata"]').exists()).toBe(true);
  });

  it("devrait proposer l'AJOUT à un admin sur une carte sans errata", () => {
    admin = true;
    const w = mount(ErrataPanel, {
      props: { errata: [], cardId: "bouftou-incarnam" },
    });
    expect(w.find('[data-testid="edit-errata"]').text()).toContain("Ajouter");
  });

  it("ne devrait rien proposer sans cardId (usage lecture seule)", () => {
    admin = true;
    const w = mount(ErrataPanel, { props: { errata: [BASE] } });
    expect(w.find('[data-testid="edit-errata"]').exists()).toBe(false);
  });
});
```

> Noter le 3ᵉ cas : avec `cardId` et **aucun** errata, le panneau ne rend plus « rien » —
> il rend l'affordance d'ajout pour un admin. Adapter la condition racine du composant
> (`v-if="errata.length || canEdit"`), et **conserver** le premier test (« ne rend rien
> sans errata ») qui, lui, passe sans `cardId`.

- [ ] **Step 2: Voir échouer.**

- [ ] **Step 3: Implémenter**

Dans `ErrataPanel.vue` :

- prop optionnelle `cardId?: string` ;
- `const canEdit = computed(() => !!props.cardId && authStore.isAdmin)` ;
- condition racine `v-if="errata.length || canEdit"` ;
- un bouton `data-testid="edit-errata"` — libellé « Éditer l'errata » si `errata.length`, « Ajouter un errata » sinon — qui ouvre `ErrataForm` (pré-rempli depuis le premier errata de la carte, ou vide) ;
- à la soumission : `updateErratum` si un `id` est connu, sinon `createErratum` ; en cas de succès `refreshErrata()` + toast, en cas de refus toast d'erreur **et saisie conservée** (règle en vigueur sur tous les écrans d'admin) ;
- pour retrouver l'`id` de l'errata à éditer (le type public `ErrataEntry` ne le porte pas), appeler `listErrataAdmin()` à l'ouverture du formulaire et filtrer sur `card_id` ;
- à côté du bouton d'édition, pour les admins, un lien **« historique »** vers `/admin/journal` :

```vue
<RouterLink
  v-if="canEdit"
  to="/admin/journal"
  class="link text-xs opacity-70"
  data-testid="errata-history"
>historique</RouterLink>
```

Le lien est **volontairement non filtré** : `AdminJournalView` n'accepte aucun filtre par
paramètre d'URL aujourd'hui (vérifié). L'admin y arrive et utilise les filtres de l'écran.
Ne pas fabriquer un lien profond « filtré sur cet errata » qui ne fonctionnerait pas.
Ajouter un test : le lien est absent pour un non-admin.

- [ ] **Step 4: Brancher `cardId` sur les deux chemins**

Dans `CardZoomInner.vue` : `<ErrataPanel :errata="errata" :card-id="card.id" />`.
Dans `CollectionView.vue` : `<ErrataPanel :errata="cardErrata" :card-id="selectedCard?.id" />`.

- [ ] **Step 5: Vérifier + commit**

Run: `npx vitest run && npm run type-check`
Expected: 0 échec.

```bash
git add src/components/card/ErrataPanel.vue src/components/card/__tests__/ErrataPanel.spec.ts src/components/card/CardZoomInner.vue src/views/CollectionView.vue
git commit -m "feat(errata): édition en place depuis la fiche de carte (admin)"
```

---

### Task 6: Vérification finale et documentation

- [ ] **Step 1: Suite complète, types, build**

Run: `npx vitest run && npm run type-check && npm run build`
Expected: 0 échec.

- [ ] **Step 2: Vérifier qu'aucune décision de sécurité ne dépend du front**

Run: `grep -rn "isAdmin" src/components/card/ErrataPanel.vue`
Attendu : uniquement de l'affichage conditionnel (`canEdit`), jamais un contournement d'appel.

- [ ] **Step 3: Documentation**

Dans `CLAUDE.md`, compléter la ligne « Errata & règles officielles » : les errata portent désormais des **changements structurés** (`changes`, « PA : 7 → 6 ») affichés champ par champ sur la fiche de carte via le composant partagé `ErrataPanel` ; un admin peut éditer l'errata **depuis la carte**. Préciser que la migration `0014` doit être appliquée (sinon l'affichage reste celui d'avant, sans rien casser).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: errata structurés et édition en place"
```
