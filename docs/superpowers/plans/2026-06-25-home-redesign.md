# Refonte de la landing (HomeView) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre `HomeView` en landing vibrante « univers Wakfu », adaptative (vitrine déconnecté / dashboard connecté), avec des chiffres réels live, les vraies icônes d'éléments, et une vitrine des decks officiels liée aux pages détail.

**Architecture:** Helpers purs (`homeStats.ts`) testables ; 3 composants présentationnels (`ElementShowcase`, `FeaturedDecks`, `HomeStatsBar`) ; `HomeView` orchestre, initialise le `cardStore`, calcule les stats live et bascule connecté/déconnecté.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, vue-router, Pinia (cardStore/deckStore/authStore), `ElementIcon`/`elementService`, Vitest + @vue/test-utils.

**Spec:** [docs/superpowers/specs/2026-06-25-home-redesign-design.md](../specs/2026-06-25-home-redesign-design.md)

---

## File Structure

| Fichier                                                 | Rôle                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/utils/homeStats.ts` (créer)                        | Purs : `distinctExtensionCount(cards)`, `pickFeaturedDecks(decks, n)`. |
| `src/components/home/ElementShowcase.vue` (créer)       | Les 5 éléments via `<ElementIcon>` + couleur thématique.               |
| `src/components/home/FeaturedDecks.vue` (créer)         | Decks en vedette (présentationnel) → liens `/decks/official/:id`.      |
| `src/components/home/HomeStatsBar.vue` (créer)          | Barre de stats (props: items).                                         |
| `src/views/HomeView.vue` (réécrire)                     | Orchestration adaptative + hero + features + CTA.                      |
| `tests/utils/homeStats.spec.ts` (créer)                 | Helpers purs.                                                          |
| `tests/components/home/ElementShowcase.spec.ts` (créer) | 5 icônes.                                                              |
| `tests/components/home/FeaturedDecks.spec.ts` (créer)   | N liens vers les pages détail.                                         |

---

## Task 1: Helpers purs `homeStats.ts`

**Files:**

- Create: `src/utils/homeStats.ts`
- Test: `tests/utils/homeStats.spec.ts`

- [ ] **Step 1: Test (échoue — module absent)**

Créer `tests/utils/homeStats.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { distinctExtensionCount, pickFeaturedDecks } from "@/utils/homeStats";
import type { OfficialDeck } from "@/data/officialDecks";

describe("homeStats", () => {
  it("distinctExtensionCount compte les extensions distinctes, ignore les vides", () => {
    const cards = [
      { extension: { name: "Incarnam" } },
      { extension: { name: "Incarnam" } },
      { extension: { name: "Astrub" } },
      {},
      { extension: {} },
    ];
    expect(distinctExtensionCount(cards)).toBe(2);
  });

  it("pickFeaturedDecks priorise les decks avec lore puis complète, longueur n", () => {
    const mk = (id: string, lore?: string): OfficialDeck => ({
      id,
      name: id,
      description: "",
      extension: "dofus-mag",
      hero: "H",
      havreSac: "HS",
      cards: [],
      ...(lore ? { lore } : {}),
    });
    const decks = [mk("a"), mk("b", "histoire"), mk("c"), mk("d", "récit")];
    const picked = pickFeaturedDecks(decks, 3);
    expect(picked).toHaveLength(3);
    expect(picked.slice(0, 2).map((d) => d.id)).toEqual(["b", "d"]); // lore d'abord
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npx vitest run tests/utils/homeStats.spec.ts`
Expected: FAIL — module `@/utils/homeStats` introuvable.

- [ ] **Step 3: Implémenter `src/utils/homeStats.ts`**

```ts
import type { OfficialDeck } from "@/data/officialDecks";

/** Nombre d'extensions de cartes distinctes (vraies extensions, ≠ catégories de decks). */
export function distinctExtensionCount(
  cards: { extension?: { name?: string } }[],
): number {
  const set = new Set<string>();
  for (const c of cards) {
    const name = c.extension?.name;
    if (name) set.add(name);
  }
  return set.size;
}

/**
 * Sélectionne les decks à mettre en vedette : ceux avec un `lore` (decks Dofus
 * Mag riches, avec récit + art) d'abord, puis les autres, jusqu'à `n`. Pur et
 * déterministe.
 */
export function pickFeaturedDecks(
  decks: OfficialDeck[],
  n: number,
): OfficialDeck[] {
  const withLore = decks.filter((d) => d.lore);
  const rest = decks.filter((d) => !d.lore);
  return [...withLore, ...rest].slice(0, n);
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npx vitest run tests/utils/homeStats.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/homeStats.ts tests/utils/homeStats.spec.ts
git commit -m "feat(home): helpers purs homeStats (extensions distinctes, decks vedette)"
```

---

## Task 2: `ElementShowcase.vue`

**Files:**

- Create: `src/components/home/ElementShowcase.vue`
- Test: `tests/components/home/ElementShowcase.spec.ts`

- [ ] **Step 1: Test (échoue — composant absent)**

Créer `tests/components/home/ElementShowcase.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ElementShowcase from "@/components/home/ElementShowcase.vue";
import ElementIcon from "@/components/elements/ElementIcon.vue";

describe("ElementShowcase", () => {
  it("rend les 5 éléments avec leur icône", () => {
    const w = mount(ElementShowcase);
    expect(w.findAllComponents(ElementIcon)).toHaveLength(5);
    const t = w.text();
    for (const el of ["Air", "Eau", "Feu", "Terre", "Neutre"]) {
      expect(t).toContain(el);
    }
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npx vitest run tests/components/home/ElementShowcase.spec.ts`
Expected: FAIL — composant introuvable.

- [ ] **Step 3: Implémenter `src/components/home/ElementShowcase.vue`**

```vue
<template>
  <div class="flex flex-wrap gap-x-6 gap-y-4">
    <div v-for="el in elementList" :key="el" class="flex items-center gap-2.5">
      <ElementIcon :element="el" size="md" />
      <span
        class="font-mono text-xs uppercase tracking-wider text-base-content/70"
      >
        {{ el }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import ElementIcon from "@/components/elements/ElementIcon.vue";
import { ELEMENTS, type Element } from "@/services/elementService";

const elementList: Element[] = [
  ELEMENTS.AIR,
  ELEMENTS.EAU,
  ELEMENTS.FEU,
  ELEMENTS.TERRE,
  ELEMENTS.NEUTRE,
];
</script>
```

- [ ] **Step 4: Lancer → succès + commit**

Run: `npx vitest run tests/components/home/ElementShowcase.spec.ts`
Expected: PASS (1 test).

```bash
git add src/components/home/ElementShowcase.vue tests/components/home/ElementShowcase.spec.ts
git commit -m "feat(home): ElementShowcase (5 vraies icônes d'éléments)"
```

---

## Task 3: `FeaturedDecks.vue`

**Files:**

- Create: `src/components/home/FeaturedDecks.vue`
- Test: `tests/components/home/FeaturedDecks.spec.ts`

> Présentationnel : reçoit des items déjà résolus `{ id, name, hero, img }`. `HomeView` les construit.

- [ ] **Step 1: Test (échoue)**

Créer `tests/components/home/FeaturedDecks.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import FeaturedDecks from "@/components/home/FeaturedDecks.vue";

const items = [
  {
    id: "deck-a",
    name: "Deck A",
    hero: "Héros A",
    img: "/images/cards/a_recto.webp",
  },
  {
    id: "deck-b",
    name: "Deck B",
    hero: "Héros B",
    img: "/images/cards/b_recto.webp",
  },
];

describe("FeaturedDecks", () => {
  it("rend un lien vers la page détail par deck", () => {
    const w = mount(FeaturedDecks, {
      props: { items },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    const links = w.findAllComponents(RouterLinkStub);
    expect(links).toHaveLength(2);
    expect(links[0].props("to")).toBe("/decks/official/deck-a");
    expect(w.text()).toContain("Deck A");
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npx vitest run tests/components/home/FeaturedDecks.spec.ts`
Expected: FAIL — composant introuvable.

- [ ] **Step 3: Implémenter `src/components/home/FeaturedDecks.vue`**

```vue
<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    <router-link
      v-for="it in items"
      :key="it.id"
      :to="`/decks/official/${it.id}`"
      class="group block"
    >
      <div class="plate-frame transition group-hover:-translate-y-1">
        <img
          :src="it.img"
          :alt="it.hero"
          class="aspect-[7/10] object-cover object-[50%_18%]"
          loading="lazy"
          @error="onImgError"
        />
      </div>
      <p class="plate-caption truncate text-center">{{ it.name }}</p>
    </router-link>
  </div>
</template>

<script setup lang="ts">
export interface FeaturedItem {
  id: string;
  name: string;
  hero: string;
  img: string;
}

defineProps<{ items: FeaturedItem[] }>();

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}
</script>
```

- [ ] **Step 4: Lancer → succès + commit**

Run: `npx vitest run tests/components/home/FeaturedDecks.spec.ts`
Expected: PASS (1 test).

```bash
git add src/components/home/FeaturedDecks.vue tests/components/home/FeaturedDecks.spec.ts
git commit -m "feat(home): FeaturedDecks (vitrine → pages détail)"
```

---

## Task 4: `HomeStatsBar.vue`

**Files:**

- Create: `src/components/home/HomeStatsBar.vue`

> Présentationnel pur, vérifié via la vue en preview ; pas de test unitaire dédié (rendu trivial d'une liste de props).

- [ ] **Step 1: Implémenter `src/components/home/HomeStatsBar.vue`**

```vue
<template>
  <div class="grid grid-cols-2 gap-6 sm:grid-cols-4">
    <div v-for="s in items" :key="s.label">
      <p class="eyebrow">{{ s.label }}</p>
      <p class="mt-1 font-mono text-3xl tabular">{{ s.value }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface StatItem {
  label: string;
  value: string | number;
}
defineProps<{ items: StatItem[] }>();
</script>
```

- [ ] **Step 2: Type-check + commit**

Run: `npm run type-check`
Expected: aucune erreur.

```bash
git add src/components/home/HomeStatsBar.vue
git commit -m "feat(home): HomeStatsBar (barre de stats présentationnelle)"
```

---

## Task 5: Réécriture de `HomeView.vue`

**Files:**

- Modify (réécrire): `src/views/HomeView.vue`

> Vue dépendante des stores → vérifiée en preview (Task 6). Câblage + composition.

- [ ] **Step 1: Réécrire `src/views/HomeView.vue`**

```vue
<template>
  <div class="space-y-14 sm:space-y-20">
    <!-- ── HERO ── -->
    <section class="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
      <div class="animate-fadeIn">
        <p class="eyebrow text-primary">Compagnon du TCG Wakfu</p>
        <h1 class="mt-4 font-display text-5xl leading-[1.04] sm:text-6xl">
          L'Almanach<br />des Douze
        </h1>

        <template v-if="authStore.isAuthenticated">
          <p class="mt-6 max-w-md text-lg leading-relaxed text-base-content/75">
            Content de vous revoir. Votre collection et vos decks vous
            attendent.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <router-link to="/collection" class="btn btn-primary"
              >Ma collection</router-link
            >
            <router-link to="/decks" class="btn btn-outline"
              >Mes decks</router-link
            >
            <router-link to="/play/table" class="btn btn-outline"
              >Ouvrir la table</router-link
            >
          </div>
        </template>
        <template v-else>
          <p class="mt-6 max-w-md text-lg leading-relaxed text-base-content/75">
            Constituez votre collection, composez des decks valides au
            millimètre, et jouez en ligne — règles gérées, prêt à jouer sans
            tout connaître.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <router-link to="/auth" class="btn btn-primary"
              >Créer un compte</router-link
            >
            <router-link to="/play/table?tutorial=1" class="btn btn-outline"
              >Essayer la table</router-link
            >
            <router-link to="/collection" class="btn btn-ghost"
              >Parcourir les cartes</router-link
            >
          </div>
        </template>

        <div class="mt-10">
          <ElementShowcase />
        </div>
      </div>

      <!-- Mur de planches héros -->
      <div class="grid grid-cols-3 gap-3 sm:gap-4">
        <figure v-for="(p, i) in heroPlates" :key="p.id">
          <div
            class="plate-frame"
            :class="{ 'mt-6': i === 1 }"
            :style="{ '--spine': p.color }"
          >
            <img
              :src="p.img"
              :alt="p.name"
              class="aspect-[7/10] object-cover object-[50%_18%]"
              loading="lazy"
              @error="onImgError"
            />
          </div>
          <figcaption class="plate-caption text-center">
            {{ p.name }}
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- ── STATS (réelles) ── -->
    <section class="border-y border-base-content/80 py-6">
      <HomeStatsBar :items="stats" />
    </section>

    <!-- ── CE QUE FAIT L'APP ── -->
    <section>
      <p class="section-rule eyebrow">Tout pour le TCG Wakfu</p>
      <div class="mt-5 grid gap-px bg-base-content/15 sm:grid-cols-2">
        <router-link
          v-for="f in features"
          :key="f.title"
          :to="f.to"
          class="group bg-base-100 p-6 transition hover:bg-primary/[0.06]"
        >
          <p
            class="font-mono text-[11px] uppercase tracking-wider text-primary"
          >
            {{ f.eyebrow }}
          </p>
          <h3 class="mt-1 font-display text-2xl">{{ f.title }}</h3>
          <p class="mt-1.5 max-w-md text-base-content/70">{{ f.desc }}</p>
        </router-link>
      </div>
    </section>

    <!-- ── DECKS OFFICIELS EN VEDETTE ── -->
    <section>
      <div class="flex items-end justify-between gap-4">
        <p class="section-rule eyebrow flex-1">Decks officiels en vedette</p>
        <router-link to="/decks/official" class="btn btn-ghost btn-sm shrink-0">
          Tout voir →
        </router-link>
      </div>
      <div class="mt-5">
        <FeaturedDecks :items="featured" />
      </div>
    </section>

    <!-- ── CTA FINAL ── -->
    <section
      v-if="!authStore.isAuthenticated"
      class="flex flex-wrap items-center justify-between gap-4 border-y border-base-content/80 py-8"
    >
      <h2 class="font-display text-2xl sm:text-3xl">
        Prêt à tenir le registre des Douze ?
      </h2>
      <router-link to="/auth" class="btn btn-primary shrink-0"
        >Commencer</router-link
      >
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useAuthStore } from "@/stores/authStore";
import { useCardStore } from "@/stores/cardStore";
import { useDeckStore } from "@/stores/deckStore";
import {
  ALL_OFFICIAL_DECKS,
  EXTENSION_NAME_BY_SLUG,
} from "@/data/allOfficialDecks";
import { distinctExtensionCount, pickFeaturedDecks } from "@/utils/homeStats";
import ElementShowcase from "@/components/home/ElementShowcase.vue";
import HomeStatsBar from "@/components/home/HomeStatsBar.vue";
import FeaturedDecks, {
  type FeaturedItem,
} from "@/components/home/FeaturedDecks.vue";

const authStore = useAuthStore();
const cardStore = useCardStore();
const deckStore = useDeckStore();

const ready = ref(false);

const ELEMENT_COLORS: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};

function heroArt(
  name: string,
  ext?: string,
): { id: string; color: string } | null {
  const c = deckStore.findCardByName(name, undefined, ext);
  if (!c) return null;
  const el = (c.stats?.niveau?.element || c.stats?.force?.element || "neutre")
    .toString()
    .toLowerCase();
  return { id: c.id, color: ELEMENT_COLORS[el] || ELEMENT_COLORS.neutre };
}

// Planches héros du hero (decks reconnaissables, résolues live).
const heroPlates = computed(() => {
  const wanted = ALL_OFFICIAL_DECKS.slice(0, 3);
  return wanted.map((d) => {
    const art = ready.value
      ? heroArt(d.hero, EXTENSION_NAME_BY_SLUG[d.extension])
      : null;
    return {
      id: d.id,
      name: d.hero,
      color: art?.color || ELEMENT_COLORS.neutre,
      img: art
        ? `/images/cards/${art.id}_recto.webp`
        : "/images/card-back.webp",
    };
  });
});

// Stats réelles (live). Repli « … » tant que le cardStore charge.
const stats = computed(() => {
  const base = [
    {
      label: "Au catalogue",
      value: ready.value ? cardStore.totalCards.toLocaleString("fr-FR") : "…",
    },
    {
      label: "Extensions",
      value: ready.value ? distinctExtensionCount(cardStore.cards) : "…",
    },
    { label: "Decks officiels", value: ALL_OFFICIAL_DECKS.length },
    { label: "Éléments", value: 5 },
  ];
  if (!authStore.isAuthenticated) return base;
  const valid = deckStore.decks.filter(
    (d) =>
      d.hero &&
      d.havreSac &&
      d.cards
        .filter((c) => !c.isReserve)
        .reduce((a, c) => a + c.quantity, 0) === 48,
  ).length;
  return [
    base[0],
    {
      label: "Possédées",
      value: Object.keys(cardStore.collection || {}).length,
    },
    { label: "Mes decks", value: deckStore.decks.length },
    { label: "Decks prêts", value: valid },
  ];
});

const featured = computed<FeaturedItem[]>(() =>
  pickFeaturedDecks(ALL_OFFICIAL_DECKS, 6).map((d) => {
    const art = ready.value
      ? heroArt(d.hero, EXTENSION_NAME_BY_SLUG[d.extension])
      : null;
    return {
      id: d.id,
      name: d.name,
      hero: d.hero,
      img: art
        ? `/images/cards/${art.id}_recto.webp`
        : "/images/card-back.webp",
    };
  }),
);

const features = [
  {
    eyebrow: "Catalogue",
    title: "Le registre des cartes",
    desc: "Parcourez ~1485 cartes, consignez votre collection, normales et brillantes.",
    to: "/collection",
  },
  {
    eyebrow: "Atelier",
    title: "Construisez des decks",
    desc: "48 cartes, héros, havre-sac, limites : les règles vérifiées en continu.",
    to: "/deck-builder",
  },
  {
    eyebrow: "Table de jeu",
    title: "Jouez en ligne",
    desc: "Règles gérées, effets résolus. Un tutoriel guidé pour démarrer en 5 min.",
    to: "/play/table",
  },
  {
    eyebrow: "Prêts à jouer",
    title: "73 decks officiels",
    desc: "Starters et idées de deck du Dofus Mag, importables en un clic.",
    to: "/decks/official",
  },
];

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}

onMounted(async () => {
  if (!cardStore.isInitialized) await cardStore.initialize();
  deckStore.initialize();
  ready.value = true;
});
</script>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: aucune erreur. (Si `Card.stats` n'a pas la forme attendue, ajuster `heroArt` au type réel ; ne pas caster en `any` sans raison.)

- [ ] **Step 3: Commit**

```bash
git add src/views/HomeView.vue
git commit -m "feat(home): refonte landing vibrante adaptative (stats réelles, vitrine decks)"
```

---

## Task 6: Vérification finale + clôture

- [ ] **Step 1: Suite + type-check + build**

Run: `npm run type-check && npx vitest run && npm run build`
Expected: type-check OK ; tous les tests verts ; build OK.

- [ ] **Step 2: Preuve visuelle (preview)**

`preview_start` « dev ». Vérifier `/` :

- **Déconnecté** : hero (titre + CTA), planches héros résolues, 5 vraies icônes d'éléments, barre de stats RÉELLES (catalogue ~1485, extensions ~10, decks 73, éléments 5), 4 cartes de features, vitrine de 6 decks → cliquer un deck mène à `/decks/official/:id`, CTA final.
- **Connecté** (injection user Pinia comme dans les e2e) : hero « content de vous revoir » + actions, stats perso.
- Responsive (resize) + thème clair/sombre.
  Capturer un screenshot (ou snapshot DOM si timeout).

- [ ] **Step 3: Clôture**

Invoquer superpowers:finishing-a-development-branch (merge master / push / deploy selon le choix utilisateur).

---

## Self-Review

- **Couverture spec :** direction vibrante + nom conservé (T5) ✓ ; adaptatif connecté/déconnecté (T5) ✓ ; stats réelles live (T1 `distinctExtensionCount` + T5) ✓ ; vraies icônes d'éléments (T2 `ElementShowcase`/`ElementIcon`) ✓ ; vitrine decks → pages détail (T3 `FeaturedDecks` + T5 `pickFeaturedDecks`) ✓ ; features/CTA (T5) ✓ ; cardStore initialisé (T5 onMounted) ✓ ; tests homeStats/ElementShowcase/FeaturedDecks (T1/T2/T3) ✓ ; preview connecté & déconnecté (T6) ✓.
- **Placeholders :** aucun ; code complet par étape.
- **Cohérence des types :** `FeaturedItem` défini en T3, réexporté/consommé en T5 ; `StatItem` en T4, items construits en T5 ; `distinctExtensionCount`/`pickFeaturedDecks` signatures identiques T1↔T5 ; `Element`/`ELEMENTS` de `elementService` en T2.
- **Note :** stats perso (connecté) réutilisent la logique « deck valide = 48 » de l'ancien HomeView, conservée à l'identique.
