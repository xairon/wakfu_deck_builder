<template>
  <div class="space-y-12 sm:space-y-16">
    <!-- ── PREMIERS PAS (première visite, masquable) ── -->
    <section
      v-if="showWelcome"
      class="animate-fadeIn relative border border-primary/40 bg-primary/[0.06] p-6 sm:p-8"
    >
      <button
        class="btn btn-ghost btn-sm absolute right-2 top-2"
        @click="dismissWelcome"
        aria-label="Masquer les premiers pas"
      >
        ✕
      </button>
      <p class="eyebrow text-primary">Premiers pas</p>
      <h2 class="mt-2 font-display text-3xl">Nouveau au Wakfu TCG ?</h2>
      <p class="mt-2 max-w-xl text-base-content/70">
        Pas besoin de connaître les règles par cœur : la table t'accompagne.
        Trois façons de commencer.
      </p>
      <div class="mt-6 grid gap-3 sm:grid-cols-3">
        <router-link
          to="/play/table?tutorial=1"
          class="group block border border-base-content/15 p-4 transition hover:border-primary hover:bg-base-100"
        >
          <p
            class="font-mono text-[11px] uppercase tracking-wider text-primary"
          >
            ① Apprendre
          </p>
          <h3 class="mt-1 font-display text-lg">Tutoriel interactif</h3>
          <p class="mt-1 text-sm text-base-content/65">
            Une vraie partie guidée, pas à pas (~5 min).
          </p>
        </router-link>
        <router-link
          to="/decks/official"
          class="group block border border-base-content/15 p-4 transition hover:border-primary hover:bg-base-100"
        >
          <p
            class="font-mono text-[11px] uppercase tracking-wider text-primary"
          >
            ② S'équiper
          </p>
          <h3 class="mt-1 font-display text-lg">Prendre un deck starter</h3>
          <p class="mt-1 text-sm text-base-content/65">
            Un deck prêt à jouer, importé en un clic.
          </p>
        </router-link>
        <router-link
          to="/play/table"
          class="group block border border-base-content/15 p-4 transition hover:border-primary hover:bg-base-100"
        >
          <p
            class="font-mono text-[11px] uppercase tracking-wider text-primary"
          >
            ③ Jouer
          </p>
          <h3 class="mt-1 font-display text-lg">Ouvrir la table</h3>
          <p class="mt-1 text-sm text-base-content/65">
            Règles gérées, effets résolus à la main.
          </p>
        </router-link>
      </div>
    </section>

    <!-- ── FRONTISPICE ── -->
    <section class="grid items-start gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
      <div class="animate-fadeIn">
        <p class="eyebrow text-primary">Compagnon du TCG Wakfu</p>
        <h1 class="mt-4 font-display text-5xl leading-[1.04] sm:text-6xl">
          L'Almanach<br />des Douze
        </h1>
        <p class="mt-6 max-w-md text-lg leading-relaxed text-base-content/75">
          <template v-if="authStore.isAuthenticated">
            Content de vous revoir. Votre collection et vos decks vous
            attendent, consignés et synchronisés.
          </template>
          <template v-else>
            Tenez le registre de votre collection, composez des decks valides au
            millimètre, et conservez-les dans le cloud. Un grimoire pour toutes
            vos cartes.
          </template>
        </p>

        <div class="mt-8 flex flex-wrap gap-3">
          <template v-if="authStore.isAuthenticated">
            <router-link to="/collection" class="btn btn-neutral"
              >→ Ma collection</router-link
            >
            <router-link to="/decks" class="btn btn-outline"
              >Mes decks</router-link
            >
          </template>
          <template v-else>
            <router-link to="/auth" class="btn btn-primary"
              >→ Créer un compte</router-link
            >
            <router-link to="/collection" class="btn btn-outline"
              >Parcourir les cartes</router-link
            >
          </template>
        </div>

        <!-- Légende des encres élémentaires -->
        <div class="mt-10 flex flex-wrap gap-x-5 gap-y-2">
          <span
            v-for="el in elements"
            :key="el.name"
            class="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-base-content/60"
          >
            <span
              class="h-2.5 w-2.5"
              :style="{ backgroundColor: el.color }"
            ></span>
            {{ el.name }}
          </span>
        </div>
      </div>

      <!-- Mur de planches -->
      <div class="grid grid-cols-3 gap-3 sm:gap-4">
        <figure v-for="(p, i) in plates" :key="p.id" class="group">
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
          <figcaption class="plate-caption">
            {{ p.name }} · {{ p.elem }}
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- ── REGISTRE (tableau de bord) ── -->
    <section class="border-y border-base-content/80 py-5">
      <div class="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <p class="eyebrow">Au catalogue</p>
          <p class="mt-1 font-mono text-3xl tabular">{{ totalCards }}</p>
        </div>
        <div>
          <p class="eyebrow">Possédées</p>
          <p class="mt-1 font-mono text-3xl tabular">
            {{ authStore.isAuthenticated ? collectionCount : "—" }}
          </p>
        </div>
        <div>
          <p class="eyebrow">Decks</p>
          <p class="mt-1 font-mono text-3xl tabular">
            {{ authStore.isAuthenticated ? decksCount : "—" }}
          </p>
        </div>
        <div>
          <p class="eyebrow">Prêts à jouer</p>
          <p class="mt-1 font-mono text-3xl tabular">
            {{ authStore.isAuthenticated ? validDecks : "—" }}
          </p>
        </div>
      </div>
    </section>

    <!-- ── LISTE ÉDITORIALE ── -->
    <section>
      <p class="section-rule eyebrow">Le grimoire</p>
      <div class="mt-2 border-t border-base-content/15">
        <article
          v-for="(f, i) in features"
          :key="f.title"
          class="grid grid-cols-[auto_1fr] items-baseline gap-5 border-b border-base-content/15 py-6 sm:gap-8"
        >
          <span class="font-mono text-2xl tabular text-base-content/35"
            >0{{ i + 1 }}</span
          >
          <div>
            <h3 class="font-display text-2xl">{{ f.title }}</h3>
            <p class="mt-1.5 max-w-2xl text-base-content/70">
              {{ f.desc }}
            </p>
          </div>
        </article>
      </div>
    </section>

    <!-- ── DECKS OFFICIELS ── -->
    <section
      class="flex flex-wrap items-center justify-between gap-4 border-y border-base-content/80 py-8"
    >
      <div>
        <p class="eyebrow text-primary">Decks officiels</p>
        <h2 class="mt-1 font-display text-2xl sm:text-3xl">
          Pas d'idée ? Partez d'un deck starter.
        </h2>
      </div>
      <router-link to="/decks/official" class="btn btn-neutral shrink-0">
        → Parcourir les decks officiels
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useAuthStore } from "@/stores/authStore";
import { useCardStore } from "@/stores/cardStore";
import { useDeckStore } from "@/stores/deckStore";

const authStore = useAuthStore();
const cardStore = useCardStore();
const deckStore = useDeckStore();

// ── Premiers pas (onboarding première visite) ──
const WELCOME_KEY = "wakfu-welcome-seen";
const welcomeSeen = ref(true); // supposé vu jusqu'à vérification (évite le flash)
onMounted(() => {
  try {
    welcomeSeen.value = localStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    welcomeSeen.value = false;
  }
});
const showWelcome = computed(() => !welcomeSeen.value);
function dismissWelcome(): void {
  welcomeSeen.value = true;
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    /* stockage indisponible */
  }
}

const totalCards = computed(() =>
  cardStore.totalCards ? cardStore.totalCards.toLocaleString("fr-FR") : "—",
);
const collectionCount = computed(() =>
  Object.keys(cardStore.collection || {}).length.toString(),
);
const decksCount = computed(() => deckStore.decks.length.toString());
const validDecks = computed(() =>
  deckStore.decks
    .filter(
      (d) =>
        d.hero &&
        d.havreSac &&
        d.cards
          .filter((c) => !c.isReserve)
          .reduce((a, c) => a + c.quantity, 0) === 48,
    )
    .length.toString(),
);

const elements = [
  { name: "Air", color: "#5FB22A" },
  { name: "Eau", color: "#1F9CEC" },
  { name: "Feu", color: "#F04E22" },
  { name: "Terre", color: "#F0A62B" },
  { name: "Neutre", color: "#98A1AF" },
];

// Couleurs d'encre par élément (vif, identité du jeu).
const elementColors: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};
const plateIds = [
  "poum-ondacie-incarnam",
  "trantmy-londami-incarnam",
  "karey-dass-incarnam",
];
// L'élément et le nom sont résolus depuis les vraies données (plus de devinette).
const plates = computed(() =>
  plateIds.map((id) => {
    const card = cardStore.cards.find((c) => c.id === id);
    const elKey = (
      card?.stats?.niveau?.element ||
      card?.stats?.force?.element ||
      "neutre"
    )
      .toString()
      .toLowerCase();
    return {
      id,
      name: card?.name || "",
      elem: elKey.charAt(0).toUpperCase() + elKey.slice(1),
      color: elementColors[elKey] || elementColors.neutre,
      img: `/images/cards/${id}_recto.webp`,
    };
  }),
);

const features = [
  {
    title: "Le registre des cartes",
    desc: "Consignez chaque carte possédée, normale ou brillante. Le catalogue se lit comme un almanach ; votre progression, comme un grand-livre.",
  },
  {
    title: "L'atelier de deck",
    desc: "48 cartes, héros, havre-sac, limites de copies, cartes uniques : les règles sont vérifiées en continu, et le sceau tombe quand le deck est prêt.",
  },
  {
    title: "La synchronisation",
    desc: "Vos données sont conservées dans le cloud et vous suivent d'un appareil à l'autre, prêtes pour la prochaine partie.",
  },
];

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}
</script>
