import { describe, expect, it } from "vitest";
import type { AllyCard, Card, HeroCard } from "@/types/cards";
import { costModifier, planCost } from "../resources";
import { compileStaticEffectText } from "../effects/dsl";
import {
  bringToMonde,
  ctxOf,
  fixture,
  instId,
  makeAlly,
  makeHero,
} from "./harness";

/** Héros d'une Classe donnée (heroCard.class) pour les tests de Dopeul. */
function heroOfClass(id: string, klass: string): HeroCard {
  return { ...makeHero(id, "Feu"), class: klass } as HeroCard;
}

/** Allié « Dopeul » avec la réduction de coût gated par la Classe du Héros. */
function dopeul(
  id: string,
  name: string,
  klass: string,
  niveau: number,
): AllyCard {
  return {
    ...makeAlly(id, { niveau, element: "Feu" }),
    name,
    effects: [
      {
        description: `Si votre Héros est ${klass}, le coût du ${name} est réduit de 1.`,
      },
    ],
  };
}

describe("rules/costModifier — DSL (compileStaticEffectText)", () => {
  it("compile la réduction de coût de soi des Dopeuls (selfCostMod)", () => {
    const c = compileStaticEffectText(
      "Si votre Héros est Sram, le coût du Dopeul Sram est réduit de 1.",
      "Dopeul Sram",
    );
    expect(c).toEqual({
      trigger: "static",
      static: { kind: "selfCostMod", n: 1, ifHeroClass: "Sram" },
      ops: [],
    });
  });

  it("compile « de <self> » (sans article) — Dopeul Sacrieur", () => {
    const c = compileStaticEffectText(
      "Si votre Héros est Sacrieur, le coût de Dopeul Sacrieur est réduit de 1.",
      "Dopeul Sacrieur",
    );
    expect(c?.static).toEqual({
      kind: "selfCostMod",
      n: 1,
      ifHeroClass: "Sacrieur",
    });
  });

  it("compile l'aura par Famille (costAura family)", () => {
    const c = compileStaticEffectText(
      "Tant que l'Araknotanker Grouilleux est dans le Monde, le coût de vos Alliés Grouilleux est réduit de 1.",
      "Araknotanker Grouilleux",
    );
    expect(c?.static).toEqual({
      kind: "costAura",
      n: 1,
      scope: { kind: "family", sub: "grouilleux" },
    });
  });

  it("compile l'aura par type Action et l'aura Unique", () => {
    const actions = compileStaticEffectText(
      "Tant que Truc est dans le Monde, le coût de vos Actions est réduit de 1.",
      "Truc",
    );
    expect(actions?.static).toEqual({
      kind: "costAura",
      n: 1,
      scope: { kind: "type", mainType: "Action" },
    });
    const uniques = compileStaticEffectText(
      "Tant que Truc est dans le Monde, le coût de vos cartes Uniques est réduit de 1.",
      "Truc",
    );
    expect(uniques?.static).toEqual({
      kind: "costAura",
      n: 1,
      scope: { kind: "unique" },
    });
  });

  it("REFUSE les formes hors des deux variantes (manuel)", () => {
    // plancher non modélisé (« jusqu'à un minimum de 1 ») → manuel
    expect(
      compileStaticEffectText(
        "Tant que Terry l'Ermite est dans le Monde, le coût de vos Invocations est réduit de 1, jusqu'à un minimum de 1.",
        "Terry l'Ermite",
      ),
    ).toBeNull();
    // scope « Capture de vos Dragodindes » non modélisé → manuel
    expect(
      compileStaticEffectText(
        "Tant que l'Enclos de Dragodindes est dans le Monde, le coût de Capture de vos Dragodindes est réduit de 1.",
        "Enclos de Dragodindes",
      ),
    ).toBeNull();
    // augmentation de coût adverse → manuel (pas une réduction de soi/aura)
    expect(
      compileStaticEffectText(
        "Tant que le Minotot est dans le Monde, le coût des Actions jouées par vos adversaires est augmenté de 2.",
        "Minotot",
      ),
    ).toBeNull();
    // sujet du coût ≠ la carte (selfCostMod n'est pas auto-référent) → manuel
    expect(
      compileStaticEffectText(
        "Si votre Héros est Sram, le coût du Dopeul Iop est réduit de 1.",
        "Dopeul Sram",
      ),
    ).toBeNull();
    // Famille hors allowlist → manuel
    expect(
      compileStaticEffectText(
        "Tant que Truc est dans le Monde, le coût de vos Alliés Machins est réduit de 1.",
        "Truc",
      ),
    ).toBeNull();
    // sujet « le Porteur de <self> » = aura GATED par le Porteur → manuel (la
    // réduction ne doit pas s'appliquer dès que l'Équipement seul est en jeu).
    expect(
      compileStaticEffectText(
        "Tant que le Porteur de la Cape Cérémoniale est dans le Monde, le coût de vos cartes Uniques est réduit de 1.",
        "Cape Cérémoniale",
      ),
    ).toBeNull();
  });
});

describe("rules/costModifier — selfCostMod (Dopeuls) dans planCost", () => {
  it("réduit le coût du Dopeul de 1 quand le Héros est de la bonne Classe", () => {
    const card = dopeul("dop", "Dopeul Sram", "Sram", 2);
    const f = fixture([card], [], { heroA: heroOfClass("hA", "Sram") });
    expect(costModifier(ctxOf(f), "A", card)).toBe(1);
    const plan = planCost(ctxOf(f), "A", card);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.producers).toHaveLength(1); // 2 - 1 = 1
  });

  it("NE réduit PAS quand le Héros est d'une autre Classe", () => {
    const card = dopeul("dop", "Dopeul Sram", "Sram", 2);
    const f = fixture([card], [], { heroA: heroOfClass("hA", "Iop") });
    expect(costModifier(ctxOf(f), "A", card)).toBe(0);
    const plan = planCost(ctxOf(f), "A", card);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.producers).toHaveLength(2); // coût plein
  });

  it("la réduction ne s'applique qu'à VOTRE Héros (le siège demandeur)", () => {
    const card = dopeul("dop", "Dopeul Sram", "Sram", 2);
    // Héros A = Sram, Héros B = Iop ; B ne profite pas de la Classe de A.
    const f = fixture([], [card], {
      heroA: heroOfClass("hA", "Sram"),
      heroB: heroOfClass("hB", "Iop"),
    });
    expect(costModifier(ctxOf(f), "B", card)).toBe(0);
  });
});

describe("rules/costModifier — costAura dans planCost", () => {
  it("réduit le coût d'un Allié de la Famille tant que la source est en jeu", () => {
    const aura: AllyCard = {
      ...makeAlly("src", { niveau: 1, element: "Feu" }),
      name: "Araknotanker Grouilleux",
      effects: [
        {
          description:
            "Tant que l'Araknotanker Grouilleux est dans le Monde, le coût de vos Alliés Grouilleux est réduit de 1.",
        },
      ],
    };
    const target: AllyCard = {
      ...makeAlly("tgt", { niveau: 2, element: "Feu" }),
      subTypes: ["Grouilleux"],
    };
    const f = fixture([aura, target]);
    // source PAS en jeu → pas de réduction
    expect(costModifier(ctxOf(f), "A", target)).toBe(0);
    // source en jeu → -1
    bringToMonde(f, "A", instId("A", 0));
    expect(costModifier(ctxOf(f), "A", target)).toBe(1);
    const plan = planCost(ctxOf(f), "A", target);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.producers).toHaveLength(1); // 2 - 1
  });

  it("ne réduit PAS un Allié d'une autre Famille", () => {
    const aura: AllyCard = {
      ...makeAlly("src", { niveau: 1, element: "Feu" }),
      name: "Araknotanker Grouilleux",
      effects: [
        {
          description:
            "Tant que l'Araknotanker Grouilleux est dans le Monde, le coût de vos Alliés Grouilleux est réduit de 1.",
        },
      ],
    };
    const other: AllyCard = {
      ...makeAlly("oth", { niveau: 2, element: "Feu" }),
      subTypes: ["Bouftou"],
    };
    const f = fixture([aura, other]);
    bringToMonde(f, "A", instId("A", 0));
    expect(costModifier(ctxOf(f), "A", other)).toBe(0);
  });

  it("l'aura ne profite PAS à l'adversaire (« vos … »)", () => {
    const aura: AllyCard = {
      ...makeAlly("src", { niveau: 1, element: "Feu" }),
      name: "Araknotanker Grouilleux",
      effects: [
        {
          description:
            "Tant que l'Araknotanker Grouilleux est dans le Monde, le coût de vos Alliés Grouilleux est réduit de 1.",
        },
      ],
    };
    const target: AllyCard = {
      ...makeAlly("tgt", { niveau: 2, element: "Eau" }),
      subTypes: ["Grouilleux"],
    };
    // aura contrôlée par A ; on demande le coût pour B → aucune réduction.
    const f = fixture([aura], [target]);
    bringToMonde(f, "A", instId("A", 0));
    expect(costModifier(ctxOf(f), "B", target)).toBe(0);
  });

  it("aura Unique : réduit une carte au trait Unique", () => {
    const aura: AllyCard = {
      ...makeAlly("src", { niveau: 1, element: "Feu" }),
      name: "Source U",
      effects: [
        {
          description:
            "Tant que Source U est dans le Monde, le coût de vos cartes Uniques est réduit de 1.",
        },
      ],
    };
    const uniqueCard: AllyCard = {
      ...makeAlly("u", { niveau: 2, element: "Feu" }),
      subTypes: ["Unique"],
    };
    const plain = makeAlly("p", { niveau: 2, element: "Feu" });
    const f = fixture([aura, uniqueCard, plain]);
    bringToMonde(f, "A", instId("A", 0));
    expect(costModifier(ctxOf(f), "A", uniqueCard)).toBe(1);
    expect(costModifier(ctxOf(f), "A", plain)).toBe(0);
  });

  it("plancher à 0 : un coût réduit sous 0 reste payable sans Ressource", () => {
    const aura: AllyCard = {
      ...makeAlly("src", { niveau: 1, element: "Feu" }),
      name: "Big Aura",
      effects: [
        {
          description:
            "Tant que Big Aura est dans le Monde, le coût de vos Actions est réduit de 5.",
        },
      ],
    };
    const action = {
      ...makeAlly("act", { niveau: 2, element: "Feu" }),
      mainType: "Action",
      subTypes: [],
    } as unknown as Card;
    const f = fixture([aura, action]);
    bringToMonde(f, "A", instId("A", 0));
    expect(costModifier(ctxOf(f), "A", action)).toBe(5);
    const plan = planCost(ctxOf(f), "A", action);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.producers).toEqual([]); // coût planché à 0
  });
});
