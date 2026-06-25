<template>
  <div class="flex flex-wrap gap-x-6 gap-y-4">
    <div v-for="el in elementList" :key="el" class="flex items-center gap-2.5">
      <ElementIcon :element="el" size="md" />
      <span
        class="font-mono text-xs uppercase tracking-wider text-base-content/70"
      >
        {{ el }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import ElementIcon from "@/components/elements/ElementIcon.vue";
import { ELEMENTS, type Element } from "@/services/elementService";

const elementList: Element[] = [
  ELEMENTS.AIR,
  ELEMENTS.EAU,
  ELEMENTS.FEU,
  ELEMENTS.TERRE,
  ELEMENTS.NEUTRE,
];
</script>
