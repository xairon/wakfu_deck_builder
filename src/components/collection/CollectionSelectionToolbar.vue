<template>
  <div
    class="mt-4 flex flex-col gap-3 border border-primary/40 bg-base-200 p-3 max-w-screen-xl mx-auto"
  >
    <div class="flex flex-wrap items-center gap-3">
      <p class="eyebrow text-primary shrink-0">
        {{ selectedCount }} sélectionnée{{ selectedCount > 1 ? "s" : "" }}
      </p>

      <div class="flex flex-wrap gap-1.5">
        <button
          class="btn btn-ghost btn-xs font-mono uppercase tracking-wider"
          data-testid="bulk-select-all-page"
          @click="$emit('select-all-page')"
        >
          Tout (page)
        </button>
        <button
          class="btn btn-ghost btn-xs font-mono uppercase tracking-wider"
          data-testid="bulk-select-all-filtered"
          @click="$emit('select-all-filtered')"
        >
          Tout ({{ filteredCount }} résultats)
        </button>
        <button
          class="btn btn-ghost btn-xs font-mono uppercase tracking-wider"
          data-testid="bulk-deselect-all"
          :disabled="selectedCount === 0"
          @click="$emit('deselect-all')"
        >
          Aucune
        </button>
      </div>

      <button
        class="btn btn-outline btn-xs ml-auto font-mono uppercase tracking-wider"
        data-testid="bulk-exit"
        @click="$emit('exit')"
      >
        Fermer la sélection
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2 border-t border-base-content/15 pt-3">
      <button
        class="btn btn-primary btn-sm"
        data-testid="bulk-mark-owned"
        :disabled="selectedCount === 0 || busy"
        @click="$emit('mark-owned')"
      >
        Marquer possédées (playset)
      </button>
      <button
        class="btn btn-outline btn-error btn-sm"
        data-testid="bulk-mark-missing"
        :disabled="selectedCount === 0 || busy"
        @click="$emit('mark-missing')"
      >
        Marquer non possédées
      </button>

      <div class="join">
        <span
          class="join-item flex items-center border border-base-content/20 bg-base-100 px-2 font-mono text-[11px] uppercase tracking-wider text-base-content/60"
        >
          Normal
        </span>
        <button
          class="join-item btn btn-outline btn-sm"
          data-testid="bulk-normal-minus"
          :disabled="selectedCount === 0 || busy"
          @click="$emit('adjust', -1, false)"
          aria-label="Retirer un exemplaire normal à la sélection"
        >
          −1
        </button>
        <button
          class="join-item btn btn-outline btn-sm"
          data-testid="bulk-normal-plus"
          :disabled="selectedCount === 0 || busy"
          @click="$emit('adjust', 1, false)"
          aria-label="Ajouter un exemplaire normal à la sélection"
        >
          +1
        </button>
      </div>

      <div class="join">
        <span
          class="join-item flex items-center border border-base-content/20 bg-base-100 px-2 font-mono text-[11px] uppercase tracking-wider text-base-content/60"
        >
          Foil
        </span>
        <button
          class="join-item btn btn-outline btn-sm"
          data-testid="bulk-foil-minus"
          :disabled="selectedCount === 0 || busy"
          @click="$emit('adjust', -1, true)"
          aria-label="Retirer un exemplaire foil à la sélection"
        >
          −1
        </button>
        <button
          class="join-item btn btn-outline btn-sm"
          data-testid="bulk-foil-plus"
          :disabled="selectedCount === 0 || busy"
          @click="$emit('adjust', 1, true)"
          aria-label="Ajouter un exemplaire foil à la sélection"
        >
          +1
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Barre d'actions groupées affichée en mode sélection multiple de la
 * collection : sélection rapide (page / résultats filtrés / aucune) et
 * actions en masse (playset complet, vider, ajuster ±1).
 */
withDefaults(
  defineProps<{
    selectedCount: number;
    filteredCount: number;
    busy?: boolean;
  }>(),
  { busy: false },
);

defineEmits<{
  "select-all-page": [];
  "select-all-filtered": [];
  "deselect-all": [];
  "mark-owned": [];
  "mark-missing": [];
  adjust: [delta: number, isFoil: boolean];
  exit: [];
}>();
</script>
