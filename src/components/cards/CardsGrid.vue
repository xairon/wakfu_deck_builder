<template>
  <div>
    <div 
      v-if="filteredCards.length > 0"
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
    >
      <CardDisplay
        v-for="card in filteredCards"
        :key="card.id"
        :card="card"
        :show-quantity="true"
        :quantity="getCardQuantity(card.id)"
        :class="{ 'opacity-50 hover:opacity-90 transition-opacity': getCardQuantity(card.id) === 0 }"
        @click="$emit('select-card', card)"
        @image-error="handleImageError"
      />
    </div>

    <!-- Message si aucune carte -->
    <div 
      v-else 
      class="text-center py-8"
    >
      <h3 class="text-xl font-bold mb-2">Aucune carte trouvée</h3>
      <p class="text-base-content/60">
        Essayez de modifier vos critères de recherche
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import type { Card } from '@/types/cards';
import { useCardStore } from '@/stores/cardStore';
import { useToast } from '@/composables/useToast';
import CardDisplay from '@/components/card/CardDisplay.vue';

const props = defineProps<{
  filteredCards: Card[]
}>();

const emit = defineEmits<{
  (e: 'select-card', card: Card): void
}>();

const cardStore = useCardStore();
const toast = useToast();

function getCardQuantity(cardId: string): number {
  const found = cardStore.collection.find(({ card }) => card.id === cardId);
  return found?.quantity || 0;
}

function handleImageError(card: Card) {
  console.error(`Erreur de chargement de l'image pour ${card.name}`);
  toast.error(`Impossible de charger l'image de ${card.name}`);
}
</script> 