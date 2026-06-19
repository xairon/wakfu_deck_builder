<template>
  <!-- ── PANEL variant : section inline, pas de dialog ── -->
  <section
    v-if="variant === 'panel'"
    class="card-zoom-panel"
    aria-label="Lecture de carte"
  >
    <!-- État vide -->
    <div
      v-if="!card"
      class="flex min-h-[12rem] items-center justify-center text-sm text-base-content/40"
    >
      Choisissez une carte à lire
    </div>

    <!-- Contenu partagé -->
    <template v-else>
      <CardZoomInner
        :card="card"
        :errata="errata"
        :display-effects="displayEffects"
        :element-color="elementColor"
        :card-img="cardImg"
        @img-error="onImgError"
        @close="emit('close')"
        show-close
      >
        <template v-if="$slots.actions" #actions>
          <slot name="actions" />
        </template>
      </CardZoomInner>
    </template>
  </section>

  <!-- ── MODAL variant (défaut) : dialog DaisyUI ── -->
  <dialog v-else class="modal" :open="open" @close="emit('close')">
    <div
      v-if="card"
      class="modal-box max-w-3xl border border-base-content bg-base-100 p-0"
    >
      <CardZoomInner
        :card="card"
        :errata="errata"
        :display-effects="displayEffects"
        :element-color="elementColor"
        :card-img="cardImg"
        @img-error="onImgError"
        @close="emit('close')"
        show-close
      >
        <template v-if="$slots.actions" #actions>
          <slot name="actions" />
        </template>
      </CardZoomInner>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="emit('close')">Fermer</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Card } from "@/types/cards";
import { isHeroCard } from "@/types/cards";
import { fetchErrata, type ErrataEntry } from "@/services/errataService";
import CardZoomInner from "./CardZoomInner.vue";

const props = defineProps<{
  card: Card | null;
  open: boolean;
  variant?: "modal" | "panel";
}>();
const emit = defineEmits<{ (e: "close"): void }>();

const errata = ref<ErrataEntry[]>([]);
watch(
  () => [props.open, props.card?.id],
  async () => {
    errata.value = [];
    // For panel variant, open is always true; watch card changes instead
    const shouldFetch =
      props.variant === "panel"
        ? !!props.card?.id
        : props.open && !!props.card?.id;
    if (shouldFetch && props.card?.id) {
      errata.value = await fetchErrata(props.card.id);
    }
  },
  { immediate: true },
);

// Also watch card changes for panel variant
watch(
  () => props.card?.id,
  async (newId) => {
    if (props.variant === "panel" && newId) {
      errata.value = [];
      errata.value = await fetchErrata(newId);
    }
  },
);

const displayEffects = computed(() => {
  const c = props.card;
  if (!c) return [];
  if (isHeroCard(c)) {
    return [...(c.recto?.effects ?? []), ...(c.verso?.effects ?? [])];
  }
  return c.effects ?? [];
});

const elementColors: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};

const elementColor = computed(() => {
  const el = (
    props.card?.stats?.niveau?.element ||
    props.card?.stats?.force?.element ||
    "neutre"
  )
    .toString()
    .toLowerCase();
  return elementColors[el] || elementColors.neutre;
});

const cardImg = computed(() => {
  const c = props.card;
  if (!c) return "/images/card-back.webp";
  if (c.imageUrl) return c.imageUrl;
  if (c.mainType === "Héros") return `/images/cards/${c.id}_recto.webp`;
  return `/images/cards/${c.id}.webp`;
});

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}
</script>
