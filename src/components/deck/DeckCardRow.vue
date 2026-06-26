<template>
  <li
    class="spine flex items-center gap-2 border-b border-base-content/10 py-1.5"
    :style="{ '--spine': spineColor }"
    @mouseenter="preview.show(dc.card)"
    @mouseleave="preview.hide()"
  >
    <span
      class="w-5 shrink-0 font-mono text-sm font-bold tabular text-base-content/70"
      >{{ dc.quantity }}</span
    >
    <span class="truncate font-display text-sm leading-tight">{{
      dc.card.name
    }}</span>
    <span class="leader"></span>
    <span
      class="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-base-content/45"
    >
      {{ dc.card.mainType
      }}<span v-if="dc.card.stats?.pa"> · {{ dc.card.stats.pa }} PA</span>
    </span>
    <span
      v-if="hasMultipleEditions"
      class="shrink-0"
      @mouseenter="preview.hide()"
    >
      <select
        class="select select-ghost select-xs h-6 min-h-0 max-w-[7.5rem] truncate font-mono text-[10px] uppercase tracking-wider"
        :value="dc.card.id"
        :title="`Édition : ${dc.card.extension.name}`"
        :aria-label="`Édition de ${dc.card.name}`"
        @change="
          $emit(
            'set-edition',
            dc.card.id,
            editions.find(
              (e) => e.id === ($event.target as HTMLSelectElement).value,
            )!,
          )
        "
      >
        <option v-for="e in editions" :key="e.id" :value="e.id">
          {{ e.extension.name }}
        </option>
      </select>
    </span>
    <span class="ml-1 flex shrink-0 items-center gap-1.5">
      <button
        class="text-base-content/40 hover:text-primary"
        @click="
          preview.hide();
          $emit('move-to-reserve', dc.card.id);
        "
        title="Déplacer en réserve"
        aria-label="Déplacer en réserve"
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
            d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"
          />
        </svg>
      </button>
      <button
        class="font-mono text-base font-bold leading-none text-base-content/50 hover:text-base-content"
        @click="
          preview.hide();
          $emit('remove', dc.card.id);
        "
        aria-label="Retirer une copie"
      >
        −
      </button>
      <button
        class="font-mono text-base font-bold leading-none text-base-content/50 hover:text-base-content"
        @click="$emit('add', dc.card)"
        aria-label="Ajouter une copie"
      >
        +
      </button>
    </span>
  </li>
</template>

<script setup lang="ts">
import type { Card, DeckCard } from "@/types/cards";
import { computed } from "vue";
import { useCardPreview } from "@/composables/useCardPreview";
import { useCardStore } from "@/stores/cardStore";

const preview = useCardPreview();
const cardStore = useCardStore();

const props = defineProps<{
  dc: DeckCard;
  spineColor: string;
}>();

defineEmits<{
  "move-to-reserve": [id: string];
  remove: [id: string];
  add: [card: Card];
  "set-edition": [cardId: string, printing: Card];
}>();

const editions = computed(() => cardStore.printingsOf(props.dc.card));
const hasMultipleEditions = computed(() => editions.value.length > 1);
</script>
