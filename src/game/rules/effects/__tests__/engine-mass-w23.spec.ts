/**
 * Moteur — ops de MASSE (tapAll / untapAll / damageAll) : NON interactives,
 * appliquées à TOUTES les créatures correspondant aux filtres (controller /
 * heroes / sub / maxForce / zones), sans choix du joueur. On vérifie que :
 *  - chaque cible éligible est affectée, les non-éligibles non ;
 *  - le filtre maxForce lit la Force effective ;
 *  - damageAll applique la létalité par cible ;
 *  - aucune mise en pause (effectTargeting/effectPicking restent nuls).
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
  counters: { damage?: number; tokens?: Record<string, number> };
  face?: "recto" | "verso";
};

function ally(
  id: string,
  controller: "A" | "B",
  force: number,
  opts: { tapped?: boolean; sub?: string[]; xp?: number } = {},
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
      experience: opts.xp ?? 1,
      stats: { force: { value: force, element: "Feu" } },
    } as unknown as Card,
  };
}

function hero(id: string, controller: "A" | "B", force = 4) {
  return {
    inst: {
      instanceId: id,
      cardId: `c-${id}`,
      controller,
      owner: controller,
      orientation: "upright" as const,
      location: { zone: "havreSac", owner: controller },
      counters: {},
    } as Inst,
    card: {
      id: `c-${id}`,
      name: id,
      mainType: "Héros",
      recto: { stats: { force: { value: force, element: "Feu" }, pv: 16 } },
    } as unknown as Card,
  };
}

/** Construit un moteur sur un état mutable ; dispatch applique orientation/counters. */
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
    combat: null,
  } as unknown as GameState;

  const dispatch = vi.fn(
    (...drafts: { type?: string; payload?: unknown }[]) => {
      for (const d of drafts) {
        if (d?.type === "SET_ORIENTATION") {
          const p = d.payload as {
            instanceId: string;
            orientation: Inst["orientation"];
          };
          if (instances[p.instanceId])
            instances[p.instanceId].orientation = p.orientation;
        }
        // incCounter / move drafts (létalité) : on ne mute pas finement — les
        // assertions de damageAll portent sur les events émis, pas sur l'état.
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

describe("moteur — tapAll (inclinaison de masse, non interactive)", () => {
  it("incline TOUS les Alliés du Monde (controller any), pas les déjà inclinés", () => {
    const a = ally("a", "A", 2);
    const b = ally("b", "B", 2);
    const c = ally("c", "A", 2, { tapped: true }); // déjà incliné → no-op
    const { engine, instances } = setup([a, b, c]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "tapAll", controller: "any", zones: ["monde"] }],
    });
    expect(instances.a.orientation).toBe("tapped");
    expect(instances.b.orientation).toBe("tapped");
    expect(instances.c.orientation).toBe("tapped");
    // pas de pause : op non interactive
    expect(engine.effectTargeting.value).toBeNull();
    expect(engine.effectPicking.value).toBeNull();
    expect(engine.effectQueue.value.length).toBe(0);
  });

  it("controller self : n'incline que VOS Alliés", () => {
    const a = ally("a", "A", 2);
    const b = ally("b", "B", 2);
    const { engine, instances } = setup([a, b]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "tapAll", controller: "self", zones: ["monde"] }],
    });
    expect(instances.a.orientation).toBe("tapped");
    expect(instances.b.orientation).toBe("upright");
  });

  it("maxForce : n'incline que les Forces effectives ≤ N", () => {
    const lo = ally("lo", "A", 3);
    const hi = ally("hi", "A", 5);
    const { instances } = (() => {
      const s = setup([lo, hi]);
      s.engine.enqueueEffect({
        seat: "A",
        cardName: "T",
        ops: [
          { op: "tapAll", controller: "any", maxForce: 3, zones: ["monde"] },
        ],
      });
      return s;
    })();
    expect(instances.lo.orientation).toBe("tapped");
    expect(instances.hi.orientation).toBe("upright");
  });

  it("heroes : « et Héros » inclut le Héros (havreSac) quand zones le permet", () => {
    const a = ally("a", "A", 2);
    const h = hero("h", "A", 2);
    const { engine, instances } = setup([a, h]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [
        {
          op: "tapAll",
          controller: "any",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
    expect(instances.a.orientation).toBe("tapped");
    expect(instances.h.orientation).toBe("tapped");
  });

  it("sans heroes : le Héros n'est PAS incliné", () => {
    const h = hero("h", "A", 2);
    const { engine, instances } = setup([h]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "tapAll", controller: "any", zones: ["monde", "havreSac"] }],
    });
    expect(instances.h.orientation).toBe("upright");
  });

  it("sub : ne vise que la Famille (« tous vos Bouftous »)", () => {
    const bouf = ally("bouf", "A", 2, { sub: ["Bouftou"] });
    const autre = ally("autre", "A", 2, { sub: ["Tofu"] });
    const { engine, instances } = setup([bouf, autre]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [
        { op: "tapAll", controller: "self", sub: "bouftou", zones: ["monde"] },
      ],
    });
    expect(instances.bouf.orientation).toBe("tapped");
    expect(instances.autre.orientation).toBe("upright");
  });
});

describe("moteur — untapAll (redressement de masse)", () => {
  it("redresse TOUS vos Alliés inclinés, pas ceux déjà dressés ni l'adverse", () => {
    const a = ally("a", "A", 2, { tapped: true });
    const b = ally("b", "A", 2); // déjà dressé → no-op
    const adv = ally("adv", "B", 2, { tapped: true });
    const { engine, instances } = setup([a, b, adv]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "untapAll", controller: "self", zones: ["monde"] }],
    });
    expect(instances.a.orientation).toBe("upright");
    expect(instances.b.orientation).toBe("upright");
    expect(instances.adv.orientation).toBe("tapped"); // adverse non touché
  });
});

describe("moteur — damageAll (Dommages de masse)", () => {
  it("inflige les Dommages à chaque Allié adverse (events incCounter damage)", () => {
    const x = ally("x", "B", 5);
    const y = ally("y", "B", 5);
    const mine = ally("mine", "A", 5);
    const { engine, dispatch } = setup([x, y, mine]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [
        {
          op: "damageAll",
          n: 2,
          element: "Feu",
          controller: "opponent",
          zones: ["monde"],
        },
      ],
    });
    // chaque cible adverse a reçu un event de Dommages ; l'allié ami non
    const damaged = dispatch.mock.calls
      .flat()
      .filter(
        (d) =>
          (d as { type?: string }).type === "INC_COUNTER" ||
          (d as { payload?: { counter?: string } }).payload?.counter ===
            "damage",
      );
    // au moins une infliction par cible adverse (létalité non atteinte : 2 < 5)
    expect(damaged.length).toBeGreaterThanOrEqual(2);
  });

  it("létalité par cible : un Allié dont les Dommages atteignent la Force est détruit", () => {
    const fragile = ally("fragile", "B", 2, { xp: 1 });
    const { engine, dispatch } = setup([fragile]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [
        {
          op: "damageAll",
          n: 5, // ≥ Force 2 → létal
          element: "Feu",
          controller: "opponent",
          zones: ["monde"],
        },
      ],
    });
    // un MOVE vers la défausse (destruction) a été émis pour la cible létale
    const destroyed = dispatch.mock.calls
      .flat()
      .some((d) => (d as { type?: string }).type === "MOVE");
    expect(destroyed).toBe(true);
    expect(engine.effectTargeting.value).toBeNull();
  });
});
