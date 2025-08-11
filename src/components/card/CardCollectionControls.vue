/** * Composant de contrôle de la collection pour une carte * Permet
d'ajouter/retirer des exemplaires normaux et foil d'une carte * @component */
<template>
  <div class="collection-controls bg-base-200/90 rounded-lg p-2 shadow-lg">
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium min-w-[4rem]">Normal</span>
        <div class="flex items-center gap-1">
          <button
            class="btn btn-xs btn-circle btn-primary"
            @click.stop="decrement(false)"
            :title="'Retirer un exemplaire normal'"
          >
            -
          </button>
          <span class="w-6 text-center font-bold">{{ normalQuantity }}</span>
          <button
            class="btn btn-xs btn-circle btn-primary"
            @click.stop="increment(false)"
            :title="'Ajouter un exemplaire normal'"
          >
            +
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium min-w-[4rem]">Foil</span>
        <div class="flex items-center gap-1">
          <button
            class="btn btn-xs btn-circle btn-secondary"
            @click.stop="decrement(true)"
            :title="'Retirer un exemplaire foil'"
          >
            -
          </button>
          <span class="w-6 text-center font-bold">{{ foilQuantity }}</span>
          <button
            class="btn btn-xs btn-circle btn-secondary"
            @click.stop="increment(true)"
            :title="'Ajouter un exemplaire foil'"
          >
            +
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '@/types/cards'
import { useCardStore } from '@/stores/cardStore'

/**
 * Props du composant
 * @typedef {Object} Props
 * @property {Card} card - La carte à gérer dans la collection
 */
const props = defineProps<{
  card: Card
}>()

const cardStore = useCardStore()

/**
 * Nombre d'exemplaires normaux de la carte dans la collection
 * @type {import('vue').ComputedRef<number>}
 */
const normalQuantity = computed(() => cardStore.getCardQuantity(props.card.id))

/**
 * Nombre d'exemplaires foil de la carte dans la collection
 * @type {import('vue').ComputedRef<number>}
 */
const foilQuantity = computed(() =>
  cardStore.getFoilCardQuantity(props.card.id)
)

/**
 * Incrémente la quantité d'exemplaires d'une carte
 * @param {boolean} isFoil - True si l'exemplaire est foil, false sinon
 */
function increment(isFoil: boolean) {
  cardStore.addToCollection(props.card, 1, isFoil)
}

/**
 * Décrémente la quantité d'exemplaires d'une carte
 * @param {boolean} isFoil - True si l'exemplaire est foil, false sinon
 */
function decrement(isFoil: boolean) {
  cardStore.removeFromCollection(props.card, 1, isFoil)
}
</script>

<style scoped>
.btn-xs {
  @apply min-h-0 h-6 w-6;
}

.collection-controls {
  backdrop-filter: blur(4px);
}
</style>
