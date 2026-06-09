<template>
  <dialog class="modal" :open="open" @close="emit('close')">
    <div
      v-if="card"
      class="modal-box max-w-3xl border border-base-content bg-base-100 p-0"
    >
      <div class="grid gap-0 sm:grid-cols-[auto_1fr]">
        <!-- Planche -->
        <div
          class="border-b border-base-content/15 p-5 sm:border-b-0 sm:border-r"
        >
          <div
            class="plate-frame mx-auto w-48"
            :style="{ '--spine': elementColor }"
          >
            <img
              :src="cardImg"
              :alt="card.name"
              class="aspect-[7/10] object-cover"
              @error="onImgError"
            />
          </div>
          <p class="plate-caption mt-2 text-center">
            {{ card.mainType }} · {{ card.rarity }}
          </p>
        </div>

        <!-- Fiche -->
        <div class="max-h-[80vh] overflow-y-auto p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="spine" :style="{ '--spine': elementColor }">
              <p class="eyebrow text-base-content/50">
                {{ card.subTypes?.join(" · ") || card.mainType }}
              </p>
              <h3 class="font-display text-2xl leading-tight">
                {{ card.name }}
              </h3>
            </div>
            <button
              class="btn btn-ghost btn-sm shrink-0 px-2"
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

          <!-- Caractéristiques (mono tabulaire) -->
          <dl
            class="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-y border-base-content/15 py-3"
          >
            <div
              v-for="s in statRows"
              :key="s.label"
              class="flex justify-between"
            >
              <dt class="eyebrow text-base-content/50">{{ s.label }}</dt>
              <dd class="font-mono text-sm tabular">{{ s.value }}</dd>
            </div>
          </dl>

          <!-- Effets -->
          <div v-if="card.effects?.length" class="mt-4">
            <p class="eyebrow mb-2">Effets</p>
            <ul class="space-y-2">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <li
                v-for="(e, i) in card.effects"
                :key="i"
                class="border-l-2 border-base-content/20 pl-3 text-sm leading-relaxed"
                v-html="highlightEffectHtml(e.description)"
              ></li>
            </ul>
          </div>

          <!-- Mots-clés -->
          <div v-if="card.keywords?.length" class="mt-4">
            <p class="eyebrow mb-2">Mots-clés</p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="k in card.keywords"
                :key="k.name"
                class="border border-base-content/30 px-2 py-0.5 font-mono text-[11px] uppercase"
                :title="k.description"
                >{{ k.name }}</span
              >
            </div>
          </div>

          <!-- Erratas -->
          <div v-if="errata.length" class="mt-4">
            <p class="eyebrow mb-2 text-primary">Errata</p>
            <ul class="space-y-2">
              <li
                v-for="(e, i) in errata"
                :key="i"
                class="border-l-2 border-primary pl-3 text-sm"
              >
                <p>{{ e.summary }}</p>
                <p
                  class="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-base-content/45"
                >
                  {{ e.date }}<span v-if="e.source"> · {{ e.source }}</span>
                </p>
              </li>
            </ul>
          </div>

          <!-- Saveur -->
          <p
            v-if="card.flavor?.text"
            class="mt-4 border-l-2 border-primary pl-3 font-display text-sm italic text-base-content/70"
          >
            « {{ card.flavor.text }} »
            <span v-if="card.flavor.attribution" class="not-italic"
              >— {{ card.flavor.attribution }}</span
            >
          </p>

          <p
            v-if="card.artists?.length"
            class="mt-4 font-mono text-[10px] uppercase tracking-wider text-base-content/40"
          >
            Illustration · {{ card.artists.join(", ") }}
          </p>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="emit('close')">Fermer</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Card } from "@/types/cards";
import { fetchErrata, type ErrataEntry } from "@/services/errataService";
import { highlightEffectHtml } from "@/utils/effectText";

const props = defineProps<{ card: Card | null; open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const errata = ref<ErrataEntry[]>([]);
watch(
  () => [props.open, props.card?.id],
  async () => {
    errata.value = [];
    if (props.open && props.card?.id) {
      errata.value = await fetchErrata(props.card.id);
    }
  },
  { immediate: true },
);

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

const statRows = computed(() => {
  const s = props.card?.stats;
  if (!s) return [];
  const rows: { label: string; value: string }[] = [];
  if (s.niveau)
    rows.push({
      label: "Niveau",
      value: `${s.niveau.value} ${s.niveau.element}`,
    });
  if (s.force)
    rows.push({ label: "Force", value: `${s.force.value} ${s.force.element}` });
  if (s.pa !== undefined) rows.push({ label: "PA", value: String(s.pa) });
  if (s.pm !== undefined) rows.push({ label: "PM", value: String(s.pm) });
  if (s.pv !== undefined) rows.push({ label: "PV", value: String(s.pv) });
  return rows;
});

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}
</script>
