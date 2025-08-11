/** * Composant affichant les statistiques de la collection * @component */
<template>
  <div
    class="collection-stats grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
  >
    <div class="stat bg-base-200 rounded-lg p-4">
      <div class="stat-title">Total des Cartes</div>
      <div class="stat-value">{{ stats.totalCards }}</div>
    </div>

    <div class="stat bg-base-200 rounded-lg p-4">
      <div class="stat-title">Cartes Uniques</div>
      <div class="stat-value">{{ stats.uniqueCards }}</div>
    </div>

    <div class="stat bg-base-200 rounded-lg p-4">
      <div class="stat-title">Cartes Foil</div>
      <div class="stat-value">{{ stats.foilCards }}</div>
    </div>

    <div class="stat bg-base-200 rounded-lg p-4">
      <div class="stat-title">Complétion</div>
      <div class="stat-value">
        {{ formatPercentage(stats.completionRate) }}%
      </div>
    </div>

    <div class="element-distribution col-span-full">
      <h3 class="text-lg font-bold mb-2">Distribution par Élément</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-for="(count, element) in stats.elementDistribution"
          :key="element"
          class="stat bg-base-200 rounded-lg p-4"
        >
          <div class="stat-title">{{ element }}</div>
          <div class="stat-value">{{ count }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CollectionStats } from '@/types/collection'

const props = defineProps<{
  stats: CollectionStats
}>()

function formatPercentage(value: number): string {
  return (value * 100).toFixed(1)
}
</script>

<style scoped>
.stats {
  @apply transition-all duration-300;
}

.stat-value {
  @apply text-2xl md:text-3xl font-bold;
}

.stat-desc {
  @apply text-base-content/70;
}
</style>
