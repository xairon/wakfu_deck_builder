<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen && deck"
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm"
        data-testid="deck-preview-modal"
        @click.self="emit('close')"
      >
        <div
          class="flex flex-col w-full max-w-5xl max-h-[92vh] bg-base-100 border border-base-content/20 shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
          :aria-label="deck.name"
        >
          <!-- En-tête -->
          <div class="flex items-start justify-between gap-4 p-5 border-b border-base-content/15 bg-base-200/50">
            <div class="flex items-center gap-4 min-w-0">
              <!-- Vignette héros -->
              <div
                class="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg overflow-hidden border-2 shadow-md"
                :style="{ borderColor: heroColor }"
              >
                <img
                  :src="heroImg"
                  :alt="heroName"
                  class="w-full h-full object-cover object-[50%_20%]"
                  @error="onImgFallback"
                />
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    v-if="sourceLabel"
                    class="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-primary/15 text-primary border border-primary/30"
                  >
                    {{ sourceLabel }}
                  </span>
                  <span
                    v-if="formatLabel"
                    class="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-base-300 text-base-content/70"
                  >
                    {{ formatLabel }}
                  </span>
                  <span
                    v-if="isOfficial"
                    class="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30"
                  >
                    Officiel
                  </span>
                </div>

                <h2 class="mt-1 font-display text-2xl sm:text-3xl truncate leading-tight">
                  {{ deck.name }}
                </h2>

                <p class="font-mono text-xs text-base-content/60 truncate">
                  <span v-if="authorLabel">Par {{ authorLabel }}</span>
                  <span v-if="eventLabel"> · {{ eventLabel }}</span>
                </p>
              </div>
            </div>

            <!-- Bouton fermer -->
            <button
              type="button"
              class="btn btn-ghost btn-circle btn-sm shrink-0"
              aria-label="Fermer la prévisualisation"
              data-testid="preview-close-btn"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>

          <!-- Corps défilable -->
          <div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            <!-- Bandeau de statistiques clés -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-3 bg-base-200/60 rounded-lg border border-base-content/10">
                <span class="block font-mono text-[11px] uppercase tracking-wider text-base-content/60">Cartes Deck</span>
                <span class="font-mono text-xl font-bold tabular">{{ totalMainCards }}</span>
                <span class="text-xs text-base-content/50 ml-1">/ 48</span>
              </div>
              <div class="p-3 bg-base-200/60 rounded-lg border border-base-content/10">
                <span class="block font-mono text-[11px] uppercase tracking-wider text-base-content/60">Héros & Havre</span>
                <span class="font-medium text-sm text-primary truncate block" :title="heroName || '—'">{{ heroName || '—' }}</span>
                <span class="text-xs text-base-content/60 truncate block" :title="havreSacName || '—'">{{ havreSacName || '—' }}</span>
              </div>
              <div class="p-3 bg-base-200/60 rounded-lg border border-base-content/10">
                <span class="block font-mono text-[11px] uppercase tracking-wider text-base-content/60">Réserve</span>
                <span class="font-mono text-xl font-bold tabular">{{ totalReserveCards }}</span>
                <span class="text-xs text-base-content/50 ml-1">cartes</span>
              </div>
              <div class="p-3 bg-base-200/60 rounded-lg border border-base-content/10">
                <span class="block font-mono text-[11px] uppercase tracking-wider text-base-content/60">Éléments</span>
                <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span
                    v-for="(count, el) in elementCounts"
                    :key="el"
                    class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold capitalize"
                    :style="{ backgroundColor: (elementColors as any)[el] ? (elementColors as any)[el] + '25' : '#8882', color: (elementColors as any)[el] || 'inherit' }"
                  >
                    {{ el }}: {{ count }}
                  </span>
                  <span v-if="!Object.keys(elementCounts).length" class="text-xs text-base-content/40">—</span>
                </div>
              </div>
            </div>

            <!-- Répartition par types -->
            <div class="flex flex-wrap gap-2 pt-1 border-t border-base-content/10">
              <span
                v-for="(count, type) in typeCounts"
                :key="type"
                class="px-2.5 py-1 rounded-full text-xs font-mono bg-base-200 border border-base-content/15 text-base-content/80 flex items-center gap-1.5"
              >
                <span>{{ type }}</span>
                <span class="font-bold text-primary tabular">{{ count }}</span>
              </span>
            </div>

            <!-- Description / Guide -->
            <div v-if="descriptionText || guideText" class="p-4 rounded-lg bg-base-200/40 border border-base-content/10 space-y-2 text-sm text-base-content/80">
              <p v-if="descriptionText" class="italic">{{ descriptionText }}</p>
              <details v-if="guideText" class="mt-2 text-xs text-base-content/75">
                <summary class="cursor-pointer font-medium text-primary hover:underline">
                  Consulter le guide de jeu
                </summary>
                <p class="mt-2 whitespace-pre-line leading-relaxed">{{ guideText }}</p>
              </details>
            </div>

            <!-- Grille des cartes classées par sections -->
            <div class="space-y-6">
              <!-- Section Héros & Havre-Sac -->
              <section v-if="resolvedHero || resolvedHavre">
                <h3 class="section-rule eyebrow mb-3">Héros & Havre-Sac</h3>
                <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  <div
                    v-if="resolvedHero"
                    class="cursor-pointer group relative rounded overflow-hidden border border-base-content/20 hover:border-primary transition"
                    @click="zoomCard = resolvedHero"
                  >
                    <div class="aspect-[7/10] bg-base-200">
                      <img
                        :src="cardThumb(resolvedHero)"
                        :alt="resolvedHero.name"
                        class="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        @error="onImgFallback"
                      />
                    </div>
                    <div class="p-1.5 bg-base-100 text-center">
                      <p class="text-xs font-medium truncate">{{ resolvedHero.name }}</p>
                      <span class="text-[10px] text-primary font-mono font-bold">Héros</span>
                    </div>
                  </div>

                  <div
                    v-if="resolvedHavre"
                    class="cursor-pointer group relative rounded overflow-hidden border border-base-content/20 hover:border-primary transition"
                    @click="zoomCard = resolvedHavre"
                  >
                    <div class="aspect-[7/10] bg-base-200">
                      <img
                        :src="cardThumb(resolvedHavre)"
                        :alt="resolvedHavre.name"
                        class="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        @error="onImgFallback"
                      />
                    </div>
                    <div class="p-1.5 bg-base-100 text-center">
                      <p class="text-xs font-medium truncate">{{ resolvedHavre.name }}</p>
                      <span class="text-[10px] text-base-content/60 font-mono">Havre-Sac</span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Section Deck Principal -->
              <section>
                <div class="flex items-center justify-between mb-3">
                  <h3 class="section-rule eyebrow">
                    Deck principal · <span class="tabular text-base-content">{{ totalMainCards }}</span>
                  </h3>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs gap-1 font-mono text-[11px]"
                    @click="viewMode = viewMode === 'grid' ? 'list' : 'grid'"
                  >
                    {{ viewMode === 'grid' ? 'Vue liste' : 'Vue grille' }}
                  </button>
                </div>

                <!-- Grille -->
                <div
                  v-if="viewMode === 'grid'"
                  class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3"
                >
                  <div
                    v-for="entry in mainEntries"
                    :key="entry.name"
                    class="cursor-pointer group relative rounded overflow-hidden border border-base-content/15 hover:border-primary transition bg-base-200/30"
                    :title="`${entry.name} (${entry.quantity})`"
                    @click="entry.card && (zoomCard = entry.card)"
                  >
                    <div class="aspect-[7/10] bg-base-200 relative overflow-hidden">
                      <img
                        v-if="entry.card"
                        :src="cardThumb(entry.card)"
                        :alt="entry.name"
                        class="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        loading="lazy"
                        @error="onImgFallback"
                      />
                      <div v-else class="flex items-center justify-center h-full p-2 text-center text-xs text-base-content/50">
                        {{ entry.name }}
                      </div>
                      <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/85 text-white font-mono text-xs font-bold shadow">
                        ×{{ entry.quantity }}
                      </span>
                      <span
                        v-if="entry.card?.stats?.niveau?.valeur !== undefined"
                        class="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-amber-300 font-mono text-[10px] font-bold"
                      >
                        N{{ entry.card.stats.niveau.valeur }}
                      </span>
                    </div>
                    <div class="p-1.5 bg-base-100">
                      <p class="text-xs font-medium truncate" :class="entry.card ? 'text-base-content' : 'text-warning'">
                        {{ entry.name }}
                      </p>
                      <p class="font-mono text-[10px] text-base-content/55 truncate">
                        {{ entry.card?.mainType || entry.type || 'Carte' }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Liste -->
                <div v-else class="divide-y divide-base-content/10 border border-base-content/15 rounded-lg overflow-hidden bg-base-100">
                  <div
                    v-for="entry in mainEntries"
                    :key="entry.name"
                    class="flex items-center justify-between p-2.5 hover:bg-base-200/50 cursor-pointer text-sm transition"
                    @click="entry.card && (zoomCard = entry.card)"
                  >
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-8 h-10 rounded overflow-hidden shrink-0 bg-base-200">
                        <img
                          v-if="entry.card"
                          :src="cardThumb(entry.card)"
                          :alt="entry.name"
                          class="w-full h-full object-cover"
                          loading="lazy"
                          @error="onImgFallback"
                        />
                      </div>
                      <div class="truncate">
                        <p class="font-medium truncate" :class="entry.card ? 'text-base-content' : 'text-warning'">
                          {{ entry.name }}
                        </p>
                        <span class="text-[11px] font-mono text-base-content/60">
                          {{ entry.card?.mainType || entry.type || 'Carte' }}
                          <template v-if="entry.card?.stats?.niveau?.valeur !== undefined">
                            · N{{ entry.card.stats.niveau.valeur }}
                          </template>
                        </span>
                      </div>
                    </div>
                    <span class="font-mono font-bold text-base text-primary shrink-0 tabular">
                      ×{{ entry.quantity }}
                    </span>
                  </div>
                </div>
              </section>

              <!-- Section Réserve -->
              <section v-if="reserveEntries.length > 0">
                <h3 class="section-rule eyebrow mb-3">
                  Réserve · <span class="tabular text-base-content">{{ totalReserveCards }}</span>
                </h3>
                <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
                  <div
                    v-for="entry in reserveEntries"
                    :key="entry.name"
                    class="cursor-pointer group relative rounded overflow-hidden border border-base-content/15 hover:border-primary transition bg-base-200/30"
                    :title="`${entry.name} (${entry.quantity})`"
                    @click="entry.card && (zoomCard = entry.card)"
                  >
                    <div class="aspect-[7/10] bg-base-200 relative overflow-hidden">
                      <img
                        v-if="entry.card"
                        :src="cardThumb(entry.card)"
                        :alt="entry.name"
                        class="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        loading="lazy"
                        @error="onImgFallback"
                      />
                      <div v-else class="flex items-center justify-center h-full p-2 text-center text-xs text-base-content/50">
                        {{ entry.name }}
                      </div>
                      <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/85 text-white font-mono text-xs font-bold shadow">
                        ×{{ entry.quantity }}
                      </span>
                    </div>
                    <div class="p-1.5 bg-base-100">
                      <p class="text-xs font-medium truncate">{{ entry.name }}</p>
                      <p class="font-mono text-[10px] text-base-content/55 truncate">
                        {{ entry.card?.mainType || entry.type || 'Réserve' }}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <!-- Pied de page avec actions -->
          <div class="p-4 sm:p-5 border-t border-base-content/15 bg-base-200/60 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              @click="emit('close')"
            >
              Fermer
            </button>

            <div class="flex items-center gap-3">
              <span v-if="isImported" class="font-mono text-xs text-success flex items-center gap-1 font-medium">
                ✓ Présent dans vos decks
              </span>
              <button
                type="button"
                class="btn btn-primary btn-sm gap-2"
                :disabled="importing || isImported"
                data-testid="preview-import-btn"
                @click="emit('import', deck)"
              >
                <svg
                  v-if="!importing"
                  viewBox="0 0 24 24"
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
                  />
                </svg>
                <span v-if="importing" class="loading loading-spinner loading-xs"></span>
                <span>{{ importing ? "Importation…" : isImported ? "Déjà importé" : "Importer dans mes decks" }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Zoom de carte sélectionnée -->
        <CardZoomModal
          v-if="zoomCard"
          :card="zoomCard"
          :open="!!zoomCard"
          @close="zoomCard = null"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Card } from "@/types/cards";
import { useCardStore } from "@/stores/cardStore";
import { useDeckStore } from "@/stores/deckStore";
import { elementColors } from "@/config/elementColors";
import { getIllustrationPath, getThumbPath } from "@/utils/imagePaths";
import CardZoomModal from "@/components/card/CardZoomModal.vue";

const props = defineProps<{
  isOpen: boolean;
  deck: any;
  isOfficial?: boolean;
  isImported?: boolean;
  importing?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "import", deck: any): void;
}>();

const cardStore = useCardStore();
const deckStore = useDeckStore();

const viewMode = ref<"grid" | "list">("grid");
const zoomCard = ref<Card | null>(null);

// Touche Échap pour fermer
function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.isOpen) {
    if (zoomCard.value) {
      zoomCard.value = null;
    } else {
      emit("close");
    }
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      window.addEventListener("keydown", onKeyDown);
      // Garantir l'initialisation du catalogue de cartes
      if (!cardStore.cards.length) {
        cardStore.initialize?.();
      }
    } else {
      window.removeEventListener("keydown", onKeyDown);
      zoomCard.value = null;
    }
  },
  { immediate: true },
);

function resolveCard(nameOrId?: string, type?: string): Card | null {
  if (!nameOrId) return null;
  const clean = nameOrId.replace(/_(recto|verso)$/, "");
  // Recherche par ID
  const byId = cardStore.getCardByIdSync(nameOrId) || cardStore.getCardByIdSync(clean) || cardStore.cards.find(c => c.id === nameOrId || c.id === clean);
  if (byId) return byId;
  // Recherche par nom
  return deckStore.findCardByName(nameOrId, type) || cardStore.cards.find(c => c.name.toLowerCase() === nameOrId.toLowerCase()) || null;
}

const heroName = computed(() => {
  const d = props.deck;
  if (!d) return "";
  return d.hero?.name ?? d.hero ?? d.heroName ?? "";
});

const havreSacName = computed(() => {
  const d = props.deck;
  if (!d) return "";
  return d.havreSac?.name ?? d.havreSac ?? d.havreSacName ?? "";
});

const resolvedHero = computed(() => {
  const d = props.deck;
  if (!d) return null;
  if (d.hero && typeof d.hero === "object" && d.hero.name) return d.hero as Card;
  return resolveCard(heroName.value, "Héros");
});

const resolvedHavre = computed(() => {
  const d = props.deck;
  if (!d) return null;
  if (d.havreSac && typeof d.havreSac === "object" && d.havreSac.name) return d.havreSac as Card;
  return resolveCard(havreSacName.value, "Havre-Sac");
});

const heroColor = computed(() => {
  const h = resolvedHero.value;
  const el = (h?.stats?.niveau?.element || h?.stats?.force?.element || "neutre").toString().toLowerCase();
  return (elementColors as any)[el] || elementColors.neutre;
});

const heroImg = computed(() => {
  if (resolvedHero.value) {
    return getIllustrationPath(resolvedHero.value.id);
  }
  return "/images/card-back.webp";
});

const sourceLabel = computed(() => {
  const d = props.deck;
  return d?.source || d?.publication?.source || d?.extension || "";
});

const formatLabel = computed(() => props.deck?.format || "");
const authorLabel = computed(() => props.deck?.author || props.deck?.publication?.author || "");
const eventLabel = computed(() => props.deck?.event || props.deck?.rank || "");
const descriptionText = computed(() => props.deck?.description || props.deck?.publication?.tagline || "");
const guideText = computed(() => props.deck?.guide || props.deck?.publication?.guide || "");

interface CardEntry {
  name: string;
  quantity: number;
  type?: string;
  isReserve?: boolean;
  card: Card | null;
}

const allEntries = computed<CardEntry[]>(() => {
  const d = props.deck;
  if (!d) return [];

  // Cas 1 : SourcedDeck avec published.cards
  if (d.published?.cards?.length) {
    return d.published.cards.map((c: any) => {
      const card = resolveCard(c.cardId || c.id || c.name);
      return {
        name: card?.name || c.name || c.cardId || "Carte",
        quantity: Number(c.quantity || c.count || 1),
        type: card?.mainType || c.type,
        isReserve: Boolean(c.isReserve || c.is_reserve),
        card,
      };
    });
  }

  // Cas 2 : cards au format [{ card, quantity, isReserve }]
  if (Array.isArray(d.cards)) {
    return d.cards.map((c: any) => {
      if (c.card && typeof c.card === "object") {
        return {
          name: c.card.name,
          quantity: Number(c.quantity || 1),
          type: c.card.mainType,
          isReserve: Boolean(c.isReserve),
          card: c.card as Card,
        };
      }
      const card = resolveCard(c.cardId || c.id || c.name, c.type);
      return {
        name: card?.name || c.name || c.cardId || "Carte",
        quantity: Number(c.quantity || c.count || 1),
        type: card?.mainType || c.type,
        isReserve: Boolean(c.isReserve || c.is_reserve),
        card,
      };
    });
  }

  return [];
});

const mainEntries = computed(() => allEntries.value.filter((e) => !e.isReserve));
const reserveEntries = computed(() => allEntries.value.filter((e) => e.isReserve));

const totalMainCards = computed(() =>
  mainEntries.value.reduce((acc, e) => acc + e.quantity, 0),
);

const totalReserveCards = computed(() =>
  reserveEntries.value.reduce((acc, e) => acc + e.quantity, 0),
);

const typeCounts = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {};
  for (const e of mainEntries.value) {
    const t = e.card?.mainType || e.type || "Autre";
    map[t] = (map[t] || 0) + e.quantity;
  }
  return map;
});

const elementCounts = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {};
  for (const e of mainEntries.value) {
    if (!e.card) continue;
    const el = (e.card.stats?.niveau?.element || e.card.element || "neutre").toString().toLowerCase();
    if (el && el !== "neutre") {
      map[el] = (map[el] || 0) + e.quantity;
    }
  }
  return map;
});

function cardThumb(card: Card): string {
  if (!card) return "/images/card-back.webp";
  if (card.imageUrl) return card.imageUrl;
  const full =
    card.mainType === "Héros"
      ? `/images/cards/${card.id}_recto.webp`
      : `/images/cards/${card.id}.webp`;
  return getThumbPath(full);
}

function onImgFallback(e: Event) {
  const img = e.target as HTMLImageElement;
  if (img.src.includes("/thumbs/")) {
    img.src = img.src.replace("/thumbs/", "/");
    return;
  }
  if (!img.src.includes("card-back")) {
    img.src = "/images/card-back.webp";
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
