# Crédits / À propos / Premiers pas / Légal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a site footer and the institutional pages (À propos, Crédits, Premiers pas, Mentions légales, CGU) that explain the project's mission, credit Ankama and Safranil, and surface the Discord — using placeholders for real legal data.

**Architecture:** A global `<SiteFooter>` mounted in `App.vue` is the hub linking five new guest routes. Structured content (credits, first-steps) lives in testable `src/data/*.ts` `as const` modules consumed by thin views; prose pages (À propos, légal) are self-contained views. External URLs are centralized in `src/config/links.ts`.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, vue-router, Tailwind + DaisyUI, Vitest + @vue/test-utils (`RouterLinkStub`).

---

## File structure

| File                                                  | Responsibility                                      |
| ----------------------------------------------------- | --------------------------------------------------- |
| `src/config/links.ts` (create)                        | External URLs: Discord, wtcg-return, Ankama.        |
| `src/components/layout/SiteFooter.vue` (create)       | Global footer: link columns + disclaimer + Discord. |
| `src/App.vue` (modify)                                | Mount `<SiteFooter>` after `<main>`.                |
| `src/data/credits.ts` (create)                        | Structured credit entries (`as const`).             |
| `src/views/CreditsView.vue` (create)                  | Renders credits.                                    |
| `src/data/firstSteps.ts` (create)                     | Structured beginner steps (`as const`).             |
| `src/views/FirstStepsView.vue` (create)               | "Premiers pas" guide → tutorial CTA.                |
| `src/views/AboutView.vue` (create)                    | Mission / hommage prose.                            |
| `src/views/LegalNoticeView.vue` (create)              | Mentions légales (placeholders).                    |
| `src/views/TermsView.vue` (create)                    | CGU (placeholders).                                 |
| `src/router/index.ts` (modify)                        | Register 5 routes (guest).                          |
| `src/views/RulesView.vue` (modify)                    | Cross-link to `/regles/apprendre`.                  |
| `tests/config/links.spec.ts` (create)                 | Discord URL constant.                               |
| `tests/components/layout/SiteFooter.spec.ts` (create) | Links + external rel.                               |
| `tests/data/credits.spec.ts` (create)                 | Safranil + Ankama + wtcg link.                      |
| `tests/data/firstSteps.spec.ts` (create)              | Steps shape.                                        |
| `tests/views/FirstStepsView.spec.ts` (create)         | Renders steps + tutorial link.                      |

---

### Task 1: External links config

**Files:**

- Create: `src/config/links.ts`
- Test: `tests/config/links.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/config/links.spec.ts
import { describe, it, expect } from "vitest";
import {
  DISCORD_INVITE_URL,
  WTCG_RETURN_URL,
  ANKAMA_URL,
} from "@/config/links";

describe("external links", () => {
  it("pointe vers l'invitation Discord de la communauté", () => {
    expect(DISCORD_INVITE_URL).toBe("https://discord.com/invite/PjA8Z6SCYm");
  });
  it("référence le site de Safranil et Ankama", () => {
    expect(WTCG_RETURN_URL).toContain("wtcg-return.fr");
    expect(ANKAMA_URL).toContain("ankama.com");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** (`npx vitest run tests/config/links.spec.ts`) — "Cannot find module '@/config/links'".

- [ ] **Step 3: Implement**

```ts
// src/config/links.ts
/** Liens externes officiels utilisés dans le footer et les pages institutionnelles. */
export const DISCORD_INVITE_URL = "https://discord.com/invite/PjA8Z6SCYm";
export const WTCG_RETURN_URL = "https://www.wtcg-return.fr";
export const ANKAMA_URL = "https://www.ankama.com";
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Commit** — `feat(links): liens externes Discord / wtcg-return / Ankama`

---

### Task 2: SiteFooter component

**Files:**

- Create: `src/components/layout/SiteFooter.vue`
- Test: `tests/components/layout/SiteFooter.spec.ts`

Footer internal links use `<router-link>`; external links are `<a target="_blank" rel="noopener noreferrer">`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/layout/SiteFooter.spec.ts
import { describe, it, expect } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import SiteFooter from "@/components/layout/SiteFooter.vue";

function mountFooter() {
  return mount(SiteFooter, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
}

describe("SiteFooter", () => {
  it("lie les pages légales et institutionnelles", () => {
    const w = mountFooter();
    const targets = w
      .findAllComponents(RouterLinkStub)
      .map((l) => l.props("to"));
    for (const route of [
      "/a-propos",
      "/credits",
      "/regles/apprendre",
      "/mentions-legales",
      "/cgu",
    ]) {
      expect(targets).toContain(route);
    }
  });

  it("pointe vers le Discord en lien externe sécurisé", () => {
    const w = mountFooter();
    const discord = w
      .findAll("a")
      .find((a) => a.attributes("href")?.includes("discord.com"));
    expect(discord).toBeTruthy();
    expect(discord!.attributes("target")).toBe("_blank");
    expect(discord!.attributes("rel")).toContain("noopener");
  });

  it("crédite Safranil et Ankama dans le disclaimer", () => {
    const w = mountFooter();
    expect(w.text()).toContain("Safranil");
    expect(w.text()).toContain("Ankama");
    expect(w.text().toLowerCase()).toContain("non-officiel");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** (module not found).

- [ ] **Step 3: Implement** `src/components/layout/SiteFooter.vue`

```vue
<template>
  <footer class="mt-16 border-t border-base-content/80 bg-base-100">
    <div class="container mx-auto px-4 py-12 sm:px-6">
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <nav v-for="col in columns" :key="col.title" :aria-label="col.title">
          <p class="eyebrow mb-3 text-base-content/55">{{ col.title }}</p>
          <ul class="space-y-2">
            <li v-for="link in col.links" :key="link.label">
              <a
                v-if="link.external"
                :href="link.to"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-base-content/70 transition-colors hover:text-base-content"
              >
                {{ link.label }}
                <span aria-hidden="true">↗</span>
              </a>
              <router-link
                v-else
                :to="link.to"
                class="text-base-content/70 transition-colors hover:text-base-content"
              >
                {{ link.label }}
              </router-link>
            </li>
          </ul>
        </nav>
      </div>

      <div
        class="mt-10 flex flex-col gap-4 border-t border-base-content/15 pt-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="max-w-2xl text-sm leading-relaxed text-base-content/55">
          Projet de fan <strong>non-officiel</strong>, hommage au Wakfu TCG.
          Wakfu TCG © Ankama. Illustrations et listes de cartes grâce au
          travail de <strong>Safranil</strong> — wtcg-return.fr.
        </p>
        <a
          :href="DISCORD_INVITE_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-primary btn-sm shrink-0 gap-2"
        >
          Rejoindre le Discord
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { DISCORD_INVITE_URL } from "@/config/links";

interface FooterLink {
  label: string;
  to: string;
  external?: boolean;
}
interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const columns: FooterColumn[] = [
  {
    title: "Le projet",
    links: [
      { label: "À propos", to: "/a-propos" },
      { label: "Crédits", to: "/credits" },
    ],
  },
  {
    title: "Le jeu",
    links: [
      { label: "Premiers pas", to: "/regles/apprendre" },
      { label: "Règles & glossaire", to: "/regles" },
      { label: "Decks officiels", to: "/decks/official" },
    ],
  },
  {
    title: "Communauté",
    links: [
      { label: "Discord", to: DISCORD_INVITE_URL, external: true },
      { label: "Decks de la communauté", to: "/decks/community" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", to: "/mentions-legales" },
      { label: "CGU", to: "/cgu" },
    ],
  },
];
</script>
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Commit** — `feat(footer): SiteFooter (colonnes + Discord + disclaimer)`

---

### Task 3: Mount footer in App.vue

**Files:**

- Modify: `src/App.vue`

- [ ] **Step 1:** Add import after the `UserMenu` import (line ~150):

```ts
import SiteFooter from "./components/layout/SiteFooter.vue";
```

- [ ] **Step 2:** Insert the footer immediately after the closing `</main>` tag (line ~137), guarded like `<main>`:

```vue
<SiteFooter v-if="!isLoading && !error && !isBackendMissing" />
```

- [ ] **Step 3:** Run `npx vitest run` — expect green. Verify in preview later.

- [ ] **Step 4: Commit** — `feat(app): monte le footer global`

---

### Task 4: Credits data

**Files:**

- Create: `src/data/credits.ts`
- Test: `tests/data/credits.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/credits.spec.ts
import { describe, it, expect } from "vitest";
import { CREDITS } from "@/data/credits";

describe("CREDITS", () => {
  it("remercie Safranil avec un lien vers son site", () => {
    const safranil = CREDITS.find((c) => c.name.includes("Safranil"));
    expect(safranil).toBeTruthy();
    expect(safranil!.url).toContain("wtcg-return.fr");
  });
  it("crédite Ankama comme créateur de l'univers", () => {
    expect(CREDITS.some((c) => c.name.includes("Ankama"))).toBe(true);
  });
  it("chaque entrée a un titre et une description", () => {
    for (const c of CREDITS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/data/credits.ts
import { WTCG_RETURN_URL, ANKAMA_URL } from "@/config/links";

export interface CreditEntry {
  name: string;
  role: string;
  description: string;
  url?: string;
}

export const CREDITS: CreditEntry[] = [
  {
    name: "Ankama",
    role: "Créateur de l'univers",
    description:
      "Wakfu, le Wakfu TCG, ses cartes et ses illustrations sont la création d'Ankama. Tout l'univers, les personnages et les visuels leur appartiennent. Cette application est un hommage indépendant, sans aucune affiliation ni approbation d'Ankama.",
    url: ANKAMA_URL,
  },
  {
    name: "Safranil — Wakfu TCG Return",
    role: "Préservation & partage",
    description:
      "Un immense merci à Safranil pour son site Wakfu TCG Return, et pour son travail de partage des illustrations des cartes et des listes de decks. Cette base de données communautaire est le socle sans lequel cette application n'aurait pas pu exister.",
    url: WTCG_RETURN_URL,
  },
  {
    name: "La communauté Discord",
    role: "Joueurs & contributeurs",
    description:
      "Merci aux joueuses et joueurs du Discord pour leurs retours, leurs tests, et le relevé des listes de decks publiées par Ankama dans les Dofus Mag.",
  },
  {
    name: "Technologies",
    role: "Outils open source",
    description:
      "Application construite avec Vue 3, Pinia, Vite, Tailwind CSS & DaisyUI, Supabase et Tauri.",
  },
];
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Commit** — `feat(credits): données structurées des crédits`

---

### Task 5: CreditsView

**Files:**

- Create: `src/views/CreditsView.vue`

- [ ] **Step 1: Implement** (no separate test; covered by data test + route smoke)

```vue
<template>
  <div class="mx-auto max-w-3xl space-y-12">
    <header class="animate-fadeIn">
      <p class="eyebrow text-primary">Remerciements</p>
      <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
        Crédits
      </h1>
      <p class="mt-5 text-lg leading-relaxed text-base-content/75">
        Cette application n'existe que grâce au travail d'autres passionnés.
        Voici à qui l'on doit le Wakfu TCG et les ressources qui font vivre ce
        projet.
      </p>
    </header>

    <div class="h-px w-full bg-base-content/80"></div>

    <section class="space-y-8">
      <article
        v-for="c in credits"
        :key="c.name"
        class="grid gap-1 border-l-2 border-primary/40 pl-5"
      >
        <p class="eyebrow text-base-content/50">{{ c.role }}</p>
        <h2 class="font-display text-2xl">{{ c.name }}</h2>
        <p class="mt-1 leading-relaxed text-base-content/80">
          {{ c.description }}
        </p>
        <a
          v-if="c.url"
          :href="c.url"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-1 inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
        >
          {{ c.url.replace(/^https?:\/\//, "") }}
          <span aria-hidden="true">↗</span>
        </a>
      </article>
    </section>

    <section
      class="flex flex-wrap items-center justify-between gap-4 border-t border-base-content/80 py-8"
    >
      <p class="max-w-md text-base-content/70">
        Envie d'en savoir plus sur la démarche du projet&nbsp;?
      </p>
      <router-link to="/a-propos" class="btn btn-neutral shrink-0">
        → À propos
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { CREDITS } from "@/data/credits";
const credits = CREDITS;
</script>
```

- [ ] **Step 2: Commit** — `feat(credits): page Crédits`

---

### Task 6: First-steps data

**Files:**

- Create: `src/data/firstSteps.ts`
- Test: `tests/data/firstSteps.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/firstSteps.spec.ts
import { describe, it, expect } from "vitest";
import { FIRST_STEPS } from "@/data/firstSteps";

describe("FIRST_STEPS", () => {
  it("propose une séquence de plusieurs étapes", () => {
    expect(FIRST_STEPS.length).toBeGreaterThanOrEqual(4);
  });
  it("chaque étape a un titre et un contenu", () => {
    for (const s of FIRST_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/data/firstSteps.ts
export interface FirstStep {
  title: string;
  body: string;
}

export const FIRST_STEPS: FirstStep[] = [
  {
    title: "Le but du jeu",
    body: "Deux joueuses ou joueurs incarnent chacun un Héros. On gagne soit en réduisant les Points de Vie du Héros adverse à 0, soit en faisant monter son propre Héros jusqu'au Niveau 3 grâce à l'Expérience.",
  },
  {
    title: "Préparer son deck",
    body: "Un deck se construit autour d'exactement 1 Héros et 1 Havre-Sac, plus 48 autres cartes — 50 au total. Au maximum 3 exemplaires d'une même carte (1 seul pour les cartes Unique).",
  },
  {
    title: "La mise en place",
    body: "Posez votre Havre-Sac dans le Monde et votre Héros dans le Havre-Sac. Mélangez les 48 cartes restantes pour former votre Pioche, puis piochez votre main de départ (autant de cartes que vos Points d'Action).",
  },
  {
    title: "Le déroulé d'un tour",
    body: "Chaque tour suit 4 phases : Redressement (on redresse ses cartes inclinées), Principale (on joue des cartes, utilise des pouvoirs et déclare une attaque), Pioche (on complète sa main), puis Fin de tour.",
  },
  {
    title: "Attaquer et se défendre",
    body: "Une seule attaque par tour. On choisit une cible (le Héros, un Allié ou le Havre-Sac adverse), on déclare ses attaquants, l'adversaire déclare ses bloqueurs, puis les Forces s'infligent en Dommages. Les éléments (Air, Eau, Feu, Terre, Neutre) et la Résistance entrent en jeu.",
  },
  {
    title: "Gagner la partie",
    body: "Détruisez des Alliés adverses pour gagner de l'Expérience : 6 points font passer votre Héros au Niveau 2, 18 points au Niveau 3 — la victoire. Ou réduisez simplement le Héros adverse à 0 PV.",
  },
];
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Commit** — `feat(first-steps): données du guide débutant`

---

### Task 7: FirstStepsView

**Files:**

- Create: `src/views/FirstStepsView.vue`
- Test: `tests/views/FirstStepsView.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/views/FirstStepsView.spec.ts
import { describe, it, expect } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import FirstStepsView from "@/views/FirstStepsView.vue";
import { FIRST_STEPS } from "@/data/firstSteps";

describe("FirstStepsView", () => {
  it("rend toutes les étapes et un lien vers le tutoriel jouable", () => {
    const w = mount(FirstStepsView, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    expect(w.text()).toContain(FIRST_STEPS[0].title);
    const targets = w
      .findAllComponents(RouterLinkStub)
      .map((l) => l.props("to"));
    expect(targets).toContain("/play/table");
    expect(targets).toContain("/regles");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL.**

- [ ] **Step 3: Implement**

```vue
<template>
  <div class="mx-auto max-w-3xl space-y-12">
    <header class="animate-fadeIn">
      <p class="eyebrow text-primary">Débuter</p>
      <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
        Apprendre à jouer
      </h1>
      <p class="mt-5 text-lg leading-relaxed text-base-content/75">
        L'essentiel pour lancer votre première partie de Wakfu TCG. Pour le
        détail complet, consultez les
        <router-link to="/regles" class="text-primary hover:underline"
          >règles &amp; le glossaire</router-link
        >.
      </p>
      <router-link to="/play/table" class="btn btn-primary mt-6 gap-2">
        ▶ Lancer le tutoriel jouable
      </router-link>
    </header>

    <div class="h-px w-full bg-base-content/80"></div>

    <section>
      <ol class="space-y-8">
        <li
          v-for="(s, i) in steps"
          :key="s.title"
          class="grid grid-cols-[auto_1fr] items-baseline gap-4 sm:gap-6"
        >
          <span class="font-mono text-2xl tabular text-base-content/35">
            {{ String(i + 1).padStart(2, "0") }}
          </span>
          <div>
            <h2 class="font-display text-2xl">{{ s.title }}</h2>
            <p class="mt-1 leading-relaxed text-base-content/80">
              {{ s.body }}
            </p>
          </div>
        </li>
      </ol>
    </section>

    <section
      class="flex flex-wrap items-center justify-between gap-4 border-t border-base-content/80 py-8"
    >
      <p class="max-w-md text-base-content/70">
        Le meilleur moyen d'apprendre, c'est de jouer&nbsp;: la table guide
        chaque étape.
      </p>
      <router-link to="/play/table" class="btn btn-neutral shrink-0">
        → Ouvrir la table
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { FIRST_STEPS } from "@/data/firstSteps";
const steps = FIRST_STEPS;
</script>
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Commit** — `feat(first-steps): page Premiers pas + lien tutoriel`

---

### Task 8: AboutView

**Files:**

- Create: `src/views/AboutView.vue`

Self-contained prose. Sections: intro hommage; "Dans la continuité de Safranil"; "Ce que cette app apporte" (5 feature cards); CTA Discord + compte. Use `DISCORD_INVITE_URL` / `WTCG_RETURN_URL`.

- [ ] **Step 1: Implement**

```vue
<template>
  <div class="mx-auto max-w-3xl space-y-14">
    <header class="animate-fadeIn">
      <p class="eyebrow text-primary">Le projet</p>
      <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
        Un hommage au Wakfu TCG
      </h1>
      <p class="mt-5 text-lg leading-relaxed text-base-content/75">
        Cette application est un projet de fan, indépendant et non-officiel, né
        d'une passion pour le jeu de cartes Wakfu créé par Ankama. Son but est
        simple&nbsp;: célébrer ce jeu, le garder vivant, et offrir à la
        communauté les outils qui lui manquaient.
      </p>
    </header>

    <div class="h-px w-full bg-base-content/80"></div>

    <section class="space-y-4">
      <h2 class="font-display text-2xl sm:text-3xl">
        Dans la continuité de Safranil
      </h2>
      <p class="leading-relaxed text-base-content/80">
        Le travail de préservation mené par <strong>Safranil</strong> sur son
        site
        <a
          :href="WTCG_RETURN_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary hover:underline"
          >Wakfu TCG Return</a
        >
        — le partage des illustrations des cartes et des listes de decks — est
        le socle de tout ce projet. Cette application ne cherche pas à le
        remplacer, mais à le compléter&nbsp;: prolonger cet effort avec des
        outils interactifs, sans jamais perdre de vue qu'il en est l'origine.
      </p>
    </section>

    <section class="space-y-6">
      <h2 class="font-display text-2xl sm:text-3xl">Ce que l'app apporte</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <article
          v-for="f in features"
          :key="f.title"
          class="border border-base-content/15 p-5"
        >
          <h3 class="font-display text-xl">{{ f.title }}</h3>
          <p class="mt-1 text-sm leading-relaxed text-base-content/70">
            {{ f.body }}
          </p>
        </article>
      </div>
    </section>

    <section
      class="flex flex-wrap items-center gap-3 border-t border-base-content/80 py-8"
    >
      <a
        :href="DISCORD_INVITE_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-primary gap-2"
      >
        Rejoindre le Discord <span aria-hidden="true">↗</span>
      </a>
      <router-link to="/credits" class="btn btn-ghost"
        >Voir les crédits</router-link
      >
    </section>
  </div>
</template>

<script setup lang="ts">
import { DISCORD_INVITE_URL, WTCG_RETURN_URL } from "@/config/links";

const features = [
  {
    title: "Les decks des Dofus Mag",
    body: "Répertorier et explorer les listes de decks publiées par Ankama dans les Dofus Mag, souvent introuvables ailleurs.",
  },
  {
    title: "Tout le contenu des cartes",
    body: "Un catalogue complet et consultable de toutes les cartes, illustrations et effets, extension par extension.",
  },
  {
    title: "Gestion de collection",
    body: "Suivez les cartes que vous possédez et construisez vos decks avec un atelier qui vérifie les règles en continu.",
  },
  {
    title: "Partage avec la communauté",
    body: "Partagez vos decks d'un simple lien avec les membres du Discord, pour échanger et s'inspirer.",
  },
  {
    title: "Un module de jeu",
    body: "Une table jouable (avec tutoriel) pour rejouer ses parties, tester ses decks et redécouvrir le jeu.",
  },
];
</script>
```

- [ ] **Step 2: Commit** — `feat(about): page À propos (mission & hommage)`

---

### Task 9: LegalNoticeView (Mentions légales)

**Files:**

- Create: `src/views/LegalNoticeView.vue`

Original French text with placeholders. Includes a visible "modèle à relire" notice. Hébergeur pre-filled with Vercel (with a note to verify).

- [ ] **Step 1: Implement**

```vue
<template>
  <div class="mx-auto max-w-3xl space-y-10">
    <header class="animate-fadeIn">
      <p class="eyebrow text-primary">Informations légales</p>
      <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
        Mentions légales
      </h1>
    </header>

    <div
      class="border-l-4 border-warning bg-warning/10 p-4 text-sm text-base-content/80"
      role="note"
    >
      <strong>Modèle à compléter.</strong> Remplacez les champs entre crochets
      par vos informations. Ce texte est un point de départ et ne constitue pas
      un conseil juridique&nbsp;; faites-le relire si nécessaire.
    </div>

    <section class="space-y-3">
      <h2 class="font-display text-2xl">Éditeur du site</h2>
      <p class="leading-relaxed text-base-content/80">
        Ce site est édité par <strong>[VOTRE NOM / PSEUDO]</strong>, à titre
        personnel et non commercial.<br />
        Contact&nbsp;: <strong>[EMAIL DE CONTACT]</strong>.<br />
        Directeur de la publication&nbsp;:
        <strong>[VOTRE NOM / PSEUDO]</strong>.
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="font-display text-2xl">Hébergement</h2>
      <p class="leading-relaxed text-base-content/80">
        Le site est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave
        #4133, Walnut, CA 91789, États-Unis — vercel.com.
        <em class="text-base-content/55"
          >(À adapter si vous changez d'hébergeur.)</em
        >
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="font-display text-2xl">Propriété intellectuelle</h2>
      <p class="leading-relaxed text-base-content/80">
        <strong>Wakfu</strong>, le <strong>Wakfu TCG</strong>, leurs cartes,
        illustrations, noms et univers sont la propriété
        d'<strong>Ankama</strong>. Ce site est un projet de fan indépendant,
        sans aucune affiliation, partenariat ni approbation d'Ankama. Les
        illustrations et données de cartes proviennent du travail communautaire
        partagé par Safranil (wtcg-return.fr). Toute demande de retrait peut
        être adressée à l'éditeur à l'adresse de contact ci-dessus.
      </p>
    </section>

    <section
      class="flex flex-wrap items-center justify-between gap-4 border-t border-base-content/80 py-8"
    >
      <p class="text-base-content/70">Voir aussi&nbsp;:</p>
      <router-link to="/cgu" class="btn btn-neutral shrink-0">
        → Conditions générales d'utilisation
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts"></script>
```

- [ ] **Step 2: Commit** — `feat(legal): mentions légales (modèle placeholders)`

---

### Task 10: TermsView (CGU)

**Files:**

- Create: `src/views/TermsView.vue`

Original French CGU with placeholders. Sections: objet, accès au service, comptes & données, contenu utilisateur, propriété intellectuelle, responsabilité, données personnelles, modification, contact.

- [ ] **Step 1: Implement**

```vue
<template>
  <div class="mx-auto max-w-3xl space-y-10">
    <header class="animate-fadeIn">
      <p class="eyebrow text-primary">Conditions</p>
      <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
        Conditions générales d'utilisation
      </h1>
      <p class="mt-4 text-base-content/70">
        Dernière mise à jour&nbsp;: [DATE].
      </p>
    </header>

    <div
      class="border-l-4 border-warning bg-warning/10 p-4 text-sm text-base-content/80"
      role="note"
    >
      <strong>Modèle à compléter.</strong> Adaptez les champs entre crochets. Ce
      texte ne constitue pas un conseil juridique.
    </div>

    <section v-for="(s, i) in sections" :key="s.title" class="space-y-3">
      <h2 class="font-display text-2xl">{{ i + 1 }}. {{ s.title }}</h2>
      <p class="whitespace-pre-line leading-relaxed text-base-content/80">
        {{ s.body }}
      </p>
    </section>

    <section
      class="flex flex-wrap items-center justify-between gap-4 border-t border-base-content/80 py-8"
    >
      <p class="text-base-content/70">Voir aussi&nbsp;:</p>
      <router-link to="/mentions-legales" class="btn btn-neutral shrink-0">
        → Mentions légales
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
const sections = [
  {
    title: "Objet",
    body: "Les présentes conditions régissent l'utilisation de cette application web, un projet de fan non-officiel dédié au Wakfu TCG. En utilisant le site, vous acceptez ces conditions.",
  },
  {
    title: "Accès au service",
    body: "Le service est fourni gratuitement et « en l'état », sans garantie de disponibilité, d'exactitude des données ou d'absence d'interruption. Certaines fonctionnalités (collection, decks) nécessitent la création d'un compte.",
  },
  {
    title: "Comptes et données",
    body: "L'authentification et le stockage des données (collection, decks) reposent sur Supabase. Vous êtes responsable de la confidentialité de vos identifiants. Vous pouvez demander la suppression de votre compte et des données associées à l'adresse de contact des mentions légales.",
  },
  {
    title: "Contenu utilisateur",
    body: "Les decks et collections que vous créez restent les vôtres. Vous vous engagez à ne pas utiliser le service à des fins illicites ou abusives.",
  },
  {
    title: "Propriété intellectuelle",
    body: "Wakfu, le Wakfu TCG, leurs cartes et illustrations appartiennent à Ankama. Ce site n'est ni affilié ni approuvé par Ankama. Les ressources de cartes proviennent du travail communautaire partagé par Safranil (wtcg-return.fr).",
  },
  {
    title: "Limitation de responsabilité",
    body: "L'éditeur ne saurait être tenu responsable des dommages directs ou indirects liés à l'utilisation du site, ni de l'indisponibilité ou de la perte de données.",
  },
  {
    title: "Données personnelles",
    body: "Les seules données collectées sont celles nécessaires au fonctionnement du compte (e-mail) et au stockage de votre collection et de vos decks. Elles ne sont ni vendues ni cédées à des tiers. Pour toute demande d'accès ou de suppression, contactez l'éditeur.",
  },
  {
    title: "Modification des conditions",
    body: "Ces conditions peuvent être mises à jour à tout moment. La version applicable est celle publiée sur cette page.",
  },
  {
    title: "Contact",
    body: "Pour toute question relative à ces conditions, écrivez à l'adresse indiquée dans les mentions légales.",
  },
];
</script>
```

- [ ] **Step 2: Commit** — `feat(legal): CGU (modèle placeholders)`

---

### Task 11: Register routes

**Files:**

- Modify: `src/router/index.ts`

- [ ] **Step 1:** Add these route objects inside `routes: [...]`, after the `/regles` route block (line ~71):

```ts
    {
      path: "/regles/apprendre",
      name: "firstSteps",
      component: () => import("@/views/FirstStepsView.vue"),
      meta: { guest: true },
    },
    {
      path: "/a-propos",
      name: "about",
      component: () => import("@/views/AboutView.vue"),
      meta: { guest: true },
    },
    {
      path: "/credits",
      name: "credits",
      component: () => import("@/views/CreditsView.vue"),
      meta: { guest: true },
    },
    {
      path: "/mentions-legales",
      name: "legalNotice",
      component: () => import("@/views/LegalNoticeView.vue"),
      meta: { guest: true },
    },
    {
      path: "/cgu",
      name: "terms",
      component: () => import("@/views/TermsView.vue"),
      meta: { guest: true },
    },
```

> Note: `/regles/apprendre` must be declared as its own top-level route (the existing `/regles` route is not nested), so order relative to `/regles` doesn't matter for matching.

- [ ] **Step 2:** Run `npm run type-check` — expect no errors.

- [ ] **Step 3: Commit** — `feat(router): routes à-propos/crédits/premiers-pas/légal`

---

### Task 12: Cross-link from RulesView + rules/glossary gap-check

**Files:**

- Modify: `src/views/RulesView.vue`
- Possibly modify: `src/data/glossary.ts`, `src/data/rules.ts`

- [ ] **Step 1:** In `RulesView.vue`, add a "Premiers pas" CTA in the header, right after the intro `<p>` (line ~12), before the divider:

```vue
<router-link to="/regles/apprendre" class="btn btn-primary btn-sm mt-5 gap-2">
        ▶ Nouveau&nbsp;? Commencer par « Premiers pas »
      </router-link>
```

- [ ] **Step 2 (gap-check, best-effort):** Fetch `https://www.wtcg-return.fr/regles/glossaire` and `https://www.wtcg-return.fr/regles/completes` (WebFetch). Compare term list against `GLOSSARY` in `src/data/glossary.ts`. For any clearly-missing glossary term, append a `{ term, definition }` entry following the existing French style. Do **not** rewrite existing entries. If fetch fails or no gaps exist, note it and skip — do not invent content.

- [ ] **Step 3:** Run `npx vitest run` — expect green.

- [ ] **Step 4: Commit** — `feat(rules): lien Premiers pas + complétion glossaire` (or `docs: gap-check glossaire — aucun écart` if nothing changed).

---

### Task 13: Full verification

- [ ] **Step 1:** `npm run type-check` — expect clean.
- [ ] **Step 2:** `npx vitest run` — expect all green (existing + new).
- [ ] **Step 3:** Preview verification — start dev server, visit `/a-propos`, `/credits`, `/regles/apprendre`, `/mentions-legales`, `/cgu`; confirm footer renders on all pages, Discord link opens, light/dark + responsive OK. Apply `frontend-design` polish if anything looks off.
- [ ] **Step 4: Commit** any polish — `style(footer): finition visuelle`.

---

## Self-review notes

- **Spec coverage:** footer (T2/T3), À propos (T8), Crédits (T4/T5), Premiers pas (T6/T7), mentions légales (T9), CGU (T10), Discord link (T1/T2/T8), rules gap-check + cross-link (T12), routes (T11). All spec sections mapped.
- **Type consistency:** `CreditEntry`, `FirstStep`, `FooterLink`/`FooterColumn` defined where used; `DISCORD_INVITE_URL`/`WTCG_RETURN_URL`/`ANKAMA_URL` defined in T1 and consumed consistently.
- **Placeholder note:** bracketed `[VOTRE NOM]` etc. in legal pages are **intentional user-facing placeholders**, not plan gaps.
