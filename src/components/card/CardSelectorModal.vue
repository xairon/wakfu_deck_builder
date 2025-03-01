<template>
  <div v-if="isOpen">
    <div class="modal modal-open">
      <div class="modal-box w-11/12 max-w-5xl max-h-screen overflow-y-auto">
        <h3 class="font-bold text-lg mb-4">Sélection de cartes</h3>
        
        <!-- Filtres -->
        <div class="flex flex-wrap gap-2 mb-4">
          <!-- Recherche -->
          <div class="form-control flex-1 min-w-[300px]">
            <div class="input-group w-full">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Rechercher..."
                class="input input-bordered w-full"
              />
              <button class="btn btn-square">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Extension -->
          <select v-model="selectedExtension" class="select select-bordered min-w-[180px]">
            <option value="">Toutes les extensions</option>
            <option v-for="extension in extensions" :key="extension" :value="extension">
              {{ extension }}
            </option>
          </select>

          <!-- Type -->
          <select v-model="selectedType" class="select select-bordered min-w-[150px]">
            <option value="">Tous les types</option>
            <option v-for="type in mainTypes" :key="type" :value="type">
              {{ type }}
            </option>
          </select>

          <!-- Element -->
          <select v-model="selectedElement" class="select select-bordered min-w-[150px]">
            <option value="">Tous les éléments</option>
            <option v-for="element in elements" :key="element" :value="element">
              {{ element }}
            </option>
          </select>
          
          <!-- Collection uniquement -->
          <div class="form-control">
            <label class="label cursor-pointer gap-2">
              <span class="label-text">Collection uniquement</span> 
              <input 
                type="checkbox" 
                v-model="onlyCollection" 
                class="toggle toggle-primary"
                :disabled="collectionOnly" 
              />
            </label>
          </div>
        </div>

        <!-- Cartes -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          <div 
            v-for="cardData in filteredCards" 
            :key="cardData.card.id" 
            class="card compact bg-base-200 shadow-sm hover:shadow-md cursor-pointer transition-all"
            @click="selectCard(cardData.card)"
          >
            <div class="card-body p-2">
              <div class="flex items-center gap-2">
                <div class="w-20 h-20 flex-shrink-0">
                  <OptimizedImage
                    :src="getCardImageUrl(cardData.card)"
                    :alt="cardData.card.name"
                    class="w-full h-full object-contain"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-bold text-sm leading-tight truncate">{{ cardData.card.name }}</h4>
                  <p class="text-xs opacity-70">{{ cardData.card.mainType }}</p>
                  
                  <div class="flex items-center justify-between mt-1">
                    <!-- Statut dans le deck -->
                    <div v-if="getCardInDeck(cardData.card.id)" class="badge badge-primary badge-sm">
                      {{ getCardDeckCount(cardData.card.id) }} dans le deck
                    </div>
                    
                    <!-- Quantité dans la collection -->
                    <div class="flex items-center gap-1 text-xs">
                      <span>Collection:</span>
                      <span 
                        class="font-semibold"
                        :class="{'text-error': cardData.quantity === 0 && onlyCollection}"
                      >
                        {{ cardData.quantity }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Aucune carte trouvée -->
        <div v-if="filteredCards.length === 0" class="alert alert-info mt-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Aucune carte ne correspond à vos critères. Essayez de modifier vos filtres.</span>
        </div>

        <!-- Actions -->
        <div class="modal-action">
          <button class="btn" @click="closeModal">Fermer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useCardStore } from '@/stores/cardStore';
import { useToast } from '@/composables/useToast';
import type { Card } from '@/types/card';
import OptimizedImage from '@/components/common/OptimizedImage.vue';

const props = defineProps<{
  isOpen: boolean;
  collectionOnly?: boolean;
  deckCards?: Array<{ card: Card; quantity: number; isReserve?: boolean }>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', card: Card): void;
}>();

const cardStore = useCardStore();
const toast = useToast();

// État local
const searchQuery = ref('');
const selectedExtension = ref('');
const selectedType = ref('');
const selectedElement = ref('');
const onlyCollection = ref(props.collectionOnly ?? false);

// Computed
const extensions = computed(() => cardStore.getExtensions);
const mainTypes = computed(() => cardStore.getMainTypes);
const elements = computed(() => cardStore.getElements);

const allCards = computed(() => {
  const allCardsWithQuantity = cardStore.getAllCards.map(card => ({
    card,
    quantity: cardStore.getCardQuantity(card.id) ?? 0
  }));
  return allCardsWithQuantity;
});

const filteredCards = computed(() => {
  return allCards.value.filter(cardData => {
    const card = cardData.card;
    
    // Filtre de collection
    if (onlyCollection.value && cardData.quantity === 0) {
      return false;
    }
    
    // Filtres textuels
    if (
      searchQuery.value && 
      !card.name.toLowerCase().includes(searchQuery.value.toLowerCase()) &&
      !card.effect?.toLowerCase().includes(searchQuery.value.toLowerCase())
    ) {
      return false;
    }
    
    // Filtre par extension
    if (selectedExtension.value && card.extension !== selectedExtension.value) {
      return false;
    }
    
    // Filtre par type
    if (selectedType.value && card.mainType !== selectedType.value) {
      return false;
    }
    
    // Filtre par élément
    if (selectedElement.value && card.element !== selectedElement.value) {
      return false;
    }
    
    return true;
  });
});

// Méthodes
function getCardImageUrl(card: Card): string {
  const basePath = '/images/cards';
  const filename = card.id;
  return `${basePath}/${filename}.png`;
}

function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = '/images/card-back.png';
  console.error(`Erreur de chargement d'image: ${target.alt}`);
}

function closeModal() {
  emit('close');
}

function selectCard(card: Card) {
  // Vérifier si la carte est dans la collection si le mode collection est activé
  if (onlyCollection.value && cardStore.getCardQuantity(card.id) === 0) {
    toast.error('Cette carte n\'est pas dans votre collection');
    return;
  }
  
  emit('select', card);
}

function getCardInDeck(cardId: string) {
  if (!props.deckCards) return null;
  return props.deckCards.find(c => c.card.id === cardId);
}

function getCardDeckCount(cardId: string) {
  if (!props.deckCards) return 0;
  const cardInDeck = props.deckCards.find(c => c.card.id === cardId);
  return cardInDeck ? cardInDeck.quantity : 0;
}

// Surveiller les changements de props
watch(() => props.collectionOnly, (newValue) => {
  if (newValue !== undefined) {
    onlyCollection.value = newValue;
  }
});
</script>

<style scoped>
.modal-box {
  @apply max-w-5xl;
}
</style> 