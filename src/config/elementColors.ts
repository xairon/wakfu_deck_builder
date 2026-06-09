/**
 * Couleurs des cinq éléments Wakfu (palette GRIMOIRE). Source unique —
 * remplace les duplications dans CardZoomModal / CardDetailsModal / etc.
 */
export const elementColors: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};

export function elementColor(element?: string | null): string {
  return (
    elementColors[(element ?? "neutre").toLowerCase()] ?? elementColors.neutre
  );
}
