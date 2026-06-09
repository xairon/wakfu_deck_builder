<template>
  <div class="space-y-8 sm:space-y-10">
    <!-- ── EN-TÊTE ── -->
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow text-primary">Compagnon de table</p>
        <h1 class="mt-3 font-display text-4xl leading-[1.04] sm:text-5xl">
          Mode partie
        </h1>
        <p class="mt-2 max-w-md text-base-content/70">
          Comptez les PV, lancez le dé, suivez les tours. L'écran reste allumé
          le temps de la partie.
        </p>
        <RouterLink to="/play/table" class="btn btn-primary btn-sm mt-4 gap-2">
          🎴 Ouvrir la table de jeu
          <span class="font-mono text-[10px] uppercase opacity-70"
            >nouveau</span
          >
        </RouterLink>
      </div>
      <div class="flex items-center gap-3">
        <span
          class="hidden items-center gap-2 font-mono text-[10px] uppercase text-base-content/55 sm:flex"
          style="letter-spacing: 0.12em"
          role="status"
          aria-live="polite"
        >
          <span
            class="h-2 w-2"
            :class="wakeLockActive ? 'bg-primary' : 'bg-base-content/30'"
          ></span>
          {{ wakeLockActive ? "Écran maintenu" : "Veille active" }}
        </span>
        <button
          class="btn btn-outline gap-2"
          @click="resetGame"
          aria-label="Réinitialiser la partie"
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
              d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"
            />
          </svg>
          Réinitialiser la partie
        </button>
      </div>
    </header>

    <div class="h-px w-full bg-base-content/80"></div>

    <!-- ── COMPTEURS DE PV ── -->
    <section
      class="grid gap-px overflow-hidden border border-base-content/15 bg-base-content/15 sm:grid-cols-2"
    >
      <article
        v-for="(player, idx) in players"
        :key="player.key"
        class="spine bg-base-100 p-5 sm:p-6"
        :style="{ '--spine': player.color }"
      >
        <div class="flex items-center justify-between gap-3">
          <input
            v-model="player.name"
            type="text"
            class="input input-bordered min-w-0 flex-1 bg-base-200 font-display text-lg leading-tight"
            :aria-label="`Nom du joueur ${idx + 1}`"
            :placeholder="`Joueur ${idx + 1}`"
            maxlength="24"
          />
          <span
            class="shrink-0 font-mono text-[10px] uppercase text-base-content/45"
            style="letter-spacing: 0.14em"
            >J{{ idx + 1 }}</span
          >
        </div>

        <!-- Grand nombre de PV -->
        <p
          class="mt-5 text-center font-mono text-7xl leading-none tabular sm:text-8xl"
          :class="player.pv <= 0 ? 'text-primary' : 'text-base-content'"
        >
          {{ player.pv }}
        </p>
        <p
          class="mt-1 text-center font-mono text-[10px] uppercase text-base-content/45"
          style="letter-spacing: 0.18em"
        >
          Points de vie
        </p>

        <!-- Boutons +/- gros, tactiles -->
        <div class="mt-5 grid grid-cols-4 gap-2">
          <button
            class="btn btn-outline h-14 text-base"
            @click="adjustPv(idx, -5)"
            :aria-label="`Retirer 5 PV à ${displayName(player, idx)}`"
          >
            −5
          </button>
          <button
            class="btn btn-neutral h-14 text-base"
            @click="adjustPv(idx, -1)"
            :aria-label="`Retirer 1 PV à ${displayName(player, idx)}`"
          >
            −1
          </button>
          <button
            class="btn btn-neutral h-14 text-base"
            @click="adjustPv(idx, 1)"
            :aria-label="`Ajouter 1 PV à ${displayName(player, idx)}`"
          >
            +1
          </button>
          <button
            class="btn btn-outline h-14 text-base"
            @click="adjustPv(idx, 5)"
            :aria-label="`Ajouter 5 PV à ${displayName(player, idx)}`"
          >
            +5
          </button>
        </div>
      </article>
    </section>

    <!-- ── TOUR ── -->
    <section>
      <p class="section-rule eyebrow">Tour de jeu</p>
      <div
        class="mt-4 flex flex-wrap items-center justify-between gap-4 border border-base-content/15 p-5"
      >
        <div class="flex items-baseline gap-3">
          <span
            class="font-mono text-[10px] uppercase text-base-content/45"
            style="letter-spacing: 0.18em"
            >Tour</span
          >
          <span class="font-mono text-5xl leading-none tabular">{{
            turn
          }}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-primary h-12 px-6" @click="nextTurn">
            <svg
              viewBox="0 0 24 24"
              class="mr-1.5 h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 12h14m0 0-5-5m5 5-5 5"
              />
            </svg>
            Tour suivant
          </button>
          <button class="btn btn-ghost h-12 px-4" @click="resetTurn">
            Remettre à 1
          </button>
        </div>
      </div>
    </section>

    <!-- ── HASARD (dé + pièce) ── -->
    <section>
      <p class="section-rule eyebrow">Hasard</p>
      <div class="mt-4 grid gap-px bg-base-content/15 sm:grid-cols-2">
        <!-- Dé D6 -->
        <div class="bg-base-100 p-5">
          <div class="flex items-center justify-between">
            <span
              class="font-mono text-[10px] uppercase text-base-content/45"
              style="letter-spacing: 0.18em"
              >Dé · D6</span
            >
            <button class="btn btn-neutral h-12 px-6" @click="rollDice">
              Lancer
            </button>
          </div>
          <p
            class="mt-4 text-center font-mono leading-none tabular"
            :class="
              dice === null
                ? 'text-3xl text-base-content/30'
                : 'text-6xl text-primary'
            "
            aria-live="polite"
          >
            {{ dice === null ? "—" : dice }}
          </p>
          <p
            class="mt-2 text-center font-mono text-[10px] uppercase text-base-content/45"
            style="letter-spacing: 0.18em"
          >
            Résultat
          </p>
        </div>

        <!-- Pièce -->
        <div class="bg-base-100 p-5">
          <div class="flex items-center justify-between">
            <span
              class="font-mono text-[10px] uppercase text-base-content/45"
              style="letter-spacing: 0.18em"
              >Pièce · Pile ou face</span
            >
            <button class="btn btn-neutral h-12 px-6" @click="flipCoin">
              Lancer
            </button>
          </div>
          <p
            class="mt-4 text-center font-mono uppercase leading-none tabular"
            :class="
              coin === null
                ? 'text-3xl text-base-content/30'
                : 'text-5xl text-primary'
            "
            style="letter-spacing: 0.04em"
            aria-live="polite"
          >
            {{ coin === null ? "—" : coin }}
          </p>
          <p
            class="mt-2 text-center font-mono text-[10px] uppercase text-base-content/45"
            style="letter-spacing: 0.18em"
          >
            Résultat
          </p>
        </div>
      </div>
    </section>

    <!-- ── CHRONOMÈTRE ── -->
    <section>
      <p class="section-rule eyebrow">Chronomètre de partie</p>
      <div
        class="mt-4 flex flex-wrap items-center justify-between gap-4 border border-base-content/15 p-5"
      >
        <p
          class="font-mono text-5xl leading-none tabular sm:text-6xl"
          :class="timerRunning ? 'text-primary' : 'text-base-content'"
          aria-live="off"
        >
          {{ formattedTime }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            class="btn h-12 px-6"
            :class="timerRunning ? 'btn-outline' : 'btn-primary'"
            @click="toggleTimer"
          >
            {{ timerRunning ? "Pause" : "Démarrer" }}
          </button>
          <button class="btn btn-ghost h-12 px-4" @click="resetTimer">
            Remettre à zéro
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";

// ── Joueurs / PV ──
interface Player {
  key: string;
  name: string;
  pv: number;
  color: string;
}
const DEFAULT_PV = 30;
const players = reactive<Player[]>([
  { key: "p1", name: "Joueur 1", pv: DEFAULT_PV, color: "#F04E22" },
  { key: "p2", name: "Joueur 2", pv: DEFAULT_PV, color: "#1F9CEC" },
]);

function displayName(player: Player, idx: number): string {
  return player.name.trim() || `Joueur ${idx + 1}`;
}
function adjustPv(idx: number, delta: number): void {
  players[idx].pv += delta;
}

// ── Tour ──
const turn = ref(1);
function nextTurn(): void {
  turn.value += 1;
}
function resetTurn(): void {
  turn.value = 1;
}

// ── Dé D6 ──
const dice = ref<number | null>(null);
function rollDice(): void {
  dice.value = Math.floor(Math.random() * 6) + 1;
}

// ── Pièce ──
const coin = ref<string | null>(null);
function flipCoin(): void {
  coin.value = Math.random() < 0.5 ? "Pile" : "Face";
}

// ── Chronomètre ──
const elapsedMs = ref(0);
const timerRunning = ref(false);
let intervalId: ReturnType<typeof setInterval> | null = null;
let lastTick = 0;

const formattedTime = computed(() => {
  const totalSeconds = Math.floor(elapsedMs.value / 1000);
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
});

function stopInterval(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
function toggleTimer(): void {
  if (timerRunning.value) {
    stopInterval();
    timerRunning.value = false;
  } else {
    timerRunning.value = true;
    lastTick = Date.now();
    intervalId = setInterval(() => {
      const now = Date.now();
      elapsedMs.value += now - lastTick;
      lastTick = now;
    }, 250);
  }
}
function resetTimer(): void {
  stopInterval();
  timerRunning.value = false;
  elapsedMs.value = 0;
}

// ── Réinitialiser la partie ──
function resetGame(): void {
  players.forEach((p, i) => {
    p.pv = DEFAULT_PV;
    p.name = `Joueur ${i + 1}`;
  });
  resetTurn();
  dice.value = null;
  coin.value = null;
  resetTimer();
}

// ── Screen Wake Lock ──
const wakeLockActive = ref(false);
let wakeLock: WakeLockSentinel | null = null;

async function requestWakeLock(): Promise<void> {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLockActive.value = true;
      wakeLock.addEventListener("release", () => {
        wakeLockActive.value = false;
      });
    }
  } catch {
    // Indisponible (onglet en arrière-plan, navigateur non compatible…)
    wakeLockActive.value = false;
  }
}

async function handleVisibilityChange(): Promise<void> {
  if (
    document.visibilityState === "visible" &&
    wakeLock === null &&
    !wakeLockActive.value
  ) {
    await requestWakeLock();
  }
}

onMounted(async () => {
  await requestWakeLock();
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onUnmounted(() => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  stopInterval();
  try {
    wakeLock?.release();
  } catch {
    // ignore
  }
  wakeLock = null;
  wakeLockActive.value = false;
});
</script>
