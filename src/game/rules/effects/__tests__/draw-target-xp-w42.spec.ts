/**
 * Vague W42 (deck-driven, starter Incarnam Prospection) — MAGNITUDE DYNAMIQUE À
 * CIBLE : « Piochez un nombre de cartes égal à la valeur d'XP de l'Allié [dans
 * le Monde] de votre choix » → op de ciblage drawTargetXp (choisir un Allié en
 * jeu, piocher sa valeur d'XP, card.experience via xpValue).
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText } from "@/game/rules";

const ops = (t: string) =>
  compileActionEffectText(t, "Prospection", "Neutre")?.ops ?? null;

describe("DSL — drawTargetXp (Prospection)", () => {
  it("« … égal à la valeur d'XP de l'Allié dans le Monde de votre choix » → drawTargetXp", () => {
    expect(
      ops(
        "Piochez un nombre de cartes égal à la valeur d'XP de l'Allié dans le Monde de votre choix.",
      ),
    ).toEqual([{ op: "drawTargetXp", zones: ["monde"] }]);
  });

  it("variante sans « dans le Monde » → drawTargetXp (défaut Monde)", () => {
    expect(
      ops(
        "Piochez un nombre de cartes égal à la valeur d'XP de l'Allié de votre choix.",
      ),
    ).toEqual([{ op: "drawTargetXp", zones: ["monde"] }]);
  });
});
