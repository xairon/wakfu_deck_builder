/**
 * Tranche W11 — filtres de cible FIDÈLES sur les ops à cible existantes :
 *
 *  - orientation : « l'Allié incliné / dressé de votre choix » → seule la cible
 *    de l'orientation imprimée est éligible (inst.orientation).
 *  - equipType : « Détruisez l'Arme / l'Armure … de votre choix » → filtre sur
 *    card.equipmentType (Équipement uniquement).
 *  - exactLevel : « … de Niveau N » (exact, ≠ maxLevel ≤). Cible sans Niveau
 *    inéligible.
 *  - combatRole : « l'Allié ou Héros attaquant / bloqueur de votre choix » →
 *    rôle dans le combat EN COURS (state.combat) ; hors combat, aucune cible.
 *
 * Plus : compilation DSL des nouvelles formulations et négatifs (pas de
 * sur-capture).
 */
import { describe, it, expect } from "vitest";
import type { CombatState } from "@/game";
import type { Card } from "@/types/cards";
import { effectTargetIds } from "@/game/rules";
import {
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
} from "../../__tests__/harness";
import { createMockEquipmentCard } from "tests/factories/card";
import {
  compileActionEffectText,
  compileTapEffectText,
  compileEffectText,
} from "../dsl.ts";
import { setCombat } from "@/game";

/** Allié avec Famille(s) + Niveau explicites. */
function makeAllyFam(
  id: string,
  subTypes: string[],
  opts: { niveau?: number } = {},
): Card {
  const base = makeAlly(id, { niveau: opts.niveau });
  return { ...base, subTypes } as Card;
}

function action(text: string, name = "Test") {
  return compileActionEffectText(text, name)?.ops ?? null;
}

// ───────────────────────── orientation (targeting) ─────────────────────────

describe("W11 — filtre orientation (effectTargetIds)", () => {
  it("destroyTarget orientation:tapped ne liste que les cibles inclinées", () => {
    const f = fixture([makeAlly("a0"), makeAlly("a1")]);
    bringToMonde(f, "A", instId("A", 0), { tapped: true });
    bringToMonde(f, "A", instId("A", 1)); // dressé
    const ids = effectTargetIds(
      ctxOf(f),
      {
        op: "destroyTarget",
        what: "Allié",
        orientation: "tapped",
        zones: ["monde"],
      },
      "A",
    );
    expect(ids).toEqual([instId("A", 0)]);
  });

  it("damageTarget orientation:upright ne liste que les cibles dressées", () => {
    const f = fixture([makeAlly("a0"), makeAlly("a1")]);
    bringToMonde(f, "A", instId("A", 0), { tapped: true });
    bringToMonde(f, "A", instId("A", 1)); // dressé
    const ids = effectTargetIds(
      ctxOf(f),
      {
        op: "damageTarget",
        n: 2,
        element: "Feu",
        heroes: false,
        orientation: "upright",
        zones: ["monde"],
      },
      "A",
    );
    expect(ids).toEqual([instId("A", 1)]);
  });

  it("sans filtre orientation, les deux orientations sont éligibles", () => {
    const f = fixture([makeAlly("a0"), makeAlly("a1")]);
    bringToMonde(f, "A", instId("A", 0), { tapped: true });
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "destroyTarget", what: "Allié", zones: ["monde"] },
      "A",
    );
    expect(ids.sort()).toEqual([instId("A", 0), instId("A", 1)].sort());
  });
});

// ───────────────────────── equipType (targeting) ─────────────────────────

describe("W11 — filtre equipType (destroyTarget)", () => {
  it("ne liste que les Équipements du type demandé", () => {
    const arme = createMockEquipmentCard({ id: "arme", equipmentType: "Arme" });
    const armure = createMockEquipmentCard({
      id: "armure",
      equipmentType: "Armure",
    });
    const f = fixture([arme, armure]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(
      ctxOf(f),
      {
        op: "destroyTarget",
        what: "Équipement",
        equipType: "Arme",
        zones: ["monde"],
      },
      "A",
    );
    expect(ids).toEqual([instId("A", 0)]);
  });

  it("un non-Équipement est inéligible sous equipType", () => {
    const arme = createMockEquipmentCard({ id: "arme", equipmentType: "Arme" });
    const f = fixture([arme, makeAlly("a1")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(
      ctxOf(f),
      {
        op: "destroyTarget",
        what: "Équipement",
        equipType: "Armure",
        zones: ["monde"],
      },
      "A",
    );
    expect(ids).toEqual([]);
  });
});

// ───────────────────────── exactLevel (targeting) ─────────────────────────

describe("W11 — filtre exactLevel", () => {
  it("destroyTarget ne liste que la cible de Niveau EXACT", () => {
    const lvl1 = makeAllyFam("a0", ["Bouftou"], { niveau: 1 });
    const lvl2 = makeAllyFam("a1", ["Bouftou"], { niveau: 2 });
    const f = fixture([lvl1, lvl2]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "destroyTarget", what: "Allié", exactLevel: 1, zones: ["monde"] },
      "A",
    );
    expect(ids).toEqual([instId("A", 0)]);
  });

  it("une cible sans Niveau est inéligible sous exactLevel", () => {
    const withLvl = makeAllyFam("a0", ["Bouftou"], { niveau: 1 });
    const noLvl = makeAllyFam("a1", ["Bouftou"]);
    const stripped = {
      ...noLvl,
      stats: { ...noLvl.stats, niveau: undefined },
    } as Card;
    const f = fixture([withLvl, stripped]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "destroyTarget", what: "Allié", exactLevel: 1, zones: ["monde"] },
      "A",
    );
    expect(ids).toEqual([instId("A", 0)]);
  });
});

// ───────────────────────── combatRole (targeting) ─────────────────────────

/** Pose un combat : a0 = attaquant, b0 = bloqueur de a0. */
function withCombat(
  f: ReturnType<typeof fixture>,
  attacker: string,
  blocker: string,
) {
  const combat: CombatState = {
    attackerSeat: "A",
    step: "resolve",
    target: { kind: "havreSac", instanceId: "ci_B_002" },
    attackers: [attacker],
    blocks: { [blocker]: attacker },
    reactingSeat: null,
  };
  dispatch(f, setCombat("A", combat));
}

describe("W11 — filtre combatRole", () => {
  it("attacking ne liste que les attaquants du combat en cours", () => {
    const f = fixture([makeAlly("a0")], [makeAlly("b0")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    withCombat(f, instId("A", 0), instId("B", 0));
    const ids = effectTargetIds(
      ctxOf(f),
      {
        op: "tapTarget",
        combatRole: "attacking",
        zones: ["monde"],
      },
      "A",
    );
    expect(ids).toEqual([instId("A", 0)]);
  });

  it("blocking ne liste que les bloqueurs du combat en cours", () => {
    const f = fixture([makeAlly("a0")], [makeAlly("b0")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    withCombat(f, instId("A", 0), instId("B", 0));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "tapTarget", combatRole: "blocking", zones: ["monde"] },
      "A",
    );
    expect(ids).toEqual([instId("B", 0)]);
  });

  it("inCombat liste attaquants ET bloqueurs", () => {
    const f = fixture([makeAlly("a0")], [makeAlly("b0")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    withCombat(f, instId("A", 0), instId("B", 0));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "tapTarget", combatRole: "inCombat", zones: ["monde"] },
      "A",
    );
    expect(ids.sort()).toEqual([instId("A", 0), instId("B", 0)].sort());
  });

  it("HORS combat (state.combat null), aucune cible combatRole éligible", () => {
    const f = fixture([makeAlly("a0")], [makeAlly("b0")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    // pas de setCombat → combat null
    const ids = effectTargetIds(
      ctxOf(f),
      {
        op: "damageTarget",
        n: 1,
        element: "Feu",
        heroes: true,
        combatRole: "inCombat",
        zones: ["monde"],
      },
      "A",
    );
    expect(ids).toEqual([]);
  });
});

// ───────────────────────────── DSL ─────────────────────────────

describe("W11 — DSL orientation", () => {
  it("« Infligez 2 Dommages à l'Allié ou Héros incliné de votre choix » → damageTarget orientation tapped", () => {
    expect(
      action("Infligez 2 Dommages à l'Allié ou Héros incliné de votre choix."),
    ).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Neutre",
        heroes: true,
        orientation: "tapped",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« Redressez l'Allié incliné de votre choix » → untapTarget orientation tapped", () => {
    expect(action("Redressez l'Allié incliné de votre choix.")).toEqual([
      { op: "untapTarget", orientation: "tapped", zones: ["monde"] },
    ]);
  });

  it("« Inclinez l'Allé ou Héros dressé de votre choix » → tapTarget orientation upright", () => {
    expect(action("Inclinez l'Allié ou Héros dressé de votre choix.")).toEqual([
      {
        op: "tapTarget",
        heroes: true,
        orientation: "upright",
        zones: ["monde"],
      },
    ]);
  });
});

describe("W11 — DSL combatRole", () => {
  it("« Infligez 2 Dommages à l'Allié ou Héros attaquant ou bloqueur de votre choix » → inCombat", () => {
    expect(
      action(
        "Infligez 2 Dommages à l'Allié ou Héros attaquant ou bloqueur de votre choix.",
      ),
    ).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Neutre",
        heroes: true,
        combatRole: "inCombat",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« Infligez 2 Dommages à l'Allié attaquant ou bloqueur de votre choix » → heroes false", () => {
    expect(
      action(
        "Infligez 2 Dommages à l'Allié attaquant ou bloqueur de votre choix.",
      ),
    ).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Neutre",
        heroes: false,
        combatRole: "inCombat",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« Inclinez l'Allié ou Héros attaquant ou bloqueur de votre choix » → tapTarget inCombat", () => {
    expect(
      action("Inclinez l'Allié ou Héros attaquant ou bloqueur de votre choix."),
    ).toEqual([
      {
        op: "tapTarget",
        heroes: true,
        combatRole: "inCombat",
        zones: ["monde"],
      },
    ]);
  });
});

describe("W11 — DSL equipType (destroyTarget)", () => {
  it("« Détruisez l'Arme de votre choix » → equipType Arme", () => {
    expect(action("Détruisez l'Arme de votre choix.")).toEqual([
      {
        op: "destroyTarget",
        what: "Équipement",
        equipType: "Arme",
        zones: ["monde"],
      },
    ]);
  });

  it("« Détruisez l'Armure de votre choix » → equipType Armure", () => {
    expect(action("Détruisez l'Armure de votre choix.")).toEqual([
      {
        op: "destroyTarget",
        what: "Équipement",
        equipType: "Armure",
        zones: ["monde"],
      },
    ]);
  });
});

describe("W11 — DSL exactLevel (destroyTarget)", () => {
  it("« Détruisez l'Allié de Niveau 1 de votre choix » → exactLevel 1", () => {
    expect(action("Détruisez l'Allié de Niveau 1 de votre choix.")).toEqual([
      { op: "destroyTarget", what: "Allié", exactLevel: 1, zones: ["monde"] },
    ]);
  });

  it("ne confond pas avec maxLevel : « … de Niveau inférieur ou égal à 3 » → maxLevel", () => {
    expect(
      action(
        "Détruisez l'Allié de votre choix de Niveau inférieur ou égal à 3.",
      ),
    ).toEqual([
      { op: "destroyTarget", what: "Allié", maxLevel: 3, zones: ["monde"] },
    ]);
  });
});

describe("W11 — DSL négatifs (pas de sur-capture)", () => {
  it("« Détruisez l'Allié de votre choix » reste sans filtre", () => {
    expect(action("Détruisez l'Allié de votre choix.")).toEqual([
      { op: "destroyTarget", what: "Allié", zones: ["monde"] },
    ]);
  });

  it("forme à condition résiduelle reste non compilée (combatRole + suite)", () => {
    // « … retourne incliné dans le Monde » n'est PAS une op connue → manuel.
    expect(
      action(
        "L'Allié ou Héros attaquant ou bloqueur de votre choix retourne incliné dans le Monde.",
      ),
    ).toBeNull();
  });
});

// ──────────────────── harvest : cartes scriptées via DSL ────────────────────

describe("W11 — harvest (cartes débloquées par les filtres)", () => {
  it("Wymp : « inflige N Dommages à l'Allié ou Héros incliné » (élément source)", () => {
    // self-subject + orientation tapped ; élément résolu = source.
    const ops = compileTapEffectText(
      "Wymp inflige 3 Dommages à l'Allié ou Héros incliné de votre choix.",
      "Wymp",
      "Eau",
    )?.ops;
    expect(ops).toEqual([
      {
        op: "damageTarget",
        n: 3,
        element: "Eau",
        heroes: true,
        orientation: "tapped",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("Mot de Frayeur : « Inclinez l'Allié ou Héros attaquant ou bloqueur » (Action)", () => {
    expect(
      action("Inclinez l'Allié ou Héros attaquant ou bloqueur de votre choix."),
    ).toEqual([
      {
        op: "tapTarget",
        heroes: true,
        combatRole: "inCombat",
        zones: ["monde"],
      },
    ]);
  });

  it("Hache du Shodanwa : « Détruisez l'Arme de votre choix » (Action)", () => {
    expect(action("Détruisez l'Arme de votre choix.")).toEqual([
      {
        op: "destroyTarget",
        what: "Équipement",
        equipType: "Arme",
        zones: ["monde"],
      },
    ]);
  });

  it("Cervelle de Iop : destroy exactLevel + draw (deux phrases)", () => {
    expect(
      action(
        "Détruisez l'Allié de Niveau 1 de votre choix. Piochez une carte.",
      ),
    ).toEqual([
      { op: "destroyTarget", what: "Allié", exactLevel: 1, zones: ["monde"] },
      { op: "draw", n: 1 },
    ]);
  });

  it("onArrive self-nommé + orientation (« Quand X apparaît, X inflige … à l'Allié incliné »)", () => {
    expect(
      compileEffectText(
        "Quand le Corbeau Noir apparaît, le Corbeau Noir inflige 2 Dommages à l'Allié ou Héros incliné de votre choix.",
        "Le Corbeau Noir",
        "Air",
      )?.ops,
    ).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Air",
        heroes: true,
        orientation: "tapped",
        zones: ["monde", "havreSac"],
      },
    ]);
  });
});
