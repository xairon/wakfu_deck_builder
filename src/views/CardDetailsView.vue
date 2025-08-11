<template>
  <div v-if="card" class="container mx-auto px-4 py-8">
    <div class="flex flex-col md:flex-row gap-8">
      <!-- Image de la carte -->
      <div class="w-full md:w-1/3">
        <div class="sticky top-8">
          <CardComponent :card="card" size="lg" :interactive="false" />
        </div>
      </div>

      <!-- Détails de la carte -->
      <div class="w-full md:w-2/3 space-y-6">
        <!-- En-tête -->
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-3xl font-bold">{{ card.name }}</h1>
            <div class="flex items-center gap-2 mt-2">
              <span class="badge badge-lg">{{ card.mainType }}</span>
              <span
                v-if="getCardElement()"
                class="badge badge-lg badge-outline"
              >
                {{ getCardElement() }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <button class="btn btn-primary" @click="addToCollection">
              Ajouter à la collection
            </button>
            <button
              v-if="canAddToDeck"
              class="btn btn-secondary"
              @click="addToDeck"
            >
              Ajouter au deck
            </button>
          </div>
        </div>

        <!-- Statistiques -->
        <div class="stats shadow">
          <div v-if="card.stats.ap" class="stat">
            <div class="stat-title">Points d'Action</div>
            <div class="stat-value text-warning">{{ card.stats.ap }}</div>
          </div>
          <div v-if="card.stats.hp" class="stat">
            <div class="stat-title">Points de Vie</div>
            <div class="stat-value text-error">{{ card.stats.hp }}</div>
          </div>
          <div v-if="card.stats.mp" class="stat">
            <div class="stat-title">Points de Mouvement</div>
            <div class="stat-value text-info">{{ card.stats.mp }}</div>
          </div>
        </div>

        <!-- Effets -->
        <div v-if="card.effects?.length" class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">Effets</h2>
            <ul class="space-y-2">
              <li
                v-for="(effect, index) in card.effects"
                :key="index"
                class="flex items-start gap-2"
              >
                <span class="text-primary">•</span>
                <span>{{ effect }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Mots-clés -->
        <div v-if="card.keywords?.length" class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">Mots-clés</h2>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="keyword in card.keywords"
                :key="keyword"
                class="badge badge-lg"
              >
                {{ keyword }}
              </span>
            </div>
          </div>
        </div>

        <!-- Informations supplémentaires -->
        <div class="grid grid-cols-2 gap-4">
          <div class="card bg-base-200">
            <div class="card-body">
              <h2 class="card-title">Extension</h2>
              <p>{{ card.extension }}</p>
              <p class="text-sm text-base-content/70">#{{ card.numero }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body">
              <h2 class="card-title">Rareté</h2>
              <p>{{ card.rarete }}</p>
            </div>
          </div>
        </div>

        <!-- Citation -->
        <div v-if="card.ambiance" class="card bg-base-200">
          <div class="card-body">
            <blockquote class="italic text-base-content/70">
              "{{ card.ambiance }}"
            </blockquote>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Message de chargement -->
  <div
    v-else-if="loading"
    class="flex justify-center items-center min-h-[50vh]"
  >
    <div class="loading loading-spinner loading-lg"></div>
  </div>

  <!-- Message d'erreur -->
  <div v-else class="text-center py-12">
    <div class="text-6xl mb-4">😢</div>
    <h2 class="text-2xl font-bold mb-2">Carte non trouvée</h2>
    <p class="text-base-content/70 mb-6">
      Cette carte n'existe pas ou n'est plus disponible.
    </p>
    <router-link to="/cards" class="btn btn-primary">
      Voir toutes les cartes
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Card } from '@/types/card'
import { useCardStore } from '@/stores/cardStore'
import { useToast } from '@/composables/useToast'
import CardComponent from '@/components/card/CardComponent.vue'

const route = useRoute()
const router = useRouter()
const cardStore = useCardStore()
const toast = useToast()

const card = ref<Card | null>(null)
const loading = ref(true)

// Propriétés calculées
const canAddToDeck = computed(() => {
  return (
    card.value?.mainType !== 'Héros' && card.value?.mainType !== 'Havre-Sac'
  )
})

// Méthodes
async function loadCard() {
  try {
    const cardId = route.params.id as string
    const loadedCard = await cardStore.getCardById(cardId)

    if (!loadedCard) {
      throw new Error('Card not found')
    }

    card.value = loadedCard
  } catch (error) {
    console.error('Error loading card:', error)
    toast.error('Erreur lors du chargement de la carte')
  } finally {
    loading.value = false
  }
}

async function addToCollection() {
  if (!card.value) return

  try {
    await cardStore.addToCollection(card.value, 1)
    toast.success('Carte ajoutée à la collection')
  } catch (error) {
    console.error('Error adding to collection:', error)
    toast.error("Erreur lors de l'ajout à la collection")
  }
}

async function addToDeck() {
  if (!card.value) return

  // TODO: Implémenter la logique d'ajout au deck
  toast.info('Fonctionnalité en cours de développement')
}

// Fonction pour déterminer l'élément de la carte
function getCardElement(): string | null {
  if (!card.value || !card.value.stats) return null

  return (
    card.value.stats.niveau?.element || card.value.stats.force?.element || null
  )
}

// Cycle de vie
onMounted(() => {
  loadCard()
})
</script>
