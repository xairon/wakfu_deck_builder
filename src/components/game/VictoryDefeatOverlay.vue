<template>
  <Transition name="vfx-fade">
    <div
      v-if="showOverlay"
      class="vfx-overlay"
      :class="isWinner ? 'vfx-overlay--victory' : isDraw ? 'vfx-overlay--draw' : 'vfx-overlay--defeat'"
      role="dialog"
      aria-modal="true"
      data-testid="victory-defeat-overlay"
    >
      <!-- Particules / Rayons de fond -->
      <div class="vfx-overlay__bg"></div>
      <div class="vfx-overlay__rays"></div>

      <div class="vfx-overlay__content">
        <!-- Badge icône animé -->
        <div class="vfx-overlay__badge">
          <span v-if="isWinner" class="vfx-badge-icon">🏆</span>
          <span v-else-if="isDraw" class="vfx-badge-icon">⚖️</span>
          <span v-else class="vfx-badge-icon">💀</span>
        </div>

        <!-- Titre principal -->
        <h1 class="vfx-overlay__title">
          <template v-if="isWinner">VICTOIRE !</template>
          <template v-else-if="isDraw">MATCH NUL</template>
          <template v-else>DÉFAITE</template>
        </h1>

        <!-- Motif / Explication de fin de partie -->
        <p class="vfx-overlay__reason">
          {{ reasonText }}
        </p>

        <!-- Bouton d'action -->
        <div class="vfx-overlay__actions">
          <button
            type="button"
            class="vfx-btn"
            :class="isWinner ? 'vfx-btn--gold' : 'vfx-btn--red'"
            @click="store.quitMatch()"
          >
            🔄 Revenir au menu / Nouvelle partie
          </button>
          <button
            type="button"
            class="vfx-btn vfx-btn--secondary"
            @click="dismissOverlay"
          >
            👁 Rester dans la partie
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useGameStore } from "@/stores/gameStore";

const store = useGameStore();

const dismissed = ref(false);
const showOverlay = computed(() => store.matchPhase === "finished" && !dismissed.value);

function dismissOverlay(): void {
  dismissed.value = true;
  store.continueMatch();
}

const me = computed(() => store.mySeat ?? store.perspective);
const winner = computed(() => store.winner);

const isWinner = computed(() => winner.value !== null && winner.value === me.value);
const isDraw = computed(() => winner.value === null);

const reasonText = computed(() => {
  if (!winner.value) return "La partie s'est terminée par un match nul.";

  const w = winner.value;
  const l = w === "A" ? "B" : "A";
  const winnerName = store.players[w]?.name ?? `Joueur ${w}`;
  const loserName = store.players[l]?.name ?? `Joueur ${l}`;

  const loserHeroId = store.state.seats[l]?.heroInstanceId;
  const loserHero = loserHeroId ? store.state.instances[loserHeroId] : null;
  const winnerHeroId = store.state.seats[w]?.heroInstanceId;
  const winnerHero = winnerHeroId ? store.state.instances[winnerHeroId] : null;

  const loserHp = loserHero?.counters.hp ?? 1;
  const winnerXp = winnerHero?.counters.xp ?? 0;

  if (loserHp <= 0) {
    if (isWinner.value) {
      return `Vous avez terrassé le Héros de ${loserName} ! (0 PV)`;
    } else {
      return `Votre Héros a été terrassé par ${winnerName} (0 PV)...`;
    }
  }

  if (winnerXp >= 18) {
    if (isWinner.value) {
      return `Vous avez atteint 18 XP (Niveau 3) et remporté la victoire !`;
    } else {
      return `${winnerName} a atteint 18 XP (Niveau 3) !`;
    }
  }

  if (isWinner.value) {
    return `Vous avez remporté la partie contre ${loserName} !`;
  } else {
    return `${winnerName} a remporté la partie.`;
  }
});
</script>

<style scoped>
.vfx-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 8, 12, 0.88);
  backdrop-filter: blur(12px);
  overflow: hidden;
  user-select: none;
}

.vfx-overlay__bg {
  position: absolute;
  inset: 0;
  opacity: 0.6;
  pointer-events: none;
}

.vfx-overlay--victory .vfx-overlay__bg {
  background: radial-gradient(
    circle at center,
    rgba(245, 158, 11, 0.35) 0%,
    rgba(217, 119, 6, 0.15) 45%,
    transparent 75%
  );
  animation: vfx-pulse-gold 3s ease-in-out infinite alternate;
}

.vfx-overlay--defeat .vfx-overlay__bg {
  background: radial-gradient(
    circle at center,
    rgba(220, 38, 38, 0.4) 0%,
    rgba(153, 27, 27, 0.15) 45%,
    transparent 75%
  );
  animation: vfx-pulse-red 3s ease-in-out infinite alternate;
}

.vfx-overlay--draw .vfx-overlay__bg {
  background: radial-gradient(
    circle at center,
    rgba(148, 163, 184, 0.3) 0%,
    transparent 70%
  );
}

.vfx-overlay__rays {
  position: absolute;
  width: 200vmax;
  height: 200vmax;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: repeating-conic-gradient(
    from 0deg,
    rgba(255, 255, 255, 0.03) 0deg 15deg,
    transparent 15deg 30deg
  );
  animation: vfx-spin 60s linear infinite;
  pointer-events: none;
}

.vfx-overlay__content {
  position: relative;
  z-index: 2;
  text-align: center;
  max-width: 600px;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: vfx-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

.vfx-overlay__badge {
  font-size: 5rem;
  margin-bottom: 0.5rem;
  filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.4));
  animation: vfx-bounce 2s ease-in-out infinite;
}

.vfx-overlay__title {
  font-family: var(--font-display, inherit);
  font-size: clamp(3rem, 8vw, 5.5rem);
  font-weight: 900;
  letter-spacing: 0.05em;
  margin: 0;
  line-height: 1;
}

.vfx-overlay--victory .vfx-overlay__title {
  background: linear-gradient(135deg, #fef08a 0%, #f59e0b 50%, #d97706 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 25px rgba(245, 158, 11, 0.8));
}

.vfx-overlay--defeat .vfx-overlay__title {
  background: linear-gradient(135deg, #fca5a5 0%, #ef4444 50%, #991b1b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 25px rgba(239, 68, 68, 0.8));
}

.vfx-overlay--draw .vfx-overlay__title {
  color: #e2e8f0;
  filter: drop-shadow(0 0 15px rgba(226, 232, 240, 0.5));
}

.vfx-overlay__reason {
  font-size: 1.25rem;
  color: rgba(246, 245, 241, 0.9);
  margin-top: 1rem;
  margin-bottom: 2rem;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}

.vfx-overlay__actions {
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.vfx-btn {
  padding: 0.85rem 2rem;
  font-size: 1.1rem;
  font-weight: 700;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  transition: all 0.2s ease;
}

.vfx-btn--gold {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #1c1917;
}

.vfx-btn--gold:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 15px 30px -5px rgba(245, 158, 11, 0.6);
}

.vfx-btn--red {
  background: linear-gradient(135deg, #ef4444, #b91c1c);
  color: #ffffff;
}

.vfx-btn--red:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 15px 30px -5px rgba(239, 68, 68, 0.6);
}

.vfx-btn--secondary {
  background: rgba(246, 245, 241, 0.15);
  color: #f6f5f1;
  border: 1px solid rgba(246, 245, 241, 0.3);
  backdrop-filter: blur(4px);
}

.vfx-btn--secondary:hover {
  background: rgba(246, 245, 241, 0.3);
  transform: translateY(-2px) scale(1.03);
}

/* Keyframes d'animation */
@keyframes vfx-spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes vfx-pulse-gold {
  from {
    transform: scale(0.95);
    opacity: 0.5;
  }
  to {
    transform: scale(1.1);
    opacity: 0.85;
  }
}

@keyframes vfx-pulse-red {
  from {
    transform: scale(0.95);
    opacity: 0.5;
  }
  to {
    transform: scale(1.1);
    opacity: 0.85;
  }
}

@keyframes vfx-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}

@keyframes vfx-pop {
  0% {
    opacity: 0;
    transform: scale(0.7);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Transitions Vue */
.vfx-fade-enter-active,
.vfx-fade-leave-active {
  transition: opacity 0.4s ease;
}

.vfx-fade-enter-from,
.vfx-fade-leave-to {
  opacity: 0;
}
</style>
