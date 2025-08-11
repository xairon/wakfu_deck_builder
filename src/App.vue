<template>
  <div class="min-h-screen bg-base-100 text-base-content">
    <!-- Écran de chargement -->
    <div
      v-if="isLoading"
      class="fixed inset-0 flex items-center justify-center bg-base-100 bg-opacity-90 z-50"
    >
      <div class="text-center">
        <div class="loading loading-spinner loading-lg"></div>
        <p class="mt-4">Chargement des cartes...</p>
        <p v-if="loadingAttempt > 1" class="text-sm text-base-content/60">
          Tentative {{ loadingAttempt }}/3
        </p>
      </div>
    </div>

    <!-- Message d'erreur -->
    <div
      v-if="error"
      class="fixed inset-0 flex items-center justify-center bg-base-100 bg-opacity-90 z-50"
    >
      <div
        class="max-w-md p-6 bg-error text-error-content rounded-box shadow-lg"
      >
        <h2 class="text-xl font-bold mb-4">Erreur de chargement</h2>
        <p class="mb-4">{{ error }}</p>
        <div class="flex justify-end gap-4">
          <button class="btn btn-error" @click="resetAndReload">
            Réinitialiser
          </button>
          <button class="btn btn-error-content" @click="retryLoading">
            Réessayer
          </button>
        </div>
      </div>
    </div>

    <!-- Navigation par onglets -->
    <div v-show="!isLoading && !error" class="navbar bg-base-200 mb-4">
      <div class="container mx-auto">
        <div class="flex-1">
          <router-link to="/" class="text-xl font-bold">Wakfu TCG</router-link>
        </div>

        <!-- Menu principal simplifié pour le mode local -->
        <div class="tabs tabs-boxed bg-base-300">
          <router-link
            to="/"
            class="tab"
            :class="{ 'tab-active': $route.path === '/' }"
          >
            🏠 Accueil
          </router-link>
          <router-link
            to="/collection"
            class="tab"
            :class="{ 'tab-active': $route.path === '/collection' }"
          >
            📚 Collection
          </router-link>
          <router-link
            to="/decks"
            class="tab"
            :class="{
              'tab-active':
                $route.path === '/decks' || $route.path.includes('/deck'),
            }"
          >
            🃏 Decks
          </router-link>
        </div>

        <!-- Indicateur de sauvegarde locale -->
        <div class="ml-4 flex items-center space-x-2">
          <div class="badge badge-success badge-sm">
            <span v-if="isSyncing" class="loading loading-spinner loading-xs mr-1"></span>
            <span v-else>💾</span>
            {{ isSyncing ? 'Sauvegarde...' : 'Mode Local' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <main v-show="!isLoading && !error" class="container mx-auto px-4 py-8">
      <router-view v-slot="{ Component }">
        <transition
          name="page"
          mode="out-in"
          @before-leave="beforeLeave"
          @enter="enter"
          @after-enter="afterEnter"
        >
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- Toast Notifications -->
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import ToastContainer from './components/common/ToastContainer.vue'
import { useTheme } from './composables/useTheme'
import { useCardStore } from './stores/cardStore'
import { useToast } from './composables/useToast'
// Auth/Supabase supprimés pour mode local
import { useRouter } from 'vue-router'

const { initTheme } = useTheme()
const cardStore = useCardStore()
const toast = useToast()
const router = useRouter()

const loadingAttempt = ref(1)
const isLoading = computed(() => cardStore.loading)
const error = computed(() => cardStore.error)

// Mode local: états simplifiés
const isSyncing = computed(() => cardStore.isSyncing)
const lastSync = computed(() => cardStore.lastSync)

// Fonctions simplifiées pour le mode local

// Gestion des transitions fluides
function beforeLeave(el: Element) {
  const { left, top } = el.getBoundingClientRect()
  el.style.position = 'fixed'
  el.style.left = left + 'px'
  el.style.top = top + 'px'
  el.style.width = getComputedStyle(el).width
  el.style.height = getComputedStyle(el).height
}

function enter(el: Element) {
  el.style.position = ''
  el.style.left = ''
  el.style.top = ''
  el.style.width = ''
  el.style.height = ''
}

function afterEnter(el: Element) {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Fonctions simplifiées pour le mode local - plus d'auth

async function initializeApp() {
  try {
    await cardStore.initialize()
    console.log('Base de données des cartes initialisée avec succès')
    loadingAttempt.value = 1
  } catch (error) {
    console.error(
      "Erreur lors de l'initialisation de la base de données:",
      error
    )
    loadingAttempt.value++

    if (loadingAttempt.value <= 3) {
      console.log(`Nouvelle tentative (${loadingAttempt.value}/3)...`)
      setTimeout(initializeApp, 2000)
    } else {
      toast.error('Erreur lors du chargement des cartes')
    }
  }
}

function resetAndReload() {
  cardStore.reset()
  loadingAttempt.value = 1
  window.location.reload()
}

function retryLoading() {
  cardStore.reset()
  loadingAttempt.value = 1
  initializeApp()
}

onMounted(async () => {
  initTheme()
  await initializeApp()
  
  // Message d'accueil en mode local
  if (cardStore.isInitialized) {
    toast.success('Application Wakfu TCG prête en mode local!')
  }
})
</script>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}

/* Optimisation des performances de transition */
.page-move {
  transition: transform 0.2s ease;
}

/* Éviter le FOUC (Flash of Unstyled Content) */
.page-leave-active {
  position: absolute;
}

/* Animations personnalisées */
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.float {
  animation: float 3s ease-in-out infinite;
}

/* Scrollbar personnalisée */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  @apply bg-base-200;
}

::-webkit-scrollbar-thumb {
  @apply bg-primary/50 rounded-full;
}

::-webkit-scrollbar-thumb:hover {
  @apply bg-primary;
}
</style>
