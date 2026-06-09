import { describe, expect, it } from "vitest";
import type { Card } from "@/types/cards";
import {
  eligibleAttackers,
  eligibleBlockers,
  eligibleTargets,
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
  fixture,
  instId,
  makeAlly,
  setTurn,
} from "./harness";

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
});
