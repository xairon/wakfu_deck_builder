/**
 * DÉCLENCHÉ DE MORT DE SOI (onSelfDestroyed, 804.7).
 *
 * « Quand [self] est détruit, CORPS » part quand la SOURCE est DÉTRUITE
 * (déplacée vers la Défausse depuis le jeu) — JAMAIS pour un bannissement
 * (→ Exil) ni un recyclage (→ Pioche). Strict et étroit (« an approximation of
 * gameplay is worse than a manual effect ») : le qualificatif de destructeur
 * (« par un joueur adverse »), la mort du Porteur, les veilles de mort d'autrui
 * et les corps de paiement / actor-bound restent MANUELS.
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import type { Card } from "@/types/cards";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { compileSelfDestroyedText, selfDestroyedEffects } from "../dsl";
import { collectTriggeredEffects } from "../triggers";
import type { RuleEvent, RulesCtx } from "../../types";

// ── DSL pur : formes sûres ────────────────────────────────────────────────────

describe("compileSelfDestroyedText — formes sûres", () => {
  it("« Quand Xav le Boulanger est détruit, le Héros … regagne 1 PV » → healHeroTarget", () => {
    const c = compileSelfDestroyedText(
      "Quand Xav le Boulanger est détruit, le Héros de votre choix regagne 1 PV.",
      "Xav le Boulanger",
    );
    expect(c).toEqual({
      trigger: "onSelfDestroyed",
      ops: [{ op: "healHeroTarget", n: 1 }],
    });
  });

  it("« Quand le Nerbe est détruit, votre Héros regagne 2 PV » → heroGainPv", () => {
    const c = compileSelfDestroyedText(
      "Quand le Nerbe est détruit, votre Héros regagne 2 PV.",
      "Nerbe",
    );
    expect(c).toEqual({
      trigger: "onSelfDestroyed",
      ops: [{ op: "heroGainPv", n: 2 }],
    });
  });

  it("« Quand la Daguette est détruite, vous pouvez détruire la Zone ou l'Équipement … » → optional destroyTarget", () => {
    const c = compileSelfDestroyedText(
      "Quand la Daguette est détruite, vous pouvez détruire la Zone ou l'Équipement de votre choix.",
      "la Daguette",
    );
    expect(c).toMatchObject({
      trigger: "onSelfDestroyed",
      optional: true,
    });
    expect(c?.ops[0].op).toBe("destroyTarget");
  });

  it("accepte « Lorsque » et la forme féminine « détruite »", () => {
    const c = compileSelfDestroyedText(
      "Lorsque la Daguette est détruite, votre Héros regagne 1 PV.",
      "la Daguette",
    );
    expect(c).toEqual({
      trigger: "onSelfDestroyed",
      ops: [{ op: "heroGainPv", n: 1 }],
    });
  });
});

// ── DSL pur : frontière (NE compile PAS → manuel) ─────────────────────────────

describe("compileSelfDestroyedText — frontière (NE compile PAS)", () => {
  it("qualificatif « par un joueur adverse » → null (on ne conditionne pas sur le destructeur)", () => {
    expect(
      compileSelfDestroyedText(
        "Quand Skrouj Makdeuk est détruit par un adversaire, vous pouvez piocher jusqu'à deux cartes.",
        "Skrouj Makdeuk",
      ),
    ).toBeNull();
  });

  it("mort du PORTEUR « le Porteur de X est détruit » → null", () => {
    expect(
      compileSelfDestroyedText(
        "Quand le Porteur de l'Amukwak de Glace est détruit, vous pouvez piocher jusqu'à deux cartes.",
        "Amukwak de Glace",
      ),
    ).toBeNull();
  });

  it("veille de mort d'AUTRUI « un autre de vos Tofus est détruit » → null", () => {
    expect(
      compileSelfDestroyedText(
        "Quand un autre de vos Tofus est détruit, vous pouvez mettre en jeu le Tofu Maléfique depuis votre Défausse.",
        "Tofu Maléfique",
      ),
    ).toBeNull();
  });

  it("veille de mort d'AUTRUI « un de vos Alliés est détruit » → null", () => {
    expect(
      compileSelfDestroyedText(
        "Quand un de vos Alliés est détruit, détruisez également l'Allié de votre choix.",
        "Igôle",
      ),
    ).toBeNull();
  });

  it("CORPS de PAIEMENT « vous pouvez payer pour … » → null", () => {
    expect(
      compileSelfDestroyedText(
        "Quand Marlène Frimeur est détruite, vous pouvez payer pour piocher une carte.",
        "Marlène Frimeur",
      ),
    ).toBeNull();
  });

  it("auto-apparition (déclencheur ≠ mort) → null", () => {
    expect(
      compileSelfDestroyedText(
        "Quand le Nerbe apparaît, votre Héros regagne 2 PV.",
        "Nerbe",
      ),
    ).toBeNull();
  });

  it("CORPS actor-bound « il inflige … » → null (sujet implicite non géré ici)", () => {
    expect(
      compileSelfDestroyedText(
        "Quand le Tofu Mutant est détruit, il inflige 1 Dommage à l'Allié ou Héros de votre choix.",
        "Tofu Mutant",
      ),
    ).toBeNull();
  });
});

// ── Collecteur ────────────────────────────────────────────────────────────────

const NERBE_EFFECT = {
  description: "Quand le Nerbe est détruit, votre Héros regagne 2 PV.",
  compiled: {
    trigger: "onSelfDestroyed" as const,
    ops: [{ op: "heroGainPv" as const, n: 2 }],
  },
};

describe("selfDestroyedEffects — collecteur", () => {
  it("récolte le déclenché compilé d'une carte", () => {
    const card = {
      id: "nerbe",
      name: "Nerbe",
      mainType: "Allié",
      effects: [NERBE_EFFECT],
    } as unknown as Card;
    const atoms = selfDestroyedEffects(card);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].ops).toEqual([{ op: "heroGainPv", n: 2 }]);
  });

  it("aucune récolte sur une carte sans onSelfDestroyed", () => {
    const card = {
      id: "x",
      name: "Bouftou",
      mainType: "Allié",
      effects: [],
    } as unknown as Card;
    expect(selfDestroyedEffects(card)).toHaveLength(0);
  });
});

// ── Bus : collectTriggeredEffects sur un événement `destroyed` ─────────────────

const NERBE: Card = {
  id: "nerbe",
  name: "Nerbe",
  mainType: "Allié",
  subTypes: [],
  effects: [NERBE_EFFECT],
} as unknown as Card;

const MUET: Card = {
  id: "muet",
  name: "Bouftou",
  mainType: "Allié",
  subTypes: [],
  effects: [],
} as unknown as Card;

function ctxWith(cards: Record<string, Card>): RulesCtx {
  const state = {
    turn: { active: "A", number: 1 },
    monde: ["v1"],
    instances: {
      v1: {
        instanceId: "v1",
        cardId: "nerbe",
        owner: "A",
        controller: "A",
        location: { zone: "monde" },
      },
      m1: {
        instanceId: "m1",
        cardId: "muet",
        owner: "A",
        controller: "A",
        location: { zone: "monde" },
      },
    },
  } as unknown as GameState;
  return {
    state,
    getCard: (id: string | null) => (id ? (cards[id] ?? null) : null),
  };
}

describe("collectTriggeredEffects — événement `destroyed`", () => {
  it("une carte détruite avec onSelfDestroyed → une frame (sourceId = instance détruite)", () => {
    const ctx = ctxWith({ nerbe: NERBE, muet: MUET });
    const evts: RuleEvent[] = [
      { kind: "destroyed", instanceId: "v1", controller: "A" },
    ];
    const frames = collectTriggeredEffects(ctx, evts);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      seat: "A",
      sourceId: "v1",
      cardName: "Nerbe",
      ops: [{ op: "heroGainPv", n: 2 }],
    });
  });

  it("une carte détruite SANS onSelfDestroyed → aucune frame", () => {
    const ctx = ctxWith({ nerbe: NERBE, muet: MUET });
    const frames = collectTriggeredEffects(ctx, [
      { kind: "destroyed", instanceId: "m1", controller: "A" },
    ]);
    expect(frames).toEqual([]);
  });
});

// ── Moteur (engine) : destruction → corps ; bannissement/recyclage → rien ─────

const VICTIM: Card = {
  id: "nerbe",
  name: "Nerbe",
  mainType: "Allié",
  subTypes: [],
  stats: { force: { value: 2, element: "Feu" } },
  effects: [NERBE_EFFECT],
} as unknown as Card;

const CARDS: Record<string, Card> = { nerbe: VICTIM };

function makeState(victimZone: "monde" = "monde"): GameState {
  return {
    turn: { active: "A", number: 1 },
    monde: ["v1"],
    instances: {
      v1: {
        instanceId: "v1",
        cardId: "nerbe",
        owner: "B",
        controller: "B",
        location: { zone: victimZone },
        counters: {},
        orientation: "upright",
      },
    },
    seats: {
      A: {
        main: [],
        pioche: [],
        defausse: [],
        havreSac: [],
        heroInstanceId: "hero-A",
      },
      B: {
        main: [],
        pioche: [],
        defausse: [],
        havreSac: [],
        heroInstanceId: "hero-B",
      },
    },
  } as unknown as GameState;
}

function mockDeps(over: Partial<EffectEngineDeps> = {}): EffectEngineDeps {
  const state = makeState();
  return {
    getState: () => state,
    rulesCtx: () =>
      ({
        state,
        getCard: (id: string | null) => (id ? (CARDS[id] ?? null) : null),
      }) as never,
    getCard: (id: string | null) => (id ? (CARDS[id] ?? null) : null),
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: () => "Joueur",
    paOf: () => 6,
    dispatch: vi.fn(),
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
    ...over,
  };
}

describe("engine — destruction ciblée déclenche onSelfDestroyed", () => {
  it("destroyTarget sur la victime → son « regagne 2 PV » se résout (heal du contrôleur)", () => {
    const adjustCounter = vi.fn();
    const engine = createEffectEngine(mockDeps({ adjustCounter }));
    // A détruit la victime (contrôlée par B). Le déclenché de mort de la victime
    // appartient au contrôleur de la victime (B) → le Héros de B regagne 2 PV.
    engine.enqueueEffect({
      seat: "A",
      cardName: "Destructeur",
      ops: [{ op: "destroyTarget", what: "Allié", zones: ["monde"] }],
    });
    expect(engine.effectTargeting.value).not.toBeNull();
    engine.effectTargetChoose("v1");
    expect(adjustCounter).toHaveBeenCalledWith("hero-B", "hp", 2);
  });

  it("banishTarget sur la victime → AUCUN déclenché de mort (→ Exil, pas une destruction)", () => {
    const adjustCounter = vi.fn();
    const engine = createEffectEngine(mockDeps({ adjustCounter }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Banisseur",
      ops: [{ op: "banishTarget", what: "Allié", zones: ["monde"] }],
    });
    expect(engine.effectTargeting.value).not.toBeNull();
    engine.effectTargetChoose("v1");
    expect(adjustCounter).not.toHaveBeenCalled();
  });

  it("recyclage (costRecycleControlled → Pioche) → AUCUN déclenché de mort", () => {
    const adjustCounter = vi.fn();
    const engine = createEffectEngine(mockDeps({ adjustCounter }));
    // « Recyclez un de vos Alliés : … » — la victime est recyclée sous la Pioche,
    // pas détruite. Aucun onSelfDestroyed ne part. (Le corps payé serait un draw,
    // hors-sujet ici : on vérifie l'absence de heal de mort.)
    engine.enqueueEffect({
      seat: "B",
      cardName: "Recycleur",
      ops: [
        { op: "costRecycleControlled", zones: ["monde"] },
        { op: "draw", n: 1 },
      ],
    });
    expect(engine.effectTargeting.value).not.toBeNull();
    engine.effectTargetChoose("v1");
    expect(adjustCounter).not.toHaveBeenCalled();
  });
});
