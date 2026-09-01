/**
 * Couleurs des cinq éléments Wakfu (palette GRIMOIRE). Source unique —
 * remplace les duplications dans CardZoomModal / CardDetailsModal / etc.
 */
export const elementColors: Record<string, string> = {
  air: "#A855F7",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#5FB22A",
  neutre: "#98A1AF",
};

export function elementColor(element?: string | null): string {
  return (
    elementColors[(element ?? "neutre").toLowerCase()] ?? elementColors.neutre
  );
}
