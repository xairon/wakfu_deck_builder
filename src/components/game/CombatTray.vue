<script setup lang="ts">
/**
 * Panneau de combat (« combat tray », façon MTGA) — remplace les anciennes
 * flèches CombatLinks. Pendant un combat déclaré, liste chaque affrontement de
 * façon lisible (attaquant → cible, ou attaquant ⚔ bloqueur(s)) avec la Force
 * effective, l'aperçu de dégâts (qui meurt, PV/Rés. projetés) déjà calculé par
 * `combatPreview`, et les effets de combat notables actifs (Trêve, Glyphe).
 * Purement présentationnel : lit le store, ne mute rien.
 */
import { computed } from "vue";
import { useGameStore } from "@/stores/gameStore";
import { useCardStore } from "@/stores/cardStore";

const store = useGameStore();
const cardStore = useCardStore();

function nameOf(instanceId: string): string {
  const inst = store.state.instances[instanceId];
  const card = inst?.cardId ? cardStore.cardIndex.get(inst.cardId) : null;
  return card?.name ?? "Carte";
}
function forceOf(instanceId: string): number | null {
  return store.effectiveForceOf(instanceId)?.value ?? null;
}
function isLethal(instanceId: string): boolean {
  return store.combatPreview?.lethal.includes(instanceId) ?? false;
}

type Combatant = {
  id: string;
  name: string;
  force: number | null;
  lethal: boolean;
};
type Matchup = {
  attacker: Combatant;
  blockers: Combatant[]; // vide = attaquant libre (frappe la Cible)
};

const combatant = (id: string): Combatant => ({
  id,
  name: nameOf(id),
  force: forceOf(id),
  lethal: isLethal(id),
});

const matchups = computed<Matchup[]>(() => {
  const c = store.combat;
  if (!c) return [];
  return c.attackers.map((atk) => {
    const blockers = Object.entries(c.blocks)
      .filter(([, a]) => a === atk)
      .map(([b]) => combatant(b));
    return { attacker: combatant(atk), blockers };
  });
});

/** Libellé + jauge projetée de la Cible (Héros PV / Havre-Sac Résistance). */
const targetInfo = computed(() => {
  const c = store.combat;
  if (!c?.target) return null;
  const t = c.target;
  const label =
    t.kind === "havreSac"
      ? "Havre-Sac adverse"
      : t.kind === "hero"
        ? nameOf(t.instanceId)
        : nameOf(t.instanceId);
  const vital = t.kind === "havreSac" ? "Rés." : "PV";
  const after = store.combatPreview?.hpAfter[t.instanceId];
  return {
    label,
    vital,
    after: after === undefined ? null : Math.max(0, after),
    lethal: isLethal(t.instanceId),
    kind: t.kind,
  };
});

const stepLabel = computed(() => {
  const c = store.combat;
  if (!c) return "";
  switch (c.step) {
    case "attackers":
      return "Déclaration des attaquants";
    case "blockers":
      return "En attente des blocages";
    case "strikes":
      return "Choix des frappes";
    case "geant":
      return "Répartition (Géant)";
    case "riposte":
      return "Riposte";
    default:
      return "Résolution";
  }
});

const lethalCount = computed(() => store.combatPreview?.lethal.length ?? 0);

/** Effets de combat notables actuellement actifs (chips), détectés sur les jetons. */
const activeEffects = computed<string[]>(() => {
  const out: string[] = [];
  const turn = store.state.turn.number;
  let glyphes = 0;
  let treve = false;
  for (const inst of Object.values(store.state.instances)) {
    const tok = inst.counters?.tokens;
    if (!tok) continue;
    glyphes += tok.glypheDamage ?? 0;
    if ((tok.treveUntilTurn ?? 0) >= turn) treve = true;
  }
  if (treve) out.push("⛨ Trêve");
  if (glyphes > 0) out.push(`🔥 Glyphe ×${glyphes}`);
  return out;
});
</script>

<template>
  <transition name="ctray-fade">
    <aside
      v-if="store.combat"
      class="ctray"
      data-testid="combat-tray"
      aria-label="Résumé du combat"
    >
      <header class="ctray__head">
        <span class="ctray__title">⚔ Combat</span>
        <span class="ctray__step">{{ stepLabel }}</span>
      </header>

      <ul class="ctray__list">
        <li v-for="m in matchups" :key="m.attacker.id" class="ctray__row">
          <span
            class="ctray__unit ctray__unit--atk"
            :class="{ 'is-dead': m.attacker.lethal }"
          >
            <span class="ctray__name">{{ m.attacker.name }}</span>
            <span v-if="m.attacker.force !== null" class="ctray__force"
              >F{{ m.attacker.force }}</span
            >
            <span v-if="m.attacker.lethal" class="ctray__skull" title="Détruit"
              >☠</span
            >
          </span>

          <template v-if="m.blockers.length">
            <span class="ctray__vs">⚔ bloqué par</span>
            <span class="ctray__blockers">
              <span
                v-for="b in m.blockers"
                :key="b.id"
                class="ctray__unit ctray__unit--blk"
                :class="{ 'is-dead': b.lethal }"
              >
                <span class="ctray__name">{{ b.name }}</span>
                <span v-if="b.force !== null" class="ctray__force"
                  >F{{ b.force }}</span
                >
                <span v-if="b.lethal" class="ctray__skull" title="Détruit"
                  >☠</span
                >
              </span>
            </span>
          </template>
          <template v-else>
            <span class="ctray__arrow">→</span>
            <span
              class="ctray__unit ctray__unit--tgt"
              :class="{ 'is-dead': targetInfo?.lethal }"
            >
              <span class="ctray__name">{{ targetInfo?.label }}</span>
            </span>
          </template>
        </li>
      </ul>

      <footer class="ctray__foot">
        <span
          v-if="targetInfo && targetInfo.after !== null"
          class="ctray__chip"
        >
          {{ targetInfo.label }} : {{ targetInfo.vital }} {{ targetInfo.after }}
        </span>
        <span v-if="lethalCount" class="ctray__chip ctray__chip--lethal">
          ☠ {{ lethalCount }} détruite(s)
        </span>
        <span
          v-for="e in activeEffects"
          :key="e"
          class="ctray__chip ctray__chip--fx"
        >
          {{ e }}
        </span>
      </footer>
    </aside>
  </transition>
</template>

<style scoped>
.ctray {
  position: absolute;
  top: 150px;
  left: 10px;
  z-index: 6;
  width: 250px;
  max-width: 42vw;
  padding: 8px 12px 10px;
  border-radius: 12px;
  /* Semi-transparent + flou : n'occulte pas totalement les cartes de l'aile
     gauche adverse derrière lui (les clics passent déjà — pointer-events:none). */
  background: linear-gradient(
    180deg,
    rgba(28, 22, 16, 0.82),
    rgba(18, 14, 10, 0.82)
  );
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  border: 1px solid rgba(240, 78, 34, 0.35);
  box-shadow:
    0 8px 26px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  color: #f2ede4;
  font-size: 13px;
  pointer-events: none; /* n'interfère pas avec les clics du plateau */
}
.ctray__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.ctray__title {
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #f0a62b;
}
.ctray__step {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #b9ad9b;
}
.ctray__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ctray__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  line-height: 1.3;
}
.ctray__unit {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
}
.ctray__unit--atk {
  border-color: rgba(240, 78, 34, 0.55);
}
.ctray__unit--blk {
  border-color: rgba(31, 156, 236, 0.55);
}
.ctray__unit--tgt {
  border-color: rgba(240, 166, 43, 0.55);
}
.ctray__unit.is-dead {
  opacity: 0.6;
  text-decoration: line-through;
  text-decoration-color: rgba(240, 78, 34, 0.8);
}
.ctray__name {
  font-weight: 600;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ctray__force {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  color: #f6d99a;
}
.ctray__skull {
  color: #f04e22;
}
.ctray__vs,
.ctray__arrow {
  font-size: 11px;
  color: #b9ad9b;
}
.ctray__blockers {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ctray__foot {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.ctray__chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #d8cfbf;
}
.ctray__chip--lethal {
  color: #f9c3b3;
  border-color: rgba(240, 78, 34, 0.4);
}
.ctray__chip--fx {
  color: #cfe6ff;
  border-color: rgba(31, 156, 236, 0.4);
}
.ctray-fade-enter-active,
.ctray-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.ctray-fade-enter-from,
.ctray-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
@media (prefers-reduced-motion: reduce) {
  .ctray-fade-enter-active,
  .ctray-fade-leave-active {
    transition: none;
  }
}
</style>
