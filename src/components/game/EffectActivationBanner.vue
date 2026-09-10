<template>
  <Teleport to="body">
    <Transition name="act-banner">
      <aside
        v-if="banner"
        class="act-banner-wrap"
        role="alert"
        aria-live="assertive"
        data-testid="effect-activation-banner"
      >
        <div
          class="act-banner"
          :class="{
            'act-banner--opp': !banner.isSelf,
            'act-banner--self': banner.isSelf,
          }"
        >
          <!-- Accent decorative top bar -->
          <div class="act-banner__glow"></div>

          <!-- Header badge -->
          <div class="act-banner__header">
            <div class="act-banner__tag">
              <span class="act-banner__icon">⚡</span>
              <span>{{
                banner.isSelf
                  ? "EFFET ACTIVÉ"
                  : "EFFET ACTIVÉ PAR L'ADVERSAIRE"
              }}</span>
            </div>
            <button
              type="button"
              class="act-banner__close"
              title="Fermer la notification"
              aria-label="Fermer"
              @click="store.dismissActivationBanner"
            >
              ✕
            </button>
          </div>

          <!-- Card & Effect Content -->
          <div class="act-banner__content">
            <div v-if="banner.cardId" class="act-banner__thumb-wrap">
              <img
                :src="thumb(banner.cardId)"
                :alt="banner.cardName"
                class="act-banner__thumb"
                @error="onImgError"
              />
            </div>

            <div class="act-banner__info">
              <div class="act-banner__title-row">
                <span v-if="!banner.isSelf" class="act-banner__actor">
                  {{ banner.actorName }} active
                </span>
                <h3 class="act-banner__card-name">{{ banner.cardName }}</h3>
              </div>

              <div v-if="banner.effectText" class="act-banner__effect-box">
                <!-- eslint-disable-next-line vue/no-v-html -->
                <p
                  class="act-banner__effect-desc"
                  v-html="highlightEffectHtml(banner.effectText)"
                ></p>
              </div>
            </div>
          </div>

          <!-- Action requirement callout -->
          <div class="act-banner__action">
            <template v-if="!banner.isSelf">
              <div class="act-banner__alert-msg">
                <span class="act-banner__alert-icon">⚠️</span>
                <span class="act-banner__alert-text">
                  <strong>Action requise :</strong> Veuillez résoudre l'effet activé.
                </span>
              </div>
              <button
                type="button"
                class="act-banner__btn act-banner__btn--confirm"
                data-testid="activation-confirm-btn"
                @click="store.dismissActivationBanner"
              >
                ✓ Compris / Résolu
              </button>
            </template>
            <template v-else>
              <div class="act-banner__status-msg">
                <span class="act-banner__status-dot"></span>
                <span>Notification envoyée à l'adversaire — en attente de résolution</span>
              </div>
              <button
                type="button"
                class="act-banner__btn act-banner__btn--dismiss"
                @click="store.dismissActivationBanner"
              >
                Fermer
              </button>
            </template>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/gameStore";
import { getThumbPath } from "@/utils/imagePaths";
import { highlightEffectHtml } from "@/utils/effectText";

const store = useGameStore();
const banner = computed(() => store.activeActivationBanner);

function thumb(cardId: string): string {
  if (!cardId) return "/images/cards/back.webp";
  return getThumbPath(`/images/cards/${cardId}.webp`);
}

function onImgError(e: Event): void {
  const img = e.target as HTMLImageElement | null;
  if (img && !img.src.endsWith("/images/cards/back.webp")) {
    img.src = "/images/cards/back.webp";
  }
}
</script>

<style scoped>
.act-banner-wrap {
  position: fixed;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 95;
  pointer-events: auto;
  max-width: 90vw;
  width: 540px;
}

.act-banner {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 20px 18px;
  border-radius: 12px;
  background: linear-gradient(
    145deg,
    rgba(22, 17, 12, 0.96) 0%,
    rgba(14, 11, 8, 0.98) 100%
  );
  border: 1px solid rgba(240, 166, 43, 0.55);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.75),
    0 0 35px rgba(240, 166, 43, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  color: #f6f5f1;
  overflow: hidden;
  animation: banner-pulse 3s ease-in-out infinite;
}

.act-banner--opp {
  border-color: rgba(240, 78, 34, 0.75);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.8),
    0 0 45px rgba(240, 78, 34, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.act-banner__glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    rgba(240, 166, 43, 0.2) 0%,
    #f0a62b 50%,
    rgba(240, 166, 43, 0.2) 100%
  );
}

.act-banner--opp .act-banner__glow {
  background: linear-gradient(
    90deg,
    rgba(240, 78, 34, 0.2) 0%,
    #f04e22 50%,
    rgba(240, 78, 34, 0.2) 100%
  );
}

.act-banner__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.act-banner__tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #f0a62b;
}

.act-banner--opp .act-banner__tag {
  color: #ff7d52;
}

.act-banner__icon {
  font-size: 14px;
  filter: drop-shadow(0 0 6px rgba(240, 166, 43, 0.8));
  animation: zap-flash 1.2s ease-in-out infinite alternate;
}

.act-banner__close {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: color 0.15s ease, background 0.15s ease;
}

.act-banner__close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.act-banner__content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.act-banner__thumb-wrap {
  flex-shrink: 0;
  width: 64px;
  height: 90px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(240, 166, 43, 0.4);
  background: #110d0a;
}

.act-banner__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.act-banner__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.act-banner__title-row {
  display: flex;
  flex-direction: column;
}

.act-banner__actor {
  font-family: "Space Mono", monospace;
  font-size: 11px;
  color: #ff9b71;
  letter-spacing: 0.05em;
}

.act-banner__card-name {
  font-family: Fraunces, Georgia, serif;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  text-shadow: 0 2px 10px rgba(240, 166, 43, 0.3);
}

.act-banner__effect-box {
  background: rgba(0, 0, 0, 0.45);
  border-radius: 6px;
  padding: 8px 10px;
  border-left: 3px solid #f0a62b;
  max-height: 110px;
  overflow-y: auto;
}

.act-banner--opp .act-banner__effect-box {
  border-left-color: #f04e22;
}

.act-banner__effect-desc {
  font-size: 13px;
  line-height: 1.4;
  color: #ddd3c5;
  margin: 0;
}

.act-banner__action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.act-banner__alert-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #ffcf70;
}

.act-banner__alert-icon {
  font-size: 16px;
  animation: pulse-warn 1s ease-in-out infinite alternate;
}

.act-banner__status-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}

.act-banner__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f0a62b;
  box-shadow: 0 0 6px #f0a62b;
  animation: pulse-warn 1.5s infinite;
}

.act-banner__btn {
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 18px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.act-banner__btn--confirm {
  background: linear-gradient(135deg, #f0a62b 0%, #f04e22 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 3px 12px rgba(240, 78, 34, 0.4);
}

.act-banner__btn--confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 16px rgba(240, 78, 34, 0.6);
  filter: brightness(1.1);
}

.act-banner__btn--dismiss {
  background: rgba(255, 255, 255, 0.08);
  color: #e5e5e5;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.act-banner__btn--dismiss:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* Animations */
@keyframes zap-flash {
  from {
    transform: scale(0.95);
    opacity: 0.85;
  }
  to {
    transform: scale(1.18);
    opacity: 1;
  }
}

@keyframes pulse-warn {
  from {
    opacity: 0.7;
  }
  to {
    opacity: 1;
  }
}

@keyframes banner-pulse {
  0%, 100% {
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.8),
      0 0 30px rgba(240, 166, 43, 0.2);
  }
  50% {
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.8),
      0 0 50px rgba(240, 166, 43, 0.4);
  }
}

.act-banner--opp {
  animation-name: banner-opp-pulse;
}

@keyframes banner-opp-pulse {
  0%, 100% {
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.8),
      0 0 35px rgba(240, 78, 34, 0.3);
  }
  50% {
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.8),
      0 0 55px rgba(240, 78, 34, 0.55);
  }
}

/* Transition */
.act-banner-enter-active {
  transition: all 0.35s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.act-banner-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.act-banner-enter-from {
  opacity: 0;
  transform: translate(-50%, -24px) scale(0.92);
}

.act-banner-leave-to {
  opacity: 0;
  transform: translate(-50%, -16px) scale(0.95);
}
</style>
