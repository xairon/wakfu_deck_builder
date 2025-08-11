<template>
  <div class="deck-detail-view w-full min-h-screen bg-base-100 p-4 md:p-6">
    <div class="max-w-6xl mx-auto">
      <!-- En-tête avec navigation et titre -->
      <div
        class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6"
      >
        <div>
          <div class="flex items-center gap-2 mb-2">
            <router-link to="/decks" class="btn btn-sm btn-ghost">
              <i class="fas fa-arrow-left"></i>
            </router-link>
            <h1 class="text-3xl font-bold">
              {{ deck?.name || 'Détail du deck' }}
            </h1>
            <div
              v-if="deck"
              class="badge ml-2"
              :class="isDeckValid ? 'badge-success' : 'badge-warning'"
            >
              {{ isDeckValid ? 'Complet' : 'Incomplet' }}
            </div>
          </div>
          <p class="text-sm text-base-content/70" v-if="deck">
            Dernière modification: {{ formatDate(deck.updatedAt) }}
          </p>
        </div>

        <div class="flex gap-2">
          <router-link :to="`/deck-builder/${deckId}`" class="btn btn-primary">
            <i class="fas fa-edit mr-2"></i> Modifier
          </router-link>
          <button
            @click="exportDeck"
            class="btn btn-success"
            :disabled="!isDeckValid"
          >
            <i class="fas fa-file-export mr-2"></i> Exporter
          </button>
        </div>
      </div>

      <!-- Message de chargement -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <!-- Message d'erreur -->
      <div v-else-if="error" class="alert alert-error mb-6">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        <span>{{ error }}</span>
        <div>
          <router-link to="/decks" class="btn btn-sm btn-ghost">
            Retourner à la liste des decks
          </router-link>
        </div>
      </div>

      <!-- Contenu du deck -->
      <div v-else-if="deck" class="deck-content">
        <!-- Récapitulatif et statistiques -->
        <div class="mb-6">
          <!-- Informations générales -->
          <div class="stats shadow bg-base-200 stats-vertical w-full">
            <div class="stat">
              <div class="stat-title">Type de deck</div>
              <div class="stat-value text-xl">
                {{ getDeckClassElement(deck) }}
              </div>
            </div>
            <div class="stat">
              <div class="stat-title">Nombre de cartes</div>
              <div class="stat-value text-xl">{{ totalCardCount }}/48</div>
              <div class="stat-desc">{{ uniqueCardCount }} cartes uniques</div>
            </div>
            <div v-if="!isDeckValid" class="stat">
              <div class="stat-title">Éléments manquants</div>
              <div class="stat-desc text-error">
                <ul class="list-disc list-inside">
                  <li v-if="!deck.hero">Héros manquant</li>
                  <li v-if="!deck.havreSac">Havre-sac manquant</li>
                  <li v-if="totalCardCount !== 48">
                    {{ totalCardCount < 48 ? 'Manque' : 'Excès de' }}
                    {{ Math.abs(totalCardCount - 48) }} cartes
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Héros et Havre-sac -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <!-- Héros -->
          <div class="card bg-base-200 shadow">
            <div class="card-body">
              <h2 class="card-title">Héros</h2>
              <div v-if="deck.hero" class="flex items-center gap-4">
                <img
                  :src="
                    deck.hero.imageUrl ||
                    `/images/cards/${deck.hero.id}_recto.png`
                  "
                  :alt="deck.hero.name"
                  class="w-24 h-32 object-contain rounded"
                  @error="onImageError"
                />
                <div>
                  <h3 class="text-lg font-semibold">{{ deck.hero.name }}</h3>
                  <div
                    class="badge"
                    :class="getRarityBadgeClass(deck.hero.rarity)"
                  >
                    {{ deck.hero.rarity }}
                  </div>
                  <p
                    v-if="deck.hero.subTypes && deck.hero.subTypes.length > 0"
                    class="text-sm mt-1"
                  >
                    {{ deck.hero.subTypes.join(', ') }}
                  </p>
                </div>
              </div>
              <div v-else class="py-4 text-center text-base-content/70">
                <i class="fas fa-user-slash text-2xl mb-2"></i>
                <p>Pas de héros sélectionné</p>
              </div>
            </div>
          </div>

          <!-- Havre-sac -->
          <div class="card bg-base-200 shadow">
            <div class="card-body">
              <h2 class="card-title">Havre-sac</h2>
              <div v-if="deck.havreSac" class="flex items-center gap-4">
                <img
                  :src="
                    deck.havreSac.imageUrl ||
                    `/images/cards/${deck.havreSac.id}.png`
                  "
                  :alt="deck.havreSac.name"
                  class="w-24 h-32 object-contain rounded"
                  @error="onImageError"
                />
                <div>
                  <h3 class="text-lg font-semibold">
                    {{ deck.havreSac.name }}
                  </h3>
                  <div
                    class="badge"
                    :class="getRarityBadgeClass(deck.havreSac.rarity)"
                  >
                    {{ deck.havreSac.rarity }}
                  </div>
                </div>
              </div>
              <div v-else class="py-4 text-center text-base-content/70">
                <i class="fas fa-shopping-bag text-2xl mb-2"></i>
                <p>Pas de havre-sac sélectionné</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Liste des cartes du deck -->
        <div class="card bg-base-200 shadow mb-6">
          <div class="card-body">
            <div class="flex justify-between items-center">
              <h2 class="card-title">Cartes ({{ totalCardCount }})</h2>
              <div class="tabs tabs-boxed bg-base-300">
                <a
                  class="tab"
                  :class="{ 'tab-active': cardSortMode === 'type' }"
                  @click="() => { cardSortMode = 'type'; console.log('Mode de tri changé vers: type') }"
                >
                  Par type
                </a>

                <a
                  class="tab"
                  :class="{ 'tab-active': cardSortMode === 'name' }"
                  @click="() => { cardSortMode = 'name'; console.log('Mode de tri changé vers: name') }"
                >
                  Par nom
                </a>
              </div>
            </div>

            <div
              v-if="cardsByType.length === 0"
              class="py-4 text-center text-base-content/70"
            >
              <i class="fas fa-inbox text-2xl mb-2"></i>
              <p>Aucune carte dans le deck</p>
            </div>

            <template v-else>
              <!-- Vue groupée par type -->
              <div v-if="cardSortMode === 'type'">
                <div
                  v-for="(group, index) in cardsByType"
                  :key="group.type"
                  class="mb-4"
                >
                  <div class="divider" v-if="index > 0"></div>
                  <h3 class="text-lg font-semibold mb-2">
                    {{ group.type }} ({{ group.count }})
                  </h3>
                  <div
                    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2"
                  >
                    <div
                      v-for="card in group.cards"
                      :key="card.id"
                      class="flex items-center p-2 rounded bg-base-300"
                    >
                      <div
                        class="card-image w-8 h-8 rounded overflow-hidden mr-2"
                      >
                        <img
                          :src="card.card.imageUrl"
                          :alt="card.card.name"
                          class="w-full h-full object-cover"
                          @error="onImageError"
                        />
                      </div>
                      <div class="flex-grow">
                        <div class="font-medium text-sm">
                          {{ card.card.name }}
                        </div>
                        <div class="flex items-center text-xs gap-2">
                          <span
                            v-if="card.card.stats?.pa"
                            class="flex items-center"
                          >
                            <i class="fas fa-bolt text-warning mr-1"></i
                            >{{ card.card.stats.pa }}
                          </span>
                          <span
                            v-if="card.card.stats?.niveau?.value"
                            class="flex items-center"
                          >
                            <i class="fas fa-arrow-up text-info mr-1"></i
                            >{{ card.card.stats.niveau.value }}
                          </span>
                        </div>
                      </div>
                      <div class="badge badge-lg">{{ card.quantity }}</div>
                    </div>
                  </div>
                </div>
              </div>



              <!-- Vue par nom (liste simple) -->
              <div
                v-else
                class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2"
              >
                <div
                  v-for="card in sortedCardsByName"
                  :key="card.id"
                  class="flex items-center p-2 rounded bg-base-300"
                >
                  <div class="card-image w-8 h-8 rounded overflow-hidden mr-2">
                    <img
                      :src="card.card.imageUrl"
                      :alt="card.card.name"
                      class="w-full h-full object-cover"
                      @error="onImageError"
                    />
                  </div>
                  <div class="flex-grow">
                    <div class="font-medium text-sm">{{ card.card.name }}</div>
                    <div class="flex items-center text-xs gap-2">
                      <span
                        v-if="card.card.stats?.pa"
                        class="flex items-center"
                      >
                        <i class="fas fa-bolt text-warning mr-1"></i
                        >{{ card.card.stats.pa }}
                      </span>
                      <span class="opacity-70">{{ card.card.mainType }}</span>
                    </div>
                  </div>
                  <div class="badge badge-lg">{{ card.quantity }}</div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal d'export de deck -->
    <dialog class="modal" :open="showExportModal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Exporter le deck</h3>
        <div class="form-control">
          <textarea
            v-model="exportedDeckText"
            class="textarea textarea-bordered h-64 font-mono text-sm"
            readonly
          ></textarea>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="copyExportToClipboard">
            Copier
          </button>
          <button class="btn" @click="showExportModal = false">Fermer</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showExportModal = false">Fermer</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDeckStore } from '@/stores/deckStore'
import { useToast } from '@/composables/useToast'

// Stores et services
const deckStore = useDeckStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()

// État local
const loading = ref(true)
const error = ref('')
const deckId = computed(() => route.params.id as string)
const deck = computed(() => deckStore.decks.find((d) => d.id === deckId.value))
const cardSortMode = ref<'type' | 'cost' | 'name'>('type')
const showExportModal = ref(false)
const exportedDeckText = ref('')

// Propriétés calculées pour le deck
const isDeckValid = computed(() => {
  if (!deck.value) return false
  return (
    !!deck.value.hero && !!deck.value.havreSac && totalCardCount.value === 48
  )
})

const totalCardCount = computed(() => {
  if (!deck.value) return 0
  return deck.value.cards.reduce((acc, card) => acc + card.quantity, 0)
})

const uniqueCardCount = computed(() => {
  if (!deck.value) return 0
  return deck.value.cards.length
})



// Regroupement des cartes par type
const cardsByType = computed(() => {
  if (!deck.value) return []

  const typeMap: Record<string, { count: number; cards: any[] }> = {}

  deck.value.cards.forEach((deckCard) => {
    const type = deckCard.card.mainType
    if (!typeMap[type]) {
      typeMap[type] = { count: 0, cards: [] }
    }
    typeMap[type].cards.push(deckCard)
    typeMap[type].count += deckCard.quantity
  })

  return Object.entries(typeMap)
    .map(([type, data]) => ({
      type,
      count: data.count,
      cards: data.cards.sort((a, b) => {
        // Trier d'abord par coût, puis par nom
        const costA = a.card.stats?.pa || 0
        const costB = b.card.stats?.pa || 0
        if (costA !== costB) return costA - costB
        return a.card.name.localeCompare(b.card.name)
      }),
    }))
    .sort((a, b) => a.type.localeCompare(b.type))
})



// Tri des cartes par nom
const sortedCardsByName = computed(() => {
  if (!deck.value) return []

  return [...deck.value.cards].sort((a, b) =>
    a.card.name.localeCompare(b.card.name)
  )
})

// Initialisation
onMounted(() => {
  deckStore.initialize()

  // Vérifier que le deck existe
  loading.value = true

  watchEffect(() => {
    if (deckStore.decks.length > 0) {
      loading.value = false

      if (deckId.value && !deck.value) {
        error.value = 'Deck non trouvé'
      }
    }
  })
})

// Méthodes utilitaires
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getDeckClassElement(deck: any): string {
  if (!deck.hero) return 'Pas de héros'

  let result = ''

  // Classe du héros (peut être dans subTypes)
  if (deck.hero.subTypes && deck.hero.subTypes.length > 0) {
    result = deck.hero.subTypes[0] // Première sous-classe
  }

  // Élément du héros (peut être dans stats.niveau.element)
  const element =
    deck.hero.stats?.niveau?.element || deck.hero.stats?.force?.element
  if (element) {
    result += result ? ` (${element})` : element
  }

  return result || 'Héros'
}



function getRarityBadgeClass(rarity: string): string {
  switch (rarity) {
    case 'Commune':
      return 'badge-neutral'
    case 'Peu commune':
      return 'badge-primary'
    case 'Rare':
      return 'badge-secondary'
    case 'Mythique':
      return 'badge-accent'
    case 'Légendaire':
      return 'badge-warning'
    default:
      return 'badge-ghost'
  }
}

// Gestion des erreurs d'image
function onImageError(event: Event) {
  const target = event.target as HTMLImageElement
  if (target) {
    target.src = '/images/card-back.png'
  }
}

// Export du deck
function exportDeck() {
  if (!deck.value) {
    toast.error('Deck non trouvé', { duration: 3000 })
    return
  }

  if (!isDeckValid.value) {
    toast.warning('Ce deck est incomplet et ne peut pas être exporté', {
      title: 'Deck incomplet',
      duration: 3000,
    })
    return
  }

  exportedDeckText.value = deckStore.exportDeck(deckId.value)
  showExportModal.value = true
}

async function copyExportToClipboard() {
  try {
    await navigator.clipboard.writeText(exportedDeckText.value)
    toast.success('Deck copié dans le presse-papier', {
      title: 'Succès',
      duration: 3000,
    })
  } catch (err) {
    console.error('Erreur lors de la copie:', err)
    toast.error('Impossible de copier le deck', {
      title: 'Erreur',
      duration: 5000,
    })
  }
}
</script>


