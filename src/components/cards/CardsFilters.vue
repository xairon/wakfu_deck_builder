<template>
  <div class="bg-base-200 p-4 rounded-box space-y-4">
    <!-- Recherche et extension -->
    <div class="flex flex-wrap gap-4 items-center">
      <div class="form-control flex-1">
        <input
          type="text"
          :value="searchQuery"
          @input="
            $emit(
              'update:searchQuery',
              ($event.target as HTMLInputElement).value
            )
          "
          placeholder="Rechercher une carte..."
          class="input input-bordered w-full"
        />
      </div>
      <select
        :value="selectedExtension"
        @change="
          $emit(
            'update:selectedExtension',
            ($event.target as HTMLSelectElement).value
          )
        "
        class="select select-bordered"
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
    </div>

    <!-- Filtres avancés -->
    <div class="flex flex-wrap gap-4">
      <!-- Type principal -->
      <select
        :value="selectedMainType"
        @change="
          $emit(
            'update:selectedMainType',
            ($event.target as HTMLSelectElement).value
          )
        "
        class="select select-bordered"
      >
        <option value="">Tous les types</option>
        <option v-for="type in mainTypes" :key="type" :value="type">
          {{ type }}
        </option>
      </select>

      <!-- Sous-type -->
      <select
        :value="selectedSubType"
        @change="
          $emit(
            'update:selectedSubType',
            ($event.target as HTMLSelectElement).value
          )
        "
        class="select select-bordered"
      >
        <option value="">Tous les sous-types</option>
        <option v-for="type in subTypes" :key="type" :value="type">
          {{ type }}
        </option>
      </select>

      <!-- Rareté -->
      <select
        :value="selectedRarity"
        @change="
          $emit(
            'update:selectedRarity',
            ($event.target as HTMLSelectElement).value
          )
        "
        class="select select-bordered"
      >
        <option value="">Toutes les raretés</option>
        <option v-for="rarity in rarities" :key="rarity" :value="rarity">
          {{ rarity }}
        </option>
      </select>

      <!-- Élément -->
      <select
        :value="selectedElement"
        @change="
          $emit(
            'update:selectedElement',
            ($event.target as HTMLSelectElement).value
          )
        "
        class="select select-bordered"
      >
        <option value="">Tous les éléments</option>
        <option v-for="element in elements" :key="element" :value="element">
          {{ element }}
        </option>
      </select>

      <!-- Niveau -->
      <div class="flex items-center gap-2">
        <span class="text-sm">Niveau :</span>
        <input
          type="number"
          :value="minLevel"
          @input="
            $emit(
              'update:minLevel',
              ($event.target as HTMLInputElement).value
                ? parseInt(($event.target as HTMLInputElement).value)
                : null
            )
          "
          placeholder="Min"
          class="input input-bordered w-20"
          min="0"
        />
        <span>-</span>
        <input
          type="number"
          :value="maxLevel"
          @input="
            $emit(
              'update:maxLevel',
              ($event.target as HTMLInputElement).value
                ? parseInt(($event.target as HTMLInputElement).value)
                : null
            )
          "
          placeholder="Max"
          class="input input-bordered w-20"
          min="0"
        />
      </div>
    </div>

    <!-- Mots-clés -->
    <div class="flex flex-wrap gap-2">
      <div
        v-for="keyword in availableKeywords"
        :key="keyword"
        class="badge badge-outline cursor-pointer"
        :class="{ 'badge-primary': selectedKeywords.includes(keyword) }"
        @click="toggleKeyword(keyword)"
      >
        {{ keyword }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  searchQuery: string
  selectedExtension: string
  selectedMainType: string
  selectedSubType: string
  selectedRarity: string
  selectedElement: string
  minLevel: number | null
  maxLevel: number | null
  selectedKeywords: string[]
  extensions: string[]
  mainTypes: string[]
  subTypes: string[]
  rarities: string[]
  elements: string[]
  availableKeywords: string[]
}>()

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void
  (e: 'update:selectedExtension', value: string): void
  (e: 'update:selectedMainType', value: string): void
  (e: 'update:selectedSubType', value: string): void
  (e: 'update:selectedRarity', value: string): void
  (e: 'update:selectedElement', value: string): void
  (e: 'update:minLevel', value: number | null): void
  (e: 'update:maxLevel', value: number | null): void
  (e: 'update:selectedKeywords', value: string[]): void
}>()

function toggleKeyword(keyword: string) {
  const newSelectedKeywords = [...props.selectedKeywords]
  const index = newSelectedKeywords.indexOf(keyword)

  if (index === -1) {
    newSelectedKeywords.push(keyword)
  } else {
    newSelectedKeywords.splice(index, 1)
  }

  emit('update:selectedKeywords', newSelectedKeywords)
}
</script>
