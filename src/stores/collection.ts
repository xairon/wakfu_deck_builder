import { defineStore } from 'pinia'
import { ref } from 'vue'

// Format de la collection : { cardId: { normal: number, foil: number } }
type Collection = Record<string, { normal: number; foil: number }>

const STORAGE_KEY = 'wakfu-collection'

export const useCollectionStore = defineStore('collection', () => {
  const collection = ref<Collection>({})

  // Charger la collection depuis le fichier
  async function loadCollection() {
    try {
      // Toujours charger depuis le serveur en premier
      const response = await fetch('/api/collection/initial')
      const data = await response.json()
      collection.value = data

      // Mettre à jour le localStorage avec les données du serveur
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Erreur lors du chargement de la collection:', error)
      // En cas d'erreur, essayer de charger depuis le localStorage
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        collection.value = JSON.parse(stored)
      } else {
        collection.value = {}
      }
    }
  }

  // Sauvegarder la collection dans le localStorage et sur le serveur
  async function saveCollection() {
    try {
      const collectionData = JSON.stringify(collection.value)

      // Sauvegarder dans le localStorage
      localStorage.setItem(STORAGE_KEY, collectionData)

      // Sauvegarder sur le serveur
      const response = await fetch('/api/collection/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: collectionData,
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde sur le serveur')
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la collection:', error)
    }
  }

  // Ajouter une carte
  async function addCard(cardId: string, isFoil: boolean = false) {
    if (!collection.value[cardId]) {
      collection.value[cardId] = { normal: 0, foil: 0 }
    }

    if (isFoil) {
      collection.value[cardId].foil++
    } else {
      collection.value[cardId].normal++
    }

    await saveCollection()
  }

  // Retirer une carte
  async function removeCard(cardId: string, isFoil: boolean = false) {
    if (!collection.value[cardId]) return

    if (isFoil) {
      collection.value[cardId].foil = Math.max(
        0,
        collection.value[cardId].foil - 1
      )
    } else {
      collection.value[cardId].normal = Math.max(
        0,
        collection.value[cardId].normal - 1
      )
    }

    // Supprimer l'entrée si plus aucune carte
    if (
      collection.value[cardId].normal === 0 &&
      collection.value[cardId].foil === 0
    ) {
      delete collection.value[cardId]
    }

    await saveCollection()
  }

  // Obtenir la quantité d'une carte
  function getCardQuantity(cardId: string, isFoil: boolean = false): number {
    if (!collection.value[cardId]) return 0
    return isFoil
      ? collection.value[cardId].foil
      : collection.value[cardId].normal
  }

  // Initialiser le store
  async function initialize() {
    await loadCollection()
  }

  return {
    collection,
    addCard,
    removeCard,
    getCardQuantity,
    initialize,
  }
})
