<template>
  <Teleport to="body">
    <div
      v-if="tutorial.active && tutorial.step"
      class="tcoach"
      aria-live="polite"
    >
      <!-- Spotlight sur l'élément ciblé (ne bloque jamais les clics) -->
      <div
        v-if="rect"
        class="tcoach__spot"
        :style="spotStyle"
        aria-hidden="true"
      ></div>

      <!-- Bulle du coach -->
      <div
        class="tcoach__bubble"
        :style="bubbleStyle"
        role="dialog"
        aria-label="Tutoriel"
      >
        <p class="tcoach__progress">
          Tutoriel · étape {{ tutorial.stepIndex + 1 }} / {{ tutorial.total }}
        </p>
        <p class="tcoach__text">{{ tutorial.stepText }}</p>
        <div class="tcoach__actions">
          <button
            v-if="tutorial.step.manual"
            class="tcoach__btn tcoach__btn--primary"
            @click="tutorial.next()"
          >
            {{
              tutorial.stepIndex >= tutorial.total - 1 ? "Terminer" : "Suivant"
            }}
          </button>
          <button
            class="tcoach__btn tcoach__btn--ghost"
            @click="tutorial.skip()"
          >
            Passer le tutoriel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import type { CSSProperties } from "vue";
import { useTutorialStore } from "@/stores/tutorialStore";

const tutorial = useTutorialStore();

const rect = ref<DOMRect | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

function refreshRect(): void {
  const anchor = tutorial.step?.anchor;
  if (!anchor) {
    rect.value = null;
    return;
  }
  const el = document.querySelector(anchor);
  rect.value = el ? el.getBoundingClientRect() : null;
}

// le plateau bouge (animations, overlays) : on suit l'ancre périodiquement
watch(
  () => [tutorial.active, tutorial.stepIndex],
  () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (tutorial.active) {
      refreshRect();
      timer = setInterval(refreshRect, 250);
    }
  },
  { immediate: true },
);
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const PAD = 8;
const spotStyle = computed<CSSProperties>(() => {
  const r = rect.value;
  if (!r) return {};
  return {
    left: `${r.left - PAD}px`,
    top: `${r.top - PAD}px`,
    width: `${r.width + PAD * 2}px`,
    height: `${r.height + PAD * 2}px`,
  };
});

const BUBBLE_W = 360;
const bubbleStyle = computed<CSSProperties>(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const r = rect.value;
  if (!r) {
    return {
      left: `${(vw - BUBBLE_W) / 2}px`,
      top: `${vh * 0.4}px`,
      width: `${BUBBLE_W}px`,
    };
  }
  let left = r.left + r.width / 2 - BUBBLE_W / 2;
  left = Math.max(12, Math.min(left, vw - BUBBLE_W - 12));
  // sous la cible si la place existe, sinon au-dessus
  const below = r.bottom + PAD * 2;
  const top = below + 180 < vh ? below : Math.max(12, r.top - PAD * 2 - 180);
  return { left: `${left}px`, top: `${top}px`, width: `${BUBBLE_W}px` };
});
</script>

<style scoped>
.tcoach__spot {
  position: fixed;
  z-index: 94;
  border-radius: 12px;
  box-shadow:
    0 0 0 9999px rgba(8, 6, 4, 0.55),
    0 0 0 2px rgba(240, 166, 43, 0.9),
    0 0 28px rgba(240, 166, 43, 0.45);
  pointer-events: none;
  transition:
    left 0.25s ease,
    top 0.25s ease,
    width 0.25s ease,
    height 0.25s ease;
}
.tcoach__bubble {
  position: fixed;
  z-index: 95;
  background: rgba(14, 11, 8, 0.97);
  border: 1px solid rgba(240, 166, 43, 0.55);
  border-radius: 12px;
  padding: 14px 16px;
  color: #f6f5f1;
  box-shadow:
    0 14px 44px rgba(0, 0, 0, 0.65),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition:
    left 0.25s ease,
    top 0.25s ease;
}
.tcoach__progress {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #f0a62b;
}
.tcoach__text {
  margin-top: 7px;
  font-size: 14px;
  line-height: 1.5;
}
.tcoach__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
}
.tcoach__btn {
  font-size: 12px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 999px;
  transition: background 0.15s ease;
}
.tcoach__btn--primary {
  background: #f04e22;
  color: #fff;
}
.tcoach__btn--primary:hover {
  background: #d63d14;
}
.tcoach__btn--ghost {
  background: transparent;
  color: rgba(246, 245, 241, 0.65);
  outline: 1px solid rgba(246, 245, 241, 0.25);
}
.tcoach__btn--ghost:hover {
  background: rgba(246, 245, 241, 0.1);
}
@media (prefers-reduced-motion: reduce) {
  .tcoach__spot,
  .tcoach__bubble {
    transition: none;
  }
}
</style>
