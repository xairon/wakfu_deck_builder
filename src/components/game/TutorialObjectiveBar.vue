<script setup lang="ts">
/**
 * TutorialObjectiveBar — Bannière interactive des objectifs du tutoriel d'apprentissage.
 * Affiche l'étape en cours, l'action concrète demandée au joueur, l'explication
 * pédagogique de la règle du TCG Wakfu, ainsi que la progression globale.
 */
import { ref } from "vue";
import { useTutorialStore } from "@/stores/tutorialStore";

const tutorial = useTutorialStore();
const showRuleDetail = ref(true);
</script>

<template>
  <Transition name="tuto-bar">
    <div
      v-if="tutorial.active && tutorial.currentStep && !tutorial.welcomeVisible"
      class="tuto-bar"
      data-testid="tutorial-objective-bar"
    >
      <div class="tuto-bar__inner">
        <!-- En-tête : Badge étape + titre + progression -->
        <div class="tuto-bar__header">
          <div class="tuto-bar__meta">
            <span class="tuto-bar__badge">
              Étape {{ tutorial.currentStepIndex + 1 }} / {{ tutorial.totalSteps }}
            </span>
            <span class="tuto-bar__title font-display">{{ tutorial.currentStep.title }}</span>
          </div>
          <div class="tuto-bar__controls">
            <button
              v-if="tutorial.currentStep.ruleDetail"
              type="button"
              class="btn btn-xs btn-ghost gap-1 text-primary-content/80 hover:text-white"
              :aria-expanded="showRuleDetail"
              @click="showRuleDetail = !showRuleDetail"
            >
              <span>{{ showRuleDetail ? "Masquer la règle" : "📖 Règle" }}</span>
              <span class="text-xs">{{ showRuleDetail ? "▲" : "▼" }}</span>
            </button>
            <button
              type="button"
              class="btn btn-xs btn-outline btn-primary text-xs"
              title="Passer à l'étape suivante si tu es bloqué"
              @click="tutorial.skipCurrentStep()"
            >
              Passer l'étape ⏩
            </button>
          </div>
        </div>

        <!-- Corps : Action demandée bien mise en valeur -->
        <div class="tuto-bar__action-box">
          <div class="tuto-bar__icon animate-pulse">🎯</div>
          <div class="tuto-bar__action-content">
            <p class="tuto-bar__action-text">
              <strong>Action demandée :</strong> {{ tutorial.currentStep.actionPrompt }}
            </p>
          </div>
        </div>

        <!-- Détail explicatif de la règle officielle du jeu -->
        <Transition name="tuto-slide">
          <div v-if="showRuleDetail && tutorial.currentStep.ruleDetail" class="tuto-bar__rule-detail">
            <div class="flex items-start gap-2">
              <span class="text-secondary text-sm">💡</span>
              <p class="text-xs text-base-content/80 leading-relaxed">
                {{ tutorial.currentStep.ruleDetail }}
              </p>
            </div>
          </div>
        </Transition>

        <!-- Barre de progression des étapes -->
        <div class="tuto-bar__progress">
          <div
            v-for="(step, idx) in tutorial.steps"
            :key="step.id"
            class="tuto-bar__dot"
            :class="{
              'tuto-bar__dot--completed': idx < tutorial.currentStepIndex,
              'tuto-bar__dot--active': idx === tutorial.currentStepIndex,
            }"
            :title="step.title"
          ></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tuto-bar {
  margin: 10px auto 4px;
  max-width: min(96vw, 920px);
  position: relative;
  z-index: 20;
}

.tuto-bar__inner {
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(28, 25, 23, 0.94), rgba(41, 37, 36, 0.96));
  border: 1px solid rgba(245, 158, 11, 0.35);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 15px rgba(245, 158, 11, 0.15);
  padding: 12px 16px;
  backdrop-filter: blur(8px);
}

.tuto-bar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.tuto-bar__meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tuto-bar__badge {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 3px 8px;
  border-radius: 9999px;
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.tuto-bar__title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #f6f5f1;
}

.tuto-bar__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tuto-bar__action-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 8px;
  margin-bottom: 8px;
}

.tuto-bar__icon {
  font-size: 1.25rem;
  flex: none;
}

.tuto-bar__action-content {
  flex: 1;
  min-width: 0;
}

.tuto-bar__action-text {
  font-size: 0.88rem;
  color: #fef3c7;
  line-height: 1.35;
}

.tuto-bar__action-text strong {
  color: #f59e0b;
}

.tuto-bar__rule-detail {
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  border-left: 3px solid #f59e0b;
  margin-bottom: 8px;
}

.tuto-bar__progress {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.tuto-bar__dot {
  flex: 1;
  height: 4px;
  border-radius: 9999px;
  background: rgba(246, 245, 241, 0.15);
  transition: all 0.3s ease;
}

.tuto-bar__dot--completed {
  background: #10b981;
}

.tuto-bar__dot--active {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.8);
}

/* Animations */
.tuto-bar-enter-active,
.tuto-bar-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.tuto-bar-enter-from,
.tuto-bar-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.tuto-slide-enter-active,
.tuto-slide-leave-active {
  transition: all 0.2s ease;
}
.tuto-slide-enter-from,
.tuto-slide-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}
</style>
