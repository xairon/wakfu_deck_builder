<template>
  <Teleport to="body">
    <Transition name="tbanner">
      <div v-if="visible" class="tbanner" aria-hidden="true">
        <div class="tbanner__stripe">
          <span class="tbanner__turn">Tour {{ store.turn.number }}</span>
          <span class="tbanner__name">À toi, {{ activeName }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useGameStore } from "@/stores/gameStore";

const store = useGameStore();

const visible = ref(false);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const activeName = computed(() => store.players[store.turn.active].name);

/** Affiche la bannière à chaque révélation d'un tour (après passation). */
watch(
  () => [store.matchPhase, store.passPending] as const,
  ([phase, pending], [, wasPending]) => {
    if (phase !== "playing" || pending || !wasPending) return;
    visible.value = true;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      visible.value = false;
      hideTimer = null;
    }, 1700);
  },
);

onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<style scoped>
.tbanner {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.tbanner__stripe {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 26px 0 30px;
  text-align: center;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(14, 11, 8, 0.88) 18%,
    rgba(14, 11, 8, 0.94) 50%,
    rgba(14, 11, 8, 0.88) 82%,
    transparent 100%
  );
  border-top: 1px solid rgba(240, 78, 34, 0.5);
  border-bottom: 1px solid rgba(240, 78, 34, 0.5);
  box-shadow: 0 0 60px rgba(240, 78, 34, 0.18);
}
.tbanner__turn {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: #f0a62b;
}
.tbanner__name {
  font-family: Fraunces, Georgia, serif;
  font-size: clamp(30px, 5vw, 52px);
  line-height: 1.05;
  color: #f6f5f1;
  text-shadow: 0 2px 24px rgba(240, 78, 34, 0.45);
}
.tbanner-enter-active {
  transition: opacity 0.25s ease;
}
.tbanner-enter-active .tbanner__stripe {
  animation: tbanner-in 0.45s cubic-bezier(0.2, 0.9, 0.25, 1);
}
.tbanner-leave-active {
  transition: opacity 0.4s ease;
}
.tbanner-enter-from,
.tbanner-leave-to {
  opacity: 0;
}
@keyframes tbanner-in {
  from {
    transform: scaleY(0.2);
    filter: brightness(2);
  }
  to {
    transform: scaleY(1);
    filter: brightness(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .tbanner-enter-active .tbanner__stripe {
    animation: none;
  }
}
</style>
