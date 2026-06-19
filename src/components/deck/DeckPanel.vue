<template>
  <!-- Nom + validité -->
  <div class="p-4">
    <input
      :value="currentDeck?.name"
      @change="renameCurrent(($event.target as HTMLInputElement).value)"
      class="w-full border-b border-transparent bg-transparent font-display text-2xl leading-tight focus:border-base-content focus:outline-none"
      aria-label="Nom du deck"
      placeholder="Nom du deck"
    />
    <div class="mt-4 flex items-center justify-between gap-3">
      <span
        class="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider"
        :class="validation.isValid ? 'text-primary' : 'text-base-content/55'"
      >
        <span
          class="h-2 w-2"
          :class="validation.isValid ? 'bg-primary' : 'bg-base-content/40'"
        ></span>
        {{ validation.isValid ? "Prêt à jouer" : "En cours" }}
      </span>
      <!-- Compteur : devient le sceau à 48 -->
      <span
        v-if="cardCount === 48"
        class="seal shrink-0"
        aria-label="48 cartes sur 48"
        >48/48</span
      >
      <span v-else class="font-mono text-2xl font-bold tabular leading-none"
        >{{ cardCount }}<span class="text-base-content/35">/48</span></span
      >
    </div>
    <!-- Jauge : filet d'encre carré, remplissage braise→encre -->
    <div class="mt-3 h-px w-full bg-base-content/15">
      <div
        class="h-px transition-all duration-200"
        :class="cardCount === 48 ? 'bg-base-content' : 'bg-primary'"
        :style="{ width: Math.min(100, (cardCount / 48) * 100) + '%' }"
      ></div>
    </div>
    <ul
      v-if="!validation.isValid && validation.errors.length"
      role="status"
      aria-live="polite"
      class="mt-4 space-y-1.5 text-xs text-base-content/60"
    >
      <li
        v-for="(err, i) in validation.errors.slice(0, 4)"
        :key="i"
        class="flex items-start gap-2"
      >
        <span class="mt-1.5 h-1 w-1 shrink-0 bg-primary"></span>
        {{ err }}
      </li>
    </ul>
  </div>
  <div class="h-px w-full bg-base-content/15"></div>

  <!-- Slots héros / havre-sac : puits papier, filet d'encre central -->
  <div class="grid grid-cols-2 divide-x divide-base-content/15">
    <div class="relative bg-base-100 p-3">
      <span class="eyebrow text-base-content/50">Héros</span>
      <div v-if="currentDeck?.hero" class="mt-2 flex items-center gap-2.5">
        <div
          class="plate-frame w-10 shrink-0"
          :style="{ '--spine': elementColor(currentDeck.hero) }"
        >
          <img
            :src="cardImg(currentDeck.hero)"
            :alt="currentDeck.hero.name"
            class="aspect-[7/10] object-cover"
            @error="onImgError"
          />
        </div>
        <div class="min-w-0">
          <p class="truncate font-display text-sm leading-tight">
            {{ currentDeck.hero.name }}
          </p>
          <button
            class="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-error hover:underline"
            @click="deckStore.removeHero()"
          >
            Retirer
          </button>
        </div>
      </div>
      <p v-else class="mt-2 text-xs text-base-content/40">Cliquez un héros</p>
    </div>

    <div class="relative bg-base-100 p-3">
      <span class="eyebrow text-base-content/50">Havre-Sac</span>
      <div v-if="currentDeck?.havreSac" class="mt-2 flex items-center gap-2.5">
        <div
          class="plate-frame w-10 shrink-0"
          :style="{ '--spine': elementColor(currentDeck.havreSac) }"
        >
          <img
            :src="cardImg(currentDeck.havreSac)"
            :alt="currentDeck.havreSac.name"
            class="aspect-[7/10] object-cover"
            @error="onImgError"
          />
        </div>
        <div class="min-w-0">
          <p class="truncate font-display text-sm leading-tight">
            {{ currentDeck.havreSac.name }}
          </p>
          <button
            class="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-error hover:underline"
            @click="deckStore.removeHavreSac()"
          >
            Retirer
          </button>
        </div>
      </div>
      <p v-else class="mt-2 text-xs text-base-content/40">
        Cliquez un havre-sac
      </p>
    </div>
  </div>
  <div class="h-px w-full bg-base-content/15"></div>

  <!-- Distribution élémentaire : filet segmenté + légende mono -->
  <div v-if="cardCount > 0" class="p-4">
    <p class="section-rule eyebrow mb-3">Éléments</p>
    <div class="flex h-px w-full">
      <div
        v-for="el in elementDist"
        :key="el.name"
        :style="{
          width: (el.count / Math.max(1, cardCount)) * 100 + '%',
          backgroundColor: el.color,
        }"
        :title="`${el.name}: ${el.count}`"
      ></div>
    </div>
    <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      <span
        v-for="el in elementDist"
        :key="el.name"
        class="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-base-content/65"
      >
        <span class="h-2.5 w-2.5" :style="{ backgroundColor: el.color }"></span>
        {{ el.name }}
        <span class="tabular text-base-content">{{ el.count }}</span>
      </span>
    </div>
    <!-- Répartition par type -->
    <div
      class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-base-content/10 pt-3"
    >
      <span
        v-for="t in typeBreakdown"
        :key="t.type"
        class="font-mono text-[11px] uppercase tracking-wider text-base-content/65"
      >
        {{ t.type }}
        <span class="tabular text-base-content">{{ t.count }}</span>
      </span>
    </div>
  </div>
  <div v-if="cardCount > 0" class="h-px w-full bg-base-content/15"></div>

  <!-- Liste des cartes : grand-livre à conduite de points -->
  <div class="p-4">
    <div class="mb-3 flex items-center justify-between gap-3">
      <p class="section-rule eyebrow grow">Cartes du deck</p>
      <button
        v-if="cardCount > 0"
        class="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-base-content/50 hover:text-error"
        data-testid="deck-clear"
        @click="$emit('confirm-clear')"
      >
        Tout vider
      </button>
    </div>
    <div
      v-if="!currentDeck?.cards.length"
      class="py-8 text-center text-sm text-base-content/40"
    >
      Cliquez des cartes à gauche pour les ajouter.
    </div>
    <ul v-else class="max-h-[34vh] overflow-y-auto">
      <DeckCardRow
        v-for="dc in mainDeckCards"
        :key="dc.card.id"
        :dc="dc"
        :spine-color="elementColor(dc.card)"
        @move-to-reserve="moveToReserve"
        @remove="(id) => deckStore.removeCard(id, 1)"
        @add="(card) => $emit('add-to-deck', card)"
      />
    </ul>
  </div>

  <!-- Réserve (sideboard, max 12) -->
  <div class="h-px w-full bg-base-content/15"></div>
  <div class="p-4">
    <div class="mb-3 flex items-center justify-between gap-3">
      <p class="section-rule eyebrow grow">Réserve</p>
      <span
        class="shrink-0 font-mono text-xs font-bold tabular"
        :class="
          reserveCount === 12
            ? 'text-primary'
            : reserveCount === 0
              ? 'text-base-content/55'
              : 'text-warning'
        "
        :title="
          reserveCount !== 0 && reserveCount !== 12
            ? 'La réserve doit contenir exactement 0 ou 12 cartes (règle 101.4)'
            : ''
        "
        >{{ reserveCount }} / 12<span
          v-if="reserveCount !== 0 && reserveCount !== 12"
          class="ml-1 lowercase text-warning"
          >· 0 ou 12 requis</span
        ></span
      >
    </div>
    <ul v-if="reserveDeckCards.length" class="max-h-[22vh] overflow-y-auto">
      <ReserveRow
        v-for="dc in reserveDeckCards"
        :key="'r-' + dc.card.id"
        :dc="dc"
        :spine-color="elementColor(dc.card)"
        @move-to-main="moveToMain"
        @remove="(id) => deckStore.removeCard(id, 1, true)"
      />
    </ul>
    <p v-else class="py-3 text-xs text-base-content/40">
      Réserve vide — déplacez-y des cartes du deck avec le bouton ↓.
    </p>
  </div>
  <div class="h-px w-full bg-base-content/15"></div>

  <!-- Cartes manquantes pour jouer cette liste (connecté) -->
  <div v-if="isAuthenticated && missingTotal > 0" class="p-4">
    <p class="section-rule eyebrow mb-3 text-primary">
      À acquérir · {{ missingTotal }}
    </p>
    <ul class="max-h-[20vh] space-y-1 overflow-y-auto">
      <li
        v-for="m in missingCards"
        :key="'miss-' + m.card.id"
        class="flex items-baseline gap-2 text-xs"
      >
        <span class="font-mono tabular text-primary">+{{ m.missing }}</span>
        <span class="truncate font-display">{{ m.card.name }}</span>
        <span class="leader"></span>
        <span
          class="shrink-0 font-mono text-[10px] tabular text-base-content/45"
          >{{ m.have }}/{{ m.need }}</span
        >
      </li>
    </ul>
  </div>
  <div
    v-if="isAuthenticated && missingTotal > 0"
    class="h-px w-full bg-base-content/15"
  ></div>

  <!-- Notes du deck -->
  <div class="p-4">
    <p class="eyebrow mb-2 text-base-content/50">Notes</p>
    <textarea
      :value="currentDeck?.description || ''"
      @change="updateNotes(($event.target as HTMLTextAreaElement).value)"
      rows="2"
      placeholder="Archétype, plan de jeu, choix de réserve…"
      class="textarea textarea-bordered w-full text-sm"
    ></textarea>
  </div>
  <div class="h-px w-full bg-base-content/15"></div>

  <!-- Actions -->
  <div class="flex flex-wrap items-center gap-2 p-4">
    <router-link
      v-if="currentDeck"
      :to="`/deck/${currentDeck.id}`"
      class="btn btn-ghost btn-sm gap-1.5"
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
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
      Aperçu
    </router-link>
    <button class="btn btn-ghost btn-sm gap-1.5" @click="$emit('share')">
      <svg
        viewBox="0 0 24 24"
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      Partager
    </button>
    <div class="flex-1"></div>
    <button
      class="btn btn-ghost btn-sm text-error"
      @click="$emit('confirm-delete')"
    >
      Supprimer
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { getThumbPath } from "@/utils/imagePaths";
import {
  elementColors,
  elementColor as elementColorByEl,
} from "@/config/elementColors";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/composables/useToast";
import { validateDeck } from "@/validators/deck";
import DeckCardRow from "@/components/deck/DeckCardRow.vue";
import ReserveRow from "@/components/deck/ReserveRow.vue";
import type { Card, Deck } from "@/types/cards";

const deckStore = useDeckStore();
const cardStore = useCardStore();
const authStore = useAuthStore();
const toast = useToast();

defineEmits<{
  "confirm-clear": [];
  "confirm-delete": [];
  "add-to-deck": [card: Card];
  share: [];
}>();

// ── Deck data ─────────────────────────────────────────────────────────────────
const currentDeck = computed(() => deckStore.currentDeck as Deck | null);
const cardCount = computed(() => deckStore.cardCount);
const reserveCount = computed(() => deckStore.reserveCount);

const validation = computed(() =>
  currentDeck.value
    ? validateDeck(currentDeck.value)
    : { isValid: false, errors: [] },
);

const mainDeckCards = computed(() =>
  [...(currentDeck.value?.cards ?? [])]
    .filter((c) => !c.isReserve)
    .sort((a, b) => {
      if (a.card.mainType !== b.card.mainType)
        return a.card.mainType.localeCompare(b.card.mainType);
      return (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0);
    }),
);

const reserveDeckCards = computed(() =>
  [...(currentDeck.value?.cards ?? [])]
    .filter((c) => c.isReserve)
    .sort((a, b) => (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0)),
);

// ── Element distribution ──────────────────────────────────────────────────────
const elementDist = computed(() => {
  const map: Record<string, number> = {};
  for (const dc of currentDeck.value?.cards ?? []) {
    if (dc.isReserve) continue;
    const el = (
      dc.card.stats?.niveau?.element ||
      dc.card.stats?.force?.element ||
      "Neutre"
    ).toLowerCase();
    map[el] = (map[el] || 0) + dc.quantity;
  }
  return Object.entries(map)
    .map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
      color: elementColors[name] || elementColors.neutre,
    }))
    .sort((a, b) => b.count - a.count);
});

const typeBreakdown = computed(() => {
  const map: Record<string, number> = {};
  for (const dc of currentDeck.value?.cards ?? []) {
    if (dc.isReserve) continue;
    map[dc.card.mainType] = (map[dc.card.mainType] || 0) + dc.quantity;
  }
  return Object.entries(map)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
});

// ── Missing cards ─────────────────────────────────────────────────────────────
const missingCards = computed(() => {
  const map = new Map<string, { card: Card; need: number; have: number }>();
  for (const dc of currentDeck.value?.cards ?? []) {
    const entry = map.get(dc.card.id) ?? {
      card: dc.card,
      need: 0,
      have: ownedQty(dc.card.id),
    };
    entry.need += dc.quantity;
    map.set(dc.card.id, entry);
  }
  return [...map.values()]
    .map((e) => ({ ...e, missing: Math.max(0, e.need - e.have) }))
    .filter((e) => e.missing > 0)
    .sort((a, b) => b.missing - a.missing);
});

const missingTotal = computed(() =>
  missingCards.value.reduce((a, e) => a + e.missing, 0),
);

const isAuthenticated = computed(() => authStore.isAuthenticated);

// ── Helpers ───────────────────────────────────────────────────────────────────
function ownedQty(id: string): number {
  return cardStore.getCardQuantity(id) + cardStore.getFoilCardQuantity(id);
}

function elementColor(card: Card): string {
  const el = card.stats?.niveau?.element || card.stats?.force?.element || null;
  return elementColorByEl(el?.toString());
}

function cardImg(card: Card): string {
  if (card.imageUrl) return card.imageUrl;
  const full =
    card.mainType === "Héros"
      ? `/images/cards/${card.id}_recto.webp`
      : `/images/cards/${card.id}.webp`;
  return getThumbPath(full);
}

function onImgError(e: Event) {
  const img = e.target as HTMLImageElement;
  if (img.src.includes("/thumbs/")) {
    img.src = img.src.replace("/thumbs/", "/");
    return;
  }
  img.src = "/images/card-back.webp";
}

function renameCurrent(name: string) {
  if (currentDeck.value) deckStore.renameDeck(currentDeck.value.id, name);
}

function updateNotes(value: string) {
  if (currentDeck.value)
    deckStore.setDeckDescription(currentDeck.value.id, value);
}

function moveToReserve(id: string) {
  if (reserveCount.value >= 12) {
    toast.warning("La réserve est pleine (12 cartes max)", { duration: 2000 });
    return;
  }
  deckStore.moveCardZone(id, true, 1);
}

function moveToMain(id: string) {
  if (cardCount.value >= 48) {
    toast.warning("Le deck principal est plein (48 cartes)", {
      duration: 2000,
    });
    return;
  }
  deckStore.moveCardZone(id, false, 1);
}
</script>
