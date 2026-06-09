<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow text-primary">La Table des Douze</p>
        <h1 class="mt-2 font-display text-3xl sm:text-4xl">Table de jeu</h1>
        <p class="mt-2 max-w-lg text-base-content/70">
          Bac à sable local : posez un deck et manipulez la partie librement
          (piocher, jouer, incliner, compteurs). Vous contrôlez les deux côtés.
          <span class="text-base-content/50"
            >Le jeu en ligne 1v1 par lien arrive bientôt.</span
          >
        </p>
      </div>
      <RouterLink to="/play" class="btn btn-ghost btn-sm"
        >← Compagnon</RouterLink
      >
    </header>

    <div class="h-px w-full bg-base-content/20"></div>

    <!-- ───────── Mise en place ───────── -->
    <section v-if="!store.started" class="space-y-5">
      <p class="section-rule eyebrow">Choisir un deck</p>

      <p v-if="!decks.length" class="text-base-content/60">
        Aucun deck pour l'instant.
        <RouterLink to="/deck-builder" class="link text-primary"
          >Construisez-en un</RouterLink
        >
        pour jouer.
      </p>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="d in decks"
          :key="d.id"
          type="button"
          class="deck-pick"
          :class="{ 'deck-pick--on': pickedId === d.id }"
          :style="{ '--spine': heroElement(d) }"
          @click="pickedId = d.id"
        >
          <span class="deck-pick__art">
            <img
              v-if="heroImg(d)"
              :src="heroImg(d)!"
              :alt="d.hero?.name || ''"
              class="deck-pick__img"
              loading="lazy"
              decoding="async"
              @error="onImgError"
            />
            <span v-else class="deck-pick__art-empty">Sans héros</span>
            <span v-if="pickedId === d.id" class="deck-pick__check">✓</span>
          </span>
          <span class="deck-pick__body">
            <span class="deck-pick__name">{{ d.name }}</span>
            <span class="deck-pick__meta">
              <span class="deck-pick__dot" aria-hidden="true"></span>
              {{ d.hero?.name || "Sans héros" }}
              <span class="deck-pick__sep">·</span>
              {{ cardCount(d) }} cartes
            </span>
          </span>
        </button>
      </div>

      <button
        v-if="decks.length"
        type="button"
        class="btn btn-primary"
        :disabled="!picked"
        @click="start"
      >
        Lancer le bac à sable
      </button>
    </section>

    <!-- ───────── Partie en cours ───────── -->
    <section v-else class="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div class="space-y-4">
        <!-- Barre d'outils -->
        <div class="table-toolbar">
          <div class="table-toolbar__group">
            <span class="eyebrow"
              >Tour {{ store.turn.number }} · Siège
              {{ store.turn.active }}</span
            >
          </div>
          <div class="table-toolbar__group">
            <span class="table-toolbar__lbl">Agir comme</span>
            <button
              v-for="s in ['A', 'B'] as const"
              :key="s"
              class="seat-toggle"
              :class="{ 'seat-toggle--on': store.controlSeat === s }"
              @click="store.setControlSeat(s)"
            >
              {{ s }}
            </button>
          </div>
          <div class="table-toolbar__group">
            <button class="btn btn-sm" @click="store.draw()">Piocher</button>
            <button class="btn btn-sm" @click="store.shufflePioche()">
              Mélanger
            </button>
            <button class="btn btn-sm" @click="store.nextTurn()">
              Passer le tour
            </button>
            <button class="btn btn-sm btn-ghost" @click="store.undoLast()">
              Annuler
            </button>
            <button class="btn btn-sm btn-ghost" @click="store.reset()">
              Réinitialiser
            </button>
          </div>
        </div>

        <GameBoard />
      </div>

      <aside class="table-aside">
        <ActionLog :lines="store.log" />
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useGameStore } from "@/stores/gameStore";
import type { Deck } from "@/types/cards";
import { elementColor } from "@/config/elementColors";
import GameBoard from "@/components/game/GameBoard.vue";
import ActionLog from "@/components/game/ActionLog.vue";

const deckStore = useDeckStore();
const cardStore = useCardStore();
const store = useGameStore();

const decks = computed<Deck[]>(() => deckStore.decks ?? []);
const pickedId = ref<string | null>(null);
const picked = computed(
  () => decks.value.find((d) => d.id === pickedId.value) ?? null,
);

function cardCount(d: Deck): number {
  return (d.cards ?? []).reduce(
    (n, c) => n + (c.isReserve ? 0 : c.quantity),
    0,
  );
}

function heroImg(d: Deck): string | null {
  return d.hero ? `/images/cards/${d.hero.id}_recto.webp` : null;
}
function heroElement(d: Deck): string {
  return elementColor(d.hero?.stats?.niveau?.element);
}
function onImgError(e: Event): void {
  (e.target as HTMLImageElement).style.visibility = "hidden";
}

function start(): void {
  if (!picked.value) return;
  // Bac à sable : le deck choisi est joué des deux côtés (match miroir).
  store.startSandbox(picked.value, picked.value, "A");
}

onMounted(async () => {
  if (!cardStore.cards.length) {
    try {
      await (
        cardStore as unknown as { initialize?: () => Promise<void> }
      ).initialize?.();
    } catch {
      /* no-op : l'app charge les cartes par ailleurs */
    }
  }
  if (decks.value.length && !pickedId.value) pickedId.value = decks.value[0].id;
});
</script>

<style scoped>
.deck-pick {
  position: relative;
  text-align: left;
  border: 1px solid rgba(27, 26, 23, 0.15);
  border-radius: 8px;
  overflow: hidden;
  background: var(--paper-200, #edebe4);
  display: flex;
  flex-direction: column;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}
.deck-pick:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}
.deck-pick--on {
  border-color: var(--spine, #f04e22);
  box-shadow:
    0 0 0 2px var(--spine, #f04e22),
    0 10px 24px rgba(0, 0, 0, 0.35);
}
/* Bandeau d'illustration du Héros */
.deck-pick__art {
  position: relative;
  display: block;
  height: 150px;
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(255, 255, 255, 0.08), transparent),
    #14110e;
  overflow: hidden;
}
.deck-pick__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 22%;
  display: block;
  transition: transform 0.3s ease;
}
.deck-pick:hover .deck-pick__img {
  transform: scale(1.05);
}
.deck-pick__art::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 45%,
    rgba(20, 17, 14, 0.05) 70%,
    var(--paper-200, #edebe4) 100%
  );
}
.deck-pick__art-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(246, 245, 241, 0.4);
}
.deck-pick__check {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--spine, #f04e22);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}
.deck-pick__body {
  position: relative;
  z-index: 1;
  padding: 4px 14px 14px;
  border-left: 3px solid var(--spine, #98a1af);
  margin: -22px 0 0;
}
.deck-pick__name {
  display: block;
  font-family: Fraunces, Georgia, serif;
  font-size: 19px;
  line-height: 1.15;
  color: #1b1a17;
}
.deck-pick__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  color: rgba(27, 26, 23, 0.6);
}
.deck-pick__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--spine, #98a1af);
  flex: 0 0 auto;
}
.deck-pick__sep {
  opacity: 0.5;
}
.table-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  background: var(--paper-200, #edebe4);
  border: 1px solid rgba(27, 26, 23, 0.12);
  border-radius: 6px;
}
.table-toolbar__group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.table-toolbar__lbl {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(27, 26, 23, 0.5);
}
.seat-toggle {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  background: rgba(27, 26, 23, 0.08);
}
.seat-toggle--on {
  background: #1b1a17;
  color: #f6f5f1;
}
.table-aside {
  background: var(--paper-200, #edebe4);
  border: 1px solid rgba(27, 26, 23, 0.12);
  border-radius: 6px;
  padding: 12px 14px;
  max-height: 70vh;
  overflow: hidden;
}
</style>
