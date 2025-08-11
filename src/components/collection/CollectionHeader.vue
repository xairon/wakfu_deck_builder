<template>
  <div class="flex justify-between items-center">
    <div>
      <h1 class="text-3xl font-bold">Ma Collection</h1>
      <p class="text-base-content/70">
        Gérez votre collection de cartes Wakfu TCG
      </p>
    </div>
    <div class="stats bg-base-200 shadow">
      <div class="stat">
        <div class="stat-title">Total</div>
        <div class="stat-value">{{ totalCards }}</div>
        <div class="stat-desc">cartes différentes</div>
      </div>
      <div class="stat">
        <div class="stat-title">Collection</div>
        <div class="stat-value">{{ collectionProgress }}%</div>
        <div class="stat-desc">{{ totalCollection }} cartes au total</div>
      </div>
      <div class="stat">
        <div class="stat-title">Progression</div>
        <div class="stat-value">{{ collectionProgress }}%</div>
        <progress
          class="progress progress-primary w-full mt-1"
          :value="collectionProgress"
          max="100"
        ></progress>
      </div>
      <div v-if="isAuthenticated" class="stat bg-base-300">
        <div class="stat-title">Synchronisation</div>
        <div class="stat-value flex items-center gap-2">
          <template v-if="lastSync">
            <span class="text-sm font-normal">{{ formatLastSync }}</span>
            <div
              class="tooltip tooltip-bottom"
              data-tip="Collection synchronisée"
            >
              <svg
                v-if="!isSyncing"
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div
                v-else
                class="loading loading-spinner loading-md text-primary"
              ></div>
            </div>
          </template>
          <template v-else>
            <span class="text-sm font-normal">Non synchronisée</span>
            <div
              class="tooltip tooltip-bottom"
              data-tip="Collection non synchronisée"
            >
              <div
                v-if="isSyncing"
                class="loading loading-spinner loading-md text-primary"
              ></div>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 text-warning"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </template>
        </div>
        <div class="stat-desc">
          {{
            isSyncing
              ? 'Synchronisation en cours...'
              : isAuthenticated
                ? 'Sauvegardée en ligne'
                : 'Sauvegardée localement'
          }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Composant d'en-tête pour la vue Collection
 * Affiche le titre et les statistiques de collection
 */
import { computed } from 'vue'
import { useCardStore } from '@/stores/cardStore'

const cardStore = useCardStore()

// Propriétés calculées directement depuis le store
const totalCards = computed(() => cardStore.totalCards)
const totalCollection = computed(() => cardStore.totalCollection)
const collectionProgress = computed(() => cardStore.collectionProgress)

const isAuthenticated = computed(() => cardStore.isAuthenticated)
const isSyncing = computed(() => cardStore.isSyncing)
const lastSync = computed(() => cardStore.lastSync)
const formatLastSync = computed(() => cardStore.formatLastSync)
</script>
