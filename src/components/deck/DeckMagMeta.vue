<template>
  <div v-if="hasMeta" class="space-y-3" data-testid="deck-mag-meta">
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
