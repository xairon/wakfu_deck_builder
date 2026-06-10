import { describe, expect, it } from "vitest";
import { arrivalEffects, tapPowers } from "@/game/rules";
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
        "Crail",
        "Quand Crail apparaît, vous pouvez chercher un Dofus dans votre Pioche.",
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

  it("parse les ops à cible : détruire / infliger des Dommages", () => {
    const destroy = arrivalEffects(
      cardWith(
        "Crocodaille",
        "Quand le Crocodaille apparaît, vous pouvez détruire la Zone de votre choix.",
      ),
    );
    expect(destroy).toHaveLength(1);
    expect(destroy[0].optional).toBe(true);
    expect(destroy[0].ops).toEqual([
      { op: "destroyTarget", what: "Zone", zones: ["monde"] },
    ]);

    const both = arrivalEffects(
      cardWith(
        "Ébène",
        "Quand Ébène apparaît, détruisez l'Allié de votre choix dans le Monde ou dans un Havre Sac.",
      ),
    );
    expect(both[0]?.ops).toEqual([
      { op: "destroyTarget", what: "Allié", zones: ["monde", "havreSac"] },
    ]);

    const dmg = arrivalEffects(
      cardWith(
        "Piou",
        "Quand le Piou apparaît, infligez 2 Dommages à l'Allié de votre choix.",
      ),
    );
    expect(dmg[0]?.ops).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Neutre",
        heroes: false,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("compile un pouvoir à inclinaison auto-référent (Allié ou Héros, zones)", () => {
    const card = cardWith(
      "Abraknyde Sombre",
      "L'Abraknyde Sombre inflige 2 Dommages à l'Allié ou Héros de votre choix dans le Monde ou dans son Havre Sac.",
    );
    card.effects![0].requiresIncline = true;
    const atoms = tapPowers(card);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].trigger).toBe("onTap");
    expect(atoms[0].ops).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Neutre",
        heroes: true,
        zones: ["monde", "havreSac"],
      },
    ]);
    // un pouvoir à inclinaison n'est PAS un effet d'apparition
    expect(arrivalEffects(card)).toEqual([]);
  });

  it("rejette un pouvoir à inclinaison conditionnel ou au sujet étranger", () => {
    const cond = cardWith(
      "Bwork Archer",
      "Le Bwork Archer inflige 1 Dommage à l'Allié de votre choix qui vient de subir des Dommages.",
    );
    cond.effects![0].requiresIncline = true;
    expect(tapPowers(cond)).toEqual([]);
    const foreign = cardWith(
      "Espion",
      "Le Bouftou inflige 1 Dommage à l'Allié de votre choix.",
    );
    foreign.effects![0].requiresIncline = true;
    expect(tapPowers(foreign)).toEqual([]);
  });

  it("parse perte de PV (soi / adverse) et gain de Résistance", () => {
    const atoms = arrivalEffects(
      cardWith(
        "Sacrieur",
        "Quand le Sacrieur apparaît, votre Héros perd 2 PV. Le Héros adverse perd 1 PV. Gagnez 3 Résistance.",
      ),
    );
    expect(atoms[0]?.ops).toEqual([
      { op: "heroLosePv", n: 2 },
      { op: "damageOppHero", n: 1 },
      { op: "havreSacGainResistance", n: 3 },
    ]);
  });

  it("rejette un optionnel multi-phrases (portée du « vous pouvez » ambiguë)", () => {
    const atoms = arrivalEffects(
      cardWith(
        "Dofus Ébène",
        "Quand le Dofus Ébène apparaît, vous pouvez détruire l'Allié de votre choix dans le Monde. Gagnez 2 XP.",
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
