import { computed } from "vue";

export const ELEMENTS = {
  EAU: "Eau",
  FEU: "Feu",
  TERRE: "Terre",
  AIR: "Air",
  NEUTRE: "Neutre",
} as const;

export type Element = (typeof ELEMENTS)[keyof typeof ELEMENTS];

const elementIcons: Record<Element, string> = {
  [ELEMENTS.EAU]: new URL("@/data/elements/ressource-eau.png", import.meta.url)
    .href,
  [ELEMENTS.FEU]: new URL("@/data/elements/ressource-feu.png", import.meta.url)
    .href,
  [ELEMENTS.TERRE]: new URL(
    "@/data/elements/ressource-terre.png",
    import.meta.url,
  ).href,
  [ELEMENTS.AIR]: new URL("@/data/elements/ressource-air.png", import.meta.url)
    .href,
  [ELEMENTS.NEUTRE]: new URL(
    "@/data/elements/ressource-neutre.png",
    import.meta.url,
  ).href,
};

/** Normalise une casse d'élément quelconque (ex. "feu" → "Feu"). */
function normalizeElement(element: string): Element {
  if (!element) return ELEMENTS.NEUTRE;
  const cap = element.charAt(0).toUpperCase() + element.slice(1).toLowerCase();
  return (Object.values(ELEMENTS) as string[]).includes(cap)
    ? (cap as Element)
    : ELEMENTS.NEUTRE;
}

export function useElements() {
  const elements = computed(() => Object.values(ELEMENTS));

  function getElementIcon(element: Element): string {
    // Tolérant à la casse : évite un <img src="undefined"> si une donnée
    // non normalisée (minuscule) passe.
    return elementIcons[normalizeElement(element)];
  }

  function getElementColor(element: Element): string {
    switch (normalizeElement(element)) {
      case ELEMENTS.EAU:
        return "text-blue-500";
      case ELEMENTS.FEU:
        return "text-red-500";
      case ELEMENTS.TERRE:
        return "text-amber-700";
      case ELEMENTS.AIR:
        return "text-emerald-500";
      case ELEMENTS.NEUTRE:
      default:
        return "text-gray-500";
    }
  }

  return {
    elements,
    getElementIcon,
    getElementColor,
    ELEMENTS,
  };
}
