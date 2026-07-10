<script setup lang="ts">
/**
 * Calque SONORE de la table (sans rendu) : observe le store et joue les
 * repères discrets de useGameSounds — nouvelles lignes de journal (pioche,
 * pose, inclinaison, dommages), ouverture d'un combat (tambour), fin de
 * partie (arpège victoire / défaite). Monté une fois par table ; muet tant
 * que l'utilisateur n'a pas interagi (politique d'autoplay) et coupable via
 * le bouton du bandeau (préférence persistée).
 */
import { watch } from "vue";
import { useGameStore } from "@/stores/gameStore";
import { useGameSounds, sfxForLogLine } from "@/composables/useGameSounds";

const store = useGameStore();
const sounds = useGameSounds();

// ARMEMENT différé : les rafales de mise en place (mélanges, 6 pioches
// d'ouverture de chaque joueur) ne sonnent pas — on n'arme qu'une fois la
// partie réellement en cours.
let armedAt = 0;
watch(
  () => store.matchPhase,
  (p) => {
    armedAt = p === "playing" ? Date.now() + 800 : 0;
  },
  { immediate: true },
);

watch(
  () => store.log.length,
  (len, prev) => {
    if (!armedAt || Date.now() < armedAt) return;
    // Ne considérer que les NOUVELLES lignes (au plus 4 — une rafale plus
    // large est un enchaînement automatique : un seul repère par type suffit,
    // l'anti-mitraille du composable fait le reste).
    const fresh = store.log.slice(Math.max(prev ?? 0, len - 4), len);
    for (const line of fresh) {
      const kind = sfxForLogLine(line.text);
      if (kind) sounds.play(kind);
    }
  },
);

// Déclaration de combat : tambour (une fois par combat).
watch(
  () => !!store.combat,
  (inCombat, was) => {
    if (inCombat && !was && armedAt && Date.now() >= armedAt)
      sounds.play("attack");
  },
);

// Fin de partie : victoire si le siège local gagne (vs bot : le siège humain),
// défaite sinon. En hot-seat local (pas de bot), l'arpège de victoire convient
// aux deux (quelqu'un gagne à la table).
watch(
  () => store.winner,
  (w) => {
    if (!w || !armedAt) return;
    const humanSeat = store.botSeat === "A" ? "B" : "A";
    sounds.play(store.botSeat && w !== humanSeat ? "defeat" : "victory");
  },
);
</script>

<template>
  <span aria-hidden="true" style="display: none"></span>
</template>
