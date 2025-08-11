/** * Composant d'affichage d'une carte * Gère l'affichage, le chargement et les
interactions avec une carte * @component */
<template>
  <div
    ref="cardRef"
    class="card bg-base-100 shadow-xl transition-all duration-300"
    :class="{
      'opacity-50': !props.owned,
      'hover:opacity-100 hover:scale-105 cursor-pointer': props.interactive,
      [`card-${props.size || 'md'}`]: true,
    }"
    @click="handleClick"
  >
    <figure class="relative pt-4 px-4">
      <img
        :src="imageUrl"
        :alt="card.name"
        class="rounded-lg w-full h-auto object-contain transition-all duration-500"
        :class="{ 'group-hover:opacity-0': isHero }"
        loading="lazy"
        @error="handleImageError"
      />

      <!-- Badges de quantité -->
      <div
        v-if="props.quantity > 0"
        class="absolute top-2 right-2 badge badge-primary"
      >
        x{{ props.quantity }}
      </div>
      <div
        v-if="props.foilQuantity > 0"
        class="absolute top-8 right-2 badge badge-secondary"
      >
        ✨ x{{ props.foilQuantity }}
      </div>

      <!-- Badge de rareté -->
      <div
        class="absolute bottom-0 left-0 right-0 h-1"
        :class="rarityClass"
      ></div>
    </figure>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Card, CardElement } from '@/types/cards'
import { ELEMENT_EMOJIS } from '@/config/constants'
import { RARITY_COLORS, TYPE_COLORS } from '@/config/theme'
import { useCardStore } from '@/stores/cardStore'

// Props du composant
const props = defineProps<{
  card: Card
  quantity?: number
  showDetails?: boolean
  loading?: 'eager' | 'lazy'
  fetchpriority?: 'high' | 'low' | 'auto'
  interactive?: boolean
  owned?: boolean
  size?: 'sm' | 'md' | 'lg'
  foilQuantity?: number
}>()

const emit = defineEmits<{
  (e: 'click', card: Card): void
  (e: 'imageLoad'): void
  (e: 'imageError'): void
}>()

const cardStore = useCardStore()

const cardInCollection = computed(() => {
  const normal = cardStore.getCardQuantity(props.card.id) || 0
  const foil = cardStore.getFoilCardQuantity(props.card.id) || 0
  return { normal, foil }
})

// État
const isLoading = ref(true)
const hasError = ref(false)
const retryCount = ref(0)
const MAX_RETRIES = 3

// Computed
const imageUrl = computed(() => {
  try {
    // Construire le chemin de l'image
    const cardId = props.card.id
    if (props.card.mainType === 'Héros') {
      return `/images/cards/${cardId}_recto.webp`
    }
    return `/images/cards/${cardId}.webp`
  } catch (error) {
    console.error("❌ Erreur lors de la construction de l'URL:", error)
    return '/images/cards/default.webp'
  }
})

// Obtenir l'élément de la carte
const cardElement = computed(() => {
  return (
    props.card.stats?.niveau?.element ||
    props.card.stats?.force?.element ||
    'Neutre'
  )
})

const cardClasses = computed(() => ({
  'hover:scale-105': !isLoading.value && !hasError.value && props.interactive,
  'cursor-pointer': props.interactive,
  'opacity-50': !props.owned,
  flip: isFlipped.value,
  [`card-${props.size || 'md'}`]: true,
}))

const cardStyle = computed(() => ({
  transform: isHero.value
    ? `rotateY(${isFlipped.value ? '180deg' : '0deg'})`
    : 'none',
  transition: 'transform 0.6s',
}))

const typeClass = computed(() => {
  const type = props.card.mainType || props.card.type
  switch (type?.toLowerCase()) {
    case 'héros':
      return 'badge-secondary'
    case 'allié':
      return 'badge-primary'
    case 'action':
      return 'badge-accent'
    case 'équipement':
      return 'badge-info'
    default:
      return 'badge-neutral'
  }
})

const rarityClass = computed(() => {
  const rarity = props.card.rarity || props.card.rarete
  switch (rarity?.toLowerCase()) {
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

const hasStats = computed(() => {
  return props.card.stats !== undefined
})

const isHero = computed(() => {
  return props.card.mainType === 'Héros' || props.card.type === 'Héros'
})

const isFlipped = ref(false)

// Méthodes
function handleClick() {
  if (props.interactive) {
    emit('click', props.card)
  }
}

function handleImageLoad() {
  isLoading.value = false
  emit('imageLoad')
}

function handleImageError() {
  console.error("❌ Erreur de chargement de l'image:", props.card.name)
  if (retryCount.value < MAX_RETRIES) {
    retryCount.value++
    // Réessayer après un délai
    setTimeout(() => {
      const img = cardRef.value?.querySelector('img')
      if (img) {
        img.src = `${imageUrl.value}?retry=${retryCount.value}`
      }
    }, 1000 * retryCount.value)
  } else {
    hasError.value = true
    isLoading.value = false
    emit('imageError')
  }
}

function handleMouseMove(event: MouseEvent) {
  if (!isHero.value) return

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  isFlipped.value = x > rect.width / 2
}

function handleMouseLeave() {
  if (!isHero.value) return
  isFlipped.value = false
}

function getElementEmoji(element: CardElement): string {
  return ELEMENT_EMOJIS[element] || '❓'
}

async function updateQuantity(isFoil: boolean, increment: boolean) {
  try {
    // Ici nous manipulons la collection via le cardStore pour rester cohérent
    if (increment) {
      await cardStore.addToCollection(props.card, 1, isFoil)
    } else {
      await cardStore.removeFromCollection(props.card, 1, isFoil)
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la quantité:', error)
  }
}
</script>

<style scoped>
.card-container {
  perspective: 1000px;
  transition:
    transform 0.3s ease-in-out,
    z-index 0.3s ease-in-out;
}

.card {
  transform-style: preserve-3d;
  transition: all 0.3s ease-in-out;
  will-change: transform;
}

.card.flip {
  transform: rotateY(180deg);
}

.card.flip img {
  transform: rotateY(180deg);
}

.card:hover {
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
}

.element-icon {
  @apply inline-block;
}

.card-sm {
  @apply w-32;
}

.card-md {
  @apply w-48;
}

.card-lg {
  @apply w-64;
}
</style>
