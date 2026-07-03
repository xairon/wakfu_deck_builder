/**
 * Vague W56 (deck-driven, starters Incarnam) — CHOIX D'ÉLÉMENT (chooseOne
 * N-aire) : Tirlangue Portey (verso) « inflige 3 Dommages Air, Terre, Feu, Eau
 * ou Neutre à l'Allié ou Héros de votre choix » et Temple Féca « gagne
 * Résistance 1 dans l'élément de votre choix » (icône récupérée du raw).
 *
 * Volets :
 *  1) DSL — une branche chooseOne PAR Élément listé ; damageTarget des branches
 *     porte `explicitElement` (l'Élément CHOISI ne doit pas être écrasé par
 *     celui de la source vivante — ferme le latent W50).
 *  2) tapPowers FACE-AWARE — le pouvoir du VERSO d'un Héros n'est lisible que
 *     face verso (les effets top-level d'un Héros ne couvrent que le recto).
 */
import { describe, it, expect } from "vitest";
import { compileTapEffectText, tapPowers } from "@/game/rules";
import { createMockHeroCard } from "tests/factories/card";

describe("DSL — Dommages à Élément au choix (Tirlangue Portey verso)", () => {
  it("« inflige 3 Dommages Air, Terre, Feu, Eau ou Neutre … » → chooseOne 5 branches", () => {
    const c = compileTapEffectText(
      "Tirlangue Portey inflige 3 Dommages Air, Terre, Feu, Eau ou Neutre à l'Allié ou Héros de votre choix.",
      "Tirlangue Portey",
      "Air",
      false,
      true,
    );
    expect(c?.trigger).toBe("onTap");
    const op = c?.ops[0];
    expect(op?.op).toBe("chooseOne");
    const options = (op as { options: { label: string; ops: unknown[] }[] })
      .options;
    expect(options.map((o) => o.label)).toEqual([
      "Air",
      "Terre",
      "Feu",
      "Eau",
      "Neutre",
    ]);
    // chaque branche = damageTarget de l'Élément CHOISI, marqué explicite
    expect(options[2].ops[0]).toEqual({
      op: "damageTarget",
      n: 3,
      element: "Feu",
      explicitElement: true,
      heroes: true,
      zones: ["monde", "havreSac"],
    });
  });

  it("RÉGRESSION : la forme MONO-élément reste un damageTarget simple", () => {
    const c = compileTapEffectText(
      "Tirlangue Portey inflige 2 Dommages à l'Allié ou Héros de votre choix.",
      "Tirlangue Portey",
      "Air",
      false,
      true,
    );
    expect(c?.ops[0]).toMatchObject({ op: "damageTarget", n: 2 });
  });
});

describe("DSL — Résistance à Élément au choix (Temple Féca)", () => {
  it("« gagne Résistance 1 dans l'élément de votre choix … » → chooseOne 5 branches", () => {
    const c = compileTapEffectText(
      "L'Allié ou Héros de votre choix gagne Résistance 1 dans l'élément de votre choix jusqu'à la fin du tour.",
      "Temple Féca",
      "Neutre",
      false,
      true,
    );
    const op = c?.ops[0] as {
      op: string;
      options: { label: string; ops: unknown[] }[];
    };
    expect(op?.op).toBe("chooseOne");
    expect(op.options).toHaveLength(5);
    expect(op.options[1].ops[0]).toEqual({
      op: "grantResistanceTarget",
      resist: [{ element: "Eau", n: 1 }],
      heroes: true,
      zones: ["monde", "havreSac"],
    });
  });

  it("RÉGRESSION : Résistance à Éléments IMPRIMÉS inchangée", () => {
    const c = compileTapEffectText(
      "L'Allié de votre choix gagne Résistance 1 (air) jusqu'à la fin du tour.",
      "X",
      "Neutre",
      false,
      true,
    );
    expect(c?.ops[0]).toMatchObject({
      op: "grantResistanceTarget",
      resist: [{ element: "air", n: 1 }],
    });
  });
});

describe("tapPowers — face-aware (pouvoir du verso d'un Héros)", () => {
  const HERO = createMockHeroCard({
    id: "hero-faces",
    name: "Tirlangue Test",
    recto: {
      stats: { pv: 16, pa: 6, pm: 3 },
      keywords: [],
      effects: [
        {
          description: "Piochez une carte.",
          requiresIncline: true,
          compiled: { trigger: "onTap", ops: [{ op: "draw", n: 1 }] },
        },
      ],
    },
    verso: {
      stats: { pv: 20, pa: 7, pm: 3 },
      keywords: [],
      effects: [
        {
          description: "Piochez deux cartes.",
          requiresIncline: true,
          compiled: { trigger: "onTap", ops: [{ op: "draw", n: 2 }] },
        },
      ],
    },
  });

  it("recto → pouvoir du recto ; verso → pouvoir du verso", () => {
    expect(tapPowers(HERO, "recto")[0]?.ops).toEqual([{ op: "draw", n: 1 }]);
    expect(tapPowers(HERO, "verso")[0]?.ops).toEqual([{ op: "draw", n: 2 }]);
    // défaut = recto (rétro-compatible)
    expect(tapPowers(HERO)[0]?.ops).toEqual([{ op: "draw", n: 1 }]);
  });
});
