/**
 * Aperçu de carte au survol (façon MTGA) — état global partagé.
 * N'importe quel composant (plateau, mulligan…) appelle show()/hide() ; un
 * unique CardPreviewLayer rend la grande carte qui suit le curseur.
 */
import { ref } from "vue";
import type { Card } from "@/types/cards";

const card = ref<Card | null>(null);
const cardFace = ref<"recto" | "verso">("recto");
const mouseX = ref(0);
const mouseY = ref(0);
let listening = false;

function onMove(e: MouseEvent): void {
  mouseX.value = e.clientX;
  mouseY.value = e.clientY;
}

export function useCardPreview() {
  function show(c: Card | null, face: "recto" | "verso" = "recto"): void {
    if (!c) return;
    if (!listening && typeof window !== "undefined") {
      window.addEventListener("mousemove", onMove);
      listening = true;
    }
    card.value = c;
    cardFace.value = face;
  }
  function hide(): void {
    card.value = null;
    cardFace.value = "recto";
  }
  return { card, cardFace, mouseX, mouseY, show, hide };
}
