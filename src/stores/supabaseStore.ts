import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, auth } from '@/services/supabase'
import type { Card } from '@/types/cards'
import { useState } from '@/composables/useState'

// Types pour Supabase
export type Collection = Record<string, { normal: number; foil: number }>

// Structure de la table collections dans Supabase
interface CollectionItem {
  id?: number
  user_id: string
  card_id: string
  normal_count: number
  foil_count: number
  updated_at: string
}

export const useSupabaseStore = defineStore('supabase', () => {
  // État
  const { state: user, setState: setUser } = useState<any>(null)
  const { state: session, setState: setSession } = useState<any>(null)
  const { state: collection, setState: setCollection } = useState<Collection>({})
  const { state: isLoading, setState: setIsLoading } = useState(false)
  const { state: isAuthenticated, setState: setIsAuthenticated } = useState(false)
  const { state: error, setState: setError } = useState<string | null>(null)
  const { state: pendingChanges, setState: setPendingChanges } = useState<any[]>([])
  const { state: isOnline, setState: setIsOnline } = useState(navigator.onLine)

  // État dérivé
  const isOfflineMode = computed(() => !isOnline.value && isAuthenticated.value)

  // Actions d'authentification
  async function signUp(email: string, password: string) {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data, error } = await auth.signUp({
        email,
        password
      })
      
      if (error) throw error
      
      setSession(data.session)
      setUser(data.user)
      setIsAuthenticated(!!data.session)
      
      return data
    } catch (error: any) {
      setError(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  async function signIn(email: string, password: string) {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data, error } = await auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      
      setSession(data.session)
      setUser(data.user)
      setIsAuthenticated(!!data.session)
      
      // Charger les données de l'utilisateur
      await Promise.all([
        loadCollection()
      ])
      
      // Configurer les abonnements en temps réel
      setupRealtimeSubscriptions()
      
      return data
    } catch (error: any) {
      setError(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  async function refreshSession() {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data, error } = await auth.refreshSession()
      
      if (error) throw error
      
      setSession(data.session)
      setUser(data.user)
      setIsAuthenticated(!!data.session)
      
      return data
    } catch (error: any) {
      setError(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  async function signOut() {
    try {
      setIsLoading(true)
      setError(null)
      
      const { error } = await auth.signOut()
      
      if (error) throw error
      
      setSession(null)
      setUser(null)
      setIsAuthenticated(false)
      setCollection({})
      
      // Nettoyer les données locales
      localStorage.removeItem('wakfu-collection')
      localStorage.removeItem('wakfu-last-sync')
      
      return true
    } catch (error: any) {
      setError(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  async function resetPassword(email: string) {
    try {
      setIsLoading(true)
      setError(null)
      
      const { error } = await auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      
      if (error) throw error
      
      return true
    } catch (error: any) {
      setError(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  async function updatePassword(newPassword: string) {
    try {
      setIsLoading(true)
      setError(null)
      
      const { error } = await auth.updateUser({
        password: newPassword
      })
      
      if (error) throw error
      
      return true
    } catch (error: any) {
      setError(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  async function initializeSession() {
    try {
      setIsLoading(true)
      setError(null)
      
      // Récupérer la session en cours
      const { data, error } = await auth.getSession()
      
      if (error) throw error
      
      if (data.session) {
        setSession(data.session)
        setUser(data.session.user)
        setIsAuthenticated(true)
        
        // Charger les données de l'utilisateur
        await Promise.all([
          loadCollection()
        ])
        
        // Configurer les abonnements en temps réel
        setupRealtimeSubscriptions()
      }
      
      // Écouter les changements de statut d'authentification
      auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setSession(session)
          setUser(session.user)
          setIsAuthenticated(true)
          
          // Charger les données de l'utilisateur si ce n'est pas déjà fait
          if (Object.keys(collection.value).length === 0) {
            Promise.all([
              loadCollection()
            ]).catch(console.error)
          }
          
          // Configurer les abonnements en temps réel
          setupRealtimeSubscriptions()
        } else if (event === 'SIGNED_OUT') {
          setSession(null)
          setUser(null)
          setIsAuthenticated(false)
          setCollection({})
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setSession(session)
        }
      })
      
      return data.session
    } catch (error: any) {
      setError(error.message)
      console.error('Erreur lors de l\'initialisation de la session :', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  async function updateUserProfile(profile: any) {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.value?.id,
          ...profile,
          updated_at: new Date().toISOString()
        })
        .select()
      
      if (error) throw error
      
      return data
    } catch (error: any) {
      setError(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  async function getUserProfile() {
    try {
      setIsLoading(true)
      setError(null)
      
      if (!user.value) return null
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.id)
        .single()
      
      if (error) throw error
      
      return data
    } catch (error: any) {
      setError(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  // Gestion de la collection
  async function loadCollection() {
    try {
      setIsLoading(true)
      setError(null)
      
      if (!user.value) return { success: false, reason: 'not_authenticated' }
      
      // Charger depuis Supabase - format card_id, normal_count, foil_count
      const { data, error } = await supabase
        .from('collections')
        .select('card_id, normal_count, foil_count')
        .eq('user_id', user.value.id)
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = Not Found
        throw error
      }
      
      // Convertir le format de la base de données vers notre format d'application
      let collectionMap: Collection = {}
      
      if (data && data.length > 0) {
        data.forEach((item: any) => {
          collectionMap[item.card_id] = {
            normal: item.normal_count || 0,
            foil: item.foil_count || 0
          }
        })
      }
      
      // Récupérer la collection locale
      const localCollectionString = localStorage.getItem('wakfu-collection')
      const localCollection: Collection = localCollectionString 
        ? JSON.parse(localCollectionString) 
        : {}
      
      // Obtenir la date de dernière synchronisation
      const lastSyncString = localStorage.getItem('wakfu-last-sync')
      const lastSync = lastSyncString ? new Date(lastSyncString) : null
      
      // Si la collection locale existe et qu'il n'y a pas de synchronisation précédente
      if (Object.keys(localCollection).length > 0 && !lastSync) {
        // Fusionner les collections
        await syncCollection(localCollection)
      } else {
        // Utiliser la collection du serveur
        setCollection(collectionMap)
        localStorage.setItem('wakfu-collection', JSON.stringify(collectionMap))
      }
      
      // Mettre à jour la date de dernière synchronisation
      localStorage.setItem('wakfu-last-sync', new Date().toISOString())
      
      return {
        success: true,
        cardCount: Object.keys(collectionMap).length
      }
    } catch (error: any) {
      setError(error.message)
      console.error('Erreur lors du chargement de la collection :', error)
      
      // Essayer de charger depuis localStorage en cas d'erreur
      const stored = localStorage.getItem('wakfu-collection')
      if (stored) {
        try {
          const localData = JSON.parse(stored)
          setCollection(localData)
          return { 
            success: true, 
            source: 'localStorage',
            cardCount: Object.keys(localData).length
          }
        } catch (e) {
          console.error('Erreur lors du chargement depuis localStorage:', e)
        }
      }
      
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  async function saveCollection() {
    try {
      if (!user.value || !isAuthenticated.value) return false
      
      // Si on est en mode hors-ligne, ajouter aux changements en attente
      if (!isOnline.value) {
        addPendingChange({
          type: 'collection_update',
          payload: collection.value
        })
        return true
      }
      
      // Préparer les données pour l'upsert - transformer notre format en format de la base de données
      const collectionData: CollectionItem[] = []
      
      // Pour chaque carte dans la collection
      for (const [cardId, counts] of Object.entries(collection.value)) {
        if (counts.normal > 0 || counts.foil > 0) {
          collectionData.push({
            user_id: user.value.id,
            card_id: cardId,
            normal_count: counts.normal,
            foil_count: counts.foil,
            updated_at: new Date().toISOString()
          })
        }
      }
      
      // Supprimer d'abord toutes les entrées de cet utilisateur
      const { error: deleteError } = await supabase
        .from('collections')
        .delete()
        .eq('user_id', user.value.id)
      
      if (deleteError) throw deleteError
      
      // Ensuite insérer les nouvelles données si la collection n'est pas vide
      if (collectionData.length > 0) {
        const { error: insertError } = await supabase
          .from('collections')
          .insert(collectionData)
        
        if (insertError) throw insertError
      }
      
      // Mettre à jour la date de dernière synchronisation
      localStorage.setItem('wakfu-last-sync', new Date().toISOString())
      
      // Sauvegarder localement
      localStorage.setItem('wakfu-collection', JSON.stringify(collection.value))
      
      return true
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde de la collection :', error)
      
      // En cas d'erreur, ajouter aux changements en attente
      addPendingChange({
        type: 'collection_update',
        payload: collection.value
      })
      
      return false
    }
  }
  
  async function addCard(cardId: string, isFoil: boolean = false) {
    // Vérifier que la carte existe dans la collection
    if (!collection.value[cardId]) {
      collection.value[cardId] = {
        normal: 0,
        foil: 0
      }
    }
    
    // Incrémenter la quantité
    if (isFoil) {
      collection.value[cardId].foil++
    } else {
      collection.value[cardId].normal++
    }
    
    // Sauvegarder localement (toujours pour une réactivité immédiate)
    localStorage.setItem('wakfu-collection', JSON.stringify(collection.value))
    
    // Sauvegarder sur le serveur si connecté
    if (isAuthenticated.value) {
      await saveCollection()
    }
    
    return true
  }
  
  async function removeCard(cardId: string, isFoil: boolean = false) {
    // Vérifier que la carte existe dans la collection
    if (!collection.value[cardId]) return false
    
    // Décrémenter la quantité
    if (isFoil) {
      if (collection.value[cardId].foil <= 0) return false
      collection.value[cardId].foil--
    } else {
      if (collection.value[cardId].normal <= 0) return false
      collection.value[cardId].normal--
    }
    
    // Supprimer l'entrée si les deux quantités sont à 0
    if (collection.value[cardId].normal === 0 && collection.value[cardId].foil === 0) {
      delete collection.value[cardId]
    }
    
    // Sauvegarder localement (toujours pour une réactivité immédiate)
    localStorage.setItem('wakfu-collection', JSON.stringify(collection.value))
    
    // Sauvegarder sur le serveur si connecté
    if (isAuthenticated.value) {
      await saveCollection()
    }
    
    return true
  }
  
  function getCardQuantity(cardId: string, isFoil: boolean = false): number {
    if (!collection.value[cardId]) return 0
    return isFoil ? collection.value[cardId].foil : collection.value[cardId].normal
  }
  
  // Gestion des abonnements en temps réel
  function setupRealtimeSubscriptions() {
    if (!user.value) return
    
    // Supprimer les anciens abonnements
    supabase.removeAllChannels()
    
    // Abonnement aux changements de collection
    supabase
      .channel('collection-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collections',
          filter: `user_id=eq.${user.value.id}`
        },
        async (payload) => {
          // Pour simplifier, rechargeons toute la collection
          await loadCollection()
        }
      )
      .subscribe()
    
    // Gestion de la connectivité
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }
  
  function handleOnline() {
    setIsOnline(true)
    
    // Synchroniser les changements en attente
    if (pendingChanges.value.length > 0) {
      synchronizePendingChanges()
    }
  }
  
  function handleOffline() {
    setIsOnline(false)
  }
  
  function addPendingChange(change: any) {
    pendingChanges.value.push(change)
    localStorage.setItem('wakfu-pending-changes', JSON.stringify(pendingChanges.value))
  }
  
  async function synchronizePendingChanges() {
    if (pendingChanges.value.length === 0 || !isOnline.value || !isAuthenticated.value) return
    
    try {
      setIsLoading(true)
      
      // Traiter les changements par type
      for (const change of pendingChanges.value) {
        switch (change.type) {
          case 'collection_update':
            // Nous utilisons simplement saveCollection pour sauvegarder la collection actuelle
            await saveCollection()
            break
        }
      }
      
      // Vider les changements en attente
      setPendingChanges([])
      localStorage.removeItem('wakfu-pending-changes')
      
      // Mettre à jour la date de dernière synchronisation
      localStorage.setItem('wakfu-last-sync', new Date().toISOString())
    } catch (error) {
      console.error('Erreur lors de la synchronisation des changements en attente :', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Gestion de la session
  async function getSession() {
    try {
      const { data, error } = await auth.getSession()
      
      if (error) throw error
      
      return data.session
    } catch (error) {
      console.error('Erreur lors de la récupération de la session :', error)
      return null
    }
  }
  
  // Synchronisation des collections
  async function syncCollection(localCollection: Collection) {
    // Charger la collection actuelle depuis le serveur
    const { data } = await supabase
      .from('collections')
      .select('card_id, normal_count, foil_count')
      .eq('user_id', user.value.id)
    
    const serverCollection: Collection = {}
    
    if (data) {
      data.forEach((item: any) => {
        serverCollection[item.card_id] = {
          normal: item.normal_count || 0,
          foil: item.foil_count || 0
        }
      })
    }
    
    // Fusionner les collections locale et serveur
    const mergedCollection: Collection = { ...serverCollection }
    
    // Ajouter les cartes locales qui ne sont pas sur le serveur
    // ou ajouter les quantités si plus grandes localement
    Object.keys(localCollection).forEach(cardId => {
      if (!mergedCollection[cardId]) {
        mergedCollection[cardId] = localCollection[cardId]
      } else {
        mergedCollection[cardId].normal = Math.max(
          mergedCollection[cardId].normal,
          localCollection[cardId].normal
        )
        mergedCollection[cardId].foil = Math.max(
          mergedCollection[cardId].foil,
          localCollection[cardId].foil
        )
      }
    })
    
    // Mettre à jour la collection dans le store
    setCollection(mergedCollection)
    
    // Sauvegarder localement
    localStorage.setItem('wakfu-collection', JSON.stringify(mergedCollection))
    
    // Enregistrer sur le serveur
    await saveCollection()
    
    return mergedCollection
  }

  // Initialiser les écouteurs
  function initializeListeners() {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Charger les changements en attente depuis localStorage
    const pendingChangesString = localStorage.getItem('wakfu-pending-changes')
    if (pendingChangesString) {
      try {
        const changes = JSON.parse(pendingChangesString)
        if (Array.isArray(changes)) {
          setPendingChanges(changes)
        }
      } catch (e) {
        console.error('Erreur lors du chargement des changements en attente :', e)
        localStorage.removeItem('wakfu-pending-changes')
      }
    }
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      supabase.removeAllChannels()
    }
  }
  
  // Exposer l'API
  return {
    // État
    user,
    session,
    collection,
    isLoading,
    isAuthenticated,
    isOnline,
    isOfflineMode,
    error,
    pendingChanges,
    
    // Actions d'authentification
    signUp,
    signIn,
    refreshSession,
    signOut,
    resetPassword,
    updatePassword,
    initializeSession,
    updateUserProfile,
    getUserProfile,
    getSession,
    
    // Actions de collection
    loadCollection,
    saveCollection,
    addCard,
    removeCard,
    getCardQuantity,
    
    // Gestion des abonnements
    setupRealtimeSubscriptions,
    synchronizePendingChanges,
    initializeListeners
  }
}) 