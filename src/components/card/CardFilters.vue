/**
 * Composant de filtres pour la recherche et le tri des cartes
 * @component
 */
<template>
  <div class="collection-filters p-4 bg-base-200 rounded-lg">
    <div class="form-control">
      <input 
        type="text"
        v-model="localFilters.searchTerm"
        placeholder="Rechercher une carte..."
        class="input input-bordered w-full"
      />
    </div>
    
    <div class="filters-grid grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
      <div class="form-control">
        <label class="label">Éléments</label>
        <select 
          v-model="localFilters.elements"
          multiple
          class="select select-bordered w-full"
        >
          <option v-for="element in ELEMENTS" :key="element" :value="element">
            {{ element }}
          </option>
        </select>
      </div>
      
      <div class="form-control">
        <label class="label">Rareté</label>
        <select 
          v-model="localFilters.rarity"
          multiple
          class="select select-bordered w-full"
        >
          <option v-for="rarity in RARITIES" :key="rarity" :value="rarity">
            {{ rarity }}
          </option>
        </select>
      </div>
      
      <div class="flex flex-col gap-2">
        <label class="label cursor-pointer justify-start gap-2">
          <input 
            type="checkbox"
            v-model="localFilters.onlyFoil"
            class="checkbox"
          />
          <span>Uniquement Foil</span>
        </label>
        
        <label class="label cursor-pointer justify-start gap-2">
          <input 
            type="checkbox"
            v-model="localFilters.onlyMissing"
            class="checkbox"
          />
          <span>Cartes Manquantes</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { CollectionFilters } from '@/types/collection';
import { ELEMENTS, RARITIES } from '@/types/collection';

const props = defineProps<{
  modelValue: CollectionFilters;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', filters: CollectionFilters): void;
}>();

// Filtres locaux
const localFilters = ref<CollectionFilters>({ ...props.modelValue });

// Synchronisation bidirectionnelle
watch(localFilters, (newFilters) => {
  emit('update:modelValue', newFilters);
}, { deep: true });

watch(() => props.modelValue, (newFilters) => {
  localFilters.value = { ...newFilters };
}, { deep: true });
</script>

<style scoped>
.filters {
  @apply transition-all duration-300;
}

.input-group-text {
  @apply px-3 flex items-center;
}
</style> 