<template>
  <div class="home-view">
    <div class="hero min-h-[70vh] bg-base-200 rounded-box">
      <div class="hero-content text-center">
        <div class="max-w-md">
          <img
            src="@/assets/logo.png"
            alt="Wakfu Deck Builder"
            class="mx-auto w-32 h-32 mb-4"
          />
          <h1 class="text-5xl font-bold">Wakfu Deck Builder</h1>
          <p class="py-6">
            Gérez votre collection de cartes Wakfu TCG et suivez votre
            progression. Connectez-vous pour sauvegarder votre collection en
            ligne et y accéder depuis n'importe quel appareil.
          </p>
                <!-- Message explicatif pour l'import -->
      <div class="bg-info/10 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
        <div class="flex items-center gap-2 mb-3">
          <i class="fas fa-info-circle text-info"></i>
          <h3 class="font-semibold text-lg">💡 Comment commencer ?</h3>
        </div>
        <p class="text-base-content/80 mb-4">
          Votre collection est vide ! Pour commencer à jouer, rendez-vous dans la 
          <strong>liste des decks</strong> où vous trouverez les decks officiels pré-configurés.
        </p>
        <p class="text-sm text-base-content/60">
          🎯 <strong>Astuce :</strong> Chaque deck officiel a un bouton <span class="badge badge-secondary badge-sm">Importer</span> 
          pour ajouter ses cartes à votre collection !
        </p>
      </div>

      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <router-link to="/collection" class="btn btn-primary">
          <i class="fas fa-cards-blank mr-2"></i>
          Ouvrir la collection
        </router-link>
        <router-link to="/decks" class="btn btn-secondary">
          <i class="fas fa-layer-group mr-2"></i>
          Voir les decks
        </router-link>
      </div>
        </div>
      </div>
    </div>

    <!-- Fonctionnalités -->
    <div class="py-12">
      <h2 class="text-3xl font-bold text-center mb-12">Fonctionnalités</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <!-- Collection -->
        <div class="card bg-base-100 shadow-xl">
          <figure class="px-6 pt-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-24 w-24 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </figure>
          <div class="card-body items-center text-center">
            <h3 class="card-title">Gestion de Collection</h3>
            <p>
              Suivez l'ensemble de votre collection de cartes Wakfu TCG, avec
              support pour les cartes normales et foil.
            </p>
          </div>
        </div>



        <!-- Mode local -->
        <div class="card bg-base-100 shadow-xl">
          <figure class="px-6 pt-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v8m-4-4h8M5 20h14a2 2 0 002-2V8l-6-6H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          </figure>
          <div class="card-body items-center text-center">
            <h3 class="card-title">Mode local</h3>
            <p>Vos données sont stockées localement sur votre machine.</p>
          </div>
        </div>
      </div>
    </div>



    <!-- Call to action -->
    <div class="py-12 text-center">
      <h2 class="text-3xl font-bold mb-8">Prêt à commencer ?</h2>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <router-link to="/collection" class="btn btn-primary btn-lg">
          Ouvrir la collection
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.home-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
</style>
