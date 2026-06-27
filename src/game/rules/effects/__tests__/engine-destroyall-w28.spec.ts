/**
 * Moteur — op de MASSE destroyAll (board-wipe NON interactif) : détruit TOUTES
 * les créatures correspondant aux filtres (controller / heroes / sub / maxLevel /
 * exactLevel / orientation / zones), sans choix du joueur. On vérifie que :
 *  - chaque cible éligible est détruite (MOVE vers Défausse), les non-éligibles non ;
 *  - Alliés seulement par défaut (un Héros n'est PAS détruit sans `heroes`) ;
 *  - les filtres controller / sub / maxLevel / orientation restreignent l'ensemble ;
 *  - un Allié adverse détruit rapporte son XP (event de gain d'XP / progression) ;
 *  - aucune mise en pause (effectTargeting / effectPicking restent nuls).
 */
import { describe, it, expect, vi } from "vitest";
import type { Card } from "@/types/cards";
import type { GameState } from "@/game";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";

type Inst = {
  instanceId: string;
  cardId: string;
  controller: "A" | "B";
  owner: "A" | "B";
  orientation: "upright" | "tapped";
  location: { zone: string; owner?: "A" | "B" };
  counters: { damage?: number };
  face?: "recto" | "verso";
};

function ally(
  id: string,
  controller: "A" | "B",
  opts: {
    tapped?: boolean;
    sub?: string[];
    level?: number;
    force?: number;
    xp?: number;
  } = {},
): { inst: Inst; card: Card } {
  return {
    inst: {
      instanceId: id,
      cardId: `c-${id}`,
      controller,
      owner: controller,
      orientation: opts.tapped ? "tapped" : "upright",
      location: { zone: "monde" },
      counters: {},
    },
    card: {
      id: `c-${id}`,
      name: id,
      mainType: "Allié",
      subTypes: opts.sub ?? [],
      experience: opts.xp ?? 2,
      stats: {
        force: { value: opts.force ?? 3, element: "Feu" },
        ...(opts.level !== undefined
          ? { niveau: { value: opts.level, element: "Feu" } }
          : {}),
      },
    } as unknown as Card,
  };
}

function hero(id: string, controller: "A" | "B"): { inst: Inst; card: Card } {
  return {
    inst: {
      instanceId: id,
      cardId: `c-${id}`,
      controller,
      owner: controller,
      orientation: "upright",
      location: { zone: "havreSac", owner: controller },
      counters: {},
    },
    card: {
      id: `c-${id}`,
      name: id,
      mainType: "Héros",
      recto: { stats: { force: { value: 4, element: "Feu" }, pv: 16 } },
    } as unknown as Card,
  };
}

function setup(units: { inst: Inst; card: Card }[]) {
  const instances: Record<string, Inst> = {};
  const cards: Record<string, Card> = {};
  for (const u of units) {
    instances[u.inst.instanceId] = u.inst;
    cards[u.card.id] = u.card;
  }
  const state = {
    turn: { active: "A", number: 1 },
    instances,
    monde: units
      .filter((u) => u.inst.location.zone === "monde")
      .map((u) => u.inst.instanceId),
    seats: {
      A: {
        main: [],
        pioche: [],
        defausse: [],
        havreSac: units
          .filter(
            (u) =>
              u.inst.controller === "A" && u.inst.location.zone === "havreSac",
          )
          .map((u) => u.inst.instanceId),
        heroInstanceId: "hero-A",
      },
      B: {
        main: [],
        pioche: [],
        defausse: [],
        havreSac: units
          .filter(
            (u) =>
              u.inst.controller === "B" && u.inst.location.zone === "havreSac",
          )
          .map((u) => u.inst.instanceId),
        heroInstanceId: "hero-B",
      },
    },
    combat: null,
  } as unknown as GameState;

  const dispatch = vi.fn(
    (...drafts: { type?: string; payload?: unknown }[]) => {
      for (const d of drafts) {
        if (d?.type === "MOVE") {
          const p = d.payload as { instanceId: string; to?: { zone?: string } };
          if (instances[p.instanceId] && p.to?.zone)
            instances[p.instanceId].location = { zone: p.to.zone };
        }
      }
    },
  );
  const getCard = (id: string | null) => (id ? (cards[id] ?? null) : null);
  const deps: EffectEngineDeps = {
    getState: () => state,
    rulesCtx: () => ({ state, getCard }),
    getCard,
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: () => "Joueur",
    paOf: () => 6,
    dispatch,
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
  };
  const engine = createEffectEngine(deps);
  return { engine, instances, dispatch };
}

/** Une instance a-t-elle reçu un MOVE de destruction (vers la Défausse) ? */
function wasDestroyed(dispatch: ReturnType<typeof vi.fn>, id: string): boolean {
  return dispatch.mock.calls.flat().some((d) => {
    const ev = d as {
      type?: string;
      payload?: { instanceId?: string; to?: { zone?: string } };
    };
    return (
      ev.type === "MOVE" &&
      ev.payload?.instanceId === id &&
      ev.payload?.to?.zone === "defausse"
    );
  });
}

describe("moteur — destroyAll (destruction de masse, non interactive)", () => {
  it("détruit TOUS les Alliés (controller any), pas les Héros sans `heroes`", () => {
    const a = ally("a", "A");
    const b = ally("b", "B");
    const h = hero("h", "B");
    const { engine, dispatch } = setup([a, b, h]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "Wipe",
      ops: [
        { op: "destroyAll", controller: "any", zones: ["monde", "havreSac"] },
      ],
    });
    expect(wasDestroyed(dispatch, "a")).toBe(true);
    expect(wasDestroyed(dispatch, "b")).toBe(true);
    expect(wasDestroyed(dispatch, "h")).toBe(false); // Héros épargné (pas de flag)
    // op non interactive : aucune pause
    expect(engine.effectTargeting.value).toBeNull();
    expect(engine.effectPicking.value).toBeNull();
    expect(engine.effectQueue.value.length).toBe(0);
  });

  it("controller opponent : ne détruit que les Alliés ADVERSES", () => {
    const mine = ally("mine", "A");
    const foe = ally("foe", "B");
    const { engine, dispatch } = setup([mine, foe]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "Wipe",
      ops: [{ op: "destroyAll", controller: "opponent", zones: ["monde"] }],
    });
    expect(wasDestroyed(dispatch, "foe")).toBe(true);
    expect(wasDestroyed(dispatch, "mine")).toBe(false);
  });

  it("heroes : « et Héros » détruit AUSSI le Héros adverse (board-wipe total)", () => {
    const foe = ally("foe", "B");
    const h = hero("h", "B");
    const { engine, dispatch } = setup([foe, h]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "Wipe",
      ops: [
        {
          op: "destroyAll",
          controller: "opponent",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
    expect(wasDestroyed(dispatch, "foe")).toBe(true);
    expect(wasDestroyed(dispatch, "h")).toBe(true);
  });

  it("sub : ne détruit que la Famille (« tous les Alliés Piou »)", () => {
    const piou = ally("piou", "B", { sub: ["Piou"] });
    const autre = ally("autre", "B", { sub: ["Tofu"] });
    const { engine, dispatch } = setup([piou, autre]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "Apioucalypse",
      ops: [
        { op: "destroyAll", controller: "any", sub: "piou", zones: ["monde"] },
      ],
    });
    expect(wasDestroyed(dispatch, "piou")).toBe(true);
    expect(wasDestroyed(dispatch, "autre")).toBe(false);
  });

  it("exactLevel + orientation (Cybwork) : Niveau 1 ET incliné uniquement", () => {
    const target = ally("target", "B", { level: 1, tapped: true });
    const wrongLevel = ally("wrongLevel", "B", { level: 2, tapped: true });
    const upright = ally("upright", "B", { level: 1 }); // dressé → épargné
    const noLevel = ally("noLevel", "B", { tapped: true }); // sans Niveau → inéligible
    const { engine, dispatch } = setup([target, wrongLevel, upright, noLevel]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "Cybwork",
      ops: [
        {
          op: "destroyAll",
          controller: "any",
          exactLevel: 1,
          orientation: "tapped",
          zones: ["monde"],
        },
      ],
    });
    expect(wasDestroyed(dispatch, "target")).toBe(true);
    expect(wasDestroyed(dispatch, "wrongLevel")).toBe(false);
    expect(wasDestroyed(dispatch, "upright")).toBe(false);
    expect(wasDestroyed(dispatch, "noLevel")).toBe(false);
  });

  it("maxLevel : ne détruit que les Alliés de Niveau ≤ N (sans Niveau = inéligible)", () => {
    const lo = ally("lo", "B", { level: 2 });
    const hi = ally("hi", "B", { level: 5 });
    const none = ally("none", "B");
    const { engine, dispatch } = setup([lo, hi, none]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "Wipe",
      ops: [
        { op: "destroyAll", controller: "any", maxLevel: 3, zones: ["monde"] },
      ],
    });
    expect(wasDestroyed(dispatch, "lo")).toBe(true);
    expect(wasDestroyed(dispatch, "hi")).toBe(false);
    expect(wasDestroyed(dispatch, "none")).toBe(false);
  });

  it("XP : la destruction d'un Allié adverse émet un gain de progression (415.1)", () => {
    const foe = ally("foe", "B", { xp: 3 });
    const { engine, dispatch } = setup([foe]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "Wipe",
      ops: [{ op: "destroyAll", controller: "opponent", zones: ["monde"] }],
    });
    // resolveDestroyTarget pousse les events de grantXpEvents pour l'adversaire
    // du contrôleur (= A) : au moins un event de compteur (xp/niveau) est émis,
    // EN PLUS du MOVE de destruction.
    const calls = dispatch.mock.calls.flat();
    const moveCount = calls.filter(
      (d) => (d as { type?: string }).type === "MOVE",
    ).length;
    expect(moveCount).toBeGreaterThanOrEqual(1);
    // un effet de progression a été dispatché (events non vides au-delà du MOVE)
    expect(calls.length).toBeGreaterThan(moveCount);
  });
});
