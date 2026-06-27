import { describe, expect, it } from "vitest";
import {
  arrivalEffects,
  compileActionEffectText,
  compileStaticEffectText,
  playEffects,
  printedEffects,
  tapPowers,
  turnStartEffects,
} from "@/game/rules";
import { CARD_SCRIPTS } from "@/game/rules/effects/cardScripts";
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

  it("compile le coût de sacrifice « Détruisez [cette carte] : effet »", () => {
    const card = cardWith(
      "Cawotte",
      "Détruisez la Cawotte : Le Héros de votre choix regagne 3 PV.",
    );
    card.effects![0].requiresIncline = true;
    const atoms = tapPowers(card);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].cost).toBe("sacrificeSelf");
    expect(atoms[0].ops).toEqual([{ op: "healHeroTarget", n: 3 }]);
    // coût dont le sujet n'est pas la carte → rejet (pas un self-sacrifice)
    const other = cardWith(
      "Temple",
      "Détruisez un de vos Monstres : Piochez une carte.",
    );
    other.effects![0].requiresIncline = true;
    expect(tapPowers(other)).toEqual([]);
  });

  it("parse les buffs de Force : cible au choix et auto-référent", () => {
    const target = cardWith(
      "Kabrok",
      "Quand Kabrok apparaît, l'Allié ou Héros de votre choix gagne +1 en Force jusqu'à la fin du tour.",
    );
    expect(arrivalEffects(target)[0]?.ops).toEqual([
      {
        op: "buffForceTarget",
        n: 1,
        heroes: true,
        zones: ["monde", "havreSac"],
      },
    ]);
    const self = cardWith(
      "Mama Bwork",
      "La Mama Bwork gagne +1 en Force jusqu'à la fin du tour.",
    );
    self.effects![0].requiresIncline = true;
    expect(tapPowers(self)[0]?.ops).toEqual([{ op: "buffForceSelf", n: 1 }]);
  });

  it("parse les soins : « votre Héros regagne N PV » et la cible au choix", () => {
    const self = cardWith(
      "Fée",
      "Quand la Fée apparaît, votre Héros regagne 2 PV.",
    );
    expect(arrivalEffects(self)[0]?.ops).toEqual([{ op: "heroGainPv", n: 2 }]);
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

  it("parse recyclage, défausse et phrases composées « X, puis Y »", () => {
    const smarmot = cardWith(
      "Smarmot",
      "Détruisez le Smarmot : Piochez une carte, puis défaussez-vous d'une carte.",
    );
    smarmot.effects![0].requiresIncline = true;
    const atoms = tapPowers(smarmot);
    expect(atoms[0]?.cost).toBe("sacrificeSelf");
    expect(atoms[0]?.ops).toEqual([
      { op: "draw", n: 1 },
      { op: "discardFromHand", n: 1 },
    ]);
    const rec = cardWith(
      "Anneau",
      "Quand l'Anneau apparaît, recyclez une carte de votre Défausse.",
    );
    expect(arrivalEffects(rec)[0]?.ops).toEqual([
      { op: "recycleFromDiscard", n: 1 },
    ]);
  });

  it("parse « Cherchez un [type] dans votre Pioche … puis mélangez »", () => {
    const toHand = cardWith(
      "Crail",
      "Quand Crail apparaît, cherchez un Dofus dans votre Pioche, révélez-le et prenez-le en main, puis mélangez votre Pioche.",
    );
    expect(arrivalEffects(toHand)[0]?.ops).toEqual([
      { op: "searchDeck", what: "Dofus", dest: "main" },
      { op: "shuffleDeck" },
    ]);
    const toPlay = cardWith(
      "Quête",
      "Quand la Quête apparaît, cherchez une Salle dans votre Pioche et mettez-la en jeu, puis mélangez votre Pioche.",
    );
    expect(arrivalEffects(toPlay)[0]?.ops).toEqual([
      { op: "searchDeck", what: "Salle", dest: "monde" },
      { op: "shuffleDeck" },
    ]);
    // qualificatif simple (« Allié Chevalier ») → compilé avec filtre famille
    const qualified = cardWith(
      "Château",
      "Quand le Château apparaît, cherchez un Allié Chevalier dans votre Pioche, révélez-le et prenez-le en main, puis mélangez votre Pioche.",
    );
    expect(arrivalEffects(qualified)[0]?.ops[0]).toEqual({
      op: "searchDeck",
      what: "Allié",
      sub: "chevalier",
      dest: "main",
    });
  });

  it("compile l'effet d'une carte Action (onPlay), pas celui des autres types", () => {
    const action = cardWith(
      "À la poursuite d'Ogrest",
      "Cherchez un Dofus dans votre Pioche et mettez-le en jeu, puis mélangez votre Pioche.",
    );
    (action as { mainType: string }).mainType = "Action";
    const atoms = playEffects(action);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].trigger).toBe("onPlay");
    expect(atoms[0].ops).toEqual([
      { op: "searchDeck", what: "Dofus", dest: "monde" },
      { op: "shuffleDeck" },
    ]);
    // un Allié avec un texte sans préfixe ne compile PAS en onPlay
    const ally = cardWith("Bouftou", "Piochez une carte.");
    expect(playEffects(ally)).toEqual([]);
    // une Action avec restriction non comprise → rejet strict
    const cond = cardWith(
      "Quête",
      "Piochez une carte. Ne jouez cette carte que si votre Héros a subi des Dommages.",
    );
    (cond as { mainType: string }).mainType = "Action";
    expect(playEffects(cond)).toEqual([]);
  });

  it("ignore les autres déclencheurs (début de tour, texte libre)", () => {
    const atoms = arrivalEffects(
      cardWith("Bworky", "Au début de votre tour, piochez une carte."),
    );
    expect(atoms).toEqual([]);
  });

  it("parse les recherches qualifiées (famille, niveau max) et rejette le reste", () => {
    const fam = arrivalEffects(
      cardWith(
        "Tanière",
        "Quand la Tanière apparaît, cherchez un Allié Wabbit dans votre Pioche, révélez-le et prenez-le en main, puis mélangez votre Pioche.",
      ),
    );
    expect(fam[0]?.ops[0]).toEqual({
      op: "searchDeck",
      what: "Allié",
      sub: "wabbit",
      dest: "main",
    });
    const lvl = arrivalEffects(
      cardWith(
        "Émissaire",
        "Quand l'Émissaire apparaît, cherchez un Allié Chevalier de Niveau inférieur ou égal à 3 dans votre Pioche et mettez-le en jeu, puis mélangez votre Pioche.",
      ),
    );
    expect(lvl[0]?.ops[0]).toEqual({
      op: "searchDeck",
      what: "Allié",
      sub: "chevalier",
      maxLevel: 3,
      dest: "monde",
    });
    // qualificatifs complexes (« ou non Unique », « portant le même nom ») → rejet
    const complex = arrivalEffects(
      cardWith(
        "Salle de Garde",
        "Quand la Salle de Garde apparaît, cherchez un Allié ou non Unique dans votre Pioche, révélez-le et prenez-le en main, puis mélangez votre Pioche.",
      ),
    );
    expect(complex).toEqual([]);
  });

  it("« Il apparaît incliné. » marque la recherche-mise-en-jeu (malgré le mélange)", () => {
    const tapped = playEffects(
      Object.assign(
        cardWith(
          "Émissaire",
          "Cherchez un Allié Chevalier de Niveau inférieur ou égal à 3 dans votre Pioche et mettez-le en jeu, puis mélangez votre Pioche. Il apparaît incliné.",
        ),
        { mainType: "Action" },
      ),
    );
    expect(tapped[0]?.ops).toEqual([
      {
        op: "searchDeck",
        what: "Allié",
        sub: "chevalier",
        maxLevel: 3,
        tapped: true,
        dest: "monde",
      },
      { op: "shuffleDeck" },
    ]);
    // sans recherche-mise-en-jeu en amont → rejet
    const orphan = playEffects(
      Object.assign(
        cardWith("Sort", "Piochez une carte. Il apparaît incliné."),
        { mainType: "Action" },
      ),
    );
    expect(orphan).toEqual([]);
  });

  it("compile « Au début de votre tour, X ou détruisez [self] » (entretien)", () => {
    const upkeep = cardWith(
      "Cimetière d'Amakna",
      "Au début de votre tour, recyclez une carte ou détruisez le Cimetière d'Amakna.",
    );
    const atoms = turnStartEffects(upkeep);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].trigger).toBe("onTurnStart");
    expect(atoms[0].orElse).toBe("destroySelf");
    expect(atoms[0].ops).toEqual([{ op: "recycleFromDiscard", n: 1 }]);
    // perte de PV comme coût d'entretien
    const dungeon = cardWith(
      "Donjon des Craqueleurs",
      "Au début de votre tour, votre Héros perd 2 PV ou détruisez le Donjon des Craqueleurs.",
    );
    expect(turnStartEffects(dungeon)[0]?.ops).toEqual([
      { op: "heroLosePv", n: 2 },
    ]);
    // sujet de la branche destruction ≠ la carte → rejet
    const wrong = cardWith(
      "Tour",
      "Au début de votre tour, recyclez une carte ou détruisez le Bworky.",
    );
    expect(turnStartEffects(wrong)).toEqual([]);
    // effet direct sans alternative
    const direct = cardWith(
      "Fontaine",
      "Au début de votre tour, piochez une carte.",
    );
    expect(turnStartEffects(direct)[0]?.ops).toEqual([{ op: "draw", n: 1 }]);
    expect(turnStartEffects(direct)[0]?.orElse).toBeUndefined();
    // perte de PA temporaire comme coût d'entretien (Croum)
    const croum = cardWith(
      "Croum",
      "Au début de votre tour, perdez 1 PA jusqu'à la fin du tour ou détruisez le Croum.",
    );
    const croumAtoms = turnStartEffects(croum);
    expect(croumAtoms[0]?.orElse).toBe("destroySelf");
    expect(croumAtoms[0]?.ops).toEqual([
      { op: "loseStatTurn", stat: "pa", n: 1 },
    ]);
  });
});

describe("rules/effects — effets imprimés vs notes de règles (kind)", () => {
  it("devrait exclure les rulings/erratas et les descriptions vides du comptage", () => {
    const card = createMockAllyCard({
      name: "Agression",
      effects: [
        { description: "Inclinez l'un de vos Alliés : il inflige sa Force." },
        {
          description: "L'effet prend en compte tous les modificateurs…",
          kind: "ruling",
        },
        {
          description: "Cette carte a reçu un errata officiel : Carte Unique.",
          kind: "errata",
        },
        { description: "   " },
      ],
    });
    expect(printedEffects(card)).toHaveLength(1);
    expect(printedEffects(null)).toEqual([]);
  });

  it("devrait ignorer un effet kind même si son texte est compilable", () => {
    const card = createMockAllyCard({
      name: "Piège",
      effects: [
        {
          description: "Au début de votre tour, piochez une carte.",
          kind: "ruling",
        },
      ],
    });
    expect(turnStartEffects(card)).toHaveLength(0);
    expect(arrivalEffects(card)).toHaveLength(0);
  });

  it("devrait compiler les 5 formes de pouvoirs continus des starters (textes réels)", () => {
    expect(
      compileStaticEffectText(
        "La force du Vrombyx est toujours égale au nombre de vos cartes en main.",
        "Vrombyx",
      ),
    ).toEqual({
      trigger: "static",
      static: { kind: "forceEqualsHandSize" },
      ops: [],
    });
    expect(
      compileStaticEffectText(
        "Tant que le Chef de Guerre Bouftou est dans le Monde, vos autres Alliés Bouftous dans le Monde gagnent +1 en Force.",
        "Chef de Guerre Bouftou",
      ),
    ).toEqual({
      trigger: "static",
      static: { kind: "forceAura", n: 1, sub: "bouftou" },
      ops: [],
    });
    expect(
      compileStaticEffectText(
        "Tant qu'il bloque, le Maître Bolet gagne +2 en Force.",
        "Maître Bolet",
      ),
    ).toEqual({
      trigger: "static",
      static: { kind: "forceWhileBlocking", n: 2 },
      ops: [],
    });
    expect(
      compileStaticEffectText(
        "Jicé Aouaire ne peut pas bloquer.",
        "Jicé Aouaire",
      ),
    ).toEqual({ trigger: "static", static: { kind: "cannotBlock" }, ops: [] });
  });

  it("devrait compiler la réduction de Dommages de Poum recto (1) et verso (2)", () => {
    expect(
      compileStaticEffectText(
        "Tant que Poum Ondacié est attaquant, bloqueur ou cible d'une attaque, tous les Dommages sur le point de lui être infligés sont réduits de 1.",
        "Poum Ondacié",
      ),
    ).toEqual({
      trigger: "static",
      static: { kind: "combatDamageReduction", n: 1 },
      ops: [],
    });
    expect(
      compileStaticEffectText(
        "Tant que Poum Ondacié est attaquant, bloqueur ou cible d'une attaque, tous les Dommages sur le point de lui être infligés sont réduits de 2.",
        "Poum Ondacié",
      ),
    ).toEqual({
      trigger: "static",
      static: { kind: "combatDamageReduction", n: 2 },
      ops: [],
    });
  });

  it("grammaire statique STRICTE : sujet étranger ou texte en trop → rejet", () => {
    // le sujet n'est pas la carte elle-même
    expect(
      compileStaticEffectText(
        "Le Bouftou ne peut pas bloquer.",
        "Jicé Aouaire",
      ),
    ).toBeNull();
    // une phrase de plus que la forme connue → rien ne compile
    expect(
      compileStaticEffectText(
        "Tant que le Chef de Guerre Bouftou est dans le Monde, vos autres Alliés Bouftous dans le Monde gagnent +1 en Force. Piochez une carte.",
        "Chef de Guerre Bouftou",
      ),
    ).toBeNull();
    // verbe inconnu (« attaquer ») : pas une forme couverte
    expect(
      compileStaticEffectText(
        "Jicé Aouaire ne peut pas attaquer.",
        "Jicé Aouaire",
      ),
    ).toBeNull();
  });

  it("le registre scripte l'entretien des Forêts d'Astrub (élément + arrivée inclinée)", () => {
    const entries = CARD_SCRIPTS["forets-d-astrub-incarnam"];
    expect(entries[0]).toEqual({
      trigger: "onTurnStart",
      orElse: "destroySelf",
      ops: [{ op: "recycleFromDiscard", n: 1, element: "Terre" }],
    });
    expect(entries[1]).toEqual({
      trigger: "onArrive",
      ops: [{ op: "tapSelf" }],
    });
  });
});

describe("rules/effects — grammaire des Actions (lot C : Trêve, Stratégie)", () => {
  it("compile la Trêve en globalDamageShield (texte réel)", () => {
    expect(
      compileActionEffectText(
        "Jusqu'au début de votre prochain tour, tous les Dommages sont réduits à 0.",
        "Trêve",
      ),
    ).toEqual({ trigger: "onPlay", ops: [{ op: "globalDamageShield" }] });
  });

  it("compile la Stratégie de Groupe en buffForceAlliesMondeTurn (heroLevel)", () => {
    expect(
      compileActionEffectText(
        "Vos Alliés dans le Monde gagnent un bonus de Force égal au Niveau de votre Héros jusqu'à la fin du tour.",
        "Stratégie de Groupe",
      ),
    ).toEqual({
      trigger: "onPlay",
      ops: [{ op: "buffForceAlliesMondeTurn", n: "heroLevel" }],
    });
  });

  it("grammaire d'Action STRICTE : une valeur hors forme connue → pas de compilation", () => {
    // « réduits à 1 » (et non 0) ne correspond pas à la forme Trêve
    expect(
      compileActionEffectText(
        "Jusqu'au début de votre prochain tour, tous les Dommages sont réduits à 1.",
        "Pseudo-Trêve",
      ),
    ).toBeNull();
  });
});

describe("rules/effects — forceAura : variantes sans Famille / avec Héros", () => {
  it("famille → forceAura { n, sub } (cas existant inchangé)", () => {
    expect(
      compileStaticEffectText(
        "Tant que le Chef de Guerre Bouftou est dans le Monde, vos autres Alliés Bouftous dans le Monde gagnent +1 en Force.",
        "Chef de Guerre Bouftou",
      ),
    ).toEqual({
      trigger: "static",
      static: { kind: "forceAura", n: 1, sub: "bouftou" },
      ops: [],
    });
  });

  it("sans Famille → forceAura { n } (sub omis), « tous » optionnel", () => {
    expect(
      compileStaticEffectText(
        "Tant que le Totem est dans le Monde, tous vos autres Alliés gagnent +2 en Force.",
        "Totem",
      ),
    ).toEqual({
      trigger: "static",
      static: { kind: "forceAura", n: 2 },
      ops: [],
    });
    // sans « tous », sans « dans le Monde » sur les bénéficiaires
    expect(
      compileStaticEffectText(
        "Tant que le Totem est dans le Monde, vos autres Alliés gagnent +1 en Force.",
        "Totem",
      ),
    ).toEqual({
      trigger: "static",
      static: { kind: "forceAura", n: 1 },
      ops: [],
    });
  });

  it("« et/ou Héros » → forceAura { heroes: true } (avec ou sans Famille)", () => {
    expect(
      compileStaticEffectText(
        "Tant que le Totem est dans le Monde, tous vos autres Alliés et Héros gagnent +1 en Force.",
        "Totem",
      ),
    ).toEqual({
      trigger: "static",
      static: { kind: "forceAura", n: 1, heroes: true },
      ops: [],
    });
    expect(
      compileStaticEffectText(
        "Tant que le Totem est dans le Monde, vos autres Alliés Bouftous ou Héros gagnent +1 en Force.",
        "Totem",
      ),
    ).toEqual({
      trigger: "static",
      static: { kind: "forceAura", n: 1, sub: "bouftou", heroes: true },
      ops: [],
    });
  });

  it("NÉGATIF : une clause résiduelle (débuff adverse, Abraknyde) → pas forceAura", () => {
    // Abraknyde Ancestral : la moitié « +1 Force » serait fidèle, mais le texte
    // ENTIER inclut un débuff adverse non modélisé → on n'approxime pas.
    expect(
      compileStaticEffectText(
        "Tant que l'Abraknyde Ancestral est dans le Monde, tous vos autres Alliés et Héros gagnent +1 en Force et la Force de tous les Alliés et Héros adverses est réduite de 1, jusqu'à un minimun de 1.",
        "Abraknyde Ancestral",
      ),
    ).toBeNull();
  });

  it("NÉGATIF : une condition « tant qu'il bloque … gagnent » ne compile pas en forceAura", () => {
    expect(
      compileStaticEffectText(
        "Tant qu'il bloque, vos autres Alliés gagnent +1 en Force.",
        "Pseudo-Bloqueur",
      ),
    ).toBeNull();
  });

  it("NÉGATIF : « jusqu'à la fin du tour » (effet temporaire, pas continu) → pas forceAura", () => {
    expect(
      compileStaticEffectText(
        "Tant que le Totem est dans le Monde, vos autres Alliés gagnent +1 en Force jusqu'à la fin du tour.",
        "Totem",
      ),
    ).toBeNull();
  });
});
