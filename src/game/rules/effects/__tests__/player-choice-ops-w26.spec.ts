/**
 * Tranche W26 — ops « LE JOUEUR DE VOTRE CHOIX … ». Le choix d'un JOUEUR est
 * modélisé comme un CIBLAGE de Héros (réutilise effectTargeting / aucune nouvelle
 * interaction) ; l'effet s'applique au CONTRÔLEUR du Héros choisi.
 *   - playerDraw : le joueur choisi pioche N (deps.draw sur son siège).
 *   - playerLoseStatTurn : jeton paMod/pmMod −N sur le Héros choisi (token,
 *     purgé en fin de tour comme oppLoseStatTurn).
 *   - playerGainStat : jeton paMod/pmMod +N (pendant positif).
 * Éligibilité = TOUS les Héros en jeu (les DEUX contrôleurs : on peut se choisir
 * soi-même OU l'adversaire — c'est le sens de « de votre choix »).
 *
 * Couvre aussi le DSL (positifs / négatifs) et un échantillon de harvest réel.
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { effectTargetIds, isTargetingOp, isPlayerChoiceOp } from "../targeting";
import { compileTapEffectText, compileEffectText } from "../dsl";
import { isTurnToken } from "../limits";

// Deux Héros en jeu (Monde), un par contrôleur.
function makeState(): GameState {
  return {
    turn: { active: "A", number: 1 },
    combat: null,
    instances: {
      "hero-A": {
        instanceId: "hero-A",
        cardId: "cA",
        controller: "A",
        owner: "A",
        orientation: "upright",
        counters: {},
        location: { zone: "monde", owner: "A" },
      },
      "hero-B": {
        instanceId: "hero-B",
        cardId: "cB",
        controller: "B",
        owner: "B",
        orientation: "upright",
        counters: {},
        location: { zone: "monde", owner: "B" },
      },
    },
    seats: {
      A: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-A" },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-B" },
    },
  } as unknown as GameState;
}

const heroCard = () => ({ mainType: "Héros" }) as never;

function mockDeps(
  state: GameState,
  over: Partial<EffectEngineDeps> = {},
): EffectEngineDeps {
  const rulesCtx = () => ({ state, getCard: () => heroCard() });
  return {
    getState: () => state,
    rulesCtx: () => rulesCtx() as never,
    getCard: () => heroCard(),
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: (s: string) => `Joueur ${s}`,
    paOf: () => 6,
    dispatch: vi.fn(),
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
    ...over,
  } as unknown as EffectEngineDeps;
}

function tapOps(text: string) {
  return compileTapEffectText(text, "Test")?.ops ?? null;
}

describe("W26 — éligibilité (ciblage de Héros, deux contrôleurs)", () => {
  it("isTargetingOp / isPlayerChoiceOp reconnaissent les trois ops", () => {
    for (const op of [
      { op: "playerDraw", n: 1 },
      { op: "playerLoseStatTurn", stat: "pa", n: 1 },
      { op: "playerGainStat", stat: "pm", n: 1 },
    ] as const) {
      expect(isTargetingOp(op)).toBe(true);
      expect(isPlayerChoiceOp(op)).toBe(true);
    }
  });

  it("éligibilité = les DEUX Héros en jeu", () => {
    const state = makeState();
    const ctx = { state, getCard: () => heroCard() } as never;
    const ids = effectTargetIds(ctx, { op: "playerDraw", n: 1 }, "A");
    expect(new Set(ids)).toEqual(new Set(["hero-A", "hero-B"]));
  });

  it("un Héros HORS jeu (main) n'est pas éligible", () => {
    const state = makeState();
    (state.instances["hero-B"] as { location: { zone: string } }).location = {
      zone: "main",
    };
    const ctx = { state, getCard: () => heroCard() } as never;
    const ids = effectTargetIds(
      ctx,
      { op: "playerLoseStatTurn", stat: "pa", n: 1 },
      "A",
    );
    expect(ids).toEqual(["hero-A"]);
  });
});

describe("W26 — playerDraw (résolution selon le Héros choisi)", () => {
  it("choisir le Héros ADVERSE → l'adversaire pioche", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(makeState(), { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "playerDraw", n: 2 }],
    });
    // le moteur passe en ciblage : on clique le Héros adverse
    expect(engine.effectTargeting.value).not.toBeNull();
    engine.effectTargetChoose("hero-B");
    expect(draw.mock.calls).toEqual([["B", 2]]);
  });

  it("choisir SON PROPRE Héros → soi-même pioche", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(makeState(), { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "playerDraw", n: 1 }],
    });
    engine.effectTargetChoose("hero-A");
    expect(draw.mock.calls).toEqual([["A", 1]]);
  });
});

describe("W26 — playerLoseStatTurn / playerGainStat", () => {
  it("perd PA : INC_COUNTER paMod −N (token) sur le Héros CHOISI, actor = son contrôleur", () => {
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(makeState(), { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "playerLoseStatTurn", stat: "pa", n: 1 }],
    });
    engine.effectTargetChoose("hero-B");
    const inc = dispatch.mock.calls
      .flat()
      .find((e) => e?.type === "INC_COUNTER");
    expect(inc).toMatchObject({
      actor: "B",
      payload: {
        instanceId: "hero-B",
        counter: "paMod",
        delta: -1,
        token: true,
      },
    });
  });

  it("gagne PM : INC_COUNTER pmMod +N (token) sur le Héros choisi", () => {
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(makeState(), { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "playerGainStat", stat: "pm", n: 1 }],
    });
    engine.effectTargetChoose("hero-A");
    const inc = dispatch.mock.calls
      .flat()
      .find((e) => e?.type === "INC_COUNTER");
    expect(inc).toMatchObject({
      actor: "A",
      payload: {
        instanceId: "hero-A",
        counter: "pmMod",
        delta: 1,
        token: true,
      },
    });
  });

  it("le jeton paMod/pmMod est bien purgé en fin de tour (isTurnToken)", () => {
    expect(isTurnToken("paMod")).toBe(true);
    expect(isTurnToken("pmMod")).toBe(true);
  });
});

describe("W26 — DSL (positifs / négatifs)", () => {
  it("« Le joueur de votre choix perd 1 PA jusqu'à la fin du tour » → playerLoseStatTurn pa 1", () => {
    expect(
      tapOps("Le joueur de votre choix perd 1 PA jusqu'à la fin du tour."),
    ).toEqual([{ op: "playerLoseStatTurn", stat: "pa", n: 1 }]);
  });

  it("« … perd 2 PM … » → playerLoseStatTurn pm 2", () => {
    expect(
      tapOps("Le joueur de votre choix perd 2 PM jusqu'à la fin du tour."),
    ).toEqual([{ op: "playerLoseStatTurn", stat: "pm", n: 2 }]);
  });

  it("« … gagne 1 PM … » → playerGainStat pm 1", () => {
    expect(
      tapOps("Le joueur de votre choix gagne 1 PM jusqu'à la fin du tour."),
    ).toEqual([{ op: "playerGainStat", stat: "pm", n: 1 }]);
  });

  it("« … pioche deux cartes » → playerDraw 2", () => {
    expect(tapOps("Le joueur de votre choix pioche deux cartes.")).toEqual([
      { op: "playerDraw", n: 2 },
    ]);
  });

  it("composition : « … perd 1 PA … Piochez une carte. » → playerLoseStatTurn + draw (votre pioche)", () => {
    expect(
      tapOps(
        "Le joueur de votre choix perd 1 PA jusqu'à la fin du tour. Piochez une carte.",
      ),
    ).toEqual([
      { op: "playerLoseStatTurn", stat: "pa", n: 1 },
      { op: "draw", n: 1 },
    ]);
  });

  it("forme onArrive : « Quand X apparaît, le joueur de votre choix perd 1 PM … »", () => {
    const compiled = compileEffectText(
      "Quand X apparaît, le joueur de votre choix perd 1 PM jusqu'à la fin du tour.",
      "X",
    );
    expect(compiled?.ops).toEqual([
      { op: "playerLoseStatTurn", stat: "pm", n: 1 },
    ]);
  });

  it("NÉGATIF : « … jusqu'à la fin de son prochain tour » NE compile PAS (durée non modélisée)", () => {
    expect(
      tapOps(
        "Le joueur de votre choix gagne 1 PM jusqu'à la fin de son prochain tour.",
      ),
    ).toBeNull();
  });

  it("NÉGATIF : « … pioche deux cartes, puis se défausse … » NE compile PAS (défausse du joueur choisi non modélisée)", () => {
    expect(
      tapOps(
        "Le joueur de votre choix pioche deux cartes, puis se défausse d'une carte de sa main.",
      ),
    ).toBeNull();
  });
});

describe("W26 — harvest (échantillon de données réelles)", () => {
  it("Kolo-Kolko : « … perd 1 PM … » se compile", () => {
    expect(
      compileTapEffectText(
        "Le joueur de votre choix perd 1 PM jusqu'à la fin du tour.",
        "Kolo-Kolko",
      )?.ops,
    ).toEqual([{ op: "playerLoseStatTurn", stat: "pm", n: 1 }]);
  });

  it("Maître Corbac (onArrive, 4 PA) se compile", () => {
    expect(
      compileEffectText(
        "Quand le Maître Corbac apparaît, le joueur de votre choix perd 4 PA jusqu'à la fin du tour.",
        "Maître Corbac",
      )?.ops,
    ).toEqual([{ op: "playerLoseStatTurn", stat: "pa", n: 4 }]);
  });

  it("Prespicot (coût sacrifice) se compile", () => {
    const compiled = compileTapEffectText(
      "Détruisez le Prespicot : Le joueur de votre choix perd 1 PA jusqu'à la fin du tour.",
      "Prespicot",
    );
    expect(compiled?.cost).toBe("sacrificeSelf");
    expect(compiled?.ops).toEqual([
      { op: "playerLoseStatTurn", stat: "pa", n: 1 },
    ]);
  });
});
