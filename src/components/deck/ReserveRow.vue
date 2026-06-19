<template>
  <li
    class="spine flex items-center gap-2 border-b border-base-content/10 py-1.5"
    :style="{ '--spine': spineColor }"
  >
    <span
      class="w-5 shrink-0 font-mono text-sm font-bold tabular text-base-content/70"
      >{{ dc.quantity }}</span
    >
    <span class="truncate font-display text-sm leading-tight">{{
      dc.card.name
    }}</span>
    <span class="leader"></span>
    <span class="ml-1 flex shrink-0 items-center gap-1.5">
      <button
        class="text-base-content/40 hover:text-primary"
        @click="$emit('move-to-main', dc.card.id)"
        title="Renvoyer au deck principal"
        aria-label="Renvoyer au deck principal"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 20V9m0 0-4 4m4-4 4 4M5 4h14"
          />
        </svg>
      </button>
      <button
        class="font-mono text-base font-bold leading-none text-base-content/50 hover:text-error"
        @click="$emit('remove', dc.card.id)"
        aria-label="Retirer de la réserve"
      >
        ×
      </button>
    </span>
  </li>
</template>

<script setup lang="ts">
import type { DeckCard } from "@/types/cards";

defineProps<{
  dc: DeckCard;
  spineColor: string;
}>();

defineEmits<{
  "move-to-main": [id: string];
  remove: [id: string];
}>();
</script>
