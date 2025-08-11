/**
 * Service de stockage local pour la collection et les decks
 * Remplace Supabase pour un fonctionnement en mode local
 */

export const LOCAL_STORAGE_KEYS = {
  COLLECTION: 'wakfu-collection',
  DECKS: 'wakfu-decks',
  SETTINGS: 'wakfu-settings',
} as const

export interface LocalStorageService {
  // Collection
  saveCollection(collection: Record<string, any>): void
  loadCollection(): Record<string, any>
  
  // Decks
  saveDecks(decks: any[]): void
  loadDecks(): any[]
  
  // Settings
  saveSettings(settings: Record<string, any>): void
  loadSettings(): Record<string, any>
  
  // Utilitaires
  clear(): void
  export(): string
  import(data: string): boolean
}

class LocalStorageServiceImpl implements LocalStorageService {
  /**
   * Sauvegarde la collection dans localStorage
   */
  saveCollection(collection: Record<string, any>): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.COLLECTION, JSON.stringify(collection))
      console.log('✅ Collection sauvegardée localement')
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde de la collection:', error)
      throw new Error('Impossible de sauvegarder la collection')
    }
  }

  /**
   * Charge la collection depuis localStorage
   */
  loadCollection(): Record<string, any> {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEYS.COLLECTION)
      if (!data) {
        console.log('📁 Aucune collection trouvée, création d\'une nouvelle')
        return {}
      }
      
      const collection = JSON.parse(data)
      console.log(`📊 Collection chargée avec ${Object.keys(collection).length} cartes`)
      return collection
    } catch (error) {
      console.error('❌ Erreur lors du chargement de la collection:', error)
      return {}
    }
  }

  /**
   * Sauvegarde les decks dans localStorage
   */
  saveDecks(decks: any[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.DECKS, JSON.stringify(decks))
      console.log(`✅ ${decks.length} deck(s) sauvegardé(s) localement`)
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des decks:', error)
      throw new Error('Impossible de sauvegarder les decks')
    }
  }

  /**
   * Charge les decks depuis localStorage
   */
  loadDecks(): any[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEYS.DECKS)
      if (!data) {
        console.log('📁 Aucun deck trouvé, création d\'une liste vide')
        return []
      }
      
      const decks = JSON.parse(data)
      console.log(`🃏 ${decks.length} deck(s) chargé(s)`)
      return decks
    } catch (error) {
      console.error('❌ Erreur lors du chargement des decks:', error)
      return []
    }
  }

  /**
   * Sauvegarde les paramètres dans localStorage
   */
  saveSettings(settings: Record<string, any>): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
      console.log('✅ Paramètres sauvegardés localement')
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des paramètres:', error)
      throw new Error('Impossible de sauvegarder les paramètres')
    }
  }

  /**
   * Charge les paramètres depuis localStorage
   */
  loadSettings(): Record<string, any> {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS)
      if (!data) {
        const defaultSettings = {
          theme: 'auto',
          language: 'fr',
          autoSave: true,
        }
        this.saveSettings(defaultSettings)
        return defaultSettings
      }
      
      return JSON.parse(data)
    } catch (error) {
      console.error('❌ Erreur lors du chargement des paramètres:', error)
      return {
        theme: 'auto',
        language: 'fr',
        autoSave: true,
      }
    }
  }

  /**
   * Vide toutes les données stockées
   */
  clear(): void {
    try {
      Object.values(LOCAL_STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
      })
      console.log('🗑️ Toutes les données locales supprimées')
    } catch (error) {
      console.error('❌ Erreur lors de la suppression des données:', error)
      throw new Error('Impossible de supprimer les données')
    }
  }

  /**
   * Exporte toutes les données en JSON
   */
  export(): string {
    try {
      const exportData = {
        collection: this.loadCollection(),
        decks: this.loadDecks(),
        settings: this.loadSettings(),
        exportDate: new Date().toISOString(),
        version: '1.0',
      }
      
      return JSON.stringify(exportData, null, 2)
    } catch (error) {
      console.error('❌ Erreur lors de l\'export:', error)
      throw new Error('Impossible d\'exporter les données')
    }
  }

  /**
   * Importe des données depuis un JSON
   */
  import(data: string): boolean {
    try {
      const importData = JSON.parse(data)
      
      // Validation basique
      if (!importData.collection && !importData.decks) {
        throw new Error('Format de données invalide')
      }
      
      // Import des données
      if (importData.collection) {
        this.saveCollection(importData.collection)
      }
      
      if (importData.decks) {
        this.saveDecks(importData.decks)
      }
      
      if (importData.settings) {
        this.saveSettings(importData.settings)
      }
      
      console.log('✅ Données importées avec succès')
      return true
    } catch (error) {
      console.error('❌ Erreur lors de l\'import:', error)
      return false
    }
  }
}

// Instance singleton
export const localStorageService = new LocalStorageServiceImpl()

/**
 * Hook pour utiliser le service de stockage local
 */
export function useLocalStorage() {
  return localStorageService
}
