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
import type { HeroCard } from "@/types/cards";
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

// Résout l'art (id image) + la couleur élémentaire du héros d'un deck. Pour les
// cartes Héros, les stats sont sous `recto` (cf. OfficialDecksView.getHeroColor).
function heroArt(
  name: string,
  ext?: string,
): { id: string; color: string } | null {
  const c = deckStore.findCardByName(name, undefined, ext);
  if (!c) return null;
  const stats = c.mainType === "Héros" ? (c as HeroCard).recto?.stats : c.stats;
  const el = (stats?.niveau?.element || stats?.force?.element || "neutre")
    .toString()
    .toLowerCase();
  return { id: c.id, color: ELEMENT_COLORS[el] || ELEMENT_COLORS.neutre };
}

// Planches héros du hero (decks reconnaissables, résolues live).
const heroPlates = computed(() => {
  return ALL_OFFICIAL_DECKS.slice(0, 3).map((d) => {
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
    {
      label: "Héros",
      value: ready.value
        ? cardStore.cards.filter((c) => c.mainType === "Héros").length
        : "…",
    },
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
