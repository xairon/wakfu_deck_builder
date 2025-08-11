<template>
  <div>
    <!-- Message si aucune carte -->
    <div
      v-if="validCards.length === 0"
      class="flex flex-col items-center justify-center py-12"
    >
      <div class="text-center">
        <h3 class="text-xl font-bold">Aucune carte trouvée</h3>
        <p class="text-base-content/70 mt-2">Essayez de modifier vos filtres</p>
      </div>
    </div>

    <!-- Grille de cartes avec virtualisation simple -->
    <div v-else class="cards-grid-container relative" ref="gridContainer">
      <!-- Indication de chargement -->
      <div
        v-if="isLoading"
        class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
      >
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <!-- Grille virtualisée -->
      <div
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4 cards-grid"
      >
        <div
          v-for="cardItem in visibleCards"
          :key="
            cardItem.hasOwnProperty('card') ? cardItem.card.id : cardItem.id
          "
          class="card-wrapper w-full h-auto min-w-[180px] relative"
        >
          <CollectionCardItem
            :card="cardItem.hasOwnProperty('card') ? cardItem.card : cardItem"
            :quantity="
              cardItem.hasOwnProperty('quantity')
                ? cardItem.quantity
                : getCardQuantity(cardItem.id)
            "
            :foil-quantity="
              cardItem.hasOwnProperty('foilQuantity')
                ? cardItem.foilQuantity
                : getFoilCardQuantity(cardItem.id)
            "
            :enable-add-to-deck="enableAddToDeck"
            @update-quantity="handleQuantityUpdate"
            @select-card="handleCardSelect"
            @add-to-deck="handleAddToDeck"
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
import {
  defineProps,
  defineEmits,
  computed,
  ref,
  onMounted,
  onUnmounted,
  watch,
  withDefaults,
} from 'vue'
import { useCardStore } from '@/stores/cardStore'
import { useWindowScroll, useThrottleFn } from '@vueuse/core'
import CollectionCardItem from './CollectionCardItem.vue'
import type { Card } from '@/types/cards'

// Définition des props
interface Props {
  filteredCards: any[] // Accepte les deux formats de cartes
  pageSize?: number
  enableAddToDeck?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 20,
  enableAddToDeck: false,
})

// Définition des émissions
const emit = defineEmits<{
  (
    e: 'update-quantity',
    cardId: string,
    quantity: number,
    isFoil: boolean
  ): void
  (e: 'select-card', card: Card): void
  (e: 'add-to-deck', card: Card): void
}>()

// Store
const cardStore = useCardStore()

// État pour la virtualisation
const isLoading = ref(false)
const gridContainer = ref<HTMLElement | null>(null)
const { y: scrollY } = useWindowScroll()
const currentPage = ref(0)

// Déterminer le format des cartes reçues
const isEncapsulatedFormat = computed(() => {
  if (!props.filteredCards || props.filteredCards.length === 0) return false
  // Format { card, quantity, foilQuantity } vs Card directement
  return (
    props.filteredCards[0] &&
    typeof props.filteredCards[0] === 'object' &&
    'card' in props.filteredCards[0]
  )
})

// Cartes valides (filtrage des entrées incorrectes)
const validCards = computed(() => {
  try {
    console.log(
      '✅ DEBUG CollectionGrid - Filtre des cartes valides:',
      props.filteredCards?.length
    )

    if (isEncapsulatedFormat.value) {
      // Format encapsulé: tableau de {card: Card, quantity: number, foilQuantity: number, ...}
      console.log(
        '✅ DEBUG CollectionGrid - Format détecté: { card, quantity, ... }'
      )

      // Vérifier les URL d'images
      if (props.filteredCards.length > 0) {
        const sampleCard = props.filteredCards[0].card
        console.log(`📷 Exemple de carte - ID: ${sampleCard.id}`)
        console.log(
          `📷 Exemple de carte - imageUrl: ${sampleCard.imageUrl || 'non défini'}`
        )
        console.log(`📷 Exemple de carte - mainType: ${sampleCard.mainType}`)

        // Compter les cartes avec imageUrl
        const withImageUrl = props.filteredCards.filter(
          (item) => item.card && item.card.imageUrl
        ).length
        console.log(
          `📊 Stats: ${withImageUrl} / ${props.filteredCards.length} cartes ont une imageUrl (${Math.round((withImageUrl / props.filteredCards.length) * 100)}%)`
        )
      }

      return props.filteredCards.filter(
        (item) => item && item.card && item.card.id
      )
    } else {
      // Format direct: tableau de Card directement
      console.log('✅ DEBUG CollectionGrid - Format détecté: Card[]')

      // Vérifier les URL d'images
      if (props.filteredCards.length > 0) {
        const sampleCard = props.filteredCards[0]
        console.log(`📷 Exemple de carte - ID: ${sampleCard.id}`)
        console.log(
          `📷 Exemple de carte - imageUrl: ${sampleCard.imageUrl || 'non défini'}`
        )
        console.log(`📷 Exemple de carte - mainType: ${sampleCard.mainType}`)

        // Compter les cartes avec imageUrl
        const withImageUrl = props.filteredCards.filter(
          (item) => item && item.imageUrl
        ).length
        console.log(
          `📊 Stats: ${withImageUrl} / ${props.filteredCards.length} cartes ont une imageUrl (${Math.round((withImageUrl / props.filteredCards.length) * 100)}%)`
        )
      }

      // Convertir au format encapsulé pour unifier le traitement
      return props.filteredCards
        .filter((item) => item && item.id)
        .map((card) => ({
          card,
          quantity: getCardQuantity(card.id),
          foilQuantity: getFoilCardQuantity(card.id),
          available: getCardQuantity(card.id) + getFoilCardQuantity(card.id),
        }))
    }
  } catch (error) {
    console.error(
      '❌ DEBUG CollectionGrid - Erreur lors du filtrage des cartes valides:',
      error
    )
    return []
  }
})

// Cartes visibles (en fonction de la pagination)
const visibleCards = computed(() => {
  const endIdx = (currentPage.value + 1) * props.pageSize
  return validCards.value.slice(0, endIdx)
})

// Charger plus de cartes quand on scroll
const loadMoreCards = useThrottleFn(() => {
  const scrollPosition = window.scrollY
  const windowHeight = window.innerHeight
  const documentHeight = document.documentElement.scrollHeight

  // Si on approche du bas de la page (300px avant la fin)
  if (
    documentHeight - (scrollPosition + windowHeight) < 300 &&
    validCards.value.length > visibleCards.value.length
  ) {
    isLoading.value = true

    // Simuler un petit délai pour éviter de bloquer le thread principal
    setTimeout(() => {
      currentPage.value++
      isLoading.value = false
    }, 50)
  }
}, 100)

// Surveiller le scroll pour charger plus de cartes
watch(scrollY, () => {
  loadMoreCards()
})

// Surveiller les changements de filtres pour réinitialiser la pagination
watch(
  () => props.filteredCards,
  () => {
    currentPage.value = 0
  },
  { deep: true }
)

// Setup des écouteurs d'événements
onMounted(() => {
  console.log(
    '📦 DEBUG CollectionGrid - Composant monté, cartes reçues:',
    props.filteredCards.length
  )
  window.addEventListener('scroll', loadMoreCards)
  // Charger les premières cartes
  loadMoreCards()
})

onUnmounted(() => {
  window.removeEventListener('scroll', loadMoreCards)
})

// Fonctions d'aide pour obtenir les quantités de cartes
function getCardQuantity(cardId: string): number {
  if (!cardId) return 0
  return cardStore.getCardQuantity(cardId)
}

function getFoilCardQuantity(cardId: string): number {
  if (!cardId) return 0
  return cardStore.getFoilCardQuantity(cardId)
}

// Gestion de la mise à jour de la quantité
function handleQuantityUpdate(
  cardId: string,
  quantity: number,
  isFoil: boolean
) {
  if (!cardId) return
  emit('update-quantity', cardId, quantity, isFoil)
}

// Gestion de la sélection de carte
function handleCardSelect(card: Card) {
  if (!card || !card.id) {
    console.error(
      "❌ CollectionGrid: Tentative de sélection d'une carte invalide",
      card
    )
    return
  }
  emit('select-card', card)
}

// Gestion de l'ajout de carte au deck
function handleAddToDeck(card: Card) {
  if (!card || !card.id) {
    console.error(
      "❌ CollectionGrid: Tentative d'ajout d'une carte invalide",
      card
    )
    return
  }
  emit('add-to-deck', card)
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
