import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { useCardStore } from './stores/cardStore'
// import { loadAllCards } from './services/cardLoader'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

async function initializeApp() {
  const cardStore = useCardStore()

  try {
    // Initialiser (cartes + collection locale)
    await cardStore.initialize()

    // Monter l'application
    app.mount('#app')

    // Mettre en place la sauvegarde automatique locale
    cardStore.setupAutoSync()
  } catch (error) {
    console.error("Erreur critique lors de l'initialisation de l'application:", error)
    // Optionnel: afficher un message d'erreur à l'utilisateur
  }
}

initializeApp()
