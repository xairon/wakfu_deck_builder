/**
 * Tranche W12 — DÉCLENCHÉ D'APPARITION NON-SOI (onOtherAppears).
 *
 * Une carte EN JEU qui veille « Quand un Allié [Famille]? [adverse]? apparaît …,
 * CORPS » déclenche le CORPS (sujet = contrôleur du veilleur) quand une AUTRE
 * carte correspondante apparaît. Strict et étroit : actor-binding (« il/elle … »)
 * et déclencheur flottant (« Jusqu'à la fin du tour, chaque fois … ») restent
 * MANUELS (ne compilent pas en onOtherAppears).
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import type { Card } from "@/types/cards";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { appearanceTriggerEffects, compileAppearanceTriggerText } from "../dsl";

// ── DSL pur ──────────────────────────────────────────────────────────────────

describe("compileAppearanceTriggerText — formes sûres", () => {
  it("« Quand un Allié [Famille] apparaît dans le Monde, piochez une carte »", () => {
    const c = compileAppearanceTriggerText(
      "Quand un Allié Wabbit apparaît dans le Monde, piochez une carte.",
      "Château des Wabbits",
    );
    expect(c).toEqual({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié", sub: "wabbit" },
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("« Chaque fois qu'un Allié … apparaît …, vous pouvez piocher » → optional", () => {
    const c = compileAppearanceTriggerText(
      "Chaque fois qu'un Allié Wabbit apparait dans le Monde, vous pouvez piocher une carte.",
      "Château des Wabbits",
    );
    expect(c).toMatchObject({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié", sub: "wabbit" },
      optional: true,
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("« Quand un Allié adverse apparaît, le Héros adverse perd 2 PV » → controller opponent", () => {
    const c = compileAppearanceTriggerText(
      "Quand un Allié adverse apparaît, le Héros adverse perd 2 PV.",
      "Veilleur",
    );
    expect(c).toEqual({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié", controller: "opponent" },
      ops: [{ op: "damageOppHero", n: 2 }],
    });
  });

  it("sans Famille ni « adverse » → veille tout Allié, sans filtre de contrôleur", () => {
    const c = compileAppearanceTriggerText(
      "Quand un Allié apparaît, gagnez 1 XP.",
      "Veilleur",
    );
    expect(c).toEqual({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié" },
      ops: [{ op: "gainXp", n: 1 }],
    });
  });
});

describe("compileAppearanceTriggerText — frontière (NE compile PAS)", () => {
  it("CORPS « il … » (actor-binding) → null", () => {
    expect(
      compileAppearanceTriggerText(
        "Quand un Allié apparaît, il gagne +1 en Force.",
        "Veilleur",
      ),
    ).toBeNull();
  });

  it("CORPS « elle … » (actor-binding) → null", () => {
    expect(
      compileAppearanceTriggerText(
        "Quand un Allié Wabbit apparaît, elle pioche une carte.",
        "Veilleur",
      ),
    ).toBeNull();
  });

  it("« Jusqu'à la fin du tour, chaque fois qu'un … » (flottant) → null", () => {
    expect(
      compileAppearanceTriggerText(
        "Jusqu'à la fin du tour, chaque fois qu'un Allié apparaît, piochez une carte.",
        "Veilleur",
      ),
    ).toBeNull();
  });

  it("CORPS non compilable (clause résiduelle) → null", () => {
    expect(
      compileAppearanceTriggerText(
        "Quand un Allié apparaît, redressez un de vos Alliés Bandits de Niveau inférieur ou égal au Niveau de cet Allié.",
        "Veilleur",
      ),
    ).toBeNull();
  });

  it("auto-apparition : pas une veille (déclencheur de SOI) → null", () => {
    // « Quand [nom] apparaît » est un onArrive, pas un onOtherAppears.
    expect(
      compileAppearanceTriggerText(
        "Quand le Veilleur apparaît, piochez une carte.",
        "Veilleur",
      ),
    ).toBeNull();
  });
});

// ── Moteur (engine) ──────────────────────────────────────────────────────────

const WATCHER: Card = {
  id: "watcher",
  name: "Château des Wabbits",
  mainType: "Zone",
  effects: [
    {
      description:
        "Quand un Allié Wabbit apparaît dans le Monde, piochez une carte.",
      compiled: {
        trigger: "onOtherAppears",
        watch: { mainType: "Allié", sub: "wabbit" },
        ops: [{ op: "draw", n: 1 }],
      },
    },
  ],
} as unknown as Card;

const WABBIT: Card = {
  id: "wabbit",
  name: "Wabbit Sauvage",
  mainType: "Allié",
  subTypes: ["Wabbit"],
} as unknown as Card;

const BOUFTOU: Card = {
  id: "bouftou",
  name: "Bouftou",
  mainType: "Allié",
  subTypes: ["Bouftou"],
} as unknown as Card;

const CARDS: Record<string, Card> = {
  watcher: WATCHER,
  wabbit: WABBIT,
  bouftou: BOUFTOU,
};

/** État avec le veilleur dans le Monde (contrôlé par A). */
function makeState(): GameState {
  return {
    turn: { active: "A", number: 1 },
    monde: ["w1"],
    instances: {
      w1: {
        instanceId: "w1",
        cardId: "watcher",
        owner: "A",
        controller: "A",
        location: { zone: "monde" },
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

describe("appearanceTriggerEffects — collecteur", () => {
  it("récolte la veille compilée d'une carte en jeu", () => {
    const atoms = appearanceTriggerEffects(WATCHER);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].watch).toEqual({ mainType: "Allié", sub: "wabbit" });
  });

  it("aucune veille sur une carte sans onOtherAppears", () => {
    expect(appearanceTriggerEffects(WABBIT)).toHaveLength(0);
  });
});

describe("queueArrivalEffects — veille non-soi (onOtherAppears)", () => {
  it("un Allié de la bonne Famille apparaît → le veilleur pioche", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps({ draw }));
    // le Wabbit apparaît (contrôlé par A), instance "wab1"
    engine.queueArrivalEffects("A", WABBIT, "wab1");
    expect(draw).toHaveBeenCalledWith("A", 1);
  });

  it("un Allié d'une AUTRE Famille apparaît → ne déclenche pas", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps({ draw }));
    engine.queueArrivalEffects("A", BOUFTOU, "bf1");
    expect(draw).not.toHaveBeenCalled();
  });

  it("auto-apparition : le veilleur ne se veille pas lui-même", () => {
    const draw = vi.fn();
    const deps = mockDeps({ draw });
    // le veilleur w1 « apparaît » en se passant son propre instanceId
    const engine = createEffectEngine(deps);
    engine.queueArrivalEffects("A", WATCHER, "w1");
    // WATCHER est une Zone (mainType ≠ Allié) ET exclu par instanceId → 0 pioche
    expect(draw).not.toHaveBeenCalled();
  });

  it("un Wabbit qui se veillerait lui-même est exclu (exclusion par instanceId)", () => {
    // veilleur = un Allié Wabbit qui porte la même veille, en jeu en w1,
    // puis c'est CE MÊME instance qui apparaît → pas de pioche (exclusion).
    const draw = vi.fn();
    const selfWatchWabbit: Card = {
      id: "watchwab",
      name: "Wabbit Veilleur",
      mainType: "Allié",
      subTypes: ["Wabbit"],
      effects: WATCHER.effects,
    } as unknown as Card;
    const state = makeState();
    (state.instances as Record<string, unknown>).w1 = {
      instanceId: "w1",
      cardId: "watchwab",
      owner: "A",
      controller: "A",
      location: { zone: "monde" },
    };
    const engine = createEffectEngine(
      mockDeps({
        draw,
        getState: () => state,
        getCard: (id: string | null) =>
          id === "watchwab" ? selfWatchWabbit : id ? (CARDS[id] ?? null) : null,
      }),
    );
    engine.queueArrivalEffects("A", selfWatchWabbit, "w1");
    expect(draw).not.toHaveBeenCalled();
  });

  it("filtre contrôleur « adverse » : Allié adverse déclenche, Allié allié non", () => {
    const adjustCounter = vi.fn();
    const oppWatcher: Card = {
      id: "oppwatch",
      name: "Veilleur Adverse",
      mainType: "Zone",
      effects: [
        {
          description:
            "Quand un Allié adverse apparaît, le Héros adverse perd 2 PV.",
          compiled: {
            trigger: "onOtherAppears",
            watch: { mainType: "Allié", controller: "opponent" },
            ops: [{ op: "damageOppHero", n: 2 }],
          },
        },
      ],
    } as unknown as Card;
    const state = makeState();
    (state.instances as Record<string, unknown>).w1 = {
      instanceId: "w1",
      cardId: "oppwatch",
      owner: "A",
      controller: "A",
      location: { zone: "monde" },
    };
    const deps = mockDeps({
      adjustCounter,
      getState: () => state,
      getCard: (id: string | null) =>
        id === "oppwatch" ? oppWatcher : id ? (CARDS[id] ?? null) : null,
    });
    const engine = createEffectEngine(deps);
    // Allié contrôlé par B (adverse du veilleur A) → déclenche
    engine.queueArrivalEffects("B", BOUFTOU, "bf1");
    expect(adjustCounter).toHaveBeenCalledWith("hero-B", "hp", -2);
    adjustCounter.mockClear();
    // Allié contrôlé par A (même camp que le veilleur) → ne déclenche pas
    engine.queueArrivalEffects("A", BOUFTOU, "bf2");
    expect(adjustCounter).not.toHaveBeenCalled();
  });

  it("veille optionnelle : ouvre un choix au lieu de résoudre directement", () => {
    const draw = vi.fn();
    const optWatcher: Card = {
      id: "optwatch",
      name: "Château des Wabbits",
      mainType: "Zone",
      effects: [
        {
          description:
            "Chaque fois qu'un Allié Wabbit apparait dans le Monde, vous pouvez piocher une carte.",
          compiled: {
            trigger: "onOtherAppears",
            watch: { mainType: "Allié", sub: "wabbit" },
            optional: true,
            ops: [{ op: "draw", n: 1 }],
          },
        },
      ],
    } as unknown as Card;
    const state = makeState();
    (state.instances as Record<string, unknown>).w1 = {
      instanceId: "w1",
      cardId: "optwatch",
      owner: "A",
      controller: "A",
      location: { zone: "monde" },
    };
    const engine = createEffectEngine(
      mockDeps({
        draw,
        getState: () => state,
        getCard: (id: string | null) =>
          id === "optwatch" ? optWatcher : id ? (CARDS[id] ?? null) : null,
      }),
    );
    engine.queueArrivalEffects("A", WABBIT, "wab1");
    expect(draw).not.toHaveBeenCalled();
    expect(engine.effectChoice.value).toMatchObject({
      seat: "A",
      cardName: "Château des Wabbits",
      sourceId: "w1",
    });
    engine.effectChoiceResolve(true);
    expect(draw).toHaveBeenCalledWith("A", 1);
  });
});
