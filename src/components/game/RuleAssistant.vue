<script setup lang="ts">
/**
 * Assistant de règles — bandeau « coach » discret affichant l'indice contextuel
 * (quoi faire / pourquoi un coup est refusé) avec un « ? » dépliant la règle.
 * Toute la logique vit dans `useRuleAssistant` ; ce composant n'est que l'UI.
 */
import { ref } from "vue";
import { useRuleAssistant } from "@/composables/useRuleAssistant";

const { hint, dismiss } = useRuleAssistant();
const showRule = ref(false);
</script>

<template>
  <Transition name="coach">
    <div
      v-if="hint"
      class="coach"
      :class="`coach--${hint.tone}`"
      role="status"
      data-testid="rule-assistant"
    >
      <div class="coach__row">
        <span class="coach__icon" aria-hidden="true">{{
          hint.tone === "warn" ? "⚠️" : hint.tone === "action" ? "👉" : "ℹ️"
        }}</span>
        <span class="coach__text">{{ hint.text }}</span>
        <button
          v-if="hint.rule"
          type="button"
          class="coach__btn"
          :aria-expanded="showRule"
          :aria-label="showRule ? 'Masquer la règle' : 'Voir la règle'"
          @click="showRule = !showRule"
        >
          {{ showRule ? "−" : "?" }}
        </button>
        <button
          v-if="hint.tone === 'warn'"
          type="button"
          class="coach__btn coach__btn--dismiss"
          aria-label="Masquer"
          @click="dismiss"
        >
          ✕
        </button>
      </div>
      <p v-if="hint.rule && showRule" class="coach__rule">
        <strong>Règle {{ hint.rule.ref }}</strong> — {{ hint.rule.detail }}
      </p>
    </div>
  </Transition>
</template>

<style scoped>
.coach {
  margin: 8px auto 0;
  max-width: min(96vw, 880px);
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(20, 18, 15, 0.72);
  border: 1px solid rgba(246, 245, 241, 0.1);
  border-left-width: 3px;
  color: rgba(246, 245, 241, 0.92);
  font-size: 0.86rem;
  line-height: 1.35;
  backdrop-filter: blur(4px);
}
.coach__row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.coach__icon {
  flex: none;
  font-size: 1rem;
}
.coach__text {
  flex: 1;
  min-width: 0;
}
.coach__btn {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(246, 245, 241, 0.12);
  color: inherit;
  font-weight: 700;
  font-size: 0.9rem;
  line-height: 1;
  transition: background 0.15s ease;
}
.coach__btn:hover {
  background: rgba(246, 245, 241, 0.22);
}
.coach__btn--dismiss {
  font-size: 0.75rem;
  opacity: 0.7;
}
.coach__rule {
  margin: 6px 0 0;
  padding-top: 6px;
  border-top: 1px solid rgba(246, 245, 241, 0.1);
  font-size: 0.8rem;
  color: rgba(246, 245, 241, 0.74);
}
.coach__rule strong {
  color: #f7a072;
}
/* Tons */
.coach--action {
  border-left-color: #f04e22;
}
.coach--warn {
  border-left-color: #e0a300;
  background: rgba(64, 44, 8, 0.78);
}
.coach--info {
  border-left-color: rgba(246, 245, 241, 0.35);
}
.coach-enter-active,
.coach-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.coach-enter-from,
.coach-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
@media (prefers-reduced-motion: reduce) {
  .coach-enter-active,
  .coach-leave-active {
    transition: none;
  }
}
</style>
