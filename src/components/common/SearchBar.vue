<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const searchInput = ref(props.modelValue);

function updateSearch(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  searchInput.value = value;
  emit('update:modelValue', value);
}
</script>

<template>
  <div class="form-control">
    <div class="input-group">
      <input
        type="text"
        :value="searchInput"
        @input="updateSearch"
        placeholder="Rechercher une carte..."
        class="input input-bordered w-full max-w-xs"
      />
      <button class="btn btn-square">
        <span class="i-carbon-search text-xl"></span>
      </button>
    </div>
  </div>
</template> 