<template>
  <div
    class="phase-bar"
    :class="{ 'phase-bar--inactif': !isMyTurn, 'phase-bar--compact': compact }"
  >
    <!-- ── Phases principales du tour ── -->
    <div class="phase-bar__phases">
      <button
        v-for="ph in mainPhases"
        :key="ph.id"
        type="button"
        class="phase-btn"
        :class="{
          'phase-btn--active': isPhaseActive(ph.id),
          'phase-btn--done': isPhaseDone(ph.id),
          'phase-btn--inactif': !isMyTurn,
        }"
        :title="ph.description"
        @click="goToPhase(ph.id)"
      >
        <span class="phase-btn__icon">{{ ph.icon }}</span>
        <span class="phase-btn__label">{{ ph.label }}</span>
        <span
          v-if="isPhaseActive(ph.id)"
          class="phase-btn__pip"
          aria-hidden="true"
        ></span>
      </button>

      <template v-if="!hideEndTurn">
        <span class="phase-bar__divider"></span>

        <!-- ── Bouton Fin du tour intégré ── -->
        <button
          v-if="canEndTurn"
          type="button"
          class="phase-btn phase-btn--endturn"
          title="Finir le tour actuel"
          data-testid="phase-end-turn"
          @click="endTurn"
        >
          <span class="phase-btn__icon">⏳</span>
          <span class="phase-btn__label">Fin de Tour</span>
        </button>
      </template>
    </div>

    <!-- ── Sous-phases de la Phase Principale / Combat ── -->
    <Transition name="combat-sub">
      <div v-if="showCombatSubs" class="phase-bar__combat">
        <span class="phase-bar__combat-label"
          >Sous-phases (Combat & Actions ⚔)</span
        >
        <div class="phase-bar__combat-steps">
          <button
            v-for="sub in combatSubPhases"
            :key="sub.id"
            type="button"
            class="phase-sub"
            :class="{
              'phase-sub--active': isCombatSubActive(sub.id),
            }"
            :title="sub.description"
            @click="selectSubPhase(sub.id)"
          >
            <span class="phase-sub__num">{{ sub.num }}</span>
            <span class="phase-sub__label">{{ sub.label }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useGameStore } from "@/stores/gameStore";
import type { TurnPhase } from "@/game";

const props = withDefaults(
  defineProps<{
    hideEndTurn?: boolean;
    compact?: boolean;
  }>(),
  {
    hideEndTurn: false,
    compact: false,
  },
);

const store = useGameStore();

const isMyTurn = computed(() => store.turn.active === store.perspective);

const canEndTurn = computed(() => {
  return (
    store.turn.active === store.perspective &&
    !store.pendingChifumi &&
    !store.pendingResolution &&
    !store.combat &&
    !store.pendingPayment &&
    !store.effectTargeting &&
    !store.pendingBearer &&
    !store.effectChoice
  );
});

/** Indique si la phase active est la Principale (combat peut survenir) */
const showCombatSubs = computed(
  () => store.turn.phase === "principale" || store.combat != null,
);

const localSubPhase = ref<string | null>(null);

// ── 4 phases de tour (règle structure d'un tour §602-605) ───────────────────
const TURN_PHASE_ORDER: TurnPhase[] = [
  "redressement",
  "principale",
  "pioche",
  "fin",
];

interface PhaseInfo {
  id: TurnPhase;
  icon: string;
  label: string;
  description: string;
}

const mainPhases: PhaseInfo[] = [
  {
    id: "redressement",
    icon: "⟳",
    label: "Redressement",
    description:
      "602 — Redressez toutes vos cartes inclinées. Les pouvoirs « Au début de votre tour » se déclenchent.",
  },
  {
    id: "principale",
    icon: "⚔",
    label: "Principale",
    description:
      "603 — Jouez vos cartes, utilisez vos pouvoirs, déclarez une attaque (une seule par tour).",
  },
  {
    id: "pioche",
    icon: "🎴",
    label: "Pioche",
    description: "604 — Piochez jusqu'à atteindre votre nombre de PA en main.",
  },
  {
    id: "fin",
    icon: "🌙",
    label: "Fin de Tour",
    description:
      "605 — Les effets de fin de tour se résolvent, les dommages des Alliés sont retirés.",
  },
];

// ── 7 sous-phases de combat (règles 702-708) ────────────────────────────────
interface CombatSubPhase {
  id: string;
  num: string;
  label: string;
  description: string;
}

const combatSubPhases: CombatSubPhase[] = [
  {
    id: "target",
    num: "702",
    label: "Déclaration Cible",
    description:
      "702. Phase de Déclaration de la Cible (Héros, Allié ou Havre-Sac).",
  },
  {
    id: "attackers",
    num: "703",
    label: "Déclaration Attaquants",
    description: "703. Phase de Déclaration des Attaquants.",
  },
  {
    id: "blockers",
    num: "704",
    label: "Déclaration Bloqueurs",
    description: "704. Phase de Déclaration des Bloqueurs.",
  },
  {
    id: "actions",
    num: "705",
    label: "Phase d'Actions",
    description: "705. Phase d'Actions (Réactions / Pouvoirs).",
  },
  {
    id: "duels",
    num: "706",
    label: "Résolution Duels",
    description: "706. Phase de Résolution des Duels.",
  },
  {
    id: "damage",
    num: "707",
    label: "Dommages Cible",
    description: "707. Phase de Résolution des Dommages sur la Cible.",
  },
  {
    id: "endcombat",
    num: "708",
    label: "Fin de Combat",
    description: "708. Phase de Fin de Combat.",
  },
];

/** Phase en cours dans le moteur */
function isPhaseActive(id: TurnPhase): boolean {
  return store.turn.phase === id;
}

/** Phase déjà passée (dans l'ordre du tour actif) */
function isPhaseDone(id: TurnPhase): boolean {
  const current = TURN_PHASE_ORDER.indexOf(store.turn.phase);
  const target = TURN_PHASE_ORDER.indexOf(id);
  return target < current;
}

/** Sous-phase active dérivée de l'état du combat ou de la sélection locale */
function isCombatSubActive(id: string): boolean {
  const c = store.combat;
  if (c) {
    if (id === "target") return false;
    if (id === "attackers") return c.step === "attackers";
    if (id === "blockers") return c.step === "blockers";
    if (id === "actions") return c.step === "strikes";
    if (id === "duels") return c.step === "strikes" || c.step === "geant";
    if (id === "damage") return c.step === "geant";
    if (id === "endcombat") return false;
  }
  return localSubPhase.value === id;
}

function selectSubPhase(id: string): void {
  localSubPhase.value = localSubPhase.value === id ? null : id;
}

function goToPhase(phase: TurnPhase): void {
  if (!isMyTurn.value) return;
  if (store.turn.phase === phase) return;
  store.setTurnPhase(phase);
}

function endTurn(): void {
  store.endTurn();
}
</script>

<style scoped>
/* ── Conteneur principal ── */
.phase-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
  z-index: 10;
  position: relative;
}

.phase-bar--inactif .phase-btn {
  cursor: default;
}

/* ── Rangée de phases ── */
.phase-bar__phases {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 4px 6px;
  backdrop-filter: blur(8px);
}

.phase-bar__divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}

/* ── Bouton de phase ── */
.phase-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s,
    transform 0.15s;
  white-space: nowrap;
}

.phase-btn__icon {
  font-size: 1rem;
  line-height: 1;
}

.phase-btn:hover:not(.phase-btn--inactif) {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  transform: translateY(-1px);
}

/* Phase terminée */
.phase-btn--done {
  color: rgba(255, 255, 255, 0.2);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

.phase-btn--done .phase-btn__icon {
  opacity: 0.3;
}

/* Phase ACTIVE */
.phase-btn--active {
  background: linear-gradient(
    135deg,
    rgba(240, 180, 40, 0.25) 0%,
    rgba(240, 100, 30, 0.2) 100%
  );
  border-color: rgba(240, 180, 40, 0.6);
  color: #ffd700;
  box-shadow:
    0 0 12px rgba(240, 180, 40, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

/* Bouton Fin du tour spécial */
.phase-btn--endturn {
  background: linear-gradient(
    135deg,
    rgba(220, 38, 38, 0.3) 0%,
    rgba(185, 28, 28, 0.2) 100%
  );
  border-color: rgba(239, 68, 68, 0.5);
  color: #fca5a5;
}

.phase-btn--endturn:hover {
  background: linear-gradient(
    135deg,
    rgba(239, 68, 68, 0.5) 0%,
    rgba(220, 38, 38, 0.3) 100%
  );
  border-color: #ef4444;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
}

/* Pip animé sur phase active */
.phase-btn__pip {
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #ffd700;
  box-shadow: 0 0 6px #ffd700;
  animation: pip-pulse 1.5s ease-in-out infinite;
}

@keyframes pip-pulse {
  0%,
  100% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
  50% {
    opacity: 0.4;
    transform: translateX(-50%) scale(0.6);
  }
}

/* ── Sous-phases de combat ── */
.phase-bar__combat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.phase-bar__combat-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  color: #ef4444;
  text-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
}

.phase-bar__combat-steps {
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 999px;
  padding: 3px 8px;
  backdrop-filter: blur(8px);
}

.phase-sub {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 6px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s;
  min-width: 42px;
}

.phase-sub:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.phase-sub__num {
  font-size: 0.55rem;
  font-weight: 700;
  color: rgba(239, 68, 68, 0.5);
  font-family: "Space Mono", ui-monospace, monospace;
}

.phase-sub__label {
  font-size: 0.55rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
  line-height: 1.2;
}

.phase-sub--active {
  background: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.6);
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
}

.phase-sub--active .phase-sub__num {
  color: #f87171;
}

.phase-sub--active .phase-sub__label {
  color: #ffffff;
}

/* ── Transitions ── */
.combat-sub-enter-active,
.combat-sub-leave-active {
  transition: all 0.3s ease;
}

.combat-sub-enter-from,
.combat-sub-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.95);
}

.phase-bar--compact {
  gap: 2px;
}

.phase-bar--compact .phase-bar__phases {
  padding: 2px 6px;
  gap: 3px;
  background: rgba(18, 14, 11, 0.75);
  border: 1px solid rgba(240, 166, 43, 0.3);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
}

.phase-bar--compact .phase-btn {
  flex-direction: row;
  padding: 3px 8px;
  gap: 5px;
  font-size: 0.68rem;
  border-radius: 999px;
}

.phase-bar--compact .phase-btn__icon {
  font-size: 0.85rem;
}

.phase-bar--compact .phase-bar__combat {
  padding: 3px 8px;
  border-radius: 8px;
}

.phase-bar--compact .phase-bar__combat-label {
  font-size: 0.58rem;
}

.phase-bar--compact .phase-sub {
  padding: 2px 6px;
  font-size: 0.58rem;
}

@media (prefers-reduced-motion: reduce) {
  .phase-btn__pip {
    animation: none;
  }
  .phase-btn,
  .combat-sub-enter-active,
  .combat-sub-leave-active {
    transition: none;
  }
}
</style>
