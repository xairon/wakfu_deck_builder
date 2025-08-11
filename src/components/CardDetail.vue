<template>
  <div class="card-detail">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Image de la carte -->
      <div class="relative aspect-[2/3] bg-base-200 rounded-lg overflow-hidden">
        <img
          :src="card.imageUrl || getDefaultCardImage()"
          :alt="card.name"
          class="w-full h-full object-contain"
          @error="handleImageError"
        />

        <!-- Overlay d'élément -->
        <div
          class="absolute bottom-0 left-0 right-0 h-2"
          :class="getElementClass(getCardElement())"
        ></div>
      </div>

      <!-- Informations de la carte -->
      <div class="flex flex-col gap-4">
        <div class="flex justify-between items-start">
          <h2 class="text-2xl font-bold">{{ card.name }}</h2>
          <div class="badge" :class="getRarityClass(card.rarity)">
            {{ card.rarity }}
          </div>
        </div>

        <div class="stats shadow">
          <div class="stat">
            <div class="stat-title">Type</div>
            <div class="stat-value text-lg">{{ card.mainType }}</div>
            <div
              v-if="card.subTypes && card.subTypes.length > 0"
              class="stat-desc"
            >
              {{ card.subTypes.join(', ') }}
            </div>
          </div>

          <div v-if="card.class" class="stat">
            <div class="stat-title">Classe</div>
            <div class="stat-value text-lg">{{ card.class }}</div>
          </div>

          <!-- Élément (depuis les stats) -->
          <div v-if="getCardElement() !== 'Neutre'" class="stat">
            <div class="stat-title">Élément</div>
            <div class="stat-value text-lg">{{ getCardElement() }}</div>
          </div>
        </div>

        <!-- Statistiques de la carte -->
        <div v-if="card.stats" class="flex flex-wrap gap-2">
          <div
            v-if="card.stats.pa !== undefined"
            class="badge badge-lg badge-primary"
          >
            {{ card.stats.pa }} PA
          </div>
          <div
            v-if="card.stats.pm !== undefined"
            class="badge badge-lg badge-secondary"
          >
            {{ card.stats.pm }} PM
          </div>
          <div
            v-if="card.stats.pv !== undefined"
            class="badge badge-lg badge-accent"
          >
            {{ card.stats.pv }} PV
          </div>
          <div
            v-if="card.stats.niveau?.value !== undefined"
            class="badge badge-lg badge-info"
          >
            Niv. {{ card.stats.niveau.value }}
          </div>
          <div
            v-if="card.stats.force?.value !== undefined"
            class="badge badge-lg badge-warning"
          >
            Force {{ card.stats.force.value }}
          </div>
        </div>

        <!-- Description de la carte -->
        <div v-if="card.description" class="bg-base-200 p-4 rounded-lg">
          <div class="text-sm whitespace-pre-line">{{ card.description }}</div>
        </div>



        <!-- Action d'ajout au deck -->
        <div v-if="enableAddToDeck" class="mt-4">
          <button
            class="btn btn-primary w-full"
            @click="addToDeck"
            :disabled="cardQuantity.normal === 0 && cardQuantity.foil === 0"
          >
            Ajouter au deck
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed } from 'vue'
import { useCardStore } from '@/stores/cardStore'
import type { Card } from '@/types/cards'

interface Props {
  card: Card
  enableAddToDeck?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  enableAddToDeck: false,
})

const emit = defineEmits<{
  (e: 'add-to-deck', card: Card): void
}>()

const cardStore = useCardStore()

// Quantité dans la collection
const cardQuantity = computed(() => {
  return cardStore.getCardQuantity(props.card.id) || { normal: 0, foil: 0 }
})

// Image par défaut en cas d'erreur
function getDefaultCardImage() {
  return '/images/card-back.png'
}

// Gestion des erreurs d'image
function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement
  target.src = getDefaultCardImage()
}

// Classes pour les éléments
function getElementClass(element: string) {
  const classes = {
    Feu: 'bg-red-500',
    Eau: 'bg-blue-500',
    Terre: 'bg-amber-700',
    Air: 'bg-emerald-500',
    Neutre: 'bg-gray-500',
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

// Déterminer l'élément de la carte
function getCardElement(): string {
  return (
    props.card.stats?.niveau?.element ||
    props.card.stats?.force?.element ||
    'Neutre'
  )
}

// Ajouter au deck
function addToDeck() {
  emit('add-to-deck', props.card)
}
</script>

<style scoped>
.card-detail {
  max-width: 100%;
}
</style>
