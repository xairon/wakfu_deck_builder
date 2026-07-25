<template>
  <div v-if="errata.length" class="mt-4" data-testid="errata-panel">
    <p class="eyebrow mb-2 text-primary">Errata officiel</p>
    <div
      v-for="(e, i) in errata"
      :key="i"
      class="border-l-2 border-primary bg-primary/5 p-3"
      :class="i > 0 ? 'mt-2' : ''"
    >
      <p class="text-sm leading-relaxed">{{ e.summary }}</p>

      <!-- Structuré : on montre précisément quel champ a changé. -->
      <table v-if="visibleChanges(e).length" class="mt-2 w-full text-xs">
        <thead>
          <tr class="text-left text-base-content/50">
            <th class="pr-3 font-normal">Champ</th>
            <th class="pr-3 font-normal">Version imprimée</th>
            <th class="font-normal">À jouer</th>
          </tr>
        </thead>
        <tbody class="font-mono">
          <tr v-for="(c, j) in visibleChanges(e)" :key="j">
            <td class="pr-3 align-top">{{ c.label }}</td>
            <td class="pr-3 align-top text-base-content/50 line-through">
              {{ c.before }}
            </td>
            <td class="align-top font-bold">{{ c.after }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Non structuré : repli sur la prose (état des errata pas encore saisis). -->
      <p v-else-if="e.before || e.after" class="mt-1 font-mono text-xs">
        <span v-if="e.before" class="text-base-content/50 line-through">{{
          e.before
        }}</span>
        <span v-if="e.before && e.after"> → </span>
        <span v-if="e.after" class="text-base-content">{{ e.after }}</span>
      </p>

      <p
        class="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-base-content/45"
      >
        {{ formatFrenchDate(e.date)
        }}<span v-if="e.source"> · {{ e.source }}</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ErrataEntry } from "@/services/errataService";
import { formatFrenchDate } from "@/utils/date";

defineProps<{ errata: ErrataEntry[] }>();

/**
 * Une ligne sans libellé n'est pas affichable (colonne « Champ » vide) : on
 * l'écarte plutôt que de rendre une ligne muette. Jamais d'exception — un
 * errata mal saisi ne doit pas casser la fiche de carte.
 */
function visibleChanges(e: ErrataEntry) {
  return (e.changes ?? []).filter((c) => c?.label?.trim());
}
</script>
