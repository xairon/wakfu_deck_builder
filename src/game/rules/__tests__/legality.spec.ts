import { describe, expect, it } from "vitest";
import type { Card } from "@/types/cards";
import {
  eligibleAttackers,
  eligibleBlockers,
  eligibleTargets,
  havreSacHasRoom,
  havreSacOccupancy,
  whyCannotDeclareAttack,
  whyCannotPlay,
} from "../legality";
import {
  HERO_A,
  HERO_B,
  SAC_B,
  bringToHand,
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
  setTurn,
} from "./harness";
import { move } from "@/game";
import { createMockHavreSacCard } from "tests/factories/card";

describe("rules/legality — jouer une carte", () => {
  function handFixture(card = makeAlly("c0", { niveau: 1, element: "Feu" })) {
    const f = fixture([card]);
    bringToHand(f, "A", instId("A", 0));
    return f;
  }

  it("autorise un coup légal (tour ≥ 2, phase principale, coût payable)", () => {
    const f = handFixture();
    setTurn(f, "A", 3);
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toBeNull();
  });

  it("réaction : autorise à jouer hors de son tour quand reaction=true (706)", () => {
    const f = handFixture();
    setTurn(f, "B", 3); // tour de B → A est hors-tour
    const id = instId("A", 0);
    expect(whyCannotPlay(ctxOf(f), "A", id)).toBe("Ce n'est pas votre tour.");
    expect(whyCannotPlay(ctxOf(f), "A", id, true)).toBeNull();
  });

  it("interdit le Monde au premier tour de la partie (4943)", () => {
    const f = handFixture();
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toContain(
      "premier tour",
    );
  });

  it("autorise une Salle au premier tour (destination Havre-Sac)", () => {
    const salle = {
      ...makeAlly("salle", { niveau: 0 }),
      mainType: "Salle",
      stats: { niveau: { value: 0, element: "Neutre" } },
    } as unknown as Card;
    const f = fixture([salle]);
    bringToHand(f, "A", instId("A", 0));
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toBeNull();
  });

  it("refuse hors de son tour et hors phase principale", () => {
    const f = handFixture();
    setTurn(f, "B", 2);
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toContain("tour");
    setTurn(f, "A", 3, "pioche");
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toContain(
      "Phase Principale",
    );
  });

  it("refuse une carte qui n'est pas dans la main", () => {
    const f = fixture([makeAlly("c0")]);
    setTurn(f, "A", 3);
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toContain("main");
  });

  it("propage la raison du coût impayable", () => {
    const f = handFixture(makeAlly("c0", { niveau: 5, element: "Feu" }));
    setTurn(f, "A", 3);
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toContain(
      "Ressources",
    );
  });
});

describe("rules/legality — Taille du Havre-Sac (2315)", () => {
  function bagFixture() {
    const salle = {
      ...makeAlly("salle2", { niveau: 0 }),
      mainType: "Salle",
      stats: { niveau: { value: 0, element: "Neutre" } },
    } as unknown as Card;
    const f = fixture([makeAlly("a0"), salle], [], {
      sacA: createMockHavreSacCard({
        id: "sacT2",
        stats: { taille: 2, resistance: 15 },
      }),
    });
    return { f, salle };
  }

  it("initialise le compteur Résistance du Havre-Sac au setup (2303)", () => {
    const { f } = bagFixture();
    const s = ctxOf(f).state;
    const sacInst = s.instances[s.seats.A.havreSacInstanceId!];
    expect(sacInst.counters.resistance).toBe(15);
  });

  it("compte l'occupation (le Héros compte, 4781) et bloque une Salle si plein (2626)", () => {
    const { f } = bagFixture();
    expect(havreSacOccupancy(ctxOf(f), "A")).toBe(1); // le Héros
    expect(havreSacHasRoom(ctxOf(f), "A")).toBe(true);
    // un Allié rejoint le Havre-Sac → plein (2/2)
    dispatch(
      f,
      move("A", {
        instanceId: instId("A", 0),
        from: { zone: "pioche", owner: "A" },
        to: { zone: "havreSac", owner: "A" },
        position: { at: "any" },
        visibility: { faceDown: false, visibleTo: "all" },
        preservesIdentity: false,
        orientationOnArrival: "upright",
      }),
    );
    expect(havreSacOccupancy(ctxOf(f), "A")).toBe(2);
    expect(havreSacHasRoom(ctxOf(f), "A")).toBe(false);
    // jouer une Salle est refusé
    bringToHand(f, "A", instId("A", 1));
    setTurn(f, "A", 3);
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 1))).toContain("plein");
  });

  it("Taille inconnue → on ne bloque jamais (mode défensif)", () => {
    const f = fixture([]); // sac sans stats
    expect(havreSacHasRoom(ctxOf(f), "A")).toBe(true);
  });
});

describe("rules/legality — déclaration d'attaque", () => {
  it("interdit l'attaque au premier tour de chaque joueur (603.2)", () => {
    const f = fixture([]);
    expect(whyCannotDeclareAttack(ctxOf(f), "A", null)).toContain(
      "premier tour",
    );
    setTurn(f, "B", 2);
    expect(whyCannotDeclareAttack(ctxOf(f), "B", null)).toContain(
      "premier tour",
    );
    setTurn(f, "A", 3);
    expect(whyCannotDeclareAttack(ctxOf(f), "A", null)).toBeNull();
  });

  it("n'autorise qu'une attaque par tour", () => {
    const f = fixture([]);
    setTurn(f, "A", 3);
    expect(whyCannotDeclareAttack(ctxOf(f), "A", 3)).toContain("seule");
    expect(whyCannotDeclareAttack(ctxOf(f), "A", 2)).toBeNull();
  });
});

describe("rules/legality — attaquants, cibles, bloqueurs", () => {
  it("exclut les alliés arrivés ce tour (mal d'invocation, 1821)", () => {
    const f = fixture([makeAlly("vieux"), makeAlly("frais")]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 2 });
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 3 });
    const attackers = eligibleAttackers(ctxOf(f), "A");
    expect(attackers).toContain(instId("A", 0));
    expect(attackers).not.toContain(instId("A", 1));
    expect(attackers).toContain(HERO_A); // le Héros n'a pas le mal d'invocation
  });

  it("exclut les cartes inclinées et les Alliés Élémentaires", () => {
    const elem = {
      ...makeAlly("elem"),
      mainType: "Allié Élémentaire",
    } as unknown as Card;
    const f = fixture([makeAlly("tap"), elem]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1, tapped: true });
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 1 });
    const attackers = eligibleAttackers(ctxOf(f), "A");
    expect(attackers).not.toContain(instId("A", 0));
    expect(attackers).not.toContain(instId("A", 1));
  });

  it("cibles : Héros, Havre-Sac et Alliés adverses du Monde (702.2)", () => {
    const f = fixture([], [makeAlly("bd")]);
    bringToMonde(f, "B", instId("B", 0));
    const targets = eligibleTargets(ctxOf(f), "A");
    const ids = targets.map((t) => t.instanceId);
    expect(ids).toContain(HERO_B);
    expect(ids).toContain(SAC_B);
    expect(ids).toContain(instId("B", 0));
    expect(targets.find((t) => t.instanceId === HERO_B)?.kind).toBe("hero");
  });

  it("bloqueurs : alliés redressés du Monde, hors cible et hors Héros (704)", () => {
    const f = fixture([], [makeAlly("b0"), makeAlly("b1")]);
    bringToMonde(f, "B", instId("B", 0));
    bringToMonde(f, "B", instId("B", 1), { tapped: true });
    const blockers = eligibleBlockers(ctxOf(f), "B", {
      kind: "hero",
      instanceId: HERO_B,
    });
    expect(blockers).toEqual([instId("B", 0)]);
    // la cible elle-même ne peut pas bloquer
    const blockers2 = eligibleBlockers(ctxOf(f), "B", {
      kind: "ally",
      instanceId: instId("B", 0),
    });
    expect(blockers2).not.toContain(instId("B", 0));
  });

  it("exclut un Allié au pouvoir « ne peut pas bloquer » (Jicé Aouaire)", () => {
    const jice = makeAlly("jice", { force: 3 });
    jice.effects = [
      {
        description: "Jicé Aouaire ne peut pas bloquer.",
        compiled: {
          trigger: "static",
          static: { kind: "cannotBlock" },
          ops: [],
        },
      },
    ];
    const f = fixture([], [jice, makeAlly("autre")]);
    bringToMonde(f, "B", instId("B", 0));
    bringToMonde(f, "B", instId("B", 1));
    const blockers = eligibleBlockers(ctxOf(f), "B", {
      kind: "hero",
      instanceId: HERO_B,
    });
    expect(blockers).toEqual([instId("B", 1)]);
  });

  function withCannotAttackOrBlock(id: string) {
    const a = makeAlly(id, { force: 3 });
    a.effects = [
      {
        description: `${id} ne peut ni attaquer, ni bloquer.`,
        compiled: {
          trigger: "static",
          static: { kind: "cannotAttackOrBlock" },
          ops: [],
        },
      },
    ];
    return a;
  }

  it("« ne peut ni attaquer, ni bloquer » : exclu des attaquants ET des bloqueurs", () => {
    // attaquant : la carte est retirée de eligibleAttackers (volet attaque)
    const fa = fixture([
      withCannotAttackOrBlock("epouvantail"),
      makeAlly("ok"),
    ]);
    setTurn(fa, "A", 3);
    bringToMonde(fa, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(fa, "A", instId("A", 1), { arrivedTurn: 1 });
    const attackers = eligibleAttackers(ctxOf(fa), "A");
    expect(attackers).not.toContain(instId("A", 0));
    expect(attackers).toContain(instId("A", 1));

    // bloqueur : la même carte est aussi retirée de eligibleBlockers (volet blocage)
    const fb = fixture(
      [],
      [withCannotAttackOrBlock("epou"), makeAlly("autre")],
    );
    bringToMonde(fb, "B", instId("B", 0));
    bringToMonde(fb, "B", instId("B", 1));
    const blockers = eligibleBlockers(ctxOf(fb), "B", {
      kind: "hero",
      instanceId: HERO_B,
    });
    expect(blockers).toEqual([instId("B", 1)]);
  });
});
