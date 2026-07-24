<template>
  <div class="grid gap-0 sm:grid-cols-[auto_1fr]">
    <!-- Planche -->
    <div class="border-b border-base-content/15 p-5 sm:border-b-0 sm:border-r">
      <div
        class="plate-frame mx-auto w-48"
        :style="{ '--spine': elementColor }"
      >
        <img
          :src="cardImg"
          :alt="card.name"
          class="aspect-[7/10] object-cover"
          @error="emit('imgError', $event)"
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
          v-if="showClose"
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
        <div v-for="s in statRows" :key="s.label" class="flex justify-between">
          <dt class="eyebrow text-base-content/50">{{ s.label }}</dt>
          <dd class="font-mono text-sm tabular">{{ s.value }}</dd>
        </div>
      </dl>

      <!-- Effets -->
      <div v-if="realEffects.length" data-testid="card-effects" class="mt-4">
        <p class="eyebrow mb-2">Effets</p>
        <ul class="space-y-2">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <li
            v-for="(e, i) in realEffects"
            :key="i"
            class="border-l-2 border-base-content/20 pl-3 text-sm leading-relaxed"
            v-html="highlightEffectHtml(e.description)"
          ></li>
        </ul>
      </div>

      <!-- Notes (rulings / errata) : précisions rattachées à la carte, PAS des
           effets de jeu — labellisées et regroupées à part. -->
      <div v-if="noteEffects.length" data-testid="card-notes" class="mt-4">
        <p class="eyebrow mb-2 text-base-content/60">Notes</p>
        <ul class="space-y-2">
          <li
            v-for="(n, i) in noteEffects"
            :key="i"
            class="border-l-2 border-base-content/15 pl-3 text-sm leading-relaxed text-base-content/70"
          >
            <span
              class="mr-1.5 border border-base-content/25 px-1.5 py-0.5 align-middle font-mono text-[10px] uppercase tracking-wider text-base-content/55"
              >{{ n.label }}</span
            >
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span v-html="highlightEffectHtml(n.description)"></span>
          </li>
        </ul>
      </div>

      <!-- Métier (Artisan) : trait porté par certains Alliés — jusqu'ici invisible
           dans la fiche. La définition « Métier » apparaît dans le Glossaire. -->
      <div v-if="card.metier?.length" class="mt-4" data-testid="card-metier">
        <p class="eyebrow mb-2">Métier</p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="m in card.metier"
            :key="m"
            class="border border-base-content/30 px-2 py-0.5 font-mono text-[11px] uppercase"
            >{{ m }}</span
          >
        </div>
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

      <!-- Glossaire : termes de mécanique cités dans l'effet (Métier, Agilité…) -->
      <div v-if="glossary.length" class="mt-4" data-testid="card-glossary">
        <p class="eyebrow mb-2">Glossaire</p>
        <dl class="space-y-1.5">
          <div
            v-for="g in glossary"
            :key="`gl-${g.term}`"
            class="rounded bg-base-content/5 px-2.5 py-1.5 text-sm leading-snug"
          >
            <dt class="font-bold">{{ g.term }}</dt>
            <dd class="text-base-content/70">{{ g.definition }}</dd>
          </div>
        </dl>
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
              {{ formatFrenchDate(e.date)
              }}<span v-if="e.source"> · {{ e.source }}</span>
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

      <!-- Actions optionnelles (ex. ajouter au deck depuis l'atelier).
           Vide par défaut : la modale reste sans dépendance de store. -->
      <div
        v-if="$slots.actions"
        class="mt-4 border-t border-base-content/15 pt-3"
      >
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "@/types/cards";
import type { ErrataEntry } from "@/services/errataService";
import {
  highlightEffectHtml,
  splitEffectsAndNotes,
  type EffectAnnotationKind,
} from "@/utils/effectText";
import { glossaryHints } from "@/utils/glossaryHints";
import { formatFrenchDate } from "@/utils/date";

type DisplayEffect = { description: string; kind?: EffectAnnotationKind };

const props = defineProps<{
  card: Card;
  errata: ErrataEntry[];
  displayEffects: DisplayEffect[];
  elementColor: string;
  cardImg: string;
  showClose?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "imgError", event: Event): void;
}>();

// Sépare les vrais effets de jeu des annotations (rulings/errata) : ces
// dernières ne sont pas des effets et sont affichées à part sous « Notes »
// (logique partagée avec le panneau de la Collection).
const realEffects = computed(
  () => splitEffectsAndNotes(props.displayEffects).effects,
);
const noteEffects = computed(
  () => splitEffectsAndNotes(props.displayEffects).notes,
);
/** Termes de mécanique non évidents (Métier, Recette, Agilité…) portés par la
 *  carte — effets, mots-clefs (Recette « : Bijoutier 3 »), ou Métier. */
const glossary = computed(() =>
  glossaryHints({
    effectsText: realEffects.value.map((e) => e.description).join("  "),
    keywordNames: (props.card.keywords ?? [])
      .map((k) => k.name)
      .filter((n): n is NonNullable<typeof n> => !!n),
    keywordDescriptions: (props.card.keywords ?? [])
      .map((k) => k.description)
      .filter((d): d is string => !!d),
    metier: props.card.metier ?? [],
  }),
);

const statRows = computed(() => {
  const s = props.card?.stats;
  const rows: { label: string; value: string }[] = [];
  if (s?.niveau)
    rows.push({
      label: "Niveau",
      value: `${s.niveau.value} ${s.niveau.element}`,
    });
  // Orbe imprimé (« Élément : [X] ») — types sans Force (Action/Équipement/…).
  if (props.card?.element)
    rows.push({ label: "Élément", value: props.card.element });
  if (s?.force)
    rows.push({ label: "Force", value: `${s.force.value} ${s.force.element}` });
  if (s?.pa !== undefined) rows.push({ label: "PA", value: String(s.pa) });
  if (s?.pm !== undefined) rows.push({ label: "PM", value: String(s.pm) });
  if (s?.pv !== undefined) rows.push({ label: "PV", value: String(s.pv) });
  return rows;
});
</script>
