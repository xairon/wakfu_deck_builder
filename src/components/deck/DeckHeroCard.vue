<template>
  <div class="hero-card bg-base-100 rounded-lg shadow-md overflow-hidden">
    <div class="flex p-2">
      <!-- Image du héros -->
      <div class="relative w-16 h-16 mr-3 flex-shrink-0">
        <img
          :src="hero.imageUrl || getDefaultHeroImage()"
          :alt="hero.name"
          class="w-full h-full object-cover rounded"
        />
        <div
          class="absolute top-0 left-0 w-full h-full"
          :class="getElementClass(hero.element || 'Neutre')"
        ></div>
      </div>

      <!-- Informations du héros -->
      <div class="flex-grow min-w-0">
        <div class="flex justify-between items-start">
          <h3 class="font-medium truncate" :title="hero.name">
            {{ hero.name }}
          </h3>
          <div class="badge" :class="getRarityClass(hero.rarity)">
            {{ hero.rarity.substring(0, 1) }}
          </div>
        </div>

        <div class="text-xs opacity-70 mb-1">
          <span>{{ hero.class }}</span>
          <span v-if="hero.element" class="ml-1">({{ hero.element }})</span>
        </div>

        <!-- Statistiques du héros -->
        <div class="flex flex-wrap gap-2 mt-1">
          <div
            v-if="hero.stats?.ap !== undefined"
            class="badge badge-sm badge-primary"
          >
            {{ hero.stats.ap }} PA
          </div>
          <div
            v-if="hero.stats?.mp !== undefined"
            class="badge badge-sm badge-secondary"
          >
            {{ hero.stats.mp }} PM
          </div>
          <div
            v-if="hero.stats?.hp !== undefined"
            class="badge badge-sm badge-accent"
          >
            {{ hero.stats.hp }} PV
          </div>
        </div>
      </div>

      <!-- Bouton de suppression -->
      <button
        class="btn btn-sm btn-circle btn-ghost text-error self-start ml-2"
        @click="$emit('remove')"
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

    <!-- Description et capacités du héros (optionnel) -->
    <div v-if="hero.description" class="px-3 pb-3 pt-0">
      <div class="text-xs opacity-80 bg-base-200 p-2 rounded">
        {{ hero.description }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import type { Card } from '@/types/cards'

// Interface des props
interface Props {
  hero: Card
}

// Définir les props
const props = defineProps<Props>()

// Émission d'événements
defineEmits<{
  (e: 'remove'): void
}>()

// Image par défaut
function getDefaultHeroImage() {
  return '/images/hero-back.png'
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
</script>

<style scoped>
.hero-card {
  transition: all 0.2s ease-in-out;
}

.hero-card:hover {
  transform: translateX(2px);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
</style>
