/**
 * Pouvoirs à COÛT PAYÉ « Inclinez / Détruisez un de vos X : CORPS » (vague W14).
 *
 * Deux volets :
 *  1) DSL — `compileTapEffectText` reconnaît la forme et émet
 *     `{ trigger:"onTap", cost:"paidOps", ops:[costOp, ...body] }` ; rejette les
 *     corps actor-binding (« il/elle … », « sa Force ») et les corps non mappés.
 *  2) Moteur — `createEffectEngine` isolé (deps mockées, sans store) : le coût
 *     est la première op de ciblage (pause), le clic sur une de SES créatures la
 *     incline/détruit, puis le CORPS se résout ; si AUCUNE créature n'est
 *     éligible, le CORPS ne s'exécute PAS (coût non payé). Le coût-destruction
 *     d'un Allié rapporte son XP à l'adversaire (415.1).
 */
import { describe, it, expect, vi } from "vitest";
import type { Card, CompiledEffect } from "@/types/cards";
import type { GameState } from "@/game";
import { compileTapEffectText, isPaidCostText } from "../dsl";
import { effectTargetIds } from "../targeting";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";

// ── Volet 1 : DSL ──────────────────────────────────────────────────────────
describe("DSL — pouvoirs à coût payé (compileTapEffectText)", () => {
  it("« Inclinez un de vos Alliés : Piochez une carte. » → costTap + draw", () => {
    const c = compileTapEffectText(
      "Inclinez un de vos Alliés : Piochez une carte.",
      "Carte X",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "paidOps",
      ops: [
        { op: "costTapControlled", zones: ["monde", "havreSac"] },
        { op: "draw", n: 1 },
      ],
    });
  });

  it("« Détruisez un de vos Alliés : Piochez une carte. » → costDestroy + draw", () => {
    const c = compileTapEffectText(
      "Détruisez un de vos Alliés : Piochez une carte.",
      "Carte X",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "paidOps",
      ops: [
        { op: "costDestroyControlled", zones: ["monde", "havreSac"] },
        { op: "draw", n: 1 },
      ],
    });
  });

  it("« un AUTRE de vos Alliés Bwork » → excludeSource + sub", () => {
    const c = compileTapEffectText(
      "Inclinez un autre de vos Alliés Bwork : La Mama Bwork gagne +1 en Force jusqu'à la fin du tour.",
      "Mama Bwork",
    );
    expect(c?.ops[0]).toEqual({
      op: "costTapControlled",
      sub: "bwork",
      excludeSource: true,
      zones: ["monde", "havreSac"],
    });
    expect(c?.ops[1]).toEqual({ op: "buffForceSelf", n: 1 });
  });

  it("« un de vos Alliés ou Héros Sadida » → heroes + sub ; corps tapTarget adverse", () => {
    const c = compileTapEffectText(
      "Inclinez un de vos Alliés ou Héros Sadida : Inclinez l'Allié ou Héros adverse de votre choix.",
      "Makum Bah",
    );
    expect(c?.ops[0]).toEqual({
      op: "costTapControlled",
      heroes: true,
      sub: "sadida",
      zones: ["monde", "havreSac"],
    });
    expect(c?.ops[1]).toMatchObject({
      op: "tapTarget",
      heroes: true,
      controller: "opponent",
    });
  });

  it("actor-binding « il … » désormais compilé (W15) : actor:costTarget", () => {
    // Anciennement rejeté (vague suivante) ; l'actor-binding par coût est implanté
    // en W15 (cf. actor-binding-w15.spec.ts). La créature inclinée au coût devient
    // le sujet du corps.
    const c = compileTapEffectText(
      "Inclinez un de vos Alliés ou Héros : Il inflige sa Force en Dommages à l'Allié de votre choix.",
      "Agression",
    );
    expect(c).toMatchObject({
      trigger: "onTap",
      cost: "paidOps",
      actor: "costTarget",
      ops: [
        { op: "costTapControlled", heroes: true },
        { op: "damageTargetByForce" },
      ],
    });
  });

  it("REJET : corps « … sa Force … » actor-binding", () => {
    const c = compileTapEffectText(
      "Inclinez un de vos Monstres : Gagnez un bonus égal à sa Force.",
      "Carte X",
    );
    expect(c).toBeNull();
  });

  it("REJET : corps non mappé (« Ajoutez un Ether … »)", () => {
    const c = compileTapEffectText(
      "Inclinez un de vos Forgemages : Ajoutez un Ether sur l'Anneau Cristalin.",
      "Anneau Cristalin",
    );
    expect(c).toBeNull();
  });

  it("isPaidCostText : vrai sur la forme, faux sinon", () => {
    expect(
      isPaidCostText("Inclinez un de vos Alliés : Piochez une carte."),
    ).toBe(true);
    expect(
      isPaidCostText("Détruisez un de vos Alliés : Piochez une carte."),
    ).toBe(true);
    expect(isPaidCostText("Piochez une carte.")).toBe(false);
    expect(isPaidCostText("Détruisez cette carte : Piochez une carte.")).toBe(
      false,
    );
  });
});

// ── Volet 2 : moteur isolé ──────────────────────────────────────────────────

/**
 * État avec instances posées dans le Monde. `who` = contrôleur. Les Alliés A1/A2
 * appartiennent à A ; B1 à B. Tous dressés par défaut.
 */
function makeStateWithInstances(): GameState {
  const inst = (
    id: string,
    cardId: string,
    controller: "A" | "B",
    orientation: "upright" | "tapped" = "upright",
  ) => ({
    instanceId: id,
    cardId,
    owner: controller,
    controller,
    orientation,
    location: { zone: "monde" as const },
    counters: {},
  });
  return {
    turn: { active: "A", number: 1 },
    monde: ["a1", "a2", "b1"],
    instances: {
      "hero-A": inst("hero-A", "cardHeroA", "A"),
      "hero-B": inst("hero-B", "cardHeroB", "B"),
      a1: inst("a1", "cardAlly", "A"),
      a2: inst("a2", "cardAlly", "A"),
      b1: inst("b1", "cardAlly", "B"),
    },
    seats: {
      A: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-A" },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-B" },
    },
  } as unknown as GameState;
}

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

function mockDeps(
  state: GameState,
  over: Partial<EffectEngineDeps> = {},
): EffectEngineDeps {
  return {
    getState: () => state,
    rulesCtx: () => ({
      state,
      getCard: (id) =>
        id === "cardAlly"
          ? ALLY_CARD
          : id === "cardHeroA" || id === "cardHeroB"
            ? HERO_CARD
            : null,
    }),
    getCard: (id) =>
      id === "cardAlly"
        ? ALLY_CARD
        : id === "cardHeroA" || id === "cardHeroB"
          ? HERO_CARD
          : null,
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

describe("moteur — flux complet d'un coût payé", () => {
  it("costTapControlled : le coût met en pause, n'éligibilise QUE vos créatures dressées", () => {
    const state = makeStateWithInstances();
    const engine = createEffectEngine(mockDeps(state));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Carte X",
      sourceId: "a1",
      ops: [
        { op: "costTapControlled", zones: ["monde", "havreSac"] },
        { op: "draw", n: 1 },
      ],
    });
    // en pause sur le ciblage du coût
    expect(engine.effectTargeting.value?.op.op).toBe("costTapControlled");
    // éligibles = a1, a2 (à A, dressés) ; PAS b1 (à B)
    expect([...engine.effectTargetIdsList.value].sort()).toEqual(["a1", "a2"]);
  });

  it("costTapControlled : choisir incline la créature PUIS le corps (draw) se résout", () => {
    const state = makeStateWithInstances();
    const dispatch = vi.fn();
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { dispatch, draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Carte X",
      sourceId: "a1",
      ops: [
        { op: "costTapControlled", zones: ["monde", "havreSac"] },
        { op: "draw", n: 1 },
      ],
    });
    engine.effectTargetChoose("a2");
    // l'inclinaison de a2 a bien été émise
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_ORIENTATION",
        payload: { instanceId: "a2", orientation: "tapped" },
      }),
      ...[expect.anything()],
    );
    // puis le corps : draw 1
    expect(draw).toHaveBeenCalledWith("A", 1);
    expect(engine.effectTargeting.value).toBeNull();
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("excludeSource : la source (a1) n'est PAS éligible au coût « un autre de vos »", () => {
    const state = makeStateWithInstances();
    const engine = createEffectEngine(mockDeps(state));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Mama Bwork",
      sourceId: "a1",
      ops: [
        {
          op: "costTapControlled",
          excludeSource: true,
          zones: ["monde", "havreSac"],
        },
        { op: "buffForceSelf", n: 1 },
      ],
    });
    expect([...engine.effectTargetIdsList.value]).toEqual(["a2"]);
  });

  it("COÛT NON PAYABLE (aucune créature éligible) : le CORPS ne s'exécute PAS", () => {
    // état où A n'a aucune créature (que le Héros B et un Allié B)
    const state = makeStateWithInstances();
    // retire a1/a2 de A : ne laisse que b1 (à B)
    delete (state.instances as Record<string, unknown>).a1;
    delete (state.instances as Record<string, unknown>).a2;
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Carte X",
      sourceId: "src-absent",
      ops: [
        { op: "costTapControlled", zones: ["monde", "havreSac"] },
        { op: "draw", n: 1 },
      ],
    });
    // pas de pause (rien à cibler), et SURTOUT le corps n'a pas tourné
    expect(engine.effectTargeting.value).toBeNull();
    expect(draw).not.toHaveBeenCalled();
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("effectTargetSkip sur un coût : annule le pouvoir, le corps ne tourne pas", () => {
    const state = makeStateWithInstances();
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Carte X",
      sourceId: "a1",
      ops: [
        { op: "costTapControlled", zones: ["monde", "havreSac"] },
        { op: "draw", n: 1 },
      ],
    });
    expect(engine.effectTargeting.value).not.toBeNull();
    engine.effectTargetSkip();
    expect(draw).not.toHaveBeenCalled();
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("costDestroyControlled : détruit la créature (XP à l'adversaire, 415.1) PUIS le corps", () => {
    const state = makeStateWithInstances();
    const dispatch = vi.fn();
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { dispatch, draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Brâkmar",
      sourceId: "src",
      ops: [
        { op: "costDestroyControlled", zones: ["monde", "havreSac"] },
        { op: "draw", n: 1 },
      ],
    });
    engine.effectTargetChoose("a1");
    // l'Allié a1 (à A) détruit → XP au Héros adverse (B) : incCounter xp sur hero-B
    const xpEvent = dispatch.mock.calls
      .flat()
      .find(
        (e) =>
          e &&
          typeof e === "object" &&
          e.type === "INC_COUNTER" &&
          e.payload?.instanceId === "hero-B" &&
          e.payload?.counter === "xp",
      );
    expect(xpEvent, "un event XP sur le Héros adverse").toBeTruthy();
    expect(xpEvent.payload.delta).toBe(3); // experience de l'Allié Test
    // puis corps : draw 1
    expect(draw).toHaveBeenCalledWith("A", 1);
  });
});

describe("effectTargetIds — filtres du coût", () => {
  it("heroes:false n'éligibilise PAS le Héros ; heroes:true l'inclut", () => {
    const state = makeStateWithInstances();
    const ctx = mockDeps(state).rulesCtx();
    const sansHeros = effectTargetIds(
      ctx,
      { op: "costTapControlled", zones: ["monde", "havreSac"] },
      "A",
    );
    expect(sansHeros).not.toContain("hero-A");
    const avecHeros = effectTargetIds(
      ctx,
      { op: "costTapControlled", heroes: true, zones: ["monde", "havreSac"] },
      "A",
    );
    expect(avecHeros).toContain("hero-A");
  });

  it("sub : seules les créatures de la Famille demandée", () => {
    const state = makeStateWithInstances();
    // donne la Famille Bwork à a1 uniquement
    (state.instances.a1 as { cardId: string }).cardId = "cardBwork";
    const ctx = mockDeps(state, {
      getCard: (id) =>
        id === "cardBwork"
          ? ({ ...ALLY_CARD, id: "cardBwork", subTypes: ["Bwork"] } as Card)
          : id === "cardAlly"
            ? ALLY_CARD
            : id === "cardHeroA" || id === "cardHeroB"
              ? HERO_CARD
              : null,
      rulesCtx: () => ({
        state,
        getCard: (id) =>
          id === "cardBwork"
            ? ({ ...ALLY_CARD, id: "cardBwork", subTypes: ["Bwork"] } as Card)
            : id === "cardAlly"
              ? ALLY_CARD
              : null,
      }),
    }).rulesCtx();
    const ids = effectTargetIds(
      ctx,
      { op: "costTapControlled", sub: "bwork", zones: ["monde", "havreSac"] },
      "A",
    );
    expect(ids).toEqual(["a1"]);
  });

  it("costTap : une créature déjà inclinée n'est PAS éligible (costDestroy si)", () => {
    const state = makeStateWithInstances();
    (state.instances.a2 as { orientation: string }).orientation = "tapped";
    const ctx = mockDeps(state).rulesCtx();
    const tap = effectTargetIds(
      ctx,
      { op: "costTapControlled", zones: ["monde", "havreSac"] },
      "A",
    );
    expect(tap).toEqual(["a1"]); // a2 inclinée exclue
    const destroy = effectTargetIds(
      ctx,
      { op: "costDestroyControlled", zones: ["monde", "havreSac"] },
      "A",
    );
    expect([...destroy].sort()).toEqual(["a1", "a2"]); // destruction : orientation indifférente
  });
});
