<template>
  <div class="collection-view w-full px-2">
    <div class="flex flex-col gap-6 max-w-screen-xl mx-auto">
      <!-- En-tête avec le titre et la progression -->
      <CollectionHeader />

      <!-- Titre de section : filet à crans -->
      <p class="section-rule eyebrow">
        Collection · {{ filteredCollection.length }} /
        {{ cardStore.totalCards }}
      </p>

      <!-- Filtres de recherche et options -->
      <CollectionFilters
        v-model:search-query="searchQuery"
        v-model:selected-extension="selectedExtension"
        v-model:hide-not-owned="hideNotOwned"
        v-model:selected-sort-field="selectedSortField"
        v-model:is-descending="isDescending"
        v-model:selected-main-type="selectedMainType"
        v-model:selected-sub-type="selectedSubType"
        v-model:selected-rarity="selectedRarity"
        v-model:selected-element="selectedElement"
        v-model:min-level="minLevel"
        v-model:max-level="maxLevel"
        v-model:min-cost="minCost"
        v-model:max-cost="maxCost"
        :extensions="extensions"
        :main-types="mainTypes"
        :sub-types="subTypes"
        :rarities="rarities"
        :elements="elements"
      />
    </div>

    <!-- Option d'affichage -->
    <div
      v-if="isAuthenticated"
      class="mt-4 flex flex-wrap items-center justify-end gap-4 max-w-screen-xl mx-auto"
    >
      <button
        class="btn btn-primary btn-sm gap-1.5"
        @click="showQuickAdd = true"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" d="M12 5v14M5 12h14" />
        </svg>
        Saisie rapide
      </button>
      <button
        class="btn btn-outline btn-sm"
        :class="{ 'btn-active': showProgress }"
        @click="showProgress = !showProgress"
      >
        Progression
      </button>
      <select
        v-model="ownershipFilter"
        class="select select-bordered select-sm"
        aria-label="Filtre de possession"
      >
        <option value="all">Toutes</option>
        <option value="missing">Manquantes</option>
        <option value="dupes">Doubles à échanger</option>
      </select>
      <label class="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          v-model="dimUnowned"
          class="checkbox checkbox-sm checkbox-primary"
        />
        <span class="eyebrow">Griser les cartes non possédées</span>
      </label>
    </div>

    <!-- Tableau de complétion -->
    <CollectionCompletion
      v-if="isAuthenticated && showProgress"
      class="mt-6 max-w-screen-xl mx-auto"
    />

    <!-- Saisie rapide -->
    <QuickAddModal :open="showQuickAdd" @close="showQuickAdd = false" />

    <!-- Grille de cartes virtualisée - occupe toute la largeur disponible -->
    <div class="w-full">
      <CollectionGrid
        :filtered-cards="filteredCollection"
        :dim-unowned="dimUnowned && isAuthenticated"
        @update-quantity="updateCardQuantity"
        @select-card="selectCard"
      />
    </div>

    <!-- Modal de détail de carte -->
    <dialog
      id="card_detail_modal"
      class="modal z-50"
      aria-modal="true"
      aria-labelledby="card-detail-title"
    >
      <div
        class="modal-box max-w-4xl relative border border-base-content/30 bg-base-100"
        @keydown.escape="closeModal"
      >
        <form method="dialog">
          <button
            class="btn btn-sm btn-ghost absolute right-2 top-2"
            aria-label="Fermer la fenêtre de détail"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </form>
        <div v-if="selectedCard" class="space-y-5">
          <!-- En-tête avec le nom et les onglets pour les héros -->
          <div class="flex justify-between items-baseline gap-4">
            <h2 id="card-detail-title" class="font-display text-3xl">
              {{ selectedCard.name }}
            </h2>
            <div v-if="isSelectedCardHero" class="join shrink-0">
              <button
                class="join-item btn btn-sm"
                :class="!showVerso ? 'btn-neutral' : 'btn-outline'"
                @click="showVerso = false"
              >
                Recto
              </button>
              <button
                class="join-item btn btn-sm"
                :class="showVerso ? 'btn-neutral' : 'btn-outline'"
                @click="showVerso = true"
              >
                Verso
              </button>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-8">
            <!-- Image -->
            <div class="relative">
              <div class="plate-frame" :style="{ '--spine': '#98A1AF' }">
                <OptimizedImage
                  :src="getSelectedCardImage"
                  :alt="`Carte ${selectedCard.name} - ${selectedCard.mainType}`"
                  :width="480"
                  :height="660"
                  loading="eager"
                  fetchpriority="high"
                  class="aspect-[7/10] w-full object-cover"
                  @error="handleImageError"
                />
              </div>

              <!-- Message d'erreur si les deux faces ont échoué -->
              <div
                v-if="imageHasError && isSelectedCardHero && imageFallbackMode"
                class="absolute inset-0 flex flex-col items-center justify-center border border-base-content/30 bg-base-100/95 p-4"
              >
                <div class="text-center space-y-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-12 w-12 mx-auto text-warning"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <h3 class="font-display text-lg">Image non disponible</h3>
                  <p class="text-sm">
                    Impossible de charger le
                    {{ showVerso ? "verso" : "recto" }} de cette carte.
                  </p>
                  <p class="font-mono text-xs tabular text-base-content/70">
                    ID: {{ selectedCard.id }}_{{
                      showVerso ? "verso" : "recto"
                    }}
                  </p>

                  <!-- Boutons pour essayer les différentes faces -->
                  <div class="join mt-4">
                    <button
                      class="join-item btn btn-sm"
                      :class="showVerso ? 'btn-outline' : 'btn-neutral'"
                      @click="
                        showVerso = false;
                        imageHasError = false;
                        imageFallbackMode = null;
                      "
                    >
                      Essayer Recto
                    </button>
                    <button
                      class="join-item btn btn-sm"
                      :class="!showVerso ? 'btn-outline' : 'btn-neutral'"
                      @click="
                        showVerso = true;
                        imageHasError = false;
                        imageFallbackMode = null;
                      "
                    >
                      Essayer Verso
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Informations -->
            <div class="space-y-5">
              <!-- Type et sous-types -->
              <div class="flex flex-wrap gap-2">
                <span
                  class="border border-base-content/30 bg-base-200 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider"
                  >{{ selectedCard.mainType }}</span
                >
                <span
                  v-for="subType in selectedCard.subTypes"
                  :key="subType"
                  class="border border-base-content/20 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-base-content/70"
                >
                  {{ subType }}
                </span>
                <span
                  v-if="
                    isSelectedCardHero &&
                    selectedCard &&
                    isHeroCard(selectedCard) &&
                    selectedCard.class &&
                    !selectedCard.subTypes?.includes(selectedCard.class)
                  "
                  class="border border-primary px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-primary"
                >
                  {{ selectedCard.class }}
                </span>
                <span
                  v-if="cardErrata.length"
                  class="border border-primary bg-primary px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-primary-content"
                  >Errata</span
                >
              </div>

              <!-- Stats : lecture mono tabulaire, filets -->
              <div
                v-if="displayedStats"
                class="grid grid-cols-3 gap-x-6 gap-y-4 border-y border-base-content/80 py-4 sm:grid-cols-5"
              >
                <div v-if="displayedStats.niveau">
                  <p class="eyebrow">Niveau</p>
                  <p
                    class="mt-1 flex items-center gap-1.5 font-mono text-2xl tabular"
                  >
                    {{ displayedStats.niveau.value }}
                    <img
                      :src="`/images/elements/ressource-${displayedStats.niveau.element.toLowerCase()}.png`"
                      :alt="displayedStats.niveau.element"
                      :title="displayedStats.niveau.element"
                      class="inline-block h-6 w-6"
                    />
                  </p>
                </div>
                <div v-if="displayedStats.force">
                  <p class="eyebrow">Force</p>
                  <p
                    class="mt-1 flex items-center gap-1.5 font-mono text-2xl tabular"
                  >
                    {{ displayedStats.force.value }}
                    <img
                      :src="`/images/elements/ressource-${displayedStats.force.element.toLowerCase()}.png`"
                      :alt="displayedStats.force.element"
                      :title="displayedStats.force.element"
                      class="inline-block h-6 w-6"
                    />
                  </p>
                </div>
                <div v-if="displayedStats.pa">
                  <p class="eyebrow">PA</p>
                  <p class="mt-1 font-mono text-2xl tabular">
                    {{ displayedStats.pa }}
                  </p>
                </div>
                <div v-if="displayedStats.pm">
                  <p class="eyebrow">PM</p>
                  <p class="mt-1 font-mono text-2xl tabular">
                    {{ displayedStats.pm }}
                  </p>
                </div>
                <div v-if="displayedStats.pv">
                  <p class="eyebrow">PV</p>
                  <p class="mt-1 font-mono text-2xl tabular">
                    {{ displayedStats.pv }}
                  </p>
                </div>
              </div>

              <!-- Effets -->
              <p v-if="displayedEffects?.length" class="section-rule eyebrow">
                Effets
              </p>
              <div v-if="displayedEffects?.length" class="space-y-3">
                <div
                  v-for="(effect, index) in displayedEffects"
                  :key="index"
                  class="border border-base-content/15 bg-base-200 p-4"
                >
                  <div>
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <p
                      class="text-sm leading-relaxed"
                      v-html="highlightEffectHtml(effect.description)"
                    ></p>
                    <div class="flex flex-wrap items-center gap-2 mt-2">
                      <div
                        v-if="effect.elements?.length"
                        class="flex items-center gap-1"
                      >
                        <span
                          v-for="element in effect.elements"
                          :key="element"
                          :class="getElementClass(element)"
                          class="text-lg"
                        >
                          <ElementIcon
                            :element="stringToElement(element)"
                            size="sm"
                          />
                        </span>
                      </div>
                      <span
                        v-if="effect.isOncePerTurn"
                        class="border border-base-content/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-base-content/70"
                      >
                        Une fois par tour
                      </span>
                      <span
                        v-if="effect.requiresIncline"
                        class="border border-base-content/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-base-content/70"
                      >
                        Nécessite d'incliner
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Mots-clés -->
              <p v-if="displayedKeywords?.length" class="section-rule eyebrow">
                Mots-clés
              </p>
              <div
                v-if="displayedKeywords?.length"
                class="flex flex-wrap gap-2"
              >
                <div
                  v-for="keyword in displayedKeywords"
                  :key="keyword.name"
                  class="tooltip tooltip-top flex items-center border border-base-content/30 px-2 py-1"
                  :data-tip="keyword.description"
                >
                  <span class="font-mono text-xs uppercase tracking-wider">{{
                    keyword.name
                  }}</span>
                  <span
                    v-if="keyword.elements?.length"
                    class="ml-2 flex items-center gap-1"
                  >
                    <span
                      v-for="element in keyword.elements"
                      :key="element"
                      :class="getElementClass(element)"
                      class="text-lg"
                    >
                      <ElementIcon
                        :element="stringToElement(element)"
                        size="sm"
                      />
                    </span>
                  </span>
                </div>
              </div>

              <!-- Errata (officiels) -->
              <template v-if="cardErrata.length">
                <p class="section-rule eyebrow text-primary">
                  Errata · {{ cardErrata.length }}
                </p>
                <div class="space-y-2">
                  <div
                    v-for="(e, i) in cardErrata"
                    :key="i"
                    class="border-l-2 border-primary bg-primary/5 p-3"
                  >
                    <p class="text-sm leading-relaxed">{{ e.summary }}</p>
                    <p
                      v-if="e.before || e.after"
                      class="mt-1 font-mono text-xs"
                    >
                      <span
                        v-if="e.before"
                        class="text-base-content/50 line-through"
                        >{{ e.before }}</span
                      >
                      <span v-if="e.before && e.after"> → </span>
                      <span v-if="e.after" class="text-base-content">{{
                        e.after
                      }}</span>
                    </p>
                    <p
                      class="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-base-content/45"
                    >
                      {{ e.date }}<span v-if="e.source"> · {{ e.source }}</span>
                    </p>
                  </div>
                </div>
              </template>

              <!-- Collection -->
              <p class="section-rule eyebrow">Collection</p>
              <div
                v-if="selectedCard"
                class="flex flex-col gap-4 border border-base-content/15 bg-base-200 p-4"
              >
                <!-- Cartes normales -->
                <div class="flex items-center gap-4">
                  <div class="flex-1">
                    <p class="eyebrow">Quantité normale</p>
                    <p class="mt-1 font-mono text-3xl tabular">
                      {{ cardStore.getCardQuantity(selectedCard.id) }}
                    </p>
                  </div>
                  <div class="join">
                    <button
                      class="join-item btn btn-outline"
                      @click="
                        selectedCard && removeFromCollection(selectedCard)
                      "
                      aria-label="Retirer un exemplaire normal"
                    >
                      -
                    </button>
                    <button
                      class="join-item btn btn-primary"
                      @click="selectedCard && addToCollection(selectedCard)"
                      aria-label="Ajouter un exemplaire normal"
                    >
                      +
                    </button>
                  </div>
                </div>

                <!-- Cartes foil -->
                <div class="flex items-center gap-4">
                  <div class="flex-1">
                    <p class="eyebrow">Quantité foil</p>
                    <p class="mt-1 font-mono text-3xl tabular">
                      {{ cardStore.getFoilCardQuantity(selectedCard.id) }}
                    </p>
                  </div>
                  <div class="join">
                    <button
                      class="join-item btn btn-outline"
                      @click="
                        selectedCard &&
                        removeFromCollection(selectedCard, 1, true)
                      "
                      aria-label="Retirer un exemplaire foil"
                    >
                      -
                    </button>
                    <button
                      class="join-item btn btn-neutral"
                      @click="
                        selectedCard && addToCollection(selectedCard, 1, true)
                      "
                      aria-label="Ajouter un exemplaire foil"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <!-- Informations -->
              <p class="section-rule eyebrow">Informations</p>
              <div class="border border-base-content/15 bg-base-200 p-4">
                <div class="space-y-2">
                  <!-- Extension -->
                  <div class="flex items-center gap-2">
                    <span class="eyebrow">Extension</span>
                    <span class="font-mono text-sm tabular">
                      {{ selectedCard.extension.name }}
                      <span
                        v-if="selectedCard.extension.number"
                        class="ml-1 text-base-content/60"
                      >
                        #{{ selectedCard.extension.number }}
                      </span>
                    </span>
                  </div>

                  <!-- Artistes -->
                  <div
                    v-if="selectedCard.artists?.length"
                    class="flex items-center gap-2"
                  >
                    <span class="eyebrow">Artiste(s)</span>
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="artist in selectedCard.artists"
                        :key="artist"
                        class="text-sm text-base-content/70"
                      >
                        {{ artist }}
                      </span>
                    </div>
                  </div>

                  <!-- Flavor -->
                  <div v-if="selectedCard.flavor" class="mt-4">
                    <blockquote
                      class="spine font-display italic text-base-content/70"
                      :style="{ '--spine': '#F04E22' }"
                    >
                      "{{ selectedCard.flavor.text }}"
                      <footer
                        v-if="selectedCard.flavor.attribution"
                        class="mt-1 text-right font-mono text-xs not-italic"
                      >
                        — {{ selectedCard.flavor.attribution }}
                      </footer>
                    </blockquote>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-neutral">Fermer</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>Fermer</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useCardStore } from "@/stores/cardStore";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/composables/useToast";
import { isHeroCard } from "@/types/cards";
import type { Card, HeroCard } from "@/types/cards";
import { useMemoize } from "@vueuse/core";
import ElementIcon from "@/components/elements/ElementIcon.vue";
import { ELEMENTS, type Element } from "@/services/elementService";
import CollectionHeader from "@/components/collection/CollectionHeader.vue";
import CollectionFilters from "@/components/collection/CollectionFilters.vue";
import CollectionGrid from "@/components/collection/CollectionGrid.vue";
import CollectionCompletion from "@/components/collection/CollectionCompletion.vue";
import QuickAddModal from "@/components/collection/QuickAddModal.vue";
import { highlightEffectHtml } from "@/utils/effectText";
import { fetchErrata, type ErrataEntry } from "@/services/errataService";
import OptimizedImage from "@/components/common/OptimizedImage.vue";

import { useRouter } from "vue-router";

const cardStore = useCardStore();
const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();

const searchQuery = ref("");
const selectedExtension = ref("");
const selectedMainType = ref("");
const selectedSubType = ref("");
const selectedRarity = ref("");
const selectedElement = ref("");
const minLevel = ref<number | null>(null);
const maxLevel = ref<number | null>(null);
const minCost = ref<number | null>(null);
const maxCost = ref<number | null>(null);
const selectedKeywords = ref<string[]>([]);
const showVerso = ref(false);
const selectedCard = ref<Card | null>(null);

// Erratas officiels de la carte sélectionnée
const cardErrata = ref<ErrataEntry[]>([]);
watch(
  selectedCard,
  async (c) => {
    cardErrata.value = c ? await fetchErrata(c.id) : [];
  },
  { immediate: true },
);
const selectedSortField = ref("number");
const isDescending = ref(false);
const hideNotOwned = ref(false);
// Filtre de possession : 'all' | 'missing' (own 0) | 'dupes' (surplus > playset)
const ownershipFilter = ref<"all" | "missing" | "dupes">("all");
// Option : griser les cartes non possédées (désactivé par défaut).
const dimUnowned = ref(false);
const showProgress = ref(false);
const showQuickAdd = ref(false);
const isModalOpen = ref(false);

const isAuthenticated = computed(() => authStore.isAuthenticated);

// État pour la synchronisation
const isSyncing = ref(false);
const syncMessage = ref("");
const syncError = ref("");

// Ajout d'une référence pour suivre les erreurs d'image
const imageHasError = ref(false);
const imageFallbackMode = ref<"recto" | "verso" | null>(null);
const errorTriggeredChange = ref(false);

// Computed properties pour les filtres
const mainTypes = computed(() => {
  const types = new Set(cardStore.cards.map((card) => card.mainType));
  return Array.from(types).sort();
});

const subTypes = computed(() => {
  const types = new Set(cardStore.cards.flatMap((card) => card.subTypes || []));
  return Array.from(types).sort();
});

const rarities = computed(() => {
  const types = new Set(cardStore.cards.map((card) => card.rarity));
  return Array.from(types).sort();
});

const elements = computed(() => {
  const elementSet = new Set<string>();
  cardStore.cards.forEach((card) => {
    if (card.stats?.niveau?.element) elementSet.add(card.stats.niveau.element);
    if (card.stats?.force?.element) elementSet.add(card.stats.force.element);
  });
  return Array.from(elementSet).sort();
});

const extensions = computed(() => cardStore.extensions);

// Computed properties pour les cartes sélectionnées
const isSelectedCardHero = computed(() => {
  if (!selectedCard.value) return false;
  // Vérifier si c'est un héros en utilisant le mainType ou en vérifiant la présence des propriétés recto/verso
  return (
    selectedCard.value.mainType === "Héros" || isHeroCard(selectedCard.value)
  );
});

const displayedStats = computed(() => {
  if (!selectedCard.value) return null;
  if (isSelectedCardHero.value && isHeroCard(selectedCard.value)) {
    return showVerso.value
      ? selectedCard.value.verso?.stats
      : selectedCard.value.recto.stats;
  }
  return selectedCard.value.stats;
});

const displayedEffects = computed(() => {
  if (!selectedCard.value) return null;
  if (isSelectedCardHero.value && isHeroCard(selectedCard.value)) {
    return showVerso.value
      ? selectedCard.value.verso?.effects
      : selectedCard.value.recto.effects;
  }
  return selectedCard.value.effects;
});

const displayedKeywords = computed(() => {
  if (!selectedCard.value) return null;
  if (isSelectedCardHero.value && isHeroCard(selectedCard.value)) {
    return showVerso.value
      ? selectedCard.value.verso?.keywords
      : selectedCard.value.recto.keywords;
  }
  return selectedCard.value.keywords;
});

const getSelectedCardImage = computed(() => {
  if (!selectedCard.value) return "/images/cards/placeholder.png";

  // Si on est en mode fallback après une erreur, forcer le mode opposé
  if (imageHasError.value && imageFallbackMode.value) {
    if (isSelectedCardHero.value) {
      return `/images/cards/${selectedCard.value.id}_${imageFallbackMode.value}.png`;
    } else {
      return "/images/cards/placeholder.png";
    }
  }

  // Chemin normal
  let imagePath = "";

  if (isSelectedCardHero.value) {
    imagePath = showVerso.value
      ? `/images/cards/${selectedCard.value.id}_verso.png`
      : `/images/cards/${selectedCard.value.id}_recto.png`;
  } else {
    imagePath = `/images/cards/${selectedCard.value.id}.png`;
  }

  return imagePath;
});

function getElementClass(element: string): string {
  switch (element.toLowerCase()) {
    case "feu":
      return "text-error";
    case "eau":
      return "text-primary";
    case "air":
      return "text-info";
    case "terre":
      return "text-success";
    default:
      return "text-base-content";
  }
}

// Fonction utilitaire pour convertir une chaîne en Element
function stringToElement(elementStr: string): Element {
  const elementMap: Record<string, Element> = {
    eau: ELEMENTS.EAU,
    feu: ELEMENTS.FEU,
    terre: ELEMENTS.TERRE,
    air: ELEMENTS.AIR,
    neutre: ELEMENTS.NEUTRE,
  };
  return elementMap[elementStr.toLowerCase()] || ELEMENTS.NEUTRE;
}

// Mémoiser la fonction de filtrage pour éviter des recalculs inutiles
const memoizedFilter = useMemoize(
  (
    cards: Card[],
    query: string,
    extension: string,
    mainType: string,
    subType: string,
    rarity: string,
    element: string,
    minLvl: number | null,
    maxLvl: number | null,
    minCst: number | null,
    maxCst: number | null,
    hideNotOwned: boolean,
  ): Card[] => {
    let filtered = [...cards];

    // Application des filtres en série
    if (query) {
      const lowQuery = query.toLowerCase();
      filtered = filtered.filter(
        (card) =>
          card.name.toLowerCase().includes(lowQuery) ||
          card.subTypes.some((type) => type.toLowerCase().includes(lowQuery)),
      );
    }

    if (extension) {
      filtered = filtered.filter((card) => card.extension.name === extension);
    }

    if (mainType) {
      filtered = filtered.filter((card) => card.mainType === mainType);
    }

    if (subType) {
      filtered = filtered.filter((card) => card.subTypes.includes(subType));
    }

    if (rarity) {
      filtered = filtered.filter((card) => card.rarity === rarity);
    }

    if (element) {
      filtered = filtered.filter(
        (card) =>
          card.stats?.niveau?.element === element ||
          card.stats?.force?.element === element,
      );
    }

    if (minLvl !== null) {
      filtered = filtered.filter((card) => {
        const niveau = card.stats?.niveau?.value;
        return niveau !== undefined ? niveau >= minLvl : false;
      });
    }

    if (maxLvl !== null) {
      filtered = filtered.filter((card) => {
        const niveau = card.stats?.niveau?.value;
        return niveau !== undefined ? niveau <= maxLvl : false;
      });
    }

    if (minCst !== null) {
      filtered = filtered.filter((card) => {
        const cost = card.stats?.pa;
        return cost !== undefined ? cost >= minCst : false;
      });
    }

    if (maxCst !== null) {
      filtered = filtered.filter((card) => {
        const cost = card.stats?.pa;
        return cost !== undefined ? cost <= maxCst : false;
      });
    }

    if (hideNotOwned) {
      const store = useCardStore();
      filtered = filtered.filter(
        (card) =>
          store.getCardQuantity(card.id) > 0 ||
          store.getFoilCardQuantity(card.id) > 0,
      );
    }

    return filtered;
  },
);

// Mémoiser la fonction de tri
const memoizedSort = useMemoize(
  (cards: Card[], sortField: string, isDesc: boolean): Card[] => {
    // Copie pour éviter de modifier l'original
    const result = [...cards];

    // Fonction pour appliquer la direction du tri
    const applyDirection = (result: number) => (isDesc ? -result : result);

    result.sort((cardA, cardB) => {
      // Fonction utilitaire pour comparer les extensions
      const compareExtensions = () => {
        const extensionOrder = {
          Incarnam: 0,
          Astrub: 1,
          Amakna: 2,
          "Bonta-Brakmar": 3,
          Pandala: 4,
          Otomaï: 5,
          "DOFUS Collection": 6,
          "Chaos d'Ogrest": 7,
          "Ankama Convention 5": 8,
          "Île des Wabbits": 9,
          Draft: 10,
        };

        // Extraire le numéro avant le '/' pour le tri
        const getCardNumber = (card: Card) => {
          const match = card.extension.number?.match(/^(\d+)\//);
          return match ? parseInt(match[1]) : 0;
        };

        // Comparer d'abord par extension
        const extA = extensionOrder[cardA.extension.name] ?? 999;
        const extB = extensionOrder[cardB.extension.name] ?? 999;

        if (extA !== extB) {
          return extA - extB;
        }

        // Si même extension, comparer par numéro
        const numA = getCardNumber(cardA);
        const numB = getCardNumber(cardB);
        return numA - numB;
      };

      switch (sortField) {
        case "number":
          return applyDirection(compareExtensions());

        case "rarity": {
          const rarityOrder = {
            Commune: 0,
            "Peu Commune": 1,
            Rare: 2,
            Mythique: 3,
            Légendaire: 4,
          };
          const rarityCompare =
            (rarityOrder[cardA.rarity] || 0) - (rarityOrder[cardB.rarity] || 0);
          if (rarityCompare !== 0) return applyDirection(rarityCompare);
          return compareExtensions();
        }

        case "type": {
          const typeCompare = cardA.mainType.localeCompare(cardB.mainType);
          if (typeCompare !== 0) return applyDirection(typeCompare);
          return compareExtensions();
        }

        case "element": {
          const elementA =
            cardA.stats?.niveau?.element ||
            cardA.stats?.force?.element ||
            "neutre";
          const elementB =
            cardB.stats?.niveau?.element ||
            cardB.stats?.force?.element ||
            "neutre";
          const elementCompare = elementA.localeCompare(elementB);
          if (elementCompare !== 0) return applyDirection(elementCompare);
          return compareExtensions();
        }

        case "force": {
          const forceA = cardA.stats?.force?.value || 0;
          const forceB = cardB.stats?.force?.value || 0;
          if (forceA !== forceB) return applyDirection(forceA - forceB);
          return compareExtensions();
        }

        default:
          return compareExtensions();
      }
    });

    return result;
  },
);

// Filtrage des cartes avec optimisation
const filteredCollection = computed(() => {
  // 1. Filtrage avec mémoisation
  const filteredCards = memoizedFilter(
    cardStore.cards,
    searchQuery.value,
    selectedExtension.value,
    selectedMainType.value,
    selectedSubType.value,
    selectedRarity.value,
    selectedElement.value,
    minLevel.value,
    maxLevel.value,
    minCost.value,
    maxCost.value,
    hideNotOwned.value,
  );

  // 2. Tri avec mémoisation
  const sortedCards = memoizedSort(
    filteredCards,
    selectedSortField.value,
    isDescending.value,
  );

  // 3. Construction du résultat final
  let result = sortedCards.map((card) => ({
    card,
    quantity: cardStore.getCardQuantity(card.id),
    foilQuantity: cardStore.getFoilCardQuantity(card.id),
  }));

  // 4. Filtre de possession (manquantes / doubles)
  if (ownershipFilter.value === "missing") {
    result = result.filter((r) => r.quantity + r.foilQuantity === 0);
  } else if (ownershipFilter.value === "dupes") {
    result = result.filter((r) => {
      const target = r.card.keywords?.some((k) => k.name === "Unique") ? 1 : 3;
      return r.quantity > target;
    });
  }

  return result;
});

// Gestion des actions
function updateCardQuantity(
  cardId: string,
  quantityChange: number,
  isFoil: boolean,
) {
  // Le suivi de collection nécessite un compte.
  if (!isAuthenticated.value) {
    toast.info("Connectez-vous pour suivre votre collection", {
      duration: 3000,
    });
    router.push({ name: "auth", query: { redirect: "/collection" } });
    return;
  }
  try {
    // Trouver la carte correspondante
    const card = cardStore.cards.find((c) => c.id === cardId);
    if (!card) {
      toast.error(`Carte non trouvée: ${cardId}`);
      return;
    }

    const currentQuantity = isFoil
      ? cardStore.getFoilCardQuantity(cardId)
      : cardStore.getCardQuantity(cardId);
    const newQuantity = Math.max(0, currentQuantity + quantityChange);

    if (quantityChange > 0) {
      cardStore.addToCollection(card, quantityChange, isFoil);
      toast.success(`${card.name} ajoutée à la collection`);
    } else if (quantityChange < 0) {
      cardStore.removeFromCollection(card, Math.abs(quantityChange), isFoil);
      if (newQuantity === 0) {
        const totalRemaining =
          cardStore.getCardQuantity(cardId) +
          cardStore.getFoilCardQuantity(cardId);
        if (totalRemaining === 0) {
          toast.info(`${card.name} retirée de la collection`);
        }
      }
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la carte:", error);
    toast.error(`Erreur lors de la mise à jour`);
  }
}

function addToCollection(card: Card, quantity = 1, isFoil = false) {
  updateCardQuantity(card.id, quantity, isFoil);
}

function removeFromCollection(card: Card, quantity = 1, isFoil = false) {
  updateCardQuantity(card.id, -quantity, isFoil);
}

// Fonctions de gestion des cartes
function selectCard(card: Card) {
  if (!card) {
    return;
  }

  // Réinitialiser les états d'erreur
  imageHasError.value = false;
  imageFallbackMode.value = null;
  showVerso.value = false;

  // Définir la carte sélectionnée
  selectedCard.value = card;

  // Ouvrir le modal en utilisant l'API Dialog native
  const modal = document.getElementById(
    "card_detail_modal",
  ) as HTMLDialogElement;
  if (modal) {
    modal.showModal();
    isModalOpen.value = true;
  }
}

function closeModal() {
  // Fermer le modal en utilisant l'API Dialog native
  const modal = document.getElementById(
    "card_detail_modal",
  ) as HTMLDialogElement;
  if (modal) {
    modal.close();
    isModalOpen.value = false;
  }

  // Réinitialiser les états après une courte animation
  setTimeout(() => {
    selectedCard.value = null;
    showVerso.value = false;
    imageHasError.value = false;
    imageFallbackMode.value = null;
  }, 300);
}

// Initialisation
onMounted(async () => {
  try {
    if (!cardStore.isInitialized) {
      await cardStore.initialize();
    }

    // La synchronisation cloud est gérée par le authStore à la connexion.
  } catch (error) {
    console.error("❌ Erreur lors du chargement des cartes:", error);
    toast.addToast({
      type: "error",
      message: "Erreur lors du chargement des cartes. Veuillez réessayer.",
      timeout: 5000,
    });
  }
});

function resetFilters() {
  searchQuery.value = "";
  selectedExtension.value = "";
  selectedMainType.value = "";
  selectedSubType.value = "";
  selectedRarity.value = "";
  selectedElement.value = "";
  minLevel.value = null;
  maxLevel.value = null;
  selectedSortField.value = "number";
  isDescending.value = false;
  hideNotOwned.value = false;

  toast.info("Filtres réinitialisés");
}

function disableHideNotOwned() {
  hideNotOwned.value = false;
  toast.success("Affichage des cartes non possédées activé");
}

// Fonction pour gérer les erreurs d'image
function handleImageError() {
  if (isSelectedCardHero.value) {
    // If we already tried a fallback and it also failed, give up
    if (imageFallbackMode.value !== null) {
      imageHasError.value = true;
      return;
    }

    // First failure: try the other side
    errorTriggeredChange.value = true;
    if (showVerso.value) {
      imageFallbackMode.value = "recto";
      showVerso.value = false;
    } else {
      imageFallbackMode.value = "verso";
      showVerso.value = true;
    }
  } else {
    imageHasError.value = true;
  }
}

// Réinitialiser l'état d'erreur d'image quand on change de carte sélectionnée
watch(selectedCard, () => {
  imageHasError.value = false;
  imageFallbackMode.value = null;
});

// Réinitialiser l'état d'erreur quand on bascule manuellement entre recto et verso
// (skip reset when the change was triggered by handleImageError)
watch(showVerso, () => {
  if (errorTriggeredChange.value) {
    errorTriggeredChange.value = false;
    return;
  }
  imageHasError.value = false;
  imageFallbackMode.value = null;
});
</script>

<style scoped>
.collection-view {
  max-width: 100vw;
  overflow-x: hidden;
}
</style>
