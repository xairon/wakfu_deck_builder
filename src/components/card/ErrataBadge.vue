<template>
  <span
    v-if="show"
    class="badge badge-warning badge-sm"
    title="Cette carte a fait l'objet d'un errata officiel"
  >
    Erraté
  </span>
</template>

<script setup lang="ts">
/**
 * Badge « Erraté » — signale au premier coup d'œil qu'une carte a fait
 * l'objet d'un errata officiel, sans avoir à ouvrir sa fiche.
 *
 * Piège de réactivité : `hasErrata` lit un cache MODULE (pas un ref/reactive)
 * rempli de façon asynchrone par `preloadErrata()`. Un `computed` qui ne
 * lirait QUE `hasErrata(props.cardId)` n'aurait aucune dépendance réactive et
 * ne se recalculerait donc jamais quand l'index se charge après le montage du
 * badge — ex. la grille de collection peut déjà avoir rendu des tuiles avant
 * que la promesse déclenchée ailleurs (CollectionView.onMounted) ne se
 * résolve. On déclenche donc aussi le préchargement ICI (idempotent : la
 * promesse de chargement est partagée par tous les appelants, cf.
 * errataService.ts) et on force le recalcul via un compteur local incrémenté
 * à la résolution — même principe que ErrataView.vue.
 */
import { ref, computed, onMounted } from "vue";
import { hasErrata, preloadErrata } from "@/services/errataService";

const props = defineProps<{ cardId: string }>();

const loadTick = ref(0);
onMounted(async () => {
  await preloadErrata();
  loadTick.value++;
});

const show = computed(() => {
  void loadTick.value; // dépendance réactive : recalcule après le chargement
  return hasErrata(props.cardId);
});
</script>
