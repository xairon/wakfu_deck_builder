import { defineStore } from 'pinia'
import { StorageError } from '../utils/errors'
import { useCardStore } from './cardStore'
// uiStore supprimé en mode local

/**
 * Types d'événements de synchronisation
 */
export const SYNC_EVENTS = {
  COLLECTION_UPDATED: 'collection:updated',
  STATE_UPDATED: 'state:updated',
} as const

type SyncEvent = (typeof SYNC_EVENTS)[keyof typeof SYNC_EVENTS]

/**
 * Interface pour les messages de synchronisation
 */
interface SyncMessage {
  type: SyncEvent
  payload: unknown
  timestamp: number
  tabId: string
}

/**
 * Store de synchronisation
 */
export const useSyncStore = defineStore('sync', {
  state: () => ({
    tabId: crypto.randomUUID(),
    lastSync: 0,
  }),

  actions: {
    /**
     * Initialise la synchronisation
     */
    init() {
      window.addEventListener('storage', this.handleStorageEvent)
      window.addEventListener('beforeunload', this.cleanup)
    },

    /**
     * Nettoie les listeners
     */
    cleanup() {
      window.removeEventListener('storage', this.handleStorageEvent)
      window.removeEventListener('beforeunload', this.cleanup)
    },

    /**
     * Gère les événements de stockage
     */
    handleStorageEvent(event: StorageEvent) {
      if (!event.key || !event.key.startsWith('sync:')) return

      try {
        const message = JSON.parse(event.newValue || '{}') as SyncMessage

        // Ignorer les messages provenant de cet onglet
        if (message.tabId === this.tabId) return

        // Traiter les messages de synchronisation
        this.handleSyncMessage(message)
      } catch (error) {
        console.error(
          'Erreur lors du traitement du message de synchronisation:',
          error
        )
      }
    },

    /**
     * Gère un message de synchronisation
     */
    handleSyncMessage(message: SyncMessage) {
      // Ignorer les messages plus anciens que la dernière synchronisation
      if (message.timestamp <= this.lastSync) return

      // Mettre à jour la date de dernière synchronisation
      this.lastSync = message.timestamp

      // Traiter le message en fonction de son type
      switch (message.type) {
        case SYNC_EVENTS.COLLECTION_UPDATED:
          this.handleCollectionUpdate(message.payload)
          break
        case SYNC_EVENTS.STATE_UPDATED:
          this.handleStateUpdate(message.payload)
          break
      }
    },

    /**
     * Diffuse un message de synchronisation à tous les onglets
     */
    broadcast(type: SyncEvent, payload: unknown) {
      const message: SyncMessage = {
        type,
        payload,
        timestamp: Date.now(),
        tabId: this.tabId,
      }

      try {
        localStorage.setItem(`sync:${type}`, JSON.stringify(message))
      } catch (error) {
        console.error(
          'Erreur lors de la diffusion du message de synchronisation:',
          error
        )
      }
    },

    /**
     * Gère la mise à jour de la collection
     */
    handleCollectionUpdate(payload: unknown) {
      const cardStore = useCardStore()
      cardStore.updateCollection(payload)
    },

    /**
     * Gère la mise à jour de l'état global
     */
    handleStateUpdate(payload: unknown) {
      const { store, state } = payload as {
        store: string
        state: unknown
      }

      switch (store) {
        case 'card':
          const cardStore = useCardStore()
          cardStore.$patch(state)
          break
        case 'ui':
          console.log('UI store non disponible en mode local')
          break
      }
    },
  },
})

/**
 * Plugin Pinia pour la synchronisation
 */
export function createSyncPlugin() {
  return ({ store }: { store: any }) => {
    // Synchroniser les changements d'état
    store.$subscribe((mutation: any, state: any) => {
      const syncStore = useSyncStore()

      syncStore.broadcast(SYNC_EVENTS.STATE_UPDATED, {
        store: store.$id,
        state,
      })
    })
  }
}
