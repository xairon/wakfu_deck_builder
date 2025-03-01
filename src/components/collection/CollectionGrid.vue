<template>
  <div>
    <!-- Message si aucune carte -->
    <div v-if="validCards.length === 0" class="flex flex-col items-center justify-center py-12">
      <div class="text-center">
        <h3 class="text-xl font-bold">Aucune carte trouvée</h3>
        <p class="text-base-content/70 mt-2">Essayez de modifier vos filtres</p>
      </div>
    </div>

    <!-- Grille de cartes avec virtualisation simple -->
    <div v-else class="cards-grid-container relative" ref="gridContainer">
      <!-- Indication de chargement -->
      <div v-if="isLoading" class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <!-- Grille virtualisée -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4 cards-grid">
        <div 
          v-for="card in visibleCards" 
          :key="card.id" 
          class="card-wrapper w-full h-auto min-w-[180px] relative"
        >
          <CollectionCardItem 
            :card="card"
            :quantity="getCardQuantity(card.id)"
            :foil-quantity="getFoilCardQuantity(card.id)"
            @update-quantity="handleQuantityUpdate"
            @select-card="handleCardSelect"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Composant pour afficher une grille de cartes de la collection
 * Avec virtualisation simple pour améliorer les performances
 */
import { defineProps, defineEmits, computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useCardStore } from '@/stores/cardStore'
import { useWindowScroll, useThrottleFn } from '@vueuse/core'
import CollectionCardItem from './CollectionCardItem.vue'
import type { Card } from '@/types/cards'

// Définition des props
interface Props {
  filteredCards: { card: Card, quantity: number, foilQuantity: number }[]
}

const props = defineProps<Props>()

// Définition des émissions d'événements
const emit = defineEmits<{
  (e: 'update-quantity', card: Card, quantity: number, isFoil: boolean): void;
  (e: 'select-card', card: Card): void;
}>()

// Store
const cardStore = useCardStore()

// État pour la virtualisation
const isLoading = ref(false)
const gridContainer = ref<HTMLElement | null>(null)
const { y: scrollY } = useWindowScroll()
const pageSize = ref(30) // Nombre de cartes à afficher par "page"
const currentPage = ref(0)

// Computed - ensure we only use valid cards
const validCards = computed(() => {
  console.log('📌 DEBUG CollectionGrid - Input reçu:', props.filteredCards.length, 'cartes');
  
  if (!props.filteredCards || !Array.isArray(props.filteredCards)) {
    console.error('❌ DEBUG CollectionGrid - filteredCards is not an array:', props.filteredCards);
    return [];
  }

  const extractedCards = props.filteredCards
    .filter(item => item && item.card && item.card.id && item.card.name)
    .map(item => item.card);
  
  console.log('✅ DEBUG CollectionGrid - Cartes valides extraites:', extractedCards.length);
  return extractedCards;
});

// Cartes visibles en fonction de la page actuelle
const visibleCards = computed(() => {
  const endIdx = (currentPage.value + 1) * pageSize.value;
  return validCards.value.slice(0, endIdx);
});

// Charger plus de cartes quand on scroll
const loadMoreCards = useThrottleFn(() => {
  const scrollPosition = window.scrollY;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;
  
  // Si on approche du bas de la page (300px avant la fin)
  if (documentHeight - (scrollPosition + windowHeight) < 300 && validCards.value.length > visibleCards.value.length) {
    isLoading.value = true;
    
    // Simuler un petit délai pour éviter de bloquer le thread principal
    setTimeout(() => {
      currentPage.value++;
      isLoading.value = false;
    }, 50);
  }
}, 100);

// Surveiller le scroll pour charger plus de cartes
watch(scrollY, () => {
  loadMoreCards();
});

// Surveiller les changements de filtres pour réinitialiser la pagination
watch(() => props.filteredCards, () => {
  currentPage.value = 0;
}, { deep: true });

// Setup des écouteurs d'événements
onMounted(() => {
  console.log('📦 DEBUG CollectionGrid - Composant monté, cartes reçues:', props.filteredCards.length);
  window.addEventListener('scroll', loadMoreCards);
  // Charger les premières cartes
  loadMoreCards();
});

onUnmounted(() => {
  window.removeEventListener('scroll', loadMoreCards);
});

// Méthodes
function getCardQuantity(cardId: string): number {
  if (!cardId) return 0;
  return cardStore.getCardQuantity(cardId)
}

function getFoilCardQuantity(cardId: string): number {
  if (!cardId) return 0;
  return cardStore.getFoilCardQuantity(cardId)
}

// Gestion des mises à jour de quantité
function handleQuantityUpdate(cardId: string, quantity: number, isFoil: boolean) {
  if (!cardId) return;
  const card = props.filteredCards.find(item => item.card.id === cardId)?.card;
  if (card) {
    emit('update-quantity', card, quantity, isFoil);
  }
}

// Gestion de la sélection de carte
function handleCardSelect(card: Card) {
  if (!card || !card.id) {
    console.error('❌ CollectionGrid: Tentative de sélection d\'une carte invalide', card);
    return;
  }
  console.log('🔍 CollectionGrid: Transmission de sélection de carte', card.name, card.id);
  emit('select-card', card);
}
</script>

<style scoped>
.card-wrapper {
  height: auto;
  transition: all 0.2s ease;
  overflow: visible;
  padding: 8px;
  transform-style: preserve-3d;
}

/* Styles pour la grille de cartes */
.cards-grid {
  overflow: visible;
  width: 100%;
  padding-bottom: 20px;
}

.cards-grid-container {
  min-height: 50vh;
}

@media (min-width: 1600px) {
  .cards-grid {
    max-width: 1500px;
    margin: 0 auto;
  }
}
</style> 