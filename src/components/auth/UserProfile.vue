<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSupabaseStore } from '@/stores/supabaseStore'
import { useRouter } from 'vue-router'
import { supabase } from '@/services/supabase'

const supabaseStore = useSupabaseStore()
const router = useRouter()

// État du profil
const username = ref('')
const avatarUrl = ref('')
const isEditing = ref(false)
const isLoading = ref(false)
const message = ref('')
const avatarFile = ref<File | null>(null)

// Computed
const userEmail = computed(() => supabaseStore.user?.email || '')
const isAuthenticated = computed(() => supabaseStore.isAuthenticated)
const collectionCount = computed(() => {
  let total = 0
  Object.values(supabaseStore.collection).forEach(card => {
    total += card.normal + card.foil
  })
  return total
})

const decksCount = computed(() => supabaseStore.decks.length)

// Récupérer le profil au chargement
onMounted(async () => {
  if (!isAuthenticated.value) {
    router.push({ name: 'login' })
    return
  }
  
  await fetchProfile()
})

// Méthodes
async function fetchProfile() {
  isLoading.value = true
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', supabaseStore.userId)
      .single()
    
    if (error) throw error
    
    username.value = data.username || ''
    avatarUrl.value = data.avatar_url || ''
  } catch (error: any) {
    console.error('Erreur lors du chargement du profil:', error.message)
  } finally {
    isLoading.value = false
  }
}

async function updateProfile() {
  isLoading.value = true
  message.value = ''
  
  try {
    // Mettre à jour le profil
    const { error } = await supabase
      .from('profiles')
      .update({
        username: username.value,
        updated_at: new Date().toISOString()
      })
      .eq('id', supabaseStore.userId)
    
    if (error) throw error
    
    // Si un fichier d'avatar a été sélectionné
    if (avatarFile.value) {
      await uploadAvatar()
    }
    
    message.value = 'Profil mis à jour avec succès!'
    isEditing.value = false
  } catch (error: any) {
    message.value = `Erreur: ${error.message}`
  } finally {
    isLoading.value = false
  }
}

function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    avatarFile.value = input.files[0]
    // Prévisualiser l'avatar
    const reader = new FileReader()
    reader.onload = (e) => {
      avatarUrl.value = e.target?.result as string
    }
    reader.readAsDataURL(avatarFile.value)
  }
}

async function uploadAvatar() {
  if (!avatarFile.value) return
  
  try {
    // Générer un nom de fichier unique
    const fileExt = avatarFile.value.name.split('.').pop()
    const fileName = `${supabaseStore.userId}-${Date.now()}.${fileExt}`
    const filePath = `avatars/${fileName}`
    
    // Uploader l'image
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile.value)
    
    if (uploadError) throw uploadError
    
    // Obtenir l'URL publique
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)
    
    // Mettre à jour le profil avec la nouvelle URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: data.publicUrl
      })
      .eq('id', supabaseStore.userId)
    
    if (updateError) throw updateError
    
    // Mettre à jour l'URL locale
    avatarUrl.value = data.publicUrl
  } catch (error: any) {
    console.error('Erreur lors de l\'upload de l\'avatar:', error.message)
    throw error
  }
}

async function handleSignOut() {
  try {
    isLoading.value = true
    await supabaseStore.signOut()
    router.push({ name: 'login' })
  } catch (error: any) {
    message.value = `Erreur: ${error.message}`
  } finally {
    isLoading.value = false
  }
}

function syncData() {
  isLoading.value = true
  supabaseStore.synchronizePendingChanges()
    .finally(() => {
      isLoading.value = false
    })
}
</script>

<template>
  <div v-if="isAuthenticated" class="user-profile bg-base-200 p-6 rounded-lg shadow-lg max-w-2xl mx-auto">
    <div v-if="isLoading" class="flex justify-center my-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    
    <div v-else>
      <div class="flex flex-col md:flex-row gap-6 items-center mb-6">
        <!-- Avatar -->
        <div class="avatar">
          <div class="w-24 h-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden bg-base-300">
            <img v-if="avatarUrl" :src="avatarUrl" alt="Avatar utilisateur" />
            <div v-else class="flex items-center justify-center w-full h-full text-3xl font-bold">
              {{ username ? username[0].toUpperCase() : 'U' }}
            </div>
          </div>
        </div>
        
        <!-- Informations utilisateur -->
        <div class="flex-1">
          <div v-if="!isEditing">
            <h2 class="text-2xl font-bold">{{ username || 'Utilisateur' }}</h2>
            <p class="text-sm opacity-70">{{ userEmail }}</p>
            
            <div class="stats stats-vertical lg:stats-horizontal shadow mt-4">
              <div class="stat">
                <div class="stat-title">Collection</div>
                <div class="stat-value">{{ collectionCount }}</div>
                <div class="stat-desc">Cartes dans votre collection</div>
              </div>
              
              <div class="stat">
                <div class="stat-title">Decks</div>
                <div class="stat-value">{{ decksCount }}</div>
                <div class="stat-desc">Decks créés</div>
              </div>
            </div>
          </div>
          
          <form v-else @submit.prevent="updateProfile" class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Nom d'utilisateur</span>
              </label>
              <input v-model="username" type="text" class="input input-bordered" />
            </div>
            
            <div class="form-control">
              <label class="label">
                <span class="label-text">Avatar</span>
              </label>
              <input 
                type="file" 
                accept="image/*" 
                class="file-input file-input-bordered w-full" 
                @change="handleAvatarChange"
              />
            </div>
          </form>
        </div>
      </div>
      
      <!-- Message d'information -->
      <div v-if="message" class="alert" :class="message.startsWith('Erreur') ? 'alert-error' : 'alert-success'">
        <span>{{ message }}</span>
      </div>
      
      <!-- Boutons d'action -->
      <div class="flex flex-wrap gap-2 justify-between mt-6">
        <div>
          <button v-if="!isEditing" @click="isEditing = true" class="btn btn-primary">
            Modifier le profil
          </button>
          <template v-else>
            <button @click="updateProfile" class="btn btn-primary" :disabled="isLoading">
              <span v-if="isLoading" class="loading loading-spinner loading-xs"></span>
              Enregistrer
            </button>
            <button @click="isEditing = false" class="btn btn-ghost ml-2">
              Annuler
            </button>
          </template>
        </div>
        
        <div>
          <button @click="syncData" class="btn btn-outline mr-2" :disabled="isLoading || !supabaseStore.isOnline">
            <span v-if="supabaseStore.isSyncing" class="loading loading-spinner loading-xs"></span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Synchroniser
          </button>
          
          <button @click="handleSignOut" class="btn btn-error">
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  </div>
</template> 