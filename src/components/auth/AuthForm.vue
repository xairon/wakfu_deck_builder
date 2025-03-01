<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSupabaseStore } from '@/stores/supabaseStore'
import { useRoute, useRouter } from 'vue-router'

const supabaseStore = useSupabaseStore()
const router = useRouter()
const route = useRoute()

// État du formulaire
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const isRegister = ref(route.name === 'register')

// Validation
const isValidEmail = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.value)
})

const isValidPassword = computed(() => password.value.length >= 6)

const isPasswordMatch = computed(() => {
  if (!isRegister.value) return true
  return password.value === confirmPassword.value
})

const isFormValid = computed(() => 
  isValidEmail.value && 
  isValidPassword.value && 
  isPasswordMatch.value
)

// Méthodes
async function handleSubmit() {
  if (!isFormValid.value) return
  
  errorMessage.value = ''
  successMessage.value = ''
  isLoading.value = true
  
  try {
    if (isRegister.value) {
      // Inscription
      await supabaseStore.signUp(email.value, password.value)
      successMessage.value = 'Compte créé avec succès! Consultez votre email pour confirmer votre inscription.'
      
      // Rediriger vers la page de connexion après un délai
      setTimeout(() => {
        isRegister.value = false
        router.push({ name: 'login' })
      }, 2000)
    } else {
      // Connexion
      await supabaseStore.signIn(email.value, password.value)
      // Rediriger vers la page collection après connexion
      router.push({ name: 'collection' })
    }
  } catch (error: any) {
    errorMessage.value = error.message || 'Une erreur est survenue'
  } finally {
    isLoading.value = false
  }
}

function toggleMode() {
  isRegister.value = !isRegister.value
  errorMessage.value = ''
  successMessage.value = ''
  
  // Mettre à jour l'URL sans recharger la page
  router.push({ 
    name: isRegister.value ? 'register' : 'login'
  })
}
</script>

<template>
  <div class="auth-container bg-base-200 p-8 rounded-lg shadow-lg max-w-md w-full">
    <h2 class="text-2xl font-bold mb-6 text-center">
      {{ isRegister ? 'Créer un compte' : 'Connexion' }}
    </h2>
    
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- Email -->
      <div class="form-control">
        <label for="email" class="label">
          <span class="label-text">Email</span>
        </label>
        <input
          id="email"
          v-model="email"
          type="email"
          class="input input-bordered w-full"
          :class="{ 'input-error': email && !isValidEmail }"
          placeholder="votre@email.com"
          required
        />
        <div v-if="email && !isValidEmail" class="text-error text-sm mt-1">
          Veuillez entrer un email valide
        </div>
      </div>
      
      <!-- Mot de passe -->
      <div class="form-control">
        <label for="password" class="label">
          <span class="label-text">Mot de passe</span>
        </label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="input input-bordered w-full"
          :class="{ 'input-error': password && !isValidPassword }"
          placeholder="••••••••"
          required
        />
        <div v-if="password && !isValidPassword" class="text-error text-sm mt-1">
          Le mot de passe doit contenir au moins 6 caractères
        </div>
      </div>
      
      <!-- Confirmation de mot de passe (inscription uniquement) -->
      <div v-if="isRegister" class="form-control">
        <label for="confirm-password" class="label">
          <span class="label-text">Confirmer le mot de passe</span>
        </label>
        <input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          class="input input-bordered w-full"
          :class="{ 'input-error': confirmPassword && !isPasswordMatch }"
          placeholder="••••••••"
          required
        />
        <div v-if="confirmPassword && !isPasswordMatch" class="text-error text-sm mt-1">
          Les mots de passe ne correspondent pas
        </div>
      </div>
      
      <!-- Messages d'erreur et de succès -->
      <div v-if="errorMessage" class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{{ errorMessage }}</span>
      </div>
      
      <div v-if="successMessage" class="alert alert-success">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{{ successMessage }}</span>
      </div>
      
      <!-- Bouton de soumission -->
      <button 
        type="submit" 
        class="btn btn-primary w-full" 
        :disabled="!isFormValid || isLoading"
      >
        <span v-if="isLoading" class="loading loading-spinner"></span>
        {{ isRegister ? 'S\'inscrire' : 'Se connecter' }}
      </button>
      
      <!-- Basculer entre connexion et inscription -->
      <div class="text-center mt-4">
        <button 
          type="button" 
          @click="toggleMode" 
          class="btn btn-link btn-sm"
        >
          {{ isRegister ? 'Déjà un compte? Se connecter' : 'Créer un compte' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.auth-container {
  margin: 2rem auto;
}
</style>