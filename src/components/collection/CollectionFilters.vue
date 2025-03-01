<template>
  <div class="bg-base-200 p-4 rounded-box space-y-4">
    <!-- Recherche et extension -->
    <div class="flex flex-wrap gap-4 items-center">
      <div class="form-control flex-1">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Rechercher une carte..." 
          class="input input-bordered w-full"
          @input="emitSearchQuery"
        />
      </div>
      <select 
        v-model="selectedExtension" 
        class="select select-bordered"
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
      <label class="cursor-pointer label gap-2">
        <span class="label-text">Masquer les cartes non possédées</span>
        <input 
          type="checkbox" 
          v-model="hideNotOwned" 
          class="toggle toggle-primary"
          @change="emitHideNotOwned"
        />
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
            :class="{ 'btn-active': !isDescending }"
            @click="toggleSortDirection(false)"
          >
            ↑
          </button>
          <button 
            class="btn join-item"
            :class="{ 'btn-active': isDescending }"
            @click="toggleSortDirection(true)"
          >
            ↓
          </button>
        </div>
      </div>

      <!-- Type principal -->
      <select 
        v-model="selectedMainType" 
        class="select select-bordered"
        @change="emitSelectedMainType"
      >
        <option value="">Tous les types</option>
        <option 
          v-for="type in mainTypes" 
          :key="type" 
          :value="type"
        >
          {{ type }}
        </option>
      </select>

      <!-- Sous-type -->
      <select 
        v-model="selectedSubType" 
        class="select select-bordered"
        @change="emitSelectedSubType"
      >
        <option value="">Tous les sous-types</option>
        <option 
          v-for="type in subTypes" 
          :key="type" 
          :value="type"
        >
          {{ type }}
        </option>
      </select>

      <!-- Rareté (ajout) -->
      <select 
        v-model="selectedRarity" 
        class="select select-bordered"
        @change="emitSelectedRarity"
      >
        <option value="">Toutes les raretés</option>
        <option 
          v-for="rarity in rarities" 
          :key="rarity" 
          :value="rarity"
        >
          {{ rarity }}
        </option>
      </select>

      <!-- Élément (ajout) -->
      <select 
        v-model="selectedElement" 
        class="select select-bordered"
        @change="emitSelectedElement"
      >
        <option value="">Tous les éléments</option>
        <option 
          v-for="element in elements" 
          :key="element" 
          :value="element"
        >
          {{ element }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Composant de filtres pour la vue Collection
 * Permet de filtrer, trier et rechercher des cartes
 */
import { ref, watch } from 'vue'

// Props pour recevoir les options de filtre du parent
const props = defineProps<{
  extensions: string[]
  mainTypes: string[]
  subTypes: string[]
  rarities: string[]
  elements: string[]
  
  // État initial des filtres
  searchQuery: string
  selectedExtension: string
  hideNotOwned: boolean
  selectedSortField: string
  isDescending: boolean
  selectedMainType: string
  selectedSubType: string
  selectedRarity: string
  selectedElement: string
  minLevel: number | null
  maxLevel: number | null
}>()

// État local des filtres (synchronisé avec les props)
const searchQuery = ref(props.searchQuery)
const selectedExtension = ref(props.selectedExtension)
const hideNotOwned = ref(props.hideNotOwned)
const selectedSortField = ref(props.selectedSortField)
const isDescending = ref(props.isDescending)
const selectedMainType = ref(props.selectedMainType)
const selectedSubType = ref(props.selectedSubType)
const selectedRarity = ref(props.selectedRarity)
const selectedElement = ref(props.selectedElement)
const minLevel = ref(props.minLevel)
const maxLevel = ref(props.maxLevel)

// Synchroniser les refs locales avec les props quand elles changent
watch(() => props.searchQuery, (newVal) => searchQuery.value = newVal)
watch(() => props.selectedExtension, (newVal) => selectedExtension.value = newVal)
watch(() => props.hideNotOwned, (newVal) => hideNotOwned.value = newVal)
watch(() => props.selectedSortField, (newVal) => selectedSortField.value = newVal)
watch(() => props.isDescending, (newVal) => isDescending.value = newVal)
watch(() => props.selectedMainType, (newVal) => selectedMainType.value = newVal)
watch(() => props.selectedSubType, (newVal) => selectedSubType.value = newVal)
watch(() => props.selectedRarity, (newVal) => selectedRarity.value = newVal)
watch(() => props.selectedElement, (newVal) => selectedElement.value = newVal)
watch(() => props.minLevel, (newVal) => minLevel.value = newVal)
watch(() => props.maxLevel, (newVal) => maxLevel.value = newVal)

// Définition des émissions
const emit = defineEmits<{
  'update:search-query': [value: string]
  'update:selected-extension': [value: string]
  'update:hide-not-owned': [value: boolean]
  'update:selected-sort-field': [value: string]
  'update:is-descending': [value: boolean]
  'update:selected-main-type': [value: string]
  'update:selected-sub-type': [value: string]
  'update:selected-rarity': [value: string]
  'update:selected-element': [value: string] 
  'update:min-level': [value: number | null]
  'update:max-level': [value: number | null]
}>()

// Fonctions pour émettre les changements de filtres
function emitSearchQuery() {
  emit('update:search-query', searchQuery.value)
}

function emitSelectedExtension() {
  emit('update:selected-extension', selectedExtension.value)
}

function emitHideNotOwned() {
  emit('update:hide-not-owned', hideNotOwned.value)
}

function emitSelectedSortField() {
  emit('update:selected-sort-field', selectedSortField.value)
}

function emitSelectedMainType() {
  emit('update:selected-main-type', selectedMainType.value)
}

function emitSelectedSubType() {
  emit('update:selected-sub-type', selectedSubType.value)
}

function emitSelectedRarity() {
  emit('update:selected-rarity', selectedRarity.value)
}

function emitSelectedElement() {
  emit('update:selected-element', selectedElement.value)
}

// Helper pour changer la direction de tri
function toggleSortDirection(descending: boolean) {
  isDescending.value = descending
  emit('update:is-descending', descending)
}
</script> 