<template>
  <section class="deck-draw-simulator">
    <!-- En-tête -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow text-primary">Atelier de tirage</p>
        <h2 class="mt-2 font-display text-2xl leading-tight">
          Simulateur de pioche
        </h2>
      </div>

      <!-- Pioche restante (mono tabulaire) -->
      <div class="stats text-right">
        <p
          class="font-mono text-[11px] uppercase tracking-wider text-base-content/55"
        >
          Cartes restantes
        </p>
        <p class="font-mono text-3xl tabular leading-none">
          {{ remaining
          }}<span class="text-base-content/40">/{{ librarySize }}</span>
        </p>
      </div>
    </div>

    <div class="mt-4 h-px w-full bg-base-content/80"></div>

    <!-- Deck vide / invalide -->
    <p
      v-if="librarySize === 0"
      class="error-message mt-6 border border-dashed border-base-content/25 py-10 text-center font-mono text-[12px] uppercase tracking-wide text-base-content/45"
    >
      Deck vide — aucune carte à piocher.
    </p>
    <template v-else>
      <!-- Avertissement deck incomplet -->
      <p
        v-if="librarySize < 48"
        class="error-message mt-4 spine py-1 font-mono text-[11px] uppercase tracking-wide text-base-content/55"
        :style="{ '--spine': '#F0A62B' }"
      >
        Deck invalide — {{ librarySize }} cartes sur 48 attendues.
      </p>

      <!-- Commandes -->
      <div class="mt-5 flex flex-wrap gap-2">
        <button class="draw-button btn btn-neutral gap-2" @click="drawHand">
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 7h10v13H4zM14 7l4 1.5-3 12L11 19"
            />
          </svg>
          Piocher une main
        </button>
        <button class="mulligan-button btn btn-outline gap-2" @click="mulligan">
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 9a8 8 0 0 1 13.7-4.3L20 7M20 15a8 8 0 0 1-13.7 4.3L4 17"
            />
            <path stroke-linecap="round" d="M20 4v3h-3M4 20v-3h3" />
          </svg>
          Mulligan
        </button>
        <button
          class="btn btn-ghost gap-2"
          :disabled="remaining === 0"
          @click="drawOne"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 5v14M5 12h14"
            />
          </svg>
          Piocher 1
        </button>
      </div>

      <!-- Invite initiale -->
      <p
        v-if="!hasDrawn"
        class="mt-6 border-y border-base-content/15 py-10 text-center font-mono text-[12px] uppercase tracking-wide text-base-content/45"
      >
        Tirez une main pour commencer.
      </p>

      <!-- Main tirée -->
      <template v-else>
        <p class="section-rule eyebrow mt-7">En main · {{ hand.length }}</p>
        <ul
          v-if="hand.length"
          class="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7"
        >
          <li v-for="(c, i) in hand" :key="`${c.id}-${i}`" class="drawn-card">
            <div class="plate-frame" :style="{ '--spine': cardColor(c) }">
              <img
                :src="cardImg(c)"
                :alt="c.name"
                class="aspect-[7/10] object-cover"
                loading="lazy"
                @error="onImgError"
              />
            </div>
            <p
              class="plate-caption mt-1.5 text-center font-display text-[12px] not-italic"
              :title="c.name"
            >
              {{ c.name }}
            </p>
          </li>
        </ul>
        <p
          v-else
          class="mt-4 border-y border-base-content/15 py-10 text-center font-mono text-[12px] uppercase tracking-wide text-base-content/45"
        >
          Pioche épuisée.
        </p>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Card, Deck } from "@/types/cards";

const props = defineProps<{ deck: Deck }>();

// ── Bibliothèque : 48 cartes du deck principal (hors réserve), quantités
//    dépliées. Construite de façon DÉTERMINISTE au setup (aucun appel au PRNG
//    ici — le mélange n'a lieu que dans les gestionnaires d'événements). ──
const library = computed<Card[]>(() => {
  const out: Card[] = [];
  for (const dc of props.deck.cards ?? []) {
    if (dc.isReserve) continue;
    const qty = Math.max(0, dc.quantity || 0);
    for (let i = 0; i < qty; i++) out.push(dc.card);
  }
  return out;
});

const librarySize = computed(() => library.value.length);

// État du tirage
const drawPile = ref<Card[]>([]);
const hand = ref<Card[]>([]);
const hasDrawn = ref(false);

const remaining = computed(() => drawPile.value.length);

// ── Fisher-Yates : appelle Math.random UNIQUEMENT lorsqu'invoqué depuis un
//    gestionnaire d'événement (jamais au niveau module / setup). ──
function shuffle(cards: Card[]): Card[] {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function drawN(n: number): Card[] {
  const taken: Card[] = [];
  for (let i = 0; i < n && drawPile.value.length > 0; i++) {
    const card = drawPile.value.shift();
    if (card) taken.push(card);
  }
  return taken;
}

function drawHand() {
  if (!librarySize.value) return;
  drawPile.value = shuffle(library.value);
  hand.value = drawN(7);
  hasDrawn.value = true;
}

function mulligan() {
  // Remélange l'intégralité de la bibliothèque puis repioche 7.
  drawHand();
}

function drawOne() {
  if (!hasDrawn.value) {
    drawHand();
    return;
  }
  const [card] = drawN(1);
  if (card) hand.value = [...hand.value, card];
}

// ── Couleurs d'encre élémentaire + chemins d'images ──
const elementColors: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};

function cardElement(card: Card): string {
  return (
    card.stats?.niveau?.element ||
    card.stats?.force?.element ||
    "Neutre"
  ).toLowerCase();
}

function cardColor(card: Card): string {
  return elementColors[cardElement(card)] || elementColors.neutre;
}

function cardImg(card: Card): string {
  if (card.imageUrl) return card.imageUrl;
  if (card.mainType === "Héros") return `/images/cards/${card.id}_recto.png`;
  return `/images/cards/${card.id}.png`;
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.png";
}
</script>
