<script setup lang="ts">
/**
 * Équipements ATTACHÉS à un Porteur (Allié/Héros) — rendus en petites cartes
 * tuilées au bas du porteur. Sans ça, un Équipement joué sur un Allié disparaît
 * du plateau : l'ATTACH le retire de la zone `monde` et ne le range que dans
 * `bearer.attachments` (une simple liste d'ids), qu'AUCUN composant n'affichait.
 *
 * Les ids sont résolus via `store.state.instances` (plein en jeu LOCAL — le cas
 * concerné : tutoriel / bac à sable / vs IA). Chaque carte reste sélectionnable
 * (→ la barre d'action propose « ⚡ Activer » pour un pouvoir à inclinaison comme
 * la Dora) et survolable (zoom pour lire l'effet). Les bonus de stats éventuels
 * (`bearerBonus`) apparaissent déjà sur le Porteur via le badge de Force effective.
 */
import { computed } from "vue";
import type { Card } from "@/types/cards";
import type { RedactedInstance } from "@/game";
import { useGameStore } from "@/stores/gameStore";
import { useCardStore } from "@/stores/cardStore";
import GameCard from "./GameCard.vue";

const props = defineProps<{
  bearer: RedactedInstance;
  selectedId: string | null;
}>();
const emit = defineEmits<{
  (e: "select", instanceId: string): void;
  (e: "zoom", instanceId: string): void;
}>();

const store = useGameStore();
const cardStore = useCardStore();

const items = computed<{ inst: RedactedInstance; card: Card | null }[]>(() => {
  const out: { inst: RedactedInstance; card: Card | null }[] = [];
  for (const id of props.bearer.attachments ?? []) {
    const full = store.state.instances[id];
    if (!full) continue;
    out.push({
      inst: {
        instanceId: full.instanceId,
        cardId: full.cardId,
        owner: full.owner,
        controller: full.controller,
        face: full.face,
        orientation: full.orientation,
        counters: full.counters,
        attachments: full.attachments,
      },
      card: cardStore.cards.find((c) => c.id === full.cardId) ?? null,
    });
  }
  return out;
});
</script>

<template>
  <div
    v-if="items.length"
    class="attach"
    aria-label="Équipements attachés"
    data-testid="attached-equip"
  >
    <div
      v-for="(a, idx) in items"
      :key="a.inst.instanceId"
      class="attach__card"
      :style="{
        zIndex: 6 + idx,
        transform: `translate(${idx * 4}px, ${idx * -3}px)`,
      }"
    >
      <GameCard
        :instance="a.inst"
        :card="a.card"
        :selected="a.inst.instanceId === selectedId"
        @select="emit('select', a.inst.instanceId)"
        @zoom="emit('zoom', a.inst.instanceId)"
      />
    </div>
  </div>
</template>

<style scoped>
.attach {
  position: absolute;
  left: 50%;
  bottom: 3%;
  transform: translateX(-50%);
  z-index: 6;
  width: 88%;
  display: flex;
  justify-content: center;
  /* le conteneur laisse passer les clics ; seules les cartes captent (le Porteur
     dessous reste cliquable / draggable hors de la zone des équipements). */
  pointer-events: none;
}
.attach__card {
  width: 46%;
  pointer-events: auto;
  border-radius: 4px;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.65);
}
.attach__card + .attach__card {
  margin-left: -18%;
}
</style>
