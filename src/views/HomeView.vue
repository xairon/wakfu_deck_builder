<template>
  <div class="home-view">
    <div class="hero min-h-[70vh] bg-base-200 rounded-box">
      <div class="hero-content text-center">
        <div class="max-w-md">
          <img src="@/assets/logo.png" alt="Wakfu Deck Builder" class="mx-auto w-32 h-32 mb-4" />
          <h1 class="text-5xl font-bold">Wakfu Deck Builder</h1>
          <p class="py-6">
            Gérez votre collection de cartes Wakfu TCG et suivez votre progression. 
            Connectez-vous pour sauvegarder votre collection en ligne et y accéder depuis n'importe quel appareil.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <router-link to="/login" class="btn btn-primary">Se connecter</router-link>
            <router-link to="/register" class="btn btn-outline">S'inscrire</router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Fonctionnalités -->
    <div class="py-12">
      <h2 class="text-3xl font-bold text-center mb-12">Fonctionnalités</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Collection -->
        <div class="card bg-base-100 shadow-xl">
          <figure class="px-6 pt-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </figure>
          <div class="card-body items-center text-center">
            <h3 class="card-title">Gestion de Collection</h3>
            <p>Suivez l'ensemble de votre collection de cartes Wakfu TCG, avec support pour les cartes normales et foil.</p>
          </div>
        </div>

        <!-- Statistiques -->
        <div class="card bg-base-100 shadow-xl">
          <figure class="px-6 pt-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </figure>
          <div class="card-body items-center text-center">
            <h3 class="card-title">Statistiques Détaillées</h3>
            <p>Visualisez des statistiques détaillées sur votre collection et analysez votre progression.</p>
          </div>
        </div>

        <!-- Synchronisation -->
        <div class="card bg-base-100 shadow-xl">
          <figure class="px-6 pt-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </figure>
          <div class="card-body items-center text-center">
            <h3 class="card-title">Synchronisation en ligne</h3>
            <p>Accédez à votre collection depuis n'importe quel appareil grâce à la sauvegarde en ligne.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Statistiques -->
    <div class="py-12 bg-base-200 rounded-box my-8">
      <h2 class="text-3xl font-bold text-center mb-12">Statistiques détaillées</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto px-4">
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h3 class="card-title">Progression de collection</h3>
            <ul class="list-disc list-inside space-y-2 mt-4">
              <li>Suivi par extension et par rareté</li>
              <li>Visualisation de vos besoins pour compléter la collection</li>
              <li>Histogramme de répartition par type et élément</li>
            </ul>
          </div>
        </div>

        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h3 class="card-title">Filtres avancés</h3>
            <ul class="list-disc list-inside space-y-2 mt-4">
              <li>Recherche par nom, type, élément ou texte</li>
              <li>Filtrage par rareté et par extension</li>
              <li>Tri personnalisé selon différents critères</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Call to action -->
    <div class="py-12 text-center">
      <h2 class="text-3xl font-bold mb-8">Prêt à commencer ?</h2>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <router-link to="/register" class="btn btn-primary btn-lg">Créer un compte</router-link>
        <router-link to="/login" class="btn btn-outline btn-lg">Se connecter</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabaseStore } from '@/stores/supabaseStore'

const router = useRouter()
const supabaseStore = useSupabaseStore()

// Rediriger les utilisateurs déjà connectés vers la collection
onMounted(() => {
  if (supabaseStore.isAuthenticated) {
    router.push('/collection')
  }
})
</script>

<style scoped>
.home-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
</style> 