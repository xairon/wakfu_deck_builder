<template>
  <div class="deck-card-item bg-base-100 rounded-lg shadow-md overflow-hidden">
    <div class="flex items-center p-2">
      <!-- Image de la carte (miniature) -->
      <div class="relative w-12 h-12 mr-3 flex-shrink-0">
        <img
          :src="card.imageUrl || getDefaultCardImage()"
          :alt="card.name"
          class="w-full h-full object-cover rounded"
          @error="onImageError"
        />
        <div
          class="absolute top-0 left-0 w-full h-full"
          :class="getElementClass(getCardElement())"
        ></div>
      </div>

      <!-- Informations de la carte -->
      <div class="flex-grow min-w-0">
        <div class="flex justify-between items-start">
          <h3 class="font-medium text-sm truncate" :title="card.name">
            {{ card.name }}
          </h3>
          <div class="badge badge-sm" :class="getRarityClass(card.rarity)">
            {{ card.rarity.substring(0, 1) }}
          </div>
        </div>
        <div class="flex justify-between items-center mt-1">
          <div class="flex items-center text-xs">
            <span class="opacity-70 mr-2">{{ card.mainType }}</span>
            <span
              v-if="card.stats?.pa !== undefined"
              class="badge badge-sm badge-primary"
            >
              {{ card.stats.pa }} PA
            </span>
          </div>

          <!-- Contrôles de quantité -->
          <div class="flex items-center">
            <button
              v-if="showQuantityControls && quantity > 1"
              class="btn btn-xs btn-circle btn-ghost"
              @click="emitDecrement"
            >
              -
            </button>
            <span class="mx-1 text-sm font-medium">{{ quantity }}x</span>
            <button
              v-if="showQuantityControls && quantity < 3"
              class="btn btn-xs btn-circle btn-ghost"
              @click="emitIncrement"
            >
              +
            </button>
            <button
              class="btn btn-xs btn-circle btn-ghost text-error ml-1"
              @click="emitRemove"
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed, ref } from 'vue'
import type { Card } from '@/types/cards'

// Interface des props
interface Props {
  card: Card
  quantity: number
  showQuantityControls?: boolean
}

// Définir les props avec valeurs par défaut
const props = defineProps<Props>()

// Émission d'événements
const emit = defineEmits<{
  (e: 'remove', cardId: string): void
  (e: 'increment', cardId: string): void
  (e: 'decrement', cardId: string): void
}>()

// État pour le suivi des erreurs d'image
const hasImageError = ref(false)

// Gestion des erreurs d'image
function onImageError() {
  console.error(`Erreur de chargement d'image pour la carte: ${props.card.id}`)
  hasImageError.value = true
}

// Déterminer si les contrôles de quantité doivent être affichés
const showQuantityControls = computed(() => {
  console.log('Card in DeckCardItem:', props.card)
  console.log('Card imageUrl:', props.card.imageUrl)

  // Par défaut true sauf pour les cartes spéciales (Héros, Havre-sac)
  return (
    props.showQuantityControls !== false &&
    props.card.mainType !== 'Héros' &&
    props.card.mainType !== 'Havre-Sac'
  )
})

// Image par défaut
function getDefaultCardImage() {
  return '/images/card-back.png'
}

// Obtenir l'élément de la carte
function getCardElement() {
  // Vérifier toutes les sources possibles d'élément
  return (
    props.card.stats?.niveau?.element ||
    props.card.stats?.force?.element ||
    'Neutre'
  )
}

// Classes pour les éléments
function getElementClass(element: string) {
  const classes = {
    Feu: 'border-l-4 border-red-500',
    Eau: 'border-l-4 border-blue-500',
    Terre: 'border-l-4 border-amber-700',
    Air: 'border-l-4 border-emerald-500',
    Neutre: 'border-l-4 border-gray-500',
  }

  return classes[element] || classes['Neutre']
}

// Classes pour les raretés
function getRarityClass(rarity: string) {
  const classes = {
    Commune: 'badge-secondary',
    'Peu Commune': 'badge-primary',
    Rare: 'badge-accent',
    Mythique: 'badge-warning',
    Légendaire: 'badge-error',
  }

  return classes[rarity] || 'badge-secondary'
}

// Méthodes pour émettre les événements
function emitRemove() {
  emit('remove', props.card.id)
}

function emitIncrement() {
  emit('increment', props.card.id)
}

function emitDecrement() {
  emit('decrement', props.card.id)
}
</script>

<style scoped>
.deck-card-item {
  transition: all 0.2s ease-in-out;
}

.deck-card-item:hover {
  transform: translateX(2px);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
</style>
