<template>
  <div class="collection-view w-full px-2">
    <div class="flex flex-col gap-4 max-w-screen-xl mx-auto">
      <!-- En-tête avec le titre et la progression -->
      <CollectionHeader />

      <!-- Message de sauvegarde pour utilisateurs non connectés -->
      <div v-if="!isAuthenticated" class="alert alert-info shadow-lg mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <div>
          <h3 class="font-bold">Collection sauvegardée localement</h3>
          <div class="text-xs">Connectez-vous pour sauvegarder votre collection en ligne et y accéder depuis n'importe quel appareil.</div>
        </div>
        <div>
          <router-link to="/login" class="btn btn-sm btn-primary">Connexion</router-link>
        </div>
      </div>

      <!-- Filtres de recherche et options -->
      <CollectionFilters 
        v-model:search-query="searchQuery"
        v-model:selected-extension="selectedExtension"
        v-model:hide-not-owned="hideNotOwned"
        v-model:selected-sort-field="selectedSortField"
        v-model:is-descending="isDescending"
        v-model:selected-main-type="selectedMainType"
        v-model:selected-sub-type="selectedSubType"
        v-model:selected-rarity="selectedRarity"
        v-model:selected-element="selectedElement"
        v-model:min-level="minLevel"
        v-model:max-level="maxLevel"
        :extensions="extensions"
        :main-types="mainTypes"
        :sub-types="subTypes"
        :rarities="rarities"
        :elements="elements"
      />
    </div>
    
    <!-- Grille de cartes virtualisée - occupe toute la largeur disponible -->
    <div class="w-full">
      <CollectionGrid 
        :filtered-cards="filteredCollection"
        @update-quantity="updateCardQuantity"
        @select-card="selectCard"
      />
    </div>
    
    <!-- Modal de détail de carte -->
    <dialog id="card_detail_modal" class="modal z-50">
      <div class="modal-box max-w-4xl relative">
        <form method="dialog">
          <button class="btn btn-sm btn-circle absolute right-2 top-2">✕</button>
        </form>
        <div v-if="selectedCard" class="space-y-4">
          <!-- En-tête avec le nom et les onglets pour les héros -->
          <div class="flex justify-between items-center">
            <h3 class="text-2xl font-bold">{{ selectedCard.name }}</h3>
            <div v-if="isSelectedCardHero" class="join">
              <button 
                class="join-item btn"
                :class="{ 'btn-active': !showVerso }"
                @click="showVerso = false"
              >
                Recto
              </button>
              <button 
                class="join-item btn"
                :class="{ 'btn-active': showVerso }"
                @click="showVerso = true"
              >
                Verso
              </button>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-8">
            <!-- Image -->
            <div class="relative aspect-[7/10] h-auto">
              <OptimizedImage
                :src="getSelectedCardImage"
                :alt="selectedCard.name"
                :width="480"
                :height="660"
                loading="eager"
                fetchpriority="high"
                class="rounded-lg w-full h-full"
                @error="handleImageError"
              />
              
              <!-- Message d'erreur si les deux faces ont échoué -->
              <div 
                v-if="imageHasError && isSelectedCardHero && imageFallbackMode" 
                class="absolute inset-0 flex flex-col items-center justify-center bg-base-300/90 rounded-lg p-4"
              >
                <div class="text-center space-y-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 class="text-lg font-bold">Image non disponible</h3>
                  <p class="text-sm">Impossible de charger le {{ showVerso ? 'verso' : 'recto' }} de cette carte.</p>
                  <p class="text-xs text-base-content/60">
                    ID: {{ selectedCard.id }}_{{ showVerso ? 'verso' : 'recto' }}
                  </p>
                  
                  <!-- Boutons pour essayer les différentes faces -->
                  <div class="join mt-4">
                    <button 
                      class="join-item btn btn-sm"
                      :class="{ 'btn-ghost': showVerso }"
                      @click="showVerso = false; imageHasError = false; imageFallbackMode = null;"
                    >
                      Essayer Recto
                    </button>
                    <button 
                      class="join-item btn btn-sm"
                      :class="{ 'btn-ghost': !showVerso }"
                      @click="showVerso = true; imageHasError = false; imageFallbackMode = null;"
                    >
                      Essayer Verso
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Informations -->
            <div class="space-y-4">
              <!-- Type et sous-types -->
              <div class="flex flex-wrap gap-2">
                <div class="badge badge-lg">{{ selectedCard.mainType }}</div>
                <div 
                  v-for="subType in selectedCard.subTypes" 
                  :key="subType" 
                  class="badge badge-outline"
                >
                  {{ subType }}
                </div>
                <div 
                  v-if="isSelectedCardHero && selectedCard && isHeroCard(selectedCard)"
                  class="badge badge-secondary"
                >
                  {{ selectedCard.class }}
                </div>
              </div>

              <!-- Stats -->
              <div v-if="displayedStats" class="stats stats-vertical shadow w-full">
                <div v-if="displayedStats.niveau" class="stat">
                  <div class="stat-title">Niveau</div>
                  <div class="stat-value flex items-center gap-2">
                    {{ displayedStats.niveau.value }}
                    <span 
                      v-if="displayedStats.niveau.element.toLowerCase() !== ELEMENTS.NEUTRE.toLowerCase()"
                      :class="getElementClass(displayedStats.niveau.element)"
                      class="text-2xl"
                    >
                      <ElementIcon :element="stringToElement(displayedStats.niveau.element)" size="sm" />
                    </span>
                  </div>
                </div>
                <div v-if="displayedStats.force" class="stat">
                  <div class="stat-title">Force</div>
                  <div class="stat-value flex items-center gap-2">
                    {{ displayedStats.force.value }}
                    <span 
                      v-if="displayedStats.force.element.toLowerCase() !== ELEMENTS.NEUTRE.toLowerCase()"
                      :class="getElementClass(displayedStats.force.element)"
                      class="text-2xl"
                    >
                      <ElementIcon :element="stringToElement(displayedStats.force.element)" size="sm" />
                    </span>
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

              <!-- Effets -->
              <div v-if="displayedEffects?.length" class="divider">Effets</div>
              <div v-if="displayedEffects?.length" class="space-y-4">
                <div 
                  v-for="(effect, index) in displayedEffects" 
                  :key="index"
                  class="card bg-base-200"
                >
                  <div class="card-body p-4">
                    <p class="text-sm">{{ effect.description }}</p>
                    <div class="flex flex-wrap gap-2 mt-2">
                      <div 
                        v-if="effect.elements?.length" 
                        class="flex items-center gap-1"
                      >
                        <span 
                          v-for="element in effect.elements" 
                          :key="element"
                          :class="getElementClass(element)"
                          class="text-lg"
                        >
                          <ElementIcon :element="stringToElement(element)" size="sm" />
                        </span>
                      </div>
                      <div 
                        v-if="effect.isOncePerTurn" 
                        class="badge badge-sm"
                      >
                        Une fois par tour
                      </div>
                      <div 
                        v-if="effect.requiresIncline" 
                        class="badge badge-sm"
                      >
                        Nécessite d'incliner
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Mots-clés -->
              <div v-if="displayedKeywords?.length" class="divider">Mots-clés</div>
              <div v-if="displayedKeywords?.length" class="flex flex-wrap gap-2">
                <div 
                  v-for="keyword in displayedKeywords" 
                  :key="keyword.name"
                  class="badge badge-lg badge-outline tooltip tooltip-top"
                  :data-tip="keyword.description"
                >
                  <span class="font-medium">{{ keyword.name }}</span>
                  <span 
                    v-if="keyword.elements?.length"
                    class="ml-2 flex items-center gap-1"
                  >
                    <span 
                      v-for="element in keyword.elements" 
                      :key="element"
                      :class="getElementClass(element)"
                      class="text-lg"
                    >
                      <ElementIcon :element="stringToElement(element)" size="sm" />
                    </span>
                  </span>
                </div>
              </div>

              <!-- Collection -->
              <div class="divider">Collection</div>
              <div v-if="selectedCard" class="flex flex-col gap-4 bg-base-200 p-4 rounded-box">
                <!-- Cartes normales -->
                <div class="flex items-center gap-4">
                  <div class="flex-1">
                    <p class="text-sm text-base-content/70">Quantité normale</p>
                    <p class="text-3xl font-bold">{{ cardStore.getCardQuantity(selectedCard.id) }}</p>
                  </div>
                  <div class="join">
                    <button 
                      class="join-item btn"
                      @click="selectedCard && removeFromCollection(selectedCard)"
                    >
                      -
                    </button>
                    <button 
                      class="join-item btn btn-primary"
                      @click="selectedCard && addToCollection(selectedCard)"
                    >
                      +
                    </button>
                  </div>
                </div>

                <!-- Cartes foil -->
                <div class="flex items-center gap-4">
                  <div class="flex-1">
                    <p class="text-sm text-base-content/70">Quantité foil ✨</p>
                    <p class="text-3xl font-bold">{{ cardStore.getFoilCardQuantity(selectedCard.id) }}</p>
                  </div>
                  <div class="join">
                    <button 
                      class="join-item btn"
                      @click="selectedCard && removeFromCollection(selectedCard, 1, true)"
                    >
                      -
                    </button>
                    <button 
                      class="join-item btn btn-secondary"
                      @click="selectedCard && addToCollection(selectedCard, 1, true)"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <!-- Informations -->
              <div class="divider">Informations</div>
              <div class="card bg-base-200">
                <div class="card-body p-4 space-y-2">
                  <!-- Extension -->
                  <div class="flex items-center gap-2">
                    <span class="text-base-content/60">Extension :</span>
                    <span class="badge badge-neutral">
                      {{ selectedCard.extension.name }}
                      <span v-if="selectedCard.extension.number" class="ml-2 opacity-70">
                        #{{ selectedCard.extension.number }}
                      </span>
                    </span>
                  </div>

                  <!-- Artistes -->
                  <div v-if="selectedCard.artists?.length" class="flex items-center gap-2">
                    <span class="text-base-content/60">Artiste(s) :</span>
                    <div class="flex flex-wrap gap-1">
                      <span 
                        v-for="artist in selectedCard.artists" 
                        :key="artist"
                        class="badge badge-ghost"
                      >
                        {{ artist }}
                      </span>
                    </div>
                  </div>

                  <!-- Flavor -->
                  <div v-if="selectedCard.flavor" class="mt-4">
                    <blockquote class="italic text-base-content/70 border-l-4 border-primary/20 pl-4">
                      "{{ selectedCard.flavor.text }}"
                      <footer v-if="selectedCard.flavor.attribution" class="text-right mt-1">
                        - {{ selectedCard.flavor.attribution }}
                      </footer>
                    </blockquote>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn">Fermer</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>Fermer</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCardStore } from '@/stores/cardStore'
import { useToast } from '@/composables/useToast'
import { isHeroCard } from '@/types/cards'
import type { Card, HeroCard } from '@/types/cards'
import { useMemoize } from '@vueuse/core'
import ElementIcon from '@/components/elements/ElementIcon.vue'
import { ELEMENTS, type Element } from '@/services/elementService'
import CollectionHeader from '@/components/collection/CollectionHeader.vue'
import CollectionFilters from '@/components/collection/CollectionFilters.vue'
import CollectionGrid from '@/components/collection/CollectionGrid.vue'
import OptimizedImage from '@/components/common/OptimizedImage.vue'
import { useSupabaseStore } from '@/stores/supabaseStore'

const cardStore = useCardStore()
const toast = useToast()
const supabaseStore = useSupabaseStore()

const searchQuery = ref('')
const selectedExtension = ref('')
const selectedMainType = ref('')
const selectedSubType = ref('')
const selectedRarity = ref('')
const selectedElement = ref('')
const minLevel = ref<number | null>(null)
const maxLevel = ref<number | null>(null)
const selectedKeywords = ref<string[]>([])
const showVerso = ref(false)
const selectedCard = ref<Card | null>(null)
const selectedSortField = ref('number')
const isDescending = ref(false)
const hideNotOwned = ref(false)
const isModalOpen = ref(false)

// État d'authentification
const isAuthenticated = computed(() => supabaseStore.isAuthenticated)

// État pour la synchronisation
const isSyncing = ref(false)
const syncMessage = ref('')
const syncError = ref('')

// Ajout d'une référence pour suivre les erreurs d'image
const imageHasError = ref(false)
const imageFallbackMode = ref<'recto' | 'verso' | null>(null)

// Computed properties pour les filtres
const mainTypes = computed(() => {
  const types = new Set(cardStore.cards.map(card => card.mainType))
  return Array.from(types).sort()
})

const subTypes = computed(() => {
  const types = new Set(cardStore.cards.flatMap(card => card.subTypes || []))
  return Array.from(types).sort()
})

const rarities = computed(() => {
  const types = new Set(cardStore.cards.map(card => card.rarity))
  return Array.from(types).sort()
})

const elements = computed(() => {
  const elementSet = new Set<string>()
  cardStore.cards.forEach(card => {
    if (card.stats?.niveau?.element) elementSet.add(card.stats.niveau.element)
    if (card.stats?.force?.element) elementSet.add(card.stats.force.element)
  })
  return Array.from(elementSet).sort()
})

const extensions = computed(() => cardStore.extensions)

// Computed properties pour les cartes sélectionnées
const isSelectedCardHero = computed(() => {
  if (!selectedCard.value) return false;
  // Vérifier si c'est un héros en utilisant le mainType ou en vérifiant la présence des propriétés recto/verso
  return selectedCard.value.mainType === 'Héros' || isHeroCard(selectedCard.value);
})

const displayedStats = computed(() => {
  if (!selectedCard.value) return null
  if (isSelectedCardHero.value && isHeroCard(selectedCard.value)) {
    return showVerso.value ? selectedCard.value.verso?.stats : selectedCard.value.recto.stats
  }
  return selectedCard.value.stats
})

const displayedEffects = computed(() => {
  if (!selectedCard.value) return null
  if (isSelectedCardHero.value && isHeroCard(selectedCard.value)) {
    return showVerso.value ? selectedCard.value.verso?.effects : selectedCard.value.recto.effects
  }
  return selectedCard.value.effects
})

const displayedKeywords = computed(() => {
  if (!selectedCard.value) return null
  if (isSelectedCardHero.value && isHeroCard(selectedCard.value)) {
    return showVerso.value ? selectedCard.value.verso?.keywords : selectedCard.value.recto.keywords
  }
  return selectedCard.value.keywords
})

const getSelectedCardImage = computed(() => {
  if (!selectedCard.value) return '/images/cards/placeholder.png'
  
  // Si on est en mode fallback après une erreur, forcer le mode opposé
  if (imageHasError.value && imageFallbackMode.value) {
    if (isSelectedCardHero.value) {
      return `/images/cards/${selectedCard.value.id}_${imageFallbackMode.value}.png`
    } else {
      return '/images/cards/placeholder.png'
    }
  }
  
  // Chemin normal
  let imagePath = ''
  
  if (isSelectedCardHero.value) {
    imagePath = showVerso.value 
      ? `/images/cards/${selectedCard.value.id}_verso.png`
      : `/images/cards/${selectedCard.value.id}_recto.png`
  } else {
    imagePath = `/images/cards/${selectedCard.value.id}.png`
  }
  
  return imagePath
})

function getElementClass(element: string): string {
  switch (element.toLowerCase()) {
    case 'feu':
      return 'text-error'
    case 'eau':
      return 'text-primary'
    case 'air':
      return 'text-info'
    case 'terre':
      return 'text-success'
    default:
      return 'text-base-content'
  }
}

// Fonction utilitaire pour convertir une chaîne en Element
function stringToElement(elementStr: string): Element {
  const elementMap: Record<string, Element> = {
    'eau': ELEMENTS.EAU,
    'feu': ELEMENTS.FEU,
    'terre': ELEMENTS.TERRE,
    'air': ELEMENTS.AIR,
    'neutre': ELEMENTS.NEUTRE
  }
  return elementMap[elementStr.toLowerCase()] || ELEMENTS.NEUTRE
}

// Mémoiser la fonction de filtrage pour éviter des recalculs inutiles
const memoizedFilter = useMemoize(
  (cards: Card[], query: string, extension: string, mainType: string, subType: string, 
    rarity: string, element: string, minLvl: number | null, maxLvl: number | null, hideNotOwned: boolean): Card[] => {
    
    let filtered = [...cards];
    
    // Application des filtres en série
    if (query) {
      const lowQuery = query.toLowerCase();
      filtered = filtered.filter(card => 
        card.name.toLowerCase().includes(lowQuery) ||
        card.subTypes.some(type => type.toLowerCase().includes(lowQuery))
      );
    }
    
    if (extension) {
      filtered = filtered.filter(card => card.extension.name === extension);
    }
    
    if (mainType) {
      filtered = filtered.filter(card => card.mainType === mainType);
    }
    
    if (subType) {
      filtered = filtered.filter(card => card.subTypes.includes(subType));
    }
    
    if (rarity) {
      filtered = filtered.filter(card => card.rarity === rarity);
    }
    
    if (element) {
      filtered = filtered.filter(card => 
        card.stats?.niveau?.element === element ||
        card.stats?.force?.element === element
      );
    }
    
    if (minLvl !== null) {
      filtered = filtered.filter(card => {
        const niveau = card.stats?.niveau?.value;
        return niveau !== undefined ? niveau >= minLvl : false;
      });
    }
    
    if (maxLvl !== null) {
      filtered = filtered.filter(card => {
        const niveau = card.stats?.niveau?.value;
        return niveau !== undefined ? niveau <= maxLvl : false;
      });
    }
    
    if (hideNotOwned) {
      const store = useCardStore();
      filtered = filtered.filter(card => 
        store.getCardQuantity(card.id) > 0 || 
        store.getFoilCardQuantity(card.id) > 0
      );
    }
    
    return filtered;
  }
);

// Mémoiser la fonction de tri
const memoizedSort = useMemoize(
  (cards: Card[], sortField: string, isDesc: boolean): Card[] => {
    // Copie pour éviter de modifier l'original
    const result = [...cards];
    
    // Fonction pour appliquer la direction du tri
    const applyDirection = (result: number) => isDesc ? -result : result;
    
    result.sort((cardA, cardB) => {
      // Fonction utilitaire pour comparer les extensions
      const compareExtensions = () => {
        const extensionOrder = {
          'Incarnam': 0,
          'Astrub': 1,
          'Amakna': 2,
          'Bonta-Brakmar': 3,
          'Pandala': 4,
          'Otomaï': 5,
          'DOFUS Collection': 6,
          'Chaos d\'Ogrest': 7,
          'Ankama Convention 5': 8,
          'Île des Wabbits': 9,
          'Draft': 10
        };

        // Extraire le numéro avant le '/' pour le tri
        const getCardNumber = (card: Card) => {
          const match = card.extension.number?.match(/^(\d+)\//)
          return match ? parseInt(match[1]) : 0
        }

        // Comparer d'abord par extension
        const extA = extensionOrder[cardA.extension.name] ?? 999
        const extB = extensionOrder[cardB.extension.name] ?? 999
        
        if (extA !== extB) {
          return extA - extB
        }

        // Si même extension, comparer par numéro
        const numA = getCardNumber(cardA)
        const numB = getCardNumber(cardB)
        return numA - numB
      };

      switch (sortField) {
        case 'number':
          return applyDirection(compareExtensions());

        case 'rarity': {
          const rarityOrder = {
            'Commune': 0,
            'Peu Commune': 1,
            'Rare': 2,
            'Mythique': 3,
            'Légendaire': 4
          }
          const rarityCompare = (rarityOrder[cardA.rarity] || 0) - (rarityOrder[cardB.rarity] || 0)
          if (rarityCompare !== 0) return applyDirection(rarityCompare)
          return compareExtensions()
        }

        case 'type': {
          const typeCompare = cardA.mainType.localeCompare(cardB.mainType)
          if (typeCompare !== 0) return applyDirection(typeCompare)
          return compareExtensions()
        }

        case 'element': {
          const elementA = cardA.stats?.niveau?.element || cardA.stats?.force?.element || 'neutre'
          const elementB = cardB.stats?.niveau?.element || cardB.stats?.force?.element || 'neutre'
          const elementCompare = elementA.localeCompare(elementB)
          if (elementCompare !== 0) return applyDirection(elementCompare)
          return compareExtensions()
        }

        case 'force': {
          const forceA = cardA.stats?.force?.value || 0
          const forceB = cardB.stats?.force?.value || 0
          if (forceA !== forceB) return applyDirection(forceA - forceB)
          return compareExtensions()
        }

        default:
          return compareExtensions()
      }
    });
    
    return result;
  }
);

// Filtrage des cartes avec optimisation
const filteredCollection = computed(() => {
  console.time('filteredCollection');
  console.log('🔎 DEBUG: Filtrage et tri de', cardStore.cards.length, 'cartes...');
  
  // 1. Filtrage avec mémoisation
  const filteredCards = memoizedFilter(
    cardStore.cards,
    searchQuery.value,
    selectedExtension.value,
    selectedMainType.value,
    selectedSubType.value,
    selectedRarity.value,
    selectedElement.value,
    minLevel.value,
    maxLevel.value,
    hideNotOwned.value
  );
  
  console.log(`🔎 DEBUG: Après filtrage: ${filteredCards.length} cartes`);
  
  // 2. Tri avec mémoisation
  const sortedCards = memoizedSort(filteredCards, selectedSortField.value, isDescending.value);
  
  // 3. Construction du résultat final
  const result = sortedCards.map(card => ({
    card,
    quantity: cardStore.getCardQuantity(card.id),
    foilQuantity: cardStore.getFoilCardQuantity(card.id)
  }));
  
  console.log(`✅ DEBUG: Après tri: ${result.length} cartes prêtes à afficher`);
  console.timeEnd('filteredCollection');
  
  return result;
})

// Gestion des actions
function updateCardQuantity(card: Card, quantity: number, isFoil: boolean) {
  try {
    if (quantity > 0) {
      cardStore.addToCollection(card, quantity, isFoil);
      toast.success(`${card.name} ajoutée à la collection`);
    } else {
      cardStore.removeFromCollection(card, Math.abs(quantity), isFoil);
      if (cardStore.getCardQuantity(card.id) === 0 && cardStore.getFoilCardQuantity(card.id) === 0) {
        toast.info(`${card.name} retirée de la collection`);
      }
    }
  } catch (error) {
    toast.error(`Erreur lors de la mise à jour de ${card.name}`);
  }
}

function addToCollection(card: Card, quantity = 1, isFoil = false) {
  updateCardQuantity(card, quantity, isFoil);
}

function removeFromCollection(card: Card, quantity = 1, isFoil = false) {
  updateCardQuantity(card, -quantity, isFoil);
}

// Fonctions de gestion des cartes
function selectCard(card: Card) {
  console.log('👀 Carte sélectionnée:', card.name, card.id);
  if (!card) {
    console.error('❌ Erreur: Tentative de sélection d\'une carte null');
    return;
  }
  
  // Réinitialiser les états d'erreur
  imageHasError.value = false;
  imageFallbackMode.value = null;
  showVerso.value = false;
  
  // Définir la carte sélectionnée
  selectedCard.value = card;
  
  // Ouvrir le modal en utilisant l'API Dialog native
  const modal = document.getElementById('card_detail_modal') as HTMLDialogElement;
  if (modal) {
    console.log('🔍 DEBUG: Ouverture du modal via showModal() pour', card.name);
    modal.showModal();
    isModalOpen.value = true;
  } else {
    console.error('❌ Erreur: Élément modal non trouvé dans le DOM');
  }
}

function closeModal() {
  console.log('🔍 DEBUG: Fermeture du modal');
  
  // Fermer le modal en utilisant l'API Dialog native
  const modal = document.getElementById('card_detail_modal') as HTMLDialogElement;
  if (modal) {
    modal.close();
    isModalOpen.value = false;
  }
  
  // Réinitialiser les états après une courte animation
  setTimeout(() => {
    selectedCard.value = null;
    showVerso.value = false;
    imageHasError.value = false;
    imageFallbackMode.value = null;
    console.log('🔍 DEBUG: État modal réinitialisé');
  }, 300);
}

// Initialisation
onMounted(async () => {
  try {
    if (!cardStore.isInitialized) {
      await cardStore.initialize()
    }
    
    // Vérifier si l'utilisateur est authentifié et si la collection doit être synchronisée
    if (supabaseStore.isAuthenticated) {
      console.log('Utilisateur authentifié, vérification de la synchronisation...')
      // La synchronisation se fait automatiquement via setupAutoSync dans cardStore
    }
  } catch (error) {
    console.error('❌ Erreur lors du chargement des cartes:', error)
    toast.addToast({
      type: 'error',
      message: 'Erreur lors du chargement des cartes. Veuillez réessayer.',
      timeout: 5000
    })
  }
})

function resetFilters() {
  searchQuery.value = ''
  selectedExtension.value = ''
  selectedMainType.value = ''
  selectedSubType.value = ''
  selectedRarity.value = ''
  selectedElement.value = ''
  minLevel.value = null
  maxLevel.value = null
  selectedSortField.value = 'number'
  isDescending.value = false
  hideNotOwned.value = false
  
  toast.info('Filtres réinitialisés')
}

function disableHideNotOwned() {
  hideNotOwned.value = false
  toast.success('Affichage des cartes non possédées activé')
}

// Fonction pour gérer les erreurs d'image
function handleImageError() {
  console.error(`Erreur de chargement de l'image pour la carte: ${selectedCard.value?.name} (${showVerso.value ? 'verso' : 'recto'})`)
  
  // Si c'est une carte héros, essayer l'autre face
  if (isSelectedCardHero.value) {
    // Si on était sur verso, essayer recto comme fallback
    if (showVerso.value) {
      console.log('Tentative de chargement du recto comme fallback')
      imageFallbackMode.value = 'recto'
      showVerso.value = false
    } 
    // Si on était sur recto, essayer verso comme fallback
    else {
      console.log('Tentative de chargement du verso comme fallback')
      imageFallbackMode.value = 'verso'
      showVerso.value = true
    }
  } else {
    // Pour les cartes normales, simplement marquer l'erreur
    imageHasError.value = true
  }
}

// Réinitialiser l'état d'erreur d'image quand on change de carte sélectionnée
watch(selectedCard, () => {
  imageHasError.value = false
  imageFallbackMode.value = null
})

// Également réinitialiser l'état d'erreur quand on bascule manuellement entre recto et verso
watch(showVerso, () => {
  imageHasError.value = false
  imageFallbackMode.value = null
})
</script>

<style scoped>
.collection-view {
  max-width: 100vw;
  overflow-x: hidden;
}
</style>