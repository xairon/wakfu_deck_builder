<template>
  <div ref="rootEl" class="landing">
    <!-- ============ HERO ============ -->
    <section
      id="top"
      class="hero-grid relative grid min-h-[calc(100svh-3.5rem)] items-center gap-6 overflow-clip px-[clamp(1.25rem,5vw,4.5rem)] pb-20 pt-16 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr]"
    >
      <!-- left copy -->
      <div class="relative z-[3] max-w-[600px]">
        <div data-reveal class="mb-7 flex items-center gap-3">
          <span class="h-px w-9 bg-ember"></span>
          <span class="font-mono text-xs uppercase tracking-[0.2em] text-ember"
            >Wakfu TCG — Constructeur de deck</span
          >
        </div>
        <h1
          data-reveal
          class="mb-7 font-display text-[clamp(40px,6vw,80px)] font-[560] leading-[0.98] tracking-[-0.025em]"
        >
          Composez le deck parfait,
          <span class="font-[500] italic text-ember">carte après carte.</span>
        </h1>
        <p
          data-reveal
          class="mb-9 max-w-[500px] text-[clamp(16px,1.5vw,20px)] leading-[1.55] text-ink-muted"
        >
          Cataloguez votre collection, montez des decks valides en un instant,
          et retrouvez-les sur tous vos appareils — synchronisés dans le cloud,
          jouables hors-ligne.
        </p>
        <div data-reveal class="mb-11 flex flex-wrap items-center gap-3.5">
          <router-link :to="primaryCta.to" class="cta-primary">
            {{ primaryCta.label }} →
          </router-link>
          <router-link :to="secondaryCta.to" class="cta-ghost">
            {{ secondaryCta.label }}
          </router-link>
        </div>
        <div data-reveal class="flex items-center gap-[clamp(18px,3vw,40px)]">
          <img
            v-for="el in elementIcons"
            :key="el.name"
            :src="el.src"
            alt=""
            aria-hidden="true"
            class="h-[30px] w-[30px]"
            data-depth="6"
            loading="lazy"
          />
          <span
            class="border-l border-paper-300 pl-[clamp(14px,2vw,28px)] font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint"
            >5 éléments · {{ extensionsLabel }} extensions</span
          >
        </div>
      </div>

      <!-- right visual: fanned floating cards -->
      <div
        ref="heroStage"
        class="relative z-[2] hidden h-[min(78vh,640px)] lg:block"
        aria-hidden="true"
      >
        <div
          v-for="c in heroFan"
          :key="c.slug"
          class="absolute"
          :style="{ left: c.left, top: c.top, height: c.height }"
          :data-depth="c.depth"
        >
          <img
            :src="cardImg(c.slug)"
            alt=""
            class="block h-full w-auto"
            :class="c.float"
            :style="{
              '--rot': c.rot,
              transform: `rotate(${c.rot})`,
              boxShadow: c.shadow,
              zIndex: c.z,
            }"
            @error="onImgError"
          />
        </div>

        <!-- seal stamp -->
        <div class="absolute bottom-[2%] left-[-2%] h-32 w-32" data-depth="10">
          <svg viewBox="0 0 120 120" class="seal-spin h-full w-full">
            <defs>
              <path
                id="wkb-seal"
                d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"
              ></path>
            </defs>
            <text
              class="fill-ink font-mono"
              style="font-size: 10.5px; letter-spacing: 0.34em"
            >
              <textPath href="#wkb-seal" startOffset="0">
                CONSTRUISEZ · SYNCHRONISEZ · JOUEZ ·
              </textPath>
            </text>
          </svg>
          <div class="absolute inset-0 grid place-items-center">
            <span
              class="font-display text-3xl font-black text-ember"
              style="transform: rotate(-6deg)"
              >W</span
            >
          </div>
        </div>
      </div>

      <!-- scroll hint -->
      <button
        type="button"
        class="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 lg:flex"
        aria-label="Défiler vers la suite"
        @click="scrollToId('collection')"
      >
        <span
          class="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint"
          >Défiler</span
        >
        <span
          class="h-[34px] w-px"
          style="background: linear-gradient(#a6a29a, transparent)"
        ></span>
      </button>
    </section>

    <!-- ============ STATS BAND ============ -->
    <section
      ref="statsEl"
      class="bg-ink px-[clamp(1.25rem,5vw,4.5rem)] py-[clamp(48px,7vw,84px)] text-paper"
    >
      <div
        class="mx-auto grid max-w-[1200px] grid-cols-2 gap-px border border-ink-faint/20 bg-ink-faint/20 sm:grid-cols-4"
      >
        <div
          v-for="(s, i) in stats"
          :key="s.label"
          data-reveal
          class="bg-ink px-6 py-[clamp(24px,3vw,40px)] text-center"
        >
          <div
            class="font-mono text-[clamp(34px,4.4vw,58px)] font-bold leading-none"
            :class="i === 0 ? 'text-ember' : 'text-paper'"
          >
            {{ s.display }}
          </div>
          <div
            class="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint"
          >
            {{ s.label }}
          </div>
        </div>
      </div>
    </section>

    <!-- ============ FEATURE 1 — COLLECTION ============ -->
    <section
      id="collection"
      class="scroll-mt-20 bg-paper px-[clamp(1.25rem,5vw,4.5rem)] py-[clamp(70px,10vw,130px)]"
    >
      <div
        class="mx-auto grid max-w-[1200px] items-center gap-[clamp(40px,6vw,90px)] lg:grid-cols-[0.92fr_1.08fr]"
      >
        <div data-reveal>
          <span class="num-eyebrow">01 — Collection</span>
          <h2 class="feature-h2">
            Toute votre collection, parfaitement rangée.
          </h2>
          <p class="feature-p">
            Parcourez {{ cartesLabel }} cartes en haute définition. Filtrez par
            élément, extension ou type, suivez vos quantités normale et foil, et
            regardez votre taux de complétion grimper.
          </p>
          <ul class="flex flex-col gap-3.5">
            <li v-for="point in collectionPoints" :key="point" class="feat-li">
              <span class="font-mono text-[13px] text-ember">→</span>
              {{ point }}
            </li>
          </ul>
        </div>
        <div data-reveal class="relative">
          <div class="grid grid-cols-3 gap-3.5">
            <img
              v-for="(c, i) in collectionGrid"
              :key="c.slug"
              data-tilt
              :src="cardImg(c.slug)"
              :alt="c.name"
              class="w-full shadow-[0_18px_40px_-18px_rgba(26,23,20,0.4)]"
              :class="{ 'mt-6': i === 1 || i === 4 }"
              loading="lazy"
              @error="onImgError"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ============ FEATURE 2 — DECK BUILDER ============ -->
    <section
      id="builder"
      class="scroll-mt-20 border-y border-paper-300 bg-paper-200 px-[clamp(1.25rem,5vw,4.5rem)] py-[clamp(70px,10vw,130px)]"
    >
      <div
        class="mx-auto grid max-w-[1200px] items-center gap-[clamp(40px,6vw,90px)] lg:grid-cols-[1.08fr_0.92fr]"
      >
        <!-- mock builder panel -->
        <div
          data-reveal
          class="border border-paper-300 bg-paper shadow-[0_30px_70px_-34px_rgba(26,23,20,0.4)]"
        >
          <div
            class="flex items-center justify-between border-b border-paper-300 px-[22px] py-[18px]"
          >
            <div>
              <div class="font-display text-[19px] font-bold">
                Iop du Feu — Agression
              </div>
              <div
                class="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint"
              >
                Brouillon · sauvegardé
              </div>
            </div>
            <div class="flex items-center gap-2 bg-ink px-3 py-2 text-paper">
              <span class="h-2 w-2 rounded-full bg-element-air"></span>
              <span class="font-mono text-xs font-bold">Deck valide</span>
            </div>
          </div>
          <!-- composition row -->
          <div class="grid grid-cols-3 border-b border-paper-300">
            <div class="border-r border-paper-300 p-4 text-center">
              <div class="font-mono text-2xl font-bold">1</div>
              <div class="comp-label">Héros</div>
            </div>
            <div class="border-r border-paper-300 p-4 text-center">
              <div class="font-mono text-2xl font-bold">1</div>
              <div class="comp-label">Havre-Sac</div>
            </div>
            <div class="p-4 text-center">
              <div class="font-mono text-2xl font-bold text-ember">
                48<span class="text-[15px] text-ink-faint">/48</span>
              </div>
              <div class="comp-label">Cartes</div>
            </div>
          </div>
          <!-- element distribution -->
          <div class="border-b border-paper-300 px-[22px] py-[18px]">
            <div
              class="mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
            >
              Répartition élémentaire
            </div>
            <div class="flex h-3 w-full overflow-hidden">
              <span class="bg-element-feu" style="width: 46%"></span>
              <span class="bg-element-terre" style="width: 24%"></span>
              <span class="bg-element-air" style="width: 16%"></span>
              <span class="bg-element-neutre" style="width: 14%"></span>
            </div>
            <div
              class="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-muted"
            >
              <span class="text-element-feu">● Feu 46%</span>
              <span class="text-element-terre">● Terre 24%</span>
              <span class="text-element-air">● Air 16%</span>
              <span class="text-element-neutre">● Neutre 14%</span>
            </div>
          </div>
          <!-- deck rows -->
          <div class="py-2">
            <div
              v-for="(row, i) in builderRows"
              :key="row.name"
              class="flex items-center gap-3.5 px-[22px] py-2.5"
              :class="{ 'bg-paper-200': i % 2 === 1 }"
            >
              <img
                :src="cardImg(row.slug)"
                alt=""
                class="h-12 w-[34px] border border-paper-300 object-cover object-top"
                loading="lazy"
                @error="onImgError"
              />
              <div class="flex-1">
                <div class="text-sm font-semibold">{{ row.name }}</div>
                <div class="font-mono text-[11px] text-ink-faint">
                  {{ row.meta }}
                </div>
              </div>
              <span
                class="font-mono text-[13px] font-bold"
                :class="row.qty === 3 ? 'text-ember' : 'text-ink-faint'"
                >×{{ row.qty }}</span
              >
            </div>
          </div>
        </div>

        <div data-reveal>
          <span class="num-eyebrow">02 — Deck Builder</span>
          <h2 class="feature-h2">Le constructeur qui connaît les règles.</h2>
          <p class="feature-p">
            Validation en direct à chaque carte ajoutée. Le builder veille à la
            légalité de votre deck pendant que vous vous concentrez sur la
            stratégie.
          </p>
          <ul class="flex flex-col border-t border-paper-300">
            <li v-for="rule in builderRules" :key="rule.label" class="rule-li">
              <span class="text-[15px]">{{ rule.label }}</span>
              <span
                class="font-mono text-xs"
                :class="rule.ok ? 'text-element-air' : 'text-ink-muted'"
                >{{ rule.tag }}</span
              >
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ============ FEATURE 3 — CLOUD ============ -->
    <section
      id="cloud"
      class="relative scroll-mt-20 overflow-hidden bg-ink px-[clamp(1.25rem,5vw,4.5rem)] py-[clamp(70px,10vw,130px)] text-paper"
    >
      <div
        class="pointer-events-none absolute inset-0"
        style="
          background: radial-gradient(
            80% 120% at 80% 0%,
            rgba(240, 78, 34, 0.14),
            transparent 55%
          );
        "
      ></div>
      <div class="relative mx-auto max-w-[1100px] text-center">
        <div data-reveal>
          <span class="num-eyebrow">03 — Cloud &amp; multi-appareils</span>
          <h2
            class="mx-auto mb-5 mt-4 max-w-[760px] font-display text-[clamp(32px,4.4vw,60px)] font-[560] leading-[1.02] tracking-[-0.02em]"
          >
            Vos decks vous suivent.
            <span class="font-[500] italic text-ember">Partout.</span>
          </h2>
          <p
            class="mx-auto mb-14 max-w-[580px] text-[18px] leading-[1.6] text-ink-faint"
          >
            Compte cloud, synchronisation instantanée et lecture hors-ligne.
            Ouvrez votre collection sur le bureau, continuez sur mobile — sans
            rien perdre.
          </p>
        </div>
        <div
          data-reveal
          class="grid gap-px border border-ink-faint/20 bg-ink-faint/20 text-left sm:grid-cols-3"
        >
          <div
            v-for="card in cloudCards"
            :key="card.title"
            class="bg-ink px-7 py-[34px]"
          >
            <div class="mb-4 font-mono text-[13px] text-ember">
              {{ card.icon }}
            </div>
            <h3 class="mb-2.5 font-display text-[21px] font-[560]">
              {{ card.title }}
            </h3>
            <p class="text-[14.5px] leading-[1.55] text-ink-faint">
              {{ card.desc }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ GALLERY MARQUEE ============ -->
    <section
      class="overflow-hidden bg-paper py-[clamp(60px,8vw,100px)]"
      aria-label="Aperçu de la base de cartes"
    >
      <div
        class="mb-[clamp(40px,5vw,64px)] px-[clamp(1.25rem,5vw,4.5rem)] text-center"
      >
        <div data-reveal>
          <span class="num-eyebrow">La base complète</span>
          <h2
            class="mt-4 font-display text-[clamp(30px,4vw,54px)] font-[560] leading-[1.04] tracking-[-0.02em]"
          >
            {{ cartesLabel }} cartes, en haute définition.
          </h2>
        </div>
      </div>
      <div class="marquee-track flex w-max gap-[18px]" aria-hidden="true">
        <img
          v-for="(slug, i) in marqueeCards"
          :key="i"
          :src="cardImg(slug)"
          alt=""
          class="h-[clamp(180px,40vw,300px)] shadow-[0_18px_40px_-22px_rgba(26,23,20,0.5)]"
          loading="lazy"
          @error="onImgError"
        />
      </div>
    </section>

    <!-- ============ CTA ============ -->
    <section
      id="start"
      class="relative scroll-mt-20 overflow-hidden border-t border-paper-300 bg-paper-200 px-[clamp(1.25rem,5vw,4.5rem)] py-[clamp(80px,11vw,150px)] text-center"
    >
      <img
        src="/images/card-back.webp"
        alt=""
        aria-hidden="true"
        class="absolute left-[4%] top-[14%] hidden w-[150px] rotate-[-12deg] opacity-50 shadow-[0_30px_60px_-28px_rgba(26,23,20,0.4)] sm:block"
        data-depth="18"
      />
      <img
        src="/images/card-back.webp"
        alt=""
        aria-hidden="true"
        class="absolute bottom-[12%] right-[4%] hidden w-[150px] rotate-[10deg] opacity-50 shadow-[0_30px_60px_-28px_rgba(26,23,20,0.4)] sm:block"
        data-depth="24"
      />
      <div data-reveal class="relative mx-auto max-w-[760px]">
        <span class="num-eyebrow">Gratuit · Open-source</span>
        <h2
          class="mb-7 mt-5 font-display text-[clamp(38px,6vw,76px)] font-[560] leading-none tracking-[-0.025em]"
        >
          Prêt à bâtir votre prochain deck&nbsp;?
        </h2>
        <p
          class="mx-auto mb-10 max-w-[520px] text-[18px] leading-[1.55] text-ink-muted"
        >
          Créez votre compte, importez votre collection et composez votre
          premier deck en quelques minutes.
        </p>
        <div class="flex flex-wrap justify-center gap-3.5">
          <router-link :to="primaryCta.to" class="cta-primary">
            {{ primaryCta.label }} →
          </router-link>
          <a
            href="https://github.com/xairon/wakfu_deck_builder"
            target="_blank"
            rel="noopener noreferrer"
            class="cta-ghost"
          >
            Voir sur GitHub ↗
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useAuthStore } from "@/stores/authStore";
import { useCardStore } from "@/stores/cardStore";
import { ALL_OFFICIAL_DECKS } from "@/data/allOfficialDecks";
import { distinctExtensionCount } from "@/utils/homeStats";

const authStore = useAuthStore();
const cardStore = useCardStore();

const rootEl = ref<HTMLElement | null>(null);
const heroStage = ref<HTMLElement | null>(null);
const statsEl = ref<HTMLElement | null>(null);
const ready = ref(false);

// ── CTA (selon l'état d'authentification) ──────────────────────────────────
const primaryCta = computed(() =>
  authStore.isAuthenticated
    ? { to: "/collection", label: "Ma collection" }
    : { to: "/auth", label: "Créer un compte" },
);
const secondaryCta = computed(() =>
  authStore.isAuthenticated
    ? { to: "/decks", label: "Mes decks" }
    : { to: "/play/table?tutorial=1", label: "Essayer la table" },
);

// ── Données chiffrées (réelles, animées en compteur) ───────────────────────
const cartesTarget = computed(() => (ready.value ? cardStore.totalCards : 0));
const extensionsTarget = computed(() =>
  ready.value ? distinctExtensionCount(cardStore.cards) : 0,
);
const officielsTarget = ALL_OFFICIAL_DECKS.length;

const display = reactive({ cartes: 0, extensions: 0, deck: 0, officiels: 0 });
const fmt = (n: number) => n.toLocaleString("fr-FR");
const cartesLabel = computed(() =>
  ready.value ? fmt(cardStore.totalCards) : "1 585",
);
const extensionsLabel = computed(() =>
  ready.value ? distinctExtensionCount(cardStore.cards) : 11,
);

const stats = computed(() => [
  { label: "Cartes uniques", display: fmt(display.cartes) },
  { label: "Extensions", display: fmt(display.extensions) },
  { label: "Cartes par deck", display: fmt(display.deck) },
  { label: "Decks officiels", display: fmt(display.officiels) },
]);

// ── Contenu statique des sections ──────────────────────────────────────────
const elementIcons = [
  { name: "Feu", src: "/images/elements/ressource-feu.png" },
  { name: "Eau", src: "/images/elements/ressource-eau.png" },
  { name: "Air", src: "/images/elements/ressource-air.png" },
  { name: "Terre", src: "/images/elements/ressource-terre.png" },
  { name: "Neutre", src: "/images/elements/ressource-neutre.png" },
];

// Cartes dimensionnées par la HAUTEUR du plateau (% de #heroStage, hauteur
// définie) et non par la largeur de colonne : l'éventail reste ainsi borné
// verticalement et ne peut plus déborder sur la bande de stats, quelle que
// soit la largeur d'écran (filet de sécurité supplémentaire : overflow-clip
// sur la section hero). top% + height% + amplitude du flottement ≤ ~92%.
const heroFan = [
  {
    slug: "aermyne-scalptaras-chaos-dogrest",
    left: "0%",
    top: "24%",
    height: "56%",
    rot: "-13deg",
    depth: 22,
    z: 1,
    float: "float-b",
    shadow: "0 30px 60px -20px rgba(26,23,20,0.45)",
  },
  {
    slug: "alibert-amakna",
    left: "16%",
    top: "6%",
    height: "62%",
    rot: "-4deg",
    depth: 40,
    z: 1,
    float: "float-a",
    shadow: "0 40px 80px -24px rgba(26,23,20,0.5)",
  },
  {
    slug: "allister-roi-d-amakna-amakna",
    left: "34%",
    top: "16%",
    height: "70%",
    rot: "6deg",
    depth: 60,
    z: 2,
    float: "float-a-delayed",
    shadow: "0 50px 90px -26px rgba(26,23,20,0.55)",
  },
  {
    slug: "abraknyde-incarnam",
    left: "54%",
    top: "30%",
    height: "56%",
    rot: "12deg",
    depth: 30,
    z: 1,
    float: "float-b-delayed",
    shadow: "0 34px 70px -22px rgba(26,23,20,0.45)",
  },
];

const collectionPoints = [
  "Recherche instantanée par nom, type ou extension",
  "Filtres par les 5 éléments : Feu, Eau, Air, Terre, Neutre",
  "Quantités normale & foil, complétion par extension",
];
const collectionGrid = [
  { slug: "alysse-bonta-brakmar", name: "Alysse" },
  { slug: "abraknyde-ancestral-chaos-dogrest", name: "Abraknyde Ancestral" },
  { slug: "aerofiole-otomai", name: "Aérofiole" },
  { slug: "a-la-foire-du-trooll-bonta-brakmar", name: "À la Foire du Trooll" },
  { slug: "abrakaska-ancestral-pandala", name: "Abrakaska Ancestral" },
  { slug: "abrakleur-clair-otomai", name: "Abrakleur Clair" },
];

const builderRows = [
  {
    slug: "aermyne-scalptaras-chaos-dogrest",
    name: "Aermyne Scalptaras",
    meta: "Allié — Bandit · Air",
    qty: 3,
  },
  {
    slug: "agression-dofus-collection",
    name: "Agression",
    meta: "Action · Neutre",
    qty: 3,
  },
  {
    slug: "alibert-amakna",
    name: "Alibert",
    meta: "Allié — Enutrof · Eau",
    qty: 2,
  },
];
const builderRules = [
  { label: "1 Héros + 1 Havre-Sac + 48 cartes", tag: "requis", ok: true },
  { label: "Maximum 3 exemplaires par carte", tag: "1 si Unique", ok: false },
  { label: "Réserve de 0 ou 12 cartes", tag: "règle 101.4", ok: false },
  { label: "Réimpressions interopérables", tag: "par nom", ok: false },
];

const cloudCards = [
  {
    icon: "☁",
    title: "Synchronisation cloud",
    desc: "Collection et decks stockés dans le cloud, sécurisés par compte. Source de vérité unique, accessible partout.",
  },
  {
    icon: "⤓",
    title: "PWA hors-ligne",
    desc: "Installez l'application comme une appli native. Consultez vos cartes même sans connexion.",
  },
  {
    icon: "↗",
    title: "Partage par lien",
    desc: "Exportez n'importe quel deck dans une URL. Un lien, et votre adversaire voit la liste complète.",
  },
];

const marqueeBase = [
  "allister-roi-d-amakna-amakna",
  "alysse-bonta-brakmar",
  "abraknyde-ancestral-chaos-dogrest",
  "a-la-foire-du-trooll-bonta-brakmar",
  "abrakaska-ancestral-pandala",
  "aermyne-scalptaras-chaos-dogrest",
  "abraknyde-incarnam",
  "amakna-le-village-amakna",
  "alibert-amakna",
  "aerofiole-otomai",
  "abrakleur-clair-otomai",
  "agression-dofus-collection",
];
// Doublé pour une boucle sans couture (translateX -50%).
const marqueeCards = [...marqueeBase, ...marqueeBase];

function cardImg(slug: string): string {
  return `/images/cards/${slug}.webp`;
}
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}
function scrollToId(id: string) {
  rootEl.value
    ?.querySelector(`#${id}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Compteur animé ─────────────────────────────────────────────────────────
const reduceMotion =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;
let countDone = false;
const rafs: number[] = [];

function runCount(key: keyof typeof display, target: number, dur = 1400) {
  if (reduceMotion) {
    display[key] = target;
    return;
  }
  const start = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    display[key] = Math.round(target * eased);
    if (p < 1) rafs.push(requestAnimationFrame(step));
  };
  rafs.push(requestAnimationFrame(step));
}
function startCounts() {
  if (countDone || !ready.value) return;
  countDone = true;
  runCount("cartes", cartesTarget.value);
  runCount("extensions", extensionsTarget.value);
  runCount("deck", 48);
  runCount("officiels", officielsTarget);
}

// ── Reveal au scroll · parallaxe · tilt ────────────────────────────────────
const observers: IntersectionObserver[] = [];
let onMove: ((e: MouseEvent) => void) | null = null;
const tiltCleanups: Array<() => void> = [];
let statsVisible = false;

function setupReveal(root: HTMLElement) {
  const reveals = Array.from(
    root.querySelectorAll<HTMLElement>("[data-reveal]"),
  );
  reveals.forEach((el) => el.classList.add("reveal"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        const sibs = Array.from(el.parentElement?.children ?? []).filter(
          (c) => (c as HTMLElement).dataset.reveal !== undefined,
        );
        const idx = Math.max(0, sibs.indexOf(el));
        el.style.transitionDelay = `${idx * 90}ms`;
        el.classList.add("is-in");
        io.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );
  reveals.forEach((el) => io.observe(el));
  observers.push(io);
  // Filet de sécurité : ne jamais laisser un contenu masqué.
  window.setTimeout(
    () => reveals.forEach((el) => el.classList.add("is-in")),
    4500,
  );
}

function setupStatsCount(root: HTMLElement) {
  const target = statsEl.value;
  if (!target) return;
  if (reduceMotion || !("IntersectionObserver" in window)) {
    statsVisible = true;
    startCounts();
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          statsVisible = true;
          startCounts();
          io.disconnect();
        }
      });
    },
    { threshold: 0.3 },
  );
  io.observe(target);
  observers.push(io);
}

function setupParallax(root: HTMLElement) {
  if (reduceMotion || !matchMedia("(pointer:fine)").matches) return;
  const depthEls = Array.from(
    root.querySelectorAll<HTMLElement>("[data-depth]"),
  );
  depthEls.forEach((el) => {
    if (!el.classList.contains("float-a") && !el.classList.contains("float-b"))
      el.dataset.basetf = el.style.transform || "";
  });
  onMove = (ev: MouseEvent) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (ev.clientX - cx) / cx;
    const dy = (ev.clientY - cy) / cy;
    depthEls.forEach((el) => {
      const d = parseFloat(el.dataset.depth || "0") || 0;
      const base = el.dataset.basetf || "";
      el.style.transform = `${base} translate(${-dx * d}px, ${-dy * d}px)`;
    });
  };
  window.addEventListener("mousemove", onMove, { passive: true });
}

function setupTilt(root: HTMLElement) {
  if (reduceMotion || !matchMedia("(pointer:fine)").matches) return;
  const els = Array.from(root.querySelectorAll<HTMLElement>("[data-tilt]"));
  els.forEach((el) => {
    el.style.transition = "transform .18s ease";
    const move = (ev: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const rx = ((ev.clientY - r.top) / r.height - 0.5) * -10;
      const ry = ((ev.clientX - r.left) / r.width - 0.5) * 12;
      el.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.05)`;
      el.style.zIndex = "5";
    };
    const leave = () => {
      el.style.transform = "";
      el.style.zIndex = "";
    };
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", leave);
    tiltCleanups.push(() => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", leave);
    });
  });
}

watch([ready, () => statsVisible], () => {
  if (statsVisible) startCounts();
});

onMounted(async () => {
  if (!cardStore.isInitialized) {
    try {
      await cardStore.initialize();
    } catch {
      /* l'app gère l'erreur globalement ; on garde les libellés de repli */
    }
  }
  ready.value = true;

  const root = rootEl.value;
  if (!root) return;
  setupReveal(root);
  setupStatsCount(root);
  setupParallax(root);
  setupTilt(root);
});

onUnmounted(() => {
  observers.forEach((io) => io.disconnect());
  if (onMove) window.removeEventListener("mousemove", onMove);
  tiltCleanups.forEach((fn) => fn());
  rafs.forEach((id) => cancelAnimationFrame(id));
});
</script>

<style scoped>
/* Landing éditoriale : palette « parchemin » fixe, indépendante du thème de
   l'app (pièce marketing volontairement claire ; les bandes sombres font
   partie du rythme du design). Les sections claires héritent de l'encre, les
   bandes sombres posent leur propre `text-paper`. */
.landing {
  background: #f6f5f1;
  color: #1b1a17;
}
.hero-grid {
  background:
    radial-gradient(
      120% 90% at 88% 10%,
      rgba(240, 78, 34, 0.07),
      transparent 55%
    ),
    radial-gradient(
      90% 80% at 0% 100%,
      rgba(31, 156, 236, 0.05),
      transparent 60%
    ),
    #f6f5f1;
}

/* Reveal au scroll (désactivé en prefers-reduced-motion) */
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition:
    opacity 0.9s cubic-bezier(0.2, 0.7, 0.2, 1),
    transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.reveal.is-in {
  opacity: 1;
  transform: none;
}

/* Éléments répétés (eyebrow numérotée, titres & paragraphes de section) */
.num-eyebrow {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  /* Ember assombri (#C8401B, = --el-feu clair du projet) : le #F04E22 sur
     parchemin échoue le contraste AA en petit texte (~3,4:1) ; celui-ci passe
     (~4,8:1). L'ember vif reste pour les gros titres/chiffres (texte large). */
  color: #c8401b;
}
.feature-h2 {
  font-family: Fraunces, Georgia, serif;
  font-weight: 560;
  font-size: clamp(30px, 3.6vw, 50px);
  line-height: 1.04;
  letter-spacing: -0.02em;
  margin: 18px 0 22px;
}
.feature-p {
  font-size: 17px;
  line-height: 1.6;
  color: #6b6862;
  margin-bottom: 30px;
  max-width: 480px;
}
.feat-li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  font-size: 15px;
  color: #1b1a17;
}
.comp-label {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #a6a29a;
  margin-top: 4px;
}
.rule-li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #dfdcd2;
}

/* Boutons d'appel à l'action */
.cta-primary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #fff;
  /* #C8401B (et non #F04E22) : blanc sur ce fond = ~5:1 (AA OK) ; blanc sur
     #F04E22 échoue (~3,6:1) pour ce libellé de 13px. */
  background: #c8401b;
  padding: 16px 28px;
  box-shadow: 0 1px 0 rgba(26, 23, 20, 0.25);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}
.cta-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 0 rgba(26, 23, 20, 0.18);
}
.cta-ghost {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #1b1a17;
  padding: 16px 24px;
  border: 1px solid #1b1a17;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}
.cta-ghost:hover {
  background: #1b1a17;
  color: #f6f5f1;
}

/* Mouvements ambiants */
@keyframes wkb-floatA {
  0%,
  100% {
    transform: translateY(0) rotate(var(--rot, 0deg));
  }
  50% {
    transform: translateY(-22px) rotate(var(--rot, 0deg));
  }
}
@keyframes wkb-floatB {
  0%,
  100% {
    transform: translateY(0) rotate(var(--rot, 0deg));
  }
  50% {
    transform: translateY(16px) rotate(var(--rot, 0deg));
  }
}
@keyframes wkb-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes wkb-marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
.float-a {
  animation: wkb-floatA 8s ease-in-out infinite;
}
.float-a-delayed {
  animation: wkb-floatA 9s ease-in-out infinite 0.6s;
}
.float-b {
  animation: wkb-floatB 7s ease-in-out infinite;
}
.float-b-delayed {
  animation: wkb-floatB 7.5s ease-in-out infinite 0.3s;
}
.seal-spin {
  animation: wkb-spin 26s linear infinite;
}
.marquee-track {
  animation: wkb-marquee 42s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .float-a,
  .float-a-delayed,
  .float-b,
  .float-b-delayed,
  .seal-spin,
  .marquee-track {
    animation: none;
  }
  .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
