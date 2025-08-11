<template>
  <TransitionRoot appear :show="isOpen" as="template">
    <Dialog as="div" class="relative z-50" @close="onClose">
      <!-- Overlay -->
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/75" />
      </TransitionChild>

      <!-- Modal -->
      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel
              class="relative w-full max-w-4xl rounded-lg bg-base-100 shadow-xl"
            >
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                <!-- Image de la carte -->
                <div
                  class="relative aspect-[2/3] bg-base-200 rounded-lg overflow-hidden"
                >
                  <img
                    :src="getImagePath"
                    :alt="card.name"
                    class="w-full h-full object-contain transform transition-transform duration-500 hover:scale-110"
                    @error="handleImageError"
                  />

                  <!-- Overlay de rareté -->
                  <div
                    class="absolute bottom-0 left-0 right-0 h-1"
                    :class="rarityClass"
                  ></div>
                </div>

                <!-- Informations de la carte -->
                <div class="space-y-6">
                  <div>
                    <DialogTitle as="h3" class="text-2xl font-bold mb-2">
                      {{ card.name }}
                    </DialogTitle>
                    <div class="flex flex-wrap gap-2">
                      <span class="badge badge-lg" :class="typeClass">
                        {{ card.mainType }}
                      </span>
                      <span
                        v-if="getCardElement()"
                        class="badge badge-lg badge-outline"
                      >
                        {{ getCardElement() }}
                      </span>
                      <span class="badge badge-lg" :class="rarityBadgeClass">
                        {{ card.rarity }}
                      </span>
                    </div>
                  </div>

                  <!-- Statistiques -->
                  <div v-if="hasStats" class="stats shadow">
                    <div v-if="card.stats.health" class="stat">
                      <div class="stat-title">Points de vie</div>
                      <div class="stat-value text-error">
                        {{ card.stats.health }}
                      </div>
                    </div>
                    <div v-if="card.stats.power" class="stat">
                      <div class="stat-title">Points d'action</div>
                      <div class="stat-value text-warning">
                        {{ card.stats.power }}
                      </div>
                    </div>
                    <div v-if="card.stats.movement" class="stat">
                      <div class="stat-title">Points de mouvement</div>
                      <div class="stat-value text-info">
                        {{ card.stats.movement }}
                      </div>
                    </div>
                  </div>

                  <!-- Effets -->
                  <div v-if="card.effects.length > 0" class="space-y-2">
                    <h4 class="font-semibold">Effets</h4>
                    <ul class="space-y-2">
                      <li
                        v-for="(effect, index) in card.effects"
                        :key="index"
                        class="flex items-start gap-2 p-2 bg-base-200 rounded"
                      >
                        <span class="i-carbon-flash-filled mt-1"></span>
                        <span>{{ effect }}</span>
                      </li>
                    </ul>
                  </div>

                  <!-- Mots-clés -->
                  <div v-if="card.keywords.length > 0" class="space-y-2">
                    <h4 class="font-semibold">Mots-clés</h4>
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="keyword in card.keywords"
                        :key="keyword"
                        class="badge badge-outline"
                      >
                        {{ keyword }}
                      </span>
                    </div>
                  </div>

                  <!-- Notes -->
                  <div v-if="card.notes.length > 0" class="space-y-2">
                    <h4 class="font-semibold">Notes</h4>
                    <div class="p-2 bg-base-200 rounded text-sm">
                      {{ card.notes.join(' ') }}
                    </div>
                  </div>

                  <!-- Collection -->
                  <div class="space-y-4">
                    <h4 class="font-semibold">Collection</h4>
                    <div class="flex items-center gap-4">
                      <div class="flex items-center gap-2">
                        <button
                          class="btn btn-circle btn-sm"
                          :disabled="quantity === 0"
                          @click="updateQuantity(-1)"
                        >
                          <span class="i-carbon-subtract"></span>
                        </button>
                        <span class="text-xl font-bold w-8 text-center">{{
                          quantity
                        }}</span>
                        <button
                          class="btn btn-circle btn-sm"
                          @click="updateQuantity(1)"
                        >
                          <span class="i-carbon-add"></span>
                        </button>
                      </div>
                      <div class="flex-1">
                        <div
                          class="progress-wrapper h-2 bg-base-200 rounded-full overflow-hidden"
                        >
                          <div
                            class="progress-bar h-full bg-primary transition-all duration-300"
                            :style="{
                              width: `${(quantity / maxQuantity) * 100}%`,
                            }"
                          ></div>
                        </div>
                        <div class="text-xs text-base-content/70 mt-1">
                          {{ quantity }}/{{ maxQuantity }} exemplaires
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Informations supplémentaires -->
                  <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span class="text-base-content/70">Extension</span>
                      <p>{{ cardExtension }}</p>
                    </div>
                    <div>
                      <span class="text-base-content/70">Numéro</span>
                      <p>{{ cardNumber }}</p>
                    </div>
                    <div>
                      <span class="text-base-content/70">Artiste</span>
                      <p>{{ cardArtist }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div
                class="flex items-center justify-end gap-2 bg-base-200 px-6 py-4 rounded-b-lg"
              >
                <button class="btn" @click="onClose">Fermer</button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  TransitionRoot,
  TransitionChild,
  Dialog,
  DialogPanel,
  DialogTitle,
} from '@headlessui/vue'
import type { Card, HeroCard } from '@/types/cards'
import { useCardStore } from '@/stores/cardStore'
import { useToast } from '@/composables/useToast'
import { isHeroCard } from '@/types/cards'

const props = defineProps<{
  card: Card
  isOpen: boolean
  quantity: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:quantity', value: number): void
}>()

const cardStore = useCardStore()
const toast = useToast()

const maxQuantity = 3

// Computed
const getImagePath = computed(() => {
  if (props.card.imageUrl?.startsWith('http')) {
    return props.card.imageUrl
  }
  // Extraire l'extension du shortUrl si l'extension n'est pas définie
  let extensionName = props.card.extension?.name
  if (!extensionName && props.card.url) {
    const urlParts = props.card.url.split('/')
    extensionName = urlParts[urlParts.length - 2] // Prend l'avant-dernier segment de l'URL
  }
  const extension =
    extensionName?.toLowerCase().replace(/\s+/g, '-') || 'unknown'
  return `/images/cards/${props.card.id}-${extension}.webp`
})

const hasStats = computed(() => {
  const stats = props.card.stats
  return stats && (stats.health || stats.power || stats.movement)
})

const typeClass = computed(() => {
  switch (props.card.mainType.toLowerCase()) {
    case 'allié':
      return 'badge-primary'
    case 'action':
      return 'badge-secondary'
    case 'équipement':
      return 'badge-accent'
    default:
      return 'badge-neutral'
  }
})

const rarityClass = computed(() => {
  switch (props.card.rarity.toLowerCase()) {
    case 'légendaire':
      return 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400'
    case 'mythique':
      return 'bg-gradient-to-r from-violet-400 via-purple-500 to-violet-400'
    case 'rare':
      return 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400'
    default:
      return 'bg-gradient-to-r from-gray-400 via-gray-500 to-gray-400'
  }
})

const rarityBadgeClass = computed(() => {
  switch (props.card.rarity.toLowerCase()) {
    case 'légendaire':
      return 'badge-warning'
    case 'mythique':
      return 'badge-secondary'
    case 'rare':
      return 'badge-info'
    default:
      return 'badge-neutral'
  }
})

const isHero = computed(() => isHeroCard(props.card))

// Computed properties pour les informations de la carte
const cardExtension = computed(() => props.card.extension?.name || 'N/A')
const cardNumber = computed(() => props.card.id || 'N/A')
const cardArtist = computed(() => props.card.artists?.[0] || 'N/A')

// Méthodes
const onClose = () => {
  emit('close')
}

const updateQuantity = async (delta: number) => {
  const newQuantity = Math.max(0, Math.min(maxQuantity, props.quantity + delta))

  if (newQuantity === props.quantity) return

  try {
    if (delta > 0) {
      await cardStore.addToCollection(props.card, delta)
      toast.success(`${props.card.name} ajoutée à la collection`)
    } else {
      await cardStore.removeFromCollection(props.card, Math.abs(delta))
      toast.info(`${props.card.name} retirée de la collection`)
    }

    emit('update:quantity', newQuantity)
  } catch (error) {
    toast.error('Erreur lors de la mise à jour de la collection')
  }
}

const handleImageError = () => {
  toast.error(`Erreur lors du chargement de l'image de ${props.card.name}`)
}

function formatStats(stats: any) {
  if (!stats) return []
  return Object.entries(stats)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]: [string, any]) => {
      if (typeof value === 'object' && 'value' in value && 'element' in value) {
        return `${key}: ${value.value} (${value.element})`
      }
      return `${key}: ${value}`
    })
}

function formatKeywords(keywords: any[]) {
  if (!keywords) return []
  return keywords.map(
    (k) => `${k.name}${k.description ? ': ' + k.description : ''}`
  )
}

function getCardElement(): string | null {
  if (!props.card || !props.card.stats) return null

  return (
    props.card.stats.niveau?.element || props.card.stats.force?.element || null
  )
}
</script>

<style scoped>
.progress-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: 9999px;
}

.progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--primary) 0%,
    var(--primary-focus) 100%
  );
  transition: width 0.3s ease;
}

/* Animation de brillance */
.progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: shine 2s infinite;
}

@keyframes shine {
  100% {
    left: 100%;
  }
}
</style>
