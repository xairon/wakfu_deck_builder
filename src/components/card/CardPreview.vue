<template>
  <div 
    class="card-preview relative group"
    :class="[sizeClass, { 'cursor-pointer': interactive }]"
    @click="handleClick"
  >
    <!-- Image de la carte -->
    <img
      :src="imageUrl"
      :alt="card.name"
      class="rounded-lg object-cover w-full h-full"
      :class="{ 'group-hover:opacity-90 transition-opacity': interactive }"
      loading="lazy"
    >

    <!-- Overlay d'informations -->
    <div 
      v-if="showOverlay"
      class="absolute inset-0 bg-base-300/80 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col"
    >
      <h4 class="font-bold text-sm">{{ card.name }}</h4>
      <p class="text-xs opacity-70">{{ card.mainType }}</p>
      
      <div class="mt-auto">
        <!-- Stats -->
        <div v-if="hasStats" class="flex gap-2 text-xs">
          <span v-if="stats.cost">
            <span class="i-carbon-money"></span> {{ stats.cost }}
          </span>
          <span v-if="stats.power">
            <span class="i-carbon-flash"></span> {{ stats.power }}
          </span>
          <span v-if="stats.health">
            <span class="i-carbon-heart"></span> {{ stats.health }}
          </span>
        </div>

        <!-- Éléments -->
        <div v-if="hasElements" class="flex gap-1 mt-1">
          <div 
            v-for="element in elements" 
            :key="element"
            class="w-4 h-4 rounded-full"
            :class="getElementColor(element)"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '@/types/cards'
import { ELEMENT_COLORS, type Element } from '@/constants'

const props = defineProps<{
  card: Card
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  showOverlay?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', card: Card): void
}>()

// Classes de taille
const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'w-12 h-16'
    case 'lg':
      return 'w-48 h-64'
    default:
      return 'w-24 h-32'
  }
})

// URL de l'image
const imageUrl = computed(() => {
  return `/images/cards/${props.card.id}.webp`
})

// Stats
const hasStats = computed(() => 
  'stats' in props.card && props.card.stats !== undefined
)

const stats = computed(() => {
  if (!hasStats.value) return {}
  return props.card.stats
})

// Éléments
const hasElements = computed(() => 
  'elements' in props.card && Array.isArray(props.card.elements)
)

const elements = computed(() => {
  if (!hasElements.value) return []
  return props.card.elements
})

// Gestion des clics
function handleClick() {
  if (props.interactive) {
    emit('click', props.card)
  }
}

// Utilitaires
function getElementColor(element: string): string {
  return ELEMENT_COLORS[element as Element] || 'bg-primary'
}
</script>

<style scoped>
.card-preview {
  aspect-ratio: 2/3;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style> 