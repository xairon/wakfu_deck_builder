/** * Grille de cartes avec filtres et contrôles de collection * Permet
d'afficher, filtrer et gérer une collection de cartes * @component */
<template>
  <div class="card-grid space-y-6">
    <!-- Filtres -->
    <CardFilters v-model="filters" @update:modelValue="handleFiltersChange" />

    <!-- Stats -->
    <CardCollectionStats :cards="props.cards" :filtered-cards="filteredCards" />

    <!-- Grille de cartes -->
    <div v-if="loading" class="flex justify-center items-center py-8">
      <div class="loading loading-spinner loading-lg"></div>
    </div>

    <div v-else-if="props.cards.length === 0" class="text-center py-8">
      <h3 class="text-xl font-bold mb-2">Aucune carte trouvée</h3>
      <p class="text-base-content/60">
        Essayez de modifier vos filtres de recherche
      </p>
    </div>

    <div
      v-else
      v-bind="containerProps"
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
    >
      <div v-bind="wrapperProps">
        <div
          v-for="{ data: card } in list"
          :key="card.id"
          @click="handleCardClick(card)"
        >
          <CardComponent :card="card" class="h-full cursor-pointer" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Card } from '@/types/collection'
import CardComponent from './CardComponent.vue'
import CardCollectionControls from './CardCollectionControls.vue'
import CardFilters from './CardFilters.vue'
import CardCollectionStats from './CardCollectionStats.vue'
import { useCardStore } from '@/stores/cardStore'
import { useRouter } from 'vue-router'
import type { Filters } from './CardFilters.vue'
import { useVirtualList } from '@vueuse/core'

/**
 * Props du composant
 * @typedef {Object} Props
 * @property {Card[]} cards - Liste des cartes à afficher
 * @property {boolean} [selectable] - Si true, les cartes sont sélectionnables
 * @property {boolean} [loading] - Si true, affiche un indicateur de chargement
 */
const props = defineProps<{
  cards: Card[]
  selectable?: boolean
  loading?: boolean
}>()

/**
 * Events émis par le composant
 * @typedef {Object} Emits
 * @property {(card: Card) => void} select - Émis lors de la sélection d'une carte
 */
const emit = defineEmits<{
  (e: 'select', card: Card): void
  (e: 'cardClick', card: Card): void
}>()

const cardStore = useCardStore()
const router = useRouter()

// État local
const filters = ref<Filters>({
  search: '',
  type: '',
  extension: '',
  showOnlyCollection: false,
})

const { list, containerProps, wrapperProps } = useVirtualList(props.cards, {
  itemHeight: 320, // Hauteur approximative d'une carte avec ses contrôles
  overscan: 10, // Nombre d'éléments à pré-rendre
})

/**
 * Liste des cartes filtrées selon les critères
 * @type {import('vue').ComputedRef<Card[]>}
 */
const filteredCards = computed(() => {
  let result = props.cards

  if (filters.value.search) {
    const search = filters.value.search.toLowerCase()
    result = result.filter(
      (card) =>
        card.name.toLowerCase().includes(search) ||
        card.mainType.toLowerCase().includes(search)
    )
  }

  if (filters.value.type) {
    result = result.filter((card) => card.mainType === filters.value.type)
  }

  if (filters.value.extension) {
    result = result.filter((card) => card.extension === filters.value.extension)
  }

  if (filters.value.showOnlyCollection) {
    result = result.filter((card) => cardStore.collection.has(card.image_id))
  }

  return result
})

/**
 * Gère le clic sur une carte
 * @param {Card} card - La carte cliquée
 */
function handleCardClick(card: Card) {
  if (props.selectable) {
    emit('select', card)
  } else {
    router.push({
      name: 'card-details',
      params: { id: card.image_id },
    })
  }
}

/**
 * Gère les changements de filtres
 * @param {Filters} newFilters - Nouveaux filtres
 */
function handleFiltersChange(newFilters: Filters) {
  filters.value = newFilters
}
</script>

<style scoped>
.card-wrapper {
  @apply transform transition-all duration-300;
}

.card-wrapper:hover {
  @apply z-10;
  transform: scale(1.05);
}

.card-wrapper:hover .collection-controls {
  @apply opacity-100;
}

.grid {
  @apply p-4;
}
</style>
