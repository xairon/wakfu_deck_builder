/**
 * Pouvoirs à COÛT DE RECYCLAGE « Recyclez … : CORPS » (vague W21).
 *
 * Deux volets :
 *  1) DSL — `compileRecyclePaidCost` (via `compileTapEffectText`) reconnaît les
 *     trois formes (Défausse / main / soi-depuis-le-Monde) et émet
 *     `{ trigger:"onTap", cost:"paidOps", ops:[costRecycle{...}, ...body] }` ;
 *     rejette les corps actor-binding (« il/elle … ») et non mappés, et les
 *     formes à valeur dynamique (« X cartes », « jusqu'à N », « même nombre »,
 *     « élément de la carte recyclée »).
 *  2) Moteur — `createEffectEngine` isolé (deps mockées) : le coût est la
 *     première op. `from:"self"` recycle la SOURCE sans interaction (abandon si
 *     elle n'est pas en jeu) ; `from:"defausse"/"main"` ouvre un choix dans la
 *     pile (abandon si rien à recycler / si le joueur passe — le CORPS ne tourne
 *     PAS, coût non payé).
 */
import { describe, it, expect, vi } from "vitest";
import type { Card, CompiledEffect } from "@/types/cards";
import type { GameState } from "@/game";
import { compileTapEffectText, isRecycleCostText } from "../dsl";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";

// ── Volet 1 : DSL ──────────────────────────────────────────────────────────
describe("DSL — pouvoirs à coût de recyclage (compileTapEffectText)", () => {
  it("« Recyclez une carte de votre Défausse : Piochez une carte. » → costRecycle defausse + draw", () => {
    const c = compileTapEffectText(
      "Recyclez une carte de votre Défausse : Piochez une carte.",
      "Carte X",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "paidOps",
      ops: [
        { op: "costRecycle", from: "defausse" },
        { op: "draw", n: 1 },
      ],
    });
  });

  it("« Recyclez une carte de votre Défausse : Le Héros de votre choix regagne 2 PV. » → healHeroTarget", () => {
    const c = compileTapEffectText(
      "Recyclez une carte de votre Défausse : Le Héros de votre choix regagne 2 PV.",
      "Carte X",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "paidOps",
      ops: [
        { op: "costRecycle", from: "defausse" },
        { op: "healHeroTarget", n: 2 },
      ],
    });
  });

  it("« Recyclez <self> depuis le Monde ou votre Havre Sac : Piochez une carte. » → costRecycle self + draw", () => {
    const c = compileTapEffectText(
      "Recyclez Kolof Toulou depuis le Monde ou votre Havre Sac : Piochez une carte.",
      "Kolof Toulou",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "paidOps",
      ops: [
        { op: "costRecycle", from: "self" },
        { op: "draw", n: 1 },
      ],
    });
  });

  it("« Recyclez <self> depuis le Monde … : Infligez N Dommages … » → damageTarget (élément de la source)", () => {
    const c = compileTapEffectText(
      "Recyclez Choub Nigourak depuis le Monde ou votre Havre Sac : Infligez 1 Dommage à l'Allié ou Héros de votre choix.",
      "Choub Nigourak",
      "Eau",
    );
    expect(c?.ops[0]).toEqual({ op: "costRecycle", from: "self" });
    expect(c?.ops[1]).toMatchObject({
      op: "damageTarget",
      n: 1,
      element: "Eau",
      heroes: true,
    });
  });

  it("« Recyclez <self> depuis le Monde … : Redressez l'Allié ou Héros de votre choix. » → untapTarget", () => {
    const c = compileTapEffectText(
      "Recyclez Ash Tur depuis le Monde ou votre Havre Sac : Redressez l'Allié ou Héros de votre choix.",
      "Ash Tur",
    );
    expect(c?.ops[0]).toEqual({ op: "costRecycle", from: "self" });
    expect(c?.ops[1]).toMatchObject({ op: "untapTarget", heroes: true });
  });

  it("« Recyclez une carte de votre main : Piochez une carte. » → costRecycle main + draw", () => {
    const c = compileTapEffectText(
      "Recyclez une carte de votre main : Piochez une carte.",
      "Carte X",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "paidOps",
      ops: [
        { op: "costRecycle", from: "main" },
        { op: "draw", n: 1 },
      ],
    });
  });

  // ── Négatifs ──────────────────────────────────────────────────────────────
  it("recyclage LIBRE « Recyclez une carte, puis piochez une carte. » : PAS un coût (pas de « : »)", () => {
    // Forme de recyclage LIBRE (op recycleFromDiscard, aucun abandon de corps) :
    // le `: ` est requis pour un coût. isRecycleCostText la rejette ; la
    // compilation existante reste un recycleFromDiscard, sans champ cost.
    expect(
      isRecycleCostText("Recyclez une carte, puis piochez une carte."),
    ).toBe(false);
    const c = compileTapEffectText(
      "Recyclez une carte, puis piochez une carte.",
      "Carte X",
    );
    expect(c?.ops[0].op).toBe("recycleFromDiscard");
    expect(c?.cost).toBeUndefined();
  });

  it("REJET : corps actor-binding « il/elle … » non routé en costRecycle", () => {
    const c = compileTapEffectText(
      "Recyclez Truc depuis le Monde ou votre Havre Sac : Il inflige sa Force en Dommages à l'Allié de votre choix.",
      "Truc",
    );
    expect(c).toBeNull();
  });

  it("REJET : valeur dynamique (« élément de la carte recyclée »)", () => {
    const c = compileTapEffectText(
      "Recyclez une carte de votre Défausse : Produisez une Ressource de l'élément de la carte recyclée.",
      "Carte X",
    );
    expect(c).toBeNull();
  });

  it("W27 : coût de recyclage de soi + « le Héros du joueur de votre choix perd 1 PV » se compose", () => {
    // Le corps « Héros du joueur de votre choix perd N PV » est désormais une op
    // FIDÈLE (damageTarget heroes-only) — il se compose avec le coût costRecycle.
    const c = compileTapEffectText(
      "Recyclez Cya Nhûr depuis le Monde : Le Héros du joueur de votre choix perd 1 PV.",
      "Cya Nhûr",
      "Eau",
    );
    expect(c?.cost).toBe("paidOps");
    expect(c?.ops).toEqual([
      { op: "costRecycle", from: "self" },
      {
        op: "damageTarget",
        n: 1,
        element: "Eau",
        heroes: true,
        targetHeroOnly: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("REJET : « depuis le Monde » dont le sujet n'est PAS la carte (pas subjectIsSelf)", () => {
    const c = compileTapEffectText(
      "Recyclez un Allié depuis le Monde ou votre Havre Sac : Piochez une carte.",
      "Autre Carte",
    );
    expect(c).toBeNull();
  });

  it("isRecycleCostText : vrai sur la forme à « : », faux sinon", () => {
    expect(
      isRecycleCostText(
        "Recyclez une carte de votre Défausse : Piochez une carte.",
      ),
    ).toBe(true);
    expect(
      isRecycleCostText(
        "Recyclez Kolof Toulou depuis le Monde ou votre Havre Sac : Piochez une carte.",
      ),
    ).toBe(true);
    expect(isRecycleCostText("Recyclez une carte.")).toBe(false);
  });
});

// ── Volet 2 : moteur isolé ──────────────────────────────────────────────────

const ALLY_CARD: Card = {
  id: "cardAlly",
  name: "Allié Test",
  mainType: "Allié",
  extension: "Test",
  rarity: "Commune",
  subTypes: [],
  stats: {
    niveau: { value: 1, element: "Feu" },
    force: { value: 2, element: "Feu" },
  },
  experience: 3,
} as unknown as Card;

const HERO_CARD: Card = {
  id: "cardHeroA",
  name: "Héros A",
  mainType: "Héros",
  extension: "Test",
  rarity: "Commune",
} as unknown as Card;

/**
 * État avec une SOURCE (s1) en jeu dans le Monde (contrôleur A) et une Défausse
 * de A contenant deux cartes (d1, d2).
 */
function makeState(
  opts: { sourceInPlay?: boolean; discard?: string[] } = {},
): GameState {
  const { sourceInPlay = true, discard = ["d1", "d2"] } = opts;
  const inst = (
    id: string,
    cardId: string,
    zone: "monde" | "defausse" | "main",
  ) => ({
    instanceId: id,
    cardId,
    owner: "A" as const,
    controller: "A" as const,
    orientation: "upright" as const,
    location: { zone },
    counters: {},
  });
  const instances: Record<string, unknown> = {
    "hero-A": inst("hero-A", "cardHeroA", "monde"),
    "hero-B": {
      ...inst("hero-B", "cardHeroA", "monde"),
      owner: "B",
      controller: "B",
    },
    d1: inst("d1", "cardAlly", "defausse"),
    d2: inst("d2", "cardAlly", "defausse"),
  };
  if (sourceInPlay) instances.s1 = inst("s1", "cardAlly", "monde");
  return {
    turn: { active: "A", number: 1 },
    monde: sourceInPlay ? ["s1"] : [],
    instances,
    seats: {
      A: {
        main: [],
        pioche: [],
        defausse: [...discard],
        heroInstanceId: "hero-A",
      },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-B" },
    },
  } as unknown as GameState;
}

function mockDeps(
  state: GameState,
  over: Partial<EffectEngineDeps> = {},
): EffectEngineDeps {
  const getCard = (id: string | null) =>
    id === "cardAlly" ? ALLY_CARD : id === "cardHeroA" ? HERO_CARD : null;
  return {
    getState: () => state,
    rulesCtx: () => ({ state, getCard }),
    getCard,
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

describe("moteur — costRecycle from:self", () => {
  it("recycle la SOURCE sous la Pioche (sans interaction) PUIS le corps (draw)", () => {
    const state = makeState();
    const moveTo = vi.fn();
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { moveTo, draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Choub",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "self" },
        { op: "draw", n: 1 },
      ],
    });
    // la source s1 est recyclée sous la Pioche de son propriétaire
    expect(moveTo).toHaveBeenCalledWith(
      "s1",
      { zone: "pioche", owner: "A" },
      { at: "bottom" },
    );
    // pas d'interaction
    expect(engine.effectPicking.value).toBeNull();
    // puis le corps : draw 1
    expect(draw).toHaveBeenCalledWith("A", 1);
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("source PAS en jeu : coût non payable → le CORPS ne tourne PAS", () => {
    const state = makeState({ sourceInPlay: false });
    const moveTo = vi.fn();
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { moveTo, draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Choub",
      sourceId: "s1", // absent de instances
      ops: [
        { op: "costRecycle", from: "self" },
        { op: "draw", n: 1 },
      ],
    });
    expect(moveTo).not.toHaveBeenCalled();
    expect(draw).not.toHaveBeenCalled();
    expect(engine.effectQueue.value).toHaveLength(0);
  });
});

describe("moteur — costRecycle from:defausse", () => {
  it("met en pause sur le choix dans la Défausse (cartes éligibles = d1, d2)", () => {
    const state = makeState();
    const engine = createEffectEngine(mockDeps(state));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Carte X",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "defausse" },
        { op: "draw", n: 1 },
      ],
    });
    expect(engine.effectPicking.value?.zone).toBe("defausse");
    expect(engine.effectPicking.value?.action).toBe("recycle");
    expect(engine.effectPicking.value?.cost).toBe(true);
    expect([...engine.effectPickIds.value].sort()).toEqual(["d1", "d2"]);
  });

  it("choisir recycle la carte (sous la Pioche) PUIS le corps (draw) se résout", () => {
    const state = makeState();
    const moveTo = vi.fn();
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { moveTo, draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Carte X",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "defausse" },
        { op: "draw", n: 1 },
      ],
    });
    engine.effectPick("d1");
    expect(moveTo).toHaveBeenCalledWith(
      "d1",
      { zone: "pioche", owner: "A" },
      { at: "bottom" },
    );
    expect(draw).toHaveBeenCalledWith("A", 1);
    expect(engine.effectPicking.value).toBeNull();
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("Défausse VIDE : coût non payable → le CORPS ne tourne PAS (pas de pause)", () => {
    const state = makeState({ discard: [] });
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Carte X",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "defausse" },
        { op: "draw", n: 1 },
      ],
    });
    expect(engine.effectPicking.value).toBeNull();
    expect(draw).not.toHaveBeenCalled();
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("PASSER le choix (effectPickSkip) sur un coût : annule le pouvoir, le corps ne tourne pas", () => {
    const state = makeState();
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Carte X",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "defausse" },
        { op: "draw", n: 1 },
      ],
    });
    expect(engine.effectPicking.value).not.toBeNull();
    engine.effectPickSkip();
    expect(draw).not.toHaveBeenCalled();
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("filtre Élément : seules les cartes de l'Élément demandé sont éligibles", () => {
    // d1/d2 sont Feu (cardAlly). Un filtre Eau ne laisse aucune carte → abandon.
    const state = makeState();
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Carte X",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "defausse", element: "Eau" },
        { op: "draw", n: 1 },
      ],
    });
    // aucune carte Eau → coût non payable → pas de pause, corps non exécuté
    expect(engine.effectPicking.value).toBeNull();
    expect(draw).not.toHaveBeenCalled();
  });
});
