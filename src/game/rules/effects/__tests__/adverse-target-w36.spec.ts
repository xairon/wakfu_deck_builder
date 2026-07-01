/**
 * Vague W36 — filtre de CONTRÔLEUR « adverse » sur damageTarget (levier
 * transverse : ~99 effets uncovered mentionnent « adverse »). L'infra
 * `controller` existe déjà dans effectTargetIds (destroy/tap/banish…) ; on
 * l'étend à `damageTarget` (schéma + liste targeting) et on parse « adverse »
 * dans le DSL. Couvre le DSL (« à l'Allié [ou Héros] adverse de votre choix »
 * → controller:opponent) et l'éligibilité (seules les créatures adverses).
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText, effectTargetIds } from "@/game/rules";
import {
  bringToMonde,
  ctxOf,
  fixture,
  instId,
  makeAlly,
} from "../../__tests__/harness";

const ops = (t: string) =>
  compileActionEffectText(t, "Test", "Feu")?.ops ?? null;

describe("DSL — damageTarget filtre « adverse » (controller)", () => {
  it("« à l'Allié ou Héros adverse de votre choix » → controller opponent", () => {
    expect(
      ops("Infligez 2 Dommages à l'Allié ou Héros adverse de votre choix."),
    ).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Feu",
        heroes: true,
        controller: "opponent",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« à l'Allié adverse de votre choix » (adverse capté comme famille) → controller opponent, sans sub", () => {
    expect(ops("Infligez 1 Dommage à l'Allié adverse de votre choix.")).toEqual(
      [
        {
          op: "damageTarget",
          n: 1,
          element: "Feu",
          heroes: false,
          controller: "opponent",
          zones: ["monde", "havreSac"],
        },
      ],
    );
  });

  it("« à l'Allié Bouftou adverse de votre choix » → sub famille + controller opponent", () => {
    expect(
      ops("Infligez 1 Dommage à l'Allié Bouftou adverse de votre choix."),
    ).toEqual([
      {
        op: "damageTarget",
        n: 1,
        element: "Feu",
        heroes: false,
        sub: "bouftou",
        controller: "opponent",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("sans « adverse » : cible libre (pas de controller) — inchangé", () => {
    expect(
      ops("Infligez 2 Dommages à l'Allié ou Héros de votre choix."),
    ).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Feu",
        heroes: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });
});

describe("effectTargetIds — damageTarget controller opponent", () => {
  it("ne rend éligibles que les créatures de l'adversaire", () => {
    const f = fixture([makeAlly("mien")], [makeAlly("sien")]);
    bringToMonde(f, "A", instId("A", 0)); // Allié de A
    bringToMonde(f, "B", instId("B", 0)); // Allié de B (adverse de A)
    const op = {
      op: "damageTarget" as const,
      n: 1,
      element: "Feu",
      heroes: true,
      controller: "opponent" as const,
      zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
    };
    const eligible = effectTargetIds(ctxOf(f), op, "A");
    expect(eligible).toContain(instId("B", 0)); // adverse → éligible
    expect(eligible).not.toContain(instId("A", 0)); // le sien → exclu
  });
});
