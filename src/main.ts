import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { useSupabaseStore } from './stores/supabaseStore'
import { useCardStore } from './stores/cardStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Initialiser la session avant de monter l'application
const supabaseStore = useSupabaseStore()

// Attendre l'initialisation de la session avant de monter l'application
supabaseStore.initializeSession()
  .then(({ user }) => {
    console.log('Session initialisée', { user: user?.email || 'Aucun utilisateur connecté' })
    
    // Monter l'application une fois la session initialisée
    app.mount('#app')
    
    // Initialiser le cardStore après le montage
    const cardStore = useCardStore()
    cardStore.setupAutoSync()
  })
  .catch(error => {
    console.error('Erreur lors de l\'initialisation de la session', error)
    
    // Monter l'application même en cas d'erreur
    app.mount('#app')
    
    // Initialiser le cardStore après le montage
    const cardStore = useCardStore()
    cardStore.setupAutoSync()
  }) 