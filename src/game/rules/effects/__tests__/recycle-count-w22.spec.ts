/**
 * Coût « Recyclez JUSQU'À N … » À VALEUR « nombre de cartes recyclées » (vague
 * W22), et moisson putInPlay « de Niveau 1 ou 2 » (filtre levelIn).
 *
 * Trois volets :
 *  1) DSL — `compileRecycleCountCost` (via `compileTapEffectText`) reconnaît
 *     « Recyclez jusqu'à N [Monstres|Alliés|cartes] de votre Défausse : CORPS »
 *     (et « Recyclez X … ») où le CORPS est un scalaire « compte recyclé »
 *     (damageTarget/buffForceTarget/healHeroTarget/heroGainPv, op `fromCount`).
 *     Une Action (Parchemin) compile en "onPlay" ; un permanent en "onTap".
 *     Rejet des formes multi-cible / « Force cumulée » / création de jetons.
 *  2) Moteur — `createEffectEngine` isolé : le recyclage « jusqu'à N » est
 *     OPTIONNEL (0..N), TOUJOURS payé, et lie le nombre RÉELLEMENT recyclé à
 *     `frame.boundCount` ; les ops `fromCount` lisent ce nombre (× perCount).
 *  3) DSL — putInPlay « de Niveau 1 ou 2 » → filtre `levelIn:[1,2]`.
 */
import { describe, it, expect, vi } from "vitest";
import type { Card } from "@/types/cards";
import type { GameState } from "@/game";
import { compileTapEffectText, playEffects } from "../dsl";
import { createEffectEngine, matchesPickFilter } from "../engine";
import type { EffectEngineDeps } from "../engine";

// ── Volet 1 : DSL — coût de recyclage à valeur « nombre recyclé » ───────────
describe("DSL — coût « Recyclez jusqu'à N … » à valeur dynamique (compileTapEffectText)", () => {
  it("« Recyclez jusqu'à 3 cartes … : Infligez le même nombre de Dommages … » → costRecycle{max} + damageTarget{fromCount}", () => {
    const c = compileTapEffectText(
      "Recyclez jusqu'à 3 cartes de votre Défausse : Infligez le même nombre de Dommages à l'Allié ou Héros de votre choix.",
      "Parchemin d'Intelligence",
      "Feu",
    );
    expect(c?.cost).toBe("paidOps");
    expect(c?.ops[0]).toEqual({
      op: "costRecycle",
      from: "defausse",
      n: 3,
      max: true,
    });
    expect(c?.ops[1]).toMatchObject({
      op: "damageTarget",
      n: 0,
      fromCount: true,
      element: "Feu",
      heroes: true,
    });
  });

  it("« Recyclez jusqu'à 3 cartes … : La Force … est augmentée du même nombre … » → buffForceTarget{fromCount}", () => {
    const c = compileTapEffectText(
      "Recyclez jusqu'à 3 cartes de votre Défausse : La Force de l'Allié ou Héros de votre choix est augmentée du même nombre jusqu'à la fin du tour.",
      "Parchemin de Force",
    );
    expect(c?.ops[0]).toMatchObject({ op: "costRecycle", max: true, n: 3 });
    expect(c?.ops[1]).toMatchObject({
      op: "buffForceTarget",
      n: 0,
      fromCount: true,
      heroes: true,
    });
  });

  it("« Recyclez jusqu'à 3 Monstres … : Le Héros … regagne 2 PV par carte recyclée. » → costRecycle{what,sub} + healHeroTarget{fromCount,perCount}", () => {
    const c = compileTapEffectText(
      "Recyclez jusqu'à 3 Monstres de votre Défausse : Le Héros de votre choix regagne 2 PV par carte recyclée.",
      "Parchemin de Vitalité",
    );
    expect(c?.ops[0]).toEqual({
      op: "costRecycle",
      from: "defausse",
      n: 3,
      max: true,
      what: "Allié",
      sub: "monstre",
    });
    expect(c?.ops[1]).toEqual({
      op: "healHeroTarget",
      n: 0,
      fromCount: true,
      perCount: 2,
    });
  });

  it("« Recyclez X Monstres … : Votre Héros regagne X PV. » → heroGainPv{fromCount} (X = compte, n cap)", () => {
    const c = compileTapEffectText(
      "Recyclez X Monstres de votre Défausse : Votre Héros regagne X PV.",
      "Salle des Trophées de Kabrok",
    );
    expect(c?.ops[0]).toMatchObject({
      op: "costRecycle",
      max: true,
      what: "Allié",
      sub: "monstre",
    });
    expect(c?.ops[1]).toEqual({ op: "heroGainPv", n: 0, fromCount: true });
  });

  it("« Recyclez jusqu'à trois Alliés … : <self> inflige le même nombre de Dommages … » → damageTarget{fromCount}, élément source", () => {
    const c = compileTapEffectText(
      "Recyclez jusqu'à trois Alliés de votre Défausse : Olaf Requiem inflige le même nombre de Dommages à l'Allié de votre choix.",
      "Olaf Requiem",
      "Air",
    );
    expect(c?.ops[0]).toEqual({
      op: "costRecycle",
      from: "defausse",
      n: 3,
      max: true,
      what: "Allié",
    });
    expect(c?.ops[1]).toMatchObject({
      op: "damageTarget",
      n: 0,
      fromCount: true,
      element: "Air",
      heroes: false,
    });
  });

  it("Action (Parchemin) → trigger « onPlay » ; permanent (requiresIncline) → « onTap »", () => {
    const action = compileTapEffectText(
      "Recyclez jusqu'à 3 cartes de votre Défausse : Infligez le même nombre de Dommages à l'Allié ou Héros de votre choix.",
      "Parchemin",
      "Neutre",
      true,
    );
    expect(action?.trigger).toBe("onPlay");
    const perm = compileTapEffectText(
      "Recyclez X Monstres de votre Défausse : Votre Héros regagne X PV.",
      "Salle des Trophées de Kabrok",
    );
    expect(perm?.trigger).toBe("onTap");
  });

  // ── Négatifs (SKIP fidèles) ───────────────────────────────────────────────
  it("REJET : multi-cible par compte « Redressez le même nombre d'Alliés … »", () => {
    const c = compileTapEffectText(
      "Recyclez jusqu'à 3 cartes de votre Défausse : Redressez le même nombre d'Alliés ou Héros de votre choix.",
      "Parchemin d'Agilité",
    );
    expect(c).toBeNull();
  });

  it("REJET : « Force cumulée des Monstres recyclés » (valeur dynamique non-compte)", () => {
    const c = compileTapEffectText(
      "Recyclez jusqu'à trois Monstres de votre Défausse : Le Héros de votre choix regagne un nombre de PV égal à la Force cumulée des Monstres recyclés.",
      "La Blanquette Spéciale Alibert",
    );
    expect(c).toBeNull();
  });

  it("REJET : création de jetons « Mettez en jeu le même nombre de jetons … »", () => {
    const c = compileTapEffectText(
      "Recyclez jusqu'à 3 Monstres de votre Défausse : Mettez en jeu le même nombre de jetons « Monstre — Vampyre » de Force 1 inclinés dans le Monde.",
      "Classe de Vampyro",
    );
    expect(c).toBeNull();
  });
});

// ── Volet 2 : moteur isolé — liaison du compte recyclé ──────────────────────

const ALLY_CARD: Card = {
  id: "cardAlly",
  name: "Monstre Test",
  mainType: "Allié",
  extension: "Test",
  rarity: "Commune",
  subTypes: ["Monstre"],
  stats: {
    niveau: { value: 1, element: "Feu" },
    force: { value: 2, element: "Feu" },
  },
  experience: 1,
} as unknown as Card;

const HERO_CARD: Card = {
  id: "cardHeroA",
  name: "Héros A",
  mainType: "Héros",
  extension: "Test",
  rarity: "Commune",
} as unknown as Card;

function makeState(discard: string[] = ["d1", "d2", "d3"]): GameState {
  const inst = (id: string, cardId: string, zone: "monde" | "defausse") => ({
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
    s1: inst("s1", "cardAlly", "monde"),
  };
  for (const id of discard) instances[id] = inst(id, "cardAlly", "defausse");
  return {
    turn: { active: "A", number: 1 },
    monde: ["s1"],
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
    rulesCtx: () => ({ state, getCard }) as never,
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

describe("moteur — costRecycle{max} : liaison du nombre recyclé (heroGainPv fromCount)", () => {
  it("recycler 2 → boundCount 2 → +2 PV au Héros", () => {
    const state = makeState();
    const adjustCounter = vi.fn();
    const moveTo = vi.fn();
    const engine = createEffectEngine(
      mockDeps(state, { adjustCounter, moveTo }),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Salle",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "defausse", n: 3, max: true },
        { op: "heroGainPv", n: 0, fromCount: true },
      ],
    });
    // recyclage interactif (jusqu'à 3) : on en recycle 2 puis on s'arrête.
    expect(engine.effectPicking.value?.upTo).toBe(true);
    engine.effectPick("d1");
    engine.effectPick("d2");
    engine.effectPickSkip(); // arrêt à 2 (sans annuler le pouvoir)
    expect(moveTo).toHaveBeenCalledTimes(2);
    // le corps regagne 2 PV (= compte recyclé)
    expect(adjustCounter).toHaveBeenCalledWith("hero-A", "hp", 2);
  });

  it("recycler 0 (passer d'emblée) → boundCount 0 → +0 PV (no-op fidèle, pas d'annulation)", () => {
    const state = makeState();
    const adjustCounter = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { adjustCounter }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Salle",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "defausse", n: 3, max: true },
        { op: "heroGainPv", n: 0, fromCount: true },
      ],
    });
    engine.effectPickSkip(); // 0 recyclée
    // magnitude 0 → adjustCounter PAS appelé avec un montant non nul ; le corps
    // a bien tourné (frame consommée), pas d'abandon.
    expect(adjustCounter).not.toHaveBeenCalled();
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("Défausse vide → boundCount 0 → corps tourne (magnitude 0), PAS d'abandon", () => {
    const state = makeState([]);
    const adjustCounter = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { adjustCounter }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Salle",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "defausse", n: 3, max: true },
        { op: "heroGainPv", n: 0, fromCount: true },
      ],
    });
    expect(engine.effectPicking.value).toBeNull(); // pas de pause
    expect(adjustCounter).not.toHaveBeenCalled(); // +0
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("perCount : recycler 2 avec perCount 2 → magnitude 4 (« 2 PV par carte recyclée »)", () => {
    const state = makeState();
    const adjustCounter = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { adjustCounter }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Parchemin de Vitalité",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "defausse", n: 3, max: true },
        { op: "heroGainPv", n: 0, fromCount: true, perCount: 2 },
      ],
    });
    engine.effectPick("d1");
    engine.effectPick("d2");
    engine.effectPickSkip();
    expect(adjustCounter).toHaveBeenCalledWith("hero-A", "hp", 4);
  });

  it("recycler jusqu'au max (n=3) lie boundCount 3 automatiquement (pile épuisée / max atteint)", () => {
    const state = makeState(["d1", "d2", "d3"]);
    const adjustCounter = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { adjustCounter }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Salle",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "defausse", n: 3, max: true },
        { op: "heroGainPv", n: 0, fromCount: true },
      ],
    });
    engine.effectPick("d1");
    engine.effectPick("d2");
    engine.effectPick("d3"); // max 3 atteint → le corps se résout sans skip
    expect(engine.effectPicking.value).toBeNull();
    expect(adjustCounter).toHaveBeenCalledWith("hero-A", "hp", 3);
  });

  it("filtre what/sub (Monstre) : seuls les Monstres de la Défausse sont éligibles", () => {
    const state = makeState(["d1", "d2"]);
    // d1/d2 sont des Monstres (cardAlly subTypes Monstre) → éligibles.
    const engine = createEffectEngine(mockDeps(state));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Salle",
      sourceId: "s1",
      ops: [
        {
          op: "costRecycle",
          from: "defausse",
          n: 3,
          max: true,
          what: "Allié",
          sub: "monstre",
        },
        { op: "heroGainPv", n: 0, fromCount: true },
      ],
    });
    expect([...engine.effectPickIds.value].sort()).toEqual(["d1", "d2"]);
  });
});

describe("moteur — costRecycle{max} : damageTarget fromCount (cible)", () => {
  it("recycler 2 → la cible subit 2 Dommages (n figé au compte avant le ciblage)", () => {
    const state = makeState();
    const adjustCounter = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { adjustCounter }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Parchemin d'Intelligence",
      sourceId: "s1",
      ops: [
        { op: "costRecycle", from: "defausse", n: 3, max: true },
        {
          op: "damageTarget",
          n: 0,
          fromCount: true,
          element: "Neutre",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
    engine.effectPick("d1");
    engine.effectPick("d2");
    engine.effectPickSkip(); // 2 recyclées → boundCount 2
    // le ciblage s'ouvre avec n figé à 2
    expect(engine.effectTargeting.value?.op).toMatchObject({
      op: "damageTarget",
      n: 2,
    });
  });
});

// ── Volet 3 : moisson putInPlay « de Niveau 1 ou 2 » (levelIn) ───────────────
describe("DSL — putInPlay « de Niveau 1 ou 2 » (levelIn)", () => {
  it("« Mettez en jeu un Équipement de Niveau 1 ou 2 gratuitement de votre main. »", () => {
    const c = compileTapEffectText(
      "Mettez en jeu un Équipement de Niveau 1 ou 2 gratuitement de votre main.",
      "Thapa Sambal",
    );
    expect(c?.ops[0]).toEqual({
      op: "putInPlay",
      from: "main",
      what: "Équipement",
      levelIn: [1, 2],
    });
  });

  it("« Mettez en jeu un Allié Wabbit de Niveau 1 ou 2 gratuitement de votre main dans le Monde. »", () => {
    const c = compileTapEffectText(
      "Mettez en jeu un Allié Wabbit de Niveau 1 ou 2 gratuitement de votre main dans le Monde.",
      "Wa Wabbit",
    );
    expect(c?.ops[0]).toEqual({
      op: "putInPlay",
      from: "main",
      what: "Allié",
      sub: "wabbit",
      levelIn: [1, 2],
    });
  });

  it("« Mettez en jeu un Monstre de Niveau 1 ou 2 … » → Allié + sub Monstre + levelIn", () => {
    const c = compileTapEffectText(
      "Mettez en jeu un Monstre de Niveau 1 ou 2 gratuitement de votre main.",
      "Trantmy Londami",
    );
    expect(c?.ops[0]).toEqual({
      op: "putInPlay",
      from: "main",
      what: "Allié",
      sub: "monstre",
      levelIn: [1, 2],
    });
  });

  it("Action recycle-cost : playEffects la résout (onPlay)", () => {
    const card = {
      id: "x",
      name: "Parchemin d'Intelligence",
      mainType: "Action",
      effects: [
        {
          description:
            "Recyclez jusqu'à 3 cartes de votre Défausse : Infligez le même nombre de Dommages à l'Allié ou Héros de votre choix.",
        },
      ],
    } as unknown as Card;
    const atoms = playEffects(card);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].ops[0]).toMatchObject({ op: "costRecycle", max: true });
  });
});

// ── matchesPickFilter levelIn (unité) ───────────────────────────────────────
describe("matchesPickFilter — levelIn", () => {
  const card = (lvl?: number) =>
    ({ stats: lvl ? { niveau: { value: lvl } } : {} }) as unknown as Card;
  it("Niveau dans l'ensemble = éligible ; hors ensemble / absent = inéligible", () => {
    expect(matchesPickFilter(card(1), { levelIn: [1, 2] })).toBe(true);
    expect(matchesPickFilter(card(2), { levelIn: [1, 2] })).toBe(true);
    expect(matchesPickFilter(card(3), { levelIn: [1, 2] })).toBe(false);
    expect(matchesPickFilter(card(undefined), { levelIn: [1, 2] })).toBe(false);
  });
});
