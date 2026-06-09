<template>
  <!-- ═══════════ LOBBY : choix des decks (J1 puis J2) ═══════════ -->
  <div v-if="store.matchPhase === 'lobby'" class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow text-primary">La Table des Douze</p>
        <h1 class="mt-2 font-display text-3xl sm:text-4xl">Nouvelle partie</h1>
        <p class="mt-2 max-w-lg text-base-content/70">
          Partie locale à deux (hot-seat). Chaque joueur choisit un deck, puis
          on passe l'appareil à tour de rôle.
        </p>
      </div>
      <RouterLink to="/play" class="btn btn-ghost btn-sm"
        >← Compagnon</RouterLink
      >
    </header>
    <div class="h-px w-full bg-base-content/20"></div>

    <p v-if="!decks.length" class="text-base-content/60">
      Aucun deck.
      <RouterLink to="/deck-builder" class="link text-primary"
        >Construisez-en un</RouterLink
      >
      pour jouer.
    </p>

    <section v-else class="space-y-5">
      <div class="flex items-center gap-3">
        <span class="lobby-step" :class="{ 'lobby-step--on': lobbyStep === 1 }"
          >1</span
        >
        <span class="h-px flex-1 bg-base-content/20"></span>
        <span class="lobby-step" :class="{ 'lobby-step--on': lobbyStep === 2 }"
          >2</span
        >
      </div>

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="section-rule eyebrow">
            {{
              lobbyStep === 1
                ? "Joueur 1 — choisis ton deck"
                : "Joueur 2 — choisis ton deck"
            }}
          </p>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <span class="text-base-content/60">Nom :</span>
          <input
            v-if="lobbyStep === 1"
            v-model="nameA"
            class="input input-bordered input-sm w-44"
            placeholder="Joueur 1"
          />
          <input
            v-else
            v-model="nameB"
            class="input input-bordered input-sm w-44"
            placeholder="Joueur 2"
          />
        </label>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="d in decks"
          :key="d.id"
          type="button"
          class="deck-pick"
          :class="{ 'deck-pick--on': currentPick === d.id }"
          :style="{ '--spine': heroElement(d) }"
          @click="setPick(d.id)"
        >
          <span class="deck-pick__art">
            <img
              v-if="heroImg(d)"
              :src="heroImg(d)!"
              :alt="d.hero?.name || ''"
              class="deck-pick__img"
              loading="lazy"
              @error="onImgError"
            />
            <span v-else class="deck-pick__art-empty">Sans héros</span>
            <span v-if="currentPick === d.id" class="deck-pick__check">✓</span>
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

      <div class="flex gap-3">
        <button
          v-if="lobbyStep === 2"
          class="btn btn-ghost"
          @click="lobbyStep = 1"
        >
          ← Retour
        </button>
        <button
          v-if="lobbyStep === 1"
          class="btn btn-primary"
          :disabled="!pickA"
          @click="lobbyStep = 2"
        >
          Suivant →
        </button>
        <button
          v-else
          class="btn btn-primary"
          :disabled="!pickB"
          @click="launch"
        >
          Lancer la partie
        </button>
      </div>
    </section>
  </div>

  <!-- ═══════════ EN MATCH (mulligan / playing) ═══════════ -->
  <div v-else class="gfull">
    <div class="gtopbar">
      <div class="gtopbar__group">
        <span class="gtopbar__title">Table de jeu</span>
        <span v-if="store.matchPhase === 'playing'" class="gtopbar__turn">
          Tour {{ store.turn.number }} · {{ store.activeName }} ·
          {{ store.phaseLabel }}
        </span>
        <span v-else class="gtopbar__turn">Mise en place</span>
      </div>
      <div v-if="store.matchPhase === 'playing'" class="gtopbar__group">
        <button class="btn btn-primary btn-sm" @click="store.endTurn()">
          Finir le tour ▸
        </button>
        <button
          class="btn btn-sm"
          @click="store.shufflePioche(store.perspective)"
        >
          Mélanger
        </button>
        <button class="btn btn-sm btn-ghost" @click="store.undoLast()">
          Annuler
        </button>
      </div>
      <div class="gtopbar__group">
        <button
          class="btn btn-sm btn-ghost"
          @click="showJournal = !showJournal"
        >
          {{ showJournal ? "Masquer le journal" : "Journal" }}
        </button>
        <button class="btn btn-sm btn-ghost" @click="store.quitMatch()">
          Quitter
        </button>
      </div>
    </div>

    <div class="glayout">
      <GameBoard class="glayout__board" />
      <aside v-if="showJournal" class="glayout__journal">
        <ActionLog :lines="store.log" />
      </aside>
    </div>

    <!-- Écran de passation -->
    <div v-if="store.passPending" class="overlay">
      <div class="overlay__card">
        <p class="eyebrow text-primary">Passe l'appareil</p>
        <h2 class="mt-2 font-display text-4xl">
          {{ store.players[store.perspective].name }}
        </h2>
        <p class="mt-3 text-base-content/70">
          {{
            store.matchPhase === "mulligan"
              ? "À toi de garder ou refaire ta main de départ."
              : "C'est ton tour. Les autres, ne regardez pas !"
          }}
        </p>
        <button class="btn btn-primary mt-6" @click="store.reveal()">
          Je suis prêt — afficher
        </button>
      </div>
    </div>

    <!-- Mulligan -->
    <div
      v-else-if="store.matchPhase === 'mulligan'"
      class="overlay overlay--mulligan"
    >
      <div class="overlay__card overlay__card--wide">
        <p class="eyebrow text-primary">
          Main de départ — {{ store.players[store.perspective].name }}
        </p>
        <h2 class="mt-1 font-display text-3xl">Gardes-tu cette main ?</h2>
        <div class="mulligan-hand">
          <div
            v-for="inst in mulliganHand"
            :key="inst.instanceId"
            class="mulligan-card"
          >
            <GameCard :instance="inst" :card="resolveCard(inst.cardId)" />
          </div>
          <p v-if="!mulliganHand.length" class="text-base-content/50 italic">
            Main vide.
          </p>
        </div>
        <div class="mt-5 flex flex-wrap justify-center gap-3">
          <button class="btn btn-primary" @click="store.keepHand()">
            Garder ({{ mulliganHand.length }} cartes)
          </button>
          <button
            class="btn btn-outline"
            :disabled="mulliganHand.length === 0"
            @click="store.mulligan(store.perspective)"
          >
            Mulligan (re-piocher {{ Math.max(0, mulliganHand.length - 1) }})
          </button>
        </div>
        <p class="mt-3 text-xs text-base-content/50">
          Règle Wakfu : on recommence avec une carte de moins à chaque fois.
        </p>
      </div>
    </div>

    <!-- Fin de partie -->
    <div v-if="store.matchPhase === 'finished'" class="overlay">
      <div class="overlay__card">
        <p class="eyebrow text-primary">Partie terminée</p>
        <h2 class="mt-2 font-display text-4xl">
          {{
            store.winner
              ? `${store.players[store.winner].name} l'emporte`
              : "Match nul"
          }}
        </h2>
        <button class="btn btn-primary mt-6" @click="store.quitMatch()">
          Nouvelle partie
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useGameStore } from "@/stores/gameStore";
import type { Card, Deck } from "@/types/cards";
import type { RedactedInstance } from "@/game";
import { elementColor } from "@/config/elementColors";
import GameBoard from "@/components/game/GameBoard.vue";
import GameCard from "@/components/game/GameCard.vue";
import ActionLog from "@/components/game/ActionLog.vue";

const deckStore = useDeckStore();
const cardStore = useCardStore();
const store = useGameStore();

const decks = computed<Deck[]>(() => deckStore.decks ?? []);
const showJournal = ref(true);

// ── Lobby ────────────────────────────────────────────────────────────────────
const lobbyStep = ref<1 | 2>(1);
const nameA = ref("");
const nameB = ref("");
const pickA = ref<string | null>(null);
const pickB = ref<string | null>(null);
const currentPick = computed(() =>
  lobbyStep.value === 1 ? pickA.value : pickB.value,
);
function setPick(id: string): void {
  if (lobbyStep.value === 1) pickA.value = id;
  else pickB.value = id;
}
function launch(): void {
  const dA = decks.value.find((d) => d.id === pickA.value);
  const dB = decks.value.find((d) => d.id === pickB.value);
  if (dA && dB)
    store.startMatch(dA, dB, { nameA: nameA.value, nameB: nameB.value });
}

// ── Aides deck ───────────────────────────────────────────────────────────────
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

// ── Main de mulligan ─────────────────────────────────────────────────────────
const cardIndex = computed(() => {
  const m = new Map<string, Card>();
  for (const c of cardStore.cards) m.set(c.id, c);
  return m;
});
function resolveCard(cardId: string | null): Card | null {
  return cardId ? (cardIndex.value.get(cardId) ?? null) : null;
}
const mulliganHand = computed<RedactedInstance[]>(() => {
  const z = store.view.seats[store.perspective].main;
  return z.kind === "full" ? z.instances : [];
});

onMounted(async () => {
  if (!cardStore.cards.length) {
    try {
      await (
        cardStore as unknown as { initialize?: () => Promise<void> }
      ).initialize?.();
    } catch {
      /* l'app charge les cartes par ailleurs */
    }
  }
});
</script>

<style scoped>
/* ── Lobby ── */
.lobby-step {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  background: rgba(27, 26, 23, 0.1);
  color: rgba(27, 26, 23, 0.5);
}
.lobby-step--on {
  background: #f04e22;
  color: #fff;
}
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

/* ── Match (plein écran) ── */
.gfull {
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-top: calc(-1 * clamp(16px, 4vw, 48px));
  padding: 12px clamp(8px, 2vw, 28px) 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.gtopbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 14px;
  background: var(--paper-200, #edebe4);
  border: 1px solid rgba(27, 26, 23, 0.14);
  border-radius: 8px;
}
.gtopbar__group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.gtopbar__title {
  font-family: Fraunces, Georgia, serif;
  font-size: 18px;
  margin-right: 6px;
}
.gtopbar__turn {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(27, 26, 23, 0.6);
}
.glayout {
  display: flex;
  gap: 12px;
  align-items: stretch;
}
.glayout__board {
  flex: 1;
  min-width: 0;
}
.glayout__journal {
  flex: 0 0 264px;
  background: var(--paper-200, #edebe4);
  border: 1px solid rgba(27, 26, 23, 0.12);
  border-radius: 8px;
  padding: 12px 14px;
  overflow: hidden;
}

/* ── Overlays (passation / mulligan / fin) ── */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(10, 8, 6, 0.82);
  backdrop-filter: blur(6px);
}
.overlay__card {
  background: var(--paper, #f6f5f1);
  color: #1b1a17;
  border-radius: 12px;
  padding: 32px 36px;
  text-align: center;
  max-width: 92vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border-top: 4px solid #f04e22;
}
.overlay__card--wide {
  max-width: min(96vw, 980px);
}
.mulligan-hand {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
}
.mulligan-card {
  width: clamp(82px, 11vw, 120px);
}
@media (max-width: 1100px) {
  .glayout {
    flex-direction: column;
  }
  .glayout__journal {
    flex: 1;
    max-height: 200px;
  }
}
</style>
