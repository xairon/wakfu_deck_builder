/**
 * Tranche W9 — filtres de cible fidèles et redressement de la source.
 *
 *  - untapSelf : redresse la SOURCE (engine runFrame), no-op si déjà dressée.
 *  - destroyTarget `sub` / `maxLevel` : seule une cible de la bonne Famille /
 *    de Niveau ≤ N est éligible (cible sans Niveau = INÉLIGIBLE, comme
 *    matchesPickFilter).
 *  - damageTarget `sub` : restreint à la Famille demandée.
 *  - destroyTarget « le Dofus de votre choix » (type Dofus ajouté).
 *  - DSL : chaque phrasing compile vers l'op exacte ; pas de sur-capture.
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import type { Card } from "@/types/cards";
import { effectTargetIds } from "@/game/rules";
import {
  bringToMonde,
  ctxOf,
  fixture,
  instId,
  makeAlly,
} from "../../__tests__/harness";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { compileActionEffectText, compileTapEffectText } from "../dsl.ts";

/** Allié avec Famille(s) + Niveau explicites (le harnais ne les expose pas). */
function makeAllyFam(
  id: string,
  subTypes: string[],
  opts: { niveau?: number } = {},
): Card {
  const base = makeAlly(id, { niveau: opts.niveau });
  return { ...base, subTypes } as Card;
}

// ───────────────────────── untapSelf (engine) ─────────────────────────

function selfState(orientation: "upright" | "tapped"): GameState {
  return {
    turn: { active: "A", number: 1 },
    instances: {
      src: {
        instanceId: "src",
        orientation,
        location: { zone: "monde" },
      },
    },
    seats: {
      A: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-A" },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-B" },
    },
  } as unknown as GameState;
}

function mockDeps(
  state: GameState,
  over: Partial<EffectEngineDeps> = {},
): EffectEngineDeps {
  return {
    getState: () => state,
    rulesCtx: () => ({ state, getCard: () => null }),
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

describe("W9 — untapSelf (engine runFrame)", () => {
  it("redresse la source inclinée (SET_ORIENTATION upright)", () => {
    const dispatch = vi.fn();
    const engine = createEffectEngine(
      mockDeps(selfState("tapped"), { dispatch }),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      sourceId: "src",
      ops: [{ op: "untapSelf" }],
    });
    const ev = dispatch.mock.calls
      .flat()
      .find((e) => e?.type === "SET_ORIENTATION");
    expect(ev).toMatchObject({
      actor: "A",
      payload: { instanceId: "src", orientation: "upright" },
    });
  });

  it("NO-OP si la source est déjà dressée", () => {
    const dispatch = vi.fn();
    const engine = createEffectEngine(
      mockDeps(selfState("upright"), { dispatch }),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      sourceId: "src",
      ops: [{ op: "untapSelf" }],
    });
    const ev = dispatch.mock.calls
      .flat()
      .find((e) => e?.type === "SET_ORIENTATION");
    expect(ev).toBeUndefined();
  });
});

// ──────────────────── destroyTarget sub / maxLevel ────────────────────

describe("W9 — destroyTarget filtre Famille (sub)", () => {
  it("ne liste que les Alliés de la Famille demandée", () => {
    const bouftou = makeAllyFam("a0", ["Bouftou"]);
    const tofu = makeAllyFam("a1", ["Tofu"]);
    const f = fixture([bouftou, tofu]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "destroyTarget", what: "Allié", sub: "bouftou", zones: ["monde"] },
      "A",
    );
    expect(ids).toEqual([instId("A", 0)]);
  });
});

describe("W9 — destroyTarget filtre Niveau (maxLevel)", () => {
  it("ne liste que les cibles de Niveau ≤ N", () => {
    const lvl2 = makeAllyFam("a0", ["Bouftou"], { niveau: 2 });
    const lvl5 = makeAllyFam("a1", ["Bouftou"], { niveau: 5 });
    const f = fixture([lvl2, lvl5]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "destroyTarget", what: "Allié", maxLevel: 3, zones: ["monde"] },
      "A",
    );
    expect(ids).toEqual([instId("A", 0)]);
  });

  it("une cible SANS valeur de Niveau est INÉLIGIBLE sous maxLevel", () => {
    const withLvl = makeAllyFam("a0", ["Bouftou"], { niveau: 1 });
    const noLvl = makeAllyFam("a1", ["Bouftou"]);
    // retire la valeur de Niveau (cible « sans Niveau »)
    const stripped = {
      ...noLvl,
      stats: { ...noLvl.stats, niveau: undefined },
    } as Card;
    const f = fixture([withLvl, stripped]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "destroyTarget", what: "Allié", maxLevel: 3, zones: ["monde"] },
      "A",
    );
    expect(ids).toEqual([instId("A", 0)]);
  });
});

// ─────────────────────── damageTarget sub ───────────────────────

describe("W9 — damageTarget filtre Famille (sub)", () => {
  it("ne liste que les Alliés de la Famille demandée", () => {
    const bouftou = makeAllyFam("a0", ["Bouftou"]);
    const tofu = makeAllyFam("a1", ["Tofu"]);
    const f = fixture([bouftou, tofu]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(
      ctxOf(f),
      {
        op: "damageTarget",
        n: 2,
        element: "Feu",
        heroes: false,
        sub: "bouftou",
        zones: ["monde"],
      },
      "A",
    );
    expect(ids).toEqual([instId("A", 0)]);
  });
});

// ───────────────────────────── DSL ─────────────────────────────

function action(text: string, name = "Test") {
  return compileActionEffectText(text, name)?.ops ?? null;
}

describe("W9 — DSL destroyTarget (Famille / Niveau / Dofus)", () => {
  it("« Détruisez l'Allié Bouftou de votre choix » → sub", () => {
    expect(action("Détruisez l'Allié Bouftou de votre choix.")).toEqual([
      { op: "destroyTarget", what: "Allié", sub: "bouftou", zones: ["monde"] },
    ]);
  });

  it("« Détruisez l'Allié de votre choix de Niveau inférieur ou égal à 3 » → maxLevel", () => {
    expect(
      action(
        "Détruisez l'Allié de votre choix de Niveau inférieur ou égal à 3.",
      ),
    ).toEqual([
      { op: "destroyTarget", what: "Allié", maxLevel: 3, zones: ["monde"] },
    ]);
  });

  it("« Détruisez le Dofus de votre choix » → what Dofus", () => {
    expect(action("Détruisez le Dofus de votre choix.")).toEqual([
      { op: "destroyTarget", what: "Dofus", zones: ["monde"] },
    ]);
  });

  it("forme nue « Détruisez l'Allié de votre choix » reste sans sub/maxLevel", () => {
    expect(action("Détruisez l'Allié de votre choix.")).toEqual([
      { op: "destroyTarget", what: "Allié", zones: ["monde"] },
    ]);
  });

  it("ne sur-capture pas : « Détruisez l'Allié ou la Zone de votre choix » → whatAny", () => {
    expect(action("Détruisez l'Allié ou la Zone de votre choix.")).toEqual([
      { op: "destroyTarget", whatAny: ["Allié", "Zone"], zones: ["monde"] },
    ]);
  });
});

describe("W9 — DSL damageTarget Famille", () => {
  it("« Infligez 2 Dommages à l'Allié Bouftou de votre choix » → sub", () => {
    expect(
      action("Infligez 2 Dommages à l'Allié Bouftou de votre choix."),
    ).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Neutre",
        heroes: false,
        sub: "bouftou",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« Infligez 2 Dommages à l'Allié ou Héros de votre choix » reste heroes (pas de sub)", () => {
    expect(
      action("Infligez 2 Dommages à l'Allié ou Héros de votre choix."),
    ).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Neutre",
        heroes: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });
});

describe("W9 — DSL untapSelf", () => {
  it("« Redressez le Croum » (sujet = la carte) → untapSelf", () => {
    expect(compileTapEffectText("Redressez le Croum.", "Croum")?.ops).toEqual([
      { op: "untapSelf" },
    ]);
  });

  it("« Redressez cette carte » → untapSelf (nom inclus)", () => {
    expect(
      compileTapEffectText("Redressez cette carte.", "carte")?.ops,
    ).toEqual([{ op: "untapSelf" }]);
  });

  it("ne sur-capture pas : « Redressez l'Allié de votre choix » → untapTarget (pas untapSelf)", () => {
    expect(action("Redressez l'Allié de votre choix.", "Croum")).toEqual([
      { op: "untapTarget", zones: ["monde"] },
    ]);
  });

  it("ne sur-capture pas : « Redressez votre Héros » → untapHeroSelf", () => {
    expect(action("Redressez votre Héros.", "Croum")).toEqual([
      { op: "untapHeroSelf" },
    ]);
  });
});
