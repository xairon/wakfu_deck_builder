import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Card, HeroCard } from '@/types/cards'
import { loadAllCards } from '@/services/cardLoader'
import { useLocalStorage } from '@vueuse/core'
import { useSupabaseStore } from '@/stores/supabaseStore'
import { useI18n } from 'vue-i18n'

export interface CollectionCard {
  card: Card
  quantity: number
  foilQuantity: number
}

export const useCardStore = defineStore('cards', () => {
  // État
  const cards = ref<Card[]>([])
  const collection = ref<Record<string, { normal: number; foil: number }>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isInitializing = ref(false)
  const isInitialized = ref(false)
  const initializationAttempts = ref(0)
  const MAX_INIT_ATTEMPTS = 3
  const selectedCard = ref<Card | null>(null)
  const searchQuery = ref('')
  const selectedExtension = ref<string | null>(null)
  
  // État de synchronisation
  const lastSync = useLocalStorage<string | null>('wakfu-last-sync', null)
  const isSyncing = ref(false)
  
  // Variable pour le délai de synchronisation
  let syncTimeout: number | null = null
  
  // Fonction debounce pour éviter de synchroniser trop souvent
  function debounceSync() {
    if (syncTimeout) {
      clearTimeout(syncTimeout)
    }
    syncTimeout = window.setTimeout(async () => {
      const result = await syncWithSupabase()
      
      // Ne pas afficher de message d'erreur si la propriété silent est true
      if (!result.success && !result.silent) {
        console.warn('⚠️ Échec de la synchronisation automatique:', result.reason)
      }
    }, 2000) // Délai de 2 secondes
  }

  // Getters
  const totalCards = computed(() => cards.value.length)
  const totalCollection = computed(() => {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      return 0;
    }
    
    return Object.values(collection.value).reduce(
      (acc, { normal, foil }) => acc + normal + foil, 0
    );
  })
  const collectionProgress = computed(() => {
    // Vérifier si les cartes sont chargées
    if (cards.value.length === 0) {
      return 0;
    }
    
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      return 0;
    }
    
    const uniqueCardsInCollection = Object.keys(collection.value).length;
    return Math.round((uniqueCardsInCollection / cards.value.length) * 100);
  })
  
  const cardsByType = computed(() => {
    const types: Record<string, Card[]> = {}
    cards.value.forEach(card => {
      if (!types[card.mainType]) {
        types[card.mainType] = []
      }
      types[card.mainType].push(card)
    })
    return types
  })

  const cardsByExtension = computed(() => {
    const extensions: Record<string, Card[]> = {}
    cards.value.forEach(card => {
      if (!extensions[card.extension]) {
        extensions[card.extension] = []
      }
      extensions[card.extension].push(card)
    })
    return extensions
  })

  function getCardQuantity(cardId: string): number {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      console.warn('Collection non initialisée lors de l\'appel à getCardQuantity');
      return 0;
    }
    
    // Vérifier si la carte existe dans la collection
    if (!cardId || !collection.value[cardId]) {
      return 0;
    }
    
    // Retourner la quantité normale de la carte
    return collection.value[cardId].normal || 0;
  }

  function getFoilCardQuantity(cardId: string): number {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      console.warn('Collection non initialisée lors de l\'appel à getFoilCardQuantity');
      return 0;
    }
    
    // Vérifier si la carte existe dans la collection
    if (!cardId || !collection.value[cardId]) {
      return 0;
    }
    
    // Retourner la quantité foil de la carte
    return collection.value[cardId].foil || 0;
  }

  const filteredCards = computed(() => {
    let filtered = cards.value

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter(card => 
        card.name.toLowerCase().includes(query) ||
        card.subTypes.some(type => type.toLowerCase().includes(query))
      )
    }

    if (selectedExtension.value) {
      filtered = filtered.filter(card => 
        card.extension.name === selectedExtension.value
      )
    }

    return filtered
  })

  const extensions = computed(() => {
    const uniqueExtensions = new Set(cards.value.map(card => card.extension.name))
    return Array.from(uniqueExtensions).sort()
  })

  const collectionStats = computed(() => {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      return {
        totalCards: 0,
        totalQuantity: 0,
        normalCards: 0,
        foilCards: 0
      };
    }
    
    const totalCards = Object.keys(collection.value).length;
    const totalQuantity = Object.values(collection.value).reduce(
      (acc, { normal, foil }) => acc + normal + foil, 0
    );
    
    return {
      totalCards,
      totalQuantity,
      normalCards: Object.values(collection.value).reduce((acc, { normal }) => acc + normal, 0),
      foilCards: Object.values(collection.value).reduce((acc, { foil }) => acc + foil, 0)
    };
  })

  // Getter pour vérifier si l'utilisateur est authentifié
  const isAuthenticated = computed(() => {
    const supabaseStore = useSupabaseStore()
    return supabaseStore.isAuthenticated
  })
  
  // Formater la date de dernière synchronisation
  const formatLastSync = computed(() => {
    if (!lastSync.value) return 'Jamais'
    
    const syncDate = new Date(lastSync.value)
    const now = new Date()
    const diffMs = now.getTime() - syncDate.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)
    
    if (diffSec < 60) return 'À l\'instant'
    if (diffMin < 60) return `Il y a ${diffMin} min`
    if (diffHour < 24) return `Il y a ${diffHour} h`
    if (diffDay < 7) return `Il y a ${diffDay} j`
    
    // Format date pour plus de 7 jours
    return syncDate.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit'
    })
  })

  // Actions
  async function initialize() {
    try {
      isInitializing.value = true
      console.log('🚀 Initialisation du cardStore...')
      
      // Vérifier si les données sont déjà chargées
      if (isInitialized.value && cards.value.length > 0) {
        console.log(`✅ Base de données déjà initialisée avec ${cards.value.length} cartes`)
        return
      }
      
      try {
        // Charger les cartes en utilisant le service cardLoader
        console.log('📥 Chargement des cartes avec cardLoader...')
        const loadedCards = await loadAllCards()
        
        if (!Array.isArray(loadedCards) || loadedCards.length === 0) {
          console.error('❌ Aucune carte chargée ou format invalide:', loadedCards)
          throw new Error('Aucune carte n\'a pu être chargée')
        }
        
        console.log(`✅ ${loadedCards.length} cartes chargées depuis cardLoader`)
        setCards(loadedCards)
      } catch (loadError) {
        console.error('❌ Erreur lors du chargement des cartes:', loadError)
        
        // Fallback: essayer de charger depuis l'API
        console.log('🔄 Tentative de secours: chargement depuis l\'API...')
        const response = await fetch('/api/collection/initial')
        
        if (!response.ok) {
          throw new Error(`Erreur lors du chargement des cartes: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data && data.cards && Array.isArray(data.cards)) {
          setCards(data.cards)
        } else {
          // Si aucune source ne fonctionne, initialiser avec un tableau vide
          console.warn('⚠️ Aucune source de données disponible, initialisation avec un tableau vide')
          setCards([])
        }
      }
      
      // S'assurer que la collection est initialisée comme un objet vide si elle ne l'est pas déjà
      if (!collection.value) {
        collection.value = {}
        console.log('📊 Collection initialisée comme un objet vide')
      }
      
      // Récupérer la collection depuis Supabase si l'utilisateur est connecté
      const supabaseStore = useSupabaseStore()
      if (supabaseStore.isAuthenticated) {
        console.log('🔄 Utilisateur connecté, récupération de la collection depuis Supabase...')
        
        // Charger la collection
        const collectionResult = await supabaseStore.loadCollection()
        
        if (collectionResult && collectionResult.success) {
          // Copier la collection de Supabase dans le cardStore
          console.log(`📊 Collection chargée avec ${collectionResult.cardCount} cartes`)
          importCollectionFromSupabase(supabaseStore.collection)
          
          // Afficher la structure de la collection pour débogage
          console.log('Structure de la collection:', JSON.stringify(collection.value).substring(0, 500) + '...')
          console.log('Exemple de carte dans la collection:', Object.keys(collection.value)[0], collection.value[Object.keys(collection.value)[0]])
        } else {
          console.warn('⚠️ Échec du chargement de la collection:', collectionResult?.reason || 'raison inconnue')
          
          // Essayer de charger depuis localStorage en cas d'échec
          const localCollection = localStorage.getItem('wakfu-collection')
          if (localCollection) {
            try {
              const collectionData = JSON.parse(localCollection)
              importCollectionFromSupabase(collectionData)
              console.log('📊 Collection chargée depuis localStorage')
            } catch (err) {
              console.error('❌ Erreur lors du chargement de la collection locale:', err)
            }
          }
        }
      } else {
        console.log('ℹ️ Utilisateur non connecté, utilisation de la collection locale')
        // Charger depuis localStorage si disponible
        const localCollection = localStorage.getItem('wakfu-collection')
        if (localCollection) {
          try {
            const collectionData = JSON.parse(localCollection)
            collection.value = collectionData
            console.log(`📊 Collection locale chargée avec ${Object.keys(collectionData).length} cartes`)
          } catch (err) {
            console.error('❌ Erreur lors du chargement de la collection locale:', err)
          }
        }
      }
      
      // Marquer comme initialisé
      isInitialized.value = true
      console.log('✅ CardStore initialisé avec succès')
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation du cardStore:', error)
      throw error
    } finally {
      isInitializing.value = false
    }
  }

  // Importer la collection depuis Supabase
  function importCollectionFromSupabase(supabaseCollection: any) {
    if (!supabaseCollection) {
      console.warn('⚠️ Collection Supabase vide, rien à importer');
      return;
    }
    
    console.log('🔄 Importation de la collection depuis Supabase...');
    
    try {
      // Vérifier que la collection a le bon format
      if (typeof supabaseCollection !== 'object') {
        console.error('❌ Format de collection invalide:', typeof supabaseCollection);
        return;
      }
      
      // Copier les données
      collection.value = { ...supabaseCollection };
      
      // Sauvegarder dans localStorage
      localStorage.setItem('wakfu-collection', JSON.stringify(collection.value));
      
      console.log(`✅ Collection importée avec ${Object.keys(collection.value).length} cartes`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'importation de la collection:', error);
    }
  }

  async function addToCollection(card: Card, quantity = 1, isFoil = false) {
    if (!isInitialized.value) {
      await initialize()
    }

    console.log(`➕ Ajout de ${quantity} ${card.name} à la collection (${isFoil ? 'foil' : 'normal'})`)
    
    // Create the card entry if it doesn't exist
    if (!collection.value[card.id]) {
      collection.value[card.id] = { normal: 0, foil: 0 }
    }
    
    // Increment the appropriate counter
    if (isFoil) {
      collection.value[card.id].foil += quantity
    } else {
      collection.value[card.id].normal += quantity
    }
    
    // Force save to localStorage
    localStorage.setItem('wakfu-collection', JSON.stringify(collection.value))
    console.log('💾 Collection sauvegardée dans localStorage:', collection.value)
    
    // Tenter une synchronisation avec Supabase si connecté
    syncWithSupabase().catch(err => {
      console.warn('⚠️ Synchronisation échouée, les modifications sont sauvegardées localement', err)
    })
  }

  async function removeFromCollection(card: Card, quantity = 1, isFoil = false) {
    if (!isInitialized.value) {
      await initialize()
    }

    console.log(`➖ Retrait de ${quantity} ${card.name} de la collection (${isFoil ? 'foil' : 'normal'})`)
    
    // If the card doesn't exist in the collection, nothing to do
    if (!collection.value[card.id]) return
    
    // Decrement the appropriate counter
    if (isFoil) {
      collection.value[card.id].foil = Math.max(0, collection.value[card.id].foil - quantity)
    } else {
      collection.value[card.id].normal = Math.max(0, collection.value[card.id].normal - quantity)
    }
    
    // Remove the card entry if both normal and foil counts are zero
    if (collection.value[card.id].normal === 0 && collection.value[card.id].foil === 0) {
      delete collection.value[card.id]
    }
    
    // Force save to localStorage
    localStorage.setItem('wakfu-collection', JSON.stringify(collection.value))
    console.log('💾 Collection sauvegardée dans localStorage après suppression')
    
    // Tenter une synchronisation avec Supabase si connecté
    syncWithSupabase().catch(err => {
      console.warn('⚠️ Synchronisation échouée, les modifications sont sauvegardées localement', err)
    })
  }

  async function getCardById(id: string): Promise<Card | undefined> {
    if (!isInitialized.value) {
      await initialize()
    }
    return cards.value.find(card => card.id === id)
  }

  async function findCardsByName(name: string): Promise<Card[]> {
    if (!isInitialized.value) {
      await initialize()
    }

    const searchName = name.toLowerCase()
    return cards.value.filter(card => 
      card.name.toLowerCase().includes(searchName)
    )
  }

  function loadCards(newCards: Card[]) {
    cards.value = newCards
  }

  function setCards(newCards: Card[]) {
    console.log(`📊 Chargement de ${newCards.length} cartes dans le store`)
    
    if (!Array.isArray(newCards)) {
      console.error('❌ setCards: newCards n\'est pas un tableau', newCards)
      return
    }
    
    cards.value = newCards
    
    console.log('✅ Cartes chargées avec succès')
  }

  function selectCard(card: Card | null) {
    selectedCard.value = card
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function setSelectedExtension(extension: string | null) {
    selectedExtension.value = extension
  }

  // Fonction de réinitialisation du store
  function reset() {
    cards.value = []
    isInitialized.value = false
    initializationAttempts.value = 0
    error.value = null
    loading.value = false
  }

  async function importCollection(data: CollectionCard[]) {
    if (!isInitialized.value) {
      await initialize()
    }
    
    // Convert the old array format to the new Record format
    const newCollection: Record<string, { normal: number, foil: number }> = {};
    
    data.forEach(item => {
      newCollection[item.card.id] = {
        normal: item.quantity,
        foil: item.foilQuantity
      };
    });
    
    collection.value = newCollection;
  }

  function exportCollection(): CollectionCard[] {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      console.warn('Collection non initialisée lors de l\'appel à exportCollection');
      return [];
    }
    
    // Convertir le format Record en format tableau pour l'export
    const exportData: CollectionCard[] = [];
    
    for (const [cardId, quantities] of Object.entries(collection.value)) {
      const card = cards.value.find(c => c.id === cardId);
      if (card) {
        exportData.push({
          card,
          quantity: quantities.normal,
          foilQuantity: quantities.foil
        });
      } else {
        console.warn(`Carte avec ID ${cardId} non trouvée lors de l'export`);
      }
    }
    
    return exportData;
  }

  function isCardOwned(card: Card): boolean {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      console.warn('Collection non initialisée lors de l\'appel à isCardOwned');
      return false;
    }
    
    // Vérifier si la carte existe et a une quantité positive
    return Boolean(
      card && 
      card.id && 
      collection.value[card.id] && 
      (collection.value[card.id].normal > 0 || collection.value[card.id].foil > 0)
    );
  }

  function getTotalCardQuantity(cardId: string): number {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      console.warn('Collection non initialisée lors de l\'appel à getTotalCardQuantity');
      return 0;
    }
    
    // Utiliser les fonctions existantes pour obtenir les quantités
    return getCardQuantity(cardId) + getFoilCardQuantity(cardId);
  }
  
  async function syncWithSupabase() {
    const supabaseStore = useSupabaseStore()
    
    // Si l'utilisateur n'est pas connecté, ne pas tenter de synchroniser
    // mais ne pas afficher de message d'erreur, car c'est un comportement normal
    if (!supabaseStore.isAuthenticated) {
      console.log('ℹ️ Utilisateur non connecté, pas de synchronisation')
      return { success: false, reason: 'not_authenticated', silent: true }
    }
    
    try {
      // Mettre à jour l'état de synchronisation
      isSyncing.value = true
      
      console.log('🔄 Synchronisation de la collection avec Supabase...')
      
      // Au lieu de vérifier la session, vérifier simplement si l'utilisateur est authentifié
      // car getSession n'est pas exposé par supabaseStore
      if (!supabaseStore.isAuthenticated || !supabaseStore.userId) {
        console.warn('⚠️ Session invalide ou expirée, impossible de synchroniser')
        return { 
          success: false, 
          reason: 'session_invalid',
          silent: true // Ne pas afficher de message d'erreur
        }
      }
      
      // Synchroniser la collection
      const result = await supabaseStore.syncCollection(collection.value)
      
      if (!result.success) {
        console.error('❌ Échec de la synchronisation:', result.error)
        return { 
          success: false, 
          reason: 'sync_failed',
          error: result.error
        }
      }
      
      // Mettre à jour la date de dernière synchronisation
      lastSync.value = new Date().toISOString()
      
      console.log('✅ Collection synchronisée avec succès!')
      return { 
        success: true, 
        timestamp: lastSync.value,
        cardCount: Object.keys(collection.value).length
      }
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error)
      return { 
        success: false, 
        reason: 'exception',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }
    } finally {
      // Réinitialiser l'état de synchronisation
      isSyncing.value = false
    }
  }

  // Fonction pour synchroniser automatiquement la collection
  function setupAutoSync() {
    const supabaseStore = useSupabaseStore()
    
    // S'il n'y a pas de supabaseStore, ne pas configurer la synchronisation
    if (!supabaseStore) {
      console.warn('⚠️ Impossible de configurer la synchronisation: supabaseStore non disponible')
      return
    }
    
    // Observer les changements de collection pour synchroniser automatiquement
    watch(() => collection.value, async (newCollection, oldCollection) => {
      // Ne synchroniser que si l'utilisateur est connecté et qu'il y a eu un changement
      if (supabaseStore.isAuthenticated && JSON.stringify(newCollection) !== JSON.stringify(oldCollection)) {
        console.log('🔄 Collection modifiée, synchronisation automatique...')
        
        // Attendre un peu pour éviter trop de requêtes
        debounceSync()
      }
    }, { deep: true })
    
    // Synchroniser périodiquement si l'utilisateur est connecté
    setInterval(async () => {
      if (supabaseStore.isAuthenticated && !isSyncing.value) {
        console.log('🔄 Synchronisation périodique...')
        const result = await syncWithSupabase()
        
        // Ne pas afficher de message d'erreur pour les synchronisations périodiques
        if (!result.success && !result.silent) {
          console.warn('⚠️ Échec de la synchronisation périodique:', result.reason)
        }
      }
    }, 5 * 60 * 1000) // Toutes les 5 minutes
  }

  return {
    // État
    cards,
    collection,
    isInitializing,
    isInitialized,
    error,
    lastSync,
    isSyncing,

    // Getters
    totalCards,
    totalCollection,
    collectionProgress,
    collectionStats,
    formatLastSync,
    isAuthenticated,
    extensions,

    // Actions
    initialize,
    addToCollection,
    removeFromCollection,
    getCardById,
    getCardQuantity,
    getFoilCardQuantity,
    findCardsByName,
    importCollection,
    exportCollection,
    syncWithSupabase,
    setupAutoSync,
    isCardOwned,
    getTotalCardQuantity
  }
}) 