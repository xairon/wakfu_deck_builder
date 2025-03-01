<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    @click.self="$emit('close')"
  >
    <div class="modal-box max-w-2xl w-full">
      <!-- En-tête -->
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">{{ card?.name }}</h2>
        <button
          class="btn btn-ghost btn-sm"
          @click="$emit('close')"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Contenu -->
      <div v-if="card" class="flex gap-4">
        <!-- Image de la carte -->
        <div class="w-1/3">
          <CardComponent
            :card="card"
            :interactive="false"
          />
        </div>

        <!-- Détails -->
        <div class="w-2/3 space-y-4">
          <!-- Type et extension -->
          <div class="flex gap-2">
            <div class="badge badge-primary">{{ card.mainType || card.type }}</div>
            <div class="badge badge-secondary">
              {{ typeof card.extension === 'string' ? card.extension : card.extension.name }}
            </div>
          </div>

          <!-- Stats -->
          <div v-if="displayedStats" class="stats stats-vertical shadow w-full">
            <div v-if="displayedStats.niveau" class="stat">
              <div class="stat-title">Niveau</div>
              <div class="stat-value">
                <StatWithElement 
                  :value="displayedStats.niveau.value"
                  :element="displayedStats.niveau.element"
                />
              </div>
            </div>
            <div v-if="displayedStats.force" class="stat">
              <div class="stat-title">Force</div>
              <div class="stat-value">
                <StatWithElement 
                  :value="displayedStats.force.value"
                  :element="displayedStats.force.element"
                />
              </div>
            </div>
            <div v-if="displayedStats.pa" class="stat">
              <div class="stat-title">PA</div>
              <div class="stat-value">{{ displayedStats.pa }}</div>
            </div>
            <div v-if="displayedStats.pm" class="stat">
              <div class="stat-title">PM</div>
              <div class="stat-value">{{ displayedStats.pm }}</div>
            </div>
            <div v-if="displayedStats.pv" class="stat">
              <div class="stat-title">PV</div>
              <div class="stat-value">{{ displayedStats.pv }}</div>
            </div>
          </div>

          <!-- Mots-clés -->
          <div v-if="card.keywords?.length" class="space-y-2">
            <h3 class="font-semibold">Mots-clés</h3>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="keyword in card.keywords"
                :key="keyword.name"
                class="badge badge-outline"
                :title="keyword.description"
              >
                {{ keyword.name }}
                <span 
                  v-if="keyword.elements?.length" 
                  class="ml-1 flex items-center gap-1"
                >
                  <ElementIcon 
                    v-for="element in keyword.elements" 
                    :key="element"
                    :element="element"
                    size="sm"
                  />
                </span>
              </div>
            </div>
          </div>

          <!-- Effets -->
          <div v-if="card.effects?.length" class="space-y-2">
            <h3 class="font-semibold">Effets</h3>
            <div class="space-y-2">
              <p
                v-for="(effect, index) in card.effects"
                :key="index"
                class="text-sm"
              >
                {{ typeof effect === 'string' ? effect : effect.description }}
              </p>
            </div>
          </div>

          <!-- Citation -->
          <div v-if="card.flavor" class="mt-4 text-sm italic text-base-content/70">
            {{ card.flavor.text }}
            <span v-if="card.flavor.attribution">- {{ card.flavor.attribution }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUpdated, watch } from 'vue'
import type { Card } from '@/types/cards'
import CardComponent from './CardComponent.vue'
import StatWithElement from '@/components/elements/StatWithElement.vue'
import ElementIcon from '@/components/elements/ElementIcon.vue'
import { ELEMENTS, type Element } from '@/services/elementService'

const props = defineProps<{
  card: Card | null
  isOpen: boolean
}>()

defineEmits<{
  (e: 'close'): void
}>()

// Logs du cycle de vie
onMounted(() => {
  console.log('🔍 CardDetailsModal - onMounted:', {
    isOpen: props.isOpen,
    card: props.card
  })
})

onUpdated(() => {
  console.log('🔍 CardDetailsModal - onUpdated:', {
    isOpen: props.isOpen,
    card: props.card
  })
})

watch(() => props.isOpen, (newValue, oldValue) => {
  console.log('🔍 CardDetailsModal - watch isOpen:', {
    old: oldValue,
    new: newValue,
    card: props.card
  })
})

watch(() => props.card, (newValue, oldValue) => {
  console.log('🔍 CardDetailsModal - watch card:', {
    old: oldValue,
    new: newValue,
    isOpen: props.isOpen
  })
}, { deep: true })
</script>

<style scoped>
.modal-box {
  @apply bg-base-100 rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto;
}

.stat-box {
  @apply bg-base-200 p-2 rounded-lg flex justify-between items-center;
}

.stat-label {
  @apply text-sm text-base-content/70;
}

.stat-value {
  @apply font-semibold;
}

.element-icon {
  @apply inline-block;
}
</style> 