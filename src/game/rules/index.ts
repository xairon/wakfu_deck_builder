/**
 * Moteur de règles R1 — barrel. Couche pure au-dessus de `src/game/engine` :
 * légalité, coûts en Ressources, combat, progression. Voir la spec
 * docs/superpowers/specs/2026-06-09-moteur-regles-r1-design.md.
 */
export * from "./types";
export * from "./cardAttrs";
export * from "./resources";
export * from "./legality";
export * from "./combat";
export * from "./progress";
export * from "./effects/keywords";
