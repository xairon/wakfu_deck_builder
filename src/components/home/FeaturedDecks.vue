<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    <router-link
      v-for="it in items"
      :key="it.id"
      :to="`/decks/official/${it.id}`"
      class="group block"
    >
      <div class="plate-frame transition group-hover:-translate-y-1">
        <img
          :src="it.img"
          :alt="it.hero"
          class="aspect-[7/10] object-cover object-[50%_18%]"
          loading="lazy"
          @error="onImgError"
        />
      </div>
      <p class="plate-caption truncate text-center">{{ it.name }}</p>
    </router-link>
  </div>
</template>

<script setup lang="ts">
export interface FeaturedItem {
  id: string;
  name: string;
  hero: string;
  img: string;
}

defineProps<{ items: FeaturedItem[] }>();

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}
</script>
