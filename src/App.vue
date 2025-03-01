<template>
  <div class="min-h-screen bg-base-100 text-base-content">
    <!-- Écran de chargement -->
    <div v-if="isLoading" class="fixed inset-0 flex items-center justify-center bg-base-100 bg-opacity-90 z-50">
      <div class="text-center">
        <div class="loading loading-spinner loading-lg"></div>
        <p class="mt-4">Chargement des cartes...</p>
        <p v-if="loadingAttempt > 1" class="text-sm text-base-content/60">
          Tentative {{ loadingAttempt }}/3
        </p>
      </div>
    </div>

    <!-- Message d'erreur -->
    <div v-if="error" class="fixed inset-0 flex items-center justify-center bg-base-100 bg-opacity-90 z-50">
      <div class="max-w-md p-6 bg-error text-error-content rounded-box shadow-lg">
        <h2 class="text-xl font-bold mb-4">Erreur de chargement</h2>
        <p class="mb-4">{{ error }}</p>
        <div class="flex justify-end gap-4">
          <button 
            class="btn btn-error" 
            @click="resetAndReload"
          >
            Réinitialiser
          </button>
          <button 
            class="btn btn-error-content" 
            @click="retryLoading"
          >
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
        
        <!-- Menu principal - visible uniquement pour les utilisateurs authentifiés -->
        <div v-if="isAuthenticated" class="tabs tabs-boxed bg-base-300">
          <router-link 
            to="/collection" 
            class="tab" 
            :class="{ 'tab-active': $route.path === '/collection' }"
          >
            📚 Collection
          </router-link>
        </div>
        
        <!-- Menu pour les invités - visible uniquement pour les utilisateurs non authentifiés -->
        <div v-else class="tabs tabs-boxed bg-base-300">
          <router-link 
            to="/" 
            class="tab" 
            :class="{ 'tab-active': $route.path === '/' }"
          >
            🏠 Accueil
          </router-link>
          <router-link 
            to="/login" 
            class="tab" 
            :class="{ 'tab-active': $route.path === '/login' || $route.path === '/register' }"
          >
            🔑 Connexion
          </router-link>
        </div>

        <!-- Menu utilisateur -->
        <div class="ml-4 dropdown dropdown-end">
          <div v-if="isAuthenticated" tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
            <div class="w-10 rounded-full">
              <!-- Utiliser l'avatar de l'utilisateur ou une lettre par défaut -->
              <img v-if="userProfile?.avatar_url" :src="userProfile?.avatar_url" alt="Avatar" />
              <div v-else class="flex items-center justify-center w-full h-full bg-primary text-primary-content text-xl font-bold">
                {{ userProfile?.username?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase() || 'U' }}
              </div>
            </div>
          </div>
          
          <!-- Menu déroulant pour l'utilisateur connecté -->
          <ul tabindex="0" class="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-200 rounded-box w-52" v-if="isAuthenticated">
            <li class="font-bold text-sm px-4 py-2">
              {{ userProfile?.username || 'Utilisateur' }}
            </li>
            <li class="text-xs px-4 pb-2 opacity-70">{{ userEmail }}</li>
            <div class="divider my-0"></div>
            <li><router-link to="/profile">Profil</router-link></li>
            <li>
              <a @click="toggleConnectionStatus">
                <span v-if="isOnline" class="flex items-center">
                  <span class="inline-block w-2 h-2 rounded-full bg-success mr-2"></span> En ligne
                </span>
                <span v-else class="flex items-center">
                  <span class="inline-block w-2 h-2 rounded-full bg-error mr-2"></span> Hors ligne
                </span>
              </a>
            </li>
            <li>
              <div class="px-4 py-2 text-sm">
                <span class="flex items-center">
                  <span v-if="isSyncing" class="loading loading-spinner loading-xs mr-2"></span>
                  <span v-else class="inline-block w-2 h-2 rounded-full bg-success mr-2"></span>
                  Synchronisation {{ isSyncing ? 'en cours...' : 'automatique' }}
                </span>
                <span v-if="lastSync && !isSyncing" class="text-xs opacity-70 block mt-1">
                  Dernière sync: {{ formatLastSync }}
                </span>
              </div>
            </li>
            <div class="divider my-0"></div>
            <li><a @click="handleSignOut">Déconnexion</a></li>
          </ul>
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
import ToastContainer from "./components/common/ToastContainer.vue"
import { useTheme } from './composables/useTheme'
import { useCardStore } from './stores/cardStore'
import { useToast } from './composables/useToast'
import { useCollectionStore } from '@/stores/collection'
import { useSupabaseStore } from '@/stores/supabaseStore'
import { supabase } from '@/services/supabase'
import { useRouter } from 'vue-router'

const { initTheme } = useTheme()
const cardStore = useCardStore()
const toast = useToast()
const collectionStore = useCollectionStore()
const supabaseStore = useSupabaseStore()
const router = useRouter()

const loadingAttempt = ref(1)
const isLoading = computed(() => cardStore.loading)
const error = computed(() => cardStore.error)
const userProfile = ref<any>(null)

// Propriétés Supabase
const isAuthenticated = computed(() => supabaseStore.isAuthenticated)
const userEmail = computed(() => supabaseStore.user?.email)
const isOnline = computed(() => supabaseStore.isOnline)
const isSyncing = computed(() => supabaseStore.isSyncing)
const lastSync = computed(() => cardStore.lastSync)

// Formater la date de dernière synchronisation
const formatLastSync = computed(() => {
  if (!lastSync.value) return 'Jamais'
  
  const lastSyncDate = new Date(lastSync.value)
  const now = new Date()
  const diffMs = now.getTime() - lastSyncDate.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSec < 60) return 'À l\'instant'
  if (diffMin < 60) return `Il y a ${diffMin} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`
  
  return lastSyncDate.toLocaleDateString()
})

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

// Récupérer le profil utilisateur
async function fetchUserProfile() {
  if (!supabaseStore.userId) return

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', supabaseStore.userId)
      .single()

    if (error) throw error

    userProfile.value = data
  } catch (err) {
    console.error('Erreur lors de la récupération du profil:', err)
  }
}

// Basculer entre le mode en ligne et hors ligne
function toggleConnectionStatus() {
  // En réalité, cette fonction simule le changement car la vraie connectivité 
  // est gérée automatiquement par les événements online/offline du navigateur
  supabaseStore.isOnline = !supabaseStore.isOnline
  toast.info(supabaseStore.isOnline ? 'Mode en ligne activé' : 'Mode hors ligne activé')
}

// Déconnexion
async function handleSignOut() {
  try {
    await supabaseStore.signOut()
    toast.success('Déconnexion réussie')
    router.push({ name: 'login' })
  } catch (err) {
    toast.error('Erreur lors de la déconnexion')
    console.error(err)
  }
}

async function initializeApp() {
  try {
    await cardStore.initialize()
    console.log('Base de données des cartes initialisée avec succès')
    loadingAttempt.value = 1
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error)
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
  
  // Surveillance des changements d'authentification
  supabaseStore.initializeSession().then(() => {
    if (isAuthenticated.value) {
      fetchUserProfile()
    }
  })
  
  // Observer les changements d'authentification
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await fetchUserProfile()
    }
  })
  
  try {
    await collectionStore.initialize()
    if (!cardStore.isInitialized) {
      toast.info('Veuillez vous connecter pour accéder à votre collection')
    }
  } catch (error) {
    toast.error('Erreur lors de l\'initialisation de la synchronisation')
    console.error(error)
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
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
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