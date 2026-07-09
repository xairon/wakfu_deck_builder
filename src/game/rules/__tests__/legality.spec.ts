import { describe, expect, it } from "vitest";
import type { Card } from "@/types/cards";
import {
  eligibleAttackers,
  eligibleBlockers,
  eligibleTargets,
  havreSacHasRoom,
  havreSacOccupancy,
  playDestination,
  whyCannotDeclareAttack,
  whyCannotMoveHero,
  whyCannotMoveCreature,
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
  moveHeroTo,
  setTurn,
} from "./harness";
import { move } from "@/game";
import { createMockHavreSacCard } from "tests/factories/card";

describe("rules/legality — mouvement du Héros (414.1)", () => {
  it("refuse la sortie dans le Monde au tour 1 (506.3), l'autorise ensuite", () => {
    const f = fixture([]);
    setTurn(f, "A", 1);
    expect(whyCannotMoveHero(ctxOf(f), "A", "monde")).toContain("premier tour");
    setTurn(f, "A", 3);
    expect(whyCannotMoveHero(ctxOf(f), "A", "monde")).toBeNull();
  });

  it("refuse hors de son tour, et si le Héros est déjà dans la zone visée", () => {
    const f = fixture([]);
    setTurn(f, "B", 3);
    expect(whyCannotMoveHero(ctxOf(f), "A", "monde")).toBe(
      "Ce n'est pas votre tour.",
    );
    setTurn(f, "A", 3);
    expect(whyCannotMoveHero(ctxOf(f), "A", "havreSac")).toContain("déjà");
    moveHeroTo(f, "A", "monde");
    expect(whyCannotMoveHero(ctxOf(f), "A", "monde")).toContain("déjà");
    expect(whyCannotMoveHero(ctxOf(f), "A", "havreSac")).toBeNull();
  });
});

describe("rules/legality — Héros ciblable/attaquant seulement exposé dans le Monde", () => {
  it("protégé au Havre-Sac : ni attaquant ni cible ; exposé au Monde : les deux", () => {
    const f = fixture([]);
    setTurn(f, "A", 3);
    // Héros au Havre-Sac : A ne peut pas l'envoyer attaquer, B n'est pas ciblable.
    expect(eligibleAttackers(ctxOf(f), "A")).not.toContain(HERO_A);
    expect(
      eligibleTargets(ctxOf(f), "A").map((t) => t.instanceId),
    ).not.toContain(HERO_B);
    // Héros sortis dans le Monde : exposés (attaquant + cible).
    moveHeroTo(f, "A", "monde");
    moveHeroTo(f, "B", "monde");
    expect(eligibleAttackers(ctxOf(f), "A")).toContain(HERO_A);
    expect(eligibleTargets(ctxOf(f), "A").map((t) => t.instanceId)).toContain(
      HERO_B,
    );
  });
});

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

  it("interdit le Monde au premier tour de la partie (4943, carte Monde)", () => {
    // Une Zone va OBLIGATOIREMENT dans le Monde → refusée au 1er tour (506.3).
    // (Un Allié, lui, est routé au Havre-Sac : cf. test dédié 303.1.)
    const zone = { ...makeAlly("z0", {}), mainType: "Zone" } as unknown as Card;
    const f = fixture([zone]);
    bringToHand(f, "A", instId("A", 0));
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

  it("un Allié dans le Havre-Sac n'est PAS un attaquant légal (503.1/508.1b)", () => {
    const ally = makeAlly("aatk", { niveau: 1, element: "Feu", force: 2 });
    const f = fixture([ally]);
    const allyId = instId("A", 0);
    setTurn(f, "A", 3); // hors 1er tour + hors mal d'invocation
    // Allié dans l'INTÉRIEUR du Havre-Sac, dressé.
    dispatch(
      f,
      move("A", {
        instanceId: allyId,
        from: ctxOf(f).state.instances[allyId].location,
        to: { zone: "havreSac", owner: "A" },
        position: { at: "any" },
        visibility: { faceDown: false, visibleTo: "all" },
        preservesIdentity: true,
        orientationOnArrival: "upright",
      }),
    );
    expect(eligibleAttackers(ctxOf(f), "A")).not.toContain(allyId);
    // Une fois SORTI dans le Monde, il devient attaquant légal.
    dispatch(
      f,
      move("A", {
        instanceId: allyId,
        from: { zone: "havreSac", owner: "A" },
        to: { zone: "monde" },
        position: { at: "any" },
        visibility: { faceDown: false, visibleTo: "all" },
        preservesIdentity: true,
        orientationOnArrival: "upright",
      }),
    );
    expect(eligibleAttackers(ctxOf(f), "A")).toContain(allyId);
  });

  it("mouvement d'Allié 414.1/414.2 : sort du Havre-Sac dressé, bloqué si incliné ou au 1er tour", () => {
    const mk = (orient: "upright" | "tapped") => {
      const ally = makeAlly("mv", { niveau: 1, element: "Feu" });
      const f = fixture([ally]);
      const id = instId("A", 0);
      dispatch(
        f,
        move("A", {
          instanceId: id,
          from: ctxOf(f).state.instances[id].location,
          to: { zone: "havreSac", owner: "A" },
          position: { at: "any" },
          visibility: { faceDown: false, visibleTo: "all" },
          preservesIdentity: true,
          orientationOnArrival: orient,
        }),
      );
      return { f, id };
    };
    // Dressé, tour ≥ 2 → peut sortir dans le Monde.
    const a = mk("upright");
    setTurn(a.f, "A", 3);
    expect(whyCannotMoveCreature(ctxOf(a.f), "A", a.id, "monde")).toBeNull();
    // Incliné → 414.2 refuse le déplacement.
    const b = mk("tapped");
    setTurn(b.f, "A", 3);
    expect(whyCannotMoveCreature(ctxOf(b.f), "A", b.id, "monde")).toContain(
      "inclinée",
    );
    // 1er tour → pas de sortie au Monde (506.3).
    const c = mk("upright");
    setTurn(c.f, "A", 1);
    expect(whyCannotMoveCreature(ctxOf(c.f), "A", c.id, "monde")).toContain(
      "premier tour",
    );
  });

  it("place une Salle dans le Havre-Sac et une Zone dans le Monde (309.1)", () => {
    const salle = {
      ...makeAlly("s", {}),
      mainType: "Salle",
    } as unknown as Card;
    const zone = { ...makeAlly("z", {}), mainType: "Zone" } as unknown as Card;
    expect(playDestination(salle, "A")).toEqual({
      zone: "havreSac",
      owner: "A",
    });
    expect(playDestination(zone, "A")).toEqual({ zone: "monde" });
  });

  it("interdit une Zone au premier tour (destination Monde) mais pas une Salle", () => {
    const zone = { ...makeAlly("z", {}), mainType: "Zone" } as unknown as Card;
    const f = fixture([zone]);
    bringToHand(f, "A", instId("A", 0)); // turn 1 (A) par défaut
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toContain(
      "premier tour",
    );
  });

  it("autorise un Allié au premier tour, routé vers le Havre-Sac (303.1/506.3)", () => {
    // Au 1er tour, le Monde est interdit (506.3) MAIS un Allié peut arriver dans
    // le Havre-Sac (303.1) → jouable (pas de refus « premier tour »).
    const ally = makeAlly("a1", { niveau: 0 });
    const f = fixture([ally]);
    bringToHand(f, "A", instId("A", 0)); // turn 1 (A)
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toBeNull();
    // Sa destination au 1er tour est le Havre-Sac (pas le Monde).
    expect(playDestination(ally, "A", 1)).toEqual({
      zone: "havreSac",
      owner: "A",
    });
    // Hors 1er tour, il arrive dans le Monde (défaut).
    expect(playDestination(ally, "A", 3)).toEqual({ zone: "monde" });
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
    moveHeroTo(f, "A", "monde"); // exposé, le Héros peut être envoyé au combat
    const attackers = eligibleAttackers(ctxOf(f), "A");
    expect(attackers).toContain(instId("A", 0));
    expect(attackers).not.toContain(instId("A", 1));
    expect(attackers).toContain(HERO_A); // sorti au Monde : pas de mal d'invocation
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
    moveHeroTo(f, "B", "monde"); // le Héros adverse n'est ciblable qu'exposé (508.x)
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
