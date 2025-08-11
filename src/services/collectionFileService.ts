import { ref, computed } from 'vue'
import type { CollectionCard } from '@/types/collection'
import { useToast } from '@/composables/useToast'

const COLLECTION_FILE_PATH = '/api/collection/load'
const COLLECTION_SAVE_PATH = '/api/collection/save'

const toast = useToast()

// Fonction pour charger depuis le serveur
async function loadFromServer(): Promise<Record<
  string,
  CollectionCard
> | null> {
  try {
    const response = await fetch(COLLECTION_FILE_PATH)
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`)
    }
    const text = await response.text()
    if (!text.trim()) {
      console.info('📝 Collection vide sur le serveur')
      return {}
    }
    const data = JSON.parse(text)
    console.log('✅ Collection chargée depuis le serveur')
    return data
  } catch (error) {
    console.error('❌ Erreur lors du chargement depuis le serveur:', error)
    return null
  }
}

// Fonction pour sauvegarder sur le serveur
async function saveToServer(
  collection: Record<string, CollectionCard>
): Promise<boolean> {
  try {
    const data = JSON.stringify(collection, null, 2)

    // Créer un FormData pour l'upload
    const formData = new FormData()
    formData.append('file', new Blob([data], { type: 'application/json' }))

    // Envoyer au serveur
    const response = await fetch(COLLECTION_SAVE_PATH, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error('Le serveur a retourné une erreur')
    }

    console.log('✅ Collection sauvegardée sur le serveur')
    return true
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde sur le serveur:', error)
    return false
  }
}

// Gestionnaire de synchronisation automatique
export function createAutoSync() {
  const lastSyncDate = ref<Date | null>(null)
  const isInitialized = ref(false)

  async function syncToFile(cards: Record<string, CollectionCard>) {
    try {
      // Sauvegarder sur le serveur
      const success = await saveToServer(cards)
      if (!success) {
        throw new Error('Erreur lors de la sauvegarde sur le serveur')
      }

      lastSyncDate.value = new Date()
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error)
      toast.error('Erreur lors de la synchronisation')
    }
  }

  async function initAutoSync() {
    try {
      // Charger depuis le serveur
      const data = await loadFromServer()

      // Si pas de données, utiliser un objet vide
      if (!data) {
        return {}
      }

      isInitialized.value = true
      return data
    } catch (error) {
      console.error(
        "❌ Erreur lors de l'initialisation de la synchronisation:",
        error
      )
      toast.error("Erreur lors de l'initialisation de la synchronisation")
      return {}
    }
  }

  return {
    initAutoSync,
    syncToFile,
    lastSyncDate: computed(() => lastSyncDate.value),
    isInitialized: computed(() => isInitialized.value),
  }
}
