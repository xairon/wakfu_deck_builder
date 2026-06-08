<template>
  <dialog class="modal" :open="open" @close="emit('close')">
    <div class="modal-box max-w-2xl border border-base-content bg-base-100 p-0">
      <!-- En-tête -->
      <div
        class="flex items-center justify-between border-b border-base-content/15 p-4"
      >
        <div>
          <p class="eyebrow text-primary">Saisie rapide</p>
          <h3 class="font-display text-xl">Ajouter à la collection</h3>
        </div>
        <button
          class="btn btn-ghost btn-sm px-2"
          aria-label="Fermer"
          @click="emit('close')"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <!-- Recherche -->
      <div class="border-b border-base-content/15 p-4">
        <input
          ref="searchInput"
          v-model="search"
          type="text"
          placeholder="Tapez un nom de carte…"
          class="input input-bordered w-full"
          aria-label="Rechercher une carte à ajouter"
        />
        <p
          class="mt-2 font-mono text-[11px] uppercase tracking-wider text-base-content/45"
        >
          {{ added }} ajout{{ added > 1 ? "s" : "" }} cette session
        </p>
      </div>

      <!-- Résultats -->
      <ul class="max-h-[55vh] overflow-y-auto">
        <li
          v-for="card in results"
          :key="card.id"
          class="spine flex items-center gap-3 border-b border-base-content/10 px-4 py-2"
          :style="{ '--spine': elementColor(card) }"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate font-display text-[15px] leading-tight">
              {{ card.name }}
            </p>
            <p
              class="font-mono text-[10px] uppercase tracking-wider text-base-content/45"
            >
              {{ card.mainType }} · {{ card.extension?.name }}
            </p>
          </div>
          <!-- Normal -->
          <div class="flex shrink-0 items-center gap-1.5">
            <button
              class="grid h-7 w-7 place-items-center border border-base-content/40 font-mono leading-none hover:border-base-content disabled:opacity-30"
              :disabled="owned(card.id) <= 0"
              @click="change(card, -1, false)"
              aria-label="Retirer un exemplaire"
            >
              −
            </button>
            <span class="w-6 text-center font-mono text-sm tabular">{{
              owned(card.id)
            }}</span>
            <button
              class="grid h-7 w-7 place-items-center border border-base-content/40 font-mono leading-none hover:border-base-content"
              @click="change(card, 1, false)"
              aria-label="Ajouter un exemplaire"
            >
              +
            </button>
          </div>
          <!-- Foil -->
          <button
            class="shrink-0 border border-base-content/30 px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider hover:border-primary hover:text-primary"
            @click="change(card, 1, true)"
            :title="`Ajouter une brillante (${ownedFoil(card.id)})`"
          >
            +F<span v-if="ownedFoil(card.id) > 0" class="tabular"
              >·{{ ownedFoil(card.id) }}</span
            >
          </button>
        </li>
        <li
          v-if="search && !results.length"
          class="px-4 py-8 text-center text-sm text-base-content/45"
        >
          Aucune carte pour « {{ search }} ».
        </li>
        <li
          v-else-if="!search"
          class="px-4 py-8 text-center text-sm text-base-content/45"
        >
          Tapez un nom pour commencer.
        </li>
      </ul>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="emit('close')">Fermer</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useCardStore } from "@/stores/cardStore";
import { useToast } from "@/composables/useToast";
import type { Card } from "@/types/cards";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const cardStore = useCardStore();
const toast = useToast();

const search = ref("");
const added = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.open,
  (o) => {
    if (o) {
      added.value = 0;
      nextTick(() => searchInput.value?.focus());
    }
  },
);

const elementColors: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};
function elementColor(card: Card): string {
  const el = (
    card.stats?.niveau?.element ||
    card.stats?.force?.element ||
    "neutre"
  )
    .toString()
    .toLowerCase();
  return elementColors[el] || elementColors.neutre;
}

function owned(id: string): number {
  return cardStore.getCardQuantity(id);
}
function ownedFoil(id: string): number {
  return cardStore.getFoilCardQuantity(id);
}

const results = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return [];
  return cardStore.cards
    .filter((c) => c.name.toLowerCase().includes(q))
    .slice(0, 40);
});

function change(card: Card, delta: number, isFoil: boolean) {
  if (delta > 0) {
    cardStore.addToCollection(card, delta, isFoil);
    added.value += delta;
  } else {
    cardStore.removeFromCollection(card, Math.abs(delta), isFoil);
  }
  toast.success(`${card.name} : ${owned(card.id) + ownedFoil(card.id)}`, {
    duration: 1000,
  });
}
</script>
