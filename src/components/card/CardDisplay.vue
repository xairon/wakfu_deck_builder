<template>
  <div
    class="card bg-base-100 shadow-lg h-full hover:shadow-xl transition-shadow duration-300 cursor-pointer"
    @click="$emit('click')"
  >
    <figure class="relative px-4 pt-4">
      <OptimizedImage
        :src="`/images/cards/${cardImagePath}`"
        :alt="card.name"
        class="rounded-lg object-contain max-h-52"
        :width="180"
        :height="252"
        loading="lazy"
        @error="$emit('image-error', card)"
      />
      <div class="absolute top-2 right-2 badge badge-primary">
        {{ card.rarity }}
      </div>
    </figure>
    <div class="card-body p-4">
      <h2 class="card-title text-lg">{{ card.name }}</h2>
      <div class="flex items-center text-sm opacity-70">
        <span>{{ card.mainType }}</span>
        <span v-if="card.subTypes?.length" class="mx-1">•</span>
        <span v-if="card.subTypes?.length">{{ card.subTypes.join(', ') }}</span>
      </div>

      <!-- Statistiques de niveau et force -->
      <div class="flex justify-between items-center mt-2 text-sm">
        <div v-if="card.stats?.niveau" class="flex items-center gap-1">
          <span>Niveau {{ card.stats.niveau.value }}</span>
          <ElementIcon
            v-if="
              card.stats.niveau.element &&
              card.stats.niveau.element !== 'neutre'
            "
            :element="card.stats.niveau.element"
            size="xs"
          />
        </div>
        <div v-if="card.stats?.force" class="flex items-center gap-1">
          <span>Force {{ card.stats.force.value }}</span>
          <ElementIcon
            v-if="
              card.stats.force.element && card.stats.force.element !== 'neutre'
            "
            :element="card.stats.force.element"
            size="xs"
          />
        </div>
      </div>

      <!-- Quantité dans la collection si demandé -->
      <div v-if="showQuantity" class="mt-2">
        <div
          class="badge badge-ghost"
          :class="{ 'badge-outline': quantity <= 0 }"
        >
          {{ quantity > 0 ? `${quantity} en collection` : 'Non collectée' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '@/types/cards'
import OptimizedImage from '@/components/common/OptimizedImage.vue'
import ElementIcon from '@/components/elements/ElementIcon.vue'

interface Props {
  card: Card
  showQuantity?: boolean
  quantity?: number
}

const props = withDefaults(defineProps<Props>(), {
  showQuantity: false,
  quantity: 0,
})

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'image-error', card: Card): void
}>()

const cardImagePath = computed(() => {
  if (props.card.mainType === 'Héros') {
    return `${props.card.id}_recto.png`
  }
  return `${props.card.id}.png`
})
</script>

<style scoped>
.card-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
