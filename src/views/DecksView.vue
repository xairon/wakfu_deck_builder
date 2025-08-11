<template>
  <div class="decks-view w-full min-h-screen bg-base-100 p-4 md:p-6">
    <div class="max-w-6xl mx-auto">
      <!-- En-tête de la page -->
      <div class="flex flex-wrap justify-between items-center mb-8">
        <h1 class="text-3xl font-bold">Mes Decks</h1>
        <div class="flex gap-2">
          <router-link to="/deck-builder" class="btn btn-primary">
            <i class="fas fa-plus mr-2"></i> Nouveau deck
          </router-link>
          <button @click="showImportModal = true" class="btn btn-outline">
            <i class="fas fa-file-import mr-2"></i> Importer un deck
          </button>
        </div>
      </div>

      <!-- Message si aucun deck -->
      <div v-if="!decks.length" class="hero bg-base-200 rounded-lg p-12 mb-8">
        <div class="hero-content text-center">
          <div class="max-w-md">
            <h2 class="text-2xl font-bold mb-4">
              Vous n'avez pas encore de deck
            </h2>
            <p class="mb-6">
              Créez votre premier deck pour commencer à jouer à Wakfu TCG!
            </p>
            <router-link to="/deck-builder" class="btn btn-primary btn-lg">
              <i class="fas fa-plus mr-2"></i> Créer mon premier deck
            </router-link>
          </div>
        </div>
      </div>

      <!-- Filtres de recherche -->
      <div v-if="decks.length > 0" class="mb-6 flex flex-wrap gap-3">
        <div class="form-control">
          <div class="input-group">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Rechercher un deck..."
              class="input input-bordered w-72"
              @input="filterDecks"
            />
            <button class="btn btn-square">
              <i class="fas fa-search"></i>
            </button>
          </div>
        </div>
        <select
          v-model="filterStatus"
          @change="filterDecks"
          class="select select-bordered"
        >
          <option value="all">Tous les statuts</option>
          <option value="valid">Decks complets</option>
          <option value="invalid">Decks incomplets</option>
        </select>
      </div>

      <!-- Grille de decks -->
      <div
        v-if="filteredDecks.length > 0"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <div
          v-for="deck in filteredDecks"
          :key="deck.id"
          class="deck-card border border-base-300 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow bg-base-100"
        >
          <div class="p-4">
            <div class="flex justify-between items-start mb-2">
              <h3 class="text-xl font-bold truncate">{{ deck.name }}</h3>
              <div
                class="badge"
                :class="isDeckValid(deck) ? 'badge-success' : 'badge-warning'"
              >
                {{ isDeckValid(deck) ? 'Complet' : 'Incomplet' }}
              </div>
            </div>

            <!-- Informations du deck -->
            <div class="mb-3 text-sm text-base-content/70">
              <div class="flex items-center gap-2 mb-1">
                <i class="fas fa-calendar-alt"></i>
                <span>Modifié {{ formatTimeAgo(deck.updatedAt) }}</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="fas fa-chess-knight"></i>
                <span>{{ getDeckClassElement(deck) }}</span>
              </div>
            </div>

            <!-- Statistiques du deck -->
            <div
              class="stats stats-horizontal shadow-sm w-full bg-base-200 mb-4"
            >
              <div class="stat p-2">
                <div class="stat-title text-xs">Héros</div>
                <div class="stat-value text-lg">{{ deck.hero ? 1 : 0 }}</div>
              </div>
              <div class="stat p-2">
                <div class="stat-title text-xs">Havre-sac</div>
                <div class="stat-value text-lg">
                  {{ deck.havreSac ? 1 : 0 }}
                </div>
              </div>
              <div class="stat p-2">
                <div class="stat-title text-xs">Cartes</div>
                <div class="stat-value text-lg">
                  {{ getCardsCount(deck) }}/48
                </div>
              </div>
            </div>

            <!-- Actions sur le deck -->
            <div class="flex justify-between">
              <router-link
                :to="`/deck/${deck.id}`"
                class="btn btn-sm btn-outline"
              >
                <i class="fas fa-eye mr-1"></i> Voir
              </router-link>
              <div class="space-x-1">
                <router-link
                  :to="`/deck-builder/${deck.id}`"
                  class="btn btn-sm btn-primary"
                >
                  <i class="fas fa-edit mr-1"></i> Modifier
                </router-link>
                <button
                  @click="confirmDeleteDeck(deck.id, deck.name)"
                  class="btn btn-sm btn-error"
                >
                  <i class="fas fa-trash"></i>
                </button>
                <button
                  @click="exportDeck(deck.id)"
                  class="btn btn-sm btn-success"
                >
                  <i class="fas fa-file-export"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Message de recherche sans résultat -->
      <div
        v-else-if="searchQuery || filterStatus !== 'all'"
        class="alert alert-info"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="stroke-current shrink-0 w-6 h-6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        <span
          >Aucun deck ne correspond à votre recherche.
          <button @click="resetFilters" class="btn btn-ghost btn-xs">
            Réinitialiser
          </button></span
        >
      </div>
    </div>

    <!-- Modal d'import de deck -->
    <dialog class="modal" :open="showImportModal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Importer un deck</h3>
        


        <div class="form-control">
          <textarea
            v-model="importDeckText"
            class="textarea textarea-bordered h-48 font-mono text-sm"
            :placeholder="importPlaceholder"
          ></textarea>
        </div>

        <!-- Résumé de l'import -->
        <div v-if="importSummary" class="mt-3 p-3 bg-base-200 rounded-lg">
          <div class="text-sm space-y-1">
            <div class="flex justify-between">
              <span>Héros :</span>
              <span class="font-medium">{{ importSummary.hero || 'Aucun' }}</span>
            </div>
            <div class="flex justify-between">
              <span>Havre-sac :</span>
              <span class="font-medium">{{ importSummary.havreSac || 'Aucun' }}</span>
            </div>
            <div class="flex justify-between">
              <span>Cartes :</span>
              <span class="font-medium">{{ importSummary.cardCount }}/48</span>
            </div>
            <div v-if="importSummary.errors.length > 0" class="mt-2">
              <span class="text-error text-xs">⚠️ {{ importSummary.errors.length }} erreur(s) détectée(s)</span>
            </div>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-primary" @click="confirmImportDeck" :disabled="!importDeckText.trim()">
            Importer
          </button>
          <button class="btn" @click="showImportModal = false">Annuler</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showImportModal = false">Fermer</button>
      </form>
    </dialog>

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
import { ref, computed, onMounted, watch } from 'vue'
import { useDeckStore } from '@/stores/deckStore'
import { useToast } from '@/composables/useToast'
import { useRouter } from 'vue-router'
import { useCardStore } from '@/stores/cardStore'

// Stores et services
const deckStore = useDeckStore()
const cardStore = useCardStore()
const toast = useToast()
const router = useRouter()

// État local
const searchQuery = ref('')
const filterStatus = ref('all')
const showImportModal = ref(false)
const showExportModal = ref(false)
const importDeckText = ref('')
const importPlaceholder = `# Deck Feu Aggro
1 Trantmy Londami (Héros)
1 Havre-sac du Wabbit (Havre-Sac)
3 Cawotte
3 Épée du petit chevalier
2 Boufton noir
1 Craqueleur des plaines`
const importSummary = ref<{
  hero: string | null
  havreSac: string | null
  cardCount: number
  errors: string[]
} | null>(null)
const exportedDeckText = ref('')
const currentExportDeckId = ref('')

// Récupération des decks
const decks = computed(() => deckStore.decks)

// Filtrage des decks
const filteredDecks = ref([] as any[])

// Initialisation
onMounted(() => {
  deckStore.initialize()
  filterDecks()
})

// Analyser le texte d'import en temps réel
watch(importDeckText, () => {
  console.log('🔄 Watch déclenché, deckStore disponible:', !!deckStore)
  console.log('🔧 findCardByName disponible:', !!deckStore.findCardByName)
  console.log('🔧 normalizeText disponible:', !!deckStore.normalizeText)
  
  if (deckStore.normalizeText) {
    console.log('🧪 Test normalizeText:')
    console.log('  "Havre-Sac du Wabbit" →', deckStore.normalizeText("Havre-Sac du Wabbit"))
    console.log('  "Trantmy Londami" →', deckStore.normalizeText("Trantmy Londami"))
  }
  
  analyzeImportText()
})

function analyzeImportText() {
  try {
    console.log('🔍 Début de analyzeImportText')
    
    if (!importDeckText.value.trim()) {
      console.log('📝 Texte vide, arrêt')
      importSummary.value = null
      return
    }

    console.log('📝 Texte à analyser:', importDeckText.value)
    console.log('🔧 deckStore.findCardByName disponible:', !!deckStore.findCardByName)

    const rawText = importDeckText.value
    const lineBreakRegex = /\r?\n/g
    const entryRegex = /^\s*(\d+)\s+(.+?)(?:\s+\((.+?)\))?\s*$/gm

    const summary = {
      hero: null as string | null,
      havreSac: null as string | null,
      cardCount: 0,
      errors: [] as string[]
    }

    let totalCards = 0

    const matches = [...rawText.matchAll(entryRegex)]
    console.log(`📋 Entrées détectées: ${matches.length}`)

    for (const match of matches) {
      const matchIndex = match.index ?? 0
      const prefix = rawText.slice(0, matchIndex)
      const lineNumber = (prefix.match(lineBreakRegex)?.length ?? 0) + 1

      const quantityStr = match[1]
      const cardName = match[2]
      const rawType = match[3]
      const cardType: string | undefined = rawType ? rawType : undefined
      const typeLabel = rawType || 'aucun'
      const quantity = parseInt(quantityStr)

      console.log(`📝 Ligne ${lineNumber}: "${quantity} ${cardName}${typeLabel !== 'aucun' ? ` (${typeLabel})` : ''}"`)
      console.log(`🔍 Ligne ${lineNumber}: Recherche de "${cardName}" (type: ${typeLabel})`)
      console.log(`🔧 Appel de deckStore.findCardByName("${cardName}", "${typeLabel}")`)

      const card = deckStore.findCardByName ? deckStore.findCardByName(cardName, cardType) : null
      console.log(`🔍 Résultat pour "${cardName}":`, card ? `Trouvé: ${card.name} (${card.mainType})` : 'Non trouvé')

      if (!card) {
        const suggestions = cardStore.cards
          .filter(c => {
            const normalizedName = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            const normalizedSearch = cardName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            return normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName)
          })
          .slice(0, 3)
          .map(c => c.name)

        let errorMsg = `Ligne ${lineNumber}: carte "${cardName}" non trouvée`
        if (suggestions.length > 0) {
          errorMsg += ` (Suggestions: ${suggestions.join(', ')})`
        }
        summary.errors.push(errorMsg)
        continue
      }

      if (card.mainType === 'Héros') {
        if (summary.hero) {
          summary.errors.push(`Ligne ${lineNumber}: héros "${summary.hero}" remplacé par "${cardName}"`)
        }
        summary.hero = cardName
      } else if (card.mainType === 'Havre-Sac' || card.mainType === 'Havre-sac') {
        if (summary.havreSac) {
          summary.errors.push(`Ligne ${lineNumber}: havre-sac "${summary.havreSac}" remplacé par "${cardName}"`)
        }
        summary.havreSac = cardName
      } else {
        totalCards += quantity
      }
    }

  summary.cardCount = totalCards

  // Vérifications finales
  if (!summary.hero) {
    summary.errors.push('Aucun héros défini')
  }
  if (!summary.havreSac) {
    summary.errors.push('Aucun havre-sac défini')
  }
  if (totalCards !== 48) {
    summary.errors.push(`Nombre de cartes incorrect: ${totalCards}/48`)
  }

  console.log('📊 Résumé final:', summary)
  importSummary.value = summary
  } catch (error) {
    console.error('❌ Erreur dans analyzeImportText:', error)
    console.error('❌ Stack trace:', error.stack)
  }
}

// Méthodes de filtrage
function filterDecks() {
  let filtered = [...decks.value]

  // Filtre par nom
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter((deck) =>
      deck.name.toLowerCase().includes(query)
    )
  }

  // Filtre par statut
  if (filterStatus.value === 'valid') {
    filtered = filtered.filter((deck) => isDeckValid(deck))
  } else if (filterStatus.value === 'invalid') {
    filtered = filtered.filter((deck) => !isDeckValid(deck))
  }

  filteredDecks.value = filtered
}

function resetFilters() {
  searchQuery.value = ''
  filterStatus.value = 'all'
  filterDecks()
}

// Méthodes utilitaires
function isDeckValid(deck: any): boolean {
  const hasHero = !!deck.hero
  const hasHavreSac = !!deck.havreSac
  const cardsCount = getCardsCount(deck)

  return hasHero && hasHavreSac && cardsCount === 48
}

function getCardsCount(deck: any): number {
  return deck.cards.reduce((acc: number, card: any) => acc + card.quantity, 0)
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

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return "à l'instant"
  if (diffInSeconds < 3600)
    return `il y a ${Math.floor(diffInSeconds / 60)} minutes`
  if (diffInSeconds < 86400)
    return `il y a ${Math.floor(diffInSeconds / 3600)} heures`

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

// Gestion des decks
function confirmDeleteDeck(deckId: string, deckName: string) {
  if (confirm(`Êtes-vous sûr de vouloir supprimer le deck "${deckName}" ?`)) {
    deckStore.deleteDeck(deckId)
    toast.success(`Deck "${deckName}" supprimé`, { duration: 3000 })
    filterDecks()
  }
}

// Import/export de decks
function exportDeck(deckId: string) {
  const deck = decks.value.find((d) => d.id === deckId)
  if (!deck) {
    toast.error('Deck non trouvé', { duration: 3000 })
    return
  }

  if (!isDeckValid(deck)) {
    toast.warning('Ce deck est incomplet et ne peut pas être exporté', {
      title: 'Deck incomplet',
      duration: 3000,
    })
    return
  }

  exportedDeckText.value = deckStore.exportDeck(deckId)
  currentExportDeckId.value = deckId
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

function confirmImportDeck() {
  if (!importDeckText.value.trim()) {
    toast.warning('Veuillez entrer un deck à importer', { duration: 3000 })
    return
  }

  const importResult = deckStore.importDeck(importDeckText.value)
  
  if (importResult.success && importResult.deckId) {
    // Construire le message de succès avec les statistiques
    let successMessage = `Deck importé avec succès !`
    if (importResult.stats.cardsAdded > 0) {
      successMessage += `\n${importResult.stats.cardsAdded} cartes ajoutées`
    }
    if (importResult.stats.heroSet) {
      successMessage += `\nHéros défini`
    }
    if (importResult.stats.havreSacSet) {
      successMessage += `\nHavre-sac défini`
    }

    // Afficher les avertissements s'il y en a
    if (importResult.warnings.length > 0) {
      toast.warning(importResult.warnings.join('\n'), {
        title: 'Importation avec avertissements',
        duration: 5000,
      })
    }

    toast.success(successMessage, {
      title: 'Importation réussie',
      duration: 4000,
    })
    
    showImportModal.value = false
    importDeckText.value = ''
    filterDecks()

    // Rediriger vers la page du deck importé
    router.push(`/deck/${importResult.deckId}`)
  } else {
    // Construire le message d'erreur détaillé
    let errorMessage = "Impossible d'importer le deck"
    if (importResult.errors.length > 0) {
      errorMessage += `\n\nErreurs:\n${importResult.errors.join('\n')}`
    }
    if (importResult.warnings.length > 0) {
      errorMessage += `\n\nAvertissements:\n${importResult.warnings.join('\n')}`
    }

    toast.error(errorMessage, {
      title: "Erreur d'importation",
      duration: 8000,
    })
  }
}
</script>

<style scoped>
.deck-card {
  transition: all 0.3s ease;
}

.deck-card:hover {
  transform: translateY(-5px);
}
</style>
