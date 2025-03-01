<template>
  <div class="flex justify-between items-center">
    <div>
      <h1 class="text-3xl font-bold">Collection de Cartes</h1>
      <p class="text-base-content/70">
        Gérez votre collection de cartes Wakfu TCG
      </p>
    </div>
    <div class="flex gap-4">
      <button class="btn btn-outline" @click="exportCollection">
        <span class="text-xl mr-2">📤</span>
        Exporter
      </button>
      <button class="btn btn-outline" @click="importCollection">
        <span class="text-xl mr-2">📥</span>
        Importer
      </button>
    </div>
  </div>
  
  <div class="stats shadow mt-4">
    <div class="stat">
      <div class="stat-title">Collection</div>
      <div class="stat-value">{{ totalCollection }}</div>
      <div class="stat-desc">cartes au total</div>
    </div>
    <div class="stat">
      <div class="stat-title">Progression</div>
      <div class="stat-value">{{ collectionProgress }}%</div>
      <div class="stat-desc">des cartes collectées</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCardStore } from '@/stores/cardStore';
import { useToast } from '@/composables/useToast';

const cardStore = useCardStore();
const toast = useToast();

const totalCollection = computed(() => cardStore.totalCollection);
const collectionProgress = computed(() => cardStore.collectionProgress);

function exportCollection() {
  try {
    const data = JSON.stringify(cardStore.collection, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wakfu-collection.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Collection exportée avec succès');
  } catch (error) {
    toast.error('Erreur lors de l\'export de la collection');
  }
}

function importCollection() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = async (e) => {
    try {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      const data = JSON.parse(text);
      await cardStore.importCollection(data);
      toast.success('Collection importée avec succès');
    } catch (error) {
      toast.error('Erreur lors de l\'import de la collection');
    }
  };
  input.click();
}
</script> 