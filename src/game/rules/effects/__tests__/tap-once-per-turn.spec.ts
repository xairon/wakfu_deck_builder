import { describe, expect, it } from "vitest";
import { compileTapEffectText, tapPowers } from "@/game/rules";
import { compiledEffectSchema } from "@/schema/effects";
import { createMockAllyCard } from "tests/factories/card";

/**
 * Pouvoir à inclinaison + clause résiduelle « N'utilisez ce pouvoir qu'une
 * (seule) fois par tour ». INSIGHT : sur un pouvoir à inclinaison DE SOI,
 * l'inclinaison de la source est déjà le verrou once-per-turn (on incline pour
 * activer ; la carte ne se redresse qu'au tour suivant) ET la table n'autorise
 * l'activation que pendant le tour du contrôleur. La clause est donc REDONDANTE
 * → la retirer puis compiler le corps est FIDÈLE. Pour un effet NON tap (aucun
 * verrou), retirer la clause serait une approximation → on ne compile pas.
 */
describe("rules/effects — clause once-per-turn d'un pouvoir à inclinaison", () => {
  it("POSITIF (tap) : retire la clause et compile le corps en onTap", () => {
    const compiled = compileTapEffectText(
      "Piochez deux cartes. N'utilisez ce pouvoir qu'une seule fois par tour et uniquement pendant votre tour.",
      "Papi Tsubi",
      "Neutre",
      false,
      true, // requiresIncline → inclinaison de soi = verrou once-per-turn
    );
    expect(compiled).not.toBeNull();
    expect(compiled!.trigger).toBe("onTap");
    expect(compiled!.ops).toEqual([{ op: "draw", n: 2 }]);
    expect(compiledEffectSchema.safeParse(compiled).success).toBe(true);
  });

  it("POSITIF (tap) : variante « qu'une fois par tour » (sans « seule »)", () => {
    const compiled = compileTapEffectText(
      "Piochez une carte. N'utilisez ce pouvoir qu'une fois par tour.",
      "X",
      "Neutre",
      false,
      true,
    );
    expect(compiled?.ops).toEqual([{ op: "draw", n: 1 }]);
  });

  it("NÉGATIF (non tap) : même texte, sans inclinaison de soi → non compilé", () => {
    // Aucun verrou once-per-turn → la clause reste non comprise → manuel.
    const compiled = compileTapEffectText(
      "Piochez deux cartes. N'utilisez ce pouvoir qu'une seule fois par tour et uniquement pendant votre tour.",
      "Papi Tsubi",
      "Neutre",
      false,
      false, // requiresIncline absent
    );
    expect(compiled).toBeNull();
  });

  it("NÉGATIF : rider à CONDITION RÉELLE (« après un combat … ») non retiré", () => {
    // « après un combat dans lequel … » est une condition de timing réelle,
    // PAS la clause redondante → on ne strip pas → corps + clause non compris.
    const compiled = compileTapEffectText(
      "Redressez votre Héros. N'utilisez ce pouvoir qu'une seule fois par tour après un combat dans lequel votre Héros a été attaquant.",
      "Globule la Crapule",
      "Neutre",
      false,
      true,
    );
    expect(compiled).toBeNull();
  });

  it("NÉGATIF : rider « et uniquement si … dans le Monde » non retiré", () => {
    // Condition de zone non garantie par l'inclinaison → reste manuel.
    const compiled = compileTapEffectText(
      "Piochez une carte. N'utilisez ce pouvoir qu'une seule fois par tour et uniquement si cette carte est dans le Monde.",
      "X",
      "Neutre",
      false,
      true,
    );
    expect(compiled).toBeNull();
  });

  it("NÉGATIF : corps non automatisable (clause retirée mais corps inconnu)", () => {
    // Toad : « Copiez les effets du Sort … » n'a pas d'op → manuel malgré le strip.
    const compiled = compileTapEffectText(
      "Copiez les effets du Sort que vous venez de jouer. N'utilisez ce pouvoir qu'une seule fois par tour.",
      "Toad",
      "Neutre",
      false,
      true,
    );
    expect(compiled).toBeNull();
  });

  it("tapPowers : un Allié requiresIncline compile le corps (clause retirée)", () => {
    const card = createMockAllyCard({
      name: "Papi Tsubi",
      effects: [
        {
          description:
            "Piochez deux cartes. N'utilisez ce pouvoir qu'une seule fois par tour et uniquement pendant votre tour.",
          requiresIncline: true,
        },
      ],
    });
    const atoms = tapPowers(card);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].trigger).toBe("onTap");
    expect(atoms[0].ops).toEqual([{ op: "draw", n: 2 }]);
  });

  it("tapPowers : même carte SANS requiresIncline → pas de pouvoir auto", () => {
    const card = createMockAllyCard({
      name: "Papi Tsubi",
      effects: [
        {
          description:
            "Piochez deux cartes. N'utilisez ce pouvoir qu'une seule fois par tour et uniquement pendant votre tour.",
          requiresIncline: false,
        },
      ],
    });
    expect(tapPowers(card)).toEqual([]);
  });

  it("POSITIF : coût de sacrifice de soi + clause once-per-turn (redondante)", () => {
    // La source détruite ne peut pas réactiver → clause redondante (fidèle).
    const compiled = compileTapEffectText(
      "Détruisez la Cawotte : Piochez une carte. N'utilisez ce pouvoir qu'une seule fois par tour.",
      "Cawotte",
      "Neutre",
    );
    expect(compiled?.cost).toBe("sacrificeSelf");
    expect(compiled?.ops).toEqual([{ op: "draw", n: 1 }]);
  });
});
