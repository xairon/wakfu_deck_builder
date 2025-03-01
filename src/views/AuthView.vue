<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSupabaseStore } from '@/stores/supabaseStore'
import { useCardStore } from '@/stores/cardStore'
import AuthForm from '@/components/auth/AuthForm.vue'

const route = useRoute()
const router = useRouter()
const supabaseStore = useSupabaseStore()
const cardStore = useCardStore()

// État du formulaire
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

// Déterminer si on est sur la page de connexion ou d'inscription
const isLogin = computed(() => route.path === '/login')

// Redirection après connexion
const redirectPath = computed(() => {
  return (route.query.redirect as string) || '/collection'
})

// Gérer la soumission du formulaire
async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    // Vérifier que les mots de passe correspondent pour l'inscription
    if (!isLogin.value && password.value !== confirmPassword.value) {
      error.value = 'Les mots de passe ne correspondent pas'
      return
    }

    // Connexion ou inscription selon la page
    if (isLogin.value) {
      await supabaseStore.signIn(email.value, password.value)
    } else {
      await supabaseStore.signUp(email.value, password.value)
    }

    // Rediriger vers la page demandée ou la collection
    router.push(redirectPath.value)
  } catch (err) {
    console.error('Erreur d\'authentification:', err)
    error.value = err instanceof Error 
      ? err.message 
      : 'Une erreur est survenue lors de l\'authentification'
  } finally {
    loading.value = false
  }
}

// Vérifier si l'utilisateur est déjà connecté
onMounted(() => {
  if (supabaseStore.isAuthenticated) {
    router.push(redirectPath.value)
  }
})

// Fonction pour réinitialiser la session
function resetSession() {
  console.log('Réinitialisation de la session...')
  
  // Déconnecter l'utilisateur
  supabaseStore.signOut()
  
  // Effacer toutes les données Supabase dans localStorage
  const supabaseKey = 'sb-' + import.meta.env.VITE_SUPABASE_URL.replace(/^https?:\/\//, '')
  localStorage.removeItem(supabaseKey + '-auth-token')
  
  // Suppression de toutes les clés potentiellement liées à Supabase
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
      console.log('Suppression de la clé:', key)
      localStorage.removeItem(key)
    }
  }
  
  // Effacer d'autres données d'application potentiellement problématiques
  localStorage.removeItem('wakfu-collection')
  localStorage.removeItem('wakfu-last-sync')
  
  // Vider les cookies liés à Supabase (avec une approche générique)
  document.cookie.split(';').forEach(cookie => {
    const [name] = cookie.trim().split('=')
    if (name.includes('sb-') || name.includes('supabase')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    }
  })
  
  // Informer l'utilisateur
  alert('Session réinitialisée. Vous allez être redirigé vers la page de connexion.')
  
  // Rediriger vers la page de connexion
  router.push('/login')
  
  // Recharger la page après un court délai
  setTimeout(() => {
    window.location.reload()
  }, 500)
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-header">
        <img src="@/assets/logo.png" alt="Wakfu TCG" class="auth-logo" />
        <h1 class="auth-title">{{ isLogin ? 'Connexion' : 'Inscription' }}</h1>
      </div>

      <div class="auth-benefits mb-6">
        <h2 class="text-lg font-semibold mb-2">Avantages de la connexion :</h2>
        <ul class="list-disc pl-5 space-y-1">
          <li>Sauvegarde en ligne de votre collection</li>
          <li>Accès depuis n'importe quel appareil</li>
          <li>Statistiques avancées de votre collection</li>
          <li>Recherches et filtres personnalisés</li>
        </ul>
      </div>

      <div v-if="error" class="alert alert-error shadow-lg mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{{ error }}</span>
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <!-- Champs du formulaire -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Email</span>
          </label>
          <input 
            type="email" 
            v-model="email" 
            placeholder="votre@email.com" 
            class="input input-bordered" 
            required 
          />
        </div>
        
        <div class="form-control">
          <label class="label">
            <span class="label-text">Mot de passe</span>
          </label>
          <input 
            type="password" 
            v-model="password" 
            placeholder="Mot de passe" 
            class="input input-bordered" 
            required 
          />
        </div>

        <div v-if="!isLogin" class="form-control">
          <label class="label">
            <span class="label-text">Confirmer le mot de passe</span>
          </label>
          <input 
            type="password" 
            v-model="confirmPassword" 
            placeholder="Confirmer le mot de passe" 
            class="input input-bordered" 
            required 
          />
        </div>

        <div class="form-control mt-6">
          <button 
            type="submit" 
            class="btn btn-primary" 
            :disabled="loading"
          >
            <span v-if="loading" class="loading loading-spinner loading-xs mr-2"></span>
            {{ isLogin ? 'Se connecter' : 'S\'inscrire' }}
          </button>
        </div>
      </form>

      <div class="auth-toggle">
        <p>
          {{ isLogin ? 'Pas encore de compte ?' : 'Déjà un compte ?' }}
          <router-link 
            :to="isLogin ? '/register' : '/login'" 
            class="link link-primary"
          >
            {{ isLogin ? 'S\'inscrire' : 'Se connecter' }}
          </router-link>
        </p>
      </div>

      <!-- Problèmes de connexion -->
      <div class="mt-6 pt-6 border-t border-base-300">
        <details class="cursor-pointer">
          <summary class="text-sm text-base-content/60">Problèmes de connexion ?</summary>
          <div class="mt-4 space-y-4 p-4 bg-base-200 rounded-box">
            <p class="text-sm">Si vous ne pouvez pas vous connecter après un redémarrage du serveur, essayez de réinitialiser votre session :</p>
            <button 
              @click="resetSession" 
              class="btn btn-sm btn-error btn-outline w-full"
            >
              Réinitialiser ma session
            </button>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 4rem);
  padding: 1rem;
}

.auth-card {
  width: 100%;
  max-width: 450px;
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  background-color: var(--card-bg);
}

.auth-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.5rem;
}

.auth-logo {
  width: 80px;
  height: 80px;
  margin-bottom: 1rem;
}

.auth-title {
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
}

.auth-form {
  margin-bottom: 1.5rem;
}

.auth-toggle {
  text-align: center;
  margin-top: 1rem;
}

.auth-benefits {
  background-color: rgba(var(--primary-rgb), 0.1);
  border-left: 4px solid var(--primary);
  padding: 1rem;
  border-radius: 0.25rem;
}
</style> 