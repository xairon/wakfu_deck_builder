<template>
  <div v-if="hasMeta" class="space-y-3" data-testid="deck-mag-meta">
    <div
      v-if="deck.formatNote"
      class="flex items-start gap-2 border-l-2 border-warning/70 bg-warning/10 px-3 py-2"
      data-testid="deck-format-note"
    >
      <svg
        viewBox="0 0 24 24"
        class="mt-0.5 h-4 w-4 shrink-0 text-warning"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
        />
      </svg>
      <p class="text-sm text-base-content/80">{{ deck.formatNote }}</p>
    </div>
    <div v-if="deck.alignment">
      <p class="eyebrow mb-1">Alignement</p>
      <p class="text-sm text-base-content/80">{{ deck.alignment }}</p>
    </div>
    <div v-if="deck.lore">
      <p class="eyebrow mb-1">Présentation</p>
      <p class="text-sm leading-relaxed text-base-content/80">
        {{ deck.lore }}
      </p>
    </div>
    <div v-if="deck.howToPlay">
      <p class="eyebrow mb-1">Comment le jouer</p>
      <p class="text-sm leading-relaxed text-base-content/80">
        {{ deck.howToPlay }}
      </p>
    </div>
    <div v-if="deck.keyCards && deck.keyCards.length">
      <p class="eyebrow mb-1">Cartes maîtresses</p>
      <p class="text-sm text-base-content/80">{{ deck.keyCards.join(", ") }}</p>
    </div>
    <div v-if="deck.protector">
      <p class="eyebrow mb-1">Protecteur</p>
      <p class="text-sm text-base-content/80">{{ deck.protector }}</p>
    </div>
    <p
      v-if="deck.illustrator || deck.magIssue"
      class="font-mono text-[11px] uppercase tracking-wider text-base-content/55"
    >
      <span v-if="deck.magIssue">{{ deck.magIssue }}</span>
      <span v-if="deck.illustrator && deck.magIssue"> · </span>
      <span v-if="deck.illustrator">Illus. {{ deck.illustrator }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { OfficialDeck } from "@/data/officialDecks";

const props = defineProps<{ deck: OfficialDeck }>();

const hasMeta = computed(() =>
  Boolean(
    props.deck.formatNote ||
      props.deck.lore ||
      props.deck.howToPlay ||
      props.deck.alignment ||
      (props.deck.keyCards && props.deck.keyCards.length) ||
      props.deck.protector ||
      props.deck.illustrator ||
      props.deck.magIssue,
  ),
);
</script>
