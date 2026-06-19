<template>
  <CollectionFilters
    :extensions="filterExtensions"
    :main-types="filterMainTypes"
    :sub-types="filterSubTypes"
    :rarities="filterRarities"
    :elements="filterElements"
    :search-query="filterQuery"
    :selected-extension="filterExtension"
    :hide-not-owned="filterHideNotOwned"
    :selected-sort-field="filterSortField"
    :is-descending="filterSortDesc"
    :selected-main-type="filterMainType"
    :selected-sub-type="filterSubType"
    :selected-rarity="filterRarity"
    :selected-element="filterElement"
    :min-level="filterMinLevel"
    :max-level="filterMaxLevel"
    :min-cost="filterMinCost"
    :max-cost="filterMaxCost"
    :min-force="filterMinForce"
    :max-force="filterMaxForce"
    :effect-query="filterEffectQuery"
    @update:search-query="filterQuery = $event"
    @update:selected-extension="filterExtension = $event"
    @update:hide-not-owned="filterHideNotOwned = $event"
    @update:selected-sort-field="filterSortField = $event"
    @update:is-descending="filterSortDesc = $event"
    @update:selected-main-type="filterMainType = $event"
    @update:selected-sub-type="filterSubType = $event"
    @update:selected-rarity="filterRarity = $event"
    @update:selected-element="filterElement = $event"
    @update:min-level="filterMinLevel = $event"
    @update:max-level="filterMaxLevel = $event"
    @update:min-cost="filterMinCost = $event"
    @update:max-cost="filterMaxCost = $event"
    @update:min-force="filterMinForce = $event"
    @update:max-force="filterMaxForce = $event"
    @update:effect-query="filterEffectQuery = $event"
    class="mb-4"
  />
  <div class="mb-2 flex items-center justify-between gap-3">
    <label class="flex cursor-pointer items-center gap-2">
      <input
        v-model="dimUnowned"
        type="checkbox"
        class="checkbox checkbox-sm checkbox-primary"
        data-testid="dim-unowned-toggle"
      />
      <span class="eyebrow">Estomper les non possédées</span>
    </label>
    <span class="font-mono text-xs tabular text-base-content/55"
      >{{ pool.length }} carte{{ pool.length > 1 ? "s" : "" }}</span
    >
  </div>

  <!-- Erreur de chargement du catalogue -->
  <div v-if="loadError" class="py-16 text-center">
    <div class="mx-auto mb-4 h-1 w-16 bg-error"></div>
    <p class="eyebrow mb-2 text-error">Erreur de chargement</p>
    <p class="mb-6 text-sm text-base-content/70">
      Impossible de charger les cartes.
    </p>
    <button class="btn btn-neutral btn-sm" @click="$emit('retry-load')">
      Réessayer
    </button>
  </div>

  <!-- Chargement en cours -->
  <div
    v-else-if="cardStore.isInitializing && pool.length === 0"
    class="py-16 text-center text-base-content/60"
  >
    <span class="loading loading-spinner loading-md"></span>
    <p class="mt-3 text-sm">Chargement des cartes…</p>
  </div>

  <!-- Aucune carte (filtre vide) -->
  <div
    v-else-if="pool.length === 0"
    class="py-16 text-center text-sm text-base-content/60"
  >
    Aucune carte ne correspond à votre recherche.
  </div>

  <template v-else>
    <div
      class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6"
    >
      <!-- Tuile de vivier : clic → zoom ; bouton + → ajout express -->
      <div v-for="card in visiblePool" :key="card.id" class="group relative">
        <!-- Corps de la tuile : ouvre le zoom -->
        <button
          class="relative block w-full text-left"
          :title="`Lire ${card.name}`"
          :aria-label="`Lire ${card.name} — agrandir`"
          data-testid="pool-tile"
          @click="$emit('open-zoom', card)"
          @mouseenter="preview.show(card)"
          @mouseleave="preview.hide()"
          @focus="preview.show(card)"
          @blur="preview.hide()"
        >
          <div class="plate-frame" :style="{ '--spine': elementColor(card) }">
            <img
              :src="cardImg(card)"
              :alt="card.name"
              loading="lazy"
              class="aspect-[7/10] object-cover"
              :class="{
                'opacity-40': dimUnowned && ownedQty(card.id) === 0,
              }"
              @error="onImgError"
            />
            <!-- Quantité dans le deck : étiquette braise carrée -->
            <span
              v-if="inDeckQty(card.id) > 0"
              class="absolute left-[5px] top-[5px] z-10 bg-primary px-1.5 py-0.5 font-mono text-[11px] font-bold tabular text-primary-content"
              >{{ inDeckQty(card.id) }}</span
            >
            <!-- Quantité possédée : mono tabulaire -->
            <span
              class="absolute right-[5px] top-[5px] z-10 bg-base-100/90 px-1 py-0.5 font-mono text-[10px] font-bold tabular"
              :class="
                ownedQty(card.id) > 0 ? 'text-success' : 'text-base-content/40'
              "
              >{{ ownedQty(card.id) }}</span
            >
            <!-- Bandeau loupe au survol -->
            <span
              class="absolute inset-x-[5px] bottom-[5px] z-10 grid place-items-center bg-base-content py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-base-100 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            >
              <svg
                viewBox="0 0 24 24"
                class="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path stroke-linecap="round" d="m20 20-3.5-3.5" />
              </svg>
            </span>
          </div>
        </button>
        <!-- Bouton ajout express -->
        <button
          class="absolute bottom-[5px] right-[5px] z-20 bg-base-content px-1.5 py-0.5 font-mono text-[11px] font-bold text-base-100 opacity-0 transition-opacity duration-150 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
          :aria-label="`Ajouter ${card.name} au deck`"
          :disabled="!canAddCard(card)"
          :title="
            canAddCard(card) ? `Ajouter ${card.name}` : addBlockReason(card)
          "
          data-testid="pool-add"
          @click.stop="$emit('add', card)"
        >
          +
        </button>
      </div>
    </div>

    <div v-if="pool.length > visiblePool.length" class="mt-6 text-center">
      <button class="btn btn-outline btn-sm" @click="poolLimit += 60">
        Afficher plus ({{ pool.length - visiblePool.length }} restantes)
      </button>
    </div>
  </template>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { getThumbPath } from "@/utils/imagePaths";
import { elementColor as elementColorByEl } from "@/config/elementColors";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useCardPreview } from "@/composables/useCardPreview";
import {
  filterCards,
  sortCards,
  pruneFilterCaches,
} from "@/composables/useCardFilter";
import type { FilterCriteria } from "@/composables/useCardFilter";
import CollectionFilters from "@/components/collection/CollectionFilters.vue";
import type { Card } from "@/types/cards";

const cardStore = useCardStore();
const deckStore = useDeckStore();
const preview = useCardPreview();

defineProps<{
  loadError: boolean;
}>();

defineEmits<{
  "open-zoom": [card: Card];
  add: [card: Card];
  "retry-load": [];
}>();

// ── Filtres ───────────────────────────────────────────────────────────────────
const filterQuery = ref("");
const filterExtension = ref("");
const filterMainType = ref("");
const filterSubType = ref("");
const filterRarity = ref("");
const filterElement = ref("");
const filterMinLevel = ref<number | null>(null);
const filterMaxLevel = ref<number | null>(null);
const filterMinCost = ref<number | null>(null);
const filterMaxCost = ref<number | null>(null);
const filterMinForce = ref<number | null>(null);
const filterMaxForce = ref<number | null>(null);
const filterEffectQuery = ref("");
const filterHideNotOwned = ref(false);
const filterSortField = ref("number");
const filterSortDesc = ref(false);

const dimUnowned = ref(false);
const poolLimit = ref(60);

// ── Filter option lists ───────────────────────────────────────────────────────
const filterExtensions = computed(() => {
  const set = new Set(cardStore.cards.map((c) => c.extension.name));
  return Array.from(set).sort();
});
const filterMainTypes = computed(() => {
  const set = new Set(cardStore.cards.map((c) => c.mainType));
  return Array.from(set).sort();
});
const filterSubTypes = computed(() => {
  const set = new Set(cardStore.cards.flatMap((c) => c.subTypes ?? []));
  return Array.from(set).sort();
});
const filterRarities = computed(() => {
  const set = new Set(cardStore.cards.map((c) => c.rarity));
  return Array.from(set).sort();
});
const filterElements = computed(() => {
  const set = new Set(
    cardStore.cards
      .map(
        (c) =>
          c.stats?.niveau?.element?.toLowerCase() ||
          c.stats?.force?.element?.toLowerCase() ||
          "",
      )
      .filter(Boolean),
  );
  return Array.from(set).sort();
});

// ── Pool computation ──────────────────────────────────────────────────────────
function ownedQty(id: string): number {
  return cardStore.getCardQuantity(id) + cardStore.getFoilCardQuantity(id);
}

const ownedIds = computed(() => {
  const ids = new Set<string>();
  for (const c of cardStore.cards) {
    if (ownedQty(c.id) > 0) ids.add(c.id);
  }
  return ids;
});

const pool = computed(() => {
  pruneFilterCaches();
  const criteria: FilterCriteria = {
    query: filterQuery.value,
    extension: filterExtension.value,
    mainType: filterMainType.value,
    subType: filterSubType.value,
    rarity: filterRarity.value,
    element: filterElement.value.toLowerCase(),
    minLevel: filterMinLevel.value,
    maxLevel: filterMaxLevel.value,
    minCost: filterMinCost.value,
    maxCost: filterMaxCost.value,
    minForce: filterMinForce.value,
    maxForce: filterMaxForce.value,
    effectQuery: filterEffectQuery.value,
    hideNotOwned: filterHideNotOwned.value,
    ownedIds: ownedIds.value,
  };
  const filtered = filterCards(cardStore.cards, criteria);
  return sortCards(filtered, filterSortField.value, filterSortDesc.value);
});

const visiblePool = computed(() => pool.value.slice(0, poolLimit.value));

// ── Helpers ───────────────────────────────────────────────────────────────────
function inDeckQty(id: string): number {
  return (deckStore.currentDeck?.cards ?? [])
    .filter((c) => c.card.id === id)
    .reduce((a, c) => a + c.quantity, 0);
}

function canAddCard(card: Card): boolean {
  if (!deckStore.currentDeck) return false;
  if (card.mainType === "Héros" || card.mainType === "Havre-Sac") return true;
  const isUnique = card.keywords?.some((k) => k.name === "Unique");
  const max = isUnique ? 1 : 3;
  if (inDeckQty(card.id) >= max) return false;
  return deckStore.cardCount < 48;
}

function addBlockReason(card: Card): string {
  if (!deckStore.currentDeck) return "Aucun deck actif";
  if (card.mainType === "Héros" || card.mainType === "Havre-Sac") return "";
  const isUnique = card.keywords?.some((k) => k.name === "Unique");
  const max = isUnique ? 1 : 3;
  if (inDeckQty(card.id) >= max)
    return isUnique
      ? `${card.name} est unique (1 exemplaire max)`
      : `Maximum ${max} exemplaires de ${card.name}`;
  return "Le deck contient déjà 48 cartes";
}

function elementColor(card: Card): string {
  const el = card.stats?.niveau?.element || card.stats?.force?.element || null;
  return elementColorByEl(el?.toString());
}

function cardImg(card: Card): string {
  if (card.imageUrl) return card.imageUrl;
  const full =
    card.mainType === "Héros"
      ? `/images/cards/${card.id}_recto.webp`
      : `/images/cards/${card.id}.webp`;
  return getThumbPath(full);
}

function onImgError(e: Event) {
  const img = e.target as HTMLImageElement;
  if (img.src.includes("/thumbs/")) {
    img.src = img.src.replace("/thumbs/", "/");
    return;
  }
  img.src = "/images/card-back.webp";
}
</script>
