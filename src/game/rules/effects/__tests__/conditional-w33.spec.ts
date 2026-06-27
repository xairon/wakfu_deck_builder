/**
 * Tranche W33 — sous-système CONDITIONNEL « Si <condition>, <corps> ».
 *
 * Couvre :
 *  - DSL : compile des « Au début de votre tour, si <cond>, CORPS » FIDÈLES,
 *    REJETTE les conditions non évaluables / corps optionnels / zones non
 *    scannées (Défausse) → manuel ;
 *  - ÉVALUATEURS de condition (selfInZone / heroLevel / controlsAlly) :
 *    vrai → le corps s'exécute, faux → le corps est SAUTÉ (no-op) ;
 *  - TIMING / aplatissement moteur : un op à cible dans le corps met bien la
 *    frame en pause comme s'il était à plat ;
 *  - échantillon de moisson (Franchiche Laliane, Peluche de Pleur Nicheuz).
 */
import { describe, it, expect, vi } from "vitest";
import type { Card, CompiledEffectOp } from "@/types/cards";
import type { GameState } from "@/game";
import { compileTurnStartEffectText } from "../dsl";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";

// ── DSL ──────────────────────────────────────────────────────────────────────

describe("DSL conditionnel (W33) — compileTurnStartEffectText", () => {
  it("compile « si [self] est dans le Monde, gagnez 1 XP » → conditional selfInZone", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si le Porteur de la Peluche de Pleur Nicheuz est dans le Monde, gagnez 1 XP.",
      "Peluche de Pleur Nicheuz",
    );
    expect(c).toEqual({
      trigger: "onTurnStart",
      ops: [
        {
          op: "conditional",
          cond: { cond: "selfInZone", zone: "monde" },
          ops: [{ op: "gainXp", n: 1 }],
        },
      ],
    });
  });

  it("compile « si [self] est dans le Monde, votre Héros regagne 1 PV »", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si Franchiche Laliane est dans le Monde, votre Héros regagne 1 PV.",
      "Franchiche Laliane",
    );
    expect(c?.ops[0]).toMatchObject({
      op: "conditional",
      cond: { cond: "selfInZone", zone: "monde" },
      ops: [{ op: "heroGainPv", n: 1 }],
    });
  });

  it("REJETTE « dans votre Défausse » (zone non scannée par onTurnStart) → manuel", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si la Gargrouille est dans votre Défausse, recyclez une carte.",
      "Gargrouille",
    );
    expect(c).toBeNull();
  });

  it("REJETTE un corps optionnel « vous pouvez … » sous condition → manuel", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si Dollarawan le Banquier se trouve dans son Havre Sac, vous pouvez piocher une carte.",
      "Dollarawan le Banquier",
    );
    expect(c).toBeNull();
  });

  it("REJETTE une condition non évaluable (sujet hors self) → manuel", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si votre Héros se trouve dans son Havre Sac, il regagne 2 PV.",
      "Lit Maladorant",
    );
    expect(c).toBeNull();
  });

  it("REJETTE un corps non compilable sous condition → manuel", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si Klara Bôss est dans le Monde, tous les Héros adverses perdent 1 PV.",
      "Klara Bôss",
    );
    expect(c).toBeNull();
  });

  it("compile « si votre Héros est de Niveau 2 ou plus, gagnez 1 XP » → heroLevel >=", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si votre Héros est de Niveau 2 ou plus, gagnez 1 XP.",
      "T",
    );
    expect(c?.ops[0]).toMatchObject({
      op: "conditional",
      cond: { cond: "heroLevel", op: ">=", n: 2 },
      ops: [{ op: "gainXp", n: 1 }],
    });
  });

  it("compile « si vous contrôlez au moins trois Bouftous, piochez une carte » → controlsAlly", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si vous contrôlez au moins trois Bouftous, piochez une carte.",
      "T",
    );
    expect(c?.ops[0]).toMatchObject({
      op: "conditional",
      cond: { cond: "controlsAlly", sub: "bouftou", min: 3 },
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("REJETTE « si vous contrôlez un Enclos » (pas une Famille d'Allié) → manuel", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si vous contrôlez un Enclos, gagnez 1 XP.",
      "T",
    );
    expect(c).toBeNull();
  });
});

// ── Moteur : évaluateurs de condition ───────────────────────────────────────

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    turn: { active: "A", number: 1 },
    monde: [],
    instances: {
      "hero-A": {
        instanceId: "hero-A",
        cardId: "heroA",
        controller: "A",
        orientation: "upright",
        location: { zone: "havreSac" },
        counters: {},
      },
      "hero-B": {
        instanceId: "hero-B",
        cardId: "heroB",
        controller: "B",
        orientation: "upright",
        location: { zone: "havreSac" },
        counters: {},
      },
      "src-1": {
        instanceId: "src-1",
        cardId: "srcCard",
        controller: "A",
        orientation: "upright",
        location: { zone: "monde" },
        counters: {},
      },
    },
    seats: {
      A: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-A" },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-B" },
    },
    ...over,
  } as unknown as GameState;
}

function mockDeps(
  state: GameState,
  over: Partial<EffectEngineDeps> = {},
): EffectEngineDeps {
  return {
    getState: () => state,
    rulesCtx: () => ({ state, getCard: (over.getCard as any) ?? (() => null) }),
    getCard: () => null,
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: (s) => `Joueur ${s}`,
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

function conditionalOp(
  spec: Extract<CompiledEffectOp, { op: "conditional" }>["cond"],
  body: CompiledEffectOp[],
): CompiledEffectOp {
  return { op: "conditional", cond: spec, ops: body } as CompiledEffectOp;
}

describe("createEffectEngine — conditional selfInZone (W33)", () => {
  it("VRAI (source dans le Monde) → le corps s'exécute (gainXp via grant)", () => {
    const state = makeState();
    const adjustCounter = vi.fn();
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { draw, adjustCounter }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Src",
      sourceId: "src-1",
      ops: [
        conditionalOp({ cond: "selfInZone", zone: "monde" }, [
          { op: "draw", n: 2 },
        ]),
      ],
    });
    expect(draw).toHaveBeenCalledWith("A", 2);
  });

  it("FAUX (source dans le Havre-Sac, on demande Monde) → corps SAUTÉ", () => {
    const state = makeState();
    state.instances["src-1"].location = { zone: "havreSac" } as any;
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Src",
      sourceId: "src-1",
      ops: [
        conditionalOp({ cond: "selfInZone", zone: "monde" }, [
          { op: "draw", n: 2 },
        ]),
      ],
    });
    expect(draw).not.toHaveBeenCalled();
  });

  it("FAUX (source absente) → corps SAUTÉ", () => {
    const state = makeState();
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Src",
      sourceId: "ghost",
      ops: [
        conditionalOp({ cond: "selfInZone", zone: "monde" }, [
          { op: "draw", n: 1 },
        ]),
      ],
    });
    expect(draw).not.toHaveBeenCalled();
  });
});

describe("createEffectEngine — conditional heroLevel (W33)", () => {
  function heroState(level: number): GameState {
    const s = makeState();
    s.instances["hero-A"].counters = { level } as any;
    return s;
  }

  it("VRAI (Niveau 2 >= 2) → corps exécuté", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(heroState(2), { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Src",
      sourceId: "src-1",
      ops: [
        conditionalOp({ cond: "heroLevel", op: ">=", n: 2 }, [
          { op: "draw", n: 1 },
        ]),
      ],
    });
    expect(draw).toHaveBeenCalledWith("A", 1);
  });

  it("FAUX (Niveau 1 >= 2) → corps sauté", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(heroState(1), { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Src",
      sourceId: "src-1",
      ops: [
        conditionalOp({ cond: "heroLevel", op: ">=", n: 2 }, [
          { op: "draw", n: 1 },
        ]),
      ],
    });
    expect(draw).not.toHaveBeenCalled();
  });

  it("== compare l'égalité exacte du Niveau", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(heroState(3), { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Src",
      sourceId: "src-1",
      ops: [
        conditionalOp({ cond: "heroLevel", op: "==", n: 2 }, [
          { op: "draw", n: 1 },
        ]),
      ],
    });
    expect(draw).not.toHaveBeenCalled();
  });
});

describe("createEffectEngine — conditional controlsAlly (W33)", () => {
  function withAllies(count: number, sub: string): GameState {
    const s = makeState();
    const getCard = (id: string | null): Card | null =>
      id === "bouftou"
        ? ({ mainType: "Allié", subTypes: [sub] } as unknown as Card)
        : null;
    for (let i = 0; i < count; i++) {
      const id = `ally-${i}`;
      (s.instances as any)[id] = {
        instanceId: id,
        cardId: "bouftou",
        controller: "A",
        orientation: "upright",
        location: { zone: "monde" },
        counters: {},
      };
    }
    (s as any).__getCard = getCard;
    return s;
  }

  it("VRAI (3 Bouftous, min 3) → corps exécuté", () => {
    const s = withAllies(3, "Bouftou");
    const draw = vi.fn();
    const engine = createEffectEngine(
      mockDeps(s, { draw, getCard: (s as any).__getCard }),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Src",
      sourceId: "src-1",
      ops: [
        conditionalOp({ cond: "controlsAlly", sub: "bouftou", min: 3 }, [
          { op: "draw", n: 1 },
        ]),
      ],
    });
    expect(draw).toHaveBeenCalledWith("A", 1);
  });

  it("FAUX (2 Bouftous, min 3) → corps sauté", () => {
    const s = withAllies(2, "Bouftou");
    const draw = vi.fn();
    const engine = createEffectEngine(
      mockDeps(s, { draw, getCard: (s as any).__getCard }),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Src",
      sourceId: "src-1",
      ops: [
        conditionalOp({ cond: "controlsAlly", sub: "bouftou", min: 3 }, [
          { op: "draw", n: 1 },
        ]),
      ],
    });
    expect(draw).not.toHaveBeenCalled();
  });
});

describe("createEffectEngine — timing / aplatissement (W33)", () => {
  it("un op à cible DANS le corps met la frame en pause comme à plat", () => {
    const state = makeState();
    // une cible adverse dans le Monde pour damageTarget
    (state.instances as any)["opp-ally"] = {
      instanceId: "opp-ally",
      cardId: "oppAlly",
      controller: "B",
      orientation: "upright",
      location: { zone: "monde" },
      counters: {},
    };
    (state.monde as any) = ["src-1", "opp-ally"];
    const getCard = (id: string | null): Card | null =>
      id === "oppAlly"
        ? ({ mainType: "Allié", subTypes: [] } as unknown as Card)
        : null;
    const engine = createEffectEngine(mockDeps(state, { getCard }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Src",
      sourceId: "src-1",
      ops: [
        conditionalOp({ cond: "selfInZone", zone: "monde" }, [
          {
            op: "damageTarget",
            n: 2,
            element: "Feu",
            heroes: true,
            zones: ["monde", "havreSac"],
          },
        ]),
      ],
    });
    // condition vraie → corps aplati → l'op à cible OUVRE le mode ciblage (pause)
    expect(engine.effectTargeting.value).not.toBeNull();
    expect(engine.effectTargeting.value?.op.op).toBe("damageTarget");
  });

  it("condition FAUSSE → aucun ciblage ouvert, l'op suivante s'exécute quand même", () => {
    const state = makeState();
    state.instances["src-1"].location = { zone: "havreSac" } as any;
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Src",
      sourceId: "src-1",
      ops: [
        conditionalOp({ cond: "selfInZone", zone: "monde" }, [
          {
            op: "damageTarget",
            n: 2,
            element: "Feu",
            heroes: true,
            zones: ["monde"],
          },
        ]),
        // op APRÈS le conditionnel : doit s'exécuter (le corps sauté n'avorte pas la frame)
        { op: "draw", n: 1 },
      ],
    });
    expect(engine.effectTargeting.value).toBeNull();
    expect(draw).toHaveBeenCalledWith("A", 1);
  });
});
