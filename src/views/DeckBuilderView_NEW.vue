<template>
  <div class="deck-builder-view min-h-screen bg-gradient-to-br from-base-200 to-base-300">
    <!-- Header moderne avec navigation -->
    <div class="sticky top-0 z-50 bg-base-100/95 backdrop-blur-sm border-b border-base-300">
      <div class="container mx-auto px-4 py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <router-link to="/decks" class="btn btn-ghost btn-sm">
              <i class="fas fa-arrow-left mr-2"></i>Retour
            </router-link>
            <div class="text-xl font-bold">
              {{ isEditingDeck ? 'Modification' : 'Nouveau Deck' }}
            </div>
          </div>
          
          <!-- Actions rapides -->
          <div class="flex items-center gap-2">
            <div class="badge badge-outline" :class="getValidationBadgeClass()">
              {{ validationStatus }}
            </div>
            <button 
              v-if="canSaveDeck" 
              @click="saveDeck" 
              class="btn btn-primary btn-sm"
              :disabled="!isValidForSave"
            >
              <i class="fas fa-save mr-2"></i>Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="container mx-auto px-4 py-6">
      <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        <!-- Panneau de construction du deck (gauche) -->
        <div class="xl:col-span-1 order-2 xl:order-1">
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body p-4">
              
              <!-- Nom du deck -->
              <div class="mb-4">
                <label class="label">
                  <span class="label-text font-semibold">Nom du deck</span>
                </label>
                <input 
                  v-model="deckName" 
                  type="text" 
                  placeholder="Mon super deck..." 
                  class="input input-bordered w-full"
                  :class="{ 'input-error': !deckName.trim() }"
                />
              </div>

              <!-- Slots Héros et Havre-sac -->
              <div class="space-y-4 mb-6">
                <!-- Slot Héros -->
                <div class="relative">
                  <label class="label">
                    <span class="label-text font-semibold flex items-center gap-2">
                      <i class="fas fa-crown text-warning"></i>
                      Héros
                      <span v-if="!currentDeck?.hero" class="badge badge-error badge-xs">Requis</span>
                    </span>
                  </label>
                  
                  <div 
                    class="relative group cursor-pointer transition-all duration-200"
                    :class="{ 
                      'hover:shadow-lg': !currentDeck?.hero,
                      'ring-2 ring-error ring-opacity-50': !currentDeck?.hero && showValidation,
                      'ring-2 ring-success ring-opacity-50': currentDeck?.hero
                    }"
                    @click="openHeroSelector"
                  >
                    <div v-if="currentDeck?.hero" class="relative">
                      <div class="card bg-base-200 image-full shadow-lg">
                        <figure class="aspect-[2/3]">
                          <img 
                            :src="getCardImageUrl(currentDeck.hero)" 
                            :alt="currentDeck.hero.name"
                            class="object-cover"
                            @error="onImageError"
                          />
                        </figure>
                        <div class="card-body justify-end p-3">
                          <div class="card-title text-sm text-white drop-shadow-lg">
                            {{ currentDeck.hero.name }}
                          </div>
                        </div>
                      </div>
                      
                      <!-- Bouton de suppression -->
                      <button 
                        @click.stop="removeHero"
                        class="btn btn-circle btn-sm btn-error absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                    
                    <!-- Placeholder héros -->
                    <div v-else class="card bg-base-200 border-2 border-dashed border-base-300 aspect-[2/3] hover:border-primary hover:bg-primary/5 transition-all">
                      <div class="card-body justify-center items-center text-center">
                        <i class="fas fa-crown text-4xl text-base-content/30 mb-2"></i>
                        <p class="text-sm text-base-content/60">Cliquez pour choisir un héros</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Slot Havre-sac -->
                <div class="relative">
                  <label class="label">
                    <span class="label-text font-semibold flex items-center gap-2">
                      <i class="fas fa-backpack text-info"></i>
                      Havre-sac
                      <span v-if="!currentDeck?.havreSac" class="badge badge-error badge-xs">Requis</span>
                    </span>
                  </label>
                  
                  <div 
                    class="relative group cursor-pointer transition-all duration-200"
                    :class="{ 
                      'hover:shadow-lg': !currentDeck?.havreSac,
                      'ring-2 ring-error ring-opacity-50': !currentDeck?.havreSac && showValidation,
                      'ring-2 ring-success ring-opacity-50': currentDeck?.havreSac
                    }"
                    @click="openHavreSacSelector"
                  >
                    <div v-if="currentDeck?.havreSac" class="relative">
                      <div class="card bg-base-200 image-full shadow-lg">
                        <figure class="aspect-[2/3]">
                          <img 
                            :src="getCardImageUrl(currentDeck.havreSac)" 
                            :alt="currentDeck.havreSac.name"
                            class="object-cover"
                            @error="onImageError"
                          />
                        </figure>
                        <div class="card-body justify-end p-3">
                          <div class="card-title text-sm text-white drop-shadow-lg">
                            {{ currentDeck.havreSac.name }}
                          </div>
                        </div>
                      </div>
                      
                      <!-- Bouton de suppression -->
                      <button 
                        @click.stop="removeHavreSac"
                        class="btn btn-circle btn-sm btn-error absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                    
                    <!-- Placeholder havre-sac -->
                    <div v-else class="card bg-base-200 border-2 border-dashed border-base-300 aspect-[2/3] hover:border-primary hover:bg-primary/5 transition-all">
                      <div class="card-body justify-center items-center text-center">
                        <i class="fas fa-backpack text-4xl text-base-content/30 mb-2"></i>
                        <p class="text-sm text-base-content/60">Cliquez pour choisir un havre-sac</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Stats du deck -->
              <div class="stats stats-vertical shadow">
                <div class="stat py-2">
                  <div class="stat-title text-xs">Cartes</div>
                  <div class="stat-value text-lg" :class="getCardCountClass()">
                    {{ cardCount }}/40
                  </div>
                  <div class="stat-desc text-xs">
                    {{ cardCount < 15 ? `${15 - cardCount} minimum requis` : 
                         cardCount > 40 ? `${cardCount - 40} en trop` : 'Valide' }}
                  </div>
                </div>
                
                <div class="stat py-2">
                  <div class="stat-title text-xs">Cartes manquantes</div>
                  <div class="stat-value text-lg text-warning">{{ missingCardsCount }}</div>
                  <div class="stat-desc text-xs">Dans votre collection</div>
                </div>
              </div>

              <!-- Distribution des éléments -->
              <div v-if="elementDistribution.length > 0" class="mt-4">
                <h4 class="font-semibold mb-2 text-sm">Distribution des éléments</h4>
                <div class="space-y-1">
                  <div v-for="element in elementDistribution" :key="element.name" class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <ElementIcon :element="element.name" size="sm" />
                      <span class="text-xs">{{ element.name }}</span>
                    </div>
                    <span class="badge badge-sm">{{ element.count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Collection de cartes (centre-droite) -->
        <div class="xl:col-span-3 order-1 xl:order-2">
          
          <!-- Filtres de recherche -->
          <div class="card bg-base-100 shadow-lg mb-6">
            <div class="card-body p-4">
              <div class="flex flex-wrap gap-4">
                <!-- Recherche textuelle -->
                <div class="flex-1 min-w-64">
                  <input 
                    v-model="searchQuery" 
                    type="text" 
                    placeholder="Rechercher une carte..." 
                    class="input input-bordered w-full"
                  >
                </div>
                
                <!-- Filtres rapides -->
                <div class="flex flex-wrap gap-2">
                  <select v-model="selectedExtension" class="select select-bordered select-sm">
                    <option value="">Toutes les extensions</option>
                    <option v-for="ext in extensions" :key="ext" :value="ext">{{ ext }}</option>
                  </select>
                  
                  <select v-model="selectedElement" class="select select-bordered select-sm">
                    <option value="">Tous les éléments</option>
                    <option v-for="element in elements" :key="element" :value="element">{{ element }}</option>
                  </select>
                  
                  <select v-model="selectedRarity" class="select select-bordered select-sm">
                    <option value="">Toutes les raretés</option>
                    <option v-for="rarity in rarities" :key="rarity" :value="rarity">{{ rarity }}</option>
                  </select>

                  <!-- Toggle pour masquer les cartes non possédées -->
                  <label class="cursor-pointer label gap-2">
                    <input v-model="hideNotOwned" type="checkbox" class="checkbox checkbox-sm" />
                    <span class="label-text text-sm">Masquer non possédées</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Grille de cartes -->
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            <div 
              v-for="cardItem in filteredCards" 
              :key="cardItem.card.id"
              class="relative group"
            >
              <!-- Carte -->
              <div 
                class="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
                :class="getCardDisplayClass(cardItem)"
                @click="selectCard(cardItem.card)"
              >
                <figure class="aspect-[2/3] relative overflow-hidden">
                  <img 
                    :src="getCardImageUrl(cardItem.card)" 
                    :alt="cardItem.card.name"
                    class="object-cover w-full h-full transition-transform group-hover:scale-105"
                    @error="onImageError"
                  />
                  
                  <!-- Overlay pour cartes non possédées -->
                  <div v-if="cardItem.owned === 0" class="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div class="text-center text-white">
                      <i class="fas fa-lock text-2xl mb-1"></i>
                      <p class="text-xs">Non possédée</p>
                    </div>
                  </div>
                  
                  <!-- Badge de quantité possédée -->
                  <div v-if="cardItem.owned > 0" class="absolute top-2 left-2 badge badge-success badge-sm">
                    {{ cardItem.owned }}
                  </div>
                  
                  <!-- Badge quantité en deck -->
                  <div v-if="cardItem.inDeck > 0" class="absolute top-2 right-2 badge badge-primary badge-sm">
                    {{ cardItem.inDeck }}
                  </div>
                </figure>
                
                <div class="card-body p-2">
                  <h3 class="card-title text-xs leading-tight">{{ cardItem.card.name }}</h3>
                  
                  <!-- Infos rapides -->
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1">
                      <ElementIcon v-if="cardItem.card.element" :element="cardItem.card.element" size="xs" />
                      <span class="badge badge-outline badge-xs">{{ cardItem.card.rarity }}</span>
                    </div>
                    <span class="text-base-content/60">Niv. {{ cardItem.card.level || 0 }}</span>
                  </div>
                </div>
              </div>

              <!-- Boutons d'action -->
              <div class="absolute bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div class="flex gap-1">
                  <!-- Bouton retirer -->
                  <button 
                    v-if="cardItem.inDeck > 0"
                    @click.stop="removeCardFromDeck(cardItem.card)"
                    class="btn btn-xs btn-error"
                  >
                    <i class="fas fa-minus"></i>
                  </button>
                  
                  <!-- Bouton ajouter -->
                  <button 
                    @click.stop="addCardToDeck(cardItem.card)"
                    class="btn btn-xs btn-primary"
                    :disabled="!canAddCard(cardItem)"
                  >
                    <i class="fas fa-plus"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Message si aucune carte -->
          <div v-if="filteredCards.length === 0" class="text-center py-12">
            <i class="fas fa-search text-4xl text-base-content/30 mb-4"></i>
            <p class="text-lg text-base-content/60">Aucune carte trouvée</p>
            <p class="text-sm text-base-content/40">Essayez d'ajuster vos filtres</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de détail de carte -->
    <dialog id="card_detail_modal" class="modal">
      <div class="modal-box max-w-4xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        
        <CardDetail 
          v-if="selectedCard" 
          :card="selectedCard"
          :show-collection-actions="true"
        />
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Modal de sélection de héros -->
    <dialog id="hero_selector_modal" class="modal">
      <div class="modal-box max-w-6xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        
        <h3 class="font-bold text-lg mb-4">Choisir un héros</h3>
        
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-96 overflow-y-auto">
          <div 
            v-for="hero in availableHeroes" 
            :key="hero.id"
            class="card bg-base-100 shadow-lg hover:shadow-xl cursor-pointer transition-all"
            @click="selectHero(hero)"
          >
            <figure class="aspect-[2/3]">
              <img 
                :src="getCardImageUrl(hero)" 
                :alt="hero.name"
                class="object-cover w-full h-full"
                @error="onImageError"
              />
            </figure>
            <div class="card-body p-2">
              <h4 class="card-title text-sm">{{ hero.name }}</h4>
            </div>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Modal de sélection de havre-sac -->
    <dialog id="havre_sac_selector_modal" class="modal">
      <div class="modal-box max-w-6xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        
        <h3 class="font-bold text-lg mb-4">Choisir un havre-sac</h3>
        
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-96 overflow-y-auto">
          <div 
            v-for="havreSac in availableHavreSacs" 
            :key="havreSac.id"
            class="card bg-base-100 shadow-lg hover:shadow-xl cursor-pointer transition-all"
            @click="selectHavreSac(havreSac)"
          >
            <figure class="aspect-[2/3]">
              <img 
                :src="getCardImageUrl(havreSac)" 
                :alt="havreSac.name"
                class="object-cover w-full h-full"
                @error="onImageError"
              />
            </figure>
            <div class="card-body p-2">
              <h4 class="card-title text-sm">{{ havreSac.name }}</h4>
            </div>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCardStore } from '@/stores/cardStore'
import { useDeckStore } from '@/stores/deckStore'
import { useToast } from '@/composables/useToast'
import CardDetail from '@/components/CardDetail.vue'
import ElementIcon from '@/components/elements/ElementIcon.vue'
import type { Card } from '@/types/cards'

const route = useRoute()
const router = useRouter()
const cardStore = useCardStore()
const deckStore = useDeckStore()
const toast = useToast()

// État réactif
const deckName = ref('')
const searchQuery = ref('')
const selectedExtension = ref('')
const selectedElement = ref('')
const selectedRarity = ref('')
const hideNotOwned = ref(false)
const selectedCard = ref<Card | null>(null)
const showValidation = ref(false)

// Props calculées
const isEditingDeck = computed(() => !!route.params.id)
const deckId = computed(() => route.params.id as string)
const currentDeck = computed(() => deckStore.currentDeck)
const cards = computed(() => cardStore.cards)
const collection = computed(() => cardStore.collection)

// Listes de référence
const extensions = computed(() => [...new Set(cards.value.map(c => c.extension))].filter(Boolean).sort())
const elements = computed(() => [...new Set(cards.value.map(c => c.element))].filter(Boolean).sort())
const rarities = computed(() => [...new Set(cards.value.map(c => c.rarity))].filter(Boolean).sort())

// Cartes spéciales
const availableHeroes = computed(() => cards.value.filter(c => c.mainType === 'Héros'))
const availableHavreSacs = computed(() => cards.value.filter(c => c.mainType === 'Havre-Sac'))

// Interface de carte enrichie pour l'affichage
interface CardDisplayItem {
  card: Card
  owned: number
  inDeck: number
}

// Cartes filtrées avec informations d'affichage
const filteredCards = computed((): CardDisplayItem[] => {
  let filtered = cards.value.filter(card => {
    // Exclure héros et havre-sacs de la liste principale
    if (card.mainType === 'Héros' || card.mainType === 'Havre-Sac') return false
    
    // Filtres de recherche
    if (searchQuery.value && !card.name.toLowerCase().includes(searchQuery.value.toLowerCase())) return false
    if (selectedExtension.value && card.extension !== selectedExtension.value) return false
    if (selectedElement.value && card.element !== selectedElement.value) return false
    if (selectedRarity.value && card.rarity !== selectedRarity.value) return false
    
    return true
  })

  return filtered.map(card => {
    const owned = cardStore.getCardQuantity(card.id) + cardStore.getFoilCardQuantity(card.id)
    const inDeck = deckStore.getCardQuantityInDeck(card.id)
    
    // Filtrer les cartes non possédées si demandé
    if (hideNotOwned.value && owned === 0) return null
    
    return {
      card,
      owned,
      inDeck
    }
  }).filter(Boolean) as CardDisplayItem[]
})

// Stats du deck
const cardCount = computed(() => {
  if (!currentDeck.value?.cards) return 0
  return currentDeck.value.cards.reduce((sum, card) => sum + card.quantity, 0)
})

const missingCardsCount = computed(() => {
  if (!currentDeck.value?.cards) return 0
  return currentDeck.value.cards.reduce((sum, deckCard) => {
    const owned = cardStore.getCardQuantity(deckCard.id) + cardStore.getFoilCardQuantity(deckCard.id)
    return sum + Math.max(0, deckCard.quantity - owned)
  }, 0)
})

const elementDistribution = computed(() => {
  if (!currentDeck.value?.cards) return []
  
  const distribution: Record<string, number> = {}
  currentDeck.value.cards.forEach(deckCard => {
    const card = cards.value.find(c => c.id === deckCard.id)
    if (card?.element) {
      distribution[card.element] = (distribution[card.element] || 0) + deckCard.quantity
    }
  })
  
  return Object.entries(distribution)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

// Validation
const isValidForSave = computed(() => {
  return !!(
    deckName.value.trim() &&
    currentDeck.value?.hero &&
    currentDeck.value?.havreSac &&
    cardCount.value >= 15 &&
    cardCount.value <= 40
  )
})

const validationStatus = computed(() => {
  if (!deckName.value.trim()) return 'Nom requis'
  if (!currentDeck.value?.hero) return 'Héros requis'
  if (!currentDeck.value?.havreSac) return 'Havre-sac requis'
  if (cardCount.value < 15) return `${15 - cardCount.value} cartes manquantes`
  if (cardCount.value > 40) return `${cardCount.value - 40} cartes en trop`
  return 'Deck valide'
})

const canSaveDeck = computed(() => !!currentDeck.value)

// Classes CSS conditionnelles
function getValidationBadgeClass() {
  if (isValidForSave.value) return 'badge-success'
  if (!currentDeck.value?.hero || !currentDeck.value?.havreSac) return 'badge-error'
  if (cardCount.value < 15 || cardCount.value > 40) return 'badge-warning'
  return 'badge-outline'
}

function getCardCountClass() {
  if (cardCount.value < 15) return 'text-error'
  if (cardCount.value > 40) return 'text-error'
  if (cardCount.value >= 15 && cardCount.value <= 40) return 'text-success'
  return 'text-base-content'
}

function getCardDisplayClass(cardItem: CardDisplayItem) {
  const classes = []
  if (cardItem.owned === 0) classes.push('opacity-60', 'saturate-50')
  if (cardItem.inDeck > 0) classes.push('ring-2', 'ring-primary', 'ring-opacity-50')
  return classes
}

// Utilitaires
function getCardImageUrl(card: Card): string {
  if (card.imageUrl) return card.imageUrl
  return `/images/cards/${card.id}.png`
}

function onImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.src = '/images/cards/placeholder.png'
}

// Actions de sélection
function selectCard(card: Card) {
  selectedCard.value = card
  const modal = document.getElementById('card_detail_modal') as HTMLDialogElement
  modal?.showModal()
}

function openHeroSelector() {
  const modal = document.getElementById('hero_selector_modal') as HTMLDialogElement
  modal?.showModal()
}

function openHavreSacSelector() {
  const modal = document.getElementById('havre_sac_selector_modal') as HTMLDialogElement
  modal?.showModal()
}

function selectHero(hero: Card) {
  if (currentDeck.value?.hero && currentDeck.value.hero.id !== hero.id) {
    toast.warning(`Héros remplacé : ${currentDeck.value.hero.name} → ${hero.name}`)
  }
  deckStore.setHero(hero)
  toast.success(`Héros sélectionné : ${hero.name}`)
  
  const modal = document.getElementById('hero_selector_modal') as HTMLDialogElement
  modal?.close()
}

function selectHavreSac(havreSac: Card) {
  if (currentDeck.value?.havreSac && currentDeck.value.havreSac.id !== havreSac.id) {
    toast.warning(`Havre-sac remplacé : ${currentDeck.value.havreSac.name} → ${havreSac.name}`)
  }
  deckStore.setHavreSac(havreSac)
  toast.success(`Havre-sac sélectionné : ${havreSac.name}`)
  
  const modal = document.getElementById('havre_sac_selector_modal') as HTMLDialogElement
  modal?.close()
}

function removeHero() {
  if (currentDeck.value?.hero) {
    toast.info(`Héros retiré : ${currentDeck.value.hero.name}`)
    deckStore.setHero(null)
  }
}

function removeHavreSac() {
  if (currentDeck.value?.havreSac) {
    toast.info(`Havre-sac retiré : ${currentDeck.value.havreSac.name}`)
    deckStore.setHavreSac(null)
  }
}

// Actions sur les cartes
function canAddCard(cardItem: CardDisplayItem): boolean {
  if (cardCount.value >= 40) return false
  if (cardItem.inDeck >= 3) return false
  return true
}

function addCardToDeck(card: Card) {
  if (!currentDeck.value) {
    deckStore.createNewDeck()
  }
  
  const currentQuantity = deckStore.getCardQuantityInDeck(card.id)
  
  if (currentQuantity >= 3) {
    toast.error('Maximum 3 copies par carte')
    return
  }
  
  if (cardCount.value >= 40) {
    toast.error('Le deck ne peut contenir plus de 40 cartes')
    return
  }
  
  deckStore.addCard(card)
  toast.success(`${card.name} ajoutée au deck`)
}

function removeCardFromDeck(card: Card) {
  deckStore.removeCard(card.id)
  toast.info(`${card.name} retirée du deck`)
}

// Sauvegarde
async function saveDeck() {
  if (!isValidForSave.value) {
    showValidation.value = true
    toast.error('Le deck n\'est pas valide pour la sauvegarde')
    return
  }
  
  try {
    const deckData = {
      name: deckName.value.trim(),
      hero: currentDeck.value!.hero!,
      havreSac: currentDeck.value!.havreSac!,
      cards: currentDeck.value!.cards || []
    }
    
    if (isEditingDeck.value) {
      await deckStore.updateDeck(deckId.value, deckData)
      toast.success('Deck mis à jour avec succès!')
    } else {
      const newDeck = await deckStore.saveDeck(deckData)
      toast.success('Deck sauvegardé avec succès!')
      router.push(`/deck/${newDeck.id}`)
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error)
    toast.error('Erreur lors de la sauvegarde du deck')
  }
}

// Initialisation
onMounted(async () => {
  if (isEditingDeck.value) {
    try {
      await deckStore.loadDeck(deckId.value)
      if (currentDeck.value) {
        deckName.value = currentDeck.value.name || ''
      } else {
        toast.error('Deck non trouvé')
        router.push('/decks')
      }
    } catch (error) {
      console.error('Erreur lors du chargement du deck:', error)
      toast.error('Erreur lors du chargement du deck')
      router.push('/decks')
    }
  } else {
    deckStore.createNewDeck()
  }
})

// Watchers pour la validation en temps réel
watch([deckName, currentDeck], () => {
  if (showValidation.value) {
    showValidation.value = false
  }
}, { deep: true })
</script>

<style scoped>
/* Animations personnalisées */
.card {
  transition: all 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
}

/* Amélioration des badges */
.badge-xs {
  font-size: 0.65rem;
}

/* Scroll personnalisé pour les modales */
.modal-box {
  scrollbar-width: thin;
  scrollbar-color: #64748b #e2e8f0;
}

.modal-box::-webkit-scrollbar {
  width: 6px;
}

.modal-box::-webkit-scrollbar-track {
  background: #e2e8f0;
  border-radius: 3px;
}

.modal-box::-webkit-scrollbar-thumb {
  background: #64748b;
  border-radius: 3px;
}

.modal-box::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
