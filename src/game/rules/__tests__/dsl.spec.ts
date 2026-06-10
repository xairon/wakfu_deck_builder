import { describe, expect, it } from "vitest";
import { arrivalEffects } from "@/game/rules";
import { createMockAllyCard } from "tests/factories/card";

function cardWith(name: string, ...descriptions: string[]) {
  return createMockAllyCard({
    name,
    effects: descriptions.map((description) => ({ description })),
  });
}

describe("rules/effects — DSL strict des effets d'apparition", () => {
  it("parse « Quand le Dofus Ivoire apparaît, gagnez 2 XP. »", () => {
    const atoms = arrivalEffects(
      cardWith("Dofus Ivoire", "Quand le Dofus Ivoire apparaît, gagnez 2 XP."),
    );
    expect(atoms).toHaveLength(1);
    expect(atoms[0].trigger).toBe("onArrive");
    expect(atoms[0].ops).toEqual([{ op: "gainXp", n: 2 }]);
  });

  it("parse les nombres en toutes lettres et les phrases multiples", () => {
    const atoms = arrivalEffects(
      cardWith(
        "Bouftou",
        "Quand Bouftou apparaît, piochez une carte. Gagnez 1 PV.",
      ),
    );
    expect(atoms).toHaveLength(1);
    expect(atoms[0].ops).toEqual([
      { op: "draw", n: 1 },
      { op: "heroGainPv", n: 1 },
    ]);
  });

  it("parse « Infligez N Dommages au Héros adverse »", () => {
    const atoms = arrivalEffects(
      cardWith(
        "Piou Rouge",
        "Quand le Piou Rouge apparaît, infligez 2 Dommages au Héros adverse.",
      ),
    );
    expect(atoms[0]?.ops).toEqual([{ op: "damageOppHero", n: 2 }]);
  });

  it("« vous pouvez » + op comprise → effet optionnel (infinitif accepté)", () => {
    const atoms = arrivalEffects(
      cardWith(
        "Tofu",
        "Quand le Tofu apparaît, vous pouvez piocher une carte.",
      ),
    );
    expect(atoms).toHaveLength(1);
    expect(atoms[0].optional).toBe(true);
    expect(atoms[0].ops).toEqual([{ op: "draw", n: 1 }]);
  });

  it("rejette les effets optionnels dont l'op n'est pas comprise", () => {
    const atoms = arrivalEffects(
      cardWith(
        "Crocodaille",
        "Quand le Crocodaille apparaît, vous pouvez détruire la Zone de votre choix.",
      ),
    );
    expect(atoms).toEqual([]);
  });

  it("préfère la forme compilée stockée dans les données", () => {
    const card = cardWith("Mystère", "Texte illisible par le DSL.");
    card.effects![0].compiled = {
      trigger: "onArrive",
      ops: [{ op: "gainXp", n: 1 }],
    };
    const atoms = arrivalEffects(card);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].ops).toEqual([{ op: "gainXp", n: 1 }]);
  });

  it("rejette quand le sujet n'est pas la carte elle-même", () => {
    const atoms = arrivalEffects(
      cardWith("Espion", "Quand un Allié adverse apparaît, piochez une carte."),
    );
    expect(atoms).toEqual([]);
  });

  it("rejette l'effet ENTIER si une seule phrase n'est pas comprise", () => {
    const atoms = arrivalEffects(
      cardWith(
        "Démon",
        "Quand le Démon apparaît, gagnez 2 XP. Détruisez un Allié.",
      ),
    );
    expect(atoms).toEqual([]);
  });

  it("ignore les autres déclencheurs (début de tour, texte libre)", () => {
    const atoms = arrivalEffects(
      cardWith("Bworky", "Au début de votre tour, piochez une carte."),
    );
    expect(atoms).toEqual([]);
  });
});
