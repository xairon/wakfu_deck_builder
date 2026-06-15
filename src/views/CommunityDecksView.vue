<template>
  <div class="space-y-12 sm:space-y-16">
    <!-- En-tête -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow text-primary">Bibliothèque</p>
        <h1 class="mt-3 font-display text-4xl sm:text-5xl">
          Decks de la communauté
        </h1>
        <p class="mt-3 max-w-md text-base-content/70">
          Listes de tournoi, guides Dofus Mag et créations partagées —
          importables en un clic dans vos decks.
        </p>
      </div>
      <div class="flex shrink-0 gap-2">
        <router-link to="/decks/official" class="btn btn-ghost gap-2">
          Officiels
        </router-link>
        <router-link to="/decks" class="btn btn-ghost gap-2">
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 18l-6-6 6-6"
            />
          </svg>
          Mes decks
        </router-link>
      </div>
    </div>

    <div v-if="loading" class="border-y border-base-content/15 py-16">
      <p class="eyebrow text-center">Chargement…</p>
    </div>

    <div
      v-else-if="!groups.length"
      class="border border-base-content/15 p-10 text-center"
    >
      <p class="text-base-content/60">
        Aucun deck communautaire pour l'instant.
      </p>
    </div>

    <!-- Groupes par source -->
    <section v-for="group in groups" :key="group.source" class="space-y-5">
      <p class="section-rule eyebrow">
        {{ group.source }} · {{ group.decks.length }} deck{{
          group.decks.length > 1 ? "s" : ""
        }}
      </p>

      <div class="grid grid-cols-1 gap-px bg-base-content/15 lg:grid-cols-2">
        <article
          v-for="deck in group.decks"
          :key="deck.id"
          class="bg-base-100 p-5"
        >
          <div class="flex gap-4">
            <!-- Illustration du héros -->
            <div class="w-24 shrink-0 sm:w-28">
              <div class="plate-frame" :style="{ '--spine': heroColor(deck) }">
                <img
                  :src="heroImage(deck)"
                  :alt="deck.hero || deck.name"
                  class="aspect-[7/10] object-cover object-[50%_30%]"
                  loading="lazy"
                  @error="onImgError($event, deck)"
                />
              </div>
            </div>

            <!-- Texte -->
            <div class="min-w-0 flex-1">
              <h3 class="font-display text-xl leading-tight">
                {{ deck.name }}
              </h3>
              <p
                class="mt-1 font-mono text-[11px] uppercase tracking-wider text-base-content/55"
              >
                <span v-if="deck.rank">{{ deck.rank }} · </span>{{ deck.event }}
                <span v-if="deck.author"> · {{ deck.author }}</span>
              </p>
              <p
                v-if="deck.description"
                class="mt-2 text-sm text-base-content/70"
              >
                {{ deck.description }}
              </p>

              <dl class="mt-4 space-y-2 border-t border-base-content/15 pt-3">
                <div class="flex items-center gap-2 text-sm">
                  <span
                    class="inline-block h-2 w-2 shrink-0"
                    :style="{ backgroundColor: heroColor(deck) }"
                  ></span>
                  <dt class="font-medium">Héros</dt>
                  <dd class="text-base-content/75">{{ deck.hero || "—" }}</dd>
                </div>
                <div class="flex items-center gap-2 text-sm">
                  <span class="inline-block h-2 w-2 shrink-0 bg-primary"></span>
                  <dt class="font-medium">Cartes</dt>
                  <dd class="font-mono tabular text-base-content/75">
                    {{ deckCardCount(deck) }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div
            class="mt-4 flex flex-wrap items-center gap-3 border-t border-base-content/15 pt-4"
          >
            <button
              class="btn btn-primary btn-sm gap-2"
              :disabled="importing.has(deck.id)"
              @click="onImport(deck)"
            >
              <svg
                viewBox="0 0 24 24"
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
                />
              </svg>
              {{
                importing.has(deck.id) ? "Import…" : "Importer dans mes decks"
              }}
            </button>
            <a
              v-if="deck.sourceUrl"
              :href="deck.sourceUrl"
              target="_blank"
              rel="noopener"
              class="btn btn-ghost btn-sm gap-2"
            >
              Source
            </a>
            <span
              v-if="deck.format"
              class="ml-auto font-mono text-[10px] uppercase tracking-wider text-base-content/45"
              >{{ deck.format }}</span
            >
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useToast } from "@/composables/useToast";
import { getIllustrationPath } from "@/utils/imagePaths";
import {
  loadCommunityDecks,
  groupBySource,
  deckCardCount,
  communityDeckToText,
  type SourcedDeck,
} from "@/services/communityDeckService";
import { loadPublicDecks } from "@/services/publicDeckService";
import type { CloudDeck } from "@/services/cloudSync";

const router = useRouter();
const deckStore = useDeckStore();
const cardStore = useCardStore();
const toast = useToast();

const loading = ref(true);
const decks = ref<SourcedDeck[]>([]);
const importing = ref(new Set<string>());

const groups = computed(() => groupBySource(decks.value));

const elementColors: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};

function findHero(deck: SourcedDeck) {
  if (!deck.hero) return null;
  return (
    cardStore.cards.find(
      (c) => c.name === deck.hero && c.mainType === "Héros",
    ) || cardStore.cards.find((c) => c.name === deck.hero)
  );
}
function heroColor(deck: SourcedDeck): string {
  const h = findHero(deck);
  const el = (h?.stats?.niveau?.element || h?.stats?.force?.element || "neutre")
    .toString()
    .toLowerCase();
  return elementColors[el] || elementColors.neutre;
}
function heroImage(deck: SourcedDeck): string {
  const h = findHero(deck);
  if (h) return getIllustrationPath(h.id);
  return "/images/card-back.webp";
}
function onImgError(e: Event, deck?: SourcedDeck) {
  const img = e.target as HTMLImageElement;
  const h = deck ? findHero(deck) : null;
  // repli : recto de la carte puis dos
  if (h && !img.src.includes("_recto") && !img.src.includes("card-back")) {
    img.src = `/images/cards/${h.id}_recto.webp`;
  } else {
    img.src = "/images/card-back.webp";
  }
}

function onImport(deck: SourcedDeck) {
  importing.value.add(deck.id);
  try {
    const text = communityDeckToText(deck);
    const result = deckStore.importDeck(text);
    if (result.success && result.deckId) {
      if (result.warnings?.length)
        toast.warning(result.warnings.slice(0, 3).join("\n"), {
          duration: 5000,
        });
      toast.success(`« ${deck.name} » importé dans vos decks`, {
        duration: 3000,
      });
      router.push(`/deck/${result.deckId}`);
    } else {
      toast.error(result.errors?.join("\n") || "Import impossible", {
        duration: 6000,
      });
    }
  } finally {
    importing.value.delete(deck.id);
  }
}

/** Convertit un deck publié (CloudDeck, ids de cartes) en SourcedDeck pour la galerie. */
function publicToSourced(cloud: CloudDeck): SourcedDeck {
  const nameOf = (id: string | null) =>
    id ? (cardStore.cards.find((c) => c.id === id)?.name ?? "") : "";
  return {
    id: `pub-${cloud.id}-${cloud.user_id.slice(0, 8)}`,
    name: cloud.name,
    source: "Communauté",
    hero: nameOf(cloud.hero_id) || undefined,
    havreSac: nameOf(cloud.havre_sac_id) || undefined,
    cards: (cloud.cards ?? [])
      .filter((c) => !c.isReserve)
      .map((c) => ({ name: nameOf(c.cardId), quantity: c.quantity }))
      .filter((c) => c.name),
  };
}

onMounted(async () => {
  await cardStore.initialize();
  deckStore.initialize();
  const curated = await loadCommunityDecks();
  // Decks publiés par les joueurs (galerie communautaire dynamique). Tolérant :
  // si Supabase n'est pas joignable/déployé, on garde la bibliothèque curatée.
  let published: SourcedDeck[] = [];
  try {
    const rows = await loadPublicDecks();
    published = rows.map(publicToSourced).filter((d) => d.cards.length > 0);
  } catch {
    /* galerie publique indisponible */
  }
  decks.value = [...curated, ...published];
  loading.value = false;
});
</script>
