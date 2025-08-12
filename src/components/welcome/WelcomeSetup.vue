<template>
  <div class="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
    <div class="max-w-2xl w-full">
      <!-- Card principale -->
      <div class="card bg-base-100 shadow-2xl">
        <div class="card-body text-center">
          <!-- Header -->
          <div class="mb-6">
            <h1 class="text-4xl font-bold text-primary mb-2">
              🎴 Bienvenue dans Wakfu Deck Builder !
            </h1>
            <p class="text-lg text-base-content/70">
              Créateur de decks pour le jeu de cartes Wakfu TCG
            </p>
          </div>

          <!-- Étapes d'initialisation -->
          <div v-if="!isInitializing && !initializationComplete" class="space-y-6">
            <div class="bg-base-200 rounded-lg p-6">
              <h2 class="text-2xl font-semibold mb-4">🚀 Configuration automatique</h2>
              <p class="text-base-content/80 mb-4">
                Pour commencer, nous pouvons configurer automatiquement votre collection avec les decks officiels :
              </p>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                <!-- Incarnam Starters -->
                <div class="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4">
                  <h3 class="font-semibold text-lg mb-2">🎭 Incarnam Starters</h3>
                  <ul class="text-sm text-left space-y-1">
                    <li>• Feca (Défense)</li>
                    <li>• Crâ (Distance)</li>
                    <li>• Iop (Attaque)</li>
                    <li>• Xélor (Contrôle)</li>
                  </ul>
                </div>
                
                <!-- Bonta & Brâkmar -->
                <div class="bg-gradient-to-r from-yellow-500/10 to-red-500/10 rounded-lg p-4">
                  <h3 class="font-semibold text-lg mb-2">⚔️ Bonta & Brâkmar</h3>
                  <ul class="text-sm text-left space-y-1">
                    <li>• Sadida (Nature/Feu)</li>
                    <li>• Sram (Furtif/Air)</li>
                  </ul>
                </div>
              </div>

              <div class="bg-info/10 rounded-lg p-4 mb-6">
                <div class="flex items-center justify-center gap-2 mb-2">
                  <i class="fas fa-info-circle text-info"></i>
                  <span class="font-semibold">Ce qui sera ajouté :</span>
                </div>
                <ul class="text-sm space-y-1">
                  <li>✅ <strong>~150+ cartes</strong> automatiquement ajoutées à votre collection</li>
                  <li>✅ <strong>6 decks prêts à jouer</strong> dans votre liste de decks</li>
                  <li>✅ <strong>Tous les héros et havre-sacs</strong> des extensions officielles</li>
                  <li>✅ Vous pouvez modifier ou supprimer ces decks à tout moment</li>
                </ul>
              </div>

              <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  @click="startAutomaticSetup"
                  class="btn btn-primary btn-lg"
                >
                  <i class="fas fa-magic mr-2"></i>
                  Configuration automatique
                </button>
                <button 
                  @click="skipSetup"
                  class="btn btn-ghost btn-lg"
                >
                  <i class="fas fa-forward mr-2"></i>
                  Commencer vide
                </button>
              </div>
            </div>
          </div>

          <!-- Progression de l'initialisation -->
          <div v-if="isInitializing" class="space-y-6">
            <h2 class="text-2xl font-semibold">⚙️ Configuration en cours...</h2>
            
            <div class="space-y-4">
              <!-- Étape 1: Chargement des cartes -->
              <div class="flex items-center gap-4 p-4 bg-base-200 rounded-lg">
                <div class="loading loading-spinner loading-sm text-primary" v-if="currentStep === 'loading'"></div>
                <i class="fas fa-check text-success" v-else-if="currentStep !== 'loading'"></i>
                <i class="fas fa-hourglass-half text-base-content/50" v-else></i>
                <span>Chargement de la base de données des cartes...</span>
              </div>
              
              <!-- Étape 2: Ajout à la collection -->
              <div class="flex items-center gap-4 p-4 bg-base-200 rounded-lg">
                <div class="loading loading-spinner loading-sm text-primary" v-if="currentStep === 'collection'"></div>
                <i class="fas fa-check text-success" v-else-if="['decks', 'complete'].includes(currentStep)"></i>
                <i class="fas fa-hourglass-half text-base-content/50" v-else></i>
                <span>Ajout des cartes à votre collection...</span>
                <span v-if="progress.cardsAdded > 0" class="badge badge-success">{{ progress.cardsAdded }} cartes</span>
              </div>
              
              <!-- Étape 3: Création des decks -->
              <div class="flex items-center gap-4 p-4 bg-base-200 rounded-lg">
                <div class="loading loading-spinner loading-sm text-primary" v-if="currentStep === 'decks'"></div>
                <i class="fas fa-check text-success" v-else-if="currentStep === 'complete'"></i>
                <i class="fas fa-hourglass-half text-base-content/50" v-else></i>
                <span>Création des decks officiels...</span>
                <span v-if="progress.decksCreated > 0" class="badge badge-success">{{ progress.decksCreated }} decks</span>
              </div>
            </div>

            <!-- Messages d'erreur -->
            <div v-if="progress.errors.length > 0" class="alert alert-warning">
              <i class="fas fa-exclamation-triangle"></i>
              <div>
                <h4 class="font-semibold">Avertissements détectés :</h4>
                <ul class="text-sm mt-2">
                  <li v-for="error in progress.errors.slice(0, 3)" :key="error">{{ error }}</li>
                  <li v-if="progress.errors.length > 3" class="font-italic">... et {{ progress.errors.length - 3 }} autres</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Résultat final -->
          <div v-if="initializationComplete" class="space-y-6">
            <h2 class="text-2xl font-semibold text-success">🎉 Configuration terminée !</h2>
            
            <div class="bg-success/10 rounded-lg p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="stat">
                  <div class="stat-title">Cartes ajoutées</div>
                  <div class="stat-value text-success">{{ finalResult?.cardsAdded || 0 }}</div>
                  <div class="stat-desc">dans votre collection</div>
                </div>
                <div class="stat">
                  <div class="stat-title">Decks créés</div>
                  <div class="stat-value text-success">{{ finalResult?.decksCreated || 0 }}</div>
                  <div class="stat-desc">prêts à jouer</div>
                </div>
              </div>

              <p class="text-sm text-base-content/80 mb-4">
                Votre collection est maintenant prête ! Vous pouvez explorer les decks, 
                modifier vos cartes, ou créer vos propres decks personnalisés.
              </p>

              <button 
                @click="goToHome"
                class="btn btn-success btn-lg"
              >
                <i class="fas fa-home mr-2"></i>
                Commencer à jouer !
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="text-center mt-6 text-sm text-base-content/60">
        <p>Données officielles depuis <a href="https://www.wtcg-return.fr" target="_blank" class="link">WTCG Return</a></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCardStore } from '@/stores/cardStore'
import { 
  performFullInitialization, 
  isFirstTimeUser, 
  isInitializationCompleted,
  type InitializationResult 
} from '@/services/starterService'

const router = useRouter()
const cardStore = useCardStore()

// État réactif
const isInitializing = ref(false)
const initializationComplete = ref(false)
const currentStep = ref<'loading' | 'collection' | 'decks' | 'complete'>('loading')
const progress = ref({
  cardsAdded: 0,
  decksCreated: 0,
  errors: [] as string[],
  warnings: [] as string[]
})
const finalResult = ref<InitializationResult | null>(null)

// Actions
async function startAutomaticSetup() {
  isInitializing.value = true
  currentStep.value = 'loading'
  
  try {
    // Étape 1: S'assurer que les cartes sont chargées
    if (cardStore.cards.length === 0) {
      await cardStore.loadCards()
    }
    
    // Étape 2: Initialisation de la collection
    currentStep.value = 'collection'
    await new Promise(resolve => setTimeout(resolve, 500)) // UI feedback
    
    // Étape 3: Création des decks
    currentStep.value = 'decks'
    await new Promise(resolve => setTimeout(resolve, 500)) // UI feedback
    
    // Étape 4: Exécution complète
    const result = await performFullInitialization()
    finalResult.value = result
    progress.value = result
    
    currentStep.value = 'complete'
    initializationComplete.value = true
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation automatique:', error)
    progress.value.errors.push(`Erreur critique: ${error}`)
  } finally {
    isInitializing.value = false
  }
}

function skipSetup() {
  // Marquer comme initialisé sans rien ajouter
  localStorage.setItem('wakfu-initialization-completed', Date.now().toString())
  goToHome()
}

function goToHome() {
  router.push('/')
}

// Vérification au montage
onMounted(async () => {
  // Si ce n'est pas un premier utilisateur ou si déjà initialisé, rediriger
  if (!isFirstTimeUser() || isInitializationCompleted()) {
    goToHome()
    return
  }
  
  // Charger les cartes en arrière-plan pour l'initialisation
  try {
    await cardStore.loadCards()
    currentStep.value = 'collection'
  } catch (error) {
    console.error('❌ Erreur lors du chargement des cartes:', error)
  }
})
</script>

<style scoped>
.stat {
  @apply bg-base-200/50 rounded-lg p-4;
}

.stat-title {
  @apply text-xs text-base-content/60 font-medium uppercase;
}

.stat-value {
  @apply text-2xl font-bold;
}

.stat-desc {
  @apply text-xs text-base-content/60;
}
</style>
