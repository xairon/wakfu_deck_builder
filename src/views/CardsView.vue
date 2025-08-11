<template>
  <div class="container mx-auto px-4">
    <div class="flex flex-col gap-4">
      <!-- En-tête -->
      <CardsHeader
        @export-collection="exportCollection"
        @import-collection="importCollection"
      />

      <!-- Filtres -->
      <CardsFilters
        v-model:searchQuery="searchQuery"
        v-model:selectedExtension="selectedExtension"
        v-model:selectedMainType="selectedMainType"
        v-model:selectedSubType="selectedSubType"
        v-model:selectedRarity="selectedRarity"
        v-model:selectedElement="selectedElement"
        v-model:minLevel="minLevel"
        v-model:maxLevel="maxLevel"
        v-model:selectedKeywords="selectedKeywords"
        :extensions="extensions"
        :mainTypes="mainTypes"
        :subTypes="subTypes"
        :rarities="rarities"
        :elements="elements"
        :availableKeywords="availableKeywords"
      />

      <!-- Grille de cartes -->
      <CardsGrid :filteredCards="filteredCards" @select-card="selectCard" />

      <!-- Modal de détail de carte -->
      <CardDetailModal
        ref="cardDetailModal"
        :card="selectedCard"
        :quantity="selectedCard ? getCardQuantity(selectedCard.id) : 0"
        @add="addToCollection"
        @remove="removeFromCollection"
        @close="closeModal"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCardStore } from '@/stores/cardStore'
import { useToast } from '@/composables/useToast'
import type { Card } from '@/types/cards'

// Import des composants
import CardsHeader from '@/components/cards/CardsHeader.vue'
import CardsFilters from '@/components/cards/CardsFilters.vue'
import CardsGrid from '@/components/cards/CardsGrid.vue'
import CardDetailModal from '@/components/cards/CardDetailModal.vue'

// Stores et composables
const cardStore = useCardStore()
const toast = useToast()

// Références
const cardDetailModal = ref<InstanceType<typeof CardDetailModal> | null>(null)
const selectedCard = ref<Card | null>(null)

// État des filtres
const searchQuery = ref('')
const selectedExtension = ref('')
const selectedMainType = ref('')
const selectedSubType = ref('')
const selectedRarity = ref('')
const selectedElement = ref('')
const minLevel = ref<number | null>(null)
const maxLevel = ref<number | null>(null)
const selectedKeywords = ref<string[]>([])

// Options pour les filtres
const extensions = computed(() => cardStore.extensions)

const mainTypes = computed(() => {
  const types = new Set<string>()
  cardStore.cards.forEach((card) => types.add(card.mainType))
  return Array.from(types).sort()
})

const subTypes = computed(() => {
  const types = new Set<string>()
  cardStore.cards.forEach((card) => {
    if (card.subTypes) {
      card.subTypes.forEach((type) => types.add(type))
    }
  })
  return Array.from(types).sort()
})

const rarities = computed(() => {
  const types = new Set<string>()
  cardStore.cards.forEach((card) => types.add(card.rarity))
  return Array.from(types).sort()
})

const elements = computed(() => {
  const elementSet = new Set<string>()
  cardStore.cards.forEach((card) => {
    if (card.stats?.niveau?.element) elementSet.add(card.stats.niveau.element)
    if (card.stats?.force?.element) elementSet.add(card.stats.force.element)
  })
  return Array.from(elementSet).sort()
})

const availableKeywords = computed(() => {
  const keywords = new Set<string>()
  cardStore.cards.forEach((card) => {
    if (card.keywords) {
      card.keywords.forEach((kw) => keywords.add(kw.name))
    }
  })
  return Array.from(keywords).sort()
})

// Filtrage des cartes
const filteredCards = computed(() => {
  let filtered = [...cardStore.cards]

  // Filtre par recherche
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (card) =>
        card.name.toLowerCase().includes(query) ||
        card.subTypes.some((type) => type.toLowerCase().includes(query))
    )
  }

  // Filtre par extension
  if (selectedExtension.value) {
    filtered = filtered.filter(
      (card) => card.extension.name === selectedExtension.value
    )
  }

  // Filtre par type principal
  if (selectedMainType.value) {
    filtered = filtered.filter(
      (card) => card.mainType === selectedMainType.value
    )
  }

  // Filtre par sous-type
  if (selectedSubType.value) {
    filtered = filtered.filter((card) =>
      card.subTypes.includes(selectedSubType.value)
    )
  }

  // Filtre par rareté
  if (selectedRarity.value) {
    filtered = filtered.filter((card) => card.rarity === selectedRarity.value)
  }

  // Filtre par élément
  if (selectedElement.value) {
    filtered = filtered.filter(
      (card) =>
        card.stats?.niveau?.element === selectedElement.value ||
        card.stats?.force?.element === selectedElement.value
    )
  }

  // Filtre par niveau
  if (minLevel.value !== null) {
    filtered = filtered.filter((card) => {
      const niveau = card.stats?.niveau?.value
      return niveau !== undefined ? niveau >= minLevel.value! : false
    })
  }
  if (maxLevel.value !== null) {
    filtered = filtered.filter((card) => {
      const niveau = card.stats?.niveau?.value
      return niveau !== undefined ? niveau <= maxLevel.value! : false
    })
  }

  // Filtre par mots-clés
  if (selectedKeywords.value.length > 0) {
    filtered = filtered.filter((card) => {
      if (!card.keywords) return false
      return selectedKeywords.value.every((keyword) =>
        card.keywords!.some((kw) => kw.name === keyword)
      )
    })
  }

  // Tri par numéro et extension
  return filtered.sort((a, b) => {
    // Extensions prioritaires
    const extensionOrder = {
      Incarnam: 0,
      Astrub: 1,
      Amakna: 2,
      'Bonta-Brakmar': 3,
      Pandala: 4,
      Otomaï: 5,
      'DOFUS Collection': 6,
      "Chaos d'Ogrest": 7,
      'Ankama Convention 5': 8,
      'Île des Wabbits': 9,
      Draft: 10,
    }

    // Comparer d'abord par extension
    const extA = extensionOrder[a.extension.name] ?? 999
    const extB = extensionOrder[b.extension.name] ?? 999

    if (extA !== extB) {
      return extA - extB
    }

    // Extraire le numéro avant le '/' pour le tri
    const numA = a.extension.number?.match(/^(\d+)\//)
      ? parseInt(a.extension.number.match(/^(\d+)\//)[1])
      : 0
    const numB = b.extension.number?.match(/^(\d+)\//)
      ? parseInt(b.extension.number.match(/^(\d+)\//)[1])
      : 0

    return numA - numB
  })
})

// Fonctions
function getCardQuantity(cardId: string): number {
  return cardStore.getCardQuantity(cardId)
}

function addToCollection(card: Card, quantity = 1, isFoil = false) {
  try {
    cardStore.addToCollection(card, quantity, isFoil)
    toast.success(`${card.name} ajoutée à la collection`)
  } catch (error) {
    toast.error(`Erreur lors de l'ajout de ${card.name}`)
  }
}

function removeFromCollection(card: Card, quantity = 1, isFoil = false) {
  try {
    cardStore.removeFromCollection(card, quantity, isFoil)
    if (getCardQuantity(card.id) === 0) {
      toast.info(`${card.name} retirée de la collection`)
    }
  } catch (error) {
    toast.error(`Erreur lors du retrait de ${card.name}`)
  }
}

function exportCollection() {
  try {
    const data = JSON.stringify(cardStore.collection, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wakfu-collection.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Collection exportée avec succès')
  } catch (error) {
    toast.error("Erreur lors de l'export de la collection")
  }
}

function importCollection() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = async (e) => {
    try {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const text = await file.text()
      const data = JSON.parse(text)
      await cardStore.importCollection(data)
      toast.success('Collection importée avec succès')
    } catch (error) {
      toast.error("Erreur lors de l'import de la collection")
    }
  }
  input.click()
}

function selectCard(card: Card) {
  selectedCard.value = card
  cardDetailModal.value?.open()
}

function closeModal() {
  cardDetailModal.value?.close()
  selectedCard.value = null
}

// Initialisation
onMounted(async () => {
  try {
    if (!cardStore.isInitialized) {
      await cardStore.initialize()
    }
  } catch (error) {
    console.error('Erreur lors du chargement des cartes:', error)
    toast.error('Erreur lors du chargement des cartes')
  }
})
</script>
