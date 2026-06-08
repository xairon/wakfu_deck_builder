<template>
  <div class="border border-base-content/15 bg-base-200 p-4 space-y-4">
    <!-- Recherche et extension -->
    <div class="flex flex-wrap gap-4 items-center">
      <div class="flex-1 min-w-[200px]">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Rechercher une carte…"
          class="input input-bordered w-full"
          aria-label="Rechercher une carte"
          @input="emitSearchQuery"
        />
      </div>
      <select
        v-model="selectedExtension"
        class="select select-bordered"
        aria-label="Filtrer par extension"
        @change="emitSelectedExtension"
      >
        <option value="">Toutes les extensions</option>
        <option
          v-for="extension in extensions"
          :key="extension"
          :value="extension"
        >
          {{ extension }}
        </option>
      </select>
      <label class="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          v-model="hideNotOwned"
          class="checkbox checkbox-sm checkbox-primary"
          @change="emitHideNotOwned"
        />
        <span class="eyebrow">Masquer les non possédées</span>
      </label>
    </div>

    <!-- Filtres avancés -->
    <div class="flex flex-wrap gap-4">
      <!-- Tri -->
      <div class="flex flex-wrap items-center gap-4">
        <div class="join">
          <select
            v-model="selectedSortField"
            class="select select-bordered join-item"
            aria-label="Trier par"
            @change="emitSelectedSortField"
          >
            <option value="number">Numéro</option>
            <option value="rarity">Rareté</option>
            <option value="type">Type</option>
            <option value="element">Élément</option>
            <option value="force">Force</option>
          </select>
          <button
            class="btn join-item"
            :class="!isDescending ? 'btn-neutral' : 'btn-outline'"
            @click="toggleSortDirection(false)"
            aria-label="Tri croissant"
            :aria-pressed="!isDescending"
          >
            ↑
          </button>
          <button
            class="btn join-item"
            :class="isDescending ? 'btn-neutral' : 'btn-outline'"
            @click="toggleSortDirection(true)"
            aria-label="Tri décroissant"
            :aria-pressed="isDescending"
          >
            ↓
          </button>
        </div>
      </div>

      <!-- Type principal -->
      <select
        v-model="selectedMainType"
        class="select select-bordered"
        aria-label="Filtrer par type"
        @change="emitSelectedMainType"
      >
        <option value="">Tous les types</option>
        <option v-for="type in mainTypes" :key="type" :value="type">
          {{ type }}
        </option>
      </select>

      <!-- Sous-type -->
      <select
        v-model="selectedSubType"
        class="select select-bordered"
        aria-label="Filtrer par sous-type"
        @change="emitSelectedSubType"
      >
        <option value="">Tous les sous-types</option>
        <option v-for="type in subTypes" :key="type" :value="type">
          {{ type }}
        </option>
      </select>

      <!-- Rareté (ajout) -->
      <select
        v-model="selectedRarity"
        class="select select-bordered"
        aria-label="Filtrer par rareté"
        @change="emitSelectedRarity"
      >
        <option value="">Toutes les raretés</option>
        <option v-for="rarity in rarities" :key="rarity" :value="rarity">
          {{ rarity }}
        </option>
      </select>

      <!-- Élément (ajout) -->
      <select
        v-model="selectedElement"
        class="select select-bordered"
        aria-label="Filtrer par élément"
        @change="emitSelectedElement"
      >
        <option value="">Tous les éléments</option>
        <option v-for="element in elements" :key="element" :value="element">
          {{ element }}
        </option>
      </select>

      <!-- Niveau -->
      <div class="flex items-center gap-2">
        <span class="eyebrow" id="lvl-label">Niveau</span>
        <input
          type="number"
          v-model.number="minLevel"
          placeholder="Min"
          class="input input-bordered w-16 font-mono tabular"
          min="0"
          aria-label="Niveau minimum"
          aria-describedby="lvl-label"
          @input="emitMinLevel"
        />
        <span class="font-mono text-sm" aria-hidden="true">–</span>
        <input
          type="number"
          v-model.number="maxLevel"
          placeholder="Max"
          class="input input-bordered w-16 font-mono tabular"
          min="0"
          aria-label="Niveau maximum"
          aria-describedby="lvl-label"
          @input="emitMaxLevel"
        />
      </div>

      <!-- Coût (PA) -->
      <div class="flex items-center gap-2">
        <span class="eyebrow" id="pa-label">PA</span>
        <input
          type="number"
          v-model.number="minCost"
          placeholder="Min"
          class="input input-bordered w-16 font-mono tabular"
          min="0"
          max="10"
          aria-label="Coût PA minimum"
          aria-describedby="pa-label"
          @input="emitMinCost"
        />
        <span class="font-mono text-sm" aria-hidden="true">–</span>
        <input
          type="number"
          v-model.number="maxCost"
          placeholder="Max"
          class="input input-bordered w-16 font-mono tabular"
          min="0"
          max="10"
          aria-label="Coût PA maximum"
          aria-describedby="pa-label"
          @input="emitMaxCost"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Composant de filtres pour la vue Collection
 * Permet de filtrer, trier et rechercher des cartes
 */
import { ref, watch } from "vue";

// Props pour recevoir les options de filtre du parent
const props = defineProps<{
  extensions: string[];
  mainTypes: string[];
  subTypes: string[];
  rarities: string[];
  elements: string[];

  // État initial des filtres
  searchQuery: string;
  selectedExtension: string;
  hideNotOwned: boolean;
  selectedSortField: string;
  isDescending: boolean;
  selectedMainType: string;
  selectedSubType: string;
  selectedRarity: string;
  selectedElement: string;
  minLevel: number | null;
  maxLevel: number | null;
  minCost: number | null;
  maxCost: number | null;
}>();

// État local des filtres (synchronisé avec les props)
const searchQuery = ref(props.searchQuery);
const selectedExtension = ref(props.selectedExtension);
const hideNotOwned = ref(props.hideNotOwned);
const selectedSortField = ref(props.selectedSortField);
const isDescending = ref(props.isDescending);
const selectedMainType = ref(props.selectedMainType);
const selectedSubType = ref(props.selectedSubType);
const selectedRarity = ref(props.selectedRarity);
const selectedElement = ref(props.selectedElement);
const minLevel = ref(props.minLevel);
const maxLevel = ref(props.maxLevel);
const minCost = ref(props.minCost);
const maxCost = ref(props.maxCost);

// Synchroniser les refs locales avec les props quand elles changent
watch(
  () => props.searchQuery,
  (newVal) => (searchQuery.value = newVal),
);
watch(
  () => props.selectedExtension,
  (newVal) => (selectedExtension.value = newVal),
);
watch(
  () => props.hideNotOwned,
  (newVal) => (hideNotOwned.value = newVal),
);
watch(
  () => props.selectedSortField,
  (newVal) => (selectedSortField.value = newVal),
);
watch(
  () => props.isDescending,
  (newVal) => (isDescending.value = newVal),
);
watch(
  () => props.selectedMainType,
  (newVal) => (selectedMainType.value = newVal),
);
watch(
  () => props.selectedSubType,
  (newVal) => (selectedSubType.value = newVal),
);
watch(
  () => props.selectedRarity,
  (newVal) => (selectedRarity.value = newVal),
);
watch(
  () => props.selectedElement,
  (newVal) => (selectedElement.value = newVal),
);
watch(
  () => props.minLevel,
  (newVal) => (minLevel.value = newVal),
);
watch(
  () => props.maxLevel,
  (newVal) => (maxLevel.value = newVal),
);
watch(
  () => props.minCost,
  (newVal) => (minCost.value = newVal),
);
watch(
  () => props.maxCost,
  (newVal) => (maxCost.value = newVal),
);

// Définition des émissions
const emit = defineEmits<{
  "update:search-query": [value: string];
  "update:selected-extension": [value: string];
  "update:hide-not-owned": [value: boolean];
  "update:selected-sort-field": [value: string];
  "update:is-descending": [value: boolean];
  "update:selected-main-type": [value: string];
  "update:selected-sub-type": [value: string];
  "update:selected-rarity": [value: string];
  "update:selected-element": [value: string];
  "update:min-level": [value: number | null];
  "update:max-level": [value: number | null];
  "update:min-cost": [value: number | null];
  "update:max-cost": [value: number | null];
}>();

// Fonctions pour émettre les changements de filtres
function emitSearchQuery() {
  emit("update:search-query", searchQuery.value);
}

function emitSelectedExtension() {
  emit("update:selected-extension", selectedExtension.value);
}

function emitHideNotOwned() {
  emit("update:hide-not-owned", hideNotOwned.value);
}

function emitSelectedSortField() {
  emit("update:selected-sort-field", selectedSortField.value);
}

function emitSelectedMainType() {
  emit("update:selected-main-type", selectedMainType.value);
}

function emitSelectedSubType() {
  emit("update:selected-sub-type", selectedSubType.value);
}

function emitSelectedRarity() {
  emit("update:selected-rarity", selectedRarity.value);
}

function emitSelectedElement() {
  emit("update:selected-element", selectedElement.value);
}

function emitMinCost() {
  emit("update:min-cost", minCost.value);
}

function emitMaxCost() {
  emit("update:max-cost", maxCost.value);
}

function emitMinLevel() {
  emit("update:min-level", minLevel.value);
}

function emitMaxLevel() {
  emit("update:max-level", maxLevel.value);
}

// Helper pour changer la direction de tri
function toggleSortDirection(descending: boolean) {
  isDescending.value = descending;
  emit("update:is-descending", descending);
}
</script>
