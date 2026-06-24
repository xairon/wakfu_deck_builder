<script setup lang="ts">
/**
 * Calque de liaisons de combat — trace par-dessus le plateau les flèches
 * attaquant → cible (rouge) et bloqueur → attaquant (bleu), pour rendre lisible
 * « qui frappe qui ». Purement décoratif (pointer-events: none) : les positions
 * sont lues sur le DOM des cartes (attribut `data-iid`), recalculées à chaque
 * changement de déclaration (watch profond) puis suivies en boucle rAF (scroll,
 * resize, animations) tant qu'un combat est en cours et l'onglet visible.
 */
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useGameStore } from "@/stores/gameStore";

const store = useGameStore();
const svg = ref<SVGSVGElement | null>(null);
type Link = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: "atk" | "blk";
};
const links = ref<Link[]>([]);

/** Centre d'une carte (par instanceId) relatif au coin haut-gauche du calque. */
function center(iid: string, origin: DOMRect): { x: number; y: number } | null {
  const el = document.querySelector(`[data-iid="${iid}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2 - origin.left,
    y: r.top + r.height / 2 - origin.top,
  };
}

function recompute(): void {
  const c = store.combat;
  const host = svg.value;
  if (!c || !host) {
    if (links.value.length) links.value = [];
    return;
  }
  const origin = host.getBoundingClientRect();
  const out: Link[] = [];
  // Attaquant → cible.
  if (c.target) {
    const t = center(c.target.instanceId, origin);
    if (t)
      for (const a of c.attackers) {
        const p = center(a, origin);
        if (p) out.push({ x1: p.x, y1: p.y, x2: t.x, y2: t.y, kind: "atk" });
      }
  }
  // Bloqueur → attaquant (blocks : blockerId → attackerId).
  for (const [blockerId, attackerId] of Object.entries(c.blocks)) {
    const b = center(blockerId, origin);
    const a = center(attackerId, origin);
    if (b && a) out.push({ x1: b.x, y1: b.y, x2: a.x, y2: a.y, kind: "blk" });
  }
  links.value = out;
}

// Source de vérité du rafraîchissement : un watch RÉACTIF profond sur le combat
// (déclarations qui changent) — fiable quel que soit l'état de visibilité de
// l'onglet, contrairement à requestAnimationFrame (suspendu si l'onglet est
// caché). flush "post" garantit que le DOM des cartes est à jour avant mesure.
watch(
  () => store.combat,
  () => void nextTick(recompute),
  {
    deep: true,
    flush: "post",
  },
);

// En complément (onglet VISIBLE) : une boucle rAF suit les dérives de mise en
// page — scroll, resize, animations d'entrée des cartes — pendant un combat.
let raf = 0;
function tick(): void {
  recompute();
  raf = store.combat ? requestAnimationFrame(tick) : 0;
}
watch(
  () => !!store.combat,
  (on) => {
    if (on && !raf) raf = requestAnimationFrame(tick);
  },
);
function onResize(): void {
  recompute();
}
// Au retour d'onglet : la boucle rAF était suspendue (onglet caché) ; on
// recalcule et on la relance pour resynchroniser les flèches.
function onVisible(): void {
  if (document.visibilityState !== "visible") return;
  recompute();
  if (store.combat && !raf) raf = requestAnimationFrame(tick);
}
onMounted(() => {
  recompute();
  if (store.combat) raf = requestAnimationFrame(tick);
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisible);
});
onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf);
  window.removeEventListener("resize", onResize);
  document.removeEventListener("visibilitychange", onVisible);
});
</script>

<template>
  <!-- Le <div> en inset:0 dimensionne de façon fiable (un SVG inline se replie
       parfois) ; le SVG le remplit et sert de repère de coordonnées. -->
  <div class="clinks-host" aria-hidden="true">
    <svg
      ref="svg"
      class="clinks"
      data-testid="combat-links"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker
          id="clink-atk"
          markerWidth="9"
          markerHeight="9"
          refX="7"
          refY="4.5"
          orient="auto"
        >
          <path d="M0,0 L9,4.5 L0,9 Z" fill="#f04e22" />
        </marker>
        <marker
          id="clink-blk"
          markerWidth="9"
          markerHeight="9"
          refX="7"
          refY="4.5"
          orient="auto"
        >
          <path d="M0,0 L9,4.5 L0,9 Z" fill="#1f9cec" />
        </marker>
      </defs>
      <line
        v-for="(l, i) in links"
        :key="i"
        :x1="l.x1"
        :y1="l.y1"
        :x2="l.x2"
        :y2="l.y2"
        :class="l.kind === 'atk' ? 'clink clink--atk' : 'clink clink--blk'"
        :marker-end="l.kind === 'atk' ? 'url(#clink-atk)' : 'url(#clink-blk)'"
      />
    </svg>
  </div>
</template>

<style scoped>
.clinks-host {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  overflow: visible;
}
.clinks {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.clink {
  stroke-width: 2.5;
  stroke-linecap: round;
  opacity: 0.85;
}
.clink--atk {
  stroke: #f04e22;
  filter: drop-shadow(0 0 3px rgba(240, 78, 34, 0.6));
}
.clink--blk {
  stroke: #1f9cec;
  stroke-dasharray: 6 4;
  filter: drop-shadow(0 0 3px rgba(31, 156, 236, 0.6));
}
</style>
