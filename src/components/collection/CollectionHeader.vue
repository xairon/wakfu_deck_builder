<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="font-display text-4xl leading-[1.04] sm:text-5xl">
        <template v-if="isAuthenticated">Ma collection</template>
        <template v-else>Catalogue des cartes</template>
      </h1>
      <p class="mt-3 max-w-md text-base-content/70">
        <template v-if="isAuthenticated"
          >Suivez votre collection de cartes Wakfu TCG.</template
        >
        <template v-else>
          Parcourez toutes les cartes.
          <router-link to="/auth" class="text-primary hover:underline"
            >Connectez-vous</router-link
          >
          pour suivre votre collection.
        </template>
      </p>
    </div>

    <!-- Registre : lecture mono tabulaire, séparée par filets -->
    <div class="border-y border-base-content/80 py-5">
      <div class="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <p class="eyebrow">Au catalogue</p>
          <p class="mt-1 font-mono text-3xl tabular">{{ totalCards }}</p>
        </div>
        <template v-if="isAuthenticated">
          <div>
            <p class="eyebrow">Possédées</p>
            <p class="mt-1 font-mono text-3xl tabular text-primary">
              {{ collectionProgress }}%
            </p>
          </div>
          <div>
            <p class="eyebrow">Exemplaires</p>
            <p class="mt-1 font-mono text-3xl tabular">
              {{ totalCollection }}
            </p>
          </div>
          <div>
            <p class="eyebrow">Synchronisation</p>
            <p
              class="mt-1 flex items-center gap-2 font-mono text-sm tabular text-base-content/70"
            >
              <span
                class="inline-block h-2 w-2"
                :class="
                  isSyncing
                    ? 'bg-primary'
                    : lastSync
                      ? 'bg-base-content'
                      : 'bg-base-content/30'
                "
              ></span>
              <span>{{ syncStatusLabel }}</span>
            </p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Composant d'en-tête pour la vue Collection
 * Affiche le titre et les statistiques de collection
 */
import { computed } from "vue";
import { useCardStore } from "@/stores/cardStore";
import { useAuthStore } from "@/stores/authStore";

const cardStore = useCardStore();
const authStore = useAuthStore();

// Propriétés calculées directement depuis le store
const totalCards = computed(() => cardStore.totalCards);
const totalCollection = computed(() => cardStore.totalCollection);
const collectionProgress = computed(() => cardStore.collectionProgress);

const isAuthenticated = computed(() => authStore.isAuthenticated);
const isSyncing = computed(() => cardStore.isSyncing);
const lastSync = computed(() => cardStore.lastSync);
const formatLastSync = computed(() => cardStore.formatLastSync);

const syncStatusLabel = computed(() => {
  if (isSyncing.value) return "En cours…";
  if (lastSync.value) return formatLastSync.value;
  return "Non synchronisée";
});
</script>
